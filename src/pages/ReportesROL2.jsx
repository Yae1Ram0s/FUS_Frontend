import { useCallback, useEffect, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import FechaInput from '../components/FechaInput'
import api from '../api/api'
import { useNotificaciones } from '../context/NotificacionesContext'
import { useCountUp } from '../hooks/useCountUp'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { PRIORIDAD_NIVELES } from '../utils/prioridades'
import './DashboardROL1.css'
import './Reportes.css'

const COLORES = ['#1F5647', '#c9a227', '#4da3e0', '#a35fb0', '#e0805f', '#5fae3f', '#8a93a8']

const ICON_LAYERS = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
)
const ICON_CHECK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
)
const ICON_FOLDER = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
)
const ICON_ALARM = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M5 3 2 6"/><path d="M22 6l-3-3"/>
  </svg>
)
const ICON_CLOCK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)
const ICON_FLAG = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
  </svg>
)
const ICON_UP = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
  </svg>
)
const ICON_DOWN = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
  </svg>
)
const ICON_TREND = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
)
const ICON_LIST = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)

const fechaISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const mesInput = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/* Bloque de N meses de calendario que TERMINA en el mes de referencia (año, mes 0-index) */
function rangoMeses(anio, mesIdx, cantidad) {
  const inicio = new Date(anio, mesIdx - cantidad + 1, 1)
  const fin = new Date(anio, mesIdx + 1, 0)
  return { fecha_inicio: fechaISO(inicio), fecha_fin: fechaISO(fin) }
}

const MESES_POR_TIPO = { Mes: 1, Trimestre: 3, Semestre: 6, Año: 12 }
const TOOLTIP_STYLE = {
  contentStyle: { borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: 12 },
  wrapperStyle: { zIndex: 20 },
}

const hoy = new Date()

function mesAnterior(valorMesInput) {
  const [anio, mes] = valorMesInput.split('-').map(Number)
  const d = new Date(anio, mes - 2, 1)
  return mesInput(d)
}

const ESTADO_LABELS = {
  Recibido: 'Recibido',
  En_seguimiento: 'En seguimiento',
  Pendiente_validacion: 'Pendiente de validación',
  Concluido: 'Concluido',
  Rechazado: 'Rechazado',
}

/* ── Tarjeta de KPI con badge de variación vs periodo anterior — mismo
   componente que Reportes.jsx (ROL1), duplicado aquí porque no se exporta
   desde allá (cada página arma sus propias piezas visuales pequeñas). ── */
function KpiCard({ icon, label, value, sufijo, color, delta, deltaTexto, mejorSiSube, entero = true, index }) {
  const count = useCountUp(entero ? value : 0)
  const sube = delta > 0
  const positivo = delta === 0 ? null : sube === mejorSiSube
  return (
    <div className="kpi2-card rep-kpi-card" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className={`kpi2-glow kpi2-glow--${color}`} />
      <div className={`kpi2-icon kpi2-icon--${color}`}>{icon}</div>
      <div className="kpi2-label">{label}</div>
      <div className="kpi2-value">{(entero ? count : value).toLocaleString('es-MX')}{sufijo}</div>
      {delta !== null && (
        <div className={`rep-kpi-delta${positivo === null ? '' : positivo ? ' rep-kpi-delta--up' : ' rep-kpi-delta--down'}`}>
          {sube ? ICON_UP : delta < 0 ? ICON_DOWN : null}
          <span>{deltaTexto}</span>
        </div>
      )}
    </div>
  )
}

function Panel({ titulo, icon, children, className = '' }) {
  return (
    <div className={`dash2-card rep-panel ${className}`}>
      <div className="dash2-card-title">
        <span className="rep-panel-title"><span className="rep-panel-icon">{icon}</span>{titulo}</span>
      </div>
      {children}
    </div>
  )
}

