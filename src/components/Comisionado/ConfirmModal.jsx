import { useState } from 'react'
import { createPortal } from 'react-dom'
import './Comisionado.css'

/* Confirmación glass genérica reusada por Atendido y Concluir asunto — evita
   duplicar el mismo overlay/modal/manejo de error+carga en cada acción. */
export default function ConfirmModal({ titulo, texto, textoBoton, colorBoton = 'verde', onClose, onConfirmar }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError]       = useState('')

  const confirmar = async () => {
    setError(''); setEnviando(true)
    try {
      await onConfirmar()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo completar la acción. Intenta nuevamente.')
      setEnviando(false)
    }
  }

  return createPortal(
    <div className="com-overlay" onClick={() => !enviando && onClose()}>
      <div className="com-modal com-modal-confirm" onClick={e => e.stopPropagation()}>
        <div className="com-modal-top">
          <h3>{titulo}</h3>
          <button type="button" className="com-modal-x" onClick={onClose} disabled={enviando} aria-label="Cerrar">✕</button>
        </div>

        <p className="com-confirm-texto">{texto}</p>

        {error && <div className="com-alert-error">{error}</div>}

        <div className="com-confirm-acciones">
          <button type="button" className="com-btn-ghost" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button type="button" className={`com-btn-${colorBoton}`} onClick={confirmar} disabled={enviando}>
            {enviando && <span className="btn-spinner" />}
            {enviando ? 'Guardando…' : textoBoton}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
