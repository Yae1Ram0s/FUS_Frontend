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

const ESTADO_RESUMEN = {
  Registrado:           { label: 'Registrado',              color: '#9F2241' },
  Turnado:              { label: 'Turnado',                 color: '#7c5cd6' },
  Recibido:             { label: 'Recibido',                color: '#9F2241' },
  En_seguimiento:       { label: 'En seguimiento',          color: '#b7791f' },
  Atendido:             { label: 'En seguimiento',          color: '#b7791f' },
  Pendiente_validacion: { label: 'Pendiente de validación', color: '#7c5cd6' },
  Concluido:            { label: 'Concluido',               color: '#2f855a' },
  Rechazado:            { label: 'Rechazado',               color: '#b23030' },
}

/* Con `onVerCompleto` el modal se muestra como RESUMEN (lo esencial en un
   vistazo) y agrega el botón "Ver detalle completo", que lleva al FUS en su
   pantalla de consulta. Sin esa prop se comporta como siempre (Bitácora). */
export default function ModalDetalleFUS({ folio, onClose, onVerCompleto }) {
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
      <div className={`com-modal mdet-modal${onVerCompleto ? ' mdet-modal-resumen' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="com-modal-top">
          <h3>FUS {folio}</h3>
          <button type="button" className="com-modal-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="mdet-body">
          {cargando && <Spinner overlay={false} fill label="Cargando detalle…" />}
          {error && <p className="com-alert-error">No se pudo cargar el detalle del FUS.</p>}

          {detalle && onVerCompleto && (() => {
            const estado = ESTADO_RESUMEN[detalle.estatusParticular] || { label: String(detalle.estatusParticular || '').replace(/_/g, ' '), color: '#4a635b' }
            const prioridad = PRIORIDAD_NIVELES.find(p => p.valor === detalle.prioridad)
            const respuestas = detalle.seguimientos || []
            const ultima = respuestas[respuestas.length - 1]
            const nEvidencias = detalle.evidencias?.length || 0
            const externo = detalle.nombreExterno
            return (
              <div className="mdet-resumen">
                <div className="mdet-solicitante-header mdet-resumen-solicitante">
                  <span className="mdet-avatar">{obtenerIniciales(detalle.idSolicitanteInterno?.nombre, detalle.idSolicitanteInterno?.email)}</span>
                  <div className="mdet-solicitante-info">
                    <strong>{detalle.idSolicitanteInterno?.nombre || '—'}</strong>
                    <small>Registrado el {fmtFechaSolo(detalle.fechaRegistro)}{detalle.medioRecepcion ? ` · ${detalle.medioRecepcion}` : ''}</small>
                  </div>
                </div>

                <div className="mdet-resumen-pildoras">
                  <span className="mdet-pildora" style={{ '--c': estado.color }}>{estado.label}</span>
                  {prioridad && <span className="mdet-pildora" style={{ '--c': prioridad.color }}>Prioridad {prioridad.valor}</span>}
                </div>

                <div className="mdet-bloque">
                  <span className="mdet-label">Descripción</span>
                  <p className="mdet-texto-largo mdet-clamp">{detalle.descripcion || '—'}</p>
                </div>

                <div className="mdet-resumen-datos">
                  <span className="mdet-dato"><b>{respuestas.length}</b> {respuestas.length === 1 ? 'respuesta' : 'respuestas'}</span>
                  <span className="mdet-dato"><b>{nEvidencias}</b> {nEvidencias === 1 ? 'evidencia' : 'evidencias'}</span>
                  {externo && <span className="mdet-dato">Solicitante externo: <b>{externo}</b></span>}
                </div>

                {ultima && (
                  <div className="mdet-bloque">
                    <span className="mdet-label">Última respuesta</span>
                    <div className="mdet-seg-card">
                      <div className="mdet-seg-meta">
                        <span className="mdet-seg-autor">{ultima.autor || '—'}</span>
                        <span className="mdet-seg-fecha">{fmtFechaSolo(ultima.fecha)}</span>
                      </div>
                      <p className="mdet-seg-texto mdet-clamp">{ultima.texto || '—'}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {detalle && !onVerCompleto && (
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

        {onVerCompleto && (
          <div className="mdet-footer">
            <button type="button" className="mdet-btn-secundario" onClick={onClose}>Cerrar</button>
            <button type="button" className="mdet-btn-completo" onClick={onVerCompleto}>
              Ver detalle completo
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
