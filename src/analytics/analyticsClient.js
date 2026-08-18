import api, { getAccessToken } from '../api/api'

const ENDPOINT = '/analitica/eventos/'
const ABSOLUTE_ENDPOINT = '/api/analitica/eventos/'
const SESSION_KEY = 'scs_analytics_session_id'
const QUEUE_KEY = 'scs_analytics_queue_v1'
const FLUSH_INTERVAL_MS = 15_000
const MAX_BATCH_SIZE = 20
const MAX_RETRIES = 2
const MAX_QUEUE_SIZE = 200

export const ANALYTICS_ACTIONS = Object.freeze([
  'SEARCH',
  'FILTER',
  'EXPORT',
  'OPEN',
  'CREATE',
  'UPDATE',
  'NAVIGATE',
])

const SENSITIVE_KEY = /(email|correo|folio|texto|descripcion|description|nombre|name|usuario|user|contacto|input|value|valor|password|contrasena|token|telefono|phone)/i
const SENSITIVE_VALUE = /(@|\bFUS\b|\/FUS\/|bearer\s|https?:\/\/)/i
const SAFE_METADATA_KEYS = new Set([
  'tipo', 'origen', 'destino', 'formato', 'vista', 'periodo', 'orden',
  'categoria', 'breakpoint', 'estado', 'prioridad', 'rol', 'total',
  'pagina', 'opcion', 'control', 'motivo',
])

const ROUTES = [
  ['/rol1/dashboard', 'INICIO'],
  ['/rol1/consultar-fus', 'CONSULTAR_FUS'],
  ['/rol1/registrar-fus', 'REGISTRAR_FUS'],
  ['/rol1/bitacora', 'BITACORA'],
  ['/rol1/calendario', 'CALENDARIO'],
  ['/rol1/reportes', 'REPORTES'],
  ['/rol1/panel', 'USUARIOS_ACCESOS'],
  ['/rol2/dashboard', 'INICIO'],
  ['/rol2/solicitudes', 'SOLICITUDES_TURNADAS'],
  ['/rol2/bitacora', 'BITACORA'],
  ['/rol2/calendario', 'CALENDARIO'],
  ['/rol2/reportes', 'REPORTES'],
  ['/comisionado/calendario', 'CALENDARIO'],
  ['/comisionado/fus-comisionados', 'SOLICITUDES_ASIGNADAS'],
  ['/comisionado/bitacora', 'BITACORA'],
  ['/admin/inicio', 'ADMIN_RESUMEN'],
  ['/admin/usuarios', 'ADMIN_USUARIOS'],
  ['/admin/salud', 'ADMIN_SALUD'],
  ['/admin/auditoria', 'ADMIN_AUDITORIA'],
  ['/admin/otp', 'ADMIN_OTP'],
  ['/admin/uso', 'ADMIN_USO'],
  ['/login', 'ACCESO'],
]

let queue = []
let flushTimer = null
let inFlight = null
let initialized = false
const activeTasks = new Map()

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const bytes = new Uint8Array(16)
  globalThis.crypto?.getRandomValues?.(bytes)
  if (!bytes.some(Boolean)) {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return [...bytes].map((byte, index) => {
    const hex = byte.toString(16).padStart(2, '0')
    return [4, 6, 8, 10].includes(index) ? `-${hex}` : hex
  }).join('')
}

function sessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = uuid()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return uuid()
  }
}

function identifier(value, fallback, maxLength = 80) {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, maxLength)
  return normalized || fallback
}

function safeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {}
  const safe = {}
  Object.entries(metadata).forEach(([rawKey, rawValue]) => {
    const key = String(rawKey).toLowerCase()
    if (!SAFE_METADATA_KEYS.has(key) || SENSITIVE_KEY.test(key)) return
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      safe[key] = rawValue
      return
    }
    if (typeof rawValue === 'boolean') {
      safe[key] = rawValue
      return
    }
    if (typeof rawValue !== 'string' || SENSITIVE_VALUE.test(rawValue)) return
    const value = rawValue.trim().slice(0, 64)
    // Solo codigos de baja cardinalidad. Al no permitir espacios se descartan
    // textos libres aunque un consumidor use por error una clave permitida.
    if (/^[\p{L}\p{N}_.-]+$/u.test(value)) safe[key] = value
  })
  return safe
}

function device() {
  const width = globalThis.window?.innerWidth || 0
  if (width <= 767) return 'MOVIL'
  if (width <= 1024) return 'TABLETA'
  return 'ESCRITORIO'
}

function nowPerformance() {
  return globalThis.performance?.now?.() ?? Date.now()
}

function persistQueue() {
  try {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)))
  } catch { /* La analitica nunca debe afectar el flujo principal. */ }
}

function restoreQueue() {
  try {
    const restored = JSON.parse(sessionStorage.getItem(QUEUE_KEY) || '[]')
    if (!Array.isArray(restored)) return
    queue = restored
      .filter(item => item?.event?.idEvento && typeof item.attempts === 'number')
      .slice(-MAX_QUEUE_SIZE)
  } catch {
    queue = []
  }
}

export function moduleFromPath(pathname = globalThis.location?.pathname || '/') {
  const path = pathname.toLowerCase()
  return ROUTES.find(([route]) => path.startsWith(route))?.[1] || 'DESCONOCIDO'
}

