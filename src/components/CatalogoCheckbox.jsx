import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function CatalogoCheckbox({ label, options = [], value, onChange, emptyLabel = 'Todos', searchable = true, className = '' }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches)
  const ref = useRef(null)
  const selected = value ? value.split(',').filter(Boolean) : []
  // El backend puede desplegarse unos minutos después que el frontend o
  // responder con el esquema anterior, sin alguno de los catálogos nuevos.
  // Un catálogo ausente debe mostrarse vacío, no derribar toda la aplicación.
  const normalized = (Array.isArray(options) ? options : [])
    .filter(Boolean)
    .map(item => typeof item === 'string' ? { id: item, nombre: item } : item)
  const visible = normalized.filter(item => `${item.nombre} ${item.descripcion || ''}`.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)')
    const update = () => setMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!open) return
    const close = event => {
      if (!ref.current?.contains(event.target) && !event.target.closest?.('.rep-catalogo-menu')) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const toggle = id => {
    const key = String(id)
    const next = selected.includes(key) ? selected.filter(x => x !== key) : [...selected, key]
    onChange(next.join(','))
  }
  const text = selected.length === 0
    ? emptyLabel
    : selected.length === 1
      ? normalized.find(x => String(x.id) === selected[0])?.nombre || selected[0]
      : `${selected.length} seleccionados`

  const menu = (
    <div className="rep-catalogo-menu" role="dialog" aria-label={label}>
      <div className="rep-catalogo-menu-titulo">{label}</div>
      {searchable && <input type="search" placeholder="Buscar por nombre o correo…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />}
      <label className={!selected.length ? 'selected' : ''}>
        <input type="checkbox" checked={!selected.length} onChange={() => onChange('')} />
        <span>{emptyLabel}</span>
      </label>
      {visible.map(item => {
        const checked = selected.includes(String(item.id))
        return (
          <label key={item.id} className={checked ? 'selected' : ''}>
            <input type="checkbox" checked={checked} onChange={() => toggle(item.id)} />
            <span className="rep-catalogo-opcion-texto">
              <strong>{item.nombre}</strong>
              {item.descripcion && <small>{item.descripcion}</small>}
            </span>
          </label>
        )
      })}
    </div>
  )

  return (
    <div className={`rep-catalogo-label${className ? ` ${className}` : ''}`}>
      <span>{label}</span>
      <div className="rep-catalogo" ref={ref}>
        <button type="button" className={selected.length ? 'active' : ''} onClick={() => setOpen(v => !v)} aria-expanded={open}>
          <span>{text}</span><span className="rep-catalogo-chevron" aria-hidden="true" />
        </button>
        {open && !mobile && menu}
        {open && mobile && createPortal(
          <div className="rep-catalogo-overlay" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}>
            {menu}
          </div>,
          document.body,
        )}
      </div>
    </div>
  )
}
