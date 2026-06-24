import { useState, useRef, useEffect } from 'react'
import { useNotificaciones } from '../context/NotificacionesContext'
import './NotificacionesBell.css'

const timeAgo = (dateStr) => {
  const m = Math.floor((Date.now() - new Date(dateStr)) / 60_000)
  if (m < 1)   return 'ahora mismo'
  if (m < 60)  return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24)  return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} día${d > 1 ? 's' : ''}`
}

/* Icono según tipo de notificación */
function NotifIcon({ tipo }) {
  switch (tipo) {
    case 'TURNADO':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      )
    case 'RESPUESTA':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      )
    case 'CAMBIO_ESTADO':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="9 11 12 14 22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      )
    case 'CONCLUIDO':
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      )
    default:
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      )
  }
}

export default function NotificacionesBell() {
  const ctx = useNotificaciones()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  /* Cerrar al hacer clic fuera */
  useEffect(() => {
    if (!open) return
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  if (!ctx) return null

  const { notifs, noLeidas, cargar, marcarLeida, marcarTodas } = ctx

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) cargar()
  }

  return (
    <div className="notif-wrap" ref={ref}>
      {/* ── Campana ── */}
      <button
        className={`notif-bell-btn${noLeidas > 0 ? ' notif-bell-active' : ''}`}
        onClick={toggle}
        aria-label={`Notificaciones${noLeidas > 0 ? ` (${noLeidas} nuevas)` : ''}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {noLeidas > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {/* ── Panel desplegable ── */}
      {open && (
        <div className="notif-panel" role="dialog" aria-label="Panel de notificaciones">
          <div className="notif-panel-head">
            <div className="notif-panel-title-wrap">
              <span className="notif-panel-title">Notificaciones</span>
              {noLeidas > 0 && (
                <span className="notif-panel-count">{noLeidas} nueva{noLeidas > 1 ? 's' : ''}</span>
              )}
            </div>
            {noLeidas > 0 && (
              <button className="notif-read-all" onClick={marcarTodas}>
                Marcar leídas
              </button>
            )}
          </div>

          <div className="notif-list">
            {notifs.length === 0 ? (
              <div className="notif-empty">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                <p>Sin notificaciones</p>
              </div>
            ) : (
              notifs.slice(0, 25).map(n => (
                <div
                  key={n.id}
                  className={`notif-item${n.leida ? '' : ' notif-item-unread'}`}
                  onClick={() => !n.leida && marcarLeida(n.id)}
                  role={n.leida ? undefined : 'button'}
                  tabIndex={n.leida ? undefined : 0}
                  onKeyDown={e => e.key === 'Enter' && !n.leida && marcarLeida(n.id)}
                >
                  <span className={`notif-icon-wrap notif-icon-${n.tipo || 'default'}`}>
                    <NotifIcon tipo={n.tipo} />
                  </span>
                  <div className="notif-text">
                    <p className="notif-msg">{n.mensaje}</p>
                    <span className="notif-time">{timeAgo(n.fechaCreacion)}</span>
                  </div>
                  {!n.leida && <span className="notif-unread-dot" aria-hidden="true" />}
                </div>
              ))
            )}
          </div>

          {notifs.length > 0 && (
            <div className="notif-panel-foot">
              <span className="notif-foot-txt">Mostrando las últimas {Math.min(notifs.length, 25)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
