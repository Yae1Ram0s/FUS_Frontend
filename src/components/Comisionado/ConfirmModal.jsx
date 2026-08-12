import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { mensajeErrorConexion } from '../../api/api'
import { useConexionInternet } from '../../hooks/useConexionInternet'
import { useModalBehavior } from '../../hooks/useModalBehavior'
import './Comisionado.css'

/* Confirmación glass genérica reusada por Atendido y Concluir asunto — evita
   duplicar el mismo overlay/modal/manejo de error+carga en cada acción. */
export default function ConfirmModal({ titulo, texto, textoBoton, colorBoton = 'verde', onClose, onConfirmar }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError]       = useState('')
  const envioEnCursoRef         = useRef(false)
  const enLinea                 = useConexionInternet()
  useModalBehavior(onClose, { closeEnabled: !enviando })

  const confirmar = async () => {
    if (envioEnCursoRef.current) return
    envioEnCursoRef.current = true
    setError(''); setEnviando(true)
    try {
      await onConfirmar()
    } catch (err) {
      setError(mensajeErrorConexion(err, 'No se pudo completar la acción. Intenta nuevamente.'))
      setEnviando(false)
    } finally {
      envioEnCursoRef.current = false
    }
  }

  return createPortal(
    <div className="com-overlay" role="dialog" aria-modal="true" aria-label={titulo} onClick={() => !enviando && onClose()}>
      <div className="com-modal com-modal-confirm" onClick={e => e.stopPropagation()}>
        <div className="com-modal-top">
          <h3>{titulo}</h3>
          <button type="button" className="com-modal-x" onClick={onClose} disabled={enviando} aria-label="Cerrar">✕</button>
        </div>

        <p className="com-confirm-texto">{texto}</p>

        {error && <div className="com-alert-error">{error}</div>}
        {!enLinea && <div className="com-alert-error">Sin conexión a internet — no se puede enviar en este momento.</div>}

        <div className="com-confirm-acciones">
          <button type="button" className="com-btn-ghost" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button type="button" className={`com-btn-${colorBoton}`} onClick={confirmar} disabled={enviando || !enLinea}>
            {enviando && <span className="btn-spinner" />}
            {enviando ? 'Guardando…' : !enLinea ? 'Sin conexión' : textoBoton}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
