import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import api from '../api/api'
import { formatearFechaHora } from '../utils/fechas'
import Spinner from './Spinner'
import { useNotificaciones } from '../context/NotificacionesContext'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { useModalBehavior } from '../hooks/useModalBehavior'
import './Comisionado/Comisionado.css'
import './ModalTimeline.css'

const fmtFecha = formatearFechaHora

const TIPO_INFO = {
  creacion:    { titulo: 'Registro',    color: 'var(--fg-secondary)' },
  turnado:     { titulo: 'Turnado',     color: '#1F5647' },
  comisionado: { titulo: 'Comisionado', color: '#9F2241' },
  respuesta:   { titulo: 'Respuesta',   color: 'var(--fg-success)' },
  atendido:    { titulo: 'Atendido',    color: '#b45309' },
  concluido:   { titulo: 'Concluido',   color: 'var(--fg-success)' },
  rechazo:     { titulo: 'Rechazado',   color: '#b23030' },
}

const LEYENDA = [
  { tipo: 'creacion',    label: 'Registro' },
  { tipo: 'turnado',     label: 'Turnado' },
  { tipo: 'comisionado', label: 'Comisionado' },
  { tipo: 'respuesta',   label: 'Respuesta' },
]

export default function ModalTimeline({ folio, onClose }) {
  useModalBehavior(onClose)
  const notifCtx = useNotificaciones()

  const cargarTrazabilidad = useCallback(({ signal }) => {
    const url = `/fus/trazabilidad/${folio.split('/').map(encodeURIComponent).join('/')}/`
    return api.get(url, { signal }).then(respuesta => respuesta.data.eventos || [])
  }, [folio])

  const {
    data: eventos,
    error,
    loading: cargando,
    reload: recargarTrazabilidad,
  } = useAsyncResource(cargarTrazabilidad, { initialData: [] })

  // En vivo: si llega por WebSocket una notificación de este mismo folio
  // (turnado, respuesta, cambio de estado, conclusión), se refresca sola —
  // sin spinner de pantalla completa, sin que el usuario recargue nada.
  const ultimaNotifId = notifCtx?.notifs?.[0]?.id
  useEffect(() => {
    if (notifCtx?.notifs?.[0]?.fusFolio === folio) recargarTrazabilidad()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ultimaNotifId` ya es el proxy primitivo estable de `notifCtx?.notifs` usado en todo el proyecto
  }, [ultimaNotifId, folio, recargarTrazabilidad])

  const hayContenido = eventos.length > 0

  return createPortal(
    <div className="com-overlay" role="dialog" aria-modal="true" aria-label={`Historial — FUS ${folio}`} onClick={onClose}>
      <div className="com-modal mtl-modal" onClick={e => e.stopPropagation()}>
        <div className="com-modal-top">
          <h3>Historial — FUS {folio}</h3>
          <button type="button" className="com-modal-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="mtl-leyenda">
          {LEYENDA.map(l => (
            <span key={l.tipo} className="mtl-leyenda-item">
              <span className="mtl-leyenda-dot" style={{ background: TIPO_INFO[l.tipo].color }} />
              {l.label}
            </span>
          ))}
          <span className="mtl-leyenda-item">
            <span className="mtl-leyenda-dot mtl-punto-live" />
            En vivo
          </span>
        </div>

        <div className="mtl-body">
          {cargando && <Spinner overlay={false} fill label="Cargando historial…" />}
          {error && <p className="modal-error">No se pudo cargar el historial del FUS.</p>}

          {!cargando && !error && (
            hayContenido ? (
              <ul className="mtl-timeline">
                {eventos.map((ev, i) => {
                  const info    = TIPO_INFO[ev.tipo] || TIPO_INFO.respuesta
                  const esUltimo = i === eventos.length - 1
                  return (
                    <li key={i} className="mtl-evento">
                      <span className="mtl-punto-col">
                        <span
                          className={esUltimo ? 'mtl-punto mtl-punto-live' : 'mtl-punto'}
                          style={{ background: info.color, '--live-color': info.color }}
                        />
                        {i < eventos.length - 1 && <span className="mtl-linea" />}
                      </span>
                      <div className="mtl-card" style={{ '--tipo-color': info.color }}>
                        <div className="mtl-card-top">
                          <span className="mtl-card-titulo">{info.titulo}</span>
                          <span className="mtl-card-fecha">{fmtFecha(ev.fecha)}</span>
                        </div>
                        {ev.detalle && <p className="mtl-card-detalle">{ev.detalle}</p>}
                        {ev.actor && <span className="mtl-card-actor">{ev.actor}</span>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : <p className="mtl-empty">Sin eventos registrados.</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
