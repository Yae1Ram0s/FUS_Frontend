import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../api/api'
import './Comisionado.css'

const initials = (nombre, email) => (nombre || email || '?')
  .split(' ')
  .slice(0, 2)
  .map(w => w[0])
  .join('')
  .toUpperCase()

export default function ComisionarModal({ fusId, onClose, onConfirmado }) {
  const [query, setQuery]           = useState('')
  const [resultados, setResultados] = useState([])
  const [cargando, setCargando]     = useState(true)
  const [seleccionado, setSeleccionado] = useState(null)
  const [enviando, setEnviando]     = useState(false)
  const [error, setError]           = useState('')
  const debounceRef = useRef(null)
  const inputRef     = useRef(null)

  const buscar = useCallback((q) => {
    setCargando(true)
    api.get(`/fus/${fusId}/comisionados-disponibles/`, { params: { q } })
      .then(r => setResultados(Array.isArray(r.data) ? r.data : []))
      .catch(() => setResultados([]))
      .finally(() => setCargando(false))
  }, [fusId])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscar(query), 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, buscar])

  useEffect(() => { inputRef.current?.focus() }, [])

  const confirmar = async () => {
    if (!seleccionado) return
    setError(''); setEnviando(true)
    try {
      const { data } = await api.post(`/fus/${fusId}/comisionar/`, { comisionado_id: seleccionado.id })
      onConfirmado(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo asignar el comisionado. Intenta nuevamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="com-overlay" onClick={() => !enviando && onClose()}>
      <div className="com-modal" onClick={e => e.stopPropagation()}>
        <div className="com-modal-top">
          <h3>Comisionar solicitud</h3>
          <button type="button" className="com-modal-x" onClick={onClose} disabled={enviando} aria-label="Cerrar">✕</button>
        </div>

        <input
          ref={inputRef}
          className="com-pill-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar comisionado por nombre…"
        />

        <div className="com-lista">
          {cargando && (
            <div className="com-skeletons">
              {[0, 1, 2].map(i => <div key={i} className="com-skeleton-row" />)}
            </div>
          )}

          {!cargando && resultados.length === 0 && (
            <p className="com-vacio">No hay comisionados disponibles en tu dirección.</p>
          )}

          {!cargando && resultados.map(c => (
            <div
              key={c.id}
              className={`com-item${seleccionado?.id === c.id ? ' com-item-sel' : ''}`}
              onClick={() => setSeleccionado(c)}
            >
              <span className="com-avatar">{initials(c.nombre, c.email)}</span>
              <div className="com-item-info">
                <span className="com-item-nombre">{c.nombre || c.email}</span>
                <span className="com-item-direccion">{c.direccion || 'Sin dirección asignada'}</span>
              </div>
              <span className={`com-check${seleccionado?.id === c.id ? ' com-check-on' : ''}`} />
            </div>
          ))}
        </div>

        {error && <div className="com-alert-error">{error}</div>}

        <button type="button" className="com-btn-confirmar" onClick={confirmar} disabled={!seleccionado || enviando}>
          {enviando && <span className="btn-spinner" />}
          {enviando ? 'Asignando…' : 'Confirmar asignación'}
        </button>
      </div>
    </div>
  )
}
