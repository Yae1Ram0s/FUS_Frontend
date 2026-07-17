import { useState } from 'react'
import api from '../../api/api'
import './Comisionado.css'

export default function RechazarModal({ fusId, onClose, onRechazado }) {
  const [motivo, setMotivo]     = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError]       = useState('')

  const confirmar = async () => {
    if (!motivo.trim()) { setError('Debes escribir un motivo antes de rechazar.'); return }
    setError(''); setEnviando(true)
    try {
      const { data } = await api.post(`/fus/${fusId}/rechazar/`, { motivo })
      onRechazado(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo rechazar la solicitud. Intenta nuevamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="com-overlay" onClick={() => !enviando && onClose()}>
      <div className="com-modal" onClick={e => e.stopPropagation()}>
        <div className="com-modal-top">
          <h3>Rechazar seguimiento</h3>
          <button type="button" className="com-modal-x" onClick={onClose} disabled={enviando} aria-label="Cerrar">✕</button>
        </div>

        <textarea
          className="com-pill-input com-textarea"
          value={motivo}
          onChange={e => { setMotivo(e.target.value); if (error) setError('') }}
          placeholder="Explica por qué regresa esta solicitud al comisionado…"
          rows={4}
        />

        {error && <div className="com-alert-error">{error}</div>}

        <div className="com-confirm-acciones">
          <button type="button" className="com-btn-ghost" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button type="button" className="com-btn-rojo" onClick={confirmar} disabled={enviando}>
            {enviando && <span className="btn-spinner" />}
            {enviando ? 'Enviando…' : 'Rechazar'}
          </button>
        </div>
      </div>
    </div>
  )
}
