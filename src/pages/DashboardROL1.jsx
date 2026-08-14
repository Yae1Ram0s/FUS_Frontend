import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid,
} from 'recharts'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import { useNotificaciones } from '../context/NotificacionesContext'
import { useCountUp } from '../hooks/useCountUp'
import './DashboardROL1.css'

const DIA_MS = 86_400_000
const PRIORIDAD_COLORES = { Alta: '#b91c1c', Media: '#92400e', Baja: '#15803d' }
// Todo lo que no sea "Concluido" — usado para que el KPI "Prioridad alta"
// (que cuenta solo lo sin concluir) lleve exactamente a esos mismos folios.
const ESTADOS_NO_CONCLUIDO = ['Registrado', 'Turnado', 'En_seguimiento', 'Atendido', 'Pendiente_validacion', 'Rechazado']

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

/* ── Iconos auxiliares del rediseño "liquid glass" (solo ROL1) — equivalentes
   inline a lucide-react ArrowUpRight/ArrowRight/Info, sin agregar la librería. ── */
const ICON_CORNER = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
  </svg>
)
const ICON_INFO = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="11"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
)

/** Trae todas las páginas de un listado paginado (el backend limita page_size a 100). */
async function fetchAll(url, extraParams = {}, signal) {
  const page_size = 100
  let page = 1
  let all = []
  let total = Infinity
  while (all.length < total) {
    const r = await api.get(url, {
      params: { ...extraParams, page, page_size },
      signal,
    })
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

/* ── Rediseño "liquid glass" — tarjeta de KPI con glow e icono degradado,
   usada por ambos dashboards (ROL1 y su Equipo del Particular). ── */
function Kpi2Card({ icon, label, sub, value, color, onClick, index }) {
  const count = useCountUp(value)
  return (
    <div
      className="kpi2-card"
      style={{ animationDelay: `${index * 0.06}s` }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
      }) : undefined}
    >
      <div className={`kpi2-glow kpi2-glow--${color}`} />
      <div className={`kpi2-icon kpi2-icon--${color}`}>{icon}</div>
      {onClick && <span className="kpi2-link">{ICON_CORNER}</span>}
      <div className="kpi2-label">{label}</div>
      <div className="kpi2-sub">{sub}</div>
      <div className="kpi2-value">{count}</div>
    </div>
  )
}

function Venc2Item({ item, onClick }) {
  return (
    <div
      className="venc-item venc-item-clickable"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      <div className={`venc-icon venc-icon--${item.color}`}>{item.icon}</div>
      <div className="venc-texto">
        <div className="venc-folio">{item.folio}</div>
        <div className="venc-fecha">Fecha límite: {item.fecha}</div>
      </div>
      <span className={`venc-badge venc-badge--${item.color}`}>{item.badge}</span>
    </div>
  )
}

