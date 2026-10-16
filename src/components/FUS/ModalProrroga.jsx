import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '../../api/api'
import FechaInput from '../FechaInput'
import { useModalBehavior } from '../../hooks/useModalBehavior'
import { formatearFechaHora } from '../../utils/fechas'
import '../Comisionado/Comisionado.css'

const pad = n => String(n).padStart(2, '0')
const aDatetimeLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

export default function ModalProrroga({ fus, onClose, onConfirmado }) {
  const [fecha, setFecha]       = useState('')
  const [motivo, setMotivo]     = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError]       = useState('')
  const envioEnCursoRef = useRef(false)
  useModalBehavior(onClose, { closeEnabled: !enviando })

  const vencido = fus.estadoTemporalidad === 'Vencido'
  // La nueva fecha debe ser posterior tanto a hoy como al límite actual.
  const [base] = useState(() => new Date(Math.max(Date.now(), new Date(fus.fechaLimite).getTime())))
  const minimo = aDatetimeLocal(base)

  const confirmar = async () => {
    if (envioEnCursoRef.current) return
    if (!fecha) { setError('Elige la nueva fecha y hora límite.'); return }
    if (!motivo.trim()) { setError('Escribe el motivo de la prórroga.'); return }
    const nueva = new Date(fecha)
    if (nueva <= base) { setError('La nueva fecha debe ser posterior a la fecha límite actual.'); return }

    envioEnCursoRef.current = true
    setError(''); setEnviando(true)
    try {
      const { data } = await api.post(`/fus/${fus.id}/prorroga/`, {
        fechaLimite: nueva.toISOString(),
        motivo: motivo.trim(),
      })
      onConfirmado(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo dar la prórroga. Intenta nuevamente.')
    } finally {
      envioEnCursoRef.current = false
      setEnviando(false)
    }
  }

  return createPortal(
    <div className="com-overlay" role="dialog" aria-modal="true" aria-label="Dar prórroga" onClick={() => !enviando && onClose()}>
      <div className="com-modal" onClick={e => e.stopPropagation()}>
        <div className="com-modal-top">
          <h3>{vencido ? 'Solicitud vencida — dar prórroga' : 'Dar prórroga'}</h3>
          <button type="button" className="com-modal-x" onClick={onClose} disabled={enviando} aria-label="Cerrar">✕</button>
        </div>

        <p className="com-confirm-texto">
          {vencido ? <strong>Venció el {formatearFechaHora(fus.fechaLimite)}.</strong> : <>Límite actual: <strong>{formatearFechaHora(fus.fechaLimite)}</strong>.</>}
          {' '}Elige la nueva fecha y hora límite de <strong>{fus.folio}</strong>; se avisará a las personas involucradas.
        </p>

        <label htmlFor="prorroga-fecha" className="com-confirm-texto">Nueva fecha y hora límite</label>
        <FechaInput
          id="prorroga-fecha"
          type="datetime-local"
          value={fecha}
          min={minimo}
          onChange={e => setFecha(e.target.value)}
        />

        <label htmlFor="prorroga-motivo" className="com-confirm-texto">Motivo de la prórroga</label>
        <textarea
          id="prorroga-motivo"
          className="com-pill-input com-textarea"
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          maxLength={500}
          placeholder="Ej. Se requiere información adicional del área."
        />

        {error && <div className="com-alert-error" role="alert">{error}</div>}

        <button type="button" className="com-btn-confirmar" onClick={confirmar} disabled={enviando}>
          {enviando && <span className="btn-spinner" />}
          {enviando ? 'Guardando…' : 'Confirmar prórroga'}
        </button>
      </div>
    </div>,
    document.body
  )
}
