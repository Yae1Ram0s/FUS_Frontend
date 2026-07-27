import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import { useNotificaciones } from '../context/NotificacionesContext'
import { useCountUp } from '../hooks/useCountUp'
import './DashboardROL1.css'

const DIA_MS = 86_400_000
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
const ICON_STACK = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
)
const ICON_HOURGLASS = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>
  </svg>
)
const ICON_CLOCK = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)
const ICON_CORNER = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
  </svg>
)
const ICON_ARROW_RIGHT = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
)
const ICON_TREND_UP = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
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

/* ── Tarjeta de KPI "liquid glass" — mismo patrón que DashboardROL1. ── */
function Kpi2Card({ icon, label, sub, value, color, onClick, index }) {
  const count = useCountUp(value)
  return (
    <div
      className="kpi2-card"
      style={{ animationDelay: `${index * 0.06}s` }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e => e.key === 'Enter' && onClick()) : undefined}
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

export default function DashboardROL2() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const nombre = user?.nombre || user?.email || 'Usuario'

  const [turnados,  setTurnados]  = useState([])
  const [actividad, setActividad] = useState([])
  const [cargando,  setCargando]  = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  // Se recalcula en cada cargar() (no solo al montar) — si no, las etiquetas
  // relativas y los cálculos de "tiempo restante"/"hoy" se quedan congelados
  // a la hora en que se abrió el dashboard, aunque los datos se refresquen.
  const [ahora, setAhora] = useState(() => Date.now())
  const autoRetriedRef = useRef(false)
  const retryTimeoutRef = useRef(null)

  const cargar = () => {
    Promise.all([
      fetchAll('/turnados/mis-turnados/'),
      api.get('/bitacora/', { params: { page: 1, page_size: 8 } }).then(r => r.data.results || []),
    ])
      .then(([turn, bit]) => {
        setErrorCarga(false)
        autoRetriedRef.current = false
        if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null }
        setTurnados(turn); setActividad(bit); setAhora(Date.now())
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
  const reintentar = () => { setCargando(true); cargar() }

  useEffect(() => { cargar() }, [])
  useEffect(() => () => { if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current) }, [])

  // En vivo: cualquier notificación ligada a un FUS (turnado nuevo, respuesta,
  // concluir, etc.) refresca el dashboard completo — mismo patrón que
  // DashboardROL1/ConsultarFUS/SolicitudesTurnadas/FUSComisionados.
  const notifCtx = useNotificaciones()
  const ultimaNotifId = notifCtx?.notifs?.[0]?.id
  useEffect(() => {
    const notif = notifCtx?.notifs?.[0]
    if (!notif?.fusFolio) return
    cargar()
  }, [ultimaNotifId])

  const irAConsultar = (estatus) => navigate(`/rol2/solicitudes?modo=lista${estatus ? `&filtro=${encodeURIComponent(estatus)}` : ''}`)
  const irAlFus = (folio) => navigate(`/rol2/solicitudes?folio=${encodeURIComponent(folio)}`)

  /* ── KPIs ── */
  const misFus        = turnados.length
  const misPendientes = turnados.filter(t => t.estatusTitular === 'Recibido').length
  // "En proceso" = todo lo que sigue activo, ni Recibido (sin arrancar) ni
  // Concluido (cerrado) — incluye Pendiente_validacion y Rechazado, que si no
  // se quedan fuera de las 3 tarjetas y "Mis FUS" no cuadra con la suma
  // (mismo criterio ya aplicado en DashboardROL1 para estatusParticular).
  const ENPROCESO_ESTATUS = ['En_seguimiento', 'Pendiente_validacion', 'Rechazado']
  const enProceso     = turnados.filter(t => ENPROCESO_ESTATUS.includes(t.estatusTitular)).length
  const finalizadas   = turnados.filter(t => t.estatusTitular === 'Concluido').length
  const noConcluidos  = turnados.filter(t => t.estatusTitular !== 'Concluido')
  const prioridadAlta = noConcluidos.filter(t => t.idFus?.prioridad === 'Alta').length

  const kpisGlass = [
    { icon: ICON_STACK,    label: 'Mis FUS',        sub: 'Asignados',   value: misFus,        color: 'blue',  onClick: () => irAConsultar('') },
    { icon: ICON_INBOX,    label: 'Pendientes',     sub: 'Por atender', value: misPendientes,  color: 'amber', onClick: () => irAConsultar('Recibido') },
    { icon: ICON_ACTIVITY, label: 'En proceso',     sub: 'Atendiendo',  value: enProceso,      color: 'blue',  onClick: () => irAConsultar('En_seguimiento') },
    { icon: ICON_CHECK,    label: 'Finalizados',    sub: 'Completados', value: finalizadas,    color: 'green', onClick: () => irAConsultar('Concluido') },
    { icon: ICON_FLAG,     label: 'Prioridad alta', sub: 'Sin concluir', value: prioridadAlta, color: 'red',   onClick: () => irAConsultar('') },
  ]

  /* ── Próximos vencimientos — reales, ordenados por urgencia ── */
  const conFechaLimite = noConcluidos.filter(t => t.idFus?.fechaLimite)
  const badgeRelativo = (fechaLimiteIso) => {
    const dias = Math.round((new Date(fechaLimiteIso).getTime() - ahora) / DIA_MS)
    if (dias < 0) return `Hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`
    if (dias === 0) return 'Hoy'
    return `En ${dias} día${dias === 1 ? '' : 's'}`
  }
  const proximosVencimientos = conFechaLimite
    .slice()
    .sort((a, b) => new Date(a.idFus.fechaLimite) - new Date(b.idFus.fechaLimite))
    .slice(0, 5)
    .map(t => {
      const prioridad = t.idFus?.prioridad
      let tipo, icon, badge
      if (prioridad === 'Alta') { tipo = 'red'; icon = ICON_FLAG; badge = 'Prioridad alta' }
      else if (prioridad === 'Media') { tipo = 'amber'; icon = ICON_CLOCK; badge = 'Prioridad media' }
      else { tipo = 'blue'; icon = ICON_HOURGLASS; badge = badgeRelativo(t.idFus.fechaLimite) }
      return { id: t.id, folio: t.idFus.folio, asunto: t.idFus.descripcion || 'Sin descripción', tipo, icon, badge }
    })

  /* ── FUS atendidos esta semana (real, agrupado por día — lunes a domingo) ── */
  const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const inicioSemana = new Date(ahora)
  inicioSemana.setHours(0, 0, 0, 0)
  inicioSemana.setDate(inicioSemana.getDate() - ((inicioSemana.getDay() + 6) % 7))
  const atendidosPorDia = DIAS_SEMANA.map((dia, i) => {
    const d = new Date(inicioSemana); d.setDate(d.getDate() + i)
    const dNext = new Date(d); dNext.setDate(dNext.getDate() + 1)
    const value = turnados.filter(t => {
      if (t.estatusTitular !== 'Concluido' || !t.idFus?.fechaConclusion) return false
      const fc = new Date(t.idFus.fechaConclusion)
      return fc >= d && fc < dNext
    }).length
    return { dia, value }
  })
  const totalSemanaActual = atendidosPorDia.reduce((s, d) => s + d.value, 0)
  const inicioSemanaAnt = new Date(inicioSemana)
  inicioSemanaAnt.setDate(inicioSemanaAnt.getDate() - 7)
  const totalSemanaAnterior = turnados.filter(t => {
    if (t.estatusTitular !== 'Concluido' || !t.idFus?.fechaConclusion) return false
    const fc = new Date(t.idFus.fechaConclusion)
    return fc >= inicioSemanaAnt && fc < inicioSemana
  }).length
  const notaSemana = totalSemanaActual > totalSemanaAnterior ? 'Mejor que la semana pasada'
    : totalSemanaActual < totalSemanaAnterior ? 'Menos que la semana pasada'
    : 'Igual que la semana pasada'

  /* ── Próximo FUS por atender (mayor prioridad, luego más próximo a vencer) ── */
  const proximoFus = noConcluidos.slice().sort((a, b) => {
    const pa = a.idFus?.prioridad === 'Alta' ? 0 : a.idFus?.prioridad === 'Media' ? 1 : 2
    const pb = b.idFus?.prioridad === 'Alta' ? 0 : b.idFus?.prioridad === 'Media' ? 1 : 2
    if (pa !== pb) return pa - pb
    const fa = a.idFus?.fechaLimite ? new Date(a.idFus.fechaLimite).getTime() : Infinity
    const fb = b.idFus?.fechaLimite ? new Date(b.idFus.fechaLimite).getTime() : Infinity
    return fa - fb
  })[0]
  const tiempoRestanteTexto = (fechaLimiteIso) => {
    if (!fechaLimiteIso) return 'Sin fecha límite'
    const diffMs = new Date(fechaLimiteIso).getTime() - ahora
    if (diffMs <= 0) return 'Vencido'
    const horas = diffMs / (60 * 60 * 1000)
    if (horas < 24) return `${Math.round(horas)} hora${Math.round(horas) === 1 ? '' : 's'}`
    return `${Math.round(horas / 24)} día${Math.round(horas / 24) === 1 ? '' : 's'}`
  }

  /* ── Productividad del día — concluidos hoy vs. lo que debía atenderse hoy
     (concluidos hoy + activos con fecha límite hoy o ya vencida). Derivado de
     los mismos datos ya cargados, sin endpoint nuevo. ── */
  const inicioHoy = new Date(ahora); inicioHoy.setHours(0, 0, 0, 0)
  const finHoy = new Date(inicioHoy); finHoy.setDate(finHoy.getDate() + 1)
  const concluidosHoy = turnados.filter(t => {
    if (t.estatusTitular !== 'Concluido' || !t.idFus?.fechaConclusion) return false
    const fc = new Date(t.idFus.fechaConclusion)
    return fc >= inicioHoy && fc < finHoy
  }).length
  const pendientesVencenHoyOAntes = noConcluidos.filter(t => t.idFus?.fechaLimite && new Date(t.idFus.fechaLimite) < finHoy).length
  const totalHoy = concluidosHoy + pendientesVencenHoyOAntes
  const productividadPct = totalHoy > 0 ? Math.round((concluidosHoy / totalHoy) * 100) : 0
  const DONUT_R = 62, DONUT_CIRC = 2 * Math.PI * DONUT_R
  const donutOffset = DONUT_CIRC * (1 - productividadPct / 100)

  if (cargando && turnados.length === 0) {
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
        <div className="dash2-wrap">

          {errorCarga && turnados.length > 0 && (
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
              <p>Organiza tu trabajo del día</p>
            </header>

            <div className="kpi2-row">
              {kpisGlass.map((k, i) => <Kpi2Card key={k.label} {...k} index={i} />)}
            </div>

            <div className="dash2-grid-bottom">
              <div className="dash2-card">
                <div className="dash2-card-title">Próximos vencimientos</div>
                <p className="dash-subtitle">FUS que requieren tu atención</p>
                {proximosVencimientos.length === 0 ? (
                  <p className="dash-empty">Ninguna de tus solicitudes activas tiene fecha límite próxima.</p>
                ) : (
                  <>
                    {proximosVencimientos.map(v => (
                      <div
                        key={v.id}
                        className="venc-item venc-item-clickable"
                        onClick={() => irAlFus(v.folio)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && irAlFus(v.folio)}
                      >
                        <div className={`venc-icon venc-icon--${v.tipo}`}>{v.icon}</div>
                        <div className="venc-texto">
                          <div className="venc-folio">{v.folio}</div>
                          <div className="venc-fecha">{v.asunto}</div>
                        </div>
                        <span className={`venc-badge venc-badge--${v.tipo}`}>{v.badge}</span>
                      </div>
                    ))}
                    <div className="ver-todos" onClick={() => irAConsultar('')}>
                      Ver todos mis vencimientos {ICON_ARROW_RIGHT}
                    </div>
                  </>
                )}
              </div>

              <div className="dash2-card proximo-card">
                <div className="dash-subtitle" style={{ marginBottom: 2 }}>Próximo FUS por atender</div>
                <p className="dash-subtitle" style={{ marginBottom: 16 }}>Tu siguiente prioridad</p>
                {!proximoFus ? (
                  <p className="dash-empty">No tienes solicitudes activas pendientes.</p>
                ) : (
                  <>
                    <div className="proximo-top">
                      <span className="proximo-folio">{proximoFus.idFus?.folio}</span>
                      {proximoFus.idFus?.prioridad === 'Alta' && (
                        <span className="proximo-badge">{ICON_FLAG} Prioridad alta</span>
                      )}
                    </div>
                    <div className="proximo-grid">
                      <div><div className="proximo-l">Unidad</div><div className="proximo-v">{proximoFus.idFus?.direccionComisionado || '—'}</div></div>
                      <div><div className="proximo-l">Asunto</div><div className="proximo-v">{proximoFus.idFus?.descripcion || '—'}</div></div>
                      <div><div className="proximo-l">Tiempo restante</div><div className="proximo-v">{ICON_HOURGLASS} {tiempoRestanteTexto(proximoFus.idFus?.fechaLimite)}</div></div>
                    </div>
                    <button type="button" className="proximo-btn" onClick={() => irAlFus(proximoFus.idFus?.folio)}>
                      Responder ahora {ICON_ARROW_RIGHT}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="dash2-grid-bottom">
              <div className="dash2-card">
                <div className="dash2-card-title">
                  FUS atendidos esta semana
                  <span className="dash2-pill">Esta semana</span>
                </div>
                <p className="dash-subtitle">Cantidad de FUS que has finalizado</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={atendidosPorDia} margin={{ top: 10, right: 10, left: -20, bottom: 8 }}>
                    <CartesianGrid vertical={false} stroke="#f0f0f2" />
                    <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} />
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
                <div className="dash2-chart-foot">{ICON_TREND_UP} {notaSemana}</div>
              </div>

              <div className="dash2-card prod-card">
                <div className="prod-card-head">
                  <div className="dash2-card-title">Productividad del día</div>
                  <p className="dash-subtitle">Tu avance del día</p>
                </div>
                <div className="donut-wrap">
                  <svg width="150" height="150" viewBox="0 0 150 150">
                    <circle cx="75" cy="75" r={DONUT_R} fill="none" stroke="rgba(0,0,0,.08)" strokeWidth="14" />
                    <circle
                      cx="75" cy="75" r={DONUT_R} fill="none" stroke="#2f7a4f" strokeWidth="14"
                      strokeDasharray={DONUT_CIRC} strokeDashoffset={donutOffset} strokeLinecap="round"
                      transform="rotate(-90 75 75)"
                    />
                  </svg>
                  <div className="donut-pct">{productividadPct}%</div>
                </div>
                <div className="prod-count">{concluidosHoy} de {totalHoy} <span>FUS atendidos</span></div>
                <div className="prod-note">{ICON_TREND_UP} {productividadPct >= 50 ? 'Buen progreso' : 'Sigue así'}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
