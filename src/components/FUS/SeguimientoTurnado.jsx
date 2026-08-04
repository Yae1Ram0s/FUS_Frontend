import { useEffect, useRef, useState } from 'react'
import Spinner from '../Spinner'
import { obtenerIniciales } from '../../utils/personas'

const ESTATUS_TURNADO = {
  Recibido: { label: 'Recibido', color: '#b45309' },
  En_seguimiento: { label: 'En seguimiento', color: '#9F2241' },
  Concluido: { label: 'Concluido', color: '#15803d' },
}

const TIPO_SEGUIMIENTO = {
  accion_por_emprender: { label: 'Acción', clase: 'fc-tag-azul' },
  avance: { label: 'Respuesta', clase: 'fc-tag-verde' },
  finalizacion: { label: 'Respuesta', clase: 'fc-tag-verde' },
  rechazo: { label: 'Rechazo', clase: 'fc-tag-rojo' },
}
const TIPO_POR_DEFECTO = { label: 'Respuesta', clase: 'fc-tag-verde' }

export function TurnadoChip({ turnado }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const cerrarFuera = event => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', cerrarFuera)
    return () => document.removeEventListener('mousedown', cerrarFuera)
  }, [open])

  const destinatario = turnado.idDestinatario || {}
  const nombre = destinatario.nombre || destinatario.email || 'Sin nombre'
  const estatus = ESTATUS_TURNADO[turnado.estatusTitular] || {
    label: turnado.estatusTitular,
    color: '#6b7280',
  }
  const fecha = turnado.fechaHoraTurnado
    ? new Date(turnado.fechaHoraTurnado).toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '—'

  return (
    <div className="dt-turnado-chip-wrap" ref={ref}>
      <button
        type="button"
        className="dt-turnado-chip"
        onClick={() => setOpen(actual => !actual)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="dt-turnado-avatar">{obtenerIniciales(destinatario.nombre, destinatario.email)}</span>
        <div className="dt-turnado-info">
          <span className="dt-turnado-nombre">{nombre}</span>
          <span className="dt-turnado-direccion">{destinatario.area || 'Sin área asignada'}</span>
        </div>
        <svg className="dt-turnado-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="dt-turnado-popover" role="dialog" aria-label="Datos del destinatario del turnado">
          <span className="act-estatus-pill dt-turnado-pop-estatus" style={{ '--c': estatus.color }}>{estatus.label}</span>
          <div className="dt-turnado-pop-grid">
            <DatoTurnado label="Nombre" value={nombre} />
            <DatoTurnado label="Área" value={destinatario.area || 'Sin asignar'} muted={!destinatario.area} />
          </div>
          {destinatario.email && <DatoTurnado label="Correo" value={destinatario.email} />}
          <div className="dt-turnado-pop-divider" />
          <div className="dt-turnado-pop-grid">
            <DatoTurnado label="Medio de envío" value={turnado.idMedio?.nombreMedio || '—'} />
            <DatoTurnado label="Fecha y hora" value={fecha} />
          </div>
          {turnado.solicitudTexto && (
            <>
              <div className="dt-turnado-pop-divider" />
              <div className="dt-turnado-pop-row">
                <span className="dt-turnado-pop-label">Texto de la solicitud</span>
                <p className="dt-turnado-pop-texto">{turnado.solicitudTexto}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function DatoTurnado({ label, value, muted = false }) {
  return (
    <div className="dt-turnado-pop-row">
      <span className="dt-turnado-pop-label">{label}</span>
      <span className={`dt-turnado-pop-value${muted ? ' dt-turnado-pop-value-muted' : ''}`}>{value}</span>
    </div>
  )
}

export function RespuestasSeguimientoSection({ turnados, cargando }) {
  // Con más de un destinatario, cada `turnado.seguimientos` ya viene ordenado
  // por su cuenta, pero flatMap solo los concatena por turnado — sin este
  // sort, las respuestas de un destinatario más reciente se ven todas antes
  // que las de uno turnado antes pero que respondió después. Se reordena por
  // fecha real para que la línea de tiempo combinada sea cronológica de verdad.
  const respuestas = turnados.flatMap(turnado =>
    (turnado.seguimientos || []).map(seguimiento => ({
      ...seguimiento,
      autorNombre: 'autorNombre' in seguimiento
        ? seguimiento.autorNombre
        : (turnado.idDestinatario?.nombre ?? null),
    }))
  ).sort((a, b) => new Date(a.fechaRegistro) - new Date(b.fechaRegistro))

  if (cargando) return <ContenedorRespuestas><Spinner overlay={false} /></ContenedorRespuestas>
  if (!turnados.length) return null

  return (
    <ContenedorRespuestas>
      {respuestas.length ? (
        <div className="act-tl">
          {respuestas.map((respuesta, index) => {
            const tipo = TIPO_SEGUIMIENTO[respuesta.tipo] || TIPO_POR_DEFECTO
            const fecha = respuesta.fechaActividad
              ? new Date(`${respuesta.fechaActividad}T00:00:00`).toLocaleDateString('es-MX', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                })
              : '—'
            const hora = respuesta.fechaRegistro
              ? new Date(respuesta.fechaRegistro).toLocaleTimeString('es-MX', {
                  hour: '2-digit', minute: '2-digit',
                })
              : ''
            return (
              <div key={respuesta.id} className="act-tl-item">
                <div className="act-tl-track">
                  <div className="act-tl-dot" />
                  {index < respuestas.length - 1 && <div className="act-tl-connector" />}
                </div>
                <div className="act-tl-content">
                  <div className="act-tl-meta">
                    <span className={`fc-tag ${tipo.clase}`}>{tipo.label}</span>
                    <span className="act-tl-fecha">
                      {respuesta.autorNombre ? `${respuesta.autorNombre} · ` : ''}
                      {fecha}
                      {hora && <span className="act-tl-hora"> · {hora}</span>}
                    </span>
                  </div>
                  {respuesta.descripcionActividad && <p className="act-tl-desc">{respuesta.descripcionActividad}</p>}
                  {respuesta.accionTexto && <p className="act-tl-accion">→ {respuesta.accionTexto}</p>}
                </div>
              </div>
            )
          })}
        </div>
      ) : <p className="seg-empty">Pendiente de respuesta del titular.</p>}
    </ContenedorRespuestas>
  )
}

function ContenedorRespuestas({ children }) {
  return (
    <div className="seccion act-seccion-respuestas">
      <div className="sec-header sec-resp">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Respuestas y seguimiento
      </div>
      <div className="sec-body">{children}</div>
    </div>
  )
}
