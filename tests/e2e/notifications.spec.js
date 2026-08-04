import { expect, test } from '@playwright/test'

const USUARIO = {
  id: 909,
  email: 'prueba.notificaciones@anam.gob.mx',
  nombre: 'Prueba Notificaciones',
  rol: 'ROL1',
}

async function instalarWebSocketFalso(page) {
  await page.addInitScript(() => {
    window.__wsInstances = []
    class WebSocketFalso {
      constructor(url) {
        this.url = url
        this.readyState = 0
        window.__wsInstances.push(this)
        setTimeout(() => {
          if (this.readyState !== 0) return
          this.readyState = 1
          this.onopen?.({})
        }, 0)
      }

      close() {
        this.readyState = 3
      }

      emitir(notificacion) {
        this.onmessage?.({ data: JSON.stringify(notificacion) })
      }

      desconectar(code = 1006) {
        this.readyState = 3
        this.onclose?.({ code })
      }
    }
    window.WebSocket = WebSocketFalso
  })
}

async function prepararSesion(page, responderNotificaciones) {
  await page.addInitScript(usuario => {
    sessionStorage.setItem('scs_user', JSON.stringify(usuario))
  }, USUARIO)
  await instalarWebSocketFalso(page)

  await page.route(url => new URL(url).pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/token/refresh/') {
      return route.fulfill({ json: { access: 'token-notificaciones' } })
    }
    if (path === '/api/notificaciones/') return responderNotificaciones(route)
    if (path === '/api/auth/logout/') return route.fulfill({ status: 204 })
    return route.fulfill({ json: { results: [], total: 0 } })
  })
}

test('una carga REST antigua no borra ni duplica una notificación WebSocket', async ({ page }) => {
  let resolverCarga
  const cargaPendiente = new Promise(resolve => { resolverCarga = resolve })
  await prepararSesion(page, async route => {
    await cargaPendiente
    return route.fulfill({ json: [] })
  })

  await page.goto('/rol1/dashboard')
  await expect.poll(() => page.evaluate(
    () => window.__wsInstances.filter(
      socket => socket.readyState === 1 && socket.url.includes('/ws/notificaciones/'),
    ).length,
  )).toBe(1)

  const notificacion = {
    id: 'notif-e2e-1',
    tipo: 'CAMBIO_ESTADO',
    mensaje: 'Actualización recibida en vivo',
    fusFolio: 'FUS/WS/0001',
    fechaCreacion: new Date().toISOString(),
    leida: false,
  }
  await page.evaluate(notif => {
    const socket = window.__wsInstances.find(
      item => item.readyState === 1 && item.url.includes('/ws/notificaciones/'),
    )
    socket.emitir(notif)
    socket.emitir(notif)
  }, notificacion)
  resolverCarga()

  await expect(page.getByRole('button', { name: 'Notificaciones (1 nuevas)' })).toBeVisible()
  await page.getByRole('button', { name: 'Notificaciones (1 nuevas)' }).click()
  await expect(page.getByText(notificacion.mensaje)).toHaveCount(1)
})

test('reconecta después de una caída y cancela el reintento al cerrar sesión', async ({ page }) => {
  await prepararSesion(page, route => route.fulfill({ json: [] }))
  await page.goto('/rol1/dashboard')
  await expect.poll(() => page.evaluate(
    () => window.__wsInstances.filter(
      socket => socket.readyState === 1 && socket.url.includes('/ws/notificaciones/'),
    ).length,
  )).toBe(1)
  const conexionesIniciales = await page.evaluate(() => window.__wsInstances.filter(
    socket => socket.url.includes('/ws/notificaciones/'),
  ).length)

  await page.evaluate(() => {
    window.__wsInstances.find(
      socket => socket.readyState === 1 && socket.url.includes('/ws/notificaciones/'),
    ).desconectar()
  })
  await expect.poll(() => page.evaluate(() => window.__wsInstances.filter(
    socket => socket.url.includes('/ws/notificaciones/'),
  ).length))
    .toBe(conexionesIniciales + 1)

  await page.evaluate(() => {
    window.__wsInstances.find(
      socket => socket.readyState === 1 && socket.url.includes('/ws/notificaciones/'),
    ).desconectar()
  })
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.waitForTimeout(2200)

  await expect.poll(() => page.evaluate(() => window.__wsInstances.filter(
    socket => socket.url.includes('/ws/notificaciones/'),
  ).length))
    .toBe(conexionesIniciales + 1)
  await expect(page.getByRole('button', { name: /Notificaciones/ })).toHaveCount(0)
})
