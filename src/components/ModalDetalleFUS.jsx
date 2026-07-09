import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import api from '../api/api'
import Spinner from './Spinner'
import './ModalDetalleFUS.css'

const fmtFecha = d => d
  ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—'

const fmtFechaSolo = d => d
  ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'

export default function ModalDetalleFUS({ folio, onClose }) {
  const [detalle,  setDetalle]  = useState(null)
  const [error,    setError]    = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    api.get(`/fus/detalle-auditoria/${folio.split('/').map(encodeURIComponent).join('/')}/`)
      .then(r => setDetalle(r.data))
      .catch(() => setError(true))
      .finally(() => setCargando(false))
  }, [folio])

  // Bloquea el scroll del contenedor de la página mientras el modal está abierto.
  useEffect(() => {
    const scrollEl = document.querySelector('.bita-bg')
    if (!scrollEl) return
    const prevOverflow = scrollEl.style.overflow
    scrollEl.style.overflow = 'hidden'
    return () => { scrollEl.style.overflow = prevOverflow }
  }, [])

  return createPortal(
    <div className="modal-overlay mdet-overlay" role="dialog" aria-modal="true">
      <div className="modal-card mdet-modal">
        <div className="modal-header">
          <h3 className="modal-title">FUS {folio}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="mdet-body">
          {cargando && <Spinner overlay={false} label="Cargando detalle…" />}
          {error && <p className="modal-error">No se pudo cargar el detalle del FUS.</p>}

          {detalle && (
            <>
              <div className="mdet-row">
                <span className="mdet-label">Estatus</span>
                <span className="mdet-value">
                  <span className="mdet-badges">
                    <span className="mdet-badge">{detalle.estatusParticular || '—'}</span>
                    {detalle.estatusTitular && <span className="mdet-badge">{detalle.estatusTitular}</span>}
                  </span>
                </span>
              </div>

              <div className="mdet-row">
                <span className="mdet-label">Solicitante</span>
                <span className="mdet-value mdet-solicitante">
                  <strong>{detalle.idSolicitanteInterno?.nombre || '—'}</strong>
                  {detalle.idSolicitanteInterno?.email && <small>{detalle.idSolicitanteInterno.email}</small>}
                </span>
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
                <span className="mdet-label">Descripción</span>
                <span className="mdet-value">{detalle.descripcion || '—'}</span>
              </div>

              <div className="mdet-row">
                <span className="mdet-label">Contexto</span>
                <span className="mdet-value">{detalle.contexto || '—'}</span>
              </div>

              <div className="mdet-row">
                <span className="mdet-label">Prioridad</span>
                <span className="mdet-value">
                  {detalle.prioridad || '—'}{detalle.criterios ? ` — ${detalle.criterios}` : ''}
                </span>
              </div>

              {(detalle.nombreExterno || detalle.telefonoExterno || detalle.correoExterno) && (
                <div className="mdet-row">
                  <span className="mdet-label">Solicitante externo</span>
                  <span className="mdet-value">
                    {[detalle.nombreExterno, detalle.telefonoExterno, detalle.correoExterno].filter(Boolean).join(' — ')}
                  </span>
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
