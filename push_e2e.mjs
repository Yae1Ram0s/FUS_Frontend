import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:5175'
const EMAIL = 'anabel.munoz@anam.gob.mx'
const TEMP_PASS = 'Anam2026!'
const NEW_PASS = 'Anam2026!anabel2'

const browser = await chromium.launch()
const context = await browser.newContext({ permissions: ['notifications'] })
const page = await context.newPage()

const pushCalls = []
page.on('response', r => {
  if (r.url().includes('/api/push/')) pushCalls.push(`${r.status()} ${r.url()}`)
  if (r.url().includes('/api/auth/')) console.log('[auth]', r.status(), r.url())
})

await page.goto(`${BASE}/login`)
await page.waitForSelector('#login-email')
await page.fill('#login-email', EMAIL.split('@')[0])
await page.click('button.btn-entrar')
await page.waitForSelector('#login-pass', { timeout: 10000 })
await page.fill('#login-pass', TEMP_PASS)
await page.click('button.btn-entrar')

const npField = await page.waitForSelector('#login-np', { timeout: 8000 }).catch(() => null)
if (npField) {
  const tempField = await page.$('#login-temp-pass')
  if (tempField) await tempField.fill(TEMP_PASS)
  await page.fill('#login-np', NEW_PASS)
  await page.fill('#login-cp', NEW_PASS)
  await page.click('button.btn-entrar')
}

await page.waitForURL(/\/rol1\//, { timeout: 15000 })
await page.waitForTimeout(1000) // deja que el Service Worker termine de registrarse

// Abre la campanita y revisa si el botón de activar notificaciones existe
// (antes, en http://localhost, browserNoSoportado lo ocultaba siempre).
await page.click('.notif-bell-btn')
const toggleBtn = await page.waitForSelector('.notif-browser-toggle', { timeout: 5000 }).catch(() => null)
console.log('Boton de notificaciones del navegador visible:', !!toggleBtn)

if (toggleBtn) {
  const textoAntes = await toggleBtn.textContent()
  console.log('Texto antes de activar:', textoAntes.trim())
  await toggleBtn.click()
  await page.waitForTimeout(1500)
  const textoDespues = await toggleBtn.textContent()
  console.log('Texto despues de activar:', textoDespues.trim())
}

console.log('Llamadas a /api/push/:', pushCalls)

await browser.close()
