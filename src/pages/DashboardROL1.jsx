import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import './DashboardROL1.css'

const ACCION_TEXTO = {
  REGISTRO_FUS:       'registró el FUS',
  TURNAR_FUS:         'turnó el FUS',
  ASIGNACION_ESTADO:  'actualizó el estatus de',
  REGISTRO_RESPUESTA: 'registró una respuesta en',
  REGISTRO_ACCION:    'registró una acción en',
  CONCLUSION_FUS:     'concluyó',
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diffH = (Date.now() - new Date(iso).getTime()) / 3_600_000
  if (diffH < 1)  return 'Hace unos minutos'
  if (diffH < 24) return `Hace ${Math.floor(diffH)} h`
  return `Hace ${Math.floor(diffH / 24)} d`
}

function horaCorta(iso) {
  return iso ? new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'
}

/* ── KPI card superior ── */
function KpiCard({ dark, label, value, extra, onClick }) {
  return (
    <div className={`kpi-card${dark ? ' kpi-card-dark' : ''}${onClick ? ' kpi-card-clickable' : ''}`} onClick={onClick}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {extra && <span className="kpi-pill">{extra}</span>}
      </div>
      <span className="kpi-value">{value}</span>
    </div>
  )
}

/* ── Analítica de recepción — barras horizontales ── */
function BarrasRecepcion({ data }) {
  const max = Math.max(1, ...data.map(d => d.value))
  if (!data.length) return <p className="dash-empty">Sin datos de recepción.</p>
  return (
    <div className="dash-bars">
      {data.map(d => (
        <div className="dash-bar-row" key={d.label}>
          <span className="dash-bar-label">{d.label}</span>
          <div className="dash-bar-track">
            <div className="dash-bar-fill" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="dash-bar-value">{d.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Donut semicircular de eficiencia ── */
function DonutEficiencia({ pct }) {
  const r = 80, cx = 100, cy = 100
  const arcLen = Math.PI * r
  const clamped = Math.min(100, Math.max(0, pct))
  const offset = arcLen - (arcLen * clamped) / 100
  const d = `M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`
  return (
    <div className="dash-donut-wrap">
      <svg viewBox="0 0 200 110" className="dash-donut">
        <path d={d} className="dash-donut-track" />
        <path d={d} className="dash-donut-fill" style={{ strokeDasharray: arcLen, strokeDashoffset: offset }} />
      </svg>
      <div className="dash-donut-center">
        <span className="dash-donut-pct">{clamped}%</span>
        <span className="dash-donut-lbl">Tasa de conclusión</span>
      </div>
    </div>
  )
}

export default function DashboardROL1() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const nombre = user?.nombre || user?.email || 'Usuario'

  const [fusData,   setFusData]   = useState([])
  const [actividad, setActividad] = useState([])
  const [cargando,  setCargando]  = useState(true)
  const [ahora] = useState(() => Date.now())

  useEffect(() => {
    Promise.all([
      api.get('/fus/', { params: { page: 1, page_size: 500 } }),
      api.get('/bitacora/', { params: { page: 1, page_size: 6 } }),
    ])
      .then(([fusRes, bitRes]) => {
        setFusData(fusRes.data.results || [])
        setActividad(bitRes.data.results || [])
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  const irAConsultar = (estatus) => navigate(`/rol1/consultar-fus?modo=lista${estatus ? `&filtro=${encodeURIComponent(estatus)}` : ''}`)

  const totalRegistrados = fusData.length
  const haceUnaSemana = ahora - 7 * 24 * 3_600_000
  const nuevosSemana = fusData.filter(f => f.fechaHora && new Date(f.fechaHora).getTime() >= haceUnaSemana).length
  const turnados   = fusData.filter(f => f.estatusParticular === 'Turnado').length
  const enAtencion  = fusData.filter(f => f.estatusParticular === 'Atendido').length
  const concluidos  = fusData.filter(f => f.estatusParticular === 'Concluido').length

  const medioCounts = {}
  fusData.forEach(f => {
    const m = f.idMedioRecepcion?.nombreMedio || 'Otro'
    medioCounts[m] = (medioCounts[m] || 0) + 1
  })
  const medios = Object.entries(medioCounts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)

  const limite48h = ahora - 48 * 3_600_000
  const recordatorios = fusData
    .filter(f => f.prioridad === 'Alta' && f.estatusParticular !== 'Concluido' && f.fechaHora && new Date(f.fechaHora).getTime() < limite48h)
    .sort((a, b) => new Date(a.fechaHora) - new Date(b.fechaHora))
    .slice(0, 6)

  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0)
  const delMes = fusData.filter(f => f.fechaHora && new Date(f.fechaHora) >= inicioMes)
  const concluidosMes = delMes.filter(f => f.estatusParticular === 'Concluido').length
  const pctEficiencia = delMes.length ? Math.round((concluidosMes / delMes.length) * 100) : 0

  if (cargando) {
    return <AppLayout><div className="dash-bg"><Spinner overlay={false} label="Cargando dashboard…" /></div></AppLayout>
  }

  return (
    <AppLayout>
      <div className="dash-bg">
        <div className="dash-wrap-apple">
        <div className="dash-mega-card">

          <header className="dash-header-apple">
            <h1>Hola, {nombre.split(' ')[0]}</h1>
            <p>Resumen del Sistema de Control de Solicitudes</p>
          </header>

          {/* ── KPIs ── */}
          <div className="kpi-row">
            <KpiCard dark label="Total de FUS registrados" value={totalRegistrados} extra={`↑ +${nuevosSemana} esta semana`} onClick={() => irAConsultar('')} />
            <KpiCard label="Turnados / en espera" value={turnados} extra="↗" onClick={() => irAConsultar('Turnado')} />
            <KpiCard label="En atención" value={enAtencion} extra="↗" onClick={() => irAConsultar('Atendido')} />
            <KpiCard label="Concluidos" value={concluidos} extra="✓" onClick={() => irAConsultar('Concluido')} />
          </div>

          {/* ── Bloque central ── */}
          <div className="dash-grid-central">
            <section className="dash-card">
              <h2>Analítica de recepción</h2>
              <p className="dash-subtitle">Canales de entrada de las solicitudes</p>
              <BarrasRecepcion data={medios} />
            </section>

            <section className="dash-card">
              <h2>Recordatorios y alertas críticas</h2>
              <p className="dash-subtitle">Prioridad alta con más de 48 h sin actualización</p>
              {recordatorios.length === 0 ? (
                <p className="dash-empty">Sin alertas pendientes. 🎉</p>
              ) : (
                <ul className="dash-reminders">
                  {recordatorios.map(f => (
                    <li key={f.id} className="dash-reminder-item" onClick={() => navigate(`/rol1/consultar-fus?folio=${encodeURIComponent(f.folio)}`)}>
                      <span className="dash-reminder-dot" />
                      <div className="dash-reminder-body">
                        <strong>{f.folio}</strong>
                        <span>{(f.descripcion || '').slice(0, 60)}</span>
                      </div>
                      <span className="dash-reminder-time">{timeAgo(f.fechaHora)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* ── Bloque inferior ── */}
          <div className="dash-grid-inferior">
            <section className="dash-card">
              <h2>Actividad reciente</h2>
              <p className="dash-subtitle">Últimas interacciones del equipo</p>
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
            </section>

            <section className="dash-card dash-card-centrado">
              <h2>Eficiencia operativa</h2>
              <p className="dash-subtitle">Resueltas vs. pendientes este mes</p>
              <DonutEficiencia pct={pctEficiencia} />
            </section>
          </div>

        </div>
        </div>
      </div>
    </AppLayout>
  )
}
