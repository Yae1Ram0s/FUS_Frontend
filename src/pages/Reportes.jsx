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
const ICON_ARCHIVE = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
  </svg>
)
const ICON_DOWNLOAD = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const ICON_TRASH = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)
const ICON_CHEVRON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)
const ICON_TREND = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
)
const ICON_USERS = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const ICON_BUILDING = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="1"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><line x1="9" y1="18" x2="15" y2="18"/>
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

/* ── Tarjeta de KPI con badge de variación vs periodo anterior ──
   `entero`: activa la animación useCountUp — solo para conteos (Total,
   Concluidos...), NUNCA para los KPI en días (2.8, 5.6...): useCountUp
   redondea internamente (Math.round), así que animar un decimal con él le
   comería el punto decimal tanto durante la animación como al terminar. */
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
            <span className="dash-legend-label">{d.nombre}</span>
            <span className="dash-legend-value">{d.porcentaje}% ({d.cantidad})</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function NotaTruncado({ mostrados, total }) {
  if (total <= mostrados) return null
  return <p className="rep-nota-truncado">Mostrando {mostrados} de {total} — exporta el reporte para ver el listado completo.</p>
}

function TablaCarga({ filas, onFilaClick }) {
  if (!filas.length) return <p className="dash-empty">Sin responsables en el periodo seleccionado.</p>
  const LIMITE = 8
  return (
    <>
      <div className="dash-table-scroll rep-carga-scroll">
        <table className="dash-table rep-table rep-table-carga">
          <colgroup>
            <col className="rep-carga-col-responsable" />
            <col className="rep-carga-col-numero" />
            <col className="rep-carga-col-numero" />
            <col className="rep-carga-col-numero" />
            <col className="rep-carga-col-capacidad" />
          </colgroup>
          <thead><tr><th>Responsable</th><th>Asignados</th><th>Pendientes</th><th>Vencidos</th><th>% Capacidad</th></tr></thead>
          <tbody>
            {filas.slice(0, LIMITE).map(f => (
              <tr key={f.responsable} onClick={() => onFilaClick?.(f.responsable)}>
                <td className="rep-carga-responsable" title={f.responsable}>{f.responsable}</td>
                <td>{f.asignados}</td>
                <td>{f.pendientes}</td>
                <td className={f.vencidos > 0 ? 'rep-td-alerta' : ''}>{f.vencidos}</td>
                <td>
                  <span className={`rep-capacidad${f.capacidad >= 90 ? ' rep-capacidad--alta' : ''}`}>
                    <i style={{ width: `${f.capacidad}%` }} />
                  </span>
                  {f.capacidad}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <NotaTruncado mostrados={Math.min(LIMITE, filas.length)} total={filas.length} />
    </>
  )
}

function TablaDetalle({ filas }) {
  if (!filas.length) return <p className="dash-empty">Sin solicitudes en el periodo seleccionado.</p>
  const LIMITE = 10
  return (
    <>
      <div className="dash-table-scroll">
        <table className="dash-table rep-table">
          <thead><tr><th>Folio</th><th>Estado</th><th>Prioridad</th><th>Unidad</th><th>Responsable</th><th>Fecha límite</th></tr></thead>
          <tbody>
            {filas.slice(0, LIMITE).map(f => (
              <tr key={f.folio}>
                <td>{f.folio}</td>
                <td>{f.estado}</td>
                <td>{f.prioridad}</td>
                <td className="dash-td-desc">{f.unidad}</td>
                <td>{f.responsable}</td>
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

/* `delta` (opcional): {valor, texto} real vs periodo anterior — la flecha
   apunta según el signo real. Sin delta (no todos los indicadores tienen uno
   calculado en el backend) se muestra `notaFija` sin flecha, para no sugerir
   una tendencia que no se está midiendo. */
function Mini({ titulo, valor, delta, notaFija }) {
  const baja = delta && delta.valor < 0
  return (
    <div className="rep-mini">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <small className={baja ? 'rep-mini-nota--baja' : ''}>
        {delta && <span className="rep-mini-arrow">{baja ? ICON_DOWN : ICON_UP}</span>}
        {delta ? delta.texto : notaFija}
      </small>
    </div>
  )
}

export default function Reportes() {
  const [tipoPeriodo, setTipoPeriodo] = useState('Mes')
  const [mesRef, setMesRef] = useState(mesInput(hoy))
  const [compararCon, setCompararCon] = useState(() => mesAnterior(mesInput(hoy)))
  const [personalizado, setPersonalizado] = useState({ fecha_inicio: `${hoy.getFullYear()}-01-01`, fecha_fin: fechaISO(hoy) })
  const [filtrosExtra, setFiltrosExtra] = useState({ estatus: '', prioridad: '', unidad: '', responsable: '' })
  const [avanzadoAbierto, setAvanzadoAbierto] = useState(false)
  const [seleccion, setSeleccion] = useState([])
  const [exportando, setExportando] = useState('')
  const [guardarAlExportar, setGuardarAlExportar] = useState(false)
  const [guardadosAbierto, setGuardadosAbierto] = useState(false)

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

  const cargarOpciones = useCallback(({ signal }) => api.get('/reportes/opciones/', { signal }).then(r => r.data), [])
  const seleccionarTodo = useCallback(resultado => setSeleccion(prev => (prev.length ? prev : resultado.secciones.map(s => s.id))), [])
  const { data: opciones } = useAsyncResource(cargarOpciones, {
    initialData: { secciones: [], unidades: [], responsables: [] },
    onSuccess: seleccionarTodo,
  })

  // `aplicados` es un objeto nuevo cada render (se arma con spreads arriba) —
  // se memoiza `cargar` comparando por contenido (aplicadosKey) en vez de
  // por identidad, para no relanzar la petición en cada render sin cambios reales.
  const aplicadosKey = JSON.stringify(aplicados)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ver comentario arriba: se depende de `aplicadosKey`, no de `aplicados`, a propósito
  const cargar = useCallback(({ signal }) => api.get('/reportes/resumen/', { params: aplicados, signal }).then(r => r.data), [aplicadosKey])
  const { data, loading, error, reload } = useAsyncResource(cargar)

  const cargarGuardados = useCallback(({ signal }) => api.get('/reportes/guardados/', { signal }).then(r => r.data), [])
  const { data: guardados, reload: recargarGuardados } = useAsyncResource(cargarGuardados, { initialData: [] })

  // En vivo: cualquier notificación ligada a un FUS recalcula el reporte —
  // mismo patrón que los dashboards (ver DashboardROL1.jsx).
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
  const visible = id => seleccion.includes(id)
  const toggleSeccion = id => setSeleccion(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const exportar = async formato => {
    setExportando(formato)
    try {
      const nombre = `Reporte FUS — ${rangoFechas.fecha_inicio} a ${rangoFechas.fecha_fin}`
      const response = await api.post(
        `/reportes/exportar/${formato}/`,
        { secciones: seleccion, guardar: guardarAlExportar, nombre },
        { params: aplicados, responseType: 'blob' },
      )
      const link = document.createElement('a')
      link.href = URL.createObjectURL(response.data)
      link.download = `reporte_fus.${formato === 'excel' ? 'xlsx' : formato}`
      link.click()
      URL.revokeObjectURL(link.href)
      if (guardarAlExportar) recargarGuardados()
    } finally {
      setExportando('')
    }
  }

  const descargarGuardado = async (g) => {
    const response = await api.get(`/reportes/guardados/${g.id}/descargar/`, { responseType: 'blob' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(response.data)
    link.download = g.nombreArchivo
    link.click()
    URL.revokeObjectURL(link.href)
  }
  const borrarGuardado = async (id) => {
    await api.delete(`/reportes/guardados/${id}/descargar/`)
    recargarGuardados()
  }

  const resumen = data?.resumen
  const deltas = data?.comparacion?.deltas
  const anterior = data?.comparacion?.anterior
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

  // Cada delta se calcula una sola vez aquí (antes se recalculaba 2-3 veces
  // por dato al repetir deltaPct()/deltaDias() directamente en el JSX).
  const respuestaDelta = anterior ? deltaDias(resumen.tiempo_promedio_respuesta, anterior.tiempo_promedio_respuesta) : null
  const conclusionDelta = anterior ? deltaDias(resumen.tiempo_promedio_conclusion, anterior.tiempo_promedio_conclusion) : null
  const deltaTotal = deltaPct('total')
  const deltaConcluidos = deltaPct('concluidos')
  const deltaPendientes = deltaPct('pendientes')
  const deltaVencidos = deltaPct('vencidos')
  const deltaTasaConclusion = deltaPct('tasa_conclusion')

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
                  <h1>Reportes e inteligencia operativa</h1>
                  <p>Indicadores en tiempo real del sistema de control de solicitudes</p>
                </div>
              </div>
              <div className="rep-export">
                {['pdf', 'excel', 'pptx'].map(x => (
                  <button key={x} type="button" disabled={!seleccion.length || exportando} onClick={() => exportar(x)}>
                    {exportando === x ? 'Generando…' : x === 'pptx' ? 'Presentación' : x.toUpperCase()}
                  </button>
                ))}
              </div>
            </header>

            <div className="rep-content">
              <div className="rep-main">
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
              {/* Fila 1: qué periodo se está viendo */}
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
              </div>

              {/* Fila 2: sobre qué recorte de datos (unidad/responsable) + acceso a avanzados */}
              <div className="rep-filtros-fila">
                <label>Unidad administrativa
                  <select name="unidad" value={filtrosExtra.unidad} onChange={actualizarExtra}>
                    <option value="">Todas</option>
                    {opciones.unidades.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                  </select>
                </label>
                <label>Responsable
                  <select name="responsable" value={filtrosExtra.responsable} onChange={actualizarExtra}>
                    <option value="">Todos</option>
                    {opciones.responsables.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                  </select>
                </label>
                <button
                  type="button"
                  className={`rep-btn-avanzado${avanzadoAbierto ? ' rep-btn-avanzado--abierto' : ''}`}
                  onClick={() => setAvanzadoAbierto(v => !v)}
                  aria-expanded={avanzadoAbierto}
                >
                  Filtros avanzados {ICON_CHEVRON}
                </button>
              </div>

              {/* Fila 3 (opcional): estado/prioridad, guardar al exportar, elegir secciones */}
              {avanzadoAbierto && (
                <div className="rep-filtros-fila rep-avanzado">
                  <label>Estado
                    <select name="estatus" value={filtrosExtra.estatus} onChange={actualizarExtra}>
                      <option value="">Todos</option>
                      {['Registrado', 'Turnado', 'En_seguimiento', 'Atendido', 'Pendiente_validacion', 'Rechazado', 'Concluido'].map(x => <option key={x}>{x}</option>)}
                    </select>
                  </label>
                  <label>Prioridad
                    <select name="prioridad" value={filtrosExtra.prioridad} onChange={actualizarExtra}>
                      <option value="">Todas</option>
                      {['Alta', 'Media', 'Baja'].map(x => <option key={x}>{x}</option>)}
                    </select>
                  </label>
                  {/* Guardar + Secciones van juntas, en su propia caja: ambas
                      controlan la exportación (no son un filtro de datos como
                      Estado/Prioridad), así que se agrupan como una sola unidad. */}
                  <div className="rep-grupo-exportar">
                    <label className="rep-check">
                      <input type="checkbox" checked={guardarAlExportar} onChange={e => setGuardarAlExportar(e.target.checked)} />
                      Guardar copia al exportar
                    </label>
                    <details className="rep-selector">
                      <summary>Secciones del reporte ({seleccion.length})</summary>
                      <div>{opciones.secciones.map(s => (
                        <label key={s.id}><input type="checkbox" checked={visible(s.id)} onChange={() => toggleSeccion(s.id)} />{s.nombre}</label>
                      ))}</div>
                    </details>
                  </div>
                </div>
              )}
                </section>

                {loading && !data && <Spinner overlay={false} fill label="Calculando indicadores…" />}

                {data && (
                  <>
                    {visible('resumen') && (
                      <div className="kpi2-row rep-kpi-row">
                        <KpiCard index={0} color="blue" icon={ICON_LAYERS} label="Total de FUS" value={resumen.total} delta={deltaTotal?.valor ?? 0} deltaTexto={deltaTotal?.texto} mejorSiSube />
                        <KpiCard index={1} color="green" icon={ICON_CHECK} label="Concluidos" value={resumen.concluidos} delta={deltaConcluidos?.valor ?? 0} deltaTexto={deltaConcluidos?.texto} mejorSiSube />
                        <KpiCard index={2} color="amber" icon={ICON_FOLDER} label="Pendientes" value={resumen.pendientes} delta={deltaPendientes?.valor ?? 0} deltaTexto={deltaPendientes?.texto} mejorSiSube={false} />
                        <KpiCard index={3} color="red" icon={ICON_ALARM} label="Vencidos" value={resumen.vencidos} delta={deltaVencidos?.valor ?? 0} deltaTexto={deltaVencidos?.texto} mejorSiSube={false} />
                        <KpiCard index={4} color="blue" icon={ICON_CLOCK} label="Tiempo promedio de respuesta" value={resumen.tiempo_promedio_respuesta} sufijo=" días" entero={false} delta={respuestaDelta?.valor ?? 0} deltaTexto={respuestaDelta?.texto} mejorSiSube={false} />
                        <KpiCard index={5} color="green" icon={ICON_FLAG} label="Tiempo promedio de conclusión" value={resumen.tiempo_promedio_conclusion} sufijo=" días" entero={false} delta={conclusionDelta?.valor ?? 0} deltaTexto={conclusionDelta?.texto} mejorSiSube={false} />
                      </div>
                    )}

                    <div className="rep-grid">
                    {visible('evolucion') && (
                      <Panel titulo="Evolución mensual de FUS" icon={ICON_TREND}>
                        {data.evolucion.length === 0 ? <p className="dash-empty">Sin datos en el periodo.</p> : (
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={data.evolucion} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid vertical={false} stroke="#f0f0f2" />
                              <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                              <Tooltip {...TOOLTIP_STYLE} />
                              <Line type="monotone" dataKey="registrados" name="Registrados" stroke="#1F5647" strokeWidth={2.5} dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="concluidos" name="Concluidos" stroke="#c9a227" strokeWidth={2.5} dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="vencidos" name="Vencidos" stroke="#b91c1c" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </Panel>
                    )}

                    {visible('tiempos') && (
                      <Panel titulo="Distribución de tiempos de respuesta" icon={ICON_CLOCK}>
                        <ResponsiveContainer width="100%" height={170}>
                          <BarChart data={data.tiempos} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                            <XAxis dataKey="rango" tick={{ fontSize: 10.5, fill: '#86868b' }} axisLine={false} tickLine={false} />
                            <YAxis hide />
                            <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(31,86,71,0.06)' }} />
                            <Bar dataKey="cantidad" name="FUS" radius={[8, 8, 0, 0]}>
                              {data.tiempos.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </Panel>
                    )}

                    {visible('carga') && (
                      <Panel titulo="Carga de trabajo por responsable" icon={ICON_USERS}>
                        <TablaCarga filas={data.carga} onFilaClick={r => setFiltrosExtra(prev => ({ ...prev, responsable: opciones.responsables.find(x => x.nombre === r)?.id || prev.responsable }))} />
                      </Panel>
                    )}

                    {visible('detalle') && (
                      <Panel titulo="Detalle de FUS por estado y tiempos" icon={ICON_LIST} className="rep-span-full">
                        <TablaDetalle filas={data.detalle} />
                      </Panel>
                    )}
                    </div>
                  </>
                )}
              </div>

              <aside className="rep-aside">
                <div className="dash2-card rep-side-card">
                  <h3
                    className="rep-side-toggle"
                    onClick={() => setGuardadosAbierto(v => !v)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={guardadosAbierto}
                    onKeyDown={e => e.key === 'Enter' && setGuardadosAbierto(v => !v)}
                  >
                    <span className="rep-panel-icon">{ICON_ARCHIVE}</span>Reportes guardados
                    <span className={`rep-side-chevron${guardadosAbierto ? ' rep-side-chevron--abierto' : ''}`}>{ICON_CHEVRON}</span>
                  </h3>
                  {!guardadosAbierto ? (
                    <p className="rep-side-text rep-side-text--pad">Accede a tus reportes generados anteriormente.</p>
                  ) : guardados.length === 0 ? (
                    <p className="dash-empty rep-side-empty">Aún no has guardado ningún reporte.</p>
                  ) : (
                    <ul className="rep-guardados-lista">
                      {guardados.map(g => (
                        <li key={g.id}>
                          <div className="rep-guardado-info">
                            <span className="rep-guardado-nombre">{g.nombre}</span>
                            <span className="rep-guardado-meta">{g.formato.toUpperCase()} · {new Date(g.fechaCreacion).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </div>
                          <div className="rep-guardado-acciones">
                            <button type="button" onClick={() => descargarGuardado(g)} aria-label="Descargar">{ICON_DOWNLOAD}</button>
                            <button type="button" onClick={() => borrarGuardado(g.id)} aria-label="Eliminar">{ICON_TRASH}</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {data && visible('estados') && (
                  <div className="dash2-card rep-side-card rep-side-card--estados">
                    <h3><span className="rep-panel-icon">{ICON_FOLDER}</span>FUS por estado</h3>
                    <DonutEstados data={data.estados} />
                  </div>
                )}

                {data && visible('productividad') && (
                  <div className="dash2-card rep-side-card rep-side-card--productividad">
                    <h3><span className="rep-panel-icon">{ICON_TREND}</span>Análisis de productividad</h3>
                    <div className="rep-productividad">
                      <Mini titulo="Tasa de conclusión" valor={`${data.productividad.tasa_conclusion}%`} delta={deltaTasaConclusion} notaFija="desempeño del periodo" />
                      <Mini titulo="Productividad promedio" valor={`${data.productividad.fus_por_dia} FUS por día`} notaFija="promedio del periodo" />
                      <Mini titulo="Eficiencia operativa" valor={`${data.productividad.eficiencia_sla}%`} notaFija="FUS concluidos dentro del SLA" />
                    </div>
                  </div>
                )}

                {data && visible('unidades') && (
                  <div className="dash2-card rep-side-card rep-side-card--unidades">
                    <h3><span className="rep-panel-icon">{ICON_BUILDING}</span>FUS por unidad administrativa</h3>
                    {data.unidades.length === 0 ? <p className="dash-empty rep-side-empty">Sin datos en el periodo.</p> : (
                      <ResponsiveContainer width="100%" height={230}>
                        <BarChart data={data.unidades} layout="vertical" margin={{ top: 0, right: 14, left: 4, bottom: 0 }}>
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="unidad" width={105} axisLine={false} tickLine={false} tick={{ fontSize: 9.5, fill: '#55555a' }} />
                          <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(31,86,71,0.06)' }} />
                          <Bar dataKey="cantidad" name="FUS" fill="#1F5647" radius={[0, 8, 8, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </aside>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
