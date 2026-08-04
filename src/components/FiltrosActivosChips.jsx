import './FiltrosActivosChips.css'

/* Resumen de filtros activos + "Limpiar todo" — mismo diseño que ya usa
   Bitácora (.bita-chips/.bita-limpiar-todo), pero con su propio CSS
   colocado (import directo aquí) en vez de las clases de Bitacora.css: cada
   página carga su CSS en su propio chunk vía lazy-loading de rutas, así que
   un componente compartido entre páginas no puede depender del CSS
   particular de una sola de ellas.
   `chips`: [{ key, label, onQuitar }]. No se muestra nada si viene vacío. */
export default function FiltrosActivosChips({ chips, onLimpiarTodo }) {
  if (!chips.length) return null
  return (
    <>
      <hr className="fac-divider" />
      <div className="fac-chips">
        <span className="fac-chips-label">Filtros activos:</span>
        {chips.map(c => (
          <span key={c.key} className="fac-chip">
            {c.label}
            <button type="button" onClick={c.onQuitar} aria-label={`Quitar filtro: ${c.label}`}>×</button>
          </span>
        ))}
        <button type="button" className="fac-limpiar-todo" onClick={onLimpiarTodo}>Limpiar todo</button>
      </div>
    </>
  )
}
