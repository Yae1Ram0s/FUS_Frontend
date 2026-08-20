import { useState } from 'react'
import DocumentoRespuestasModal from './DocumentoRespuestasModal'
import { obtenerIniciales } from '../../utils/personas'
import { esParticular } from '../../utils/permisos'
import { formatMedioRecepcion } from '../../utils/medio'
import Badge from '../Badge'

// Misma composición avatar + dos líneas que PersonaFila de abajo (solo que
// con placeholders en vez de datos reales) — así el loading no "salta" de
// forma distinta a como se ve el contenido ya cargado.
function PersonaFilaSkeleton() {
  return (
    <div className="pyr-fila-cabecera pyr-skeleton-fila">
      <span className="pyr-skeleton pyr-skeleton-avatar" />
      <div className="dt-turnado-info">
        <span className="pyr-skeleton pyr-skeleton-linea pyr-skeleton-linea-nombre" />
        <span className="pyr-skeleton pyr-skeleton-linea pyr-skeleton-linea-direccion" />
      </div>
    </div>
  )
}

export default function PersonasYRespuestasCard({ turnados, cargando, user, onCambio }) {
  // Cargando la primera vez (sin datos previos aún): el título y la
  // descripción se quedan fijos — solo la fila de cada persona (avatar,
  // estatus, "Ver respuestas") se reemplaza por su skeleton.
  const cargandoInicial = cargando && !turnados.length
  if (!cargandoInicial && !turnados.length) return null

  return (
    <div className="det-section">
      <div className="pyr-legend-row">
        <span className="det-section-legend">Personas y respuestas</span>
        {!cargandoInicial && (
          <span className="pyr-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            {turnados.length} {turnados.length === 1 ? 'persona' : 'personas'}
          </span>
        )}
      </div>

      <p className="pyr-intro">
        Este FUS contiene las respuestas de las personas involucradas en la atención de la solicitud.
      </p>

      <div className="pyr-lista">
        {cargandoInicial
          ? [0, 1].map(i => <PersonaFilaSkeleton key={i} />)
          : turnados.map(turnado => (
              <PersonaFila key={turnado.id} turnado={turnado} user={user} onCambio={onCambio} />
            ))}
      </div>
    </div>
  )
}

function PersonaFila({ turnado, user, onCambio }) {
  const [expandido, setExpandido] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const destinatario = turnado.idDestinatario || {}
  const nombre = destinatario.nombre || destinatario.email || 'Sin nombre'
  const fecha = turnado.fechaHoraTurnado
    ? new Date(turnado.fechaHoraTurnado).toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '—'

  // Badge de la fila: "Recibido" (sin responder aún) no se muestra — no hay
  // nada que comunicar todavía. El resto se muestra tal cual
  // (turnado.estatusTitular), sin relabelear "En_seguimiento" como
  // "Atendido" — antes esta vista era la única que decía "Atendido" en ese
  // punto del flujo, mientras el propio Titular (Solicitudes Turnadas) y el
  // comisionado ven "En seguimiento"/su estatus real para ese mismo momento;
  // mostrar el estatus real aquí lo deja consistente en todos lados.
  const estatusVisible = turnado.estatusTitular === 'Recibido'
    ? null
    : turnado.estatusTitular

  // Solo las respuestas de ESTE turnado — a diferencia del resumen de la
  // tarjeta (que combina todos), el modal por persona muestra nada más lo
  // que esa persona registró.
  const respuestas = (turnado.seguimientos || [])
    .map(seguimiento => ({
      ...seguimiento,
      autorNombre: 'autorNombre' in seguimiento ? seguimiento.autorNombre : (destinatario.nombre ?? null),
    }))
    .sort((a, b) => new Date(a.fechaRegistro) - new Date(b.fechaRegistro))

  return (
    <div className="pyr-fila">
      <div className={`pyr-fila-cabecera${estatusVisible === 'Pendiente_validacion' ? ' pyr-fila-cabecera-pendiente' : ''}`}>
        <button
          type="button"
          className="pyr-fila-toggle"
          onClick={() => setExpandido(actual => !actual)}
          aria-expanded={expandido}
        >
          <span className="dt-turnado-avatar">{obtenerIniciales(destinatario.nombre, destinatario.email)}</span>
          <div className="dt-turnado-info">
            <span className="dt-turnado-nombre">{nombre}</span>
            <span className="dt-turnado-direccion">{destinatario.area || 'Sin área asignada'}</span>
          </div>
        </button>

        {estatusVisible && (
          <Badge
            estatus={estatusVisible}
            theme="light"
            className={estatusVisible === 'Pendiente_validacion' ? 'pyr-estatus-pendiente' : ''}
          />
        )}

        <button type="button" className="pyr-btn-respuestas" onClick={() => setModalAbierto(true)} data-analytics-event="INTERACTION" data-analytics-component="PYR_VER_RESPUESTAS" data-analytics-action="OPEN">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          Ver respuestas
        </button>

        <button
          type="button"
          className="pyr-chevron-btn"
          onClick={() => setExpandido(actual => !actual)}
          aria-expanded={expandido}
          aria-label={expandido ? 'Ocultar detalle' : 'Ver detalle'}
        >
          <svg className={`pyr-chevron${expandido ? ' pyr-chevron-abierto' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      {expandido && (
        <div className="pyr-expand">
          <div className="dt-turnado-pop-grid pyr-detalles-grid">
            <DatoPersona className="pyr-detalle-fecha" label="Fecha de asignación" value={fecha} />
            {turnado.idMedio?.nombreMedio && (
              <DatoPersona
                className="pyr-detalle-medio"
                label="Medio de envío"
                value={formatMedioRecepcion(turnado.idMedio, turnado.medioEspecificacion)}
              />
            )}
            {destinatario.email && <DatoPersona className="pyr-detalle-correo" label="Correo institucional" value={destinatario.email} />}
          </div>
          {turnado.solicitudTexto && (
            <div className="dt-turnado-pop-row pyr-detalle-solicitud">
              <span className="dt-turnado-pop-label">Texto de la solicitud</span>
              <p className="dt-turnado-pop-texto">{turnado.solicitudTexto}</p>
            </div>
          )}
        </div>
      )}

      {modalAbierto && (
        <DocumentoRespuestasModal
          titulo={`Respuestas de ${nombre}`}
          mensajeVacio={`${nombre} aún no tiene respuestas registradas.`}
          respuestas={respuestas}
          onClose={() => setModalAbierto(false)}
          turnado={esParticular(user) ? turnado : null}
          onValidado={(resultado) => {
            onCambio?.(resultado)
            setModalAbierto(false)
          }}
        />
      )}
    </div>
  )
}

function DatoPersona({ label, value, muted = false, className = '' }) {
  return (
    <div className={`dt-turnado-pop-row${className ? ` ${className}` : ''}`}>
      <span className="dt-turnado-pop-label">{label}</span>
      <span className={`dt-turnado-pop-value${muted ? ' dt-turnado-pop-value-muted' : ''}`}>{value}</span>
    </div>
  )
}
