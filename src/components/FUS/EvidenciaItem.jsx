import { useEvidenciaUrl } from '../../hooks/useEvidenciaUrl'
import { esImagen } from '../../utils/archivos'

export default function EvidenciaItem({ evidencia }) {
  const url = useEvidenciaUrl(evidencia.id)
  const imagen = esImagen(evidencia.tipoMime)

  return (
    <a
      href={url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`ev-item${url ? '' : ' ev-item-cargando'}`}
      title={evidencia.nombreArchivo}
      onClick={event => {
        if (!url) event.preventDefault()
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
  )
}
