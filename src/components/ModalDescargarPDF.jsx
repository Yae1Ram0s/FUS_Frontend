import { useState } from 'react'
import { createPortal } from 'react-dom'

export function descargar(url, nombre, token) {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = nombre
      a.click()
      URL.revokeObjectURL(a.href)
    })
    .catch(() => alert('No se pudo descargar el archivo.'))
}

/* ── Modal: elegir con/sin imágenes al descargar el PDF ── */
export default function ModalDescargarPDF({ onCancelar, onConfirmar }) {
  const [conImagenes, setConImagenes] = useState(true)
  const [cargando, setCargando] = useState(false)

  const confirmar = () => {
    setCargando(true)
    Promise.resolve(onConfirmar(conImagenes)).finally(() => setCargando(false))
  }

  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card modal-card-pdf">
        <div className="modal-header">
          <h3 className="modal-title">Descargar solicitud en PDF</h3>
          <button className="modal-close" onClick={onCancelar} aria-label="Cerrar" disabled={cargando}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-pdf-sub">Elige si deseas incluir las imágenes de evidencia adjuntas.</p>

          <label className={`modal-pdf-opcion${conImagenes ? ' modal-pdf-opcion-activa' : ''}`}>
            <input type="radio" name="pdf-imagenes" checked={conImagenes} onChange={() => setConImagenes(true)} disabled={cargando} />
            <span>Descargar con imágenes de evidencia</span>
          </label>
          <label className={`modal-pdf-opcion${!conImagenes ? ' modal-pdf-opcion-activa' : ''}`}>
            <input type="radio" name="pdf-imagenes" checked={!conImagenes} onChange={() => setConImagenes(false)} disabled={cargando} />
            <span>Descargar sin imágenes</span>
          </label>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancelar} disabled={cargando}>Cancelar</button>
          <button className="btn-turnar" onClick={confirmar} disabled={cargando}>
            {cargando ? <span className="btn-spinner" /> : null}
            {cargando ? 'Generando…' : 'Descargar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
