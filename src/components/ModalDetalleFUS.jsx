import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../api/api'
import { formatearFecha, formatearFechaHora } from '../utils/fechas'
import { obtenerIniciales } from '../utils/personas'
import { PRIORIDAD_NIVELES } from '../utils/prioridades'
import Spinner from './Spinner'
import { useModalBehavior } from '../hooks/useModalBehavior'
import './Comisionado/Comisionado.css'
import './ModalDetalleFUS.css'

const fmtFecha = formatearFechaHora
const fmtFechaSolo = formatearFecha

export default function ModalDetalleFUS({ folio, onClose }) {
  useModalBehavior(onClose)
  const {
    data: detalle,
    error,
    isFetching: cargando,
  } = useQuery({
    queryKey: ['fusDetalleAuditoria', folio],
    queryFn: ({ signal }) => api
      .get(`/fus/detalle-auditoria/${folio.split('/').map(encodeURIComponent).join('/')}/`, { signal })
      .then(respuesta => respuesta.data),
  })

  // Bloquea el scroll del contenedor de la página mientras el modal está abierto.
  useEffect(() => {
    const scrollEl = document.querySelector('.bita-bg')
    if (!scrollEl) return
    const prevOverflow = scrollEl.style.overflow
    scrollEl.style.overflow = 'hidden'
    return () => { scrollEl.style.overflow = prevOverflow }
  }, [])

  return createPortal(
    <div className="com-overlay mdet-overlay" role="dialog" aria-modal="true" aria-label={`FUS ${folio}`} onClick={onClose}>
      <div className="com-modal mdet-modal" onClick={e => e.stopPropagation()}>
        <div className="com-modal-top">
          <h3>FUS {folio}</h3>
          <button type="button" className="com-modal-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="mdet-body">
          {cargando && <Spinner overlay={false} fill label="Cargando detalle…" />}
          {error && <p className="com-alert-error">No se pudo cargar el detalle del FUS.</p>}

          {detalle && (
            <>
              <div className="mdet-solicitante-header">
                <span className="mdet-avatar">{obtenerIniciales(detalle.idSolicitanteInterno?.nombre, detalle.idSolicitanteInterno?.email)}</span>
                <div className="mdet-solicitante-info">
                  <strong>{detalle.idSolicitanteInterno?.nombre || '—'}</strong>
                  {detalle.idSolicitanteInterno?.email && <small>{detalle.idSolicitanteInterno.email}</small>}
                </div>
              </div>

              <div className="mdet-row">
                <span className="mdet-label">Registrado</span>
                <span className="mdet-value">{fmtFecha(detalle.fechaRegistro)}</span>
              </div>

              <div className="mdet-row">
                <span className="mdet-label">Medio de recepción</span>
                <span className="mdet-value">{detalle.medioRecepcion || '—'}</span>
              </div>

              <div className="mdet-row">
                <span className="mdet-label">Prioridad</span>
                <span className="mdet-value">
                  {detalle.prioridad ? (
                    <span
                      className="mdet-prioridad-pill"
                      style={{ '--c': PRIORIDAD_NIVELES.find(p => p.valor === detalle.prioridad)?.color || '#718096' }}
                    >
                      {detalle.prioridad}
                    </span>
                  ) : '—'}
                </span>
              </div>
              {detalle.criterios && (
                <ul className="mdet-criterios">
                  {detalle.criterios.split('|').map(c => c.trim()).filter(Boolean).map(c => <li key={c}>{c}</li>)}
                </ul>
              )}

              <div className="mdet-bloque">
                <span className="mdet-label">Descripción</span>
                <p className="mdet-texto-largo">{detalle.descripcion || '—'}</p>
              </div>

              {detalle.contexto && (
                <div className="mdet-bloque">
                  <span className="mdet-label">Contexto</span>
                  <p className="mdet-texto-largo">{detalle.contexto}</p>
                </div>
              )}

              {(detalle.nombreExterno || detalle.telefonoExterno || detalle.correoExterno) && (
                <div className="mdet-bloque">
                  <span className="mdet-label">Solicitante externo</span>
                  <div className="mdet-externo-card">
                    {detalle.nombreExterno && <span className="mdet-externo-nombre">{detalle.nombreExterno}</span>}
                    {detalle.telefonoExterno && <span className="mdet-externo-dato">{detalle.telefonoExterno}</span>}
                    {detalle.correoExterno && <span className="mdet-externo-dato">{detalle.correoExterno}</span>}
                  </div>
                </div>
              )}

              <div className="mdet-row">
                <span className="mdet-label">Evidencias</span>
                <span className="mdet-value">
                  {detalle.evidencias?.length ? detalle.evidencias.map(e => e.nombreArchivo).join(', ') : 'Sin evidencias'}
                </span>
              </div>

              <div className="mdet-seguimientos">
                <h4 className="mdet-seguimientos-title">Respuestas ({detalle.seguimientos?.length || 0})</h4>
                {detalle.seguimientos?.length ? (
                  detalle.seguimientos.map((s, i) => (
                    <div key={i} className="mdet-seg-card">
                      <div className="mdet-seg-meta">
                        <span className="mdet-seg-autor">{s.autor || '—'}</span>
                        <span className="mdet-seg-fecha">{fmtFechaSolo(s.fecha)}</span>
                      </div>
                      <p className="mdet-seg-texto">{s.texto || '—'}</p>
                    </div>
                  ))
                ) : (
                  <p className="mdet-seg-empty">Sin respuestas registradas.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
