import { useState } from 'react'
import AppLayout from '../../../components/AppLayout'
import Spinner from '../../../components/Spinner'
import AdminKpiCard from '../components/AdminKpiCard'
import EstadoServicio from '../components/EstadoServicio'
import GraficaUsuariosPorRol from '../components/GraficaUsuariosPorRol'
import GraficaUsuariosPorEstado from '../components/GraficaUsuariosPorEstado'
import GraficaActividadDiaria from '../components/GraficaActividadDiaria'
import { GraficaDistribucion, GraficaTendenciaSupervision } from '../components/GraficaSupervision'
import useAdminResumen from '../hooks/useAdminResumen'
import useAdminMetricas from '../hooks/useAdminMetricas'
import useSaludSistema from '../hooks/useSaludSistema'
import useAuditoriaReciente from '../hooks/useAuditoriaReciente'
import useSerieAuditoria from '../hooks/useSerieAuditoria'
import { ACCION_LABELS, mapearSalud, mensajeErrorAdmin } from '../api/adminApi'
import '../styles/SystemAdmin.css'

export default function AdminDashboard() {
  const [dias, setDias] = useState(30)
  const [vista, setVista] = useState('resumen')
  const { data: resumen = {}, loading, error, reload } = useAdminResumen()
  const { data: metricas = {}, loading: cargandoMetricas, reload: reloadMetricas } = useAdminMetricas(dias)
  const { data: salud = {}, reload: reloadSalud } = useSaludSistema()
  const { data: auditoria, reload: reloadAuditoria } = useAuditoriaReciente(5)
  const { data: serieActividad, reload: reloadSerie } = useSerieAuditoria(14)
  const usuarios = resumen.usuarios || {}; const seguridad = resumen.seguridad || {}; const kpis = metricas.kpis || {}
  const servicios = mapearSalud(salud); const actividad = auditoria?.results || []
  const red = metricas.red || {}
  const actualizando = loading || cargandoMetricas
  const actualizarTodo = () => Promise.all([reload(), reloadMetricas(), reloadSalud(), reloadAuditoria(), reloadSerie()])

  return <AppLayout mainClass="sa-main app-main-scroll"><div className="sa-page">
    <header className="sa-heading"><div><h1>Administración del sistema</h1><p>Supervisión de accesos, seguridad y disponibilidad.</p><small className="sa-freshness"><span/>Actualización automática cada 30 s · {metricas.generadoEn ? new Date(metricas.generadoEn).toLocaleTimeString('es-MX') : 'sin sincronizar'}</small></div><div className="sa-heading-actions"><div className="sa-window">{[7,30,90].map(value => <button key={value} className={dias===value?'is-active':''} onClick={()=>setDias(value)} data-analytics-event="INTERACTION" data-analytics-component="ADMIN_DASHBOARD_VENTANA" data-analytics-action="FILTER" data-analytics-metadata={String(value)}>{value} días</button>)}</div><button onClick={actualizarTodo} disabled={actualizando} aria-busy={actualizando} data-analytics-event="INTERACTION" data-analytics-component="ADMIN_DASHBOARD_ACTUALIZAR">{actualizando?'Actualizando…':'Actualizar'}</button></div></header>
    <nav className="sa-dashboard-tabs" aria-label="Secciones del dashboard">{[['resumen','Resumen'],['red','Red y seguridad'],['actividad','Actividad']].map(([key,label])=><button key={key} className={vista===key?'is-active':''} onClick={()=>setVista(key)} data-analytics-event="INTERACTION" data-analytics-component="ADMIN_DASHBOARD_TAB" data-analytics-action="NAVIGATE" data-analytics-metadata={key}>{label}</button>)}</nav>
    {loading && !Object.keys(resumen).length ? <Spinner overlay={false}/> : <>
      {error && <div className="sa-error">{mensajeErrorAdmin(error)} <button onClick={reload} data-analytics-event="INTERACTION" data-analytics-component="ADMIN_DASHBOARD_REINTENTAR">Reintentar</button></div>}
      {vista === 'resumen' && <>
      <section className="sa-kpis"><AdminKpiCard titulo="Usuarios totales" valor={usuarios.total}/><AdminKpiCard titulo="Activos" valor={usuarios.activos}/><AdminKpiCard titulo="Inactivos" valor={usuarios.inactivos} tono="dorado"/><AdminKpiCard titulo="Administradores" valor={usuarios.administradores}/><AdminKpiCard titulo="Bloqueados" valor={seguridad.bloqueados} tono="rojo"/><AdminKpiCard titulo="Cambio de contraseña" valor={seguridad.requierenCambioContrasena} tono="dorado"/><AdminKpiCard titulo="Adopción" valor={`${kpis.adopcionPct||0}%`} ayuda="Cuentas que ya ingresaron"/><AdminKpiCard titulo="Cobertura" valor={`${kpis.coberturaCuentaPct||0}%`} ayuda="Autorizados con cuenta"/><AdminKpiCard titulo="Intentos fallidos" valor={kpis.intentosFallidosActuales||0} tono="rojo"/><AdminKpiCard titulo="Fallos OTP" valor={kpis.intentosOtpVentana||0} ayuda={`Últimos ${dias} días`} tono="dorado"/></section>
      <section className="sa-panel sa-monitor-panel"><div className="sa-panel-title"><div><h2>Tendencia de supervisión</h2><p className="dash-subtitle">Señales de adopción y operación administrativa</p></div><span className="sa-live-pill">EN VIVO</span></div><GraficaTendenciaSupervision serie={metricas.serie}/><p className="sa-definition">“Usuarios con último ingreso” ubica el último acceso conocido de cada cuenta; no representa todos los eventos de inicio de sesión.</p></section>
      <section className="sa-grid"><div className="sa-panel"><h2>Usuarios por rol</h2><p className="dash-subtitle">Cuentas activas en cada rol</p><GraficaUsuariosPorRol porRol={usuarios.porRol}/></div><div className="sa-panel"><h2>Usuarios por estado</h2><p className="dash-subtitle">Activos frente a inactivos</p><GraficaUsuariosPorEstado activos={usuarios.activos} inactivos={usuarios.inactivos}/></div></section>
      <section className="sa-grid sa-grid--diagnostic"><div className="sa-panel"><h2>Cobertura por unidad</h2><p className="dash-subtitle">Unidades con más usuarios activos</p><GraficaDistribucion datos={metricas.porUnidad||[]} nameKey="unidad"/></div><div className="sa-panel"><h2>Acciones administrativas</h2><p className="dash-subtitle">Mezcla en los últimos {dias} días</p><GraficaDistribucion datos={metricas.acciones||[]} nameKey="accion" nombre="Acciones"/></div></section>
      </>}
      {vista === 'red' && <><section className="sa-kpis sa-kpis--network"><AdminKpiCard titulo="Latencia del endpoint" valor={`${red.latenciaEndpointMs||0} ms`} ayuda="Generación de métricas"/><AdminKpiCard titulo="Latencia de BD" valor={`${red.latenciaBaseDatosMs||0} ms`} ayuda="Consulta de comprobación"/><AdminKpiCard titulo="Sesiones vigentes" valor={red.sesionesVigentes||0}/><AdminKpiCard titulo="IP administrativas" valor={red.ipsAdministrativasUnicas||0} ayuda={`Últimos ${dias} días`}/><AdminKpiCard titulo="IP solicitando OTP" valor={red.ipsOtpUnicas||0} tono="dorado"/><AdminKpiCard titulo="WebSocket" valor={red.websocketConfigurado?'Activo':'Advertencia'} tono={red.websocketConfigurado?'verde':'dorado'}/></section><section className="sa-grid"><div className="sa-panel"><h2>Estado de servicios</h2>{servicios.length?servicios.map((s,i)=><EstadoServicio key={s.nombre||i}{...s}/>):<p className="sa-muted">Sin comprobaciones disponibles.</p>}</div><div className="sa-panel"><h2>Actividad administrativa por IP</h2><p className="dash-subtitle">Conteos agregados; no se muestran credenciales</p><GraficaDistribucion datos={red.actividadPorIp||[]} nameKey="ipCliente" nombre="Acciones"/></div></section><section className="sa-panel sa-network-note"><h2>Alcance de red</h2><p>Esta vista supervisa señales que el sistema registra de forma segura: latencias, disponibilidad, sesiones e IP asociadas a auditoría u OTP. No inspecciona tráfico ajeno, contenido de paquetes, contraseñas, cookies ni tokens.</p></section></>}
      {vista === 'actividad' && <><section className="sa-grid"><div className="sa-panel"><h2>Acciones por tipo</h2><p className="dash-subtitle">Mezcla en los últimos {dias} días</p><GraficaDistribucion datos={metricas.acciones||[]} nameKey="accion" nombre="Acciones"/></div><div className="sa-panel"><h2>Actividad diaria</h2><p className="dash-subtitle">Acciones registradas · últimos 14 días</p><GraficaActividadDiaria serie={serieActividad}/></div></section><section className="sa-panel sa-activity-list"><h2>Actividad reciente</h2>{actividad.map(a=><div className="sa-list-item" key={a.id}><strong>{ACCION_LABELS[a.accion]||a.accion}</strong><span>{a.actorEmail}{a.objetivoEmail?` → ${a.objetivoEmail}`:''}</span></div>)}{!actividad.length&&<p className="sa-muted">Sin actividad reciente.</p>}</section></>}
    </>}
  </div></AppLayout>
}
