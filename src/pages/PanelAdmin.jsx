import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import api from '../api/api'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import { useAuth } from '../context/AuthContext'
import { useCountUp } from '../hooks/useCountUp'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useAnalytics } from '../analytics'
import '../components/Comisionado/Comisionado.css'
import './PanelAdmin.css'

// label corto (cabe en una línea, como "Total de FUS") + sub con el detalle
// ("Rol 2", "Direcciones asignadas"...) — igual que las tarjetas de los
// dashboards, en vez de un solo label largo que se envuelve en 2-3 líneas.
const ROL_LABELS = { ROL1: 'Particular', ROL2: 'Titular', COMISIONADO: 'Comisionado', EQUIPO_PARTICULAR: 'Equipo particular' }
const ROL_SUB    = { ROL1: 'Rol 1', ROL2: 'Enlace estratégico · Rol 2', COMISIONADO: 'Direcciones asignadas', EQUIPO_PARTICULAR: 'Asistentes de Rol 1' }
// Un color e ícono kpi2- distinto por rol, igual que en los dashboards.
const ROL_KPI_COLOR = { ROL1: 'blue', ROL2: 'amber', COMISIONADO: 'red', EQUIPO_PARTICULAR: 'green' }

const ICON_STACK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
)
const ICON_CHECK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
)
const ICON_X = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
)
const ICON_USER = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const ICON_FLAG = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
  </svg>
)
const ICON_SHIELD = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)
const ICON_USERS = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const ROL_KPI_ICON = { ROL1: ICON_USER, ROL2: ICON_FLAG, COMISIONADO: ICON_SHIELD, EQUIPO_PARTICULAR: ICON_USERS }
const ICON_CORNER = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
  </svg>
)

/* ── Tarjeta de KPI "liquid glass" seleccionable — mismo patrón que los
   dashboards (Kpi2Card), aquí además marca con `activa` cuál filtro está
   aplicado en este momento. ── */
