import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import StatCard from '../components/StatCard'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import { useEstatus } from '../hooks/useEstatus'
import { useNotificaciones } from '../context/NotificacionesContext'
import { useResizablePanel } from '../hooks/useResizablePanel'
import './SolicitudesTurnadas.css'

/* ── Panel de estadísticas ROL2 ── */
function StatsPanel({ stats }) {
  const { user } = useAuth()
  const nombre = user?.nombre || user?.email || 'Usuario'
  const total  = (stats.pendientes || 0) + (stats.activas || 0) + (stats.concluidas || 0)

  return (
    <div className="std-panel">

      {/* Bienvenida */}
      <div className="std-greeting">
        <div className="std-avatar">{nombre.charAt(0).toUpperCase()}</div>
        <div className="std-greeting-text">
          <span className="std-greeting-hello">Bienvenido(a)</span>
          <span className="std-greeting-name">{nombre}</span>
          <span className="std-greeting-role">Titular / Enlace Estratégico · ANAM</span>
        </div>
        <div className="std-greeting-badge">
          <span className="std-badge-num">{total}</span>
          <span className="std-badge-lbl">Solicitudes turnadas</span>
        </div>
      </div>

      {/* Divisor */}
      <div className="std-divider">
        <span className="std-divider-line" />
        <span className="std-divider-text">Resumen de actividad</span>
        <span className="std-divider-line" />
      </div>

      {/* Métricas */}
      <div className="std-grid">
        <StatCard
          delay="0ms" accent="#235b4e"
          value={stats.pendientes} label="Recibidas" sublabel="Pendientes de atender"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
          }
        />
        <StatCard
          delay="90ms" accent="#c9a227"
          value={stats.activas} label="En seguimiento" sublabel="Con respuesta en proceso"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          }
        />
        <StatCard
          delay="180ms" accent="#1a7a52"
          value={stats.concluidas} label="Concluidas" sublabel="Atendidas y cerradas"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          }
        />
      </div>

      {/* Pista */}
      <div className="std-hint">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Selecciona una solicitud del panel izquierdo para ver el detalle completo
      </div>

    </div>
  )
}

