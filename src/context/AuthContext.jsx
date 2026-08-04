import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api, {
  setAccessToken,
  getAccessToken,
  onAccessTokenChange,
  refreshAccessToken,
} from '../api/api'
import Spinner from '../components/Spinner'

// eslint-disable-next-line react-refresh/only-export-components -- Context + Provider + hook en un solo archivo es el patrón usado en todo el proyecto; separarlo tocaría los imports de ~18 archivos por un problema que solo afecta a fast refresh en dev
export const AuthContext = createContext(null)

// `scs_user` va en localStorage (no sessionStorage) a propósito: sessionStorage
// se borra al cerrar la pestaña o la app (PWA en celular), y eso obligaba a
// volver a loguearse cada vez aunque el refresh token (cookie httpOnly, 1 día)
// siguiera vigente. Con localStorage la sesión sobrevive a cerrar/reabrir; el
// cierre automático real lo da el temporizador de inactividad de abajo.
const LAST_ACTIVITY_KEY = 'scs_last_activity'
const IDLE_LIMIT_MS = 60 * 60 * 1000 // 1 hora sin actividad → cierre automático

const marcarActividad = () => {
  try { localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())) } catch { /* storage no disponible */ }
}

const msInactivo = () => {
  try {
    const guardado = localStorage.getItem(LAST_ACTIVITY_KEY)
    return guardado ? Date.now() - Number(guardado) : 0
  } catch { return 0 }
}

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(() => {
    try {
      const u = localStorage.getItem('scs_user')
      return u ? JSON.parse(u) : null
    } catch { return null }
  })
  const [accessToken, setAccessTokenState] = useState(() => getAccessToken())
  const [cargando, setCargando] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])

  useEffect(() => onAccessTokenChange(setAccessTokenState), [])

  const limpiarSesionLocal = () => {
    localStorage.removeItem('scs_user')
    localStorage.removeItem(LAST_ACTIVITY_KEY)
    sessionStorage.clear()
    setAccessToken(null)
    setUser(null)
  }

  useEffect(() => {
    // El access token vive solo en memoria y se pierde al recargar la página.
    // El refresh token (cookie httpOnly) sigue vivo, así que lo usamos aquí
    // para restaurar la sesión sin pedir credenciales de nuevo.
    let cancelado = false
    const esperar = ms => new Promise(resolve => setTimeout(resolve, ms))

    // Si ya pasó 1 hora sin actividad desde la última vez que se usó la app,
    // la sesión se da por vencida sin intentar refrescar el token: así el
    // cierre por inactividad aplica también al reabrir la app/pestaña, no
    // solo mientras se queda abierta en segundo plano.
    if (userRef.current && msInactivo() > IDLE_LIMIT_MS) {
      api.post('/auth/logout/').catch(() => {})
      limpiarSesionLocal()
      setCargando(false)
      navigate('/login', { replace: true })
      return
    }

    // 401/403 = refresh token realmente inválido/vencido: cerrar sesión ya.
    // Cualquier otro fallo (red caída, 5xx) puede ser pasajero — se reintenta
    // una vez antes de rendirse. Sin este reintento, un usuario con la sesión
    // aún válida se quedaba con `user` puesto pero sin access token y sin
    // ruta de vuelta a /login (sesión "fantasma").
    const restaurarSesion = async (reintentosRestantes = 1) => {
      try {
        await refreshAccessToken()
        marcarActividad()
      } catch (err) {
        if (cancelado) return
        const status = err.response?.status
        if (status !== 401 && status !== 403 && reintentosRestantes > 0) {
          await esperar(1500)
          if (!cancelado) await restaurarSesion(reintentosRestantes - 1)
          return
        }
        limpiarSesionLocal()
        navigate('/login', { replace: true })
      }
      if (!cancelado) setCargando(false)
    }

    restaurarSesion()
    return () => { cancelado = true }
  }, [navigate])

  // Mientras haya sesión, cualquier interacción refresca la marca de
  // actividad; un intervalo revisa si ya se pasó de la hora sin actividad
  // para cerrar sesión aunque la pestaña se haya quedado abierta.
  useEffect(() => {
    if (!user) return

    marcarActividad()
    const EVENTOS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'wheel']
    let ultimoRegistro = 0
    const registrarActividad = () => {
      const ahora = Date.now()
      if (ahora - ultimoRegistro < 30_000) return // no escribir en cada pixel de scroll
      ultimoRegistro = ahora
      marcarActividad()
    }
    EVENTOS.forEach(ev => window.addEventListener(ev, registrarActividad, { passive: true }))

    const intervalo = setInterval(() => {
      if (msInactivo() > IDLE_LIMIT_MS) {
        api.post('/auth/logout/').catch(() => {})
        limpiarSesionLocal()
        navigate('/login', { replace: true })
      }
    }, 60_000)

    return () => {
      EVENTOS.forEach(ev => window.removeEventListener(ev, registrarActividad))
      clearInterval(intervalo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe re-suscribirse cuando cambia si hay sesión o no, no en cada render
  }, [!!user])

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login/', { email, password })
    const userData = data.user
    localStorage.setItem('scs_user', JSON.stringify(userData))
    marcarActividad()
    setAccessToken(data.access)
    setUser(userData)
    return userData
  }

  const loginWithTokens = (data) => {
    localStorage.setItem('scs_user', JSON.stringify(data.user))
    marcarActividad()
    setAccessToken(data.access)
    setUser(data.user)
    return data.user
  }

  // `loggingOut` vive aquí (no en Header) y el Spinner se pinta junto a
  // {children} — no dentro de una página — porque en cuanto `setUser(null)`
  // se aplica, PrivateRoute redirige a /login y desmonta esa página al
  // instante; un loader local en el Header desaparecería con ella antes de
  // alcanzar a verse. Nunca rechaza (.catch swallow), así que cerrar sesión
  // sigue funcionando aunque la red esté caída.
  const logout = async () => {
    setLoggingOut(true)
    await api.post('/auth/logout/').catch(() => {})
    limpiarSesionLocal()
    setLoggingOut(false)
  }

  return (
    <AuthContext.Provider value={{ user, login, loginWithTokens, logout, accessToken, cargando }}>
      {loggingOut && <Spinner label="Cerrando sesión…" />}
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- ver justificación arriba
export const useAuth = () => useContext(AuthContext)
