import { expect, test } from '@playwright/test'

const USUARIO = {
  id: 905,
  email: 'prueba.paginacion@anam.gob.mx',
  nombre: 'Prueba Paginación',
  rol: 'ROL1',
}

function crearFus(id) {
  return {
    id,
    folio: `FUS/PAG/${String(id).padStart(4, '0')}`,
    descripcion: `Solicitud de paginación ${id}`,
    fechaHora: `2026-07-28T12:0${id}:00`,
    estatusParticular: 'Registrado',
    idMedioRecepcion: { nombreMedio: 'Correo electrónico' },
  }
}

async function prepararPaginacion(page, responderFus) {
  await page.addInitScript(usuario => {
    sessionStorage.setItem('scs_user', JSON.stringify(usuario))
  }, USUARIO)

  await page.route(url => new URL(url).pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/token/refresh/') {
      return route.fulfill({ json: { access: 'token-paginacion' } })
    }
    if (url.pathname === '/api/notificaciones/') return route.fulfill({ json: [] })
    if (url.pathname.startsWith('/api/catalogos/')) return route.fulfill({ json: [] })
    if (url.pathname === '/api/fus/') {
      return responderFus(route, Number(url.searchParams.get('page') || 1))
    }
    return route.fulfill({ json: { results: [], total: 0 } })
  })
}

test('cargar más conserva el orden y elimina registros repetidos', async ({ page }) => {
  const fus1 = crearFus(1)
  const fus2 = crearFus(2)
  const fus3 = crearFus(3)

  await prepararPaginacion(page, (route, pagina) => route.fulfill({
    json: pagina === 1
      ? { results: [fus1, fus2], total: 3 }
      : { results: [fus2, fus3], total: 3 },
  }))

  await page.goto('/rol1/consultar-fus?modo=lista')
  await expect(page.getByRole('button', { name: /Cargar más \(2 de 3\)/ })).toBeVisible()
  await page.getByRole('button', { name: /Cargar más/ }).click()

  const folios = page.locator('.fus-folio')
  await expect(folios).toHaveText([fus1.folio, fus2.folio, fus3.folio])
  await expect(page.getByText(fus2.folio)).toHaveCount(1)
  await expect(page.getByRole('button', { name: /Cargar más/ })).toHaveCount(0)
})

test('si falla cargar más mantiene la página anterior y permite reintentar', async ({ page }) => {
  const fus1 = crearFus(11)
  const fus2 = crearFus(12)

  await prepararPaginacion(page, (route, pagina) => {
    if (pagina === 1) {
      return route.fulfill({ json: { results: [fus1, fus2], total: 4 } })
    }
    return route.fulfill({ status: 503, json: { detail: 'Falla temporal' } })
  })

  await page.goto('/rol1/consultar-fus?modo=lista')
  await page.getByRole('button', { name: /Cargar más \(2 de 4\)/ }).click()

  await expect(page.getByText(fus1.folio)).toBeVisible()
  await expect(page.getByText(fus2.folio)).toBeVisible()
  await expect(page.getByText(/mostrando la última información disponible/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Cargar más \(2 de 4\)/ })).toBeEnabled()
})
