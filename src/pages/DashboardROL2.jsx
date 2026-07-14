import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import Badge from '../components/Badge'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import { useEstatus } from '../hooks/useEstatus'
import { useCountUp } from '../hooks/useCountUp'
import './DashboardROL1.css'

const PRIORIDAD_COLORES = { Alta: '#b91c1c', Media: '#92400e', Baja: '#15803d' }

const ICON_INBOX = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
)
const ICON_ACTIVITY = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)
const ICON_CHECK = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
)
const ICON_FLAG = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
  </svg>
)

const ACCION_TEXTO = {
  REGISTRO_FUS:       'registró el FUS',
  TURNAR_FUS:         'turnó el FUS',
  ASIGNACION_ESTADO:  'actualizó el estatus de',
  REGISTRO_RESPUESTA: 'registró una respuesta en',
  REGISTRO_ACCION:    'registró una acción en',
  CONCLUSION_FUS:     'concluyó',
}

function horaCorta(iso) {
  return iso ? new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'
}

function fechaCorta(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
}

/* ── Tarjeta de KPI minimalista, estilo Apple ── */
function KpiTile({ icon, value, label, sublabel, accent, live, onClick }) {
  const count = useCountUp(value)
  return (
    <div
      className={`dash-mini-stat${onClick ? ' dash-mini-stat-clickable' : ''}`}
      style={{ '--accent': accent }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e => e.key === 'Enter' && onClick()) : undefined}
    >
      <span className="dash-mini-stat-icon">{icon}</span>
      <div className="dash-mini-stat-body">
        <div className="dash-mini-stat-value-row">
          <span className="dash-mini-stat-value">{count}</span>
          {live && <span className="dash-mini-stat-live" />}
        </div>
        <span className="dash-mini-stat-label">{label}</span>
        {sublabel && <span className="dash-mini-stat-sub">{sublabel}</span>}
      </div>
      {onClick && (
        <span className="dash-mini-stat-arrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </span>
      )}
    </div>
  )
}

/** Trae todas las páginas de un listado paginado (el backend limita page_size a 100). */
async function fetchAll(url, extraParams = {}) {
  const page_size = 100
  let page = 1
  let all = []
  let total = Infinity
  while (all.length < total) {
    const r = await api.get(url, { params: { ...extraParams, page, page_size } })
    const results = r.data.results || []
    total = r.data.total ?? results.length
    all = all.concat(results)
    if (results.length === 0) break
    page++
  }
  return all
}