function Kpi2CardFiltro({ icon, label, sub, value, color, activa, onClick, index, filtroKey }) {
  const count = useCountUp(value)
  return (
    <div
      className={`adm-kpi-card${activa ? ' adm-kpi-card-activa' : ''}`}
      style={{ animationDelay: `${index * 0.05}s` }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      data-analytics-event="INTERACTION"
      data-analytics-component="PANEL_ADMIN_KPI_FILTRO"
      data-analytics-action="FILTER"
      data-analytics-metadata={filtroKey}
    >
      <div className={`adm-kpi-glow adm-kpi-glow--${color}`} />
      <div className={`adm-kpi-icon adm-kpi-icon--${color}`}>{icon}</div>
      <span className="adm-kpi-link">{ICON_CORNER}</span>
      <div className="adm-kpi-label">{label}</div>
      <div className="adm-kpi-sub">{sub}</div>
      <div className="adm-kpi-value">{count}</div>
    </div>
  )
}

export default function PanelAdmin() {
  const { user: yo } = useAuth()

  const [unidades,   setUnidades]   = useState([])
  const [busqueda,   setBusqueda]   = useState('')
  const [filtroRol,  setFiltroRol]  = useState('')
  const [filtroActivo, setFiltroActivo] = useState('')  // '' | '1' | '0' — igual que filtroRol, seleccionable desde las tarjetas de arriba
  const [modal,      setModal]      = useState(false)   // 'agregar' | 'editar' | false
  const [form,       setForm]       = useState({ email: '', nombre: '', rol: 'ROL1', unidadAdministrativa: '' })
  const [editando,   setEditando]   = useState(null)
  const [formEdit,   setFormEdit]   = useState({ nombre: '', email: '', rol: 'ROL1', unidadAdministrativa: '' })
  const [guardando,  setGuardando]  = useState(false)
  const [error,      setError]      = useState('')
  const [errorOperacion, setErrorOperacion] = useState('')
  const [exito,      setExito]      = useState('')
  const [toggleandoId, setToggleandoId] = useState(null)
  const guardarEnCursoRef = useRef(false)
  const agregarEnCursoRef = useRef(false)
  const toggleEnCursoRef = useRef(new Set())
  const { startTask, completeTask, failTask } = useAnalytics({ componente: 'PANEL_ADMIN_USUARIO' })

  useEffect(() => {
    api.get('/catalogos/unidades-administrativas/')
      .then(r => setUnidades(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
  }, [])

  const busquedaDeb = useDebouncedValue(busqueda, 300)

  const filtrosCorreos = { search: busquedaDeb, rol: filtroRol, activo: filtroActivo }
  const {
    data: correos = [],
    error: errorConsulta,
    isFetching: cargando,
    refetch: cargar,
  } = useQuery({
    queryKey: ['correosAutorizados', filtrosCorreos],
    queryFn: async ({ signal }) => {
      const params = {}
      if (busquedaDeb) params.search = busquedaDeb
      if (filtroRol)    params.rol    = filtroRol
      if (filtroActivo) params.activo = filtroActivo
      const respuesta = await api.get('/auth/correos-autorizados/', { params, signal })
      return Array.isArray(respuesta.data) ? respuesta.data : []
    },
    // Conserva la tabla anterior visible mientras carga el nuevo filtro.
    placeholderData: keepPreviousData,
  })
  const errorCarga = errorOperacion || (
    errorConsulta?.response?.data?.detail
    || (errorConsulta ? 'No se pudo cargar la lista. Verifica tu sesión.' : '')
  )

  const direccionesGenerales = unidades.filter(u => u.esUnidadDeNegocio)
  const aduanas              = unidades.filter(u => u.esUnidadAdministrativa)
  const unidadFaltante = form.rol === 'COMISIONADO' && !form.unidadAdministrativa

  const abrirEditar = (c) => {
    setEditando(c)
    setFormEdit({ nombre: c.nombre, email: c.email, rol: c.rol, unidadAdministrativa: c.unidadAdministrativa || '' })
    setError('')
    setModal('editar')
  }

  const guardarEdicion = async (e) => {
    e.preventDefault()
    if (guardarEnCursoRef.current) return
    guardarEnCursoRef.current = true
    setError(''); setGuardando(true)
    const taskId = startTask({ accion: 'UPDATE' })
    try {
      await api.patch(`/auth/correos-autorizados/${editando.id}/`, formEdit)
      completeTask(taskId)
      setExito('Usuario actualizado correctamente.')
      setModal(false)
      setEditando(null)
      cargar()
      setTimeout(() => setExito(''), 3000)
    } catch (err) {
      failTask(taskId, { metadatos: { motivo: err.response ? 'error_servidor' : 'sin_conexion' } })
      setError(err.response?.data?.detail || 'No se pudo guardar los cambios.')
    } finally {
      setGuardando(false)
      guardarEnCursoRef.current = false
    }
  }

  const toggleActivo = async (c) => {
    if (c.email === yo?.email) {
      setErrorOperacion('No puedes desactivar tu propia cuenta.')
      return
    }
    if (toggleEnCursoRef.current.has(c.id)) return
    toggleEnCursoRef.current.add(c.id)
    setErrorOperacion('')
    setToggleandoId(c.id)
    const taskId = startTask({ accion: 'UPDATE', metadatos: { control: c.activo ? 'desactivar' : 'activar' } })
    try {
      await api.patch(`/auth/correos-autorizados/${c.id}/`, { activo: c.activo ? 0 : 1 })
      completeTask(taskId)
      cargar()
    } catch (err) {
      failTask(taskId, { metadatos: { motivo: err.response ? 'error_servidor' : 'sin_conexion' } })
      setErrorOperacion(err.response?.data?.detail || 'No se pudo actualizar el estado de la cuenta.')
    } finally {
      setToggleandoId(null)
      toggleEnCursoRef.current.delete(c.id)
    }
  }

  const agregarCorreo = async (e) => {
    e.preventDefault()
    if (unidadFaltante) {
      setError('Selecciona la dirección a la que quedará vinculado el comisionado.')
      return
    }
    if (agregarEnCursoRef.current) return
    agregarEnCursoRef.current = true
    setError(''); setGuardando(true)
    const taskId = startTask({ accion: 'CREATE' })
    try {
      await api.post('/auth/correos-autorizados/', form)
      completeTask(taskId)
      setExito('Correo agregado correctamente.')
      setModal(false)
      setForm({ email: '', nombre: '', rol: 'ROL1', unidadAdministrativa: '' })
      cargar()
      setTimeout(() => setExito(''), 3000)
    } catch (err) {
      failTask(taskId, { metadatos: { motivo: err.response ? 'error_servidor' : 'sin_conexion' } })
      setError(err.response?.data?.detail || 'No se pudo agregar el correo.')
    } finally {
      setGuardando(false)
      agregarEnCursoRef.current = false
    }
  }

  const activos   = correos.filter(c => c.activo).length
  const inactivos = correos.filter(c => !c.activo).length

  return (
    <AppLayout>
      <div className="adm-bg">
      <div className="adm-wrap">

        <div className="adm-header">
          <div className="adm-header-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <h1>Panel de Administrador</h1>
          </div>
          <button className="adm-btn-add" onClick={() => { setModal('agregar'); setError('') }} data-analytics-event="INTERACTION" data-analytics-component="PANEL_ADMIN_AGREGAR" data-analytics-action="OPEN">
            + Agregar correo
          </button>
        </div>

        {/* Métricas seleccionables: una fila compacta en escritorio y
            carrusel horizontal en pantallas pequeñas. */}
        <div className="adm-kpi-row">
          <Kpi2CardFiltro
            index={0} color="blue" icon={ICON_STACK}
            label="Total" sub="Todos los usuarios" value={correos.length}
            activa={!filtroRol && !filtroActivo}
            onClick={() => { setFiltroRol(''); setFiltroActivo('') }}
            filtroKey="total"
          />
          <Kpi2CardFiltro
            index={1} color="green" icon={ICON_CHECK}
            label="Activos" sub="Cuentas habilitadas" value={activos}
            activa={filtroActivo === '1'}
            onClick={() => setFiltroActivo(actual => actual === '1' ? '' : '1')}
            filtroKey="activos"
          />
          <Kpi2CardFiltro
            index={2} color="red" icon={ICON_X}
            label="Inactivos" sub="Cuentas deshabilitadas" value={inactivos}
            activa={filtroActivo === '0'}
            onClick={() => setFiltroActivo(actual => actual === '0' ? '' : '0')}
            filtroKey="inactivos"
          />
          {Object.entries(ROL_LABELS).map(([k, v], i) => (
            <Kpi2CardFiltro
              key={k} index={3 + i} color={ROL_KPI_COLOR[k]} icon={ROL_KPI_ICON[k]}
              label={v} sub={ROL_SUB[k]}
              value={correos.filter(c => c.rol === k).length}
              activa={filtroRol === k}
              onClick={() => setFiltroRol(actual => actual === k ? '' : k)}
              filtroKey={k.toLowerCase()}
            />
          ))}
        </div>

        {exito      && <p className="adm-exito">{exito}</p>}
        {errorCarga && <p className="adm-modal-error" style={{ flexShrink: 0 }}>{errorCarga}</p>}

        {/* Filtros */}
        <div className="adm-filtros">
          <input
            className="adm-search"
            placeholder="Buscar por email o nombre…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <select className="adm-select" value={filtroRol} onChange={e => setFiltroRol(e.target.value)}>
            <option value="">Todos los roles</option>
            <option value="ROL1">Particular</option>
            <option value="ROL2">Titular/Enlace Estratégico</option>
            <option value="COMISIONADO">Comisionado</option>
            <option value="EQUIPO_PARTICULAR">Equipo del Particular</option>
          </select>
        </div>

        {/* Tabla */}
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Unidad administrativa</th>
                <th>Cuenta</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando && correos.length === 0 && (
                <tr><td colSpan={7} className="adm-loading"><Spinner overlay={false} /></td></tr>
              )}
              {!cargando && correos.length === 0 && (
                <tr><td colSpan={7} className="adm-loading">Sin resultados.</td></tr>
              )}
              {correos.map(c => (
                <tr key={c.id} className={!c.activo ? 'adm-row-inactivo' : ''}>
                  <td className="adm-email" data-label="Email:">
                    <span className="adm-card-avatar">{(c.nombre || c.email || '?').charAt(0).toUpperCase()}</span>
                    <span className="adm-card-headtext">
                      <span className="adm-card-nombre">{c.nombre}</span>
                      <span className="adm-card-email">{c.email}</span>
                    </span>
                  </td>
                  <td data-label="Nombre:">{c.nombre}</td>
                  <td data-label="Rol:">
                    <span className={`adm-rol-badge adm-rol-badge-${c.rol?.toLowerCase()}`}>
                      {ROL_LABELS[c.rol] || c.rol}
                    </span>
                  </td>
                  <td className="adm-unidad" data-label="Unidad:">{c.unidadAdministrativaNombre || '—'}</td>
                  <td data-label="Cuenta:">
                    <span className={`adm-cuenta ${c.tiene_cuenta ? 'adm-cuenta-si' : 'adm-cuenta-no'}`}>
                      {c.tiene_cuenta ? 'Registrado' : 'Sin cuenta'}
                    </span>
                  </td>
                  <td data-label="Estado:">
                    <span className={`adm-estado ${c.activo ? 'adm-estado-activo' : 'adm-estado-inactivo'}`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td data-label="Acciones:">
                    <div className="adm-acciones-cell">
                      <button className="adm-btn-icon" onClick={() => abrirEditar(c)} title="Editar" aria-label="Editar">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <label
                        className="adm-toggle-switch"
                        title={c.activo ? 'Desactivar' : 'Activar'}
                      >
                        <input
                          type="checkbox"
                          className="adm-toggle-input"
                          checked={!!c.activo}
                          onChange={() => toggleActivo(c)}
                          disabled={toggleandoId === c.id}
                          aria-label={c.activo ? 'Desactivar cuenta' : 'Activar cuenta'}
                        />
                        <span className="adm-toggle-slider" />
                      </label>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal — Agregar */}
        {modal === 'agregar' && createPortal(
          <div className="com-overlay" role="dialog" aria-modal="true" aria-label="Agregar correo autorizado" onClick={() => !guardando && setModal(false)}>
            <div className="com-modal" onClick={e => e.stopPropagation()}>
              <div className="com-modal-top">
                <h3>Agregar correo autorizado</h3>
                <button type="button" className="com-modal-x" onClick={() => setModal(false)} disabled={guardando} aria-label="Cerrar">✕</button>
              </div>
              <form onSubmit={agregarCorreo} className="adm-modal-form" data-analytics-form="PANEL_ADMIN_USUARIO">
                <label>Email institucional
                  <input className="com-pill-input" type="email" placeholder="usuario@anam.gob.mx"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required />
                </label>
                <label>Nombre completo
                  <input className="com-pill-input" type="text" placeholder="Nombre Apellido"
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    required />
                </label>
                <label>Rol
                  <select className="com-pill-input" value={form.rol} onChange={e => {
                    const rol = e.target.value
                    setForm(f => ({ ...f, rol }))
                    setError('')
                  }}>
                    <option value="ROL1">Particular del Titular</option>
                    <option value="ROL2">Titular/Enlace Estratégico</option>
                    <option value="COMISIONADO">Comisionado</option>
                    <option value="EQUIPO_PARTICULAR">Equipo del Particular</option>
                  </select>
                </label>
                {form.rol === 'EQUIPO_PARTICULAR' ? (
                  <div className="adm-direccion-heredada">
                    <span className="adm-direccion-heredada-label">Dirección</span>
                    <span className="adm-direccion-heredada-valor">{yo?.unidadAdministrativa || 'Sin unidad asignada'}</span>
                  </div>
                ) : (
                  <label>Unidad administrativa{form.rol === 'COMISIONADO' && <span className="adm-campo-requerido"> *</span>}
                    <select
                      className={`com-pill-input${unidadFaltante && error ? ' adm-select-error' : ''}`}
                      value={form.unidadAdministrativa}
                      onChange={e => { setForm(f => ({ ...f, unidadAdministrativa: e.target.value })); setError('') }}>
                      <option value="" disabled={form.rol === 'COMISIONADO'}>Sin asignar</option>
                      <optgroup label="Direcciones generales">
                        {direccionesGenerales.map(u => (
                          <option key={u.idUnidadAdministrativa} value={u.idUnidadAdministrativa}>
                            {u.clave} — {u.unidadAdministrativa}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Aduanas">
                        {aduanas.map(u => (
                          <option key={u.idUnidadAdministrativa} value={u.idUnidadAdministrativa}>
                            {u.clave} — {u.unidadAdministrativa}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </label>
                )}
                {form.rol === 'COMISIONADO' && (
                  <p className="adm-nota-comisionado">
                    El Comisionado queda vinculado a esta dirección: solo podrá recibir y ver los FUS que un Titular de esa misma dirección le comisione.
                  </p>
                )}
                {form.rol === 'EQUIPO_PARTICULAR' && (
                  <p className="adm-nota-comisionado">
                    Este usuario podrá llenar, turnar y consultar FUS en tu representación: solo verá y operará las solicitudes registradas por ti.
                  </p>
                )}
                {error && <p className="com-alert-error">{error}</p>}
                <div className="com-confirm-acciones">
                  <button type="button" className="com-btn-ghost" onClick={() => setModal(false)} disabled={guardando}>Cancelar</button>
                  <button type="submit" className={`com-btn-verde${unidadFaltante ? ' adm-btn-save-bloqueado' : ''}`} disabled={guardando}>
                    {guardando && <span className="btn-spinner" />}
                    {guardando ? 'Guardando…' : 'Agregar'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Modal — Editar */}
        {modal === 'editar' && editando && createPortal(
          <div className="com-overlay" role="dialog" aria-modal="true" aria-label="Editar usuario" onClick={() => !guardando && setModal(false)}>
            <div className="com-modal" onClick={e => e.stopPropagation()}>
              <div className="com-modal-top">
                <h3>Editar usuario</h3>
                <button type="button" className="com-modal-x" onClick={() => setModal(false)} disabled={guardando} aria-label="Cerrar">✕</button>
              </div>
              <form onSubmit={guardarEdicion} className="adm-modal-form" data-analytics-form="PANEL_ADMIN_USUARIO">
                <label>Nombre completo
                  <input className="com-pill-input" type="text" placeholder="Nombre Apellido"
                    value={formEdit.nombre}
                    onChange={e => setFormEdit(f => ({ ...f, nombre: e.target.value }))}
                    required />
                </label>
                <label>Correo electrónico
                  <input className="com-pill-input" type="email" placeholder="usuario@anam.gob.mx"
                    value={formEdit.email}
                    onChange={e => setFormEdit(f => ({ ...f, email: e.target.value }))}
                    required />
                </label>
                <label>Rol
                  <select className="com-pill-input" value={formEdit.rol}
                    onChange={e => setFormEdit(f => ({ ...f, rol: e.target.value }))}>
                    <option value="ROL1">Particular del Titular</option>
                    <option value="ROL2">Titular/Enlace Estratégico</option>
                    <option value="COMISIONADO">Comisionado</option>
                    <option value="EQUIPO_PARTICULAR">Equipo del Particular</option>
                  </select>
                </label>
                <label>Unidad administrativa
                  <select className="com-pill-input" value={formEdit.unidadAdministrativa}
                    onChange={e => setFormEdit(f => ({ ...f, unidadAdministrativa: e.target.value }))}>
                    <option value="">Sin asignar</option>
                    <optgroup label="Direcciones generales">
                      {direccionesGenerales.map(u => (
                        <option key={u.idUnidadAdministrativa} value={u.idUnidadAdministrativa}>
                          {u.clave} — {u.unidadAdministrativa}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Aduanas">
                      {aduanas.map(u => (
                        <option key={u.idUnidadAdministrativa} value={u.idUnidadAdministrativa}>
                          {u.clave} — {u.unidadAdministrativa}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
                {error && <p className="com-alert-error">{error}</p>}
                <div className="com-confirm-acciones">
                  <button type="button" className="com-btn-ghost" onClick={() => setModal(false)} disabled={guardando}>Cancelar</button>
                  <button type="submit" className="com-btn-verde" disabled={guardando}>
                    {guardando && <span className="btn-spinner" />}
                    {guardando ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      </div>
      </div>
    </AppLayout>
  )
}
