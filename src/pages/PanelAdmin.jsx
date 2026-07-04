import { useState, useEffect } from 'react'
import api from '../api/api'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import { useAuth } from '../context/AuthContext'
import './PanelAdmin.css'

const ROL_LABELS = { ROL1: 'Particular', ROL2: 'Titular / Enlace' }
const ROL_COLORS = { ROL1: '#1F5647',    ROL2: '#691C32'          }

export default function PanelAdmin() {
  const { user: yo } = useAuth()

  const [correos,    setCorreos]    = useState([])
  const [cargando,   setCargando]   = useState(true)
  const [busqueda,   setBusqueda]   = useState('')
  const [filtroRol,  setFiltroRol]  = useState('')
  const [modal,      setModal]      = useState(false)   // 'agregar' | 'editar' | false
  const [form,       setForm]       = useState({ email: '', nombre: '', rol: 'ROL1' })
  const [editando,   setEditando]   = useState(null)
  const [formEdit,   setFormEdit]   = useState({ nombre: '', email: '', rol: 'ROL1' })
  const [guardando,  setGuardando]  = useState(false)
  const [error,      setError]      = useState('')
  const [errorCarga, setErrorCarga] = useState('')
  const [exito,      setExito]      = useState('')
  const [reload,     setReload]     = useState(0)

  const cargar = () => setReload(n => n + 1)

  useEffect(() => {
    setCargando(true)
    setErrorCarga('')
    const params = {}
    if (busqueda)  params.search = busqueda
    if (filtroRol) params.rol    = filtroRol
    api.get('/auth/correos-autorizados/', { params })
      .then(r => setCorreos(Array.isArray(r.data) ? r.data : []))
      .catch(err => setErrorCarga(err.response?.data?.detail || 'No se pudo cargar la lista. Verifica tu sesión.'))
      .finally(() => setCargando(false))
  }, [busqueda, filtroRol, reload])

  const abrirEditar = (c) => {
    setEditando(c)
    setFormEdit({ nombre: c.nombre, email: c.email, rol: c.rol })
    setError('')
    setModal('editar')
  }

  const guardarEdicion = async (e) => {
    e.preventDefault()
    setError(''); setGuardando(true)
    try {
      await api.patch(`/auth/correos-autorizados/${editando.id}/`, formEdit)
      setExito('Usuario actualizado correctamente.')
      setModal(false)
      setEditando(null)
      cargar()
      setTimeout(() => setExito(''), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar los cambios.')
    } finally {
      setGuardando(false)
    }
  }

  const toggleActivo = async (c) => {
    if (c.email === yo?.email) {
      setErrorCarga('No puedes desactivar tu propia cuenta.')
      return
    }
    await api.patch(`/auth/correos-autorizados/${c.id}/`, { activo: c.activo ? 0 : 1 })
    cargar()
  }

  const agregarCorreo = async (e) => {
    e.preventDefault()
    setError(''); setGuardando(true)
    try {
      await api.post('/auth/correos-autorizados/', form)
      setExito('Correo agregado correctamente.')
      setModal(false)
      setForm({ email: '', nombre: '', rol: 'ROL1' })
      cargar()
      setTimeout(() => setExito(''), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo agregar el correo.')
    } finally {
      setGuardando(false)
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
          <button className="adm-btn-add" onClick={() => { setModal('agregar'); setError('') }}>
            + Agregar correo
          </button>
        </div>

        {/* Stats */}
        <div className="adm-stats">
          <div className="adm-stat">
            <span className="adm-stat-num">{correos.length}</span>
            <span className="adm-stat-lbl">Total</span>
          </div>
          <div className="adm-stat adm-stat-green">
            <span className="adm-stat-num">{activos}</span>
            <span className="adm-stat-lbl">Activos</span>
          </div>
          <div className="adm-stat adm-stat-red">
            <span className="adm-stat-num">{inactivos}</span>
            <span className="adm-stat-lbl">Inactivos</span>
          </div>
          {Object.entries(ROL_LABELS).map(([k, v]) => (
            <div key={k} className="adm-stat">
              <span className="adm-stat-num" style={{ color: ROL_COLORS[k] }}>
                {correos.filter(c => c.rol === k).length}
              </span>
              <span className="adm-stat-lbl">{v}</span>
            </div>
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
            <option value="ROL2">Titular / Enlace</option>
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
                <th>Cuenta</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr><td colSpan={6} className="adm-loading"><Spinner overlay={false} /></td></tr>
              )}
              {!cargando && correos.length === 0 && (
                <tr><td colSpan={6} className="adm-loading">Sin resultados.</td></tr>
              )}
              {correos.map(c => (
                <tr key={c.id} className={!c.activo ? 'adm-row-inactivo' : ''}>
                  <td className="adm-email">{c.email}</td>
                  <td>{c.nombre}</td>
                  <td>
                    <span className={`adm-rol-badge adm-rol-badge-${c.rol?.toLowerCase()}`}>
                      {ROL_LABELS[c.rol] || c.rol}
                    </span>
                  </td>
                  <td>
                    <span className={`adm-cuenta ${c.tiene_cuenta ? 'adm-cuenta-si' : 'adm-cuenta-no'}`}>
                      {c.tiene_cuenta ? 'Registrado' : 'Sin cuenta'}
                    </span>
                  </td>
                  <td>
                    <span className={`adm-estado ${c.activo ? 'adm-estado-activo' : 'adm-estado-inactivo'}`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="adm-acciones-cell">
                      <button className="adm-btn-edit" onClick={() => abrirEditar(c)}>
                        Editar
                      </button>
                      <button
                        className={`adm-toggle ${c.activo ? 'adm-toggle-des' : 'adm-toggle-act'}`}
                        onClick={() => toggleActivo(c)}
                      >
                        {c.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal — Agregar */}
        {modal === 'agregar' && (
          <div className="adm-overlay" onClick={() => setModal(false)}>
            <div className="adm-modal" onClick={e => e.stopPropagation()}>
              <h3 className="adm-modal-title">Agregar correo autorizado</h3>
              <form onSubmit={agregarCorreo} className="adm-modal-form">
                <label>Email institucional
                  <input type="email" placeholder="usuario@anam.gob.mx"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required />
                </label>
                <label>Nombre completo
                  <input type="text" placeholder="Nombre Apellido"
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    required />
                </label>
                <label>Rol
                  <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                    <option value="ROL1">Particular del Titular</option>
                    <option value="ROL2">Titular / Enlace</option>
                  </select>
                </label>
                {error && <p className="adm-modal-error">{error}</p>}
                <div className="adm-modal-actions">
                  <button type="button" className="adm-btn-cancel" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="adm-btn-save" disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Agregar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal — Editar */}
        {modal === 'editar' && editando && (
          <div className="adm-overlay" onClick={() => setModal(false)}>
            <div className="adm-modal" onClick={e => e.stopPropagation()}>
              <h3 className="adm-modal-title">Editar usuario</h3>
              <form onSubmit={guardarEdicion} className="adm-modal-form">
                <label>Nombre completo
                  <input type="text" placeholder="Nombre Apellido"
                    value={formEdit.nombre}
                    onChange={e => setFormEdit(f => ({ ...f, nombre: e.target.value }))}
                    required />
                </label>
                <label>Correo electrónico
                  <input type="email" placeholder="usuario@anam.gob.mx"
                    value={formEdit.email}
                    onChange={e => setFormEdit(f => ({ ...f, email: e.target.value }))}
                    required />
                </label>
                <label>Rol
                  <select value={formEdit.rol}
                    onChange={e => setFormEdit(f => ({ ...f, rol: e.target.value }))}>
                    <option value="ROL1">Particular del Titular</option>
                    <option value="ROL2">Titular / Enlace</option>
                  </select>
                </label>
                {error && <p className="adm-modal-error">{error}</p>}
                <div className="adm-modal-actions">
                  <button type="button" className="adm-btn-cancel" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="adm-btn-save" disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
      </div>
    </AppLayout>
  )
}
