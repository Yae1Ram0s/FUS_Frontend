import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/api'
import ModalDescargarPDF from '../ModalDescargarPDF'
import ComisionarModal from '../Comisionado/ComisionarModal'
import AccionesValidacion from '../Comisionado/AccionesValidacion'
import SeguimientoComisionadoFeed from '../Comisionado/SeguimientoComisionadoFeed'
import PrioridadPills from './PrioridadPills'
import { CampoDetalle as Row, ListaEvidencias as EvidenciaList } from './DetalleCampos'
import PersonasYRespuestasCard from './PersonasYRespuestasCard'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useNotificaciones } from '../../context/NotificacionesContext'
import { useTurnadosFUS } from '../../hooks/useTurnadosFUS'
import { descargar } from '../../utils/descargarArchivo'
import { formatearFechaHora } from '../../utils/fechas'
import { formatMedioRecepcion } from '../../utils/medio'
import { obtenerIniciales } from '../../utils/personas'
import { puedeComisionar, puedeGestionarComisionados } from '../../utils/permisos'

export default function DetalleFUS({ fus: fusInicial, onTurnar, onBack, onFusChange }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const [fusData, setFusData] = useState(fusInicial)

  // En vivo: cualquier notificación de este FUS (comisionar, atendido,
  // rechazar, concluir...) trae fresco su estatusParticular — así
  // AccionesValidacion (Rechazar/Concluir) aparece al instante para quien ya
  // tiene este FUS abierto, sin depender de que la bandeja lo recargue y
  // vuelva a coincidir en la página actual.
  const notifCtx = useNotificaciones()
  const ultimaNotifId = notifCtx?.notifs?.[0]?.id
  useEffect(() => {
    if (notifCtx?.notifs?.[0]?.fusFolio !== fusInicial.folio) return
    api.get(`/fus/${fusInicial.id}/`).then(({ data }) => {
      setFusData(data)
      onFusChange?.(data)
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ultimaNotifId` ya es el proxy primitivo estable de `notifCtx?.notifs` usado en todo el proyecto
  }, [ultimaNotifId, fusInicial.folio, fusInicial.id])
  const [mostrarModalPdf, setMostrarModalPdf] = useState(false)
  const [modalComisionar, setModalComisionar] = useState(false)
  const fus = fusData
  const esRolGestion = ['ROL1', 'EQUIPO_PARTICULAR'].includes(user?.rol)
  const puedesTurnar = ['Registrado', 'Turnado'].includes(fus.estatusParticular)
  const puedesEditar = fus.estatusParticular === 'Registrado'
  const tieneActividad = fus.estatusParticular !== 'Registrado'
  const tieneExterno = fus.nombreExterno || fus.telefonoExterno || fus.correoExterno
  const { turnados, cargando: turnadosCargando, recargar: recargarTurnados } = useTurnadosFUS(fus.id, fus.folio)

  // Tras marcar atendido / concluir / rechazar la parte de una persona
  // (PersonasYRespuestasCard), el propio actor no recibe notificación (esa
  // le llega a la otra parte) — se actualiza fusData/turnados de una vez con
  // lo que ya regresó el endpoint, sin esperar a un WS que nunca le toca.
  const alCambiarTurnado = async () => {
    recargarTurnados()
    try {
      const { data } = await api.get(`/fus/${fus.id}/`)
      setFusData(data)
      onFusChange?.(data)
    } catch {
      // El cambio ya fue confirmado por el endpoint; la notificación o la
      // siguiente recarga terminará de sincronizar la tarjeta.
    }
  }

  const descargarPdf = (conImagenes, turnadoId) => {
    const folioUrl = fus.folio.split('/').map(encodeURIComponent).join('/')
    const params = new URLSearchParams()
    if (conImagenes) params.set('imagenes', '1')
    if (turnadoId) params.set('turnado_id', turnadoId)
    const query = params.toString() ? `?${params.toString()}` : ''
    return descargar(
      `/fus/${folioUrl}/pdf/${query}`,
      `FUS_${fus.folio.replace(/\//g, '_')}.pdf`,
    ).finally(() => setMostrarModalPdf(false))
  }

  return (
    <>
      {/* Fuera de la tarjeta (.detalle-panel) a propósito: adentro, el
          encabezado tiene fondo verde oscuro y este botón usa el mismo verde
          como color de texto — quedaba prácticamente invisible. Aquí, sobre
          el fondo claro de .cfus-right, sí se ve. */}
      <button className="btn-volver-mobile" onClick={onBack} aria-label="Volver" data-analytics-event="INTERACTION" data-analytics-component="DETALLE_FUS_VOLVER">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Volver
      </button>
      <div className={`detalle-panel${esRolGestion ? ' detalle-panel-rol-gestion' : ''}`}>
        <div className="detalle-header">
          <div className="detalle-header-main">
            <div>
              <h2 className="detalle-title">Detalle de la solicitud</h2>
              <span className="detalle-folio">{fus.folio}</span>
            </div>
            <div className="detalle-header-acciones">
              <button className="btn-descargar-fus" onClick={() => setMostrarModalPdf(true)} title="Descargar PDF" aria-label="Descargar PDF" data-analytics-event="INTERACTION" data-analytics-component="DETALLE_FUS_DESCARGAR_PDF" data-analytics-action="OPEN">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
              {puedesEditar && (
                <button className="btn-editar-fus" onClick={() => navigate(`/rol1/registrar-fus?editar=${fus.id}`)} title="Editar solicitud" aria-label="Editar solicitud" data-analytics-event="INTERACTION" data-analytics-component="DETALLE_FUS_EDITAR" data-analytics-action="NAVIGATE">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
              {puedeComisionar(user, fus) && (
                <button type="button" className="btn-comisionar" onClick={() => setModalComisionar(true)} data-analytics-event="INTERACTION" data-analytics-component="DETALLE_FUS_COMISIONAR" data-analytics-action="OPEN">Comisionar</button>
              )}
            </div>
          </div>
        </div>

        {mostrarModalPdf && (
          <ModalDescargarPDF
            onCancelar={() => setMostrarModalPdf(false)}
            onConfirmar={descargarPdf}
            turnados={turnados}
          />
        )}

        <div className="det-section">
          <span className="det-section-legend">Datos generales</span>
          <div className="det-grid-2">
            <Row label="Fecha y hora" value={formatearFechaHora(fus.fechaHora)} />
            <Row label="Medio de recepción" value={formatMedioRecepcion(fus.idMedioRecepcion, fus.medioEspecificacion)} />
            <Row label="Solicitante interno" value={fus.idSolicitanteInterno?.nombre} />
          </div>
          {fus.idComisionado && !fus.tieneTurnado && (
            <div className="dt-comisionado-chip">
              <span className="dt-comisionado-avatar">{obtenerIniciales(fus.idComisionado.nombre, fus.idComisionado.email)}</span>
              <div className="dt-comisionado-info">
                <span className="dt-comisionado-nombre">{fus.idComisionado.nombre || fus.idComisionado.email}</span>
                <span className="dt-comisionado-direccion">{fus.direccionComisionado || 'Sin dirección asignada'}</span>
              </div>
            </div>
          )}
        </div>

        {tieneActividad && (
          <PersonasYRespuestasCard
            turnados={turnados}
            cargando={turnadosCargando}
            user={user}
            onCambio={alCambiarTurnado}
          />
        )}

        {fus.fechaLimite && (
          <div className="det-section">
            <span className="det-section-legend det-section-legend-activity">Límite de respuesta</span>
            <div className="det-grid-2"><Row label="Fecha y hora" value={formatearFechaHora(fus.fechaLimite)} /></div>
          </div>
        )}

        <div className="det-section">
          <span className="det-section-legend">Descripción de la solicitud</span>
          <Row label="Descripción" value={fus.descripcion} tall />
          {fus.contexto && <Row label="Datos o antecedentes de contexto de la solicitud" value={fus.contexto} tall />}
        </div>

        {tieneExterno && (
          <div className="det-section">
            <span className="det-section-legend">Datos de contacto de solicitante externo</span>
            <div className="det-grid-3">
              {fus.nombreExterno && <Row label="Nombre" value={fus.nombreExterno} />}
              {fus.telefonoExterno && <Row label="Teléfono/Celular" value={fus.telefonoExterno} />}
              {fus.correoExterno && <Row label="Correo" value={fus.correoExterno} />}
            </div>
          </div>
        )}

        <div className="det-section">
          <span className="det-section-legend">Evidencia</span>
          <EvidenciaList evidencias={fus.evidencias} />
        </div>
        <div className="det-section">
          <span className="det-section-legend">Prioridad</span>
          <PrioridadPills valor={fus.prioridad} criterios={fus.criterios} variante="det" />
        </div>
        <div className="detalle-footer">
          {puedesTurnar && <button className="btn-turnar" onClick={() => onTurnar(fus)} data-analytics-event="INTERACTION" data-analytics-component="DETALLE_FUS_TURNAR" data-analytics-action="OPEN">Turnar solicitud</button>}
        </div>
      </div>

      {fus.idComisionado && !fus.tieneTurnado && <SeguimientoComisionadoFeed fusId={fus.id} folio={fus.folio} />}
      <AccionesValidacion user={user} fus={fus} setFusData={setFusData} tieneFacultad={puedeGestionarComisionados(user)} />
      {modalComisionar && (
        <ComisionarModal
          fusId={fus.id}
          onClose={() => setModalComisionar(false)}
          onConfirmado={data => {
            setFusData(data)
            setModalComisionar(false)
            toast.success('Comisionado asignado correctamente.')
          }}
        />
      )}
    </>
  )
}