function safeRoute(pathname) {
  const path = String(pathname || '/').toLowerCase()
  // Nunca se conserva un segmento dinamico: podria contener un folio u otro
  // identificador operativo. La ruta analitica es solo la pantalla base.
  return ROUTES.find(([route]) => path.startsWith(route))?.[0] || '/desconocido'
}

function buildEvent(input) {
  const route = safeRoute(typeof input.ruta === 'string'
    ? input.ruta.split('?')[0].split('#')[0]
    : globalThis.location?.pathname)
  const action = identifier(input.accion, 'OPEN', 24).toUpperCase()

  return {
    idEvento: uuid(),
    ocurridoEn: new Date().toISOString(),
    sesionId: sessionId(),
    modulo: identifier(input.modulo, moduleFromPath(route), 64).toUpperCase(),
    componente: identifier(input.componente, 'PAGINA', 80).toUpperCase(),
    evento: identifier(input.evento, 'INTERACTION', 80).toUpperCase(),
    accion: ANALYTICS_ACTIONS.includes(action) ? action : 'OPEN',
    resultado: identifier(input.resultado, 'RECORDED', 32).toUpperCase(),
    ruta: route,
    duracionMs: Number.isFinite(input.duracionMs)
      ? Math.max(0, Math.round(input.duracionMs))
      : null,
    dispositivo: device(),
    viewportWidth: Math.max(0, Math.round(globalThis.window?.innerWidth || 0)),
    appVersion: identifier(import.meta.env.VITE_APP_VERSION, 'UNKNOWN', 48),
    metadatos: safeMetadata(input.metadatos),
  }
}

function enqueue(event) {
  queue.push({ event, attempts: 0 })
  if (queue.length > MAX_QUEUE_SIZE) queue = queue.slice(-MAX_QUEUE_SIZE)
  persistQueue()
  if (queue.length >= MAX_BATCH_SIZE) queueMicrotask(() => { flushAnalytics() })
}

export function trackAnalytics(input) {
  try {
    const event = buildEvent(input || {})
    enqueue(event)
    return event.idEvento
  } catch {
    return null
  }
}

async function sendBatch(batch, keepalive) {
  const body = { eventos: batch.map(item => item.event) }
  if (!keepalive) {
    await api.post(ENDPOINT, body)
    return
  }

  const token = getAccessToken()
  const response = await fetch(ABSOLUTE_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`Analytics HTTP ${response.status}`)
}

export function flushAnalytics({ keepalive = false } = {}) {
  if (inFlight || queue.length === 0) return inFlight || Promise.resolve()
  const batch = queue.splice(0, MAX_BATCH_SIZE)
  persistQueue()

  inFlight = sendBatch(batch, keepalive)
    .catch(() => {
      const retryable = batch
        .map(item => ({ ...item, attempts: item.attempts + 1 }))
        .filter(item => item.attempts <= MAX_RETRIES)
      queue = [...retryable, ...queue].slice(0, MAX_QUEUE_SIZE)
      persistQueue()
      if (!keepalive && retryable.length) {
        const delay = 1_000 * (2 ** (retryable[0].attempts - 1))
        window.setTimeout(() => { flushAnalytics() }, delay)
      }
    })
    .finally(() => { inFlight = null })

  return inFlight
}

export function startAnalytics() {
  if (initialized) return
  initialized = true
  restoreQueue()
  flushTimer = window.setInterval(() => { flushAnalytics() }, FLUSH_INTERVAL_MS)
}

export function stopAnalytics() {
  if (flushTimer) window.clearInterval(flushTimer)
  flushTimer = null
  initialized = false
}

export function resetAnalyticsSession() {
  queue = []
  activeTasks.clear()
  try {
    sessionStorage.removeItem(QUEUE_KEY)
    sessionStorage.removeItem(SESSION_KEY)
  } catch { /* noop */ }
}

export function beginAnalyticsTask(input) {
  const taskId = uuid()
  const task = {
    ...input,
    taskId,
    startedAt: nowPerformance(),
  }
  activeTasks.set(taskId, task)
  trackAnalytics({ ...input, evento: 'TASK_STARTED', resultado: 'STARTED' })
  return taskId
}

function closeTask(taskId, evento, resultado, extra = {}) {
  const task = activeTasks.get(taskId)
  if (!task) return false
  activeTasks.delete(taskId)
  trackAnalytics({
    ...task,
    ...extra,
    evento,
    resultado,
    duracionMs: nowPerformance() - task.startedAt,
  })
  return true
}

export const completeAnalyticsTask = (taskId, extra) => closeTask(taskId, 'TASK_COMPLETED', 'COMPLETED', extra)
export const failAnalyticsTask = (taskId, extra) => closeTask(taskId, 'TASK_FAILED', 'FAILED', extra)
export const abandonAnalyticsTask = (taskId, extra) => closeTask(taskId, 'TASK_ABANDONED', 'ABANDONED', extra)

export function abandonAllAnalyticsTasks(extra = {}) {
  ;[...activeTasks.keys()].forEach(taskId => abandonAnalyticsTask(taskId, extra))
}
