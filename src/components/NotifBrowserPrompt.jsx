import { useNotificaciones } from '../context/NotificacionesContext'
import './NotifBrowserPrompt.css'

export default function NotifBrowserPrompt() {
  const ctx = useNotificaciones()
  if (!ctx || !ctx.showPrompt) return null

  const { activarBrowserNotif, dismissPrompt } = ctx

  return (
    <div className="nbp-wrap" role="dialog" aria-label="Activar notificaciones">
      <div className="nbp-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>
      <div className="nbp-text">
        <p className="nbp-title">Notificaciones del navegador</p>
        <p className="nbp-sub">Actívalas para recibir avisos aunque la ventana esté minimizada.</p>
      </div>
      <div className="nbp-actions">
        <button className="nbp-btn-activar" onClick={activarBrowserNotif}>
          Activar
        </button>
        <button className="nbp-btn-omitir" onClick={dismissPrompt}>
          Ahora no
        </button>
      </div>
    </div>
  )
}
