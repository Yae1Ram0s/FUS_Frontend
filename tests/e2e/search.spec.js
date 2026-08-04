import { expect, test } from '@playwright/test'

const USUARIO = {
  id: 904,
  email: 'prueba.busqueda@anam.gob.mx',
  nombre: 'Prueba Búsqueda',
  rol: 'ROL1',
}

function crearFus(id, folio, descripcion) {
  return {
    id,
    folio,
    descripcion,
    fechaHora: '2026-07-28T12:00:00',
    estatusParticular: 'Registrado',
    idMedioRecepcion: { nombreMedio: 'Correo electrónico' },
  }
}

async function prepararBusqueda(page, responderFus) {
  await page.addInitScript(usuario => {
    sessionStorage.setItem('scs_user', JSON.stringify(usuario))
  }, USUARIO)

  await page.route(url => new URL(url).pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/token/refresh/') {
      return route.fulfill({ json: { access: 'token-busqueda' } })
    }
    if (url.pathname === '/api/notificaciones/') return route.fulfill({ json: [] })
    if (url.pathname.startsWith('/api/catalogos/')) return route.fulfill({ json: [] })
    if (url.pathname === '/api/fus/') return responderFus(route, url.searchParams.get('search') || '')
    return route.fulfill({ json: { results: [], total: 0 } })
  })
}

test('escribir rápidamente produce una sola búsqueda con el texto final', async ({ page }) => {
  const consultas = []
  await prepararBusqueda(page, (route, search) => {
    if (search) consultas.push(search)
    return route.fulfill({ json: { results: [], total: 0 } })
  })

  await page.goto('/rol1/consultar-fus?modo=lista')
  const input = page.getByPlaceholder(/Buscar por folio/)
  await expect(page.getByText('Sin solicitudes')).toBeVisible()
  await input.evaluate(element => {
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set
    for (const value of ['sol', 'solicitud', 'solicitud final']) {
      setValue.call(element, value)
      element.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })

  await expect.poll(() => consultas).toEqual(['solicitud final'])
})

test('una respuesta antigua lenta no reemplaza la búsqueda más reciente', async ({ page }) => {
  const antiguo = crearFus(601, 'FUS/ANTIGUO/0601', 'Resultado antiguo')
  const reciente = crearFus(602, 'FUS/RECIENTE/0602', 'Resultado reciente')
  const consultas = []

  await prepararBusqueda(page, async (route, search) => {
    if (!search) return route.fulfill({ json: { results: [], total: 0 } })
    consultas.push(search)
    if (search === 'antiguo') {
      await new Promise(resolve => setTimeout(resolve, 900))
      return route.fulfill({ json: { results: [antiguo], total: 1 } })
    }
    return route.fulfill({ json: { results: [reciente], total: 1 } })
  })

  await page.goto('/rol1/consultar-fus?modo=lista')
  const input = page.getByPlaceholder(/Buscar por folio/)
  await input.fill('antiguo')
  await expect.poll(() => consultas).toContain('antiguo')

  await input.fill('reciente')

  await expect(page.getByText(reciente.folio)).toBeVisible()
  await expect(page.getByText(antiguo.folio)).toHaveCount(0)
})
