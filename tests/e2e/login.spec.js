import { expect, test } from '@playwright/test'

const USUARIO = {
  id: 901,
  email: 'prueba.e2e@anam.gob.mx',
  nombre: 'Prueba E2E',
  rol: 'ROL1',
}

test.beforeEach(async ({ page }) => {
  await page.route(url => new URL(url).pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (path.endsWith('/auth/verificar-correo/')) {
      return route.fulfill({ json: { estado: 'existente' } })
    }
    if (path.endsWith('/auth/login/')) {
      return route.fulfill({ json: { access: 'token-e2e', user: USUARIO } })
    }
    if (path.endsWith('/notificaciones/')) {
      return route.fulfill({ json: [] })
    }
    return route.fulfill({ json: { results: [], total: 0 } })
  })
})

test('un usuario existente inicia sesión y llega a su dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('usuario@anam.gob.mx').fill(USUARIO.email)
  await page.getByRole('button', { name: 'Continuar' }).click()

  await expect(page.getByLabel('Contraseña')).toBeVisible()
  await page.getByLabel('Contraseña').fill('Password-Prueba-2026!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()

  await expect(page).toHaveURL(/\/rol1\/dashboard$/)
})

test('muestra un mensaje comprensible cuando falla la verificación', async ({ page }) => {
  await page.route(
    url => new URL(url).pathname === '/api/auth/verificar-correo/',
    route => route.abort(),
  )
  await page.goto('/login')
  await page.getByPlaceholder('usuario@anam.gob.mx').fill(USUARIO.email)
  await page.getByRole('button', { name: 'Continuar' }).click()

  await expect(page.getByRole('alert')).toHaveText('Error al verificar el correo.')
})
