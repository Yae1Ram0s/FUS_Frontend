import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import './ConsultarFUS.css'

const FILTROS_ROL1 = ['Registrado', 'Turnado', 'Atendido', 'Concluido']

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
function StatCard({ icon, label, sublabel, value, accent, delay, live }) {
  const count = useCountUp(value)
  return (
    <div className="stat-card" style={{ '--accent': accent, animationDelay: delay }}>
      <div className="stat-icon-wrap">{icon}</div>
      <div className="stat-body">
        <div className="stat-number-row">
          <span className="stat-number">{count}</span>
          {live && <span className="stat-live-dot" title="Actualización en tiempo real" />}
        </div>
        <span className="stat-label">{label}</span>
        {sublabel && <span className="stat-sublabel">{sublabel}</span>}
      </div>
    </div>
  )
}

/* ── Panel de estadísticas ROL1 ── */
function StatsPanel({ stats }) {
  const { user } = useAuth()
  const nombre = user?.nombre || user?.email || 'Usuario'
  const total  = (stats.pendientes || 0) + (stats.turnadas || 0) + (stats.atendidas || 0) + (stats.concluidas || 0)

  return (
    <div className="std-panel">

      {/* Bienvenida */}
      <div className="std-greeting">
        <div className="std-avatar">{nombre.charAt(0).toUpperCase()}</div>
        <div className="std-greeting-text">
          <span className="std-greeting-hello">Bienvenido(a)</span>
          <span className="std-greeting-name">{nombre}</span>
          <span className="std-greeting-role">Particular del Titular · ANAM</span>
        </div>
        <div className="std-greeting-badge">
          <span className="std-badge-num">{total}</span>
          <span className="std-badge-lbl">FUS registradas</span>
        </div>
      </div>

      {/* Divisor */}
      <div className="std-divider">
        <span className="std-divider-line" />
        <span className="std-divider-text">Resumen de solicitudes</span>
        <span className="std-divider-line" />
      </div>

      {/* Métricas 2×2 */}
      <div className="std-grid std-grid-2x2">
        <StatCard
          delay="0ms" accent="#9F2241"
          value={stats.pendientes} label="Registradas" sublabel="En espera de trámite"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          }
        />
        <StatCard
          delay="80ms" accent="#C0512A"
          value={stats.turnadas} label="Turnadas" sublabel="Enviadas al área responsable"
          live
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          }
        />
        <StatCard
          delay="160ms" accent="#A07830"
          value={stats.atendidas} label="En atención" sublabel="Con respuesta en proceso"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          }
        />
        <StatCard
          delay="240ms" accent="#1a7a52"
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

