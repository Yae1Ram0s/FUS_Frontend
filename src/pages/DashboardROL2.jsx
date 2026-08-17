import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import ModalVencimientos from '../components/ModalVencimientos'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import { useNotificaciones } from '../context/NotificacionesContext'
import { useCountUp } from '../hooks/useCountUp'
import './DashboardROL1.css'

const DIA_MS = 86_400_000

// Todo lo que no sea "Concluido" — mismo criterio que DashboardROL1, usado
// para que el KPI "Prioridad alta" (que solo cuenta lo aún sin concluir) y
// el filtro al que lleva el clic muestren exactamente el mismo conjunto.
const ESTADOS_NO_CONCLUIDO = ['Recibido', 'En_seguimiento', 'Pendiente_validacion', 'Rechazado']

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
      <div className="kpi2-copy">
        <div className="kpi2-label">{label}</div>
        <div className="kpi2-sub">{sub}</div>
      </div>
      <div className="kpi2-value">{count}</div>
    </div>
  )
}

export default function DashboardROL2() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const nombre = user?.nombre || user?.email || 'Usuario'
  const [mostrarVencimientos, setMostrarVencimientos] = useState(false)

  const {
    // ahora:0 solo se usa antes de la primera carga, mientras turnados sigue
    // vacío y la pantalla muestra el Spinner — su valor real es irrelevante.
    data: dashboard = { turnados: [], ahora: 0 },
    isFetching: cargando,
    error: errorCarga,
    refetch: reintentar,
  } = useQuery({
    queryKey: ['dashboardRol2'],
    // ahora se recalcula con cada carga para mantener vigentes los tiempos
    // relativos; refetchInterval reemplaza el setInterval manual de abajo
    // que existía solo para mantener correcto el corte de semana.
    queryFn: async ({ signal }) => ({ turnados: await fetchAll('/turnados/mis-turnados/', {}, signal), ahora: Date.now() }),
    refetchInterval: 60_000,
  })
  const { turnados, ahora } = dashboard

  // En vivo: cualquier notificación ligada a un FUS (turnado nuevo, respuesta,
  // concluir, etc.) refresca el dashboard completo — mismo patrón que
  // DashboardROL1/ConsultarFUS/SolicitudesTurnadas/FUSComisionados.
  const notifCtx = useNotificaciones()
  const ultimaNotif = notifCtx?.notifs?.[0]
  const ultimaNotifId = ultimaNotif?.id
  const ultimaNotifFolio = ultimaNotif?.fusFolio
  useEffect(() => {
    if (!ultimaNotifFolio) return
    reintentar()
  }, [reintentar, ultimaNotifFolio, ultimaNotifId])

  const irAConsultar = (estatus) => navigate(`/rol2/solicitudes?modo=lista${estatus ? `&filtro=${encodeURIComponent(estatus)}` : ''}`)
  const irAConsultarPrioridad = (prioridad) => navigate(
    `/rol2/solicitudes?modo=lista&prioridad=${encodeURIComponent(prioridad)}&filtro=${encodeURIComponent(ESTADOS_NO_CONCLUIDO.join(','))}`
  )
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
    { icon: ICON_INBOX,    label: 'Recibidos',      sub: 'Por atender', value: misPendientes,  color: 'amber', onClick: () => irAConsultar('Recibido') },
    { icon: ICON_ACTIVITY, label: 'En seguimiento', sub: 'Atendiendo',  value: enProceso,      color: 'blue',  onClick: () => irAConsultar('En_seguimiento') },
    { icon: ICON_CHECK,    label: 'Concluidos',     sub: 'Completados', value: finalizadas,    color: 'green', onClick: () => irAConsultar('Concluido') },
    { icon: ICON_FLAG,     label: 'Prioridad alta', sub: 'Sin concluir', value: prioridadAlta, color: 'red',   onClick: () => irAConsultarPrioridad('Alta') },
  ]

  /* ── Próximos vencimientos — reales, ordenados por urgencia ── */
  const conFechaLimite = noConcluidos.filter(t => t.idFus?.fechaLimite)
  const badgeRelativo = (fechaLimiteIso) => {
    const dias = Math.round((new Date(fechaLimiteIso).getTime() - ahora) / DIA_MS)
    if (dias < 0) return `Hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`
    if (dias === 0) return 'Hoy'
    return `En ${dias} día${dias === 1 ? '' : 's'}`
  }
  const mapVencimiento = t => {
    const prioridad = t.idFus?.prioridad
    let tipo, icon, badge
    if (prioridad === 'Alta') { tipo = 'red'; icon = ICON_FLAG; badge = 'Prioridad alta' }
    else if (prioridad === 'Media') { tipo = 'amber'; icon = ICON_CLOCK; badge = 'Prioridad media' }
    else { tipo = 'blue'; icon = ICON_HOURGLASS; badge = badgeRelativo(t.idFus.fechaLimite) }
    return { id: t.id, folio: t.idFus.folio, asunto: t.idFus.descripcion || 'Sin descripción', tipo, icon, badge }
  }
  const ordenVencimientos = conFechaLimite
    .slice()
    .sort((a, b) => new Date(a.idFus.fechaLimite) - new Date(b.idFus.fechaLimite))
  const proximosVencimientos = ordenVencimientos.slice(0, 5).map(mapVencimiento)
  // El modal muestra los siguientes en la fila, no un duplicado de los que
  // ya se ven en la tarjeta — y al derivarse de `turnados` en cada render,
  // se mantiene en vivo igual que el resto del dashboard.
  const otrosVencimientos = ordenVencimientos.slice(5).map(mapVencimiento)

  /* ── FUS atendidos esta semana (real, agrupado por día — solo hábiles, lunes a viernes) ── */
  const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
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
  const finSemanaAntHabil = new Date(inicioSemanaAnt)
  finSemanaAntHabil.setDate(finSemanaAntHabil.getDate() + 5)
  const totalSemanaAnterior = turnados.filter(t => {
    if (t.estatusTitular !== 'Concluido' || !t.idFus?.fechaConclusion) return false
    const fc = new Date(t.idFus.fechaConclusion)
    return fc >= inicioSemanaAnt && fc < finSemanaAntHabil
  }).length
  // Con 0 y 0 la comparación "igual que la semana pasada" es técnicamente
  // cierta pero engañosa — suena a que sí hubo actividad y se mantuvo, cuando
  // en realidad no se ha atendido nada en ninguna de las dos semanas.
  const haySemanaActividad = totalSemanaActual > 0 || totalSemanaAnterior > 0
  const notaSemana = !haySemanaActividad ? 'Aún no hay FUS atendidos'
    : totalSemanaActual > totalSemanaAnterior ? 'Mejor que la semana pasada'
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

  if (cargando && turnados.length === 0) {
    return <AppLayout><div className="dash-bg"><Spinner overlay={false} fill label="Cargando dashboard…" /></div></AppLayout>
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

            {/* Próximo FUS por atender + FUS atendidos esta semana, uno al lado
                del otro — dash2-grid-bottom es 2 columnas en desktop y colapsa
                a 1 en móvil (ver @media en DashboardROL1.css), así que este
                acomodo lado a lado queda solo para PC sin CSS aparte. */}
            <div className="dash2-grid-bottom">
              <div className="dash2-card proximo-card">
                <div className="proximo-heading">
                  <div className="proximo-heading-icon" aria-hidden="true">{ICON_HOURGLASS}</div>
                  <div className="proximo-heading-copy">
                    <div className="proximo-title">Próximo FUS por atender</div>
                    <p className="proximo-subtitle">Tu siguiente prioridad</p>
                  </div>
                </div>
                {!proximoFus ? (
                  <p className="dash-empty">No tienes solicitudes activas pendientes.</p>
                ) : (
                  <>
                    <div className="proximo-top">
                      <div className="proximo-folio-block">
                        <span className="proximo-folio-label">Folio</span>
                        <button
                          type="button"
                          className="proximo-folio proximo-folio-link"
                          onClick={() => irAlFus(proximoFus.idFus?.folio)}
                          aria-label={`Ver detalle de ${proximoFus.idFus?.folio}`}
                        >
                          {proximoFus.idFus?.folio}
                        </button>
                      </div>
                      {proximoFus.idFus?.prioridad === 'Alta' && (
                        <span className="proximo-badge">{ICON_FLAG} Prioridad alta</span>
                      )}
                    </div>
                    <div className="proximo-grid">
                      <div className="proximo-field proximo-field-unidad"><div className="proximo-l">Unidad</div><div className="proximo-v">{proximoFus.idFus?.direccionComisionado || '—'}</div></div>
                      <div className="proximo-field proximo-field-asunto"><div className="proximo-l">Asunto</div><div className="proximo-v">{proximoFus.idFus?.descripcion || '—'}</div></div>
                      <div className="proximo-field proximo-field-tiempo"><div className="proximo-l">Tiempo restante</div><div className="proximo-v">{ICON_HOURGLASS} {tiempoRestanteTexto(proximoFus.idFus?.fechaLimite)}</div></div>
                    </div>
                    <button type="button" className="proximo-btn" onClick={() => irAlFus(proximoFus.idFus?.folio)}>
                      Responder ahora {ICON_ARROW_RIGHT}
                    </button>
                  </>
                )}
              </div>

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
                <div className="dash2-chart-foot">{haySemanaActividad && ICON_TREND_UP} {notaSemana}</div>
              </div>
            </div>

            <div className="dash2-grid-bottom dash2-grid-bottom-single">
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
                    <div className="ver-todos" onClick={() => setMostrarVencimientos(true)}>
                      Ver todos mis vencimientos {ICON_ARROW_RIGHT}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {mostrarVencimientos && (
        <ModalVencimientos
          vencimientos={otrosVencimientos}
          onClose={() => setMostrarVencimientos(false)}
          onSelect={folio => { setMostrarVencimientos(false); irAlFus(folio) }}
        />
      )}
    </AppLayout>
  )
}
