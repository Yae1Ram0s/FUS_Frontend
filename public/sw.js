// Service Worker — solo Web Push (RFC 8030), sin cache/offline. Es lo que
// permite que una notificación llegue como aviso real del sistema operativo
// con la app/pestaña cerrada, en PC y en celular: sin esto, `new
// Notification()` directo (sin Service Worker) falla en silencio en Android
// Chrome y no existe en absoluto en iOS Safari — ver NotificacionesContext.jsx.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { titulo: 'SCS', mensaje: event.data ? event.data.text() : '' }
  }

  const titulo = data.titulo || 'SCS — Nueva notificación'
  const opciones = {
    body: data.mensaje || '',
    icon: '/Logo SCS 2026_2.png',
    badge: '/Logo SCS 2026_2.png',
    tag: data.id || undefined,
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(titulo, opciones))
})

// Un clic en la notificación enfoca una pestaña ya abierta de la app si
// existe (navegándola a la ruta del aviso) en vez de siempre abrir una
// nueva — igual que se comportaba el aviso in-page anterior.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
