import { useState, useEffect, useRef } from 'react'
import api from '../../api/api'
import Spinner from '../Spinner'

const fmtHora = d => d
  ? new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  : ''

const TIPO_SEGUIMIENTO_INFO = {
  accion_por_emprender: { label: 'Acción por emprender', clase: 'fc-tag-azul' },
  avance:               { label: 'Avance',                clase: 'fc-tag-verde' },
  finalizacion:         { label: 'Finalización',           clase: 'fc-tag-verde' },
  rechazo:              { label: 'Rechazo',                clase: 'fc-tag-rojo' },
}

/* Historial de respuestas del Comisionado (avances, acciones por emprender,
   rechazos) — solo lectura para Rol 1/Rol 2. Mismo endpoint, mismas
   etiquetas de tipo y mismas clases (.seccion/.seg-timeline/.fc-tag-*, ya
   globales en el bundle único) que usa FUSComisionados.jsx para el
   comisionado, que sigue siendo el único que puede agregar. Se muestra en
   el detalle de FUS en cuanto hay un comisionado asignado. */
export default function SeguimientoComisionadoFeed({ fusId }) {
  const [lista, setLista]           = useState([])
  const [cargando, setCargando]     = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const autoRetriedRef  = useRef(false)
  const retryTimeoutRef = useRef(null)

  const cargar = () => {
    setCargando(true)
    return api.get(`/fus/${fusId}/seguimiento/`)
      .then(r => {
        setErrorCarga(false)
        autoRetriedRef.current = false
        if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null }
        setLista(Array.isArray(r.data) ? r.data : [])
      })
      .catch(() => {
        setErrorCarga(true)
        if (!autoRetriedRef.current) {
          autoRetriedRef.current = true
          retryTimeoutRef.current = setTimeout(cargar, 5000)
        }
      })
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargar() }, [fusId])
  useEffect(() => () => { if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current) }, [])

  return (
    <div className="seccion">
      <div className="sec-header sec-resp">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Respuestas y seguimiento del comisionado
      </div>
      <div className="sec-body">
        {errorCarga && lista.length > 0 && (
          <div className="banner-error-carga">
            <span>No se pudo actualizar — mostrando la última información disponible.</span>
            <button type="button" onClick={cargar}>Reintentar</button>
          </div>
        )}

        <div className="seg-timeline">
          {cargando && lista.length === 0 && <Spinner overlay={false} />}
          {!cargando && errorCarga && lista.length === 0 ? (
            <div className="seg-error">
              <p className="seg-error-msg">No se pudo cargar el historial.</p>
              <button type="button" className="btn-reintentar" onClick={cargar}>Reintentar</button>
            </div>
          ) : (!cargando && lista.length === 0) ? (
            <p className="seg-empty">El comisionado aún no ha registrado respuestas.</p>
          ) : lista.map((s, i) => {
            const info = TIPO_SEGUIMIENTO_INFO[s.tipo] || { label: s.tipo, clase: 'fc-tag-azul' }
            return (
              <div key={s.id} className="seg-tl-item">
                <div className="seg-tl-track">
                  <div className="seg-tl-dot" />
                  {i < lista.length - 1 && <div className="seg-tl-connector" />}
                </div>
                <div className="seg-tl-content">
                  <div className="seg-tl-meta">
                    <span className={`fc-tag ${info.clase}`}>{info.label}</span>
                    <span className="seg-tl-fecha">
                      {s.idAutor?.nombre ? `${s.idAutor.nombre} · ` : ''}{fmtHora(s.fechaRegistro)}
                    </span>
                  </div>
                  <p className="seg-tl-actividad">{s.contenido}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
