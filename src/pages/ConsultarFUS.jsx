import { useState, useEffect, useRef } from 'react'
import AppLayout from '../components/AppLayout'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import api from '../api/api'
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
function StatCard({ icon, label, value, accent, delay }) {
  const count = useCountUp(value)
  return (
    <div className="stat-card" style={{ '--accent': accent, animationDelay: delay }}>
      <div className="stat-icon-wrap">{icon}</div>
      <div className="stat-body">
        <span className="stat-number">{count}</span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-bar">
        <div className="stat-bar-fill" style={{ width: value > 0 ? '100%' : '0%' }} />
      </div>
    </div>
  )
}

/* ── Panel de estadísticas ROL1 ── */
function StatsPanel({ stats }) {
  return (
    <div className="std-panel">
      <div className="std-header">
        <h2 className="std-title">Panel de control</h2>
        <p className="std-sub">Resumen de tus solicitudes FUS</p>
      </div>

      <div className="std-grid">
        <StatCard
          delay="0ms"
          accent="#15803d"
          value={stats.concluidas}
          label="Concluidas"
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          }
        />
        <StatCard
          delay="120ms"
          accent="#9F2241"
          value={stats.activas}
          label="Solicitudes activas"
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          }
        />
        <StatCard
          delay="240ms"
          accent="#b45309"
          value={stats.pendientes}
          label="Pendientes"
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          }
        />
      </div>

      <div className="std-hint">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        Selecciona una solicitud del panel izquierdo para ver el detalle
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

/* ── Fila de detalle ── */
function Row({ label, value }) {
  return (
    <div className="det-row">
      <span className="det-label">{label}</span>
      <span className="det-value">{value || '—'}</span>
    </div>
  )
}

/* ── Panel de detalle FUS ── */
function DetalleFUS({ fus, onTurnar, onBack }) {
  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  const puedesTurnar = fus.estatusParticular === 'Registrado' || fus.estatusParticular === 'Turnado'

  return (
    <div className="detalle-panel">
      <div className="detalle-header">
        <div className="detalle-header-left">
          <button className="btn-volver-mobile" onClick={onBack} aria-label="Volver a la lista">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Volver
          </button>
          <h2 className="detalle-title">Detalle de solicitud</h2>
        </div>
        <Badge estatus={fus.estatusParticular} />
      </div>
      <div className="detalle-body">
        <Row label="Folio"                     value={fus.folio} />
        <Row label="Fecha y hora"              value={fmt(fus.fechaHora)} />
        <Row label="Solicitante interno"       value={fus.idSolicitanteInterno?.nombre || fus.idSolicitanteInterno?.email} />
        <Row label="Descripción"               value={fus.descripcion} />
        <Row label="Contexto"                  value={fus.contexto} />
        <Row label="Solicitante externo"       value={fus.solicitante_externo?.nombre} />
        <Row label="Evidencia"                 value={fus.evidencias?.length ? `${fus.evidencias.length} archivo(s)` : undefined} />
        <Row label="Medio de recepción"        value={fus.idMedioRecepcion?.nombreMedio} />
        <Row label="Prioridad"                 value={fus.prioridad} />
      </div>
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
function FusCard({ fus, activo, onClick }) {
  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  return (
    <div className={`fus-card${activo ? ' fus-card-activo' : ''}`} onClick={onClick} role="button" tabIndex={0}
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
  const [lista,        setLista]        = useState([])
  const [busqueda,     setBusqueda]     = useState('')
  const [filtro,       setFiltro]       = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [turnarFUS,    setTurnarFUS]    = useState(null)
  const [cargando,     setCargando]     = useState(true)
  const [stats,        setStats]        = useState({ concluidas: 0, activas: 0, pendientes: 0 })

  const cargarStats = () => {
    api.get('/fus/').then(r => {
      const todos = Array.isArray(r.data) ? r.data : r.data.results || []
      setStats({
        concluidas: todos.filter(f => f.estatusParticular === 'Concluido').length,
        activas:    todos.filter(f => f.estatusParticular === 'Turnado' || f.estatusParticular === 'Atendido').length,
        pendientes: todos.filter(f => f.estatusParticular === 'Registrado').length,
      })
    }).catch(() => {})
  }

  const cargar = () => {
    setCargando(true)
    const params = {}
    if (filtro)   params.estatusParticular = filtro
    if (busqueda) params.search = busqueda
    api.get('/fus/', { params })
      .then(r => setLista(Array.isArray(r.data) ? r.data : r.data.results || []))
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargarStats() }, [])
  useEffect(() => { cargar() }, [filtro, busqueda])

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
                onClick={() => setSeleccionado(f)}
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
