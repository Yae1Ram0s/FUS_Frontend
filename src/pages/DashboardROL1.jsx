import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import { useCountUp } from '../hooks/useCountUp'
import './DashboardROL1.css'

const DIA_MS = 86_400_000
const PRIORIDAD_COLORES = { Alta: '#b91c1c', Media: '#92400e', Baja: '#15803d' }
const ESTADO_COLORES = { Pendiente: '#8a93a8', 'En proceso': '#c9a227', Finalizado: '#1F5647', Cancelado: '#b91c1c' }

const ICON_FOLDER = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)
const ICON_TARGET = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)
const ICON_CHECK = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
)
const ICON_STACK = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
)
const ICON_ALARM = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M5 3 2 6"/><path d="M22 6l-3-3"/>
  </svg>
)
const ICON_MOON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)
const ICON_FLAG = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
  </svg>
)
const ICON_HOURGLASS = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>
  </svg>
)

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

function diasDesde(iso, ahora) {
  return (ahora - new Date(iso).getTime()) / DIA_MS
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

/* ── Tendencia de solicitudes — gráfico de línea ── */
function TendenciaChart({ data }) {
  const w = 600, h = 180, padX = 10, padY = 16
  const max = Math.max(1, ...data.map(d => d.value))
  const n = data.length
  const stepX = n > 1 ? (w - padX * 2) / (n - 1) : 0
  const pts = data.map((d, i) => [padX + i * stepX, h - padY - (d.value / max) * (h - padY * 2)])
  const linePoints = pts.map(p => p.join(',')).join(' ')
  const areaPoints = `${padX},${h - padY} ${linePoints} ${w - padX},${h - padY}`
  const totalPeriodo = data.reduce((s, d) => s + d.value, 0)

  if (totalPeriodo === 0) return <p className="dash-empty">Sin solicitudes registradas en los últimos 14 días.</p>

  return (
    <div className="dash-trend-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="dash-trend-svg" preserveAspectRatio="none">
        <polygon points={areaPoints} className="dash-trend-area" />
        <polyline points={linePoints} className="dash-trend-line" />
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.2" className="dash-trend-dot" />)}
      </svg>
      <div className="dash-trend-labels">
        {data.map((d, i) => <span key={i}>{d.label}</span>)}
      </div>
    </div>
  )
}

/* ── Donut multi-segmento (conic-gradient enmascarado) ── */
function DonutEstados({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  let acc = 0
  const stops = total > 0
    ? data.map(d => {
        const start = (acc / total) * 360
        acc += d.value
        const end = (acc / total) * 360
        return `${d.color} ${start}deg ${end}deg`
      }).join(', ')
    : null

  return (
    <div className="dash-donut-multi-wrap">
      <div className="dash-donut-multi-figure">
        <div
          className={`dash-donut-multi-ring${total === 0 ? ' dash-donut-multi-empty' : ''}`}
          style={total > 0 ? { background: `conic-gradient(${stops})` } : undefined}
        />
        <div className="dash-donut-multi-total">
          <span className="dash-donut-multi-total-value">{total}</span>
          <span className="dash-donut-multi-total-label">Total</span>
        </div>
      </div>
      <ul className="dash-donut-legend">
        {data.map(d => (
          <li key={d.label}>
            <span className="dash-dot" style={{ background: d.color }} />
            <span className="dash-legend-label">{d.label}</span>
            <span className="dash-legend-value">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function DashboardROL1() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const nombre = user?.nombre || user?.email || 'Usuario'

  const [fusData,   setFusData]   = useState([])
  const [bitacora,  setBitacora]  = useState([])
  const [cargando,  setCargando]  = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [ahora] = useState(() => Date.now())

  const cargar = () => {
    Promise.all([
      fetchAll('/fus/'),
      api.get('/bitacora/', { params: { page: 1, page_size: 100 } }).then(r => r.data.results || []),
    ])
      .then(([fus, bit]) => { setErrorCarga(false); setFusData(fus); setBitacora(bit) })
      .catch(() => setErrorCarga(true))
      .finally(() => setCargando(false))
  }
  const reintentar = () => { setCargando(true); cargar() }

  useEffect(() => { cargar() }, [])

  const irAConsultar = (estatus) => navigate(`/rol1/consultar-fus?modo=lista${estatus ? `&filtro=${encodeURIComponent(estatus)}` : ''}`)

  /* ── 1. KPIs principales ── */
  const totalFUS     = fusData.length
  const pendientes   = fusData.filter(f => f.estatusParticular === 'Registrado').length
  const enProceso    = fusData.filter(f => f.estatusParticular === 'Turnado' || f.estatusParticular === 'Atendido').length
  const finalizados  = fusData.filter(f => f.estatusParticular === 'Concluido').length

  const noConcluidos = fusData.filter(f => f.estatusParticular !== 'Concluido')

  /* ── Antigüedad / alertas — umbrales bajados para forzar resolución más rápida ── */
  const bucket01   = noConcluidos.filter(f => f.fechaHora && diasDesde(f.fechaHora, ahora) <= 1).length
  const bucket23   = noConcluidos.filter(f => f.fechaHora && diasDesde(f.fechaHora, ahora) > 1 && diasDesde(f.fechaHora, ahora) <= 3).length
  const bucket45   = noConcluidos.filter(f => f.fechaHora && diasDesde(f.fechaHora, ahora) > 3 && diasDesde(f.fechaHora, ahora) <= 5).length
  const bucketMas5 = noConcluidos.filter(f => f.fechaHora && diasDesde(f.fechaHora, ahora) > 5).length

  const vencidas = bucketMas5
  const proximasAVencer = bucket45
  const prioridadAltaPendiente = noConcluidos.filter(f => f.prioridad === 'Alta').length

  /* Última actividad por folio (para "sin movimiento") */
  const ultimaActividadPorFolio = {}
  bitacora.forEach(b => {
    const t = new Date(b.fechaHora).getTime()
    if (!ultimaActividadPorFolio[b.fusFolio] || t > ultimaActividadPorFolio[b.fusFolio]) {
      ultimaActividadPorFolio[b.fusFolio] = t
    }
  })
  const SIN_MOVIMIENTO_DIAS = 3
  const sinMovimiento = noConcluidos.filter(f => {
    const ultima = ultimaActividadPorFolio[f.folio] ?? (f.fechaHora ? new Date(f.fechaHora).getTime() : ahora)
    return (ahora - ultima) / DIA_MS > SIN_MOVIMIENTO_DIAS
  }).length

  /* ── 3. Tendencia — últimos 14 días ── */
  const dias14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(ahora - (13 - i) * DIA_MS)
    d.setHours(0, 0, 0, 0)
    return d
  })
  const tendencia = dias14.map(d => ({
    label: d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }),
    value: fusData.filter(f => {
      if (!f.fechaHora) return false
      const fd = new Date(f.fechaHora)
      return fd.getFullYear() === d.getFullYear() && fd.getMonth() === d.getMonth() && fd.getDate() === d.getDate()
    }).length,
  }))

  /* ── 4. Distribución por estado ── */
  const distribucionEstado = [
    { label: 'Pendiente',  value: pendientes,  color: ESTADO_COLORES.Pendiente },
    { label: 'En proceso', value: enProceso,   color: ESTADO_COLORES['En proceso'] },
    { label: 'Finalizado', value: finalizados, color: ESTADO_COLORES.Finalizado },
    { label: 'Cancelado',  value: 0,           color: ESTADO_COLORES.Cancelado },
  ]

  /* ── 5. Distribución por prioridad ── */
  const distribucionPrioridad = ['Alta', 'Media', 'Baja'].map(p => ({
    label: p,
    value: fusData.filter(f => f.prioridad === p).length,
    color: PRIORIDAD_COLORES[p],
  }))

  /* ── 6. Canal de recepción ── */
  const medioCounts = {}
  fusData.forEach(f => {
    const m = f.idMedioRecepcion?.nombreMedio || 'Otro'
    medioCounts[m] = (medioCounts[m] || 0) + 1
  })
  const canalRecepcion = Object.entries(medioCounts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)

  /* ── 7. Antigüedad ── */
  const antiguedadBuckets = [
    { key: '0-1',   label: '0-1 días',    value: bucket01 },
    { key: '2-3',   label: '2-3 días',    value: bucket23 },
    { key: '4-5',   label: '4-5 días',    value: bucket45, warn: true },
    { key: '>5',    label: 'Más de 5 días', value: bucketMas5, danger: true },
  ]

  if (cargando) {
    return <AppLayout><div className="dash-bg"><Spinner overlay={false} label="Cargando dashboard…" /></div></AppLayout>
  }

  if (errorCarga && fusData.length === 0) {
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
            <p>Panorama ejecutivo del Sistema de Control de Solicitudes</p>
          </header>

          {/* ── 1. KPIs principales ── */}
          <div className="dash-section">
            <div className="dash-stat-row">
              <KpiTile
                accent="#1F5647" icon={ICON_STACK}
                value={totalFUS} label="Total de FUS" sublabel="Todas las solicitudes"
                onClick={() => irAConsultar('')}
              />
              <KpiTile
                accent="#235b4e" icon={ICON_FOLDER}
                value={pendientes} label="Pendientes" sublabel="Registradas, sin turnar"
                onClick={() => irAConsultar('Registrado')}
              />
              <KpiTile
                accent="#c9a227" icon={ICON_TARGET} live
                value={enProceso} label="En proceso" sublabel="Turnadas o en atención"
                onClick={() => irAConsultar('')}
              />
              <KpiTile
                accent="#1a7a52" icon={ICON_CHECK}
                value={finalizados} label="Finalizados" sublabel="Atendidos y cerrados"
                onClick={() => irAConsultar('Concluido')}
              />
            </div>
          </div>

          {/* ── 8. Alertas importantes ── */}
          <div className="dash-section">
            <div className="dash-section-head">
              <h3>Alertas importantes</h3>
              <p className="dash-section-caption">Solo excepciones que requieren atención</p>
            </div>
            <div className="dash-stat-row">
              <KpiTile
                accent="#b91c1c" icon={ICON_ALARM}
                value={vencidas} label="Solicitudes vencidas" sublabel="Más de 5 días abiertas"
                onClick={() => irAConsultar('')}
              />
              <KpiTile
                accent="#92400e" icon={ICON_MOON}
                value={sinMovimiento} label="Sin movimiento" sublabel="Más de 3 días sin actividad"
                onClick={() => irAConsultar('')}
              />
              <KpiTile
                accent="#b91c1c" icon={ICON_FLAG}
                value={prioridadAltaPendiente} label="Prioridad alta pendiente" sublabel="Sin concluir"
                onClick={() => irAConsultar('')}
              />
              <KpiTile
                accent="#c9a227" icon={ICON_HOURGLASS}
                value={proximasAVencer} label="Próximas a vencer" sublabel="Entre 4 y 5 días abiertas"
                onClick={() => irAConsultar('')}
              />
            </div>
          </div>

          {/* ── 3. Tendencia de solicitudes ── */}
          <div className="dash-section">
            <div className="dash-card">
              <h2>Tendencia de solicitudes</h2>
              <p className="dash-subtitle">Solicitudes registradas por día — últimos 14 días</p>
              <TendenciaChart data={tendencia} />
            </div>
          </div>

          {/* ── 4 y 5. Distribución por estado / prioridad ── */}
          <div className="dash-section">
            <div className="dash-grid-2">
              <div className="dash-card">
                <h2>Distribución por estado</h2>
                <p className="dash-subtitle">Proporción del total de FUS</p>
                <DonutEstados data={distribucionEstado} />
              </div>
              <div className="dash-card">
                <h2>Distribución por prioridad</h2>
                <p className="dash-subtitle">Todas las solicitudes registradas</p>
                <BarrasHorizontales data={distribucionPrioridad} />
              </div>
            </div>
          </div>

          {/* ── 6 y 7. Canal de recepción / Antigüedad ── */}
          <div className="dash-section">
            <div className="dash-grid-2">
              <div className="dash-card">
                <h2>Canal de recepción</h2>
                <p className="dash-subtitle">Cómo llegan las solicitudes</p>
                <BarrasHorizontales data={canalRecepcion} />
              </div>
              <div className="dash-card">
                <h2>Antigüedad de solicitudes</h2>
                <p className="dash-subtitle">Solicitudes abiertas, por tiempo transcurrido</p>
                <div className="dash-bucket-row">
                  {antiguedadBuckets.map(b => (
                    <div key={b.key} className={`dash-bucket-card${b.warn ? ' dash-bucket-card-warn' : ''}${b.danger ? ' dash-bucket-card-danger' : ''}`}>
                      <span className="dash-bucket-value">{b.value}</span>
                      <span className="dash-bucket-label">{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
        </div>
      </div>
    </AppLayout>
  )
}
