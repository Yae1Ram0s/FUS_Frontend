import { useState, useEffect, useRef } from 'react'
import AppLayout from '../components/AppLayout'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import FinalizarModal from '../components/Comisionado/FinalizarModal'
import api from '../api/api'
import { useResizablePanel } from '../hooks/useResizablePanel'
import { useEvidenciaUrl } from '../hooks/useEvidenciaUrl'
import { useToast } from '../context/ToastContext'
import './FUSComisionados.css'

const fmtHora = d => d
  ? new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  : ''

const TIPO_SEGUIMIENTO_INFO = {
  accion_por_emprender: { label: 'Acción por emprender', clase: 'fc-tag-azul' },
  avance:               { label: 'Avance',                clase: 'fc-tag-verde' },
  finalizacion:         { label: 'Finalización',           clase: 'fc-tag-verde' },
  rechazo:              { label: 'Rechazo',                clase: 'fc-tag-rojo' },
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

function esImagen(mime) { return mime && mime.startsWith('image/') }

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

function EvidenciaList({ evidencias }) {
  if (!evidencias?.length) return (
    <div className="drow"><span className="drow-label">Evidencia</span><span className="drow-value">—</span></div>
  )
  return <div className="ev-lista">{evidencias.map(ev => <EvidenciaItem key={ev.id} ev={ev} />)}</div>
}

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
          <span key={p.valor} className={`dt-prioridad-pill${valor === p.valor ? ' dt-prioridad-pill-selected' : ''}`} style={{ '--c': p.color }}>
            {p.valor}
          </span>
        ))}
      </div>
      {listaCriterios.length > 0 && (
        <ul className="dt-criterios-lista">{listaCriterios.map((c, i) => <li key={i}>{c}</li>)}</ul>
      )}
    </div>
  )
}

/* ── Feed de Respuestas y seguimiento (comisionado) ── */
function SeguimientoComisionado({ fusId, estatusParticular, onFinalizado }) {
  const [lista, setLista]           = useState([])
  const [cargando, setCargando]     = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [tipo, setTipo]             = useState('avance')
  const [contenido, setContenido]   = useState('')
  const [enviando, setEnviando]     = useState(false)
  const [error, setError]           = useState('')
  const [modalFinalizar, setModalFinalizar] = useState(false)
  const autoRetriedRef  = useRef(false)
  const retryTimeoutRef = useRef(null)
  const toast = useToast()

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

  const agregar = async () => {
    if (!contenido.trim()) { setError('Escribe una descripción antes de agregar.'); return }
    setError(''); setEnviando(true)
    try {
      await api.post(`/fus/${fusId}/seguimiento/`, { tipo, contenido })
      setContenido('')
      cargar()
    } catch (e) {
      setError(e.response?.data?.detail || 'No se pudo registrar. Intenta nuevamente.')
    } finally {
      setEnviando(false)
    }
  }

  const puedeAgregar = estatusParticular === 'En_seguimiento'

  return (
    <div className="seccion">
      <div className="sec-header sec-resp">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Respuestas y seguimiento
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
            <p className="seg-empty">Sin respuestas registradas aún</p>
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

        {puedeAgregar && (
          <div className="seg-nueva fc-seg-nueva">
            <div className="fc-seg-nueva-fila">
              <select className="fc-tipo-select" value={tipo} onChange={e => setTipo(e.target.value)}>
                <option value="avance">Avance</option>
                <option value="accion_por_emprender">Acción por emprender</option>
              </select>
            </div>
            <textarea
              className="fc-seg-textarea"
              placeholder="Describe el avance o la acción por emprender…"
              value={contenido}
              onChange={e => setContenido(e.target.value)}
              rows={2}
            />
            <button className="btn-agregar" onClick={agregar} disabled={enviando}>
              {enviando ? 'Guardando…' : 'Agregar'}
            </button>
          </div>
        )}

        {error && <p className="sec-error" role="alert">{error}</p>}

        {puedeAgregar && (
          <div className="fc-finalizar-row">
            <button type="button" className="btn-concluir" onClick={() => setModalFinalizar(true)}>
              Finalizar seguimiento
            </button>
          </div>
        )}

        {estatusParticular === 'Concluido' && (
          <p className="dt-concluido-texto">Solicitud concluida — sin acciones pendientes</p>
        )}
      </div>

      {modalFinalizar && (
        <FinalizarModal
          fusId={fusId}
          onClose={() => setModalFinalizar(false)}
          onFinalizado={(data) => {
            setModalFinalizar(false)
            toast.success('Seguimiento finalizado, enviado al Titular.')
            onFinalizado(data)
          }}
        />
      )}
    </div>
  )
}

