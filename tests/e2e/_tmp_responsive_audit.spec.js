import { expect, test } from '@playwright/test'

const ROL1 = { id: 990, email: 'auditoria.rol1@anam.gob.mx', nombre: 'Auditoría Rol1', rol: 'ROL1' }
const ROL2 = { id: 991, email: 'auditoria.rol2@anam.gob.mx', nombre: 'Auditoría Rol2', rol: 'ROL2' }

const ESTATUS_ROL1 = [
  { clave: 'Registrado', nombre: 'Registrado' },
  { clave: 'Turnado', nombre: 'Turnado' },
  { clave: 'Atendido', nombre: 'Atendido' },
  { clave: 'Concluido', nombre: 'Concluido' },
  { clave: 'Pendiente_validacion', nombre: 'Pendiente de validación' },
]
const ESTATUS_ROL2 = [
  { clave: 'Recibido', nombre: 'Recibido' },
  { clave: 'En_seguimiento', nombre: 'En seguimiento' },
  { clave: 'Concluido', nombre: 'Concluido' },
]

function fus(i, overrides = {}) {
  return {
    id: i,
    folio: `FUS/AUDIT/${String(i).padStart(4, '0')}`,
    descripcion: overrides.descripcion || 'Solicitud de información pública sobre el estado de mantenimiento de elevadores en la sede central.',
    contexto: '',
    fechaHora: '2026-07-28T12:00:00Z',
    fechaLimite: overrides.fechaLimite,
    idMedioRecepcion: { nombreMedio: 'Correo electrónico' },
    medioEspecificacion: '',
    prioridad: overrides.prioridad || 'Media',
    criterios: '',
    estatusParticular: overrides.estatusParticular || 'Registrado',
    estadoTemporalidad: overrides.estadoTemporalidad || null,
    slaVencido: overrides.slaVencido || false,
    slaPorVencer: overrides.slaPorVencer || false,
    idSolicitanteInterno: { id: 1, nombre: 'Persona Solicitante', email: 'solicitante@anam.gob.mx' },
    idComisionado: overrides.idComisionado || null,
    direccionComisionado: overrides.idComisionado ? 'Dirección General de Operación' : null,
    nombreExterno: overrides.nombreExterno || '',
    telefonoExterno: overrides.telefonoExterno || '',
    correoExterno: overrides.correoExterno || '',
    evidencias: overrides.evidencias || [],
    tieneTurnado: false,
    ...overrides,
  }
}

const FUS_LIST = [
  fus(1, { estatusParticular: 'Registrado', prioridad: 'Alta' }),
  fus(2, { estatusParticular: 'Turnado' }),
  fus(3, {
    estatusParticular: 'Turnado', estadoTemporalidad: 'Vencido', slaVencido: true,
    fechaLimite: '2026-07-20T12:00:00Z',
    descripcion: 'Solicitud muy larga para probar el recorte y el ajuste de texto en la tarjeta cuando la descripción ocupa varias líneas y se acerca al límite del contenedor visible en pantallas angostas.',
  }),
  fus(4, { estatusParticular: 'Atendido', idComisionado: { id: 5, nombre: 'Comisionado de Prueba', email: 'comisionado@anam.gob.mx' } }),
  fus(5, { estatusParticular: 'Concluido', prioridad: 'Baja' }),
  fus(6, { estatusParticular: 'Pendiente_validacion', nombreExterno: 'Juan Pérez', telefonoExterno: '5512345678', correoExterno: 'juan@example.com' }),
]

function turnado(i, fusOverrides = {}) {
  return {
    id: i,
    idFus: fus(100 + i, fusOverrides),
    idRemitente: { id: 1, nombre: 'Particular', email: 'particular@anam.gob.mx' },
    idDestinatario: { id: 2, nombre: 'Auditoría Rol2', email: ROL2.email },
    idMedio: { nombreMedio: 'Correo electrónico' },
    solicitudTexto: 'Favor de atender esta solicitud a la brevedad.',
    fechaHoraTurnado: '2026-07-28T13:00:00Z',
    estatusTitular: fusOverrides.estatusTitular || 'Recibido',
  }
}

const TURNADO_LIST = [
  { ...turnado(1), estatusTitular: 'Recibido' },
  { ...turnado(2), estatusTitular: 'En_seguimiento' },
  { ...turnado(3, { estadoTemporalidad: 'PorVencer', fechaLimite: '2026-07-29T00:00:00Z' }), estatusTitular: 'En_seguimiento' },
  { ...turnado(4), estatusTitular: 'Concluido' },
]

async function prepararSesion(page, usuario, extra = {}) {
  await page.addInitScript(u => {
    localStorage.setItem('scs_user', JSON.stringify(u))
    localStorage.setItem('scs_last_activity', String(Date.now()))
  }, usuario)

  await page.route(url => new URL(url).pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path === '/api/auth/token/refresh/') return route.fulfill({ json: { access: 'token-audit' } })
    if (path === '/api/notificaciones/') return route.fulfill({ json: [] })
    if (path === '/api/catalogos/estatus/') {
      const tipo = url.searchParams.get('tipoFlujo')
      return route.fulfill({ json: tipo === 'TITULAR' ? ESTATUS_ROL2 : ESTATUS_ROL1 })
    }
    if (path === '/api/catalogos/medios/') return route.fulfill({ json: [] })
    if (path === '/api/fus/' && extra.fus) return route.fulfill({ json: { results: extra.fus, total: extra.fus.length } })
    if (path === '/api/turnados/mis-turnados/' && extra.turnados) {
      return route.fulfill({ json: { results: extra.turnados, total: extra.turnados.length } })
    }
    return route.fulfill({ json: { results: [], total: 0 } })
  })
}

const VIEWPORTS = [
  { name: 'movil', width: 375, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

for (const vp of VIEWPORTS) {
  test(`consultar-fus lista ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await prepararSesion(page, ROL1, { fus: FUS_LIST })
    await page.goto('/rol1/consultar-fus?modo=lista')
    await expect(page.getByText(FUS_LIST[0].folio)).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `test-results/audit-consultarfus-lista-${vp.name}.png`, fullPage: true })
  })

  test(`consultar-fus detalle ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await prepararSesion(page, ROL1, { fus: FUS_LIST })
    await page.goto('/rol1/consultar-fus?modo=lista')
    await page.getByText(FUS_LIST[3].folio).click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `test-results/audit-consultarfus-detalle-${vp.name}.png`, fullPage: true })
  })

  test(`solicitudes-turnadas lista ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await prepararSesion(page, ROL2, { turnados: TURNADO_LIST })
    await page.goto('/rol2/solicitudes?modo=lista')
    await expect(page.getByText(TURNADO_LIST[0].idFus.folio)).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `test-results/audit-solturnadas-lista-${vp.name}.png`, fullPage: true })
  })

  test(`solicitudes-turnadas detalle ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await prepararSesion(page, ROL2, { turnados: TURNADO_LIST })
    await page.goto('/rol2/solicitudes?modo=lista')
    await page.getByText(TURNADO_LIST[1].idFus.folio).click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `test-results/audit-solturnadas-detalle-${vp.name}.png`, fullPage: true })
  })
}
