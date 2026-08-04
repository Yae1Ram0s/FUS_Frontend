import api from '../api/api'

/* `url` es relativa a la baseURL de `api` (sin el prefijo /api) — usa la
   misma instancia de axios que el resto de la app para que un access token
   vencido se refresque solo (interceptor de api.js) en vez de fallar. */
export function descargar(url, nombre) {
  return api.get(url, { responseType: 'blob' })
    .then(({ data: blob }) => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = nombre
      a.click()
      URL.revokeObjectURL(a.href)
    })
    .catch(error => alert(`No se pudo descargar el archivo. ${error.message}`))
}