/* ── Detalle de FUS comisionado ── */
function DetalleFUSComisionado({ fus, onBack, onActualizado }) {
  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  const tieneExterno = fus.nombreExterno || fus.telefonoExterno || fus.correoExterno
  const nombreSolicitante = fus.idSolicitanteInterno?.nombre

  return (
    <div className="dt-panel">
      <button className="btn-volver-mobile" onClick={onBack} aria-label="Volver a la lista">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Volver a la lista
      </button>

      <div className="seccion">
        <div className="sec-header sec-datos">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          {fus.folio}
          <span style={{ marginLeft: 'auto' }}><Badge estatus={fus.estatusParticular} /></span>
        </div>

        <div className="sec-subseccion">
          <span className="sec-sublabel">Datos generales</span>
          <div className="sec-grid-2">
            <DRow label="Fecha y hora"        value={fmt(fus.fechaHora)} />
            <DRow label="Medio de recepción"  value={fus.idMedioRecepcion?.nombreMedio} />
            <DRow label="Solicitante interno" value={nombreSolicitante} />
          </div>
        </div>

        <div className="sec-subseccion">
          <span className="sec-sublabel">Descripción de la solicitud</span>
          <DRow label="Descripción" value={fus.descripcion} tall />
          {fus.contexto && <DRow label="Datos o antecedentes de contexto de la solicitud" value={fus.contexto} tall />}
        </div>

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

        <div className="sec-subseccion">
          <span className="sec-sublabel">Evidencia</span>
          <EvidenciaList evidencias={fus.evidencias} />
        </div>

        <div className="sec-subseccion">
          <span className="sec-sublabel">Prioridad</span>
          <PrioridadPills valor={fus.prioridad} criterios={fus.criterios} />
        </div>
      </div>

      <SeguimientoComisionado
        fusId={fus.id}
        estatusParticular={fus.estatusParticular}
        onFinalizado={onActualizado}
      />
    </div>
  )
}

/* ── Tarjeta de la lista ── */
function FUSCard({ f, activo, onClick }) {
  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  return (
    <div className={`fus-card${activo ? ' fus-card-activo' : ''}`} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="fus-card-top">
        <strong className="fus-folio">{f.folio}</strong>
        <span className="fus-card-top-actions"><Badge estatus={f.estatusParticular} /></span>
      </div>
      <p className="fus-meta"><b>Asignado:</b> {fmt(f.fechaAsignacion)}</p>
      <p className="fus-meta"><b>Medio:</b> {f.idMedioRecepcion?.nombreMedio || '—'}</p>
      {f.descripcion && <p className="fus-desc">{f.descripcion.slice(0, 90)}…</p>}
    </div>
  )
}

