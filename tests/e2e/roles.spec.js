import { expect, test } from '@playwright/test'

const CASOS = [
  {
    rol: 'ROL1',
    rutaProhibida: '/rol2/dashboard',
    rutaEsperada: '/rol1/dashboard',
  },
  {
    rol: 'ROL2',
    rutaProhibida: '/rol1/panel',
    rutaEsperada: '/rol2/dashboard',
  },
  {
    rol: 'COMISIONADO',
    rutaProhibida: '/rol2/dashboard',
    rutaEsperada: '/comisionado/calendario',
  },
  {
    rol: 'EQUIPO_PARTICULAR',
    rutaProhibida: '/rol1/panel',
    rutaEsperada: '/rol1/dashboard',
  },
]

async function prepararRol(page, rol) {
  await page.addInitScript(usuario => {
    sessionStorage.setItem('scs_user', JSON.stringify(usuario))
  }, {
    id: 1000 + CASOS.findIndex(caso => caso.rol === rol),
    email: `prueba.${rol.toLowerCase()}@anam.gob.mx`,
    nombre: `Prueba ${rol}`,
    rol,
  })

  await page.route(url => new URL(url).pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/token/refresh/') {
      return route.fulfill({ json: { access: `token-${rol}` } })
    }
    if (path === '/api/notificaciones/') return route.fulfill({ json: [] })
    if (path.startsWith('/api/catalogos/')) return route.fulfill({ json: [] })
    return route.fulfill({ json: { results: [], total: 0 } })
  })
}

for (const caso of CASOS) {
  test(`${caso.rol} vuelve directamente a su inicio al abrir una ruta no autorizada`, async ({ page }) => {
    await prepararRol(page, caso.rol)
    const visitasLogin = []
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame() && new URL(frame.url()).pathname === '/login') {
        visitasLogin.push(frame.url())
      }
    })

    await page.goto(caso.rutaProhibida)

    await expect(page).toHaveURL(new RegExp(`${caso.rutaEsperada}$`))
    expect(visitasLogin).toHaveLength(0)
  })
}

test('el equipo particular no ve ni abre la administración de usuarios', async ({ page }) => {
  await prepararRol(page, 'EQUIPO_PARTICULAR')
  await page.goto('/rol1/dashboard')

  await expect(page.getByRole('button', { name: 'Usuarios y accesos' })).toHaveCount(0)
  await page.goto('/rol1/panel')
  await expect(page).toHaveURL(/\/rol1\/dashboard$/)
})

test('sin sesión una ruta privada conduce al login', async ({ page }) => {
  await page.route('**/api/auth/token/refresh/', route =>
    route.fulfill({ status: 401, json: { detail: 'Sin sesión' } }),
  )

  await page.goto('/rol1/dashboard')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByPlaceholder('usuario@anam.gob.mx')).toBeVisible()
})
