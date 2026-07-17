import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/api'
import './Spinner.css'
import './BuscadorGlobal.css'

export default function BuscadorGlobal({ onClose }) {
  const [query,     setQuery]     = useState('')
  const [resultados,setResultados]= useState([])
  const [cargando,  setCargando]  = useState(false)
  const [activo,    setActivo]    = useState(-1)
  const inputRef  = useRef(null)
  const navigate  = useNavigate()
  const { user }  = useAuth()
  const timerRef  = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const buscar = useCallback((q) => {
    if (!q.trim()) { setResultados([]); setCargando(false); return }
    setCargando(true)
    const endpoint = user?.rol === 'ROL2' ? '/turnados/mis-turnados/'
      : user?.rol === 'COMISIONADO' ? '/fus/mis-comisionados/'
      : '/fus/'
    api.get(endpoint, { params: { search: q, page: 1, page_size: 10 } })
      .then(r => {
        const items = r.data.results || []
        if (user?.rol === 'ROL2') {
          setResultados(items.map(t => ({
            id: t.id,
            folio: t.idFus?.folio,
            desc: t.idFus?.descripcion,
            estatus: t.estatusTitular,
            path: '/rol2/solicitudes',
            folioBuscar: t.idFus?.folio,
          })))
        } else if (user?.rol === 'COMISIONADO') {
          setResultados(items.map(f => ({
            id: f.id,
            folio: f.folio,
            desc: f.descripcion,
            estatus: f.estatusParticular,
            path: '/comisionado/fus-comisionados',
            folioBuscar: f.folio,
          })))
        } else {
          setResultados(items.map(f => ({
            id: f.id,
            folio: f.folio,
            desc: f.descripcion,
            estatus: f.estatusParticular,
            path: '/rol1/consultar-fus',
            folioBuscar: f.folio,
          })))
        }
      })
      .catch(() => setResultados([]))
      .finally(() => setCargando(false))
  }, [user])

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => buscar(query), 300)
    return () => clearTimeout(timerRef.current)
  }, [query, buscar])

  const irA = (item) => {
    navigate(`${item.path}?folio=${encodeURIComponent(item.folioBuscar)}`)
    onClose()
  }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo(a => Math.min(a + 1, resultados.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActivo(a => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && activo >= 0) irA(resultados[activo])
    if (e.key === 'Escape') onClose()
  }

  const ESTATUS_COLORS = {
    Registrado: '#9F2241', Turnado: '#a78bfa', Atendido: '#fbbf24',
    Concluido: '#4ade80', Recibido: '#9F2241', En_seguimiento: '#fbbf24',
  }

  return (
    <div className="bglob-overlay" onClick={onClose}>
      <div className="bglob-modal" onClick={e => e.stopPropagation()}>
        <div className="bglob-search-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="bglob-icon">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            className="bglob-input"
            placeholder="Buscar FUS por folio o descripción…"
            value={query}
            onChange={e => { setQuery(e.target.value); setActivo(-1) }}
            onKeyDown={onKey}
          />
          {cargando && <span className="btn-spinner bglob-spin" />}
          <kbd className="bglob-esc" onClick={onClose}>Esc</kbd>
        </div>

        {resultados.length > 0 && (
          <ul className="bglob-list">
            {resultados.map((r, i) => (
              <li
                key={r.id}
                className={`bglob-item${i === activo ? ' bglob-item-active' : ''}`}
                onClick={() => irA(r)}
                onMouseEnter={() => setActivo(i)}
              >
                <div className="bglob-item-folio">{r.folio}</div>
                <div className="bglob-item-desc">{r.desc}</div>
                <span className="bglob-item-badge" style={{ color: ESTATUS_COLORS[r.estatus] }}>
                  {r.estatus?.replace('_', ' ')}
                </span>
              </li>
            ))}
          </ul>
        )}

        {query && !cargando && resultados.length === 0 && (
          <p className="bglob-empty">Sin resultados para «{query}»</p>
        )}

        {!query && (
          <p className="bglob-hint">Escribe un folio o descripción para buscar…</p>
        )}
      </div>
    </div>
  )
}
