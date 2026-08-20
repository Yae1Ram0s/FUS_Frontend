import { useState } from 'react'
import AppLayout from '../../../components/AppLayout'
import Spinner from '../../../components/Spinner'
import EstadoServicio from '../components/EstadoServicio'
import GraficaLatenciaBaseDatos from '../components/GraficaLatenciaBaseDatos'
import useSaludSistema from '../hooks/useSaludSistema'
import useHistorialSalud from '../hooks/useHistorialSalud'
import { mapearSalud, mensajeErrorAdmin } from '../api/adminApi'
import { useAnalytics } from '../../../analytics'
import '../styles/SystemAdmin.css'

export default function AdminSalud() {
  const { data = {}, loading, error, reload, comprobarAhora } = useSaludSistema()
  const [comprobando, setComprobando] = useState(false)
  const servicios = mapearSalud(data)
  const { startTask, completeTask, failTask } = useAnalytics({ componente: 'ADMIN_SALUD_COMPROBAR', accion: 'UPDATE' })

  const { data: historial, loading: cargandoHistorial } = useHistorialSalud(14)
  const entorno = data.entorno
    ? `${data.entorno.sistema || '—'} · Python ${data.entorno.python || '—'}${data.entorno.debug ? ' · DEBUG' : ''}`
    : 'Sin comprobar'
  const comprobar = async () => {
    if (comprobando) return
    setComprobando(true)
    const taskId = startTask()
    try {
      await comprobarAhora()
      completeTask(taskId)
    } catch (err) {
      failTask(taskId, { metadatos: { motivo: err.response ? 'error_servidor' : 'sin_conexion' } })
    } finally {
      setComprobando(false)
    }
  }

  return (
    <AppLayout mainClass="sa-main app-main-scroll">
      <div className="sa-page">
        <header className="sa-heading">
          <div>
            <h1>Salud del sistema</h1>
            <p>Estado técnico del entorno, sin datos sensibles.</p>
          </div>
          <button onClick={comprobar} disabled={comprobando} aria-busy={comprobando}>{comprobando ? 'Comprobando…' : 'Comprobar ahora'}</button>
        </header>

        {error && (
          <div className="sa-error">
            {mensajeErrorAdmin(error)} <button onClick={reload} data-analytics-event="INTERACTION" data-analytics-component="ADMIN_SALUD_REINTENTAR">Reintentar</button>
          </div>
        )}

        {loading && !servicios.length ? (
          <Spinner overlay={false} />
        ) : (
          <section className="sa-panel">
            <div className="sa-meta">
              <span>Estado general: <strong>{data.estado === 'atencion' ? 'Requiere atención' : data.estado === 'operativo' ? 'Operativo' : '—'}</strong></span>
              <span>Entorno: <strong>{entorno}</strong></span>
              <span>Versión de Django: <strong>{data.backend?.version || '—'}</strong></span>
              <span>Última comprobación: <strong>{data.generadoEn ? new Date(data.generadoEn).toLocaleString('es-MX') : '—'}</strong></span>
            </div>
            <div className="sa-services">
              {servicios.length
                ? servicios.map((s, i) => <EstadoServicio key={s.nombre || i} {...s} />)
                : <p className="sa-muted">El backend aún no devolvió comprobaciones.</p>}
            </div>
          </section>
        )}

        <section className="sa-panel">
          <h2>Latencia de base de datos</h2>
          <p className="dash-subtitle">Últimos 14 días — se llena con `python manage.py registrar_salud_sistema`, agendado periódicamente</p>
          {cargandoHistorial && !historial.length
            ? <Spinner overlay={false} />
            : <GraficaLatenciaBaseDatos historial={historial} />}
        </section>
      </div>
    </AppLayout>
  )
}
