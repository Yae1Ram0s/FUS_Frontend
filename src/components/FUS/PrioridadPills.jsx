import { PRIORIDAD_NIVELES } from '../../utils/prioridades'

export default function PrioridadPills({
  valor,
  criterios,
  variante = 'dt',
}) {
  const listaCriterios = criterios
    ? criterios.split('|').map(criterio => criterio.trim()).filter(Boolean)
    : []

  return (
    <div>
      <div className={`${variante}-prioridad-pills`}>
        {PRIORIDAD_NIVELES.map(prioridad => (
          <span
            key={prioridad.valor}
            className={`${variante}-prioridad-pill${
              valor === prioridad.valor
                ? ` ${variante}-prioridad-pill-selected`
                : ''
            }`}
            style={{ '--c': prioridad.color }}
          >
            {prioridad.valor}
          </span>
        ))}
      </div>
      {listaCriterios.length > 0 && (
        <ul className={`${variante}-criterios-lista`}>
          {listaCriterios.map((criterio, indice) => (
            <li key={indice}>{criterio}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