/* ── Modal Turnar ── */
function ModalTurnar({ fus, onClose, onDone }) {
  const [usuarios, setUsuarios] = useState([])
  const [medios,   setMedios]   = useState([])
  const [selUser,  setSelUser]  = useState('')
  const [selMedio, setSelMedio] = useState('')
  const [texto,    setTexto]    = useState('')
  const [lista,    setLista]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    api.get('/auth/usuarios-rol2/').then(r => setUsuarios(r.data)).catch(() => {})
    api.get('/catalogos/medios/?paraTurnado=1').then(r => setMedios(r.data)).catch(() => {})
  }, [])

  const agregar = () => {
    if (!selUser || !selMedio) return
    const u = usuarios.find(u => String(u.id) === String(selUser))
    const m = medios.find(m => String(m.id) === String(selMedio))
    if (!u || !m) return
    setLista(l => [...l, {
      userId: u.id,
      nombre: `${u.first_name} ${u.last_name}`,
      medioId: m.id,
      medioNombre: m.nombreMedio,
    }])
    setSelUser(''); setSelMedio('')
  }

  const quitar = idx => setLista(l => l.filter((_, i) => i !== idx))

  const handleTurnar = async () => {
    if (!lista.length || !texto.trim()) {
      setError('Agrega al menos un destinatario y escribe el texto de la solicitud.')
      return
    }
    setError(''); setLoading(true)
    try {
      await api.post(`/fus/${fus.id}/turnar/`, {
        destinatarios: lista.map(l => ({ idDestinatario: l.userId, idMedio: l.medioId })),
        solicitudTexto: texto,
      })
      onDone()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo turnar. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        {loading && <Spinner label="Turnando solicitud…" />}
        <div className="modal-header">
          <h3 className="modal-title">Turnar solicitud</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-fila">
            <label htmlFor="modal-user">Titular / Enlace estratégico</label>
            <div className="modal-row-inline">
              <select id="modal-user" value={selUser} onChange={e => setSelUser(e.target.value)}>
                <option value="">Selecciona un destinatario</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-fila">
            <label htmlFor="modal-medio">Medio de envío</label>
            <div className="modal-row-inline">
              <select id="modal-medio" value={selMedio} onChange={e => setSelMedio(e.target.value)}>
                <option value="">Selecciona un medio</option>
                {medios.map(m => <option key={m.id} value={m.id}>{m.nombreMedio}</option>)}
              </select>
              <button type="button" className="btn-add-dest" onClick={agregar} title="Agregar destinatario">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          </div>

          {lista.length > 0 && (
            <div className="dest-table-wrap">
              <table className="dest-table">
                <thead>
                  <tr>
                    <th>Destinatario</th>
                    <th>Medio</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((d, i) => (
                    <tr key={i}>
                      <td>{d.nombre}</td>
                      <td>{d.medioNombre}</td>
                      <td>
                        <button className="btn-del" onClick={() => quitar(i)} title="Quitar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="modal-fila">
            <label htmlFor="modal-texto">Texto de la solicitud</label>
            <textarea
              id="modal-texto"
              rows={5}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Describe el asunto o instrucciones para el destinatario..."
            />
          </div>

          {error && <p className="modal-error" role="alert">{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-turnar" onClick={handleTurnar} disabled={loading}>
            {loading ? 'Turnando...' : 'Turnar solicitud'}
          </button>
        </div>
      </div>
    </div>
  )
}

const MEDIA_BASE = `http://${window.location.hostname}:8000`

function esImagen(mime) {
  return mime && mime.startsWith('image/')
}

/* ── Fila de detalle ── */
function Row({ label, value, tall }) {
  return (
    <div className={`det-row${tall ? ' det-row-tall' : ''}`}>
      <span className="det-label">{label}</span>
      <span className="det-value">{value || '—'}</span>
    </div>
  )
}

/* ── Lista de evidencias ── */
function EvidenciaList({ evidencias }) {
  if (!evidencias?.length) return (
    <div className="det-row">
      <span className="det-label">Evidencia</span>
      <span className="det-value">—</span>
    </div>
  )

  return (
    <div className="det-row det-row-evidencia">
      <span className="det-label">Evidencia</span>
      <div className="ev-lista">
        {evidencias.map(ev => {
          const url = `${MEDIA_BASE}/media/${ev.rutaArchivo}`
          const imagen = esImagen(ev.tipoMime)
          return (
            <a
              key={ev.id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="ev-item"
              title={ev.nombreArchivo}
            >
              {imagen ? (
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
            </a>
          )
        })}
      </div>
    </div>
  )
}

const ESTATUS_TURNADO_LABEL = {
  Recibido:       { label: 'Recibido',       color: '#b45309' },
  En_seguimiento: { label: 'En seguimiento', color: '#1d4ed8' },
  Concluido:      { label: 'Concluido',      color: '#15803d' },
}

/* ── Timeline de actividad ── */
function TimelineActividad({ fusId }) {
  const [turnados, setTurnados] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    api.get(`/fus/${fusId}/actividad/`)
      .then(r => setTurnados(r.data))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [fusId])

  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  const fmtFecha = d => d
    ? new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'

  if (cargando) return <p className="act-msg">Cargando actividad…</p>
  if (!turnados.length) return <p className="act-msg">Sin actividad registrada aún.</p>

  return (
    <div className="act-timeline">
      {turnados.map((t, ti) => {
        const meta = ESTATUS_TURNADO_LABEL[t.estatusTitular] || { label: t.estatusTitular, color: '#6b7280' }
        return (
          <div key={t.id} className="act-turnado">
            <div className="act-turnado-header">
              <div className="act-turnado-dot" />
              <div className="act-turnado-info">
                <span className="act-turnado-dest">
                  {t.idDestinatario?.first_name} {t.idDestinatario?.last_name}
                </span>
                <span className="act-turnado-fecha">{fmt(t.fechaHoraTurnado)}</span>
                <span className="act-estatus-pill" style={{ '--c': meta.color }}>{meta.label}</span>
              </div>
            </div>
            {t.solicitudTexto && (
              <p className="act-solicitud-txt">"{t.solicitudTexto}"</p>
            )}

            {/* Seguimientos */}
            {t.seguimientos?.length > 0 && (
              <div className="act-section">
                <p className="act-section-title act-title-respuesta">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Respuestas y seguimiento
                </p>
                {t.seguimientos.map(s => (
                  <div key={s.id} className="act-seg">
                    <div className="act-seg-fecha">{fmtFecha(s.fechaActividad)}</div>
                    <p className="act-seg-desc">{s.descripcionActividad}</p>
                    {s.accionTexto && (
                      <p className="act-seg-accion">→ {s.accionTexto}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Acciones */}
            {t.acciones?.length > 0 && (
              <div className="act-section">
                <p className="act-section-title act-title-accion">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="9 11 12 14 22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                  Acciones por emprender
                </p>
                <ol className="act-acciones">
                  {t.acciones.map(a => (
                    <li key={a.id} className={`act-accion${a.completada ? ' act-accion-ok' : ''}`}>
                      <span className="act-accion-check">{a.completada ? '✓' : '○'}</span>
                      {a.descripcion}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {t.seguimientos?.length === 0 && t.acciones?.length === 0 && (
              <p className="act-sin-resp">Pendiente de respuesta del titular.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Panel de detalle FUS ── */
function DetalleFUS({ fus, onTurnar, onBack }) {
  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  const puedesTurnar   = fus.estatusParticular === 'Registrado' || fus.estatusParticular === 'Turnado'
  const tieneActividad = fus.estatusParticular !== 'Registrado'
  const tieneExterno   = fus.solicitante_externo?.nombre || fus.solicitante_externo?.telefono || fus.solicitante_externo?.correo

  return (
    <div className="detalle-panel">

      {/* ── Cabecera ── */}
      <div className="detalle-header">
        <button className="btn-volver-mobile" onClick={onBack} aria-label="Volver">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Volver
        </button>
        <div className="detalle-header-main">
          <div>
            <h2 className="detalle-title">Detalle de la solicitud</h2>
            <span className="detalle-folio">{fus.folio}</span>
          </div>
          <Badge estatus={fus.estatusParticular} />
        </div>
      </div>

      {/* ── Sección: Datos generales ── */}
      <div className="det-section">
        <span className="det-section-legend">Datos generales</span>
        <div className="det-grid-2">
          <Row label="Fecha y hora"        value={fmt(fus.fechaHora)} />
          <Row label="Solicitante interno" value={fus.idSolicitanteInterno?.nombre || fus.idSolicitanteInterno?.email} />
        </div>
      </div>

      {/* ── Sección: Descripción de la solicitud ── */}
      <div className="det-section">
        <span className="det-section-legend">Descripción de la solicitud</span>
        <Row label="Descripción" value={fus.descripcion} tall />
        {fus.contexto && <Row label="Contexto" value={fus.contexto} tall />}
      </div>

      {/* ── Sección: Solicitante externo ── */}
      {tieneExterno && (
        <div className="det-section">
          <span className="det-section-legend">Solicitante externo</span>
          <div className="det-grid-3">
            {fus.solicitante_externo?.nombre   && <Row label="Nombre"    value={fus.solicitante_externo.nombre} />}
            {fus.solicitante_externo?.telefono && <Row label="Teléfono"  value={fus.solicitante_externo.telefono} />}
            {fus.solicitante_externo?.correo   && <Row label="Correo"    value={fus.solicitante_externo.correo} />}
          </div>
        </div>
      )}

      {/* ── Sección: Clasificación ── */}
      <div className="det-section">
        <span className="det-section-legend">Clasificación</span>
        <div className="det-grid-2">
          <Row label="Medio de recepción" value={fus.idMedioRecepcion?.nombreMedio} />
          <Row label="Prioridad"          value={fus.prioridad} />
        </div>
        <EvidenciaList evidencias={fus.evidencias} />
      </div>

      {/* ── Sección: Actividad ── */}
      {tieneActividad && (
        <div className="det-section">
          <span className="det-section-legend det-section-legend-activity">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Actividad y respuestas
          </span>
          <TimelineActividad fusId={fus.id} />
        </div>
      )}

      {puedesTurnar && (
        <div className="detalle-footer">
          <button className="btn-turnar" onClick={() => onTurnar(fus)}>
            Turnar solicitud
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Tarjeta en la lista ── */
function FusCard({ fus, activo, onClick, highlight }) {
  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  return (
    <div className={`fus-card${activo ? ' fus-card-activo' : ''}${highlight ? ' fus-card-highlight' : ''}`} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="fus-card-top">
        <strong className="fus-folio">{fus.folio}</strong>
        <Badge estatus={fus.estatusParticular} />
      </div>
      <p className="fus-meta"><b>Fecha:</b> {fmt(fus.fechaHora)}</p>
      <p className="fus-meta"><b>Medio:</b> {fus.idMedioRecepcion?.nombreMedio || '—'}</p>
      {fus.descripcion && <p className="fus-desc">{fus.descripcion.slice(0, 90)}…</p>}
    </div>
  )
}

/* ── Página principal ── */
export default function ConsultarFUS() {
  const [searchParams, setSearchParams] = useSearchParams()
  const folioParam = searchParams.get('folio')

  const [lista,        setLista]        = useState([])
  const [busqueda,     setBusqueda]     = useState('')
  const [filtro,       setFiltro]       = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [turnarFUS,    setTurnarFUS]    = useState(null)
  const [cargando,     setCargando]     = useState(true)
  const [stats,        setStats]        = useState({ concluidas: 0, turnadas: 0, atendidas: 0, pendientes: 0 })
  const [highlightId,  setHighlightId]  = useState(null)
  const reordenadoRef = useRef(false)

  const cargarStats = () => {
    api.get('/fus/').then(r => {
      const todos = Array.isArray(r.data) ? r.data : r.data.results || []
      setStats({
        pendientes: todos.filter(f => f.estatusParticular === 'Registrado').length,
        turnadas:   todos.filter(f => f.estatusParticular === 'Turnado').length,
        atendidas:  todos.filter(f => f.estatusParticular === 'Atendido').length,
        concluidas: todos.filter(f => f.estatusParticular === 'Concluido').length,
      })
    }).catch(() => {})
  }

  const cargar = () => {
    if (reordenadoRef.current) { reordenadoRef.current = false; return }
    setCargando(true)
    const params = {}
    if (!folioParam && filtro)   params.estatusParticular = filtro
    if (!folioParam && busqueda) params.search = busqueda
    api.get('/fus/', { params })
      .then(r => {
        const items = Array.isArray(r.data) ? r.data : r.data.results || []
        if (folioParam) {
          const match = items.find(f => f.folio === folioParam)
          if (match) {
            setLista([match, ...items.filter(f => f.id !== match.id)])
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

  useEffect(() => {
    cargarStats()
    const interval = setInterval(cargarStats, 30_000)
    return () => clearInterval(interval)
  }, [])
  useEffect(() => { cargar() }, [filtro, busqueda, folioParam])

  const handleTurnarDone = () => {
    setTurnarFUS(null)
    setSeleccionado(null)
    cargar()
    cargarStats()
  }

  const toggleFiltro = f => setFiltro(prev => prev === f ? '' : f)

  return (
    <AppLayout>
      <div className={`cfus-inner${seleccionado ? ' has-detail' : ''}`}>

        {/* ── Panel izquierdo ── */}
        <div className="cfus-left">
          <div className="panel-header">
            <h3 className="panel-title">Solicitudes FUS</h3>
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
            {FILTROS_ROL1.map(f => (
              <button
                key={f}
                className={`filtro-chip filtro-chip-${f.toLowerCase()}${filtro === f ? ' filtro-chip-active' : ''}`}
                onClick={() => toggleFiltro(f)}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="left-lista">
            {cargando && <p className="left-msg">Cargando solicitudes…</p>}
            {!cargando && lista.length === 0 && (
              <p className="left-msg">No se encontraron solicitudes.</p>
            )}
            {lista.map(f => (
              <FusCard
                key={f.id}
                fus={f}
                activo={seleccionado?.id === f.id}
                highlight={highlightId === f.id}
                onClick={() => { setSeleccionado(f); setHighlightId(null) }}
              />
            ))}
          </div>
        </div>

        {/* ── Panel derecho ── */}
        <div className="cfus-right">
          {seleccionado
            ? <DetalleFUS
                fus={seleccionado}
                onTurnar={f => setTurnarFUS(f)}
                onBack={() => setSeleccionado(null)}
              />
            : <StatsPanel stats={stats} />
          }
        </div>
      </div>

      {turnarFUS && (
        <ModalTurnar
          fus={turnarFUS}
          onClose={() => setTurnarFUS(null)}
          onDone={handleTurnarDone}
        />
      )}
    </AppLayout>
  )
}
