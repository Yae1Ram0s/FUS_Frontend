import { expect, test } from '@playwright/test'

const USUARIO = {
  id: 903,
  email: 'prueba.navegacion@anam.gob.mx',
  nombre: 'Prueba Navegación',
  rol: 'ROL1',
}

const FUS = {
  id: 501,
  folio: 'FUS/E2E/0501',
  descripcion: 'Solicitud conservada durante la actualización',
  fechaHora: '2026-07-28T12:00:00',
  estatusParticular: 'Registrado',
  idMedioRecepcion: { nombreMedio: 'Correo electrónico' },
}

async function prepararSesion(page, responderApi) {
  await page.addInitScript(usuario => {
    sessionStorage.setItem('scs_user', JSON.stringify(usuario))
  }, USUARIO)

  await page.route(url => new URL(url).pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/token/refresh/') {
      return route.fulfill({ json: { access: 'token-navegacion' } })
    }
    if (path === '/api/notificaciones/') return route.fulfill({ json: [] })
    if (path === '/api/catalogos/estatus/') return route.fulfill({ json: [] })
    if (path === '/api/catalogos/medios/') return route.fulfill({ json: [] })
    return responderApi(route)
  })
}

test('permite cambiar de sección y regresar sin congelar la pantalla', async ({ page }) => {
  await prepararSesion(page, route =>
    route.fulfill({ json: { results: [], total: 0 } }),
  )

  await page.goto('/rol1/dashboard')
  await expect(page.getByRole('heading', { name: 'Hola, Prueba Navegación' })).toBeVisible()

  const menu = page.getByRole('complementary')
  await menu.getByRole('button', { name: 'Consultar FUS' }).click()
  await expect(page).toHaveURL(/\/rol1\/consultar-fus/)
  await expect(page.getByPlaceholder(/Buscar por folio/)).toBeVisible()

  await menu.getByRole('button', { name: 'Registrar FUS' }).click()
  await expect(page.getByRole('heading', { name: 'Nueva solicitud FUS' })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(/\/rol1\/consultar-fus/)
  await expect(page.getByPlaceholder(/Buscar por folio/)).toBeVisible()

  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Hola, Prueba Navegación' })).toBeVisible()
})

test('conserva los datos anteriores cuando falla un cambio de búsqueda', async ({ page }) => {
  await prepararSesion(page, route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/fus/') {
      if (url.searchParams.get('search')) {
        return route.fulfill({ status: 503, json: { detail: 'Falla temporal' } })
      }
      return route.fulfill({ json: { results: [FUS], total: 1 } })
    }
    return route.fulfill({ json: { results: [], total: 0 } })
  })

  await page.goto('/rol1/consultar-fus?modo=lista')
  await expect(page.getByText(FUS.folio)).toBeVisible()

  await page.getByPlaceholder(/Buscar por folio/).fill('consulta temporal')

  await expect(page.getByText(FUS.folio)).toBeVisible()
  await expect(page.getByText(/mostrando la última información disponible/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible()
})
