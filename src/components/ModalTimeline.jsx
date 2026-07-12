import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import api from '../api/api'
import Spinner from './Spinner'
import './ModalTimeline.css'

const fmtFecha = d => d
  ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'

const TIPO_INFO = {
  creacion:  { titulo: 'Registro',  color: 'var(--fg-secondary)' },
  turnado:   { titulo: 'Turnado',   color: '#1F5647' },
  respuesta: { titulo: 'Respuesta', color: 'var(--fg-success)' },
  concluido: { titulo: 'Concluido', color: 'var(--fg-success)' },
}

const LEYENDA = [
  { tipo: 'creacion',  label: 'Registro' },
  { tipo: 'turnado',   label: 'Turnado' },
  { tipo: 'respuesta', label: 'Respuesta' },
]

export default function ModalTimeline({ folio, onClose }) {
  const [eventos,  setEventos]  = useState([])
  const [error,    setError]    = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    api.get(`/fus/trazabilidad/${folio.split('/').map(encodeURIComponent).join('/')}/`)
      .then(r => setEventos(r.data.eventos || []))
      .catch(() => setError(true))
      .finally(() => setCargando(false))
  }, [folio])

  return createPortal(
    <div className="modal-overlay mtl-overlay" role="dialog" aria-modal="true">
      <div className="modal-card mtl-modal">
        <div className="modal-header">
          <h3 className="modal-title">Historial — FUS {folio}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="mtl-leyenda">
          {LEYENDA.map(l => (
            <span key={l.tipo} className="mtl-leyenda-item">
              <span className="mtl-leyenda-dot" style={{ background: TIPO_INFO[l.tipo].color }} />
              {l.label}
            </span>
          ))}
        </div>

        <div className="mtl-body">
          {cargando && <Spinner overlay={false} label="Cargando historial…" />}
          {error && <p className="modal-error">No se pudo cargar el historial del FUS.</p>}

          {!cargando && !error && (
            eventos.length ? (
              <ul className="mtl-timeline">
                {eventos.map((ev, i) => {
                  const info = TIPO_INFO[ev.tipo] || TIPO_INFO.respuesta
                  return (
                    <li key={i} className="mtl-evento">
                      <span className="mtl-punto-col">
                        <span className="mtl-punto" style={{ background: info.color }} />
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
