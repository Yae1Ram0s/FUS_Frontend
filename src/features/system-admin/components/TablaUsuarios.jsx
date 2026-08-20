const ROL_LABELS = {
  ROL1: 'Particular del Titular',
  ROL2: 'Titular / Enlace Estratégico',
  COMISIONADO: 'Comisionado',
  EQUIPO_PARTICULAR: 'Equipo del Particular',
  ADMIN: 'Administrador del sistema',
}

function formatFecha(iso) {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function TablaUsuarios({ usuarios, onVer, onReset }) {
  if (!usuarios.length) return <div className="sa-empty">No hay usuarios que coincidan con los filtros.</div>

  return (
    <div className="sa-table-wrap">
      <table className="sa-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Unidad</th>
            <th>Estado</th>
            <th>Último acceso</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map(usuario => (
            <tr key={usuario.autorizacionId}>
              <td data-label="Usuario">
                <strong>{usuario.nombre || 'Sin nombre'}</strong>
                <small>{usuario.email}</small>
              </td>
              <td data-label="Rol">{ROL_LABELS[usuario.rol] || usuario.rol || '—'}</td>
              <td data-label="Unidad">{usuario.unidadAdministrativa?.nombre || '—'}</td>
              <td data-label="Estado">
                <span className={`sa-badge sa-badge--${usuario.bloqueado ? 'error' : !usuario.activo ? 'advertencia' : 'operativo'}`}>
                  {usuario.bloqueado ? 'Bloqueado' : !usuario.activo ? 'Inactivo' : 'Activo'}
                </span>
              </td>
              <td data-label="Último acceso">{formatFecha(usuario.ultimoIngreso)}</td>
              <td data-label="Acciones">
                <div className="sa-row-actions">
                  <button onClick={() => onVer(usuario)} data-analytics-event="INTERACTION" data-analytics-component="ADMIN_USUARIOS_ADMINISTRAR" data-analytics-action="OPEN">Administrar</button>
                  <button onClick={() => onReset(usuario)} disabled={!usuario.id} title={usuario.id ? undefined : 'La cuenta aún no ha sido activada'} data-analytics-event={usuario.id ? 'INTERACTION' : undefined} data-analytics-component="ADMIN_USUARIOS_RESTABLECER" data-analytics-action="OPEN">
                    Contraseña
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
