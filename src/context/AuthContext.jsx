import { createContext, useContext, useState } from 'react'
import api from '../api/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const u = sessionStorage.getItem('scs_user')
      return u ? JSON.parse(u) : null
    } catch { return null }
  })

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login/', { email, password })
    const userData = data.user
    sessionStorage.setItem('scs_user', JSON.stringify(userData))
    sessionStorage.setItem('access_token', data.access)
    sessionStorage.setItem('refresh_token', data.refresh)
    setUser(userData)
    return userData
  }

  const logout = () => {
    sessionStorage.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
