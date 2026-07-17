import { useState } from 'react'
import api from '../../api/api'
import './Comisionado.css'

export default function FinalizarModal({ fusId, onClose, onFinalizado }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError]       = useState('')

  const confirmar = async () => {
    setError(''); setEnviando(true)
    try {
      const { data } = await api.post(`/fus/${fusId}/finalizar-seguimiento/`)
      onFinalizado(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo finalizar el seguimiento. Intenta nuevamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="com-overlay" onClick={() => !enviando && onClose()}>
      <div className="com-modal com-modal-confirm" onClick={e => e.stopPropagation()}>
        <div className="com-modal-top">
          <h3>Finalizar seguimiento</h3>
          <button type="button" className="com-modal-x" onClick={onClose} disabled={enviando} aria-label="Cerrar">✕</button>
        </div>

        <p className="com-confirm-texto">
          ¿Confirmas que terminaste tu seguimiento? Se enviará al Titular para su validación.{' '}
          <strong>Si no la aprueba, regresará a ti para continuar.</strong>
        </p>

        {error && <div className="com-alert-error">{error}</div>}

        <div className="com-confirm-acciones">
          <button type="button" className="com-btn-ghost" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button type="button" className="com-btn-verde" onClick={confirmar} disabled={enviando}>
            {enviando && <span className="btn-spinner" />}
            {enviando ? 'Guardando…' : 'Sí, finalizar seguimiento'}
          </button>
        </div>
      </div>
    </div>
  )
}
