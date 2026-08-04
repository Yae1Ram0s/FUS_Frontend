import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import api from '../../api/api'
import { obtenerIniciales } from '../../utils/personas'
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch'
import { useModalBehavior } from '../../hooks/useModalBehavior'
import './Comisionado.css'

export default function ComisionarModal({ fusId, onClose, onConfirmado }) {
  const [query, setQuery]           = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [enviando, setEnviando]     = useState(false)
  const [error, setError]           = useState('')
  useModalBehavior(onClose, { closeEnabled: !enviando })
  const inputRef     = useRef(null)
  const envioEnCursoRef = useRef(false)

  const buscar = useCallback(async (q, { signal }) => {
    const respuesta = await api.get(
      `/fus/${fusId}/comisionados-disponibles/`,
      { params: { q }, signal },
    )
    return Array.isArray(respuesta.data) ? respuesta.data : []
  }, [fusId])

  const {
    results: resultados,
    loading: cargando,
  } = useDebouncedSearch(query, buscar, { searchEmpty: true })

  useEffect(() => { inputRef.current?.focus() }, [])

  const confirmar = async () => {
    if (!seleccionado || envioEnCursoRef.current) return
    envioEnCursoRef.current = true
    setError(''); setEnviando(true)
    try {
      const { data } = await api.post(`/fus/${fusId}/comisionar/`, { comisionado_id: seleccionado.id })
      onConfirmado(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo asignar el comisionado. Intenta nuevamente.')
    } finally {
      envioEnCursoRef.current = false
      setEnviando(false)
    }
  }

  return createPortal(
    <div className="com-overlay" role="dialog" aria-modal="true" aria-label="Comisionar solicitud" onClick={() => !enviando && onClose()}>
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
              <span className="com-avatar">{obtenerIniciales(c.nombre, c.email)}</span>
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
    </div>,
    document.body
  )
}
