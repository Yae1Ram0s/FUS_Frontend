import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import ModalTimeline from '../components/ModalTimeline'
import ComisionarModal from '../components/Comisionado/ComisionarModal'
import RechazarModal from '../components/Comisionado/RechazarModal'
import api from '../api/api'
import { useEstatus } from '../hooks/useEstatus'
import { useNotificaciones } from '../context/NotificacionesContext'
import { useResizablePanel } from '../hooks/useResizablePanel'
import { useEvidenciaUrl } from '../hooks/useEvidenciaUrl'
import { useToast } from '../context/ToastContext'
import './SolicitudesTurnadas.css'

const initialesComisionado = (nombre, email) => (nombre || email || '?')
  .split(' ')
  .slice(0, 2)
  .map(w => w[0])
  .join('')
  .toUpperCase()

const fmtHora = d => d
  ? new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  : ''

/* ── Sección Respuestas y Seguimiento ── */
function Seguimientos({ turnadoId, concluido }) {
  const [lista,       setLista]       = useState([])
  const hoy = new Date().toISOString().split('T')[0]
  const [fecha,       setFecha]       = useState(hoy)
  const [actividad,   setActividad]   = useState('')
  const [accionTexto, setAccionTexto] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [eliminandoId,setEliminandoId] = useState(null)
  const [error,       setError]       = useState('')
  const [errorCarga,  setErrorCarga]  = useState(false)
  const autoRetriedRef = useRef(false)
  const retryTimeoutRef = useRef(null)

  const cargar = () =>
    api.get(`/turnados/${turnadoId}/seguimientos/`)
      .then(r => {
        setErrorCarga(false)
        autoRetriedRef.current = false
        if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null }
        setLista(r.data)
      })
      .catch(() => {
        setErrorCarga(true)
        if (!autoRetriedRef.current) {
          autoRetriedRef.current = true
          retryTimeoutRef.current = setTimeout(cargar, 5000)
        }
      })

  useEffect(() => { cargar() }, [turnadoId])
  useEffect(() => () => { if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current) }, [])

  const agregar = async () => {
    if (!fecha || !actividad.trim()) { setError('Completa la fecha y la actividad.'); return }
    setError(''); setLoading(true)
    try {
      await api.post(`/turnados/${turnadoId}/seguimientos/`, {
        fechaActividad: fecha,
        descripcionActividad: actividad,
        accionTexto,
      })
      setFecha(hoy); setActividad(''); setAccionTexto('')
      cargar()
    } catch (e) {
      setError(e.response?.data?.detail || 'No se pudo registrar. Intenta nuevamente.')
    } finally { setLoading(false) }
  }

  const eliminar = async id => {
    setEliminandoId(id)
    try { await api.delete(`/seguimientos/${id}/`); cargar() }
    catch (e) { setError(e.response?.data?.detail || 'No se pudo eliminar. Intenta nuevamente.') }
    finally { setEliminandoId(null) }
  }

  return (
    <div className="seccion">
      <div className="sec-header sec-resp">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Respuestas y seguimiento
      </div>
      <div className="sec-body">
        {concluido && (
          <div className="seg-concluido-banner">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Asunto concluido — las respuestas son de solo lectura
          </div>
        )}

        {errorCarga && lista.length > 0 && (
          <div className="banner-error-carga">
            <span>No se pudo actualizar — mostrando la última información disponible.</span>
            <button type="button" onClick={cargar}>Reintentar</button>
          </div>
        )}

        <div className="seg-timeline">
          {errorCarga && lista.length === 0 ? (
            <div className="seg-error">
              <p className="seg-error-msg">No se pudo cargar el historial de respuestas.</p>
              <button type="button" className="btn-reintentar" onClick={cargar}>Reintentar</button>
            </div>
          ) : lista.length === 0 ? (
            <p className="seg-empty">Sin respuestas registradas aún</p>
          ) : lista.map((s, i) => (
            <div key={s.id} className="seg-tl-item">
              <div className="seg-tl-track">
                <div className="seg-tl-dot" />
                {i < lista.length - 1 && <div className="seg-tl-connector" />}
              </div>
              <div className="seg-tl-content">
                <div className="seg-tl-meta">
                  <span className="seg-tl-fecha">
                    {s.fechaActividad}
                    {s.fechaRegistro && <span className="seg-tl-hora"> · {fmtHora(s.fechaRegistro)}</span>}
                  </span>
                  {!concluido && (
                    <button className="btn-del" onClick={() => eliminar(s.id)} disabled={eliminandoId === s.id} title="Eliminar">
                      {eliminandoId === s.id
                        ? <span className="btn-spinner" />
                        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/>
                          </svg>}
                    </button>
                  )}
                </div>
                <p className="seg-tl-actividad">{s.descripcionActividad}</p>
                {s.accionTexto && (
                  <p className="seg-tl-accion">→ {s.accionTexto}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {!concluido && (
          <div className="seg-nueva">
            <div className="seg-nueva-inputs">
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="seg-nueva-fecha" />
              <input type="text" placeholder="Describe la actividad…" value={actividad} onChange={e => setActividad(e.target.value)} />
              <input type="text" placeholder="Acción por emprender…" value={accionTexto} onChange={e => setAccionTexto(e.target.value)} />
            </div>
            <button className="btn-agregar" onClick={agregar} disabled={loading}>
              {loading
                ? <span className="btn-spinner" />
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>}
              {loading ? 'Guardando…' : 'Agregar'}
            </button>
          </div>
        )}

        {error && <p className="sec-error" role="alert">{error}</p>}
      </div>
    </div>
  )
}

/* ── Fila de detalle ── */
function DRow({ label, value, tall }) {
  return (
    <div className={`drow${tall ? ' drow-tall' : ''}`}>
      <span className="drow-label">{label}</span>
      <span className="drow-value">{value || '—'}</span>
    </div>
  )
}

function esImagen(mime) {
  return mime && mime.startsWith('image/')
}

/* ── Ítem de evidencia individual (descarga autenticada) ── */
function EvidenciaItem({ ev }) {
  const url = useEvidenciaUrl(ev.id)
  const imagen = esImagen(ev.tipoMime)
  return (
    <a
      href={url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`ev-item${url ? '' : ' ev-item-cargando'}`}
      title={ev.nombreArchivo}
      onClick={e => { if (!url) e.preventDefault() }}
    >
      {imagen && url ? (
        <img src={url} alt={ev.nombreArchivo} className="ev-thumb" />
      ) : (
        <span className="ev-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </span>
      )}
      <span className="ev-nombre">{ev.nombreArchivo}</span>
      {ev.comentarios && <span className="ev-comentario">{ev.comentarios}</span>}
    </a>
  )
}

/* ── Lista de evidencias ── */
function EvidenciaList({ evidencias }) {
  if (!evidencias?.length) return (
    <div className="drow">
      <span className="drow-label">Evidencia</span>
      <span className="drow-value">—</span>
    </div>
  )

  return (
    <div className="ev-lista">
      {evidencias.map(ev => <EvidenciaItem key={ev.id} ev={ev} />)}
    </div>
  )
}

/* ── Prioridad — pills de solo lectura ── */
const PRIORIDAD_NIVELES = [
  { valor: 'Alta',  color: '#b91c1c' },
  { valor: 'Media', color: '#92400e' },
  { valor: 'Baja',  color: '#15803d' },
]

function PrioridadPills({ valor, criterios }) {
  const listaCriterios = criterios ? criterios.split('|').map(c => c.trim()).filter(Boolean) : []
  return (
    <div>
      <div className="dt-prioridad-pills">
        {PRIORIDAD_NIVELES.map(p => (
          <span
            key={p.valor}
            className={`dt-prioridad-pill${valor === p.valor ? ' dt-prioridad-pill-selected' : ''}`}
            style={{ '--c': p.color }}
          >
            {p.valor}
          </span>
        ))}
      </div>
      {listaCriterios.length > 0 && (
        <ul className="dt-criterios-lista">
          {listaCriterios.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      )}
    </div>
  )
}

/* ── Detalle del turnado (ROL2) ── */
function DetalleTurnado({ turnado, onConcluido, onBack, onVerHistorial }) {
  const [cargando,      setCargando]      = useState(false)
  const [error,         setError]         = useState('')
  const [modalConcluir, setModalConcluir] = useState(false)
  const [fusData,        setFusData]       = useState(turnado.idFus || {})
  const [modalComisionar, setModalComisionar] = useState(false)
  const [modalRechazar,   setModalRechazar]   = useState(false)
  const [aprobando,       setAprobando]       = useState(false)
  const [errorAprobar,    setErrorAprobar]    = useState('')
  const toast = useToast()
  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  const fus = fusData
  const puedesConcluir = turnado.estatusTitular !== 'Concluido' && !fus.idComisionado

  const handleConcluir = () => setModalConcluir(true)

  const handleConfirmar = async () => {
    setCargando(true); setError('')
    try {
      await api.post(`/turnados/${turnado.id}/concluir/`)
      setModalConcluir(false)
      onConcluido()
    } catch (e) {
      setError(e.response?.data?.detail || 'No se pudo concluir. Intenta nuevamente.')
      setModalConcluir(false)
    } finally {
      setCargando(false)
    }
  }

  const puedesComisionar = fus.estatusParticular === 'Turnado'
  const puedeAprobarRechazar = fus.estatusParticular === 'Pendiente_validacion'

  const handleAprobar = async () => {
    setErrorAprobar(''); setAprobando(true)
    try {
      const { data } = await api.post(`/fus/${fus.id}/aprobar/`)
      setFusData(data)
      toast.success('Solicitud aprobada y concluida.')
    } catch (e) {
      setErrorAprobar(e.response?.data?.detail || 'No se pudo aprobar. Intenta nuevamente.')
    } finally {
      setAprobando(false)
    }
  }

  const tieneExterno = fus.nombreExterno || fus.telefonoExterno || fus.correoExterno
  const nombreSolicitante = fus.idSolicitanteInterno?.nombre

  return (
    <div className="dt-panel" style={{ position: 'relative' }}>

      {modalConcluir && (
        <div className="concluir-overlay" onClick={() => !cargando && setModalConcluir(false)}>
          <div className="concluir-modal" onClick={e => e.stopPropagation()}>
            <div className="concluir-modal-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>
              </svg>
            </div>
            <h3 className="concluir-modal-title">Concluir asunto</h3>
            <p className="concluir-modal-body">¿Confirmas que este asunto ha sido atendido y puede marcarse como concluido? Esta acción no se puede deshacer.</p>
            <div className="concluir-modal-actions">
              <button className="concluir-btn-cancel" onClick={() => setModalConcluir(false)} disabled={cargando}>
                Cancelar
              </button>
              <button className="concluir-btn-confirm" onClick={handleConfirmar} disabled={cargando}>
                {cargando && <span className="btn-spinner" />}
                {cargando ? 'Concluyendo…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
      <button className="btn-volver-mobile" onClick={onBack} aria-label="Volver a la lista">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Volver a la lista
      </button>

      {/* ── Tarjeta unificada de datos ── */}
      <div className="seccion">
        <div className="sec-header sec-datos">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          {fus.folio || 'Datos del FUS'}
          <span className="dt-header-acciones">
            {puedesComisionar && (
              <button type="button" className="btn-comisionar" onClick={() => setModalComisionar(true)}>
                Comisionar
              </button>
            )}
            <Badge estatus={fus.idComisionado ? fus.estatusParticular : turnado.estatusTitular} />
          </span>
        </div>

        {/* Datos generales */}
        <div className="sec-subseccion">
          <span className="sec-sublabel">Datos generales</span>
          <div className="sec-grid-2">
            <DRow label="Fecha y hora"        value={fmt(fus.fechaHora)} />
            <DRow label="Medio de recepción"  value={fus.idMedioRecepcion?.nombreMedio} />
            <DRow label="Solicitante interno" value={nombreSolicitante} />
          </div>
          {fus.idComisionado && (
            <div className="dt-comisionado-chip">
              <span className="dt-comisionado-avatar">{initialesComisionado(fus.idComisionado.nombre, fus.idComisionado.email)}</span>
              <div className="dt-comisionado-info">
                <span className="dt-comisionado-nombre">{fus.idComisionado.nombre || fus.idComisionado.email}</span>
                <span className="dt-comisionado-direccion">{fus.direccionComisionado || 'Sin dirección asignada'}</span>
              </div>
            </div>
          )}
        </div>

        {fus.fechaLimite && (
          <div className="sec-subseccion sec-subseccion-externo">
            <span className="sec-sublabel sec-sublabel-externo">Límite de respuesta</span>
            <div className="sec-grid-2">
              <DRow label="Fecha y hora" value={fmt(fus.fechaLimite)} />
            </div>
          </div>
        )}

        {/* Descripción */}
        <div className="sec-subseccion">
          <span className="sec-sublabel">Descripción de la solicitud</span>
          <DRow label="Descripción" value={fus.descripcion} tall />
          {fus.contexto && <DRow label="Datos o antecedentes de contexto de la solicitud" value={fus.contexto} tall />}
        </div>

        {/* Solicitante externo */}
        {tieneExterno && (
          <div className="sec-subseccion">
            <span className="sec-sublabel">Datos de contacto de solicitante externo</span>
            <div className="sec-grid-3">
              {fus.nombreExterno   && <DRow label="Nombre"           value={fus.nombreExterno} />}
              {fus.telefonoExterno && <DRow label="Teléfono/Celular" value={fus.telefonoExterno} />}
              {fus.correoExterno   && <DRow label="Correo"           value={fus.correoExterno} />}
            </div>
          </div>
        )}

        {/* Evidencia */}
        <div className="sec-subseccion">
          <span className="sec-sublabel">Evidencia</span>
          <EvidenciaList evidencias={fus.evidencias} />
        </div>

        {/* Prioridad */}
        <div className="sec-subseccion">
          <span className="sec-sublabel">Prioridad</span>
          <PrioridadPills valor={fus.prioridad} criterios={fus.criterios} />
        </div>
      </div>

      {/* ── Seguimientos ── */}
      <Seguimientos turnadoId={turnado.id} concluido={turnado.estatusTitular === 'Concluido'} />

      <div className="dt-historial-row">
        <button className="btn-historial" onClick={() => onVerHistorial(fus.folio)}>
          Ver historial
        </button>
      </div>

      {puedesConcluir && (
        <div className="dt-actions">
          {error && <p className="sec-error" role="alert">{error}</p>}
          <button className="btn-concluir" onClick={handleConcluir} disabled={cargando}>
            {cargando ? 'Concluyendo…' : 'Concluir asunto'}
          </button>
        </div>
      )}

      {puedeAprobarRechazar && (
        <div className="dt-actions dt-actions-comisionado">
          {errorAprobar && <p className="sec-error" role="alert">{errorAprobar}</p>}
          <div className="dt-comisionado-botones">
            <button type="button" className="btn-rechazar" onClick={() => setModalRechazar(true)} disabled={aprobando}>
              Rechazar
            </button>
            <button type="button" className="btn-aprobar" onClick={handleAprobar} disabled={aprobando}>
              {aprobando && <span className="btn-spinner" />}
              {aprobando ? 'Aprobando…' : 'Aprobar'}
            </button>
          </div>
        </div>
      )}

      {fus.estatusParticular === 'Concluido' && fus.idComisionado && (
        <p className="dt-concluido-texto">Solicitud concluida — sin acciones pendientes</p>
      )}

      {modalComisionar && (
        <ComisionarModal
          fusId={fus.id}
          onClose={() => setModalComisionar(false)}
          onConfirmado={(data) => {
            setFusData(data)
            setModalComisionar(false)
            toast.success('Comisionado asignado correctamente.')
          }}
        />
      )}

      {modalRechazar && (
        <RechazarModal
          fusId={fus.id}
          onClose={() => setModalRechazar(false)}
          onRechazado={(data) => {
            setFusData(data)
            setModalRechazar(false)
            toast.success('Solicitud regresada al comisionado.')
          }}
        />
      )}
    </div>
  )
}

/* ── Tarjeta de la lista ── */
function TurnadoCard({ t, activo, onClick, highlight, onVerHistorial }) {
  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  const fus = t.idFus || {}
  return (
    <div className={`fus-card${activo ? ' fus-card-activo' : ''}${highlight ? ' fus-card-highlight' : ''}${fus.slaVencido ? ' fus-card-vencido' : ''}${!fus.slaVencido && fus.slaPorVencer ? ' fus-card-por-vencer' : ''}`} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="fus-card-top">
        <strong className="fus-folio">
          {fus.folio || `Turnado #${t.id}`}
          {fus.slaVencido && <span className="badge-vencido">Vencido</span>}
          {!fus.slaVencido && fus.slaPorVencer && <span className="badge-por-vencer">Por vencer</span>}
        </strong>
        <span className="fus-card-top-actions">
          {fus.folio && (
            <button
              className="fus-card-historial-btn"
              title="Ver historial"
              onClick={e => { e.stopPropagation(); onVerHistorial(fus.folio) }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7"/>
                <path d="M3 5v4h4"/>
                <polyline points="12 7 12 12 15.5 14"/>
              </svg>
            </button>
          )}
          <Badge estatus={t.estatusTitular} />
        </span>
      </div>
      <p className="fus-meta"><b>Fecha:</b> {fmt(fus.fechaHora)}</p>
      <p className="fus-meta"><b>Medio:</b> {fus.idMedioRecepcion?.nombreMedio || '—'}</p>
      {fus.descripcion && <p className="fus-desc">{fus.descripcion.slice(0, 90)}…</p>}
    </div>
  )
}

/* ── Página principal ── */
export default function SolicitudesTurnadas() {
  const [searchParams, setSearchParams] = useSearchParams()
  const folioParam = searchParams.get('folio')

  const { estatus: estatusROL2 } = useEstatus('TITULAR')
  const notifCtx = useNotificaciones()

  const [lista,        setLista]        = useState([])
  const [busqueda,     setBusqueda]     = useState('')
  const [filtro,       setFiltro]       = useState(() => searchParams.get('filtro') || '')
  const [seleccionado, setSeleccionado] = useState(null)
  const [modalTimelineFolio, setModalTimelineFolio] = useState(null)
  const [cargando,     setCargando]     = useState(true)
  const [errorCarga,   setErrorCarga]   = useState(false)
  const [highlightId,  setHighlightId]  = useState(null)
  const [pagina,       setPagina]       = useState(1)
  const [totalItems,   setTotalItems]   = useState(0)
  const PAGE_SIZE = 30
  const reordenadoRef = useRef(false)
  const autoRetriedRef = useRef(false)
  const retryTimeoutRef = useRef(null)

  const cargar = (pag = 1, append = false) => {
    if (reordenadoRef.current) { reordenadoRef.current = false; return }
    setCargando(true)
    const params = { page: pag, page_size: PAGE_SIZE }
    if (!folioParam && filtro)   params.estatusTitular = filtro
    if (!folioParam && busqueda) params.search = busqueda
    api.get('/turnados/mis-turnados/', { params })
      .then(r => {
        setErrorCarga(false)
        autoRetriedRef.current = false
        if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null }
        const items = r.data.results || []
        setTotalItems(r.data.total || 0)
        if (folioParam) {
          const match = items.find(t => t.idFus?.folio === folioParam)
          if (match) {
            setLista([match, ...items.filter(t => t.id !== match.id)])
            setFiltro('')
            setBusqueda('')
            setSeleccionado(match)
            setHighlightId(match.id)
            reordenadoRef.current = true
            setSearchParams({}, { replace: true })
            return
          }
        }
        setLista(prev => append ? [...prev, ...items] : items)
        setPagina(pag)
      })
      .catch(() => {
        setErrorCarga(true)
        if (!autoRetriedRef.current) {
          autoRetriedRef.current = true
          retryTimeoutRef.current = setTimeout(() => cargar(pag, append), 5000)
        }
      })
      .finally(() => setCargando(false))
  }

  useEffect(() => () => { if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current) }, [])

  const cargarMas = () => cargar(pagina + 1, true)

  useEffect(() => { setPagina(1); cargar(1) }, [filtro, busqueda, folioParam])

  /* Refrescar automáticamente cuando llega un nuevo turnado por WebSocket */
  useEffect(() => {
    if (!notifCtx?.turnadoKey) return
    cargar(1)
  }, [notifCtx?.turnadoKey])

  /* En vivo: si llega por WebSocket un aviso de SLA por vencer, el turnado
     correspondiente (si ya está cargado en la lista) se sube al inicio y
     queda marcado como "por vencer" — sin esperar a un refresh manual. */
  const ultimaNotifId = notifCtx?.notifs?.[0]?.id
  useEffect(() => {
    const notif = notifCtx?.notifs?.[0]
    if (!notif || notif.tipo !== 'SLA_POR_VENCER') return
    setLista(prev => {
      const idx = prev.findIndex(t => t.idFus?.folio === notif.fusFolio)
      if (idx === -1) return prev
      const item = { ...prev[idx], idFus: { ...prev[idx].idFus, slaPorVencer: true } }
      return [item, ...prev.slice(0, idx), ...prev.slice(idx + 1)]
    })
  }, [ultimaNotifId])

  const toggleFiltro = f => setFiltro(prev => prev === f ? '' : f)

  /* ── Resize panel izquierdo ── */
  const [panelAbierto, setPanelAbierto] = useState(() => searchParams.get('modo') === 'lista' || Boolean(searchParams.get('filtro')))

  useEffect(() => {
    if (searchParams.get('filtro')) {
      const next = new URLSearchParams(searchParams)
      next.delete('filtro')
      setSearchParams(next, { replace: true })
    }
  }, [])

  useEffect(() => {
    const handleConsultar = () => { setPanelAbierto(true); setSeleccionado(null) }
    window.addEventListener('scs:consultar', handleConsultar)
    return () => window.removeEventListener('scs:consultar', handleConsultar)
  }, [])
  const { leftWidth, containerRef, startResize } = useResizablePanel('st-left-width')

  return (
    <AppLayout>
      <div className={`st-inner${seleccionado ? ' has-detail' : ''}${panelAbierto && !seleccionado ? ' lista-mode' : ''}`} ref={containerRef}>

        {/* ── Panel izquierdo ── */}
        <div className={`st-left${!panelAbierto ? ' panel-cerrado' : ''}`} style={{ width: panelAbierto ? leftWidth : 44 }}>
          <div className="panel-header">
            {panelAbierto && <h3 className="panel-title">Solicitudes turnadas</h3>}
            <button className="panel-toggle" onClick={() => setPanelAbierto(p => !p)} title={panelAbierto ? 'Cerrar panel' : 'Abrir panel'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {panelAbierto
                  ? <polyline points="15 18 9 12 15 6" />
                  : <polyline points="9 18 15 12 9 6" />}
              </svg>
            </button>
          </div>

          <div className={`panel-content${!panelAbierto ? ' panel-content-oculto' : ''}`}>
            <div className="left-search">
              <svg className="search-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                placeholder="Buscar por folio, descripción, contacto, medio…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>

            <div className="left-filtros">
              <button
                className={`filtro-chip${filtro === '' ? ' filtro-chip-active' : ''}`}
                onClick={() => setFiltro('')}
              >
                Todos
              </button>
              {estatusROL2.map(e => (
                <button
                  key={e.clave}
                  className={`filtro-chip filtro-chip-${e.clave.toLowerCase().replace('_', '-')}${filtro === e.clave ? ' filtro-chip-active' : ''}`}
                  onClick={() => toggleFiltro(e.clave)}
                >
                  {e.nombre}
                </button>
              ))}
              <button
                className={`filtro-chip filtro-chip-vencido${filtro === 'Vencido' ? ' filtro-chip-active' : ''}`}
                onClick={() => toggleFiltro('Vencido')}
              >
                Vencido
              </button>
              <button
                className={`filtro-chip filtro-chip-porvencer${filtro === 'PorVencer' ? ' filtro-chip-active' : ''}`}
                onClick={() => toggleFiltro('PorVencer')}
              >
                Por vencer
              </button>
            </div>

            {errorCarga && lista.length > 0 && (
              <div className="banner-error-carga">
                <span>No se pudo actualizar — mostrando la última información disponible.</span>
                <button type="button" onClick={() => cargar(1)}>Reintentar</button>
              </div>
            )}

            <div className="left-lista">
              {cargando && lista.length === 0 && <Spinner overlay={false} label="Cargando solicitudes…" />}
              {!cargando && errorCarga && lista.length === 0 && (
                <div className="empty-state empty-state-error">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="empty-state-title">No se pudo cargar</p>
                  <p className="empty-state-sub">Ocurrió un error al obtener tus solicitudes turnadas.</p>
                  <button type="button" className="btn-reintentar" onClick={() => cargar(1)}>Reintentar</button>
                </div>
              )}
              {!cargando && !errorCarga && lista.length === 0 && (
                <div className="empty-state">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                  <p className="empty-state-title">Sin asignaciones</p>
                  <p className="empty-state-sub">{busqueda || filtro ? 'Ningún FUS coincide con tu búsqueda.' : 'No tienes solicitudes turnadas por atender.'}</p>
                </div>
              )}
              {lista.map(t => (
                <TurnadoCard
                  key={t.id}
                  t={t}
                  activo={seleccionado?.id === t.id}
                  highlight={highlightId === t.id}
                  onClick={() => { setSeleccionado(t); setHighlightId(null); if (window.innerWidth <= 768) setPanelAbierto(false) }}
                  onVerHistorial={setModalTimelineFolio}
                />
              ))}
              {lista.length < totalItems && (
                <button className="btn-cargar-mas" onClick={cargarMas} disabled={cargando}>
                  {cargando && <span className="btn-spinner" />}
                  {cargando ? 'Cargando…' : `Cargar más (${lista.length} de ${totalItems})`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Handle de resize ── */}
        {panelAbierto && (
          <div className="resize-handle" onMouseDown={startResize} onTouchStart={startResize}>
            <span className="resize-dots" />
          </div>
        )}

        {/* ── Panel derecho ── */}
        <div className="st-right">
          {seleccionado
            ? <DetalleTurnado
                key={seleccionado.id}
                turnado={seleccionado}
                onConcluido={() => { cargar(); setSeleccionado(null) }}
                onBack={() => setSeleccionado(null)}
                onVerHistorial={setModalTimelineFolio}
              />
            : (
              <div className="st-hint-select">
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <p>Selecciona una solicitud del panel izquierdo para ver el detalle completo</p>
              </div>
            )
          }
        </div>
      </div>

      {modalTimelineFolio && (
        <ModalTimeline folio={modalTimelineFolio} onClose={() => setModalTimelineFolio(null)} />
      )}
    </AppLayout>
  )
}
