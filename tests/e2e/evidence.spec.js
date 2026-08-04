import { expect, test } from '@playwright/test'
import { Buffer } from 'node:buffer'

const USUARIO = {
  id: 908,
  email: 'prueba.evidencias@anam.gob.mx',
  nombre: 'Prueba Evidencias',
  rol: 'ROL1',
}

async function prepararFormulario(page) {
  await page.addInitScript(usuario => {
    sessionStorage.setItem('scs_user', JSON.stringify(usuario))
  }, USUARIO)

  await page.route(url => new URL(url).pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/token/refresh/') {
      return route.fulfill({ json: { access: 'token-evidencias' } })
    }
    if (path === '/api/notificaciones/') return route.fulfill({ json: [] })
    if (path === '/api/catalogos/medios/') return route.fulfill({ json: [] })
    return route.fulfill({ json: { results: [], total: 0 } })
  })
}

test('rechaza formatos no permitidos antes de enviar el formulario', async ({ page }) => {
  await prepararFormulario(page)
  await page.goto('/rol1/registrar-fus')

  await page.locator('input[type="file"]').setInputFiles({
    name: 'programa.exe',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('archivo no permitido'),
  })

  await expect(page.getByRole('alert')).toContainText('no tiene un formato permitido')
  await expect(page.locator('.ev-preview-row')).toHaveCount(0)
})

test('impide agregar dos veces el mismo archivo', async ({ page }) => {
  await prepararFormulario(page)
  await page.goto('/rol1/registrar-fus')
  const archivo = {
    name: 'evidencia.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 evidencia de prueba'),
  }

  await page.locator('input[type="file"]').setInputFiles(archivo)
  await expect(page.locator('.ev-preview-row')).toHaveCount(1)
  await page.locator('input[type="file"]').setInputFiles(archivo)

  await expect(page.getByRole('alert')).toContainText('ya fue agregado')
  await expect(page.locator('.ev-preview-row')).toHaveCount(1)
})

test('rechaza archivos que superan 10 MB sin crear vista previa', async ({ page }) => {
  await prepararFormulario(page)
  await page.goto('/rol1/registrar-fus')

  await page.locator('input[type="file"]').setInputFiles({
    name: 'evidencia-grande.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  })

  await expect(page.getByRole('alert')).toContainText('supera el límite de 10 MB')
  await expect(page.locator('.ev-preview-row')).toHaveCount(0)
})
