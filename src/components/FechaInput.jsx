import './FechaInput.css'

/* Los <input type="date"/datetime-local"> nativos muestran la fecha en el
   formato del navegador/SO (en Chrome con Windows en inglés, mm/dd/aaaa) —
   no hay atributo HTML que fuerce dd/mm/aaaa. Se oculta el texto nativo
   (color: transparent, ver FechaInput.css) y se dibuja encima uno propio ya
   formateado; el input real sigue ahí debajo manejando clic, teclado y el
   selector de calendario tal cual. */
const PLACEHOLDER_POR_TIPO = {
  date: 'dd/mm/aaaa',
  'datetime-local': 'dd/mm/aaaa --:-- --',
}

export default function FechaInput({ type = 'date', value, onChange, className = '', wrapClassName = '', placeholder, ...props }) {
  const formatear = (val) => {
    if (!val) return ''
    const [fecha, hora] = val.split('T')
    const [anio, mes, dia] = (fecha || '').split('-')
    if (!anio || !mes || !dia) return ''
    let texto = `${dia}/${mes}/${anio}`
    if (hora) {
      const [hh, mm] = hora.split(':')
      const h = Number(hh)
      if (!Number.isNaN(h) && mm) {
        const ampm = h >= 12 ? 'p.m.' : 'a.m.'
        const h12 = h % 12 === 0 ? 12 : h % 12
        texto += ` ${h12}:${mm} ${ampm}`
      }
    }
    return texto
  }

  const texto = formatear(value)

  return (
    <span className={`fecha-input-wrap${wrapClassName ? ` ${wrapClassName}` : ''}`}>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className={`fecha-input-nativo${className ? ` ${className}` : ''}`}
        {...props}
      />
      <span className="fecha-input-visible" aria-hidden="true">
        {texto || (
          <span className="fecha-input-placeholder">
            {placeholder || PLACEHOLDER_POR_TIPO[type] || ''}
          </span>
        )}
      </span>
    </span>
  )
}
