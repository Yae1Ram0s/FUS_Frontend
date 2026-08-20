import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useModalBehavior } from '../hooks/useModalBehavior'
import { useAnalytics } from '../analytics'
import './Comisionado/Comisionado.css'
import './ModalDescargarBitacora.css'

/* ── Modal: elegir el formato al exportar la bitácora — mismo diseño glass
   que ModalDescargarPDF/ComisionarModal. Las columnas exportadas ya las
   decide la vista de tabla actual (los "pills" de columnas de Bitacora.jsx),
   así que aquí solo hace falta escoger Excel o PDF. ── */
export default function ModalDescargarBitacora({ onCancelar, onConfirmar }) {
  const [formato, setFormato] = useState('excel')
  const [cargando, setCargando] = useState(false)
  useModalBehavior(onCancelar, { closeEnabled: !cargando })
  const { startTask, completeTask, failTask } = useAnalytics({ componente: 'BITACORA_DESCARGAR', accion: 'EXPORT' })

  const confirmar = () => {
    setCargando(true)
    const taskId = startTask({ metadatos: { formato } })
    Promise.resolve(onConfirmar(formato))
      .then(() => completeTask(taskId))
      .catch(err => { failTask(taskId, { metadatos: { motivo: err?.response ? 'error_servidor' : 'sin_conexion' } }); throw err })
      .finally(() => setCargando(false))
  }

  return createPortal(
    <div className="com-overlay" role="dialog" aria-modal="true" aria-label="Descargar bitácora" onClick={() => !cargando && onCancelar()}>
      <div className="com-modal com-modal-confirm" onClick={e => e.stopPropagation()}>
        <div className="com-modal-top">
          <h3>Descargar bitácora</h3>
          <button type="button" className="com-modal-x" onClick={onCancelar} disabled={cargando} aria-label="Cerrar">✕</button>
        </div>

        <div className="modal-bita-formatos">
          <button
            type="button"
            className={`modal-bita-formato${formato === 'excel' ? ' modal-bita-formato-activo' : ''}`}
            onClick={() => setFormato('excel')}
            disabled={cargando}
            data-analytics-event="INTERACTION"
            data-analytics-component="BITACORA_DESCARGAR_FORMATO"
            data-analytics-action="FILTER"
            data-analytics-metadata="excel"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            Excel
          </button>
          <button
            type="button"
            className={`modal-bita-formato${formato === 'pdf' ? ' modal-bita-formato-activo' : ''}`}
            onClick={() => setFormato('pdf')}
            disabled={cargando}
            data-analytics-event="INTERACTION"
            data-analytics-component="BITACORA_DESCARGAR_FORMATO"
            data-analytics-action="FILTER"
            data-analytics-metadata="pdf"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
            </svg>
            PDF
          </button>
        </div>

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
