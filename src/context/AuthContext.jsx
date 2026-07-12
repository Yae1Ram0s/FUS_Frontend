import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import api, { setAccessToken, getAccessToken, onAccessTokenChange } from '../api/api'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(() => {
    try {
      const u = sessionStorage.getItem('scs_user')
      return u ? JSON.parse(u) : null
    } catch { return null }
  })
  const [accessToken, setAccessTokenState] = useState(() => getAccessToken())
  const [cargando, setCargando] = useState(true)

  useEffect(() => onAccessTokenChange(setAccessTokenState), [])

  useEffect(() => {
    // El access token vive solo en memoria y se pierde al recargar la página.
    // El refresh token (cookie httpOnly) sigue vivo, así que lo usamos aquí
    // para restaurar la sesión sin pedir credenciales de nuevo.
    axios.post('/api/auth/token/refresh/', {}, { withCredentials: true })
      .then(({ data }) => setAccessToken(data.access))
      .catch(() => {
        sessionStorage.removeItem('scs_user')
        setUser(null)
        navigate('/login', { replace: true })
      })
      .finally(() => setCargando(false))
  }, [navigate])

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login/', { email, password })
    const userData = data.user
    sessionStorage.setItem('scs_user', JSON.stringify(userData))
    setAccessToken(data.access)
    setUser(userData)
    return userData
  }

  const loginWithTokens = (data) => {
    sessionStorage.setItem('scs_user', JSON.stringify(data.user))
    setAccessToken(data.access)
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    api.post('/auth/logout/').catch(() => {})
    sessionStorage.clear()
    setAccessToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, loginWithTokens, logout, accessToken, cargando }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