export default function DashboardROL1() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const nombre = user?.nombre || user?.email || 'Usuario'

  const {
    // ahora:0 solo se usa antes de la primera carga, mientras fusData sigue
    // vacío y la pantalla muestra el Spinner — su valor real es irrelevante.
    data: dashboard = { fusData: [], ahora: 0 },
    isFetching: cargando,
    error: errorCarga,
    refetch: reintentar,
  } = useQuery({
    queryKey: ['dashboardRol1'],
    queryFn: async ({ signal }) => ({ fusData: await fetchAll('/fus/', {}, signal), ahora: Date.now() }),
  })
  const { fusData, ahora } = dashboard

  // En vivo: cualquier notificación ligada a un FUS (turnar, atendido,
  // comisionar, concluir, rechazar, SLA por vencer, etc.) refresca el
  // dashboard completo — mismo patrón que ConsultarFUS/SolicitudesTurnadas/
  // FUSComisionados. Sin esto, el dashboard se quedaba mostrando datos
  // desactualizados hasta que el usuario navegaba fuera y volvía a entrar.
  const notifCtx = useNotificaciones()
  const ultimaNotif = notifCtx?.notifs?.[0]
  const ultimaNotifId = ultimaNotif?.id
  const ultimaNotifFolio = ultimaNotif?.fusFolio
  useEffect(() => {
    if (!ultimaNotifFolio) return
    reintentar()
  }, [reintentar, ultimaNotifFolio, ultimaNotifId])

  const irAConsultar = (estatus) => navigate(`/rol1/consultar-fus?modo=lista${estatus ? `&filtro=${encodeURIComponent(estatus)}` : ''}`)
  // "Prioridad alta" en el KPI cuenta solo lo que sigue sin concluir (ver
  // prioridadAltaPendiente más abajo) — sin este mismo filtro de estatus, el
  // clic llevaba a TODOS los de prioridad alta (incluyendo ya concluidos),
  // mostrando más folios de los que el número de la tarjeta prometía.
  const irAConsultarPrioridad = (prioridad) => navigate(
    `/rol1/consultar-fus?modo=lista&prioridad=${encodeURIComponent(prioridad)}&filtro=${encodeURIComponent(ESTADOS_NO_CONCLUIDO.join(','))}`
  )
  const irAlFus = (folio) => navigate(`/rol1/consultar-fus?folio=${encodeURIComponent(folio)}`)

  /* ── 1. KPIs principales ── */
  const totalFUS     = fusData.length
  const pendientes   = fusData.filter(f => f.estatusParticular === 'Registrado').length
  // KPI "Atendidos" (tarjeta principal): cuenta nada más el estatus
  // 'Atendido', para que el número coincida exactamente con lo que muestra
  // el filtro al que lleva el clic.
  const atendidos    = fusData.filter(f => f.estatusParticular === 'Atendido').length
  const finalizados  = fusData.filter(f => f.estatusParticular === 'Concluido').length

  const noConcluidos = fusData.filter(f => f.estatusParticular !== 'Concluido')
  const prioridadAltaPendiente = noConcluidos.filter(f => f.prioridad === 'Alta').length

  /* ── Antigüedad de solicitudes (equipo del particular) ── */
  const antiguedadBuckets = [
    { key: '0-1', label: '0-1 días', value: noConcluidos.filter(f => f.fechaHora && diasDesde(f.fechaHora, ahora) <= 1).length },
    { key: '2-3', label: '2-3 días', value: noConcluidos.filter(f => f.fechaHora && diasDesde(f.fechaHora, ahora) > 1 && diasDesde(f.fechaHora, ahora) <= 3).length },
    { key: '4-5', label: '4-5 días', value: noConcluidos.filter(f => f.fechaHora && diasDesde(f.fechaHora, ahora) > 3 && diasDesde(f.fechaHora, ahora) <= 5).length, warn: true },
    { key: '>5',  label: 'Más de 5 días', value: noConcluidos.filter(f => f.fechaHora && diasDesde(f.fechaHora, ahora) > 5).length, danger: true },
  ]

  /* ── Productividad (equipo del particular) — mismos 3 indicadores que
     "Análisis de productividad" en Reportes, calculados aquí sobre el total
     acumulado (el dashboard no tiene selector de periodo como Reportes). ── */
  const dentroSLA = fusData.filter(f => f.fechaConclusion && (!f.fechaLimite || new Date(f.fechaConclusion) <= new Date(f.fechaLimite))).length
  const fusUltimos30 = fusData.filter(f => f.fechaHora && diasDesde(f.fechaHora, ahora) <= 30).length
  const productividadBuckets = [
    { key: 'tasa',      label: 'Tasa de conclusión', value: `${totalFUS ? Math.round(finalizados * 1000 / totalFUS) / 10 : 0}%` },
    { key: 'fus-dia',   label: 'FUS por día',        value: Math.round(fusUltimos30 * 10 / 30) / 10 },
    { key: 'eficiencia', label: 'Eficiencia SLA',    value: `${finalizados ? Math.round(dentroSLA * 1000 / finalizados) / 10 : 0}%` },
  ]

  /* ── 3. Tendencia — últimos 14 días, solo hábiles (lunes a viernes) ── */
  const dias14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(ahora - (13 - i) * DIA_MS)
    d.setHours(0, 0, 0, 0)
    return d
  }).filter(d => d.getDay() !== 0 && d.getDay() !== 6)
  const tendencia = dias14.map(d => ({
    label: d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }),
    value: fusData.filter(f => {
      if (!f.fechaHora) return false
      const fd = new Date(f.fechaHora)
      return fd.getFullYear() === d.getFullYear() && fd.getMonth() === d.getMonth() && fd.getDate() === d.getDate()
    }).length,
  }))

  /* ── Distribución por prioridad — Distribución por estado, Canal de
     recepción y Antigüedad de solicitudes se movieron a Reportes. ── */
  const distribucionPrioridad = ['Alta', 'Media', 'Baja'].map(p => ({
    label: p,
    value: fusData.filter(f => f.prioridad === p).length,
    color: PRIORIDAD_COLORES[p],
  }))

  /* ── Rediseño "liquid glass" (ambos dashboards, ver JSX final) — misma lógica de
     datos, solo se reempaqueta para el nuevo layout visual. ── */
  const kpis2 = [
    { icon: ICON_STACK,  label: 'Total de FUS',   sub: 'Todas las solicitudes',      value: totalFUS,              color: 'blue',  onClick: () => irAConsultar('') },
    { icon: ICON_FOLDER, label: 'Registrados',    sub: 'Registradas, sin turnar',    value: pendientes,            color: 'amber', onClick: () => irAConsultar('Registrado') },
    { icon: ICON_TARGET, label: 'Atendidos',      sub: 'En trámite, sin concluir',   value: atendidos,             color: 'blue',  onClick: () => irAConsultar('Atendido') },
    { icon: ICON_CHECK,  label: 'Concluidos',     sub: 'Atendidos y cerrados',       value: finalizados,           color: 'green', onClick: () => irAConsultar('Concluido') },
    { icon: ICON_FLAG,   label: 'Prioridad alta', sub: 'Sin concluir',               value: prioridadAltaPendiente, color: 'red',  onClick: () => irAConsultarPrioridad('Alta') },
  ]

  /* Tendencia por unidad administrativa — cuenta real de FUS por la unidad del
     Titular (ROL2) al que se turnó cada FUS (`direccionTitular`, ya resuelto
     por el backend en FUSSerializer a partir del Turnado activo — no la
     unidad del Comisionado). El segmentado 7/30/90 días filtra `fusData` (ya
     completo en memoria, fetchAll pagina todo) antes de agrupar — no hay
     todavía un parámetro de rango en el fetch de /fus/, así que cuando el
     backend pagine por fecha este bloque debe pasar a usar ese parámetro en
     vez de filtrar aquí. Sin turnado a un Titular → bucket "Sin asignar". */
  const UNIDAD_SIN_ASIGNAR = 'Sin asignar'
  const RANGOS2 = [7, 30, 90]
  const [rangoDias, setRangoDias] = useState(30)
  const solicitudesRango = fusData.filter(f => f.fechaHora && diasDesde(f.fechaHora, ahora) <= rangoDias)
  const unidadCounts = {}
  solicitudesRango.forEach(f => {
    const u = f.direccionTitular || UNIDAD_SIN_ASIGNAR
    unidadCounts[u] = (unidadCounts[u] || 0) + 1
  })
  const unidadEntries = Object.entries(unidadCounts)
    .map(([unidad, value]) => ({ unidad, value }))
    .sort((a, b) => b.value - a.value)
  // Con más de 8 unidades el eje se vuelve ilegible — se muestran las 7 con
  // más solicitudes y el resto se agrupa en "Otros" (nunca se descartan: el
  // total de la barra "Otros" sigue sumando al total del periodo).
  const TOP_UNIDADES = 7
  const tendenciaPorUnidad = unidadEntries.length > TOP_UNIDADES + 1
    ? [
        ...unidadEntries.slice(0, TOP_UNIDADES),
        { unidad: 'Otros', value: unidadEntries.slice(TOP_UNIDADES).reduce((s, d) => s + d.value, 0) },
      ]
    : unidadEntries
  const totalPeriodo = solicitudesRango.length

  /* Próximos vencimientos — por fechaLimite real, no por antigüedad de registro;
     estadoTemporalidad ya viene calculado por el backend (Vencido/PorVencer/null). */
  const ICONO_VENCIMIENTO2 = {
    alta:      { icon: ICON_ALARM,     color: 'red' },
    pendiente: { icon: ICON_HOURGLASS, color: 'amber' },
    proceso:   { icon: ICON_TARGET,    color: 'blue' },
  }
  const badgeRelativo = (fechaLimiteIso) => {
    const dias = Math.round((new Date(fechaLimiteIso).getTime() - ahora) / DIA_MS)
    if (dias < 0) return `Hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`
    if (dias === 0) return 'Hoy'
    return `En ${dias} día${dias === 1 ? '' : 's'}`
  }
  const vencimientos2 = noConcluidos
    .filter(f => f.fechaLimite)
    .sort((a, b) => new Date(a.fechaLimite) - new Date(b.fechaLimite))
    .slice(0, 6)
    .map(f => {
      const tipo = f.estadoTemporalidad === 'Vencido' ? 'alta' : f.estadoTemporalidad === 'PorVencer' ? 'pendiente' : 'proceso'
      const { icon, color } = ICONO_VENCIMIENTO2[tipo]
      return {
        folio: f.folio,
        fecha: new Date(f.fechaLimite).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }),
        badge: badgeRelativo(f.fechaLimite),
        icon, color,
      }
    })

  if (cargando && fusData.length === 0) {
    return <AppLayout><div className="dash-bg"><Spinner overlay={false} fill label="Cargando dashboard…" /></div></AppLayout>
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

  if (user?.rol === 'ROL1') {
    return (
      <AppLayout>
        <div className="dash-bg">
          <div className="dash2-wrap">

            {errorCarga && fusData.length > 0 && (
              <div className="banner-error-carga">
                <span>No se pudo actualizar — mostrando la última información disponible.</span>
                <button type="button" onClick={reintentar}>Reintentar</button>
              </div>
            )}

            <div className="dash2-ambient">
              <div className="dash2-blob dash2-blob--1" />
              <div className="dash2-blob dash2-blob--2" />
              <div className="dash2-blob dash2-blob--3" />
            </div>

            <div className="dash2-content">
              <header className="dash2-header">
                <h1>Hola, {nombre}</h1>
                <p>Panorama ejecutivo del Sistema de Control de Solicitudes</p>
              </header>

              <div className="kpi2-row">
                {kpis2.map((k, i) => <Kpi2Card key={k.label} {...k} index={i} />)}
              </div>

              <div className="dash2-grid-tendencia">
                <div className="dash2-card">
                  <div className="dash2-card-title">
                    Tendencia de solicitudes por unidad administrativa
                    <div className="segmented">
                      {RANGOS2.map(r => (
                        <button
                          key={r}
                          type="button"
                          className={r === rangoDias ? 'active' : ''}
                          onClick={() => setRangoDias(r)}
                        >
                          {r} días
                        </button>
                      ))}
                    </div>
                  </div>
                  {totalPeriodo === 0 ? (
                    <p className="dash-empty">Sin solicitudes registradas en el periodo seleccionado.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={tendenciaPorUnidad} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="dash2AreaFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1F5647" stopOpacity={0.18} />
                            <stop offset="100%" stopColor="#1F5647" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#f0f0f2" />
                        <XAxis dataKey="unidad" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                            fontSize: 12, maxWidth: 200, whiteSpace: 'normal', wordBreak: 'break-word',
                          }}
                          wrapperStyle={{ zIndex: 20 }}
                          allowEscapeViewBox={{ x: false, y: false }}
                          formatter={(val) => [val, 'Total']}
                        />
                        <Area type="monotone" dataKey="value" name="Total" stroke="#1F5647" strokeWidth={2.5} fill="url(#dash2AreaFill)" dot={{ r: 4, fill: '#1F5647' }} activeDot={{ r: 6 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}

                  {/* Versión móvil del total del periodo, integrada como fila
                      dentro de esta misma tarjeta — mismo dato que
                      .dash2-total-card de escritorio (ver abajo), alternadas
                      por CSS según viewport para no duplicar el cálculo. */}
                  <div className="dash2-total-inline">
                    <span className="dash2-total-inline-icon">{ICON_STACK}</span>
                    <span className="dash2-total-inline-value">{totalPeriodo}</span>
                    <span className="dash2-total-inline-label">Total del periodo · últimos {rangoDias} días</span>
                  </div>
                </div>

                <div className="dash2-card dash2-total-card">
                  <div className="dash2-total-icon">{ICON_STACK}</div>
                  <div className="dash2-total-label">Total del periodo</div>
                  <div className="dash2-total-value">{totalPeriodo}</div>
                  <div className="dash2-total-nota">{ICON_INFO} Solicitudes registradas en los últimos {rangoDias} días</div>
                </div>
              </div>

              <div className="dash2-grid-bottom">
                <div className="dash2-card">
                  <div className="dash2-card-title">Recordatorios y avisos</div>
                  {vencimientos2.length === 0 ? (
                    <p className="dash-empty">Sin solicitudes con fecha límite próxima.</p>
                  ) : (
                    vencimientos2.map(v => (
                      <Venc2Item key={v.folio} item={v} onClick={() => irAlFus(v.folio)} />
                    ))
                  )}
                </div>

                <div className="dash2-card">
                  <div className="dash2-card-title">FUS registrados por día (últimos 7 días hábiles)</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={tendencia.slice(-7)} margin={{ top: 10, right: 10, left: -20, bottom: 8 }}>
                      <CartesianGrid vertical={false} stroke="#f0f0f2" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 14, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                          fontSize: 12, maxWidth: 200, whiteSpace: 'normal', wordBreak: 'break-word',
                        }}
                        wrapperStyle={{ zIndex: 20 }}
                        allowEscapeViewBox={{ x: false, y: false }}
                        cursor={{ fill: 'rgba(31,86,71,0.06)' }}
                        formatter={(val) => [val, 'Total']}
                      />
                      <Bar dataKey="value" name="Total" fill="#1F5647" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="dash-bg">
        <div className="dash2-wrap">

          {errorCarga && fusData.length > 0 && (
            <div className="banner-error-carga">
              <span>No se pudo actualizar — mostrando la última información disponible.</span>
              <button type="button" onClick={reintentar}>Reintentar</button>
            </div>
          )}

          <div className="dash2-ambient">
            <div className="dash2-blob dash2-blob--1" />
            <div className="dash2-blob dash2-blob--2" />
            <div className="dash2-blob dash2-blob--3" />
          </div>

          <div className="dash2-content">
            <header className="dash2-header">
              <h1>Hola, {nombre}</h1>
              <p>Panorama ejecutivo del Sistema de Control de Solicitudes</p>
            </header>

            <div className="kpi2-row">
              {kpis2.map((k, i) => <Kpi2Card key={k.label} {...k} index={i} />)}
            </div>

            {/* Distribución por estado y Canal de recepción se movieron a
                Reportes — con filtros de periodo reales, en vez de solo el
                total acumulado sin fecha. */}
            <div className="dash2-grid-bottom">
              <div className="dash2-card">
                <div className="dash2-card-title">Tendencia de solicitudes</div>
                <TendenciaChart data={tendencia} />
              </div>
              <div className="dash2-card">
                <div className="dash2-card-title">Distribución por prioridad</div>
                <BarrasHorizontales data={distribucionPrioridad} />
              </div>
            </div>

            <div className="dash2-grid-bottom">
              <div className="dash2-card">
                <div className="dash2-card-title">Antigüedad de solicitudes</div>
                <div className="dash-bucket-row">
                  {antiguedadBuckets.map(b => (
                    <div key={b.key} className={`dash-bucket-card${b.warn ? ' dash-bucket-card-warn' : ''}${b.danger ? ' dash-bucket-card-danger' : ''}`}>
                      <span className="dash-bucket-value">{b.value}</span>
                      <span className="dash-bucket-label">{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="dash2-card">
                <div className="dash2-card-title">Productividad</div>
                <div className="dash-bucket-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {productividadBuckets.map(b => (
                    <div key={b.key} className="dash-bucket-card">
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
    </AppLayout>
  )
}
