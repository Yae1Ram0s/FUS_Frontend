import { PRIORIDAD_NIVELES } from '../../utils/prioridades'

// `conteos` (opcional): { Alta: n, Media: n, Baja: n } — cuántos de los ya
// cargados coinciden con cada nivel, para mostrarlo junto a la etiqueta.
export default function PrioridadFiltroChip({ valor, onChange, conteos }) {
  return (
    <div className="prioridad-filtro-wrap">
      <button
        type="button"
        className={`filtro-chip filtro-chip-alta${valor ? ' filtro-chip-active' : ''}`}
        tabIndex={-1}
      >
        {valor ? `Prioridad: ${valor}` : 'Prioridad'}
        {conteos && <span className="filtro-chip-count">{valor ? (conteos[valor] || 0) : Object.values(conteos).reduce((a, b) => a + b, 0)}</span>}
      </button>
      <select
        className="prioridad-filtro-select"
        value={valor}
        onChange={event => onChange(event.target.value)}
        aria-label="Filtrar por prioridad"
      >
        <option value="">Prioridad</option>
        {PRIORIDAD_NIVELES.map(prioridad => (
          <option key={prioridad.valor} value={prioridad.valor}>
            {conteos ? `${prioridad.valor} (${conteos[prioridad.valor] || 0})` : prioridad.valor}
          </option>
        ))}
      </select>
    </div>
  )
}
