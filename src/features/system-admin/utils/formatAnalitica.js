const formatoNumero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 })

export function formatearNumero(valor) {
  return formatoNumero.format(Number(valor) || 0)
}

export function formatearFecha(iso) {
  if (!iso) return 'Sin actividad'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return 'Sin actividad'
  return fecha.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function formatearDuracion(ms) {
  const valor = Number(ms) || 0
  if (valor <= 0) return '—'
  if (valor < 1000) return `${Math.round(valor)} ms`
  const segundos = valor / 1000
  if (segundos < 60) return `${formatoNumero.format(segundos)} s`
  const minutos = Math.floor(segundos / 60)
  const resto = Math.round(segundos % 60)
  return resto ? `${minutos} min ${resto} s` : `${minutos} min`
}
