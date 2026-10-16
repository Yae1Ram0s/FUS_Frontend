import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useEvidenciaUrl } from '../../hooks/useEvidenciaUrl'
import { useModalBehavior } from '../../hooks/useModalBehavior'
import { esImagen } from '../../utils/archivos'
import './EvidenciaItem.css'

const esPdf = evidencia => (
  evidencia.tipoMime === 'application/pdf' || /\.pdf$/i.test(evidencia.nombreArchivo || '')
)

/* Visor en modal: imagen y PDF se muestran incrustados; los demás formatos
   (DOCX) no se pueden renderizar en el navegador, así que se ofrece descargarlos. */
function VisorEvidencia({ url, evidencia, onClose }) {
  useModalBehavior(onClose)
  const nombre = evidencia.nombreArchivo
  const imagen = esImagen(evidencia.tipoMime)
  const pdf = !imagen && esPdf(evidencia)

  return createPortal(
    <div className="ev-visor-overlay" role="dialog" aria-modal="true" aria-label={nombre} onClick={onClose}>
      <div className={`ev-visor${pdf ? ' ev-visor-pdf' : ''}`} onClick={event => event.stopPropagation()}>
        <div className="ev-visor-top">
          <span className="ev-visor-nombre" title={nombre}>{nombre}</span>
          <button type="button" className="ev-visor-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="ev-visor-body">
          {imagen && <img src={url} alt={nombre} className="ev-visor-img" />}
          {pdf && <iframe src={url} title={nombre} className="ev-visor-frame" />}
          {!imagen && !pdf && (
            <div className="ev-visor-otro">
              <p>Este tipo de archivo no se puede previsualizar.</p>
              <a href={url} download={nombre} className="ev-visor-descargar">Descargar archivo</a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function EvidenciaItem({ evidencia }) {
  const url = useEvidenciaUrl(evidencia.id)
  const imagen = esImagen(evidencia.tipoMime)
  const [verEvidencia, setVerEvidencia] = useState(false)

  return (
    <>
      <a
        href={url || undefined}
        className={`ev-item${url ? '' : ' ev-item-cargando'}`}
        title={evidencia.nombreArchivo}
        onClick={event => {
          event.preventDefault()
          if (url) setVerEvidencia(true)
        }}
      >
        {imagen && url ? (
          <img
            src={url}
            alt={evidencia.nombreArchivo}
            className="ev-thumb"
          />
        ) : (
          <span className="ev-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </span>
        )}
        <span className="ev-nombre">{evidencia.nombreArchivo}</span>
        {evidencia.comentarios && (
          <span className="ev-comentario">{evidencia.comentarios}</span>
        )}
      </a>
      {verEvidencia && url && (
        <VisorEvidencia url={url} evidencia={evidencia} onClose={() => setVerEvidencia(false)} />
      )}
    </>
  )
}
