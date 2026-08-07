import { useCallback, useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import ModalTimeline from '../components/ModalTimeline'
import ModalDescargarPDF from '../components/ModalDescargarPDF'
import { descargar } from '../utils/descargarArchivo'
import ComisionarModal from '../components/Comisionado/ComisionarModal'
import AccionesValidacion from '../components/Comisionado/AccionesValidacion'
import SeguimientoComisionadoFeed from '../components/Comisionado/SeguimientoComisionadoFeed'
import EvidenciaItem from '../components/FUS/EvidenciaItem'
import PrioridadPills from '../components/FUS/PrioridadPills'
import FiltrosActivosChips from '../components/FiltrosActivosChips'
import FechaInput from '../components/FechaInput'
import api from '../api/api'
import { useEstatus } from '../hooks/useEstatus'
import { useNotificaciones } from '../context/NotificacionesContext'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { puedeGestionarComisionados, puedeComisionar } from '../utils/permisos'
import { obtenerIniciales } from '../utils/personas'
import { PRIORIDAD_NIVELES } from '../utils/prioridades'
import {
  formatearFechaHora,
  formatearFechaISO as fmtFechaCorta,
  formatearHora as fmtHora,
} from '../utils/fechas'
import './SolicitudesTurnadas.css'

const PAGE_SIZE = 30

function combinarPaginasTurnadas(estadoAnterior, paginaNueva) {
  if (!paginaNueva.append) return paginaNueva
  const existentes = new Set(estadoAnterior.items.map(item => item.id))
  return {
    ...paginaNueva,
    items: [
      ...estadoAnterior.items,
      ...paginaNueva.items.filter(item => !existentes.has(item.id)),
    ],
  }
}

/* Marcadores de auditoría de MarcarTurnadoAtendidoView/ConcluirPersonaTurnadoView/
   RechazarPersonaTurnadoView (mismo modelo Seguimiento que las respuestas
   reales) — se distinguen por el texto para no mostrarlos con la etiqueta
   genérica "Respuesta". Mismo criterio que DocumentoRespuestasModal.jsx y
   FUSTrazabilidadView en el backend. */
function tipoTagSeguimiento(s) {
  if (s.esRechazo) return { label: 'Rechazo', clase: 'fc-tag-rojo' }
  const texto = s.descripcionActividad || ''
  if (texto.startsWith('Rechazado por el Particular:')) return { label: 'Rechazo', clase: 'fc-tag-rojo' }
  if (texto === 'Concluido por el Particular.') return { label: 'Concluido', clase: 'fc-tag-verde' }
  if (texto.startsWith('Atendido:')) return { label: 'Atendido', clase: 'fc-tag-azul' }
  return { label: 'Respuesta', clase: 'fc-tag-verde' }
}

/* ── Sección Respuestas y Seguimiento ── */
function Seguimientos({ turnadoId, folio, estatusFus, onRegistrado }) {
  // Fuente única de verdad: fus.estatusParticular (ya se refresca via
  // setFusData en cada acción). 'Pendiente_validacion' bloquea nuevas
  // respuestas mientras el Particular valida — si rechaza, vuelve a
  // 'Rechazado', que SÍ sigue abierto (la siguiente respuesta reabre el
  // FUS, mismo criterio que ya tiene el flujo de Comisionado).
  const concluido = estatusFus === 'Concluido'
  const pendienteValidacion = estatusFus === 'Pendiente_validacion'
  const soloLectura = concluido || pendienteValidacion
  const { user } = useAuth()
  const hoy = new Date().toISOString().split('T')[0]
  const [fecha,       setFecha]       = useState(hoy)
  const [actividad,   setActividad]   = useState('')
  const [accionTexto, setAccionTexto] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [eliminandoId,setEliminandoId] = useState(null)
  const [error,       setError]       = useState('')
  const cargarSeguimientos = useCallback(
    ({ signal }) => api
      .get(`/turnados/${turnadoId}/seguimientos/`, { signal })
      .then(respuesta => respuesta.data),
    [turnadoId],
  )
  const {
    data: lista,
    error: errorCarga,
    reload: cargar,
  } = useAsyncResource(cargarSeguimientos, { initialData: [] })

  // En vivo: cualquier notificación de este FUS (ej. un rechazo del
  // Particular, que se fusiona en este mismo listado) refresca el feed sin
  // esperar a que se remonte el panel.
  const notifCtx = useNotificaciones()
  const ultimaNotifId = notifCtx?.notifs?.[0]?.id
  useEffect(() => {
    if (notifCtx?.notifs?.[0]?.fusFolio === folio) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ultimaNotifId` ya es el proxy primitivo estable de `notifCtx?.notifs` usado en todo el proyecto
  }, [ultimaNotifId, folio])

  const agregar = async () => {
    // Una respuesta puede ir sin acción y una acción sin respuesta — solo se
    // exige que haya al menos una de las dos (no se puede registrar un
    // seguimiento completamente vacío).
    if (!fecha || (!actividad.trim() && !accionTexto.trim())) {
      setError('Completa la fecha y una respuesta o una acción.')
      return
    }
    setError(''); setLoading(true)
    try {
      const r = await api.post(`/turnados/${turnadoId}/seguimientos/`, {
        fechaActividad: fecha,
        descripcionActividad: actividad,
        accionTexto,
      })
      setFecha(hoy); setActividad(''); setAccionTexto('')
      cargar()
      // El backend regresa el estatus vigente del turnado/FUS tras esta
      // respuesta — se lo pasamos al padre para que el botón "Atendido"
      // (AccionesValidacion) aparezca de inmediato, sin refrescar la página.
      onRegistrado?.(r.data.estatusParticular, r.data.estatusTitular)
    } catch (e) {
      setError(e.response?.data?.detail || 'No se pudo registrar. Intenta nuevamente.')
    } finally { setLoading(false) }
  }

  const eliminar = async id => {
    setEliminandoId(id)
    try { await api.delete(`/seguimientos/${id}/`); cargar() }
    catch (e) { setError(e.response?.data?.detail || 'No se pudo eliminar. Intenta nuevamente.') }
    finally { setEliminandoId(null) }
  }

  return (
    <div className="seccion">
      <div className="sec-header sec-resp">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Respuestas y seguimiento
      </div>
      <div className="sec-body">
        {concluido && (
          <div className="seg-concluido-banner">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Asunto concluido — las respuestas son de solo lectura
          </div>
        )}

        {pendienteValidacion && (
          <div className="seg-concluido-banner">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Enviado a validación del Particular — no se pueden agregar más respuestas
          </div>
        )}

        {errorCarga && lista.length > 0 && (
          <div className="banner-error-carga">
            <span>No se pudo actualizar — mostrando la última información disponible.</span>
            <button type="button" onClick={cargar}>Reintentar</button>
          </div>
        )}

        <div className="seg-timeline">
          {errorCarga && lista.length === 0 ? (
            <div className="seg-error">
              <p className="seg-error-msg">No se pudo cargar el historial de respuestas.</p>
              <button type="button" className="btn-reintentar" onClick={cargar}>Reintentar</button>
            </div>
          ) : lista.length === 0 ? (
            <p className="seg-empty">Sin respuestas registradas aún</p>
          ) : lista.map((s, i) => (
            <div key={s.id} className="seg-tl-item">
              <div className="seg-tl-track">
                <div className="seg-tl-dot" />
                {i < lista.length - 1 && <div className="seg-tl-connector" />}
              </div>
              <div className="seg-tl-content">
                <div className="seg-tl-meta">
                  <span className={`fc-tag ${tipoTagSeguimiento(s).clase}`}>
                    {tipoTagSeguimiento(s).label}
                  </span>
                  <span className="seg-tl-fecha">
                    {!s.esRechazo && user?.nombre ? `${user.nombre} · ` : ''}
                    {fmtFechaCorta(s.fechaActividad)}
                    {s.fechaRegistro && <span className="seg-tl-hora"> · {fmtHora(s.fechaRegistro)}</span>}
                  </span>
                  {!soloLectura && !s.esRechazo && (
                    <button className="btn-del" onClick={() => eliminar(s.id)} disabled={eliminandoId === s.id} title="Eliminar">
                      {eliminandoId === s.id
                        ? <span className="btn-spinner" />
                        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/>
                          </svg>}
                    </button>
                  )}
                </div>
                {s.descripcionActividad && (
                  <p className={s.esRechazo ? 'seg-tl-actividad seg-tl-rechazo' : 'seg-tl-actividad'}>{s.descripcionActividad}</p>
                )}
                {s.accionTexto && (
                  <p className="seg-tl-accion">→ {s.accionTexto}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {!soloLectura && (
          <div className="seg-nueva">
            <div className="seg-nueva-inputs">
              <FechaInput type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="seg-nueva-fecha" wrapClassName="seg-nueva-fecha-wrap" />
              <input type="text" placeholder="Describe la actividad…" value={actividad} onChange={e => setActividad(e.target.value)} />
              <input type="text" placeholder="Acción por emprender…" value={accionTexto} onChange={e => setAccionTexto(e.target.value)} />
            </div>
            <button className="btn-agregar" onClick={agregar} disabled={loading}>
              {loading
                ? <span className="btn-spinner" />
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>}
              {loading ? 'Guardando…' : 'Agregar'}
            </button>
          </div>
        )}

        {error && <p className="sec-error" role="alert">{error}</p>}
      </div>
    </div>
  )
}

/* ── Fila de detalle ── */
function DRow({ label, value, tall }) {
  return (
    <div className={`drow${tall ? ' drow-tall' : ''}`}>
      <span className="drow-label">{label}</span>
      <span className="drow-value">{value || '—'}</span>
    </div>
  )
}

/* ── Lista de evidencias ── */
function EvidenciaList({ evidencias }) {
  if (!evidencias?.length) return (
    <div className="drow">
      <span className="drow-label">Evidencia</span>
      <span className="drow-value">—</span>
    </div>
  )

  return (
    <div className="ev-lista">
      {evidencias.map(ev => <EvidenciaItem key={ev.id} evidencia={ev} />)}
    </div>
  )
}

/* ── Prioridad — pills de solo lectura ── */
/* ── Chip "Prioridad" — el chip visible es un .filtro-chip normal; el
   catálogo Alta/Media/Baja lo abre un <select> nativo superpuesto e
   invisible, así en móvil se ve el picker propio del dispositivo (100%
   responsivo, no hay nada que mantener). Reusa PRIORIDAD_NIVELES. ── */
function PrioridadFiltroChip({ valor, onChange }) {
  return (
    <div className="prioridad-filtro-wrap">
      <button type="button" className={`filtro-chip filtro-chip-alta${valor ? ' filtro-chip-active' : ''}`} tabIndex={-1}>
        {valor ? `Prioridad: ${valor}` : 'Prioridad'}
      </button>
      <select
        className="prioridad-filtro-select"
        value={valor}
        onChange={e => onChange(e.target.value)}
        aria-label="Filtrar por prioridad"
      >
        <option value="">Prioridad</option>
        {PRIORIDAD_NIVELES.map(p => (
          <option key={p.valor} value={p.valor}>{p.valor}</option>
        ))}
      </select>
    </div>
  )
}

/* ── Detalle del turnado (ROL2) ── */
function DetalleTurnado({ turnado: turnadoInicial, onBack }) {
  const { user } = useAuth()
  const [fusData,        setFusData]       = useState(turnadoInicial.idFus || {})
  const [turnadoData,    setTurnadoData]    = useState(turnadoInicial)
  const [modalComisionar, setModalComisionar] = useState(false)
  const [mostrarModalPdf, setMostrarModalPdf] = useState(false)
  const [marcandoAtendido, setMarcandoAtendido] = useState(false)
  const toast = useToast()
  const fus = fusData
  const turnado = turnadoData

  // puedeComisionar ya resuelve internamente, según el rol, tanto el
  // estatus del FUS (Registrado/Turnado) como — para ROL2 — que ESTE
  // turnado (destinatario específico) siga "Recibido".
  const puedesComisionar = puedeComisionar(user, fus, turnado)

  const tieneExterno = fus.nombreExterno || fus.telefonoExterno || fus.correoExterno
  const nombreSolicitante = fus.idSolicitanteInterno?.nombre

  const descargarPdf = (conImagenes) => {
    const folioUrl = fus.folio.split('/').map(encodeURIComponent).join('/')
    const query = conImagenes ? '?imagenes=1' : ''
    return descargar(`/fus/${folioUrl}/pdf/${query}`, `FUS_${fus.folio.replace(/\//g, '_')}.pdf`)
      .finally(() => setMostrarModalPdf(false))
  }

  return (
    <div className="dt-panel" style={{ position: 'relative' }}>

      <button className="btn-volver-mobile" onClick={onBack} aria-label="Volver a la lista">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Volver a la lista
      </button>

      {/* ── Tarjeta unificada de datos ── */}
      <div className="seccion">
        <div className="sec-header sec-datos">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span className="dt-header-folio">{fus.folio || 'Datos del FUS'}</span>
          <span className="dt-header-acciones">
            {fus.folio && (
              <button
                type="button"
                className="btn-descargar-fus"
                onClick={() => setMostrarModalPdf(true)}
                title="Descargar PDF"
                aria-label="Descargar PDF"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
            )}
            {puedesComisionar && (
              <button type="button" className="btn-comisionar" onClick={() => setModalComisionar(true)}>
                Comisionar
              </button>
            )}
          </span>
        </div>

        {/* Datos generales */}
        <div className="sec-subseccion">
          <span className="sec-sublabel">Datos generales</span>
          <div className="sec-grid-2">
            <DRow label="Fecha y hora"        value={formatearFechaHora(fus.fechaHora)} />
            <DRow label="Medio de recepción"  value={fus.idMedioRecepcion?.nombreMedio} />
            <DRow label="Solicitante interno" value={nombreSolicitante} />
          </div>
          {fus.idComisionado && (
            <div className="dt-comisionado-chip">
              <span className="dt-comisionado-avatar">{obtenerIniciales(fus.idComisionado.nombre, fus.idComisionado.email)}</span>
              <div className="dt-comisionado-info">
                <span className="dt-comisionado-nombre">{fus.idComisionado.nombre || fus.idComisionado.email}</span>
                <span className="dt-comisionado-direccion">{fus.direccionComisionado || 'Sin dirección asignada'}</span>
              </div>
            </div>
          )}
        </div>

        {fus.fechaLimite && (
          <div className="sec-subseccion sec-subseccion-externo">
            <span className="sec-sublabel sec-sublabel-externo">Límite de respuesta</span>
            <div className="sec-grid-2">
              <DRow label="Fecha y hora" value={formatearFechaHora(fus.fechaLimite)} />
            </div>
          </div>
        )}

        {/* Mensaje que ROL1 escribió al momento de turnar la solicitud. */}
        {turnado.solicitudTexto && (
          <div className="sec-subseccion">
            <span className="sec-sublabel">Instrucciones del turnado</span>
            <div className="sec-grid-2">
              <DRow
                label="Mensaje del Particular"
                value={turnado.solicitudTexto}
                tall
              />
              {turnado.idMedio?.nombreMedio && (
                <DRow
                  label="Medio de envío"
                  value={turnado.idMedio.nombreMedio}
                />
              )}
            </div>
          </div>
        )}

        {/* Descripción */}
        <div className="sec-subseccion">
          <span className="sec-sublabel">Descripción de la solicitud</span>
          <DRow label="Descripción" value={fus.descripcion} tall />
          {fus.contexto && <DRow label="Datos o antecedentes de contexto de la solicitud" value={fus.contexto} tall />}
        </div>

        {/* Solicitante externo */}
        {tieneExterno && (
          <div className="sec-subseccion">
            <span className="sec-sublabel">Datos de contacto de solicitante externo</span>
            <div className="sec-grid-3">
              {fus.nombreExterno   && <DRow label="Nombre"           value={fus.nombreExterno} />}
              {fus.telefonoExterno && <DRow label="Teléfono/Celular" value={fus.telefonoExterno} />}
              {fus.correoExterno   && <DRow label="Correo"           value={fus.correoExterno} />}
            </div>
          </div>
        )}

        {/* Evidencia */}
        <div className="sec-subseccion">
          <span className="sec-sublabel">Evidencia</span>
          <EvidenciaList evidencias={fus.evidencias} />
        </div>

        {/* Prioridad */}
        <div className="sec-subseccion">
          <span className="sec-sublabel">Prioridad</span>
          <PrioridadPills valor={fus.prioridad} criterios={fus.criterios} />
        </div>
      </div>

      {/* ── Seguimientos: una vez comisionado, este feed reemplaza al del
           Turnado — las respuestas ahora las da el comisionado, no el
           Titular directamente. ── */}
      {fus.idComisionado
        ? <SeguimientoComisionadoFeed fusId={fus.id} folio={fus.folio} />
        : <Seguimientos
            turnadoId={turnado.id}
            folio={fus.folio}
            estatusFus={fus.estatusParticular}
            onRegistrado={(estatusParticular, estatusTitular) => {
              if (estatusParticular) setFusData(f => ({ ...f, estatusParticular }))
              if (estatusTitular) setTurnadoData(t => ({ ...t, estatusTitular }))
            }}
          />
      }

      {/* Confirma que ya se respondió lo suficiente — habilita a Rol 1 para
          rechazar/concluir la parte de este Titular específico desde su
          modal de respuestas en Consultar FUS (no afecta a otras personas
          turnadas del mismo FUS). Solo aplica al flujo directo (sin
          comisionado); ese caso lo sigue cubriendo AccionesValidacion. */}
      {!fus.idComisionado && turnado.estatusTitular === 'En_seguimiento' && (
        <div className="dt-actions">
          <button
            type="button"
            className="com-btn-verde"
            disabled={marcandoAtendido}
            onClick={async () => {
              setMarcandoAtendido(true)
              try {
                const { data } = await api.post(`/turnados/${turnado.id}/atendido/`)
                setTurnadoData(t => ({ ...t, estatusTitular: data.estatusTitular }))
                if (data.estatusParticular) setFusData(f => ({ ...f, estatusParticular: data.estatusParticular }))
                toast.success('Tu parte se marcó como atendida.')
              } catch (err) {
                toast.error(err.response?.data?.detail || 'No se pudo marcar como atendida.')
              } finally {
                setMarcandoAtendido(false)
              }
            }}
          >
            {marcandoAtendido && <span className="btn-spinner" />}
            {marcandoAtendido ? 'Guardando…' : 'Atendido'}
          </button>
        </div>
      )}

      <AccionesValidacion
        user={user}
        fus={fus}
        setFusData={setFusData}
        tieneFacultad={puedeGestionarComisionados(user)}
      />

      {modalComisionar && (
        <ComisionarModal
          fusId={fus.id}
          onClose={() => setModalComisionar(false)}
          onConfirmado={(data) => {
            setFusData(data)
            setModalComisionar(false)
            toast.success('Comisionado asignado correctamente.')
          }}
        />
      )}

      {mostrarModalPdf && (
        <ModalDescargarPDF
          onCancelar={() => setMostrarModalPdf(false)}
          onConfirmar={descargarPdf}
        />
      )}
    </div>
  )
}

/* ── Tarjeta de la lista ── */
function TurnadoCard({ t, activo, onClick, highlight, onVerHistorial }) {
  const fus = t.idFus || {}
  return (
    <div className={`fus-card${activo ? ' fus-card-activo' : ''}${highlight ? ' fus-card-highlight' : ''}${fus.slaVencido ? ' fus-card-vencido' : ''}${!fus.slaVencido && fus.slaPorVencer ? ' fus-card-por-vencer' : ''}`} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="fus-card-top">
        <strong className="fus-folio">{fus.folio || `Turnado #${t.id}`}</strong>
        <span className="fus-card-badges">
          <Badge estatus={t.estatusTitular} />
          {fus.estadoTemporalidad && <Badge estatus={fus.estadoTemporalidad} />}
        </span>
      </div>
      <p className="fus-meta">
        <span className="fus-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          {formatearFechaHora(fus.fechaHora)}
        </span>
        <span className="fus-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="m22 7-10 6L2 7"/>
          </svg>
          {fus.idMedioRecepcion?.nombreMedio || '—'}
        </span>
      </p>
      {fus.descripcion && <p className="fus-desc">{fus.descripcion}</p>}
      {fus.folio && (
        <button
          className="fus-card-historial-btn"
          title="Ver historial"
          onClick={e => { e.stopPropagation(); onVerHistorial(fus.folio) }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7"/>
            <path d="M3 5v4h4"/>
            <polyline points="12 7 12 12 15.5 14"/>
          </svg>
        </button>
      )}
    </div>
  )
}

/* ── Página principal ── */
export default function SolicitudesTurnadas() {
  const [searchParams, setSearchParams] = useSearchParams()
  const folioParam = searchParams.get('folio')

  const { estatus: estatusROL2 } = useEstatus('TITULAR')
  const notifCtx = useNotificaciones()

  const [busqueda,     setBusqueda]     = useState('')
  // Varios chips de estatus a la vez (mismo criterio que ConsultarFUS): lista
  // combinada con OR en el backend, viaja en la URL como un string con comas.
  const [filtro,       setFiltro]       = useState(() => (searchParams.get('filtro') || '').split(',').filter(Boolean))
  const [prioridadFiltro, setPrioridadFiltro] = useState(() => searchParams.get('prioridad') || '')
  const [seleccionado, setSeleccionado] = useState(null)
  const [modalTimelineFolio, setModalTimelineFolio] = useState(null)
  const [highlightId,  setHighlightId]  = useState(null)
  const reordenadoRef = useRef(false)
  const [solicitud, setSolicitud] = useState({ page: 1, append: false, version: 0 })

  const cargarPagina = useCallback(async ({ signal }) => {
    const params = { page: solicitud.page, page_size: PAGE_SIZE }
    if (folioParam)                           params.folio = folioParam
    if (!folioParam && filtro.length)    params.estatusTitular = filtro.join(',')
    if (!folioParam && prioridadFiltro) params.prioridad = prioridadFiltro
    if (!folioParam && busqueda)        params.search = busqueda
    const respuesta = await api.get('/turnados/mis-turnados/', { params, signal })
    const items = respuesta.data.results || []
    const match = folioParam
      ? items.find(turnado => turnado.idFus?.folio === folioParam)
      : null
    return {
      items: match ? [match, ...items.filter(turnado => turnado.id !== match.id)] : items,
      total: respuesta.data.total || 0,
      page: solicitud.page,
      append: solicitud.append,
      match,
    }
  }, [busqueda, filtro, folioParam, prioridadFiltro, solicitud])

  const procesarCargaExitosa = useCallback(resultado => {
    if (resultado.match) {
      setFiltro([])
      setPrioridadFiltro('')
      setBusqueda('')
      setSeleccionado(resultado.match)
      setHighlightId(resultado.match.id)
      reordenadoRef.current = true
      setSearchParams({}, { replace: true })
      return
    }
    setSeleccionado(anterior => {
      if (!anterior) return anterior
      return resultado.items.find(turnado => turnado.id === anterior.id) || anterior
    })
  }, [setSearchParams])

  const {
    data: resultado,
    error: errorCarga,
    loading: cargando,
    setData: setResultado,
  } = useAsyncResource(cargarPagina, {
    initialData: { items: [], total: 0, page: 1, append: false, match: null },
    mergeData: combinarPaginasTurnadas,
    onSuccess: procesarCargaExitosa,
  })

  const lista = resultado.items
  const pagina = resultado.page
  const totalItems = resultado.total
  const recargar = () => setSolicitud(actual => ({ page: 1, append: false, version: actual.version + 1 }))
  const cargarMas = () => setSolicitud(actual => ({ page: pagina + 1, append: true, version: actual.version + 1 }))

  useEffect(() => {
     
    if (reordenadoRef.current) {
      reordenadoRef.current = false
      return
    }
     
    recargar()
     
  }, [filtro, prioridadFiltro, busqueda, folioParam])

  /* Refrescar automáticamente cuando llega un nuevo turnado por WebSocket */
  useEffect(() => {
    if (!notifCtx?.turnadoKey) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza la bandeja con un evento WebSocket externo
    recargar()
     
  }, [notifCtx?.turnadoKey])

  /* En vivo: si llega por WebSocket un aviso de SLA por vencer, el turnado
     correspondiente (si ya está cargado en la lista) se sube al inicio y
     queda marcado como "por vencer" — sin esperar a un refresh manual. */
  const ultimaNotifId = notifCtx?.notifs?.[0]?.id
  useEffect(() => {
    const notif = notifCtx?.notifs?.[0]
    if (!notif || notif.tipo !== 'SLA_POR_VENCER') return
     
    setResultado(prev => {
      const idx = prev.items.findIndex(t => t.idFus?.folio === notif.fusFolio)
      if (idx === -1) return prev
      const item = { ...prev.items[idx], idFus: { ...prev.items[idx].idFus, slaPorVencer: true } }
      return {
        ...prev,
        items: [item, ...prev.items.slice(0, idx), ...prev.items.slice(idx + 1)],
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ultimaNotifId` ya es el proxy primitivo estable de `notifCtx?.notifs` usado en todo el proyecto
  }, [ultimaNotifId])

  /* En vivo: cualquier notificación ligada a un FUS (comisionar, atendido,
     concluir, rechazar, etc.) dispara un refresh silencioso — cubre tanto
     un cambio de estatus en algo que ya se ve en la lista/detalle como una
     asignación nueva que todavía no aparecía. SLA_POR_VENCER queda fuera:
     ya tiene su propio parche puntual arriba. TURNADO también queda fuera:
     ya lo maneja turnadoKey justo arriba, sin duplicar la recarga. */
  useEffect(() => {
    const notif = notifCtx?.notifs?.[0]
    if (!notif?.fusFolio || notif.tipo === 'SLA_POR_VENCER' || notif.tipo === 'TURNADO') return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza la bandeja con un evento WebSocket externo
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `cargar` se recrea cada render; `ultimaNotifId` ya es el proxy primitivo estable de `notifCtx?.notifs`
  }, [ultimaNotifId])

  const toggleFiltro = f => setFiltro(prev => (
    prev.includes(f) ? prev.filter(v => v !== f) : [...prev, f]
  ))

  const LABEL_ESTATUS_EXTRA = {
    Pendiente_validacion: 'Pendiente de validación',
    Rechazado: 'Rechazados',
    Vencido: 'Vencido',
    PorVencer: 'Por vencer',
  }
  const labelEstatusFiltro = clave => (
    LABEL_ESTATUS_EXTRA[clave] || estatusROL2.find(e => e.clave === clave)?.nombre || clave
  )

  /* Resumen de "filtros activos" + Limpiar todo (búsqueda + estatus +
     prioridad) — mismo diseño que ya usa Bitácora. */
  const chipsActivos = [
    ...(busqueda ? [{ key: 'busqueda', label: `Búsqueda: "${busqueda}"`, onQuitar: () => setBusqueda('') }] : []),
    ...filtro.map(f => ({ key: `estatus-${f}`, label: labelEstatusFiltro(f), onQuitar: () => toggleFiltro(f) })),
    ...(prioridadFiltro ? [{ key: 'prioridad', label: `Prioridad: ${prioridadFiltro}`, onQuitar: () => setPrioridadFiltro('') }] : []),
  ]
  const limpiarTodosFiltros = () => {
    setBusqueda('')
    setFiltro([])
    setPrioridadFiltro('')
  }

  /* ── Resize panel izquierdo ── */
  const [panelAbierto, setPanelAbierto] = useState(() => searchParams.get('modo') === 'lista' || Boolean(searchParams.get('filtro')) || Boolean(searchParams.get('prioridad')))

  useEffect(() => {
    if (searchParams.get('filtro') || searchParams.get('prioridad')) {
      const next = new URLSearchParams(searchParams)
      next.delete('filtro')
      next.delete('prioridad')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe ejecutarse una vez al montar, para limpiar los params iniciales de la URL
  }, [])

  useEffect(() => {
    const handleConsultar = () => { setPanelAbierto(true); setSeleccionado(null) }
    window.addEventListener('scs:consultar', handleConsultar)
    return () => window.removeEventListener('scs:consultar', handleConsultar)
  }, [])
  return (
    <AppLayout>
      <div className={`st-inner${seleccionado ? ' has-detail' : ''}${panelAbierto && !seleccionado ? ' lista-mode' : ''}`}>

        {/* ── Panel izquierdo ── */}
        <div className={`st-left${!panelAbierto ? ' panel-cerrado' : ''}`}>
          <div className="panel-header">
            {panelAbierto && <h3 className="panel-title">Solicitudes turnadas</h3>}
            <button className="panel-toggle" onClick={() => setPanelAbierto(p => !p)} title={panelAbierto ? 'Cerrar panel' : 'Abrir panel'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {panelAbierto
                  ? <polyline points="15 18 9 12 15 6" />
                  : <polyline points="9 18 15 12 9 6" />}
              </svg>
            </button>
          </div>

          <div className={`panel-content${!panelAbierto ? ' panel-content-oculto' : ''}`}>
            <div className="left-search">
              <svg className="search-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                placeholder="Buscar por folio, descripción, contacto, medio…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>

            <div className="left-filtros">
              <button
                className={`filtro-chip${filtro.length === 0 ? ' filtro-chip-active' : ''}`}
                onClick={() => setFiltro([])}
              >
                Todos
              </button>
              {estatusROL2.map(e => (
                <button
                  key={e.clave}
                  className={`filtro-chip filtro-chip-${e.clave.toLowerCase().replace('_', '-')}${filtro.includes(e.clave) ? ' filtro-chip-active' : ''}`}
                  onClick={() => toggleFiltro(e.clave)}
                >
                  {e.nombre}
                </button>
              ))}
              {/* Rechazado/Pendiente_validacion viven en FUS.estatusParticular, no en
                  Turnado.estatusTitular (por eso no vienen en estatusROL2 = TITULAR) —
                  MisTurnadosView los reconoce igual vía el mismo parámetro `estatusTitular`. */}
              <button
                className={`filtro-chip filtro-chip-pendiente-validacion${filtro.includes('Pendiente_validacion') ? ' filtro-chip-active' : ''}`}
                onClick={() => toggleFiltro('Pendiente_validacion')}
              >
                Pendiente de validación
              </button>
              <button
                className={`filtro-chip filtro-chip-rechazado${filtro.includes('Rechazado') ? ' filtro-chip-active' : ''}`}
                onClick={() => toggleFiltro('Rechazado')}
              >
                Rechazados
              </button>
              <button
                className={`filtro-chip filtro-chip-vencido${filtro.includes('Vencido') ? ' filtro-chip-active' : ''}`}
                onClick={() => toggleFiltro('Vencido')}
              >
                Vencido
              </button>
              <button
                className={`filtro-chip filtro-chip-porvencer${filtro.includes('PorVencer') ? ' filtro-chip-active' : ''}`}
                onClick={() => toggleFiltro('PorVencer')}
              >
                Por vencer
              </button>
              <PrioridadFiltroChip valor={prioridadFiltro} onChange={setPrioridadFiltro} />
            </div>

            <FiltrosActivosChips chips={chipsActivos} onLimpiarTodo={limpiarTodosFiltros} />

            {errorCarga && lista.length > 0 && (
              <div className="banner-error-carga">
                <span>No se pudo actualizar — mostrando la última información disponible.</span>
                <button type="button" onClick={recargar}>Reintentar</button>
              </div>
            )}

            <div className="left-lista">
              {cargando && lista.length === 0 && <Spinner overlay={false} fill label="Cargando solicitudes…" />}
              {!cargando && errorCarga && lista.length === 0 && (
                <div className="empty-state empty-state-error">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="empty-state-title">No se pudo cargar</p>
                  <p className="empty-state-sub">Ocurrió un error al obtener tus solicitudes turnadas.</p>
                  <button type="button" className="btn-reintentar" onClick={recargar}>Reintentar</button>
                </div>
              )}
              {!cargando && !errorCarga && lista.length === 0 && (
                <div className="empty-state">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                  <p className="empty-state-title">Sin asignaciones</p>
                  <p className="empty-state-sub">{busqueda || filtro.length > 0 ? 'Ningún FUS coincide con tu búsqueda.' : 'No tienes solicitudes turnadas por atender.'}</p>
                </div>
              )}
              {lista.map(t => (
                <TurnadoCard
                  key={t.id}
                  t={t}
                  activo={seleccionado?.id === t.id}
                  highlight={highlightId === t.id}
                  onClick={() => { setSeleccionado(t); setHighlightId(null); if (window.innerWidth <= 768) setPanelAbierto(false) }}
                  onVerHistorial={setModalTimelineFolio}
                />
              ))}
              {lista.length < totalItems && (
                <button className="btn-cargar-mas" onClick={cargarMas} disabled={cargando}>
                  {cargando && <span className="btn-spinner" />}
                  {cargando ? 'Cargando…' : `Cargar más (${lista.length} de ${totalItems})`}
                </button>
              )}
            </div>
          </div>
        </div>


        {/* ── Panel derecho ── */}
        <div className="st-right">
          {seleccionado
            ? <DetalleTurnado
                key={`${seleccionado.id}_${seleccionado.estatusTitular}_${seleccionado.idFus?.estatusParticular}`}
                turnado={seleccionado}
                onBack={() => { setSeleccionado(null); setPanelAbierto(true) }}
              />
            : (
              <div className="st-hint-select">
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <p>Selecciona una solicitud del panel izquierdo para ver el detalle completo</p>
              </div>
            )
          }
        </div>
      </div>

      {modalTimelineFolio && (
        <ModalTimeline folio={modalTimelineFolio} onClose={() => setModalTimelineFolio(null)} />
      )}
    </AppLayout>
  )
}