function DonutEstados({ data }) {
  const total = data.reduce((s, d) => s + d.cantidad, 0)
  let acc = 0
  const stops = total > 0
    ? data.map((d, i) => {
        const start = (acc / total) * 360
        acc += d.cantidad
        const end = (acc / total) * 360
        return `${COLORES[i % COLORES.length]} ${start}deg ${end}deg`
      }).join(', ')
    : null
  return (
    <div className="dash-donut-multi-wrap">
      <div className="dash-donut-multi-figure">
        <div className={`dash-donut-multi-ring${total === 0 ? ' dash-donut-multi-empty' : ''}`} style={total > 0 ? { background: `conic-gradient(${stops})` } : undefined} />
        <div className="dash-donut-multi-total">
          <span className="dash-donut-multi-total-value">{total}</span>
          <span className="dash-donut-multi-total-label">Total</span>
        </div>
      </div>
      <ul className="dash-donut-legend">
        {data.map((d, i) => (
          <li key={d.nombre}>
            <span className="dash-dot" style={{ background: COLORES[i % COLORES.length] }} />
            <span className="dash-legend-label">{ESTADO_LABELS[d.nombre] || d.nombre}</span>
            <span className="dash-legend-value">{d.porcentaje}% ({d.cantidad})</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function NotaTruncado({ mostrados, total }) {
  if (total <= mostrados) return null
  return <p className="rep-nota-truncado">Mostrando {mostrados} de {total} — descarga el Excel para ver el listado completo.</p>
}

function TablaDetalle({ filas }) {
  if (!filas.length) return <p className="dash-empty">Sin turnados en el periodo seleccionado.</p>
  const LIMITE = 10
  return (
    <>
      <div className="dash-table-scroll">
        <table className="dash-table rep-table">
          <thead><tr><th>Folio</th><th>Estado</th><th>Prioridad</th><th>Solicitante</th><th>Recibido</th><th>Fecha límite</th></tr></thead>
          <tbody>
            {filas.slice(0, LIMITE).map(f => (
              <tr key={f.folio}>
                <td>{f.folio}</td>
                <td>{ESTADO_LABELS[f.estado] || f.estado}</td>
                <td>{f.prioridad}</td>
                <td className="dash-td-desc">{f.solicitante}</td>
                <td>{f.fecha_recibido}</td>
                <td className={f.vencido ? 'rep-td-alerta' : ''}>{f.fecha_limite || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <NotaTruncado mostrados={Math.min(LIMITE, filas.length)} total={filas.length} />
    </>
  )
}

export default function ReportesROL2() {
  const [tipoPeriodo, setTipoPeriodo] = useState('Mes')
  const [mesRef, setMesRef] = useState(mesInput(hoy))
  const [compararCon, setCompararCon] = useState(() => mesAnterior(mesInput(hoy)))
  const [personalizado, setPersonalizado] = useState({ fecha_inicio: `${hoy.getFullYear()}-01-01`, fecha_fin: fechaISO(hoy) })
  const [filtrosExtra, setFiltrosExtra] = useState({ estatus: '', prioridad: '' })
  const [exportando, setExportando] = useState(false)

  const rangoFechas = tipoPeriodo === 'Personalizado'
    ? personalizado
    : (() => {
        const [anio, mes] = mesRef.split('-').map(Number)
        return rangoMeses(anio, mes - 1, MESES_POR_TIPO[tipoPeriodo])
      })()

  const aplicados = {
    ...rangoFechas,
    ...filtrosExtra,
    ...(tipoPeriodo === 'Mes' && compararCon ? { comparar_con: compararCon } : {}),
  }

  const cargarOpciones = useCallback(({ signal }) => api.get('/reportes/titular/opciones/', { signal }).then(r => r.data), [])
  const { data: opciones } = useAsyncResource(cargarOpciones, { initialData: { estados: [] } })

  const aplicadosKey = JSON.stringify(aplicados)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- se depende de `aplicadosKey`, no de `aplicados` (objeto nuevo cada render), a propósito
  const cargar = useCallback(({ signal }) => api.get('/reportes/titular/resumen/', { params: aplicados, signal }).then(r => r.data), [aplicadosKey])
  const { data, loading, error, reload } = useAsyncResource(cargar)

  // En vivo: cualquier notificación ligada a un FUS recalcula el reporte —
  // mismo patrón que el resto de las pantallas (dashboards, Reportes ROL1).
  const notifCtx = useNotificaciones()
  const ultimaNotifFolio = notifCtx?.notifs?.[0]?.fusFolio
  const ultimaNotifId = notifCtx?.notifs?.[0]?.id
  useEffect(() => {
    if (!ultimaNotifFolio) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `reload` se recrea cada render; `ultimaNotifFolio`/`ultimaNotifId` ya identifican el cambio real
  }, [ultimaNotifFolio, ultimaNotifId])

  const cambiarTipoPeriodo = (tipo) => {
    setTipoPeriodo(tipo)
    if (tipo === 'Mes') setCompararCon(mesAnterior(mesRef))
  }
  const cambiarMesRef = (valor) => {
    setMesRef(valor)
    setCompararCon(mesAnterior(valor))
  }
  const actualizarExtra = e => setFiltrosExtra(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const exportar = async () => {
    setExportando(true)
    try {
      const response = await api.post('/reportes/titular/exportar/excel/', {}, { params: aplicados, responseType: 'blob' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(response.data)
      link.download = 'reporte_titular.xlsx'
      link.click()
      URL.revokeObjectURL(link.href)
    } finally {
      setExportando(false)
    }
  }

  const resumen = data?.resumen
  const anterior = data?.comparacion?.anterior
  const deltas = data?.comparacion?.deltas
  const etiquetaComparacion = data?.comparacion?.etiqueta || 'periodo anterior'

  const deltaDias = (actualVal, anteriorVal) => {
    if (anterior === undefined) return null
    const diff = Math.round((actualVal - anteriorVal) * 10) / 10
    return { valor: diff, texto: `${diff > 0 ? '+' : ''}${diff} días vs ${etiquetaComparacion}` }
  }
  const deltaPct = (campo) => {
    if (!deltas) return null
    const pct = deltas[campo]
    return { valor: pct, texto: `${pct > 0 ? '+' : ''}${pct}% vs ${etiquetaComparacion}` }
  }

  const respuestaDelta = anterior ? deltaDias(resumen.tiempo_promedio_respuesta, anterior.tiempo_promedio_respuesta) : null
  const conclusionDelta = anterior ? deltaDias(resumen.tiempo_promedio_conclusion, anterior.tiempo_promedio_conclusion) : null
  const deltaTotal = deltaPct('total')
  const deltaConcluidos = deltaPct('concluidos')
  const deltaPendientes = deltaPct('pendientes')
  const deltaVencidos = deltaPct('vencidos')

  return (
    <AppLayout>
      <div className="dash-bg rep-bg">
        <div className="dash2-ambient">
          <div className="dash2-blob dash2-blob--1" />
          <div className="dash2-blob dash2-blob--2" />
          <div className="dash2-blob dash2-blob--3" />
        </div>

        <div className="dash2-wrap rep-wrap">
          <div className="dash2-content">

            <header className="rep-header">
              <div className="rep-heading">
                <span className="rep-heading-icon">{ICON_LAYERS}</span>
                <div>
                  <h1>Mis reportes</h1>
                  <p>
                    Desempeño de tus turnados — Titular / Enlace Estratégico
                    {loading && data && <span className="btn-spinner rep-heading-spinner" />}
                  </p>
                </div>
              </div>
              <div className="rep-export">
                <button type="button" disabled={exportando} onClick={exportar}>
                  {exportando ? 'Generando…' : 'Descargar Excel'}
                </button>
              </div>
            </header>

            {error && !data && (
              <div className="rep-error">
                No fue posible cargar el reporte.
                <button type="button" onClick={reload}>Reintentar</button>
              </div>
            )}
            {error && data && (
              <div className="banner-error-carga">
                <span>No se pudo actualizar — mostrando la última información disponible.</span>
                <button type="button" onClick={reload}>Reintentar</button>
              </div>
            )}

            <section className="rep-filtros dash2-card">
              <div className="rep-filtros-fila">
                <div className="rep-filtro-periodo">
                  <span>Periodo</span>
                  <div className="segmented rep-segmented">
                    {['Mes', 'Trimestre', 'Semestre', 'Año', 'Personalizado'].map(t => (
                      <button key={t} type="button" className={tipoPeriodo === t ? 'active' : ''} onClick={() => cambiarTipoPeriodo(t)}>{t}</button>
                    ))}
                  </div>
                </div>

                {tipoPeriodo === 'Personalizado' ? (
                  <>
                    <label>Desde<FechaInput type="date" value={personalizado.fecha_inicio} onChange={e => setPersonalizado(p => ({ ...p, fecha_inicio: e.target.value }))} /></label>
                    <label>Hasta<FechaInput type="date" value={personalizado.fecha_fin} onChange={e => setPersonalizado(p => ({ ...p, fecha_fin: e.target.value }))} /></label>
                  </>
                ) : (
                  <label>{tipoPeriodo}<input type="month" value={mesRef} onChange={e => cambiarMesRef(e.target.value)} /></label>
                )}

                {tipoPeriodo === 'Mes' && (
                  <label>Comparar con<input type="month" value={compararCon} onChange={e => setCompararCon(e.target.value)} /></label>
                )}

                <label>Estado
                  <select name="estatus" value={filtrosExtra.estatus} onChange={actualizarExtra}>
                    <option value="">Todos</option>
                    {opciones.estados.map(e => <option key={e} value={e}>{ESTADO_LABELS[e] || e}</option>)}
                  </select>
                </label>
                <label>Prioridad
                  <select name="prioridad" value={filtrosExtra.prioridad} onChange={actualizarExtra}>
                    <option value="">Todas</option>
                    {PRIORIDAD_NIVELES.map(p => <option key={p.valor}>{p.valor}</option>)}
                  </select>
                </label>
              </div>
            </section>

            {loading && !data && <Spinner overlay={false} fill label="Calculando indicadores…" />}

            {data && (
              <div className={`rep-resultados${loading ? ' rep-resultados--refrescando' : ''}`}>
                <div className="kpi2-row rep-kpi-row">
                  <KpiCard index={0} color="blue" icon={ICON_LAYERS} label="Total turnados" value={resumen.total} delta={deltaTotal?.valor ?? 0} deltaTexto={deltaTotal?.texto} mejorSiSube />
                  <KpiCard index={1} color="green" icon={ICON_CHECK} label="Concluidos" value={resumen.concluidos} delta={deltaConcluidos?.valor ?? 0} deltaTexto={deltaConcluidos?.texto} mejorSiSube />
                  <KpiCard index={2} color="amber" icon={ICON_FOLDER} label="Pendientes" value={resumen.pendientes} delta={deltaPendientes?.valor ?? 0} deltaTexto={deltaPendientes?.texto} mejorSiSube={false} />
                  <KpiCard index={3} color="red" icon={ICON_ALARM} label="Vencidos" value={resumen.vencidos} delta={deltaVencidos?.valor ?? 0} deltaTexto={deltaVencidos?.texto} mejorSiSube={false} />
                  <KpiCard index={4} color="blue" icon={ICON_CLOCK} label="Tiempo promedio de respuesta" value={resumen.tiempo_promedio_respuesta} sufijo=" días" entero={false} delta={respuestaDelta?.valor ?? 0} deltaTexto={respuestaDelta?.texto} mejorSiSube={false} />
                  <KpiCard index={5} color="green" icon={ICON_FLAG} label="Tiempo promedio de conclusión" value={resumen.tiempo_promedio_conclusion} sufijo=" días" entero={false} delta={conclusionDelta?.valor ?? 0} deltaTexto={conclusionDelta?.texto} mejorSiSube={false} />
                </div>

                <div className="rep-grid">
                  <Panel titulo="Evolución mensual de turnados" icon={ICON_TREND} className="rep-span-2">
                    {data.evolucion.length === 0 ? <p className="dash-empty">Sin datos en el periodo.</p> : (
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={data.evolucion} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="#f0f0f2" />
                          <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip {...TOOLTIP_STYLE} />
                          <Line type="monotone" dataKey="recibidos" name="Recibidos" stroke="#1F5647" strokeWidth={2.5} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="concluidos" name="Concluidos" stroke="#c9a227" strokeWidth={2.5} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="vencidos" name="Vencidos" stroke="#b91c1c" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </Panel>

                  <Panel titulo="Distribución por estado" icon={ICON_FOLDER}>
                    <DonutEstados data={data.estados} />
                  </Panel>

                  <Panel titulo="Distribución por prioridad" icon={ICON_FLAG}>
                    <ResponsiveContainer width="100%" height={170}>
                      <BarChart data={data.prioridad} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                        <XAxis dataKey="nombre" tick={{ fontSize: 10.5, fill: '#86868b' }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(31,86,71,0.06)' }} />
                        <Bar dataKey="cantidad" name="Turnados" radius={[8, 8, 0, 0]}>
                          {data.prioridad.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Panel>

                  <Panel titulo="Distribución de tiempos de respuesta" icon={ICON_CLOCK}>
                    <ResponsiveContainer width="100%" height={170}>
                      <BarChart data={data.tiempos} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                        <XAxis dataKey="rango" tick={{ fontSize: 10.5, fill: '#86868b' }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(31,86,71,0.06)' }} />
                        <Bar dataKey="cantidad" name="Turnados" radius={[8, 8, 0, 0]}>
                          {data.tiempos.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Panel>

                  <Panel titulo="Detalle de turnados" icon={ICON_LIST} className="rep-span-full">
                    <TablaDetalle filas={data.detalle} />
                  </Panel>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </AppLayout>
  )
}
