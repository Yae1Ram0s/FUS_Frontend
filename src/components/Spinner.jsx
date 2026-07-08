import { useId } from 'react'
import './Spinner.css'

/* overlay=true (default): bloquea toda la pantalla — anillos institucionales + logo SCS.
   overlay=false: se muestra en el flujo normal, en el lugar de un texto "Cargando…" (bolitas). */
export default function Spinner({ label, overlay = true }) {
  const uid = useId()
  const grad1 = `spinner-grad-1-${uid}`
  const grad2 = `spinner-grad-2-${uid}`

  if (overlay) {
    return (
      <div className="spinner-overlay">
        <div className="spinner-ring">
          <svg viewBox="0 0 100 100" className="spinner-ring-svg">
            <defs>
              <linearGradient id={grad1} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"  stopColor="#1F5647" />
                <stop offset="50%" stopColor="#3a8a72" />
                <stop offset="100%" stopColor="#BC955C" />
              </linearGradient>
              <linearGradient id={grad2} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"  stopColor="#9F2241" />
                <stop offset="50%" stopColor="#BC955C" />
                <stop offset="100%" stopColor="#1F5647" />
              </linearGradient>
            </defs>
            <circle className="spinner-ring-circle spinner-ring-circle-1" stroke={`url(#${grad1})`} r="40" cx="50" cy="50" />
            <circle className="spinner-ring-circle spinner-ring-circle-2" stroke={`url(#${grad2})`} r="30" cx="50" cy="50" />
          </svg>
          <img src="/Logo SCS 2026_1.png" alt="" className="spinner-ring-logo" />
        </div>
        {label && <span className="spinner-label">{label}</span>}
      </div>
    )
  }

  return (
    <div className="spinner-inline">
      <div className="spinner-balls" />
      {label && <span className="spinner-label">{label}</span>}
    </div>
  )
}
