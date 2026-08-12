// Mismo par estado (verde/ámbar) que ya usan los badges sa-badge--operativo /
// sa-badge--advertencia en este mismo panel — validado como CVD-seguro
// (deutan/protan/tritan ΔE > 10) con scripts/validate_palette.js de la skill
// dataviz antes de reutilizarlo aquí.
const COLOR_ACTIVOS = '#16845d'
const COLOR_INACTIVOS = '#c68a1b'

export default function GraficaUsuariosPorEstado({ activos = 0, inactivos = 0 }) {
  const total = activos + inactivos
  const pctActivos = total > 0 ? (activos / total) * 360 : 0
  const stops = total > 0 ? `${COLOR_ACTIVOS} 0deg ${pctActivos}deg, ${COLOR_INACTIVOS} ${pctActivos}deg 360deg` : null

  return (
    <div className="sa-donut-wrap">
      <div className="sa-donut-figure">
        <div
          className={`sa-donut-ring${total === 0 ? ' sa-donut-empty' : ''}`}
          style={total > 0 ? { background: `conic-gradient(${stops})` } : undefined}
        />
        <div className="sa-donut-total">
          <span className="sa-donut-total-value">{total}</span>
          <span className="sa-donut-total-label">Total</span>
        </div>
      </div>
      <ul className="sa-donut-legend">
        <li>
          <span className="sa-dot" style={{ background: COLOR_ACTIVOS }} />
          <span className="sa-donut-legend-label">Activos</span>
          <strong>{activos}</strong>
        </li>
        <li>
          <span className="sa-dot" style={{ background: COLOR_INACTIVOS }} />
          <span className="sa-donut-legend-label">Inactivos</span>
          <strong>{inactivos}</strong>
        </li>
      </ul>
    </div>
  )
}
