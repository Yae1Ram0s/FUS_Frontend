import { expect, test } from '@playwright/test'

const USUARIO = {
  id: 91,
  email: 'reportes@anam.gob.mx',
  nombre: 'Usuario Reportes',
  unidadAdministrativa: 'Unidad de Administración y Finanzas',
  rol: 'ROL1',
}
const OPCIONES = {
  secciones: [
    { id: 'resumen', nombre: 'Resumen ejecutivo' },
    { id: 'evolucion', nombre: 'Evolución mensual de FUS' },
    { id: 'estados', nombre: 'FUS por estado' },
    { id: 'carga', nombre: 'Carga de trabajo por responsable' },
    { id: 'unidades', nombre: 'FUS por unidad administrativa' },
    { id: 'productividad', nombre: 'Análisis de productividad' },
    { id: 'tiempos', nombre: 'Distribución de tiempos de respuesta' },
    { id: 'detalle', nombre: 'Detalle de solicitudes' },
  ],
  unidades: [{ id: 1, nombre: 'Unidad Jurídica' }],
  responsables: [{ id: 2, nombre: 'Responsable Uno' }],
}
const REPORTE = {
  periodo: { inicio: '2026-01-01', fin: '2026-07-30' },
  resumen: { total: 7, concluidos: 2, pendientes: 5, vencidos: 1, tiempo_promedio_respuesta: 1.8, tiempo_promedio_conclusion: 3.5, cumplimiento_sla: 50, tasa_conclusion: 28.6 },
  comparacion: { etiqueta: 'periodo anterior', anterior: {}, deltas: {} },
  evolucion: [{ periodo: '2026-07', registrados: 7, concluidos: 2, vencidos: 1 }],
  estados: [{ nombre: 'Registrado', cantidad: 5, porcentaje: 71.4 }, { nombre: 'Concluido', cantidad: 2, porcentaje: 28.6 }],
  carga: [{ responsable: 'Responsable Uno', asignados: 7, pendientes: 5, vencidos: 1, concluidos: 2, capacidad: 25 }],
  unidades: [{ unidad: 'Unidad Jurídica', cantidad: 7, porcentaje: 100 }],
  productividad: { tasa_conclusion: 28.6, fus_por_dia: 0.1, eficiencia_sla: 50 },
  tiempos: [{ rango: '≤ 1 día', cantidad: 1 }, { rango: '1 - 3 días', cantidad: 1 }, { rango: '3 - 7 días', cantidad: 0 }, { rango: '> 7 días', cantidad: 0 }],
  detalle: [{ folio: 'FUS/REPORTES/001', fecha_registro: '30/07/2026', estado: 'Registrado', prioridad: 'Alta', unidad: 'Unidad Jurídica', responsable: 'Responsable Uno', fecha_limite: '31/07/2026' }],
}

async function preparar(page) {
  await page.addInitScript(usuario => sessionStorage.setItem('scs_user', JSON.stringify(usuario)), USUARIO)
  await page.route(url => new URL(url).pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/token/refresh/') return route.fulfill({ json: { access: 'token-reportes' } })
    if (path === '/api/notificaciones/') return route.fulfill({ json: [] })
    if (path === '/api/reportes/opciones/') return route.fulfill({ json: OPCIONES })
    if (path === '/api/reportes/resumen/') return route.fulfill({ json: REPORTE })
    if (path.startsWith('/api/reportes/exportar/')) {
      return route.fulfill({ body: 'archivo-prueba', contentType: 'application/octet-stream' })
    }
    return route.fulfill({ json: [] })
  })
}

test('muestra indicadores, análisis y aplica filtros', async ({ page }) => {
  await preparar(page)
  await page.goto('/rol1/reportes')
  await expect(page.getByRole('heading', { name: 'Reportes e inteligencia operativa' })).toBeVisible()
  await expect(
    page.locator('.kpi2-card').filter({ hasText: 'Total de FUS' }).getByText('7', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Evolución mensual de FUS', { exact: true })).toBeVisible()
  await expect(page.getByText('Detalle de FUS por estado y tiempos', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Filtros avanzados' }).click()
  await page.getByLabel('Prioridad').selectOption('Alta')
  await expect(page.getByLabel('Prioridad')).toHaveValue('Alta')
})

test('permite elegir contenido y descargar los tres formatos', async ({ page }) => {
  await preparar(page)
  await page.goto('/rol1/reportes')
  await page.getByRole('button', { name: 'Filtros avanzados' }).click()
  await page.getByText('Secciones del reporte (8)').click()
  await page.getByLabel('Detalle de solicitudes').uncheck()
  await expect(page.getByText('Secciones del reporte (7)')).toBeVisible()
  for (const nombre of ['PDF', 'EXCEL', 'Presentación']) {
    const descarga = page.waitForEvent('download')
    await page.getByRole('button', { name: nombre }).click()
    await descarga
  }
})

test('mantiene utilizable la vista en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await preparar(page)
  await page.goto('/rol1/reportes')
  await expect(page.getByRole('heading', { name: 'Reportes e inteligencia operativa' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Filtros avanzados' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Presentación' })).toBeVisible()
})

test('abre el perfil del sidebar y muestra los datos de la sesión', async ({ page }) => {
  await preparar(page)
  await page.goto('/rol1/reportes')
  await page.getByRole('button', { name: 'Ver mi perfil' }).click()

  const modal = page.getByRole('dialog', { name: 'Información del usuario' })
  await expect(modal).toBeVisible()
  await expect(modal.getByText('Usuario Reportes', { exact: true })).toBeVisible()
  await expect(modal.getByText('Unidad de Administración y Finanzas', { exact: true })).toBeVisible()
  await expect(modal.getByText('reportes@anam.gob.mx', { exact: true })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(modal).toBeHidden()
})
