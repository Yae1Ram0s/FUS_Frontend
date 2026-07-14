import axios from 'axios'

// Token de acceso en memoria (no persiste en storage). El refresh token vive
// en una cookie httpOnly que el navegador envía solo, nunca es visible a JS.
let accessToken = null
const listeners = new Set()

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token) {
  accessToken = token
  listeners.forEach(fn => fn(token))
}

export function onAccessTokenChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
  withCredentials: true,
})

api.interceptors.request.use(config => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

let refreshFallidosSeguidos = 0
// Varias peticiones pueden 401 casi al mismo tiempo (ej. los dashboards
// disparan 2 llamadas en paralelo) -- comparten un solo refresh en curso en
// vez de contar cada 401 simultáneo como un fallo separado.
let refreshEnCurso = null

function refrescarToken() {
  if (!refreshEnCurso) {
    refreshEnCurso = axios.post(
      '/api/auth/token/refresh/',
      {},
      { withCredentials: true, headers: { 'ngrok-skip-browser-warning': 'true' } }
    )
      .then(({ data }) => {
        refreshFallidosSeguidos = 0
        setAccessToken(data.access)
        return data.access
      })
      .catch(err => {
        refreshFallidosSeguidos += 1
        setAccessToken(null)
        // Una falla aislada de refresh no debe sacar al usuario de la app --
        // se deja que la pantalla que hizo la petición maneje el error con
        // su propio banner/"Reintentar". Solo tras 2 fallos consecutivos se
        // asume que la sesión realmente murió.
        if (refreshFallidosSeguidos >= 2) {
          window.location.href = '/login'
        }
        throw err
      })
      .finally(() => { refreshEnCurso = null })
  }
  return refreshEnCurso
}

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const access = await refrescarToken()
        original.headers.Authorization = `Bearer ${access}`
        return api(original)
      } catch {
        // El fallo ya quedó contabilizado/manejado dentro de refrescarToken().
      }
    }
    return Promise.reject(err)
  }
)

export default api
