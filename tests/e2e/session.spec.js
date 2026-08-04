import { expect, test } from '@playwright/test'

const USUARIO = {
  id: 902,
  email: 'prueba.sesion@anam.gob.mx',
  nombre: 'Prueba Sesión',
  rol: 'ROL1',
}

async function abrirSesionGuardada(page) {
  await page.addInitScript(usuario => {
    sessionStorage.setItem('scs_user', JSON.stringify(usuario))
  }, USUARIO)
}

test('varios 401 simultáneos comparten una sola renovación de token', async ({ page }) => {
  await abrirSesionGuardada(page)
  let renovaciones = 0

  await page.route(url => new URL(url).pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (path === '/api/auth/token/refresh/') {
      renovaciones += 1
      return route.fulfill({
        json: { access: renovaciones === 1 ? 'token-inicial' : 'token-renovado' },
      })
    }

    const protegido = path === '/api/fus/' || path === '/api/bitacora/'
    const token = request.headers().authorization
    if (protegido && token === 'Bearer token-inicial') {
      return route.fulfill({ status: 401, json: { detail: 'Token vencido' } })
    }

    if (path === '/api/notificaciones/') return route.fulfill({ json: [] })
    return route.fulfill({ json: { results: [], total: 0 } })
  })

  await page.goto('/rol1/dashboard')

  await expect(page).toHaveURL(/\/rol1\/dashboard$/)
  await expect.poll(() => renovaciones).toBe(2)
  await expect(page.getByRole('heading', { name: 'Hola, Prueba Sesión' })).toBeVisible()
})

test('un fallo temporal de renovación no expulsa al usuario', async ({ page }) => {
  await abrirSesionGuardada(page)
  let renovaciones = 0

  await page.route(url => new URL(url).pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (path === '/api/auth/token/refresh/') {
      renovaciones += 1
      if (renovaciones === 1) {
        return route.fulfill({ json: { access: 'token-inicial' } })
      }
      return route.fulfill({ status: 503, json: { detail: 'Servicio temporalmente no disponible' } })
    }

    if (path === '/api/fus/') {
      return route.fulfill({ status: 401, json: { detail: 'Token vencido' } })
    }
    if (path === '/api/notificaciones/') return route.fulfill({ json: [] })
    return route.fulfill({ json: { results: [], total: 0 } })
  })

  await page.goto('/rol1/dashboard')

  await expect.poll(() => renovaciones).toBeGreaterThanOrEqual(2)
  await page.waitForTimeout(1500)
  await expect(page).toHaveURL(/\/rol1\/dashboard$/)
  await expect(page.getByText('Prueba Sesión', { exact: true })).toBeVisible()
  await expect(page.getByText('No se pudo cargar el dashboard.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('scs_user')))
    .not.toBeNull()
})
