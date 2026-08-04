import { expect, test } from '@playwright/test'

const USUARIO = {
  id: 907,
  email: 'prueba.formulario@anam.gob.mx',
  nombre: 'Prueba Formulario',
  rol: 'ROL1',
}

async function prepararFormulario(page, responderGuardado) {
  await page.addInitScript(usuario => {
    sessionStorage.setItem('scs_user', JSON.stringify(usuario))
  }, USUARIO)

  await page.route(url => new URL(url).pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/token/refresh/') {
      return route.fulfill({ json: { access: 'token-formulario' } })
    }
    if (url.pathname === '/api/notificaciones/') return route.fulfill({ json: [] })
    if (url.pathname === '/api/catalogos/medios/') {
      return route.fulfill({ json: [{ id: 1, nombreMedio: 'Correo electrónico' }] })
    }
    if (url.pathname === '/api/fus/' && route.request().method() === 'POST') {
      return responderGuardado(route)
    }
    if (url.pathname === '/api/fus/') {
      return route.fulfill({ json: { results: [], total: 0 } })
    }
    return route.fulfill({ json: [] })
  })
}

async function llenarCamposObligatorios(page) {
  await page.getByLabel(/Descripción/).fill(
    'Descripción suficientemente extensa para registrar una solicitud de prueba.',
  )
  await page.getByLabel(/Medio de recepción/).selectOption('1')
  await page.getByRole('button', { name: /Alta/ }).click()
}

test('dos envíos simultáneos generan una sola solicitud', async ({ page }) => {
  let envios = 0
  await prepararFormulario(page, async route => {
    envios += 1
    await new Promise(resolve => setTimeout(resolve, 700))
    return route.fulfill({ json: { id: 801, folio: 'FUS/FORM/0801' } })
  })

  await page.goto('/rol1/registrar-fus')
  await llenarCamposObligatorios(page)

  await page.locator('form.reg-form').evaluate(form => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })

  await expect(page.getByRole('button', { name: /Guardando/ })).toBeDisabled()
  await expect(page.getByRole('status')).toHaveText('Solicitud registrada correctamente.')
  expect(envios).toBe(1)
})

test('un error del servidor conserva los campos y permite volver a intentar', async ({ page }) => {
  await prepararFormulario(page, route =>
    route.fulfill({ status: 503, json: { detail: 'El servicio no está disponible temporalmente.' } }),
  )

  await page.goto('/rol1/registrar-fus')
  await llenarCamposObligatorios(page)
  await page.getByPlaceholder('Antecedentes o información adicional relevante (opcional)')
    .fill('Contexto que no debe perderse si falla el servidor.')
  await page.getByPlaceholder('Nombre completo').fill('Solicitante de prueba')

  await page.getByRole('button', { name: 'Guardar solicitud' }).click()

  await expect(page.getByRole('alert')).toHaveText('El servicio no está disponible temporalmente.')
  await expect(page.getByLabel(/Descripción/)).toHaveValue(/Descripción suficientemente extensa/)
  await expect(page.getByPlaceholder(/Antecedentes/)).toHaveValue(
    'Contexto que no debe perderse si falla el servidor.',
  )
  await expect(page.getByPlaceholder('Nombre completo')).toHaveValue('Solicitante de prueba')
  await expect(page.getByRole('button', { name: 'Guardar solicitud' })).toBeEnabled()
})