/* ── Barras horizontales genéricas ── */
function BarrasHorizontales({ data }) {
  const max = Math.max(1, ...data.map(d => d.value))
  if (!data.length) return <p className="dash-empty">Sin datos disponibles.</p>
  return (
    <div className="dash-bars">
      {data.map(d => (
        <div className="dash-bar-row" key={d.label}>
          <span className="dash-bar-label">{d.label}</span>
          <div className="dash-bar-track">
            <div className="dash-bar-fill" style={{ width: `${(d.value / max) * 100}%`, background: d.color }} />
          </div>
          <span className="dash-bar-value">{d.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardROL2() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const nombre = user?.nombre || user?.email || 'Usuario'
  const { estatus: estatusROL2 } = useEstatus('TITULAR')

  const [turnados,  setTurnados]  = useState([])
  const [actividad, setActividad] = useState([])
  const [cargando,  setCargando]  = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)

  const [fEstado,    setFEstado]    = useState('')
  const [fPrioridad, setFPrioridad] = useState('')
  const [fFecha,     setFFecha]     = useState('')

  const cargar = () => {
    Promise.all([
      fetchAll('/turnados/mis-turnados/'),
      api.get('/bitacora/', { params: { page: 1, page_size: 8 } }).then(r => r.data.results || []),
    ])
      .then(([turn, bit]) => { setErrorCarga(false); setTurnados(turn); setActividad(bit) })
      .catch(() => setErrorCarga(true))
      .finally(() => setCargando(false))
  }
  const reintentar = () => { setCargando(true); cargar() }

  useEffect(() => { cargar() }, [])

  const irAConsultar = (estatus) => navigate(`/rol2/solicitudes?modo=lista${estatus ? `&filtro=${encodeURIComponent(estatus)}` : ''}`)

  /* ── 1. KPIs ── */
  const misPendientes = turnados.filter(t => t.estatusTitular === 'Recibido').length
  const enProceso     = turnados.filter(t => t.estatusTitular === 'En_seguimiento').length
  const finalizadas   = turnados.filter(t => t.estatusTitular === 'Concluido').length
  const noConcluidos  = turnados.filter(t => t.estatusTitular !== 'Concluido')
  const prioridadAlta = noConcluidos.filter(t => t.idFus?.prioridad === 'Alta').length

  /* ── 2. Mis prioridades (carga activa) ── */
  const misPrioridades = ['Alta', 'Media', 'Baja'].map(p => ({
    label: p,
    value: noConcluidos.filter(t => t.idFus?.prioridad === p).length,
    color: PRIORIDAD_COLORES[p],
  }))

  /* ── 3. Próximos vencimientos (fechaLimite de solicitudes activas) ── */
  const conFechaLimite = noConcluidos.filter(t => t.idFus?.fechaLimite)
  const inicioHoy   = new Date(); inicioHoy.setHours(0, 0, 0, 0)
  const finHoy      = new Date(inicioHoy); finHoy.setDate(finHoy.getDate() + 1)
  const finManana   = new Date(finHoy);    finManana.setDate(finManana.getDate() + 1)
  const finSemana   = new Date(inicioHoy); finSemana.setDate(finSemana.getDate() + 7)
  const vencenHoy    = conFechaLimite.filter(t => { const d = new Date(t.idFus.fechaLimite); return d >= inicioHoy && d < finHoy }).length
  const vencenManana = conFechaLimite.filter(t => { const d = new Date(t.idFus.fechaLimite); return d >= finHoy && d < finManana }).length
  const vencenSemana = conFechaLimite.filter(t => { const d = new Date(t.idFus.fechaLimite); return d >= inicioHoy && d < finSemana }).length

  /* ── 4. Mis solicitudes — tabla filtrable (cliente) ── */
  const filtradas = useMemo(() => {
    return turnados.filter(t => {
      if (fEstado && t.estatusTitular !== fEstado) return false
      if (fPrioridad && t.idFus?.prioridad !== fPrioridad) return false
      if (fFecha) {
        const f = t.idFus?.fechaHora ? new Date(t.idFus.fechaHora) : null
        if (!f) return false
        const sel = new Date(fFecha)
        if (f.getFullYear() !== sel.getFullYear() || f.getMonth() !== sel.getMonth() || f.getDate() !== sel.getDate()) return false
      }
      return true
    }).sort((a, b) => new Date(b.fechaHoraTurnado || 0) - new Date(a.fechaHoraTurnado || 0))
  }, [turnados, fEstado, fPrioridad, fFecha])

  const limpiarFiltrosTabla = () => { setFEstado(''); setFPrioridad(''); setFFecha('') }
  const hayFiltrosTabla = Boolean(fEstado || fPrioridad || fFecha)

  if (cargando) {
    return <AppLayout><div className="dash-bg"><Spinner overlay={false} label="Cargando dashboard…" /></div></AppLayout>
  }

  if (errorCarga && turnados.length === 0) {
    return (
      <AppLayout>
        <div className="dash-bg">
          <div className="dash-error-state">
            <p className="dash-error-msg">No se pudo cargar el dashboard.</p>
            <button type="button" className="btn-reintentar" onClick={reintentar}>Reintentar</button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="dash-bg">
        <div className="dash-wrap-apple">
        <div className="dash-mega-card">

          <header className="dash-header-apple">
            <h1>Hola, {nombre}</h1>
            <p>Organiza tu trabajo del día</p>
          </header>

          {/* ── 1. KPIs ── */}
          <div className="dash-section">
            <div className="dash-stat-row">
              <KpiTile
                accent="#235b4e" icon={ICON_INBOX}
                value={misPendientes} label="Mis pendientes" sublabel="Pendientes de atender"
                onClick={() => irAConsultar('Recibido')}
              />
              <KpiTile
                accent="#c9a227" icon={ICON_ACTIVITY} live
                value={enProceso} label="En proceso" sublabel="Con respuesta en proceso"
                onClick={() => irAConsultar('En_seguimiento')}
              />
              <KpiTile
                accent="#1a7a52" icon={ICON_CHECK}
                value={finalizadas} label="Finalizadas" sublabel="Atendidas y cerradas"
                onClick={() => irAConsultar('Concluido')}
              />
              <KpiTile
                accent="#b91c1c" icon={ICON_FLAG}
                value={prioridadAlta} label="Prioridad alta" sublabel="Pendientes"
              />
            </div>
          </div>

          {/* ── 2 y 3. Mis prioridades / Próximos vencimientos ── */}
          <div className="dash-section">
            <div className="dash-grid-2">
              <div className="dash-card">
                <h2>Mis prioridades</h2>
                <p className="dash-subtitle">Solicitudes activas, por nivel de prioridad</p>
                <BarrasHorizontales data={misPrioridades} />
              </div>
              <div className="dash-card">
                <h2>Próximos vencimientos</h2>
                <p className="dash-subtitle">Solicitudes por fecha límite</p>
                <div className="dash-venc-row">
                  <div className="dash-venc-card" onClick={() => irAConsultar('')}>
                    <div className="dash-venc-value">{vencenHoy}</div>
                    <div className="dash-venc-label">Hoy</div>
                  </div>
                  <div className="dash-venc-card" onClick={() => irAConsultar('')}>
                    <div className="dash-venc-value">{vencenManana}</div>
                    <div className="dash-venc-label">Mañana</div>
                  </div>
                  <div className="dash-venc-card" onClick={() => irAConsultar('')}>
                    <div className="dash-venc-value">{vencenSemana}</div>
                    <div className="dash-venc-label">Esta semana</div>
                  </div>
                </div>
                {conFechaLimite.length === 0 && (
                  <p className="dash-venc-note">Ninguna de tus solicitudes activas tiene fecha límite configurada.</p>
                )}
              </div>
            </div>
          </div>

          {/* ── 4. Mis solicitudes ── */}
          <div className="dash-section">
            <div className="dash-card">
              <h2>Mis solicitudes</h2>
              <p className="dash-subtitle">Filtra por estado, prioridad o fecha de registro</p>

              <div className="dash-table-filters">
                <select value={fEstado} onChange={e => setFEstado(e.target.value)}>
                  <option value="">Todos los estados</option>
                  {estatusROL2.map(e => <option key={e.clave} value={e.clave}>{e.nombre}</option>)}
                </select>
                <select value={fPrioridad} onChange={e => setFPrioridad(e.target.value)}>
                  <option value="">Toda prioridad</option>
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
                <input type="date" value={fFecha} onChange={e => setFFecha(e.target.value)} />
                {hayFiltrosTabla && <button onClick={limpiarFiltrosTabla}>Limpiar filtros</button>}
              </div>

              <div className="dash-table-scroll">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Fecha</th>
                      <th>Medio</th>
                      <th>Prioridad</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.slice(0, 8).map(t => (
                      <tr key={t.id} onClick={() => navigate(`/rol2/solicitudes?folio=${encodeURIComponent(t.idFus?.folio || '')}`)}>
                        <td>{t.idFus?.folio || `#${t.id}`}</td>
                        <td>{fechaCorta(t.idFus?.fechaHora)}</td>
                        <td className="dash-td-desc">{t.idFus?.idMedioRecepcion?.nombreMedio || '—'}</td>
                        <td>{t.idFus?.prioridad || '—'}</td>
                        <td><Badge estatus={t.estatusTitular} theme="light" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtradas.length === 0 && <p className="dash-table-empty">Ninguna solicitud coincide con los filtros.</p>}
              </div>

              {filtradas.length > 8 && (
                <div className="dash-table-filters" style={{ marginTop: 14, marginBottom: 0 }}>
                  <button onClick={() => irAConsultar(fEstado)}>Ver las {filtradas.length} solicitudes →</button>
                </div>
              )}
            </div>
          </div>

          {/* ── 5. Últimas actualizaciones ── */}
          <div className="dash-section">
            <div className="dash-card">
              <h2>Últimas actualizaciones</h2>
              <p className="dash-subtitle">Movimientos en tus solicitudes turnadas</p>
              {actividad.length === 0 ? (
                <p className="dash-empty">Sin actividad reciente.</p>
              ) : (
                <ul className="dash-feed">
                  {actividad.map(a => (
                    <li key={a.id} className="dash-feed-item">
                      <span className="dash-avatar">{(a.nombre || a.usuario || '?').charAt(0).toUpperCase()}</span>
                      <div className="dash-feed-body">
                        <span className="dash-feed-text">
                          <strong>{a.nombre || a.usuario}</strong> {ACCION_TEXTO[a.accion] || 'actualizó'} {a.fusFolio && <strong>{a.fusFolio}</strong>}
                        </span>
                      </div>
                      <span className="dash-feed-hora">{horaCorta(a.fechaHora)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
        </div>
      </div>
    </AppLayout>
  )
}
