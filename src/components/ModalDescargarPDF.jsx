import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useModalBehavior } from '../hooks/useModalBehavior'
import './Comisionado/Comisionado.css'
import './ModalDescargarPDF.css'

/* ── Modal: incluir o no imágenes de evidencia, y de quién(es) las
   respuestas, al descargar el PDF. `turnados` es opcional — con 1 o 0
   personas no tiene sentido elegir, así que el selector ni se muestra. */
export default function ModalDescargarPDF({ onCancelar, onConfirmar, turnados = [] }) {
  const [conImagenes, setConImagenes] = useState(true)
  const [turnadoId, setTurnadoId] = useState('')
  const [cargando, setCargando] = useState(false)
  useModalBehavior(onCancelar, { closeEnabled: !cargando })

  const confirmar = () => {
    setCargando(true)
    Promise.resolve(onConfirmar(conImagenes, turnadoId)).finally(() => setCargando(false))
  }

  return createPortal(
    <div className="com-overlay" role="dialog" aria-modal="true" aria-label="Descargar solicitud en PDF" onClick={() => !cargando && onCancelar()}>
      <div className="com-modal com-modal-confirm" onClick={e => e.stopPropagation()}>
        <div className="com-modal-top">
          <h3>Descargar solicitud en PDF</h3>
          <button type="button" className="com-modal-x" onClick={onCancelar} disabled={cargando} aria-label="Cerrar">✕</button>
        </div>

        <label className="modal-pdf-check">
          <input
            type="checkbox"
            checked={conImagenes}
            onChange={e => setConImagenes(e.target.checked)}
            disabled={cargando}
          />
          Incluir imágenes de evidencia adjuntas
        </label>

        {turnados.length > 1 && (
          <label className="modal-pdf-select">
            Respuestas a incluir
            <select value={turnadoId} onChange={e => setTurnadoId(e.target.value)} disabled={cargando}>
              <option value="">Todas (todas las personas)</option>
              {turnados.map(t => (
                <option key={t.id} value={t.id}>
                  {t.idDestinatario?.nombre || t.idDestinatario?.email || 'Sin nombre'}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="com-confirm-acciones">
          <button type="button" className="com-btn-ghost" onClick={onCancelar} disabled={cargando}>Cancelar</button>
          <button type="button" className="com-btn-verde" onClick={confirmar} disabled={cargando}>
            {cargando && <span className="btn-spinner" />}
            {cargando ? 'Generando…' : 'Descargar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
