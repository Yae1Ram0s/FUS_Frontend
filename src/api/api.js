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

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const { data } = await axios.post(
          '/api/auth/token/refresh/',
          {},
          { withCredentials: true, headers: { 'ngrok-skip-browser-warning': 'true' } }
        )
        setAccessToken(data.access)
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch {
        setAccessToken(null)
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
