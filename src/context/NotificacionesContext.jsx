import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './AuthContext'
import api from '../api/api'

const NotificacionesContext = createContext(null)

const esHttps = () => window.location.protocol === 'https:'

export function NotificacionesProvider({ children }) {
  const { user, accessToken } = useAuth()
  const [notifs,        setNotifs]        = useState([])
  const [browserNotif,  setBrowserNotif]  = useState(() => localStorage.getItem('scs_browser_notif'))
  const [showPrompt,    setShowPrompt]    = useState(false)
  const [turnadoKey,    setTurnadoKey]    = useState(0)   // sube cuando llega TURNADO nuevo (para ROL2)
  const wsRef           = useRef(null)
  const pollingId       = useRef(null)
  const browserNotifRef = useRef(browserNotif)
  const userRef         = useRef(user)

  useEffect(() => { browserNotifRef.current = browserNotif }, [browserNotif])
  useEffect(() => { userRef.current = user }, [user])

  /* Mostrar prompt una vez por sesión si las notificaciones no están activas (solo HTTPS) */
  useEffect(() => {
    if (!user) {
      setShowPrompt(false)
      return
    }
    if (!esHttps()) return   // solo disponible en producción (HTTPS)
    const pref        = localStorage.getItem('scs_browser_notif')
    const bloqueado   = typeof Notification !== 'undefined' && Notification.permission === 'denied'
    const yaPromovido = sessionStorage.getItem('scs_notif_prompted')
    if (pref !== 'on' && !bloqueado && !yaPromovido) {
      sessionStorage.setItem('scs_notif_prompted', '1')
      setShowPrompt(true)
    }
  }, [user])

  const cargar = useCallback(() => {
    if (!user) return
    api.get('/notificaciones/')
      .then(r => setNotifs(Array.isArray(r.data) ? r.data : r.data.results ?? []))
      .catch(() => {})
  }, [user])

  /* Dispara notificación del navegador con clic que navega a la ruta correcta del rol */
  const _disparar = (notif) => {
    if (!esHttps()) return
    if (browserNotifRef.current !== 'on') return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    try {
      const folio = notif.fusFolio || ''
      const rol   = userRef.current?.rol
      const dest  = rol === 'ROL2'
        ? `/rol2/solicitudes${folio ? `?folio=${encodeURIComponent(folio)}` : ''}`
        : rol === 'COMISIONADO'
        ? '/comisionado/fus-comisionados'
        : `/rol1/consultar-fus${folio ? `?folio=${encodeURIComponent(folio)}` : ''}`

      const n = new Notification('SCS — Nueva notificación', {
        body: notif.mensaje || '',
        icon: '/Logo SCS 2026_2.png',
        tag:  String(notif.id),
      })
      n.onclick = () => {
        window.focus()
        window.location.href = dest
      }
    } catch {}
  }

  /* WebSocket + fallback polling */
  useEffect(() => {
    if (!user) return

    cargar()

    if (!accessToken) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsUrl = `${proto}://${window.location.host}/ws/notificaciones/?token=${accessToken}`

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          if (pollingId.current) { clearInterval(pollingId.current); pollingId.current = null }
        }

        ws.onmessage = (e) => {
          try {
            const notif = JSON.parse(e.data)
            setNotifs(prev => {
              if (prev.some(n => n.id === notif.id)) return prev
              _disparar(notif)
              /* Señal para que ROL2 refresque su lista cuando llega un nuevo turnado */
              if (notif.tipo === 'TURNADO') setTurnadoKey(k => k + 1)
              return [notif, ...prev]
            })
          } catch {}
        }

        ws.onerror = () => {
          if (!pollingId.current) pollingId.current = setInterval(cargar, 30_000)
        }

        ws.onclose = (e) => {
          wsRef.current = null
          if (e.code !== 4001 && user) {
            if (!pollingId.current) pollingId.current = setInterval(cargar, 30_000)
            setTimeout(connect, 5_000)
          }
        }
      } catch {
        if (!pollingId.current) pollingId.current = setInterval(cargar, 30_000)
      }
    }

    connect()

    return () => {
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
      if (pollingId.current) clearInterval(pollingId.current)
    }
  }, [user, cargar, accessToken])

  /* Activar notificaciones del navegador */
  const activarBrowserNotif = async () => {
    setShowPrompt(false)
    if (!esHttps() || typeof Notification === 'undefined') return
    if (Notification.permission === 'denied') {
      alert('Las notificaciones están bloqueadas en este navegador.\nVe a Configuración del sitio y actívalas manualmente.')
      localStorage.setItem('scs_browser_notif', 'off')
      setBrowserNotif('off')
      return
    }
    const result = await Notification.requestPermission()
    const pref = result === 'granted' ? 'on' : 'off'
    localStorage.setItem('scs_browser_notif', pref)
    setBrowserNotif(pref)
  }

  /* Desactivar notificaciones del navegador */
  const desactivarBrowserNotif = () => {
    localStorage.setItem('scs_browser_notif', 'off')
    setBrowserNotif('off')
  }

  /* Descartar el prompt sin decidir — preguntará de nuevo en el próximo login */
  const dismissPrompt = () => setShowPrompt(false)

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
    <NotificacionesContext.Provider value={{
      notifs, noLeidas, cargar, marcarLeida, marcarTodas,
      browserNotif, showPrompt, turnadoKey,
      activarBrowserNotif, desactivarBrowserNotif, dismissPrompt,
    }}>
      {children}
    </NotificacionesContext.Provider>
  )
}

export const useNotificaciones = () => useContext(NotificacionesContext)
