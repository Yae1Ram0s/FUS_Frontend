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

// Varias peticiones pueden 401 casi al mismo tiempo (ej. los dashboards
// disparan 2 llamadas en paralelo) -- comparten un solo refresh en curso en
// vez de contar cada 401 simultáneo como un fallo separado.
let refreshEnCurso = null

export function refreshAccessToken() {
  if (!refreshEnCurso) {
    refreshEnCurso = axios.post(
      '/api/auth/token/refresh/',
      {},
      { withCredentials: true, headers: { 'ngrok-skip-browser-warning': 'true' } }
    )
      .then(({ data }) => {
        setAccessToken(data.access)
        return data.access
      })
      .catch(err => {
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
        const access = await refreshAccessToken()
        original.headers.Authorization = `Bearer ${access}`
        return api(original)
      } catch (refreshError) {
        const status = refreshError.response?.status
        if (status === 401 || status === 403) {
          setAccessToken(null)
          localStorage.removeItem('scs_user')
          localStorage.removeItem('scs_last_activity')
          if (window.location.pathname !== '/login') window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

export default api
