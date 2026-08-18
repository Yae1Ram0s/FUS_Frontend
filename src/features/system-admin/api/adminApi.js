import api from '../../../api/api'

const BASE = '/auth/admin'
const data = request => request.then(response => response.data)

export function mensajeErrorAdmin(error) {
  const status = error?.response?.status
  const detail = error?.response?.data?.detail || error?.response?.data?.mensaje
  if (detail) return detail
  if (status === 401) return 'Tu sesión venció. Inicia sesión nuevamente.'
  if (status === 403) return 'No tienes permisos de administrador para realizar esta acción.'
  if (status === 409) return 'La operación no puede completarse por el estado actual del usuario.'
  if (status === 503) return 'El servicio no está disponible temporalmente.'
  return 'No fue posible comunicarse con el servidor. Intenta nuevamente.'
}

// Convierte la respuesta de /admin/salud/ (una clave por componente técnico,
// cada una con su propia forma) en la lista uniforme {nombre, estado, detalle,
// latencia} que espera <EstadoServicio>, para reusarla tanto en el resumen
// como en la página dedicada de salud.
export function mapearSalud(salud = {}) {
  const servicios = []
  if (salud.backend) {
    servicios.push({ nombre: 'Backend', estado: salud.backend.ok ? 'operativo' : 'error', detalle: [salud.backend.framework, salud.backend.version].filter(Boolean).join(' ') })
  }
  if (salud.baseDatos) {
    servicios.push({ nombre: 'Base de datos', estado: salud.baseDatos.ok ? 'operativo' : 'error', detalle: salud.baseDatos.motor, latencia: salud.baseDatos.latenciaMs })
  }
  if (salud.correo) {
    servicios.push({ nombre: 'Correo', estado: salud.correo.configurado ? 'operativo' : 'advertencia', detalle: salud.correo.backend })
  }
  if (salud.websocket) {
    const configurado = salud.websocket.configurado
    servicios.push({
      nombre: 'WebSocket',
      estado: configurado ? 'operativo' : 'advertencia',
      detalle: salud.websocket.backend,
      codigo: salud.websocket.codigo,
      diagnostico: salud.websocket.diagnostico || (!configurado
        ? 'Las notificaciones en tiempo real usan memoria local. Pueden funcionar en un solo proceso, pero no se comparten entre varios procesos.'
        : undefined),
      impacto: salud.websocket.impacto || (!configurado
        ? 'En producción, algunos usuarios podrían no recibir actualizaciones en vivo cuando el backend utiliza más de un proceso.'
        : undefined),
      recomendacion: salud.websocket.recomendacion || (!configurado
        ? 'Configura Redis como capa de canales compartida antes de operar con varios procesos.'
        : undefined),
      comprobaciones: salud.websocket.comprobaciones,
    })
  }
  if (salud.almacenamiento) {
    servicios.push({ nombre: 'Almacenamiento', estado: salud.almacenamiento.ok ? 'operativo' : 'error', detalle: salud.almacenamiento.tipo })
  }
  if (salud.migraciones) {
    const alDia = salud.migraciones.pendientes === 0
    servicios.push({ nombre: 'Migraciones', estado: alDia ? 'operativo' : 'advertencia', detalle: alDia ? 'Al día' : `${salud.migraciones.pendientes} pendiente(s)` })
  }
  return servicios
}

// Valores reales que registra `auditar()` en el backend (autenticacion/admin_views.py) —
// no hay categorías genéricas tipo "accesos"/"sesiones", cada acción administrativa
// concreta queda como su propio valor.
export const ACCION_LABELS = {
  ACTUALIZAR_USUARIO: 'Actualizar usuario',
  CREAR_USUARIO_AUTORIZADO: 'Dar de alta usuario',
  ACTIVAR: 'Activar cuenta',
  DESACTIVAR: 'Desactivar cuenta',
  DESBLOQUEAR: 'Desbloquear cuenta',
  ELIMINAR_USUARIO: 'Eliminar usuario',
  CERRAR_SESIONES: 'Cerrar sesiones',
  RESTABLECER_CONTRASENA_TEMPORAL: 'Restablecer contraseña (temporal)',
  RESTABLECER_CONTRASENA_CORREO: 'Restablecer contraseña (correo)',
}

export const obtenerResumenAdmin = ({ signal } = {}) => data(api.get(`${BASE}/resumen/`, { signal }))
export const obtenerMetricasAdmin = (params = {}, { signal } = {}) => data(api.get(`${BASE}/metricas/`, { params, signal }))
export const obtenerUsuariosAdmin = (params = {}, { signal } = {}) => data(api.get(`${BASE}/usuarios/`, { params, signal }))
export const crearUsuarioAdmin = payload => data(api.post(`${BASE}/usuarios/`, payload))
export const actualizarUsuarioAdmin = (id, payload) => data(api.patch(`${BASE}/usuarios/${id}/`, payload))
export const eliminarUsuarioAdmin = id => api.delete(`${BASE}/usuarios/${id}/`).then(() => true)
export const ejecutarAccionUsuario = (id, accion, payload = {}) => data(api.post(`${BASE}/usuarios/${id}/${accion}/`, payload))
export const restablecerContrasena = (id, metodo) => ejecutarAccionUsuario(id, 'restablecer-contrasena', { metodo })
export const obtenerSaludSistema = ({ signal, forzar = false } = {}) => data(api.get(`${BASE}/salud/`, { signal, params: forzar ? { forzar: true } : undefined }))
export const obtenerHistorialSalud = (params = {}, { signal } = {}) => data(api.get(`${BASE}/salud/historial/`, { params, signal }))
export const obtenerAuditoriaAdmin = (params = {}, { signal } = {}) => data(api.get(`${BASE}/auditoria/`, { params, signal }))
export const obtenerOtpAdmin = (params = {}, { signal } = {}) => data(api.get(`${BASE}/otp/`, { params, signal }))
export const obtenerSerieAuditoria = (params = {}, { signal } = {}) => data(api.get(`${BASE}/auditoria/serie/`, { params, signal }))
