import { expect, test } from '@playwright/test'

const USUARIO = {
  id: 906,
  email: 'prueba.modales@anam.gob.mx',
  nombre: 'Prueba Modales',
  rol: 'ROL1',
}

const FUS = {
  id: 701,
  folio: 'FUS/MODAL/0701',
  descripcion: 'Solicitud para probar modales',
  fechaHora: '2026-07-28T12:00:00',
  estatusParticular: 'Registrado',
  idMedioRecepcion: { nombreMedio: 'Correo electrónico' },
}

async function prepararModal(page, { retrasarHistorial = false } = {}) {
  await page.addInitScript(usuario => {
    sessionStorage.setItem('scs_user', JSON.stringify(usuario))
  }, USUARIO)

  await page.route(url => new URL(url).pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/token/refresh/') {
      return route.fulfill({ json: { access: 'token-modales' } })
    }
    if (url.pathname === '/api/notificaciones/') return route.fulfill({ json: [] })
    if (url.pathname.startsWith('/api/catalogos/')) return route.fulfill({ json: [] })
    if (url.pathname === '/api/fus/') {
      return route.fulfill({ json: { results: [FUS], total: 1 } })
    }
    if (url.pathname.includes('/api/fus/trazabilidad/')) {
      if (retrasarHistorial) await new Promise(resolve => setTimeout(resolve, 1200))
      return route.fulfill({
        json: {
          eventos: [{
            tipo: 'creacion',
            fecha: '2026-07-28T12:00:00',
            detalle: 'Solicitud registrada',
            actor: 'Prueba Modales',
          }],
        },
      })
    }
    return route.fulfill({ json: { results: [], total: 0 } })
  })
}

test('Escape cierra el modal, restaura el fondo y cancela su actualización visual', async ({ page }) => {
  await prepararModal(page, { retrasarHistorial: true })
  await page.goto('/rol1/consultar-fus?modo=lista')

  await page.getByTitle('Ver historial').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden')

  await page.keyboard.press('Escape')

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('')
  await page.waitForTimeout(1400)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByPlaceholder(/Buscar por folio/)).toBeEnabled()
})

test('el botón cerrar deja la pantalla utilizable y permite abrir nuevamente', async ({ page }) => {
  await prepararModal(page)
  await page.goto('/rol1/consultar-fus?modo=lista')

  await page.getByTitle('Ver historial').click()
  await expect(page.getByText('Solicitud registrada')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click()

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByTitle('Ver historial').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Solicitud registrada')).toBeVisible()
})
