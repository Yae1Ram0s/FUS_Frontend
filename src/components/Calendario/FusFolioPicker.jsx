import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/api'
import './FusFolioPicker.css'

const ESTADO_INFO = {
  Registrado:      { color: '#9F2241', label: 'Registrado' },
  Turnado:         { color: '#a78bfa', label: 'Turnado' },
  Recibido:        { color: '#9F2241', label: 'Recibido' },
  En_seguimiento:  { color: '#fbbf24', label: 'En seguimiento' },
  Atendido:        { color: '#fbbf24', label: 'Atendido' },
  Concluido:       { color: '#4ade80', label: 'Concluido' },
  Pendiente_validacion: { color: '#a78bfa', label: 'Pendiente de validación' },
}

const formatearFecha = iso => iso
  ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })
  : '—'

function PreviewContent({ item }) {
  return (
    <>
      <div className="fusfp-preview-top">
        <span className="fusfp-preview-folio">{item.folio}</span>
      </div>
      <p className="fusfp-preview-asunto">{item.asunto || '—'}</p>
      <div className="fusfp-preview-meta">
        <span>{item.solicitante}</span>
        {item.area && <span>{item.area}</span>}
        <span>{formatearFecha(item.fecha)}</span>
      </div>
    </>
  )
}

export default function FusFolioPicker({ value, onChange, onSelect, disabled }) {
  const { user } = useAuth()
  const esROL2 = user?.rol === 'ROL2'

  const [abierto, setAbierto]       = useState(false)
  const [query, setQuery]           = useState('')
  const [resultados, setResultados] = useState([])
  const [cargando, setCargando]     = useState(false)
  const [preview, setPreview]       = useState(null)
  const [previewPos, setPreviewPos] = useState(null)

  const wrapRef       = useRef(null)
  const panelRef       = useRef(null)
  const inputRef       = useRef(null)
  const debounceRef    = useRef(null)
  const hoverTimerRef   = useRef(null)
  const touchTimerRef   = useRef(null)

  const buscar = useCallback((q) => {
    setCargando(true)
    const endpoint = esROL2 ? '/turnados/mis-turnados/' : '/fus/'
    api.get(endpoint, { params: { search: q, page: 1, page_size: 20 } })
      .then(r => {
        const items = r.data.results || []
        setResultados(items.map(it => {
          const f = esROL2 ? it.idFus : it
          if (!f) return null
          return {
            id: f.id,
            folio: f.folio,
            asunto: f.descripcion,
            solicitante: f.idSolicitanteInterno?.nombre || '—',
            estado: esROL2 ? it.estatusTitular : f.estatusParticular,
            fecha: f.fechaHora,
            area: f.idMedioRecepcion?.nombreMedio || null,
          }
        }).filter(Boolean))
      })
      .catch(() => setResultados([]))
      .finally(() => setCargando(false))
  }, [esROL2])

  useEffect(() => {
    if (!abierto) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscar(query), 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, abierto, buscar])

  const cerrar = () => {
    setAbierto(false)
    setPreview(null)
    clearTimeout(hoverTimerRef.current)
    clearTimeout(touchTimerRef.current)
  }

  const abrir = () => {
    if (disabled) return
    setAbierto(true)
    setQuery('')
    buscar('')
  }

  useEffect(() => {
    if (!abierto) return
    const onDocMouseDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) cerrar() }
    const onKeyDown = (e) => { if (e.key === 'Escape') cerrar() }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    return () => { clearTimeout(hoverTimerRef.current); clearTimeout(touchTimerRef.current) }
  }, [abierto])

  const seleccionar = (item) => {
    onChange(item.folio)
    onSelect?.(item)
    cerrar()
  }

  const limpiar = (e) => {
    e.stopPropagation()
    onChange(null)
    onSelect?.(null)
  }

  const mostrarPreview = (item, itemRect) => {
    const panelRect = panelRef.current?.getBoundingClientRect()
    const top  = Math.min(itemRect.top, window.innerHeight - 230)
    const left = (panelRect?.right ?? itemRect.right) + 10
    setPreviewPos({ top: Math.max(top, 8), left })
    setPreview(item)
  }
  const ocultarPreview = () => setPreview(null)

  const onItemMouseEnter = (item, e) => {
    if (window.innerWidth < 640) return
    const rect = e.currentTarget.getBoundingClientRect()
    hoverTimerRef.current = setTimeout(() => mostrarPreview(item, rect), 150)
  }
  const onItemMouseLeave = () => {
    clearTimeout(hoverTimerRef.current)
    ocultarPreview()
  }
  const onItemTouchStart = (item, e) => {
    if (window.innerWidth >= 640) return
    const rect = e.currentTarget.getBoundingClientRect()
    touchTimerRef.current = setTimeout(() => mostrarPreview(item, rect), 350)
  }
  const cancelarTouch = () => clearTimeout(touchTimerRef.current)

  const esMobile = typeof window !== 'undefined' && window.innerWidth < 640

  return (
    <div className="fusfp-wrap" ref={wrapRef}>
      <div
        className={`cal-pill-input fusfp-trigger${disabled ? ' fusfp-trigger-disabled' : ''}`}
        role="combobox"
        aria-expanded={abierto}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={abrir}
        onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrir() } }}
      >
        {value ? (
          <span className="fusfp-chip">
            <span className="fusfp-chip-dot" />
            <span className="fusfp-chip-folio">{value}</span>
            {!disabled && (
              <button type="button" className="fusfp-chip-x" onClick={limpiar} aria-label="Quitar folio">✕</button>
            )}
          </span>
        ) : (
          <span className="fusfp-placeholder">Buscar por folio, asunto o solicitante…</span>
        )}
      </div>

      {abierto && (
        <div className="fusfp-panel" ref={panelRef}>
          <input
            ref={inputRef}
            autoFocus
            className="fusfp-search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={e => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' })}
            placeholder="Folio, asunto o solicitante…"
          />
          <div className="fusfp-contador">
            {cargando ? 'Buscando…' : `${resultados.length} resultado${resultados.length === 1 ? '' : 's'}`}
          </div>

          <div className="fusfp-lista" role="listbox">
            {cargando && (
              <div className="fusfp-skeletons">
                {[0, 1, 2].map(i => <div key={i} className="fusfp-skeleton-row" />)}
              </div>
            )}

            {!cargando && resultados.length === 0 && (
              <p className="fusfp-vacio">Sin coincidencias para «{query}»</p>
            )}

            {!cargando && resultados.map(item => {
              const info = ESTADO_INFO[item.estado] || { color: '#8ab5ad', label: item.estado || '—' }
              return (
                <div
                  key={item.id}
                  role="option"
                  className="fusfp-item"
                  onClick={() => seleccionar(item)}
                  onMouseEnter={e => onItemMouseEnter(item, e)}
                  onMouseLeave={onItemMouseLeave}
                  onTouchStart={e => onItemTouchStart(item, e)}
                  onTouchEnd={cancelarTouch}
                  onTouchMove={cancelarTouch}
                >
                  <div className="fusfp-item-main">
                    <div className="fusfp-item-folio">{item.folio}</div>
                    <div className="fusfp-item-asunto">{item.asunto || '—'}</div>
                    <div className="fusfp-item-sub">{item.solicitante} · {formatearFecha(item.fecha)}</div>
                  </div>
                  <span className="fusfp-item-badge" style={{ '--c': info.color }}>{info.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {preview && !esMobile && previewPos && createPortal(
        <div className="fusfp-preview" style={{ top: previewPos.top, left: previewPos.left }}>
          <PreviewContent item={preview} />
        </div>,
        document.body
      )}

      {preview && esMobile && createPortal(
        <div className="fusfp-preview fusfp-preview-mobile">
          <PreviewContent item={preview} />
        </div>,
        document.body
      )}
    </div>
  )
}
