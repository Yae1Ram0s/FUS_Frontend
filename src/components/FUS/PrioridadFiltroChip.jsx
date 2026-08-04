import { PRIORIDAD_NIVELES } from '../../utils/prioridades'

export default function PrioridadFiltroChip({ valor, onChange }) {
  return (
    <div className="prioridad-filtro-wrap">
      <button
        type="button"
        className={`filtro-chip filtro-chip-alta${valor ? ' filtro-chip-active' : ''}`}
        tabIndex={-1}
      >
        {valor ? `Prioridad: ${valor}` : 'Prioridad'}
      </button>
      <select
        className="prioridad-filtro-select"
        value={valor}
        onChange={event => onChange(event.target.value)}
        aria-label="Filtrar por prioridad"
      >
        <option value="">Prioridad</option>
        {PRIORIDAD_NIVELES.map(prioridad => (
          <option key={prioridad.valor} value={prioridad.valor}>{prioridad.valor}</option>
        ))}
      </select>
    </div>
  )
}
