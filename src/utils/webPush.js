// Suscripción Web Push (Service Worker) — separado de NotificacionesContext
// para no mezclar la lógica de conversión de llaves/registro del navegador
// con el estado de React.

// Service Worker/Push requieren "contexto seguro": HTTPS, o localhost
// (navegadores lo tratan como seguro para desarrollo aunque use HTTP plano)
// — comprobar solo `location.protocol === 'https:'` bloqueaba el flujo
// completo al probarlo en local (donde el backend sí expone un par VAPID de
// desarrollo fijo, ver backend/settings.py, precisamente para que funcione
// sin configurar nada), aunque el navegador lo hubiera permitido igual.
export function contextoSeguroParaPush() {
  const { protocol, hostname } = window.location
  return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1'
}

// PushManager.subscribe() exige la llave VAPID como Uint8Array, no como el
// string base64url que entrega el backend.
function base64UrlToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

export async function suscribirPush(api) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  try {
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      const { data } = await api.get('/push/vapid-public-key/')
      if (!data?.publicKey) return false
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(data.publicKey),
      })
    }
    await api.post('/push/suscribir/', subscription.toJSON())
    return true
  } catch {
    // Permiso revocado a mitad de vuelo, VAPID key no configurada del lado
    // del servidor, navegador sin soporte real pese a exponer las APIs, etc.
    // — sin push real, las notificaciones in-app (WebSocket) siguen
    // funcionando igual, así que no hay nada más que hacer aquí.
    return false
  }
}

export async function desuscribirPush(api) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return
    await api.post('/push/desuscribir/', { endpoint: subscription.endpoint }).catch(() => {})
    await subscription.unsubscribe()
  } catch {
    /* nada que limpiar del lado del navegador */
  }
}
