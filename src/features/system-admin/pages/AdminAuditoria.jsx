import { useState } from 'react'
import AppLayout from '../../../components/AppLayout'
import Spinner from '../../../components/Spinner'
import useAdminAuditoria from '../hooks/useAdminAuditoria'
import { ACCION_LABELS, mensajeErrorAdmin } from '../api/adminApi'
import '../styles/SystemAdmin.css'

function formatDetalle(detalle) {
  if (!detalle || typeof detalle !== 'object' || !Object.keys(detalle).length) return null
  return Object.entries(detalle).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')
}

export default function AdminAuditoria() {
  const [filtros, setFiltros] = useState({ actor: '', accion: '', page: 1 })
  const { data, loading, error, reload } = useAdminAuditoria(filtros)
  const filas = data?.results || []
  const totalPages = data?.totalPages ?? 1

  const campo = (nombre, valor) => setFiltros({ ...filtros, [nombre]: valor, page: 1 })

  return (
    <AppLayout mainClass="sa-main app-main-scroll">
      <div className="sa-page">
        <header className="sa-heading">
          <div>
            <h1>Auditoría administrativa</h1>
            <p>Registro verificable de acciones sensibles.</p>
          </div>
        </header>

        <section className="sa-filters">
          <input
            aria-label="Buscar por administrador"
            placeholder="Buscar por correo del administrador…"
            value={filtros.actor}
            onChange={e => campo('actor', e.target.value)}
          />
          <select aria-label="Tipo de acción" value={filtros.accion} onChange={e => campo('accion', e.target.value)}>
            <option value="">Todas las acciones</option>
            {Object.entries(ACCION_LABELS).map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
          </select>
        </section>

        {error && (
          <div className="sa-error">
            {mensajeErrorAdmin(error)} <button onClick={reload}>Reintentar</button>
          </div>
        )}

        {loading && !filas.length ? (
          <Spinner overlay={false} />
        ) : filas.length ? (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Administrador</th>
                  <th>Acción</th>
                  <th>Objetivo</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(r => {
                  const detalle = formatDetalle(r.detalle)
                  return (
                    <tr key={r.id}>
                      <td data-label="Fecha">{new Date(r.fechaHora).toLocaleString('es-MX')}</td>
                      <td data-label="Administrador">{r.actorEmail || '—'}</td>
                      <td data-label="Acción">
                        <strong>{ACCION_LABELS[r.accion] || r.accion}</strong>
                        {detalle && <small>{detalle}</small>}
                      </td>
                      <td data-label="Objetivo">{r.objetivoEmail || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sa-empty">No hay eventos de auditoría para estos filtros.</div>
        )}

        <nav className="sa-pagination" aria-label="Paginación">
          <button disabled={filtros.page <= 1} onClick={() => setFiltros({ ...filtros, page: filtros.page - 1 })}>Anterior</button>
          <span>Página {filtros.page} de {totalPages}</span>
          <button disabled={filtros.page >= totalPages} onClick={() => setFiltros({ ...filtros, page: filtros.page + 1 })}>Siguiente</button>
        </nav>
      </div>
    </AppLayout>
  )
}
