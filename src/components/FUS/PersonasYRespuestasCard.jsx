import { useState } from 'react'
import Spinner from '../Spinner'
import DocumentoRespuestasModal from './DocumentoRespuestasModal'
import { obtenerIniciales } from '../../utils/personas'

export default function PersonasYRespuestasCard({ turnados, cargando }) {
  if (cargando) {
    return (
      <div className="det-section">
        <Spinner overlay={false} fill />
      </div>
    )
  }
  if (!turnados.length) return null

  return (
    <div className="det-section">
      <div className="pyr-legend-row">
        <span className="det-section-legend">Personas y respuestas</span>
        <span className="pyr-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          {turnados.length} {turnados.length === 1 ? 'persona' : 'personas'}
        </span>
      </div>

      <p className="pyr-intro">
        Este FUS contiene las respuestas de las personas involucradas en la atención de la solicitud.
      </p>

      <div className="pyr-lista">
        {turnados.map(turnado => <PersonaFila key={turnado.id} turnado={turnado} />)}
      </div>
    </div>
  )
}

function PersonaFila({ turnado }) {
  const [expandido, setExpandido] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const destinatario = turnado.idDestinatario || {}
  const nombre = destinatario.nombre || destinatario.email || 'Sin nombre'
  const fecha = turnado.fechaHoraTurnado
    ? new Date(turnado.fechaHoraTurnado).toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '—'

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
      <div className="pyr-fila-cabecera">
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

        <button type="button" className="pyr-btn-respuestas" onClick={() => setModalAbierto(true)}>
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
          <div className="dt-turnado-pop-grid">
            <DatoPersona label="Cargo / área" value={destinatario.area || 'Sin asignar'} muted={!destinatario.area} />
            <DatoPersona label="Fecha de asignación" value={fecha} />
          </div>
          {destinatario.email && <DatoPersona label="Correo institucional" value={destinatario.email} />}
          {(turnado.idMedio?.nombreMedio || turnado.solicitudTexto) && (
            <>
              <div className="dt-turnado-pop-divider" />
              {turnado.idMedio?.nombreMedio && <DatoPersona label="Medio de envío" value={turnado.idMedio.nombreMedio} />}
              {turnado.solicitudTexto && (
                <div className="dt-turnado-pop-row">
                  <span className="dt-turnado-pop-label">Texto de la solicitud</span>
                  <p className="dt-turnado-pop-texto">{turnado.solicitudTexto}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {modalAbierto && (
        <DocumentoRespuestasModal
          titulo={`Respuestas de ${nombre}`}
          mensajeVacio={`${nombre} aún no tiene respuestas registradas.`}
          respuestas={respuestas}
          onClose={() => setModalAbierto(false)}
        />
      )}
    </div>
  )
}

function DatoPersona({ label, value, muted = false }) {
  return (
    <div className="dt-turnado-pop-row">
      <span className="dt-turnado-pop-label">{label}</span>
      <span className={`dt-turnado-pop-value${muted ? ' dt-turnado-pop-value-muted' : ''}`}>{value}</span>
    </div>
  )
}
