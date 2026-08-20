const ROL_OPCIONES = [
  { value: 'ROL1', label: 'Particular del Titular' },
  { value: 'ROL2', label: 'Titular / Enlace Estratégico' },
  { value: 'COMISIONADO', label: 'Comisionado' },
  { value: 'EQUIPO_PARTICULAR', label: 'Equipo del Particular' },
  { value: 'ADMIN', label: 'Administrador del sistema' },
]

export default function FiltrosUsuarios({ filtros, onChange }) {
  const campo = (nombre, valor) => onChange({ ...filtros, [nombre]: valor, page: 1 })

  return (
    <section className="sa-filters" aria-label="Filtros de usuarios">
      <label className="sa-search">
        <span className="sr-only">Buscar usuarios</span>
        <input
          value={filtros.search}
          onChange={e => campo('search', e.target.value)}
          placeholder="Buscar por nombre o correo…"
          data-analytics-event="INTERACTION"
          data-analytics-component="ADMIN_USUARIOS_FILTROS"
          data-analytics-action="SEARCH"
          data-analytics-trigger="change"
        />
      </label>
      <select aria-label="Rol" value={filtros.rol} onChange={e => campo('rol', e.target.value)} data-analytics-event="INTERACTION" data-analytics-component="ADMIN_USUARIOS_FILTROS" data-analytics-action="FILTER" data-analytics-trigger="change" data-analytics-metadata="rol">
        <option value="">Todos los roles</option>
        {ROL_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select aria-label="Estado" value={filtros.activo} onChange={e => campo('activo', e.target.value)} data-analytics-event="INTERACTION" data-analytics-component="ADMIN_USUARIOS_FILTROS" data-analytics-action="FILTER" data-analytics-trigger="change" data-analytics-metadata="estado">
        <option value="">Todos los estados</option>
        <option value="true">Activos</option>
        <option value="false">Inactivos</option>
      </select>
      <select aria-label="Acceso" value={filtros.bloqueado} onChange={e => campo('bloqueado', e.target.value)} data-analytics-event="INTERACTION" data-analytics-component="ADMIN_USUARIOS_FILTROS" data-analytics-action="FILTER" data-analytics-trigger="change" data-analytics-metadata="acceso">
        <option value="">Cualquier acceso</option>
        <option value="true">Bloqueados</option>
        <option value="false">Sin bloqueo</option>
      </select>
    </section>
  )
}