/* ── Página principal ── */
export default function FUSComisionados() {
  const [lista,        setLista]        = useState([])
  const [busqueda,     setBusqueda]     = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [cargando,     setCargando]     = useState(true)
  const [errorCarga,   setErrorCarga]   = useState(false)
  const [pagina,       setPagina]       = useState(1)
  const [totalItems,   setTotalItems]   = useState(0)
  const PAGE_SIZE = 30
  const autoRetriedRef = useRef(false)
  const retryTimeoutRef = useRef(null)

  const cargar = (pag = 1, append = false) => {
    setCargando(true)
    const params = { page: pag, page_size: PAGE_SIZE }
    if (busqueda) params.search = busqueda
    api.get('/fus/mis-comisionados/', { params })
      .then(r => {
        setErrorCarga(false)
        autoRetriedRef.current = false
        if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null }
        const items = r.data.results || []
        setTotalItems(r.data.total || 0)
        setLista(prev => append ? [...prev, ...items] : items)
        setPagina(pag)
        setSeleccionado(prev => {
          if (!prev) return prev
          const actualizado = items.find(f => f.id === prev.id)
          return actualizado || prev
        })
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

  useEffect(() => { cargar(1) }, [busqueda])
  useEffect(() => () => { if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current) }, [])

  const cargarMas = () => cargar(pagina + 1, true)

  const [panelAbierto, setPanelAbierto] = useState(() => window.innerWidth > 768)
  const { leftWidth, containerRef, startResize } = useResizablePanel('fc-left-width')

  return (
    <AppLayout>
      <div className={`st-inner${seleccionado ? ' has-detail' : ''}${panelAbierto && !seleccionado ? ' lista-mode' : ''}`} ref={containerRef}>

        <div className={`st-left${!panelAbierto ? ' panel-cerrado' : ''}`} style={{ width: panelAbierto ? leftWidth : 44 }}>
          <div className="panel-header">
            {panelAbierto && <h3 className="panel-title">FUS Comisionados</h3>}
            <button className="panel-toggle" onClick={() => setPanelAbierto(p => !p)} title={panelAbierto ? 'Cerrar panel' : 'Abrir panel'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {panelAbierto ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
              </svg>
            </button>
          </div>

          <div className={`panel-content${!panelAbierto ? ' panel-content-oculto' : ''}`}>
            <div className="left-search">
              <svg className="search-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input placeholder="Buscar por folio o descripción…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>

            {errorCarga && lista.length > 0 && (
              <div className="banner-error-carga">
                <span>No se pudo actualizar — mostrando la última información disponible.</span>
                <button type="button" onClick={() => cargar(1)}>Reintentar</button>
              </div>
            )}

            <div className="left-lista">
              {cargando && lista.length === 0 && <Spinner overlay={false} label="Cargando FUS comisionados…" />}
              {!cargando && errorCarga && lista.length === 0 && (
                <div className="empty-state empty-state-error">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="empty-state-title">No se pudo cargar</p>
                  <p className="empty-state-sub">Ocurrió un error al obtener tus FUS comisionados.</p>
                  <button type="button" className="btn-reintentar" onClick={() => cargar(1)}>Reintentar</button>
                </div>
              )}
              {!cargando && !errorCarga && lista.length === 0 && (
                <div className="empty-state">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                  <p className="empty-state-title">Sin asignaciones</p>
                  <p className="empty-state-sub">{busqueda ? 'Ningún FUS coincide con tu búsqueda.' : 'No tienes FUS comisionados por atender.'}</p>
                </div>
              )}
              {lista.map(f => (
                <FUSCard key={f.id} f={f} activo={seleccionado?.id === f.id}
                  onClick={() => { setSeleccionado(f); if (window.innerWidth <= 768) setPanelAbierto(false) }} />
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

        {panelAbierto && (
          <div className="resize-handle" onMouseDown={startResize} onTouchStart={startResize}>
            <span className="resize-dots" />
          </div>
        )}

        <div className="st-right">
          {seleccionado
            ? <DetalleFUSComisionado
                fus={seleccionado}
                onBack={() => setSeleccionado(null)}
                onActualizado={(data) => { setSeleccionado(data); cargar(1) }}
              />
            : (
              <div className="st-hint-select">
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <p>Selecciona un FUS del panel izquierdo para ver el detalle completo</p>
              </div>
            )
          }
        </div>
      </div>
    </AppLayout>
  )
}
