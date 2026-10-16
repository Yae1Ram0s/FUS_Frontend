import { expect, test } from '@playwright/test'

const USUARIO = {
  id: 908,
  email: 'prueba.recorrido@anam.gob.mx',
  nombre: 'Prueba Recorrido',
  rol: 'ROL1',
}

async function prepararFormulario(page) {
  await page.addInitScript(usuario => {
    localStorage.setItem('scs_user', JSON.stringify(usuario))
  }, USUARIO)

  await page.route(url => new URL(url).pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/token/refresh/') {
      return route.fulfill({ json: { access: 'token-recorrido' } })
    }
    if (path === '/api/notificaciones/') return route.fulfill({ json: [] })
    if (path === '/api/catalogos/medios/') {
      return route.fulfill({
        json: [
          { id: 1, nombreMedio: 'Correo electrónico', paraTurnado: 1 },
          { id: 2, nombreMedio: 'Otro', paraTurnado: 1 },
        ],
      })
    }
    return route.fulfill({ json: [] })
  })
}

test('elegir un medio incompleto guía a la descripción', async ({ page }) => {
  await prepararFormulario(page)
  await page.goto('/rol1/registrar-fus')

  await page.getByLabel(/Medio de recepción/).selectOption('1')
  await expect(page.getByLabel(/Descripción/)).toBeFocused()
})

test('el medio Otro pide especificación y Enter avanza sin enviar', async ({ page }) => {
  await prepararFormulario(page)
  let envios = 0
  await page.route('**/api/fus/', async route => {
    if (route.request().method() === 'POST') envios += 1
    return route.fulfill({ json: { results: [], total: 0 } })
  })
  await page.goto('/rol1/registrar-fus')

  await page.getByLabel(/Medio de recepción/).selectOption('2')
  const especificacion = page.getByPlaceholder('Especifica el medio de recepción')
  await expect(especificacion).toBeFocused()
  await especificacion.fill('Mensajería')
  await especificacion.press('Enter')

  await expect(page.getByLabel(/Descripción/)).toBeFocused()
  expect(envios).toBe(0)
})

test('corregir el medio con descripción completa no vuelve a enfocar ni desplazar la descripción', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1400 })
  await prepararFormulario(page)
  await page.goto('/rol1/registrar-fus')

  await page.getByLabel(/Descripción/).fill('Descripción suficientemente larga para ser válida.')
  await page.evaluate(() => window.scrollTo(0, 0))
  const antes = await page.evaluate(() => window.scrollY)

  const medio = page.getByRole('radio', { name: 'Correo electrónico' })
  await medio.check()
  await expect(medio).toBeFocused()
  await page.waitForTimeout(250)

  expect(await page.evaluate(() => window.scrollY)).toBe(antes)
  await expect(page.getByLabel(/Descripción/)).not.toBeFocused()
})
