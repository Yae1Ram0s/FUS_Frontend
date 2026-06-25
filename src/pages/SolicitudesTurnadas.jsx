import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import './SolicitudesTurnadas.css'

const FILTROS = ['Recibido', 'En_seguimiento', 'Concluido']

/* ── Hook de conteo animado ── */
function useCountUp(end, duration = 900) {
  const [val, setVal] = useState(0)
  const rafRef = useRef(null)
  useEffect(() => {
    if (!end) { setVal(0); return }
    const startTime = performance.now()
    const tick = now => {
      const p = Math.min((now - startTime) / duration, 1)
      setVal(Math.round(p * end))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [end, duration])
  return val
}

/* ── Tarjeta de estadística ── */
function StatCard({ icon, label, sublabel, value, accent, delay }) {
  const count = useCountUp(value)
  return (
    <div className="stat-card" style={{ '--accent': accent, animationDelay: delay }}>
      <div className="stat-icon-wrap">{icon}</div>
      <div className="stat-body">
        <span className="stat-number">{count}</span>
        <span className="stat-label">{label}</span>
        {sublabel && <span className="stat-sublabel">{sublabel}</span>}
      </div>
    </div>
  )
}

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
          delay="0ms" accent="#9F2241"
          value={stats.pendientes} label="Recibidas" sublabel="Pendientes de atender"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
          }
        />
        <StatCard
          delay="90ms" accent="#A07830"
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
        <div className="table-wrap">
          <table className="seg-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Actividad</th>
                <th>Acción por emprender</th>
                {!concluido && <th></th>}
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td colSpan={concluido ? 3 : 4} style={{ textAlign: 'center', color: 'rgba(100,35,55,0.45)', fontStyle: 'italic' }}>
                    Sin respuestas registradas
                  </td>
                </tr>
              )}
              {lista.map(s => (
                <tr key={s.id}>
                  <td className="td-nowrap">{s.fechaActividad}</td>
                  <td>{s.descripcionActividad}</td>
                  <td>{s.accionTexto || '—'}</td>
                  {!concluido && (
                    <td>
                      <button className="btn-del" onClick={() => eliminar(s.id)} title="Eliminar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/>
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!concluido && (
                <tr className="seg-new-row">
                  <td><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></td>
                  <td><input type="text" placeholder="Describe la actividad…" value={actividad} onChange={e => setActividad(e.target.value)} /></td>
                  <td><input type="text" placeholder="Acción por emprender…" value={accionTexto} onChange={e => setAccionTexto(e.target.value)} /></td>
                  <td>
                    <button className="btn-agregar" onClick={agregar} disabled={loading}>
                      {loading ? '…' : 'Agregar'}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
  const [cargando, setCargando] = useState(false)
  const [error,    setError]    = useState('')
  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  const fus = turnado.idFus || {}
  const puedesConcluir = turnado.estatusTitular !== 'Concluido'

  const handleConcluir = async () => {
    if (!window.confirm('¿Confirmas que este asunto ha sido concluido?')) return
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

  const tieneExterno = fus.solicitante_externo?.nombre || fus.solicitante_externo?.telefono || fus.solicitante_externo?.correo

  return (
    <div className="dt-panel" style={{ position: 'relative' }}>
      {cargando && <Spinner label="Concluyendo asunto…" />}
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
              {fus.solicitante_externo?.nombre   && <DRow label="Nombre"   value={fus.solicitante_externo.nombre} />}
              {fus.solicitante_externo?.telefono && <DRow label="Teléfono" value={fus.solicitante_externo.telefono} />}
              {fus.solicitante_externo?.correo   && <DRow label="Correo"   value={fus.solicitante_externo.correo} />}
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

  const [lista,        setLista]        = useState([])
  const [busqueda,     setBusqueda]     = useState('')
  const [filtro,       setFiltro]       = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [cargando,     setCargando]     = useState(true)
  const [stats,        setStats]        = useState({ concluidas: 0, activas: 0, pendientes: 0 })
  const [highlightId,  setHighlightId]  = useState(null)
  const reordenadoRef = useRef(false)

  const cargarStats = () => {
    api.get('/turnados/mis-turnados/').then(r => {
      const todos = Array.isArray(r.data) ? r.data : r.data.results || []
      setStats({
        concluidas:  todos.filter(t => t.estatusTitular === 'Concluido').length,
        activas:     todos.filter(t => t.estatusTitular === 'En_seguimiento').length,
        pendientes:  todos.filter(t => t.estatusTitular === 'Recibido').length,
      })
    }).catch(() => {})
  }

  const cargar = () => {
    if (reordenadoRef.current) { reordenadoRef.current = false; return }
    setCargando(true)
    const params = {}
    if (!folioParam && filtro)   params.estatusTitular = filtro
    if (!folioParam && busqueda) params.search = busqueda
    api.get('/turnados/mis-turnados/', { params })
      .then(r => {
        const items = Array.isArray(r.data) ? r.data : r.data.results || []
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
        setLista(items)
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargarStats() }, [])
  useEffect(() => { cargar() }, [filtro, busqueda, folioParam])

  const toggleFiltro = f => setFiltro(prev => prev === f ? '' : f)

  return (
    <AppLayout>
      <div className={`st-inner${seleccionado ? ' has-detail' : ''}`}>

        {/* ── Panel izquierdo ── */}
        <div className="st-left">
          <div className="panel-header">
            <h3 className="panel-title">Solicitudes turnadas</h3>
          </div>

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
            {FILTROS.map(f => (
              <button
                key={f}
                className={`filtro-chip filtro-chip-${f.toLowerCase().replace('_', '-')}${filtro === f ? ' filtro-chip-active' : ''}`}
                onClick={() => toggleFiltro(f)}
              >
                {f === 'En_seguimiento' ? 'En seguimiento' : f}
              </button>
            ))}
          </div>

          <div className="left-lista">
            {cargando && <p className="left-msg">Cargando solicitudes…</p>}
            {!cargando && lista.length === 0 && (
              <p className="left-msg">No hay solicitudes turnadas.</p>
            )}
            {lista.map(t => (
              <TurnadoCard
                key={t.id}
                t={t}
                activo={seleccionado?.id === t.id}
                highlight={highlightId === t.id}
                onClick={() => { setSeleccionado(t); setHighlightId(null) }}
              />
            ))}
          </div>
        </div>

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
