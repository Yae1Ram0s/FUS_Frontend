import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import api from '../api/api'

const NotificacionesContext = createContext(null)

export function NotificacionesProvider({ children }) {
  const { user } = useAuth()
  const [notifs, setNotifs] = useState([])

  const cargar = useCallback(() => {
    if (!user) return
    api.get('/notificaciones/')
      .then(r => setNotifs(Array.isArray(r.data) ? r.data : r.data.results ?? []))
      .catch(() => {})
  }, [user])

  /* Polling cada 30 segundos */
  useEffect(() => {
    cargar()
    const id = setInterval(cargar, 30_000)
    return () => clearInterval(id)
  }, [cargar])

  const marcarLeida = (id) => {
    api.patch(`/notificaciones/${id}/leer/`).catch(() => {})
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, leida: true } : n))
  }

  const marcarTodas = () => {
    api.post('/notificaciones/leer-todas/').catch(() => {})
    setNotifs(ns => ns.map(n => ({ ...n, leida: true })))
  }

  const noLeidas = notifs.filter(n => !n.leida).length

  return (
    <NotificacionesContext.Provider value={{ notifs, noLeidas, cargar, marcarLeida, marcarTodas }}>
      {children}
    </NotificacionesContext.Provider>
  )
}

export const useNotificaciones = () => useContext(NotificacionesContext)
