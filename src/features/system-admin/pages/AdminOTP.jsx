import { useState } from 'react'
import AppLayout from '../../../components/AppLayout'
import Spinner from '../../../components/Spinner'
import useAdminOTP from '../hooks/useAdminOTP'
import { mensajeErrorAdmin } from '../api/adminApi'
import '../styles/SystemAdmin.css'

const ETIQUETAS = { ENVIADO: 'Enviado', ERROR: 'Error', SIN_CONFIRMACION: 'Sin confirmación' }

export default function AdminOTP() {
  const [filtros, setFiltros] = useState({ search: '', estado: '', page: 1 })
  const { data, loading, error, reload } = useAdminOTP(filtros)
  const filas = data?.results || []
  const resumen = data?.resumen || {}
  const campo = (nombre, valor) => setFiltros(actual => ({ ...actual, [nombre]: valor, page: 1 }))

  return <AppLayout mainClass="sa-main app-main-scroll"><div className="sa-page">
    <header className="sa-heading"><div><h1>Supervisión de códigos OTP</h1><p>Confirma entregas para primer acceso y recuperación sin mostrar códigos sensibles.</p></div><button onClick={reload} disabled={loading}>Actualizar</button></header>
    <section className="sa-kpis sa-kpis--otp" aria-label="Resumen últimos 7 días">
      <article className="sa-kpi"><p>Solicitudes OTP</p><strong>{resumen.total7d ?? 0}</strong><small>Últimos 7 días</small></article>
      <article className="sa-kpi"><p>Enviados</p><strong>{resumen.enviados7d ?? 0}</strong><small>Confirmados por correo</small></article>
      <article className="sa-kpi sa-kpi--rojo"><p>Errores</p><strong>{resumen.errores7d ?? 0}</strong><small>Requieren revisión</small></article>
      <article className="sa-kpi sa-kpi--dorado"><p>Sin confirmación</p><strong>{resumen.sinConfirmacion7d ?? 0}</strong><small>Principalmente históricos</small></article>
    </section>
    <section className="sa-filters sa-filters--otp"><input aria-label="Buscar destinatario" placeholder="Buscar correo institucional…" value={filtros.search} onChange={e => campo('search', e.target.value)} /><select aria-label="Estado del envío" value={filtros.estado} onChange={e => campo('estado', e.target.value)}><option value="">Todos los estados</option><option value="ENVIADO">Enviados</option><option value="ERROR">Con error</option><option value="SIN_CONFIRMACION">Sin confirmación</option></select></section>
    {error && <div className="sa-error">{mensajeErrorAdmin(error)} <button onClick={reload}>Reintentar</button></div>}
    {loading && !filas.length ? <Spinner overlay={false} /> : filas.length ? <div className="sa-table-wrap"><table className="sa-table"><thead><tr><th>Solicitud</th><th>Destinatario</th><th>Envío</th><th>Vigencia y uso</th><th>Seguridad</th></tr></thead><tbody>{filas.map(otp => <tr key={otp.id}>
      <td data-label="Solicitud">{new Date(otp.fechaGeneracion).toLocaleString('es-MX')}</td>
      <td data-label="Destinatario"><strong>{otp.email}</strong>{otp.fechaEnvio && <small>Enviado: {new Date(otp.fechaEnvio).toLocaleString('es-MX')}</small>}</td>
      <td data-label="Envío"><span className={`sa-badge sa-badge--${otp.estadoEnvio === 'ENVIADO' ? 'operativo' : otp.estadoEnvio === 'ERROR' ? 'error' : 'advertencia'}`}>{ETIQUETAS[otp.estadoEnvio] || otp.estadoEnvio}</span>{otp.detalleEnvio && <small>{otp.detalleEnvio}</small>}</td>
      <td data-label="Vigencia"><strong>{otp.usado ? 'Usado' : otp.expirado ? 'Expirado' : 'Vigente'}</strong><small>Expira: {new Date(otp.fechaExpiracion).toLocaleString('es-MX')}</small></td>
      <td data-label="Seguridad"><span>{otp.intentosFallidos} intento(s) fallido(s)</span><small>IP: {otp.ipSolicitante || 'No disponible'}</small></td>
    </tr>)}</tbody></table></div> : <div className="sa-empty">No hay solicitudes OTP que coincidan con los filtros.</div>}
    <nav className="sa-pagination" aria-label="Paginación"><button disabled={filtros.page <= 1} onClick={() => setFiltros({ ...filtros, page: filtros.page - 1 })}>Anterior</button><span>Página {filtros.page} de {data?.totalPages ?? 1}</span><button disabled={filtros.page >= (data?.totalPages ?? 1)} onClick={() => setFiltros({ ...filtros, page: filtros.page + 1 })}>Siguiente</button></nav>
  </div></AppLayout>
}
