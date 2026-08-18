import { useEffect, useRef, useState } from 'react'
import api from '../../../api/api'
import { actualizarUsuarioAdmin, eliminarUsuarioAdmin, ejecutarAccionUsuario, mensajeErrorAdmin } from '../api/adminApi'
import { useAnalytics } from '../../../analytics'

const ROL_OPCIONES = [
  { value: 'ROL1', label: 'Particular del Titular' },
  { value: 'ROL2', label: 'Titular / Enlace Estratégico' },
  { value: 'COMISIONADO', label: 'Comisionado' },
  { value: 'EQUIPO_PARTICULAR', label: 'Equipo del Particular' },
  { value: 'ADMIN', label: 'Administrador del sistema' },
]

export default function ModalUsuario({ usuario, onClose, onUpdated, onDeleted }) {
  const closeRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unidades, setUnidades] = useState([])
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [form, setForm] = useState(() => ({
    nombre: usuario.nombre || '',
    rol: usuario.rol || 'ROL1',
    unidadAdministrativaId: usuario.unidadAdministrativa?.id ?? '',
  }))

  // Requiere una cuenta ya activada (con contraseña propia) — no hay sesiones
  // ni bloqueo que gestionar para un correo apenas autorizado.
  const pk = usuario.id ?? usuario.autorizacionId
  const { startTask, completeTask, failTask } = useAnalytics({ componente: 'ADMIN_USUARIO_MODAL' })

  useEffect(() => {
    closeRef.current?.focus()
    const key = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])

  useEffect(() => {
    api.get('/catalogos/unidades-administrativas/')
      .then(r => setUnidades(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
  }, [])

  const ejecutar = async (accion, payload) => {
    setBusy(true)
    setError('')
    const taskId = startTask({ accion: accion === 'guardar' ? 'UPDATE' : 'UPDATE', metadatos: { control: accion } })
    try {
      if (accion === 'guardar') {
        const value = await actualizarUsuarioAdmin(pk, {
          nombre: form.nombre,
          rol: form.rol,
          unidadAdministrativaId: form.unidadAdministrativaId || null,
        })
        completeTask(taskId)
        onUpdated(value)
      } else {
        const value = await ejecutarAccionUsuario(pk, accion, payload)
        completeTask(taskId)
        onUpdated(value.usuario)
      }
    } catch (e) {
      failTask(taskId, { metadatos: { motivo: e.response ? 'error_servidor' : 'sin_conexion' } })
      setError(mensajeErrorAdmin(e))
    } finally {
      setBusy(false)
    }
  }

  const eliminar = async () => {
    setBusy(true)
    setError('')
    const taskId = startTask({ accion: 'UPDATE', metadatos: { control: 'eliminar' } })
    try {
      await eliminarUsuarioAdmin(pk)
      completeTask(taskId)
      onDeleted(usuario)
    } catch (e) {
      failTask(taskId, { metadatos: { motivo: e.response ? 'error_servidor' : 'sin_conexion' } })
      setError(mensajeErrorAdmin(e))
      setConfirmandoEliminar(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sa-modal-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <section className="sa-modal" role="dialog" aria-modal="true" aria-labelledby="sa-user-title">
        <button ref={closeRef} className="sa-modal__close" onClick={onClose} aria-label="Cerrar">×</button>
        <h2 id="sa-user-title">Administrar usuario</h2>
        <p>{usuario.email}</p>
        {error && <div className="sa-error">{error}</div>}

        <label>Nombre completo
          <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
        </label>
        <label>Rol
          <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
            {ROL_OPCIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label>Unidad administrativa
          <select value={form.unidadAdministrativaId} onChange={e => setForm({ ...form, unidadAdministrativaId: e.target.value })}>
            <option value="">Sin unidad asignada</option>
            {unidades.map(u => (
              <option key={u.idUnidadAdministrativa} value={u.idUnidadAdministrativa}>{u.unidadAdministrativa}</option>
            ))}
          </select>
        </label>

        <div className="sa-modal__actions">
          <button disabled={busy} onClick={() => ejecutar('guardar')}>Guardar</button>
          <button disabled={busy} onClick={() => ejecutar(usuario.activo ? 'desactivar' : 'activar')}>
            {usuario.activo ? 'Desactivar' : 'Activar'}
          </button>
          {usuario.id && usuario.bloqueado && (
            <button disabled={busy} onClick={() => ejecutar('desbloquear')}>Desbloquear</button>
          )}
          {usuario.id && (
            <button disabled={busy} onClick={() => ejecutar('cerrar-sesiones')}>Cerrar sesiones</button>
          )}
          <button className="sa-danger-button" disabled={busy} onClick={() => setConfirmandoEliminar(true)}>Eliminar usuario</button>
        </div>
        {confirmandoEliminar && <div className="sa-delete-confirm" role="alertdialog" aria-labelledby="sa-delete-title"><h3 id="sa-delete-title">¿Eliminar a {usuario.nombre}?</h3><p>Se eliminarán su autorización, cuenta y sesiones. Si tiene expedientes históricos relacionados, el sistema impedirá la operación y podrás desactivarlo.</p><div><button disabled={busy} onClick={() => setConfirmandoEliminar(false)}>Cancelar</button><button className="sa-danger-button" disabled={busy} onClick={eliminar}>{busy ? 'Eliminando…' : 'Sí, eliminar'}</button></div></div>}
      </section>
    </div>
  )
}
