import { useCountUp } from '../hooks/useCountUp'

/* Tarjeta de estadística usada en los paneles de resumen (ConsultarFUS, SolicitudesTurnadas). */
export default function StatCard({ icon, label, sublabel, value, accent, delay, live, onClick }) {
  const count = useCountUp(value)
  return (
    <div
      className={`stat-card${onClick ? ' stat-card-clickable' : ''}`}
      style={{ '--accent': accent, animationDelay: delay }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e => e.key === 'Enter' && onClick()) : undefined}
    >
      <div className="stat-icon-wrap">{icon}</div>
      <div className="stat-body">
        <div className="stat-number-row">
          <span className="stat-number">{count}</span>
          {live && <span className="stat-live-dot" title="Actualización en tiempo real" />}
        </div>
        <span className="stat-label">{label}</span>
        {sublabel && <span className="stat-sublabel">{sublabel}</span>}
      </div>
      {onClick && (
        <span className="stat-card-arrow" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>
      )}
    </div>
  )
}
