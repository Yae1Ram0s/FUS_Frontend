const OPCIONES_FECHA = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}

const OPCIONES_HORA = {
  hour: '2-digit',
  minute: '2-digit',
}

export function formatearFechaHora(valor, fallback = '—') {
  if (!valor) return fallback
  return new Date(valor).toLocaleString('es-MX', {
    ...OPCIONES_FECHA,
    ...OPCIONES_HORA,
  })
}

export function formatearFecha(valor, fallback = '—') {
  if (!valor) return fallback
  return new Date(valor).toLocaleDateString('es-MX', OPCIONES_FECHA)
}

export function formatearFechaISO(valor, fallback = '—') {
  if (!valor) return fallback
  return formatearFecha(`${valor}T00:00:00`, fallback)
}

export function formatearHora(valor, fallback = '') {
  if (!valor) return fallback
  return new Date(valor).toLocaleTimeString('es-MX', OPCIONES_HORA)
}
