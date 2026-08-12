import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import api, { mensajeErrorConexion } from '../../api/api'
import { useConexionInternet } from '../../hooks/useConexionInternet'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useModalBehavior } from '../../hooks/useModalBehavior'
import './Comisionado.css'

export default function RechazarModal({ fusId, onClose, onRechazado }) {
  const borradorKey = `scs_rechazo_solicitud_borrador_${fusId}`
  const [motivo, setMotivo]     = useState(() => sessionStorage.getItem(borradorKey) || '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError]       = useState('')
  const envioEnCursoRef         = useRef(false)
  const enLinea                 = useConexionInternet()
  useModalBehavior(onClose, { closeEnabled: !enviando })

  // Autoguardado del motivo — si la conexión se cae a mitad de escribirlo, no
  // depende de red y sobrevive a cerrar el modal por accidente.
  const motivoDeb = useDebouncedValue(motivo, 500)
  useEffect(() => {
    if (motivoDeb.trim()) sessionStorage.setItem(borradorKey, motivoDeb)
    else sessionStorage.removeItem(borradorKey)
  }, [motivoDeb, borradorKey])

  const confirmar = async () => {
    if (!motivo.trim()) { setError('Debes escribir un motivo antes de rechazar.'); return }
    if (envioEnCursoRef.current) return
    envioEnCursoRef.current = true
    setError(''); setEnviando(true)
    try {
      const { data } = await api.post(`/fus/${fusId}/rechazar-solicitud/`, { motivo })
      sessionStorage.removeItem(borradorKey)
      onRechazado(data)
    } catch (err) {
      setError(mensajeErrorConexion(err, 'No se pudo rechazar la solicitud. Intenta nuevamente.'))
    } finally {
      envioEnCursoRef.current = false
      setEnviando(false)
    }
  }

  return createPortal(
    <div className="com-overlay" role="dialog" aria-modal="true" aria-label="Rechazar solicitud" onClick={() => !enviando && onClose()}>
      <div className="com-modal" onClick={e => e.stopPropagation()}>
        <div className="com-modal-top">
          <h3>Rechazar solicitud</h3>
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
        {!enLinea && <div className="com-alert-error">Sin conexión a internet — no se puede enviar en este momento.</div>}

        <div className="com-confirm-acciones">
          <button type="button" className="com-btn-ghost" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button type="button" className="com-btn-rojo" onClick={confirmar} disabled={enviando || !enLinea}>
            {enviando && <span className="btn-spinner" />}
            {enviando ? 'Guardando…' : !enLinea ? 'Sin conexión' : 'Confirmar rechazo'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