/* ── Sección Respuestas y Seguimiento ── */
function Seguimientos({ turnadoId, concluido }) {
  const [lista,       setLista]       = useState([])
  const hoy = new Date().toISOString().split('T')[0]
  const [fecha,       setFecha]       = useState(hoy)
  const [actividad,   setActividad]   = useState('')
  const [accionTexto, setAccionTexto] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const cargar = () =>
    api.get(`/turnados/${turnadoId}/seguimientos/`).then(r => setLista(r.data)).catch(() => {})

  useEffect(() => { cargar() }, [turnadoId])

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
    try { await api.delete(`/seguimientos/${id}/`); cargar() } catch {}
  }

  return (
    <div className="seccion">
      {loading && <Spinner label="Guardando…" />}
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

        <div className="seg-timeline">
          {lista.length === 0 ? (
            <p className="seg-empty">Sin respuestas registradas aún</p>
          ) : lista.map((s, i) => (
            <div key={s.id} className="seg-tl-item">
              <div className="seg-tl-track">
                <div className="seg-tl-dot" />
                {i < lista.length - 1 && <div className="seg-tl-connector" />}
              </div>
              <div className="seg-tl-content">
                <div className="seg-tl-meta">
                  <span className="seg-tl-fecha">{s.fechaActividad}</span>
                  {!concluido && (
                    <button className="btn-del" onClick={() => eliminar(s.id)} title="Eliminar">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6"/><path d="M14 11v6"/>
                      </svg>
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
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

/* ── Detalle del turnado (ROL2) ── */
function DetalleTurnado({ turnado, onConcluido, onBack }) {
  const [cargando,      setCargando]      = useState(false)
  const [error,         setError]         = useState('')
  const [modalConcluir, setModalConcluir] = useState(false)
  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  const fus = turnado.idFus || {}
  const puedesConcluir = turnado.estatusTitular !== 'Concluido'

  const handleConcluir = () => setModalConcluir(true)

  const handleConfirmar = async () => {
    setModalConcluir(false)
    setCargando(true); setError('')
    try {
      await api.post(`/turnados/${turnado.id}/concluir/`)
      onConcluido()
    } catch (e) {
      setError(e.response?.data?.detail || 'No se pudo concluir. Intenta nuevamente.')
    } finally {
      setCargando(false)
    }
  }

  const tieneExterno = fus.nombreExterno || fus.telefonoExterno || fus.correoExterno

  return (
    <div className="dt-panel" style={{ position: 'relative' }}>
      {cargando && <Spinner label="Concluyendo asunto…" />}

      {modalConcluir && (
        <div className="concluir-overlay" onClick={() => setModalConcluir(false)}>
          <div className="concluir-modal" onClick={e => e.stopPropagation()}>
            <div className="concluir-modal-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>
              </svg>
            </div>
            <h3 className="concluir-modal-title">Concluir asunto</h3>
            <p className="concluir-modal-body">¿Confirmas que este asunto ha sido atendido y puede marcarse como concluido? Esta acción no se puede deshacer.</p>
            <div className="concluir-modal-actions">
              <button className="concluir-btn-cancel" onClick={() => setModalConcluir(false)}>
                Cancelar
              </button>
              <button className="concluir-btn-confirm" onClick={handleConfirmar}>
                Confirmar
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
          <span style={{ marginLeft: 'auto' }}>
            <Badge estatus={turnado.estatusTitular} />
          </span>
        </div>

        {/* Datos generales */}
        <div className="sec-subseccion">
          <span className="sec-sublabel">Datos generales</span>
          <div className="sec-grid-2">
            <DRow label="Fecha y hora"        value={fmt(fus.fechaHora)} />
            <DRow label="Solicitante interno" value={fus.idSolicitanteInterno?.nombre || fus.idSolicitanteInterno?.email} />
            <DRow label="Remitente"           value={turnado.idRemitente ? `${turnado.idRemitente.first_name} ${turnado.idRemitente.last_name}` : undefined} />
            <DRow label="Medio de recepción"  value={fus.idMedioRecepcion?.nombreMedio} />
            <DRow label="Prioridad"           value={fus.prioridad} />
          </div>
        </div>

        {/* Descripción */}
        <div className="sec-subseccion">
          <span className="sec-sublabel">Descripción de la solicitud</span>
          <DRow label="Descripción" value={fus.descripcion} tall />
          {fus.contexto && <DRow label="Contexto" value={fus.contexto} tall />}
        </div>

        {/* Solicitante externo */}
        {tieneExterno && (
          <div className="sec-subseccion sec-subseccion-externo">
            <span className="sec-sublabel sec-sublabel-externo">Solicitante externo</span>
            <div className="sec-grid-3">
              {fus.nombreExterno   && <DRow label="Nombre"   value={fus.nombreExterno} />}
              {fus.telefonoExterno && <DRow label="Teléfono" value={fus.telefonoExterno} />}
              {fus.correoExterno   && <DRow label="Correo"   value={fus.correoExterno} />}
            </div>
          </div>
        )}
      </div>

      {/* ── Seguimientos ── */}
      <Seguimientos turnadoId={turnado.id} concluido={turnado.estatusTitular === 'Concluido'} />

      {puedesConcluir && (
        <div className="dt-actions">
          {error && <p className="sec-error" role="alert">{error}</p>}
          <button className="btn-concluir" onClick={handleConcluir} disabled={cargando}>
            {cargando ? 'Concluyendo…' : 'Concluir asunto'}
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Tarjeta de la lista ── */
function TurnadoCard({ t, activo, onClick, highlight }) {
  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  const fus = t.idFus || {}
  return (
    <div className={`fus-card${activo ? ' fus-card-activo' : ''}${highlight ? ' fus-card-highlight' : ''}`} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="fus-card-top">
        <strong className="fus-folio">{fus.folio || `Turnado #${t.id}`}</strong>
        <Badge estatus={t.estatusTitular} />
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
  const [filtro,       setFiltro]       = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [cargando,     setCargando]     = useState(true)
  const [stats,        setStats]        = useState({ concluidas: 0, activas: 0, pendientes: 0 })
  const [highlightId,  setHighlightId]  = useState(null)
  const [pagina,       setPagina]       = useState(1)
  const [totalItems,   setTotalItems]   = useState(0)
  const PAGE_SIZE = 30
  const reordenadoRef = useRef(false)

  const cargarStats = () => {
    api.get('/turnados/mis-turnados/', { params: { page: 1, page_size: 500 } }).then(r => {
      const todos = r.data.results || []
      setStats({
        concluidas:  todos.filter(t => t.estatusTitular === 'Concluido').length,
        activas:     todos.filter(t => t.estatusTitular === 'En_seguimiento').length,
        pendientes:  todos.filter(t => t.estatusTitular === 'Recibido').length,
      })
    }).catch(() => {})
  }

  const cargar = (pag = 1, append = false) => {
    if (reordenadoRef.current) { reordenadoRef.current = false; return }
    setCargando(true)
    const params = { page: pag, page_size: PAGE_SIZE }
    if (!folioParam && filtro)   params.estatusTitular = filtro
    if (!folioParam && busqueda) params.search = busqueda
    api.get('/turnados/mis-turnados/', { params })
      .then(r => {
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
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  const cargarMas = () => cargar(pagina + 1, true)

  useEffect(() => { cargarStats() }, [])
  useEffect(() => { setPagina(1); cargar(1) }, [filtro, busqueda, folioParam])

  /* Refrescar automáticamente cuando llega un nuevo turnado por WebSocket */
  useEffect(() => {
    if (!notifCtx?.turnadoKey) return
    cargar(1)
    cargarStats()
  }, [notifCtx?.turnadoKey])

  const toggleFiltro = f => setFiltro(prev => prev === f ? '' : f)

  /* ── Resize panel izquierdo ── */
  const [panelAbierto, setPanelAbierto] = useState(() => window.innerWidth > 768)

  useEffect(() => {
    const handleInicio = () => { setPanelAbierto(false); setSeleccionado(null) }
    const handleConsultar = () => { setPanelAbierto(true) }
    window.addEventListener('scs:inicio', handleInicio)
    window.addEventListener('scs:consultar', handleConsultar)
    return () => {
      window.removeEventListener('scs:inicio', handleInicio)
      window.removeEventListener('scs:consultar', handleConsultar)
    }
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
                placeholder="Buscar por folio, descripción…"
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
            </div>

            <div className="left-lista">
              {cargando && <Spinner overlay={false} label="Cargando solicitudes…" />}
              {!cargando && lista.length === 0 && (
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
                />
              ))}
              {!cargando && lista.length < totalItems && (
                <button className="btn-cargar-mas" onClick={cargarMas}>
                  Cargar más ({lista.length} de {totalItems})
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
                turnado={seleccionado}
                onConcluido={() => { cargar(); cargarStats(); setSeleccionado(null) }}
                onBack={() => setSeleccionado(null)}
              />
            : <StatsPanel stats={stats} />
          }
        </div>
      </div>
    </AppLayout>
  )
}
