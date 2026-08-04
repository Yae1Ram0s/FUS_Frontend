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
  const reconnectId     = useRef(null)
  const reconnectIntentos = useRef(0)
  const cargarController = useRef(null)
  const cargarRequestId = useRef(0)
  const browserNotifRef = useRef(browserNotif)
  const userRef         = useRef(user)

  useEffect(() => { browserNotifRef.current = browserNotif }, [browserNotif])
  useEffect(() => { userRef.current = user }, [user])

  /* Mostrar prompt una vez por sesión si las notificaciones no están activas (solo HTTPS) */
  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- oculta el prompt al cerrar sesión, antes de evaluar si hay que mostrarlo de nuevo
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
    cargarController.current?.abort()
    const controller = new AbortController()
    const requestId = ++cargarRequestId.current
    cargarController.current = controller
    api.get('/notificaciones/', { signal: controller.signal })
      .then(r => {
        if (requestId !== cargarRequestId.current || controller.signal.aborted) return
        const recibidas = Array.isArray(r.data) ? r.data : r.data.results ?? []
        setNotifs(prev => {
          const porId = new Map()
          for (const notif of [...recibidas, ...prev]) {
            if (!porId.has(notif.id)) porId.set(notif.id, notif)
          }
          return [...porId.values()]
        })
      })
      .catch(() => {})
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- evita mostrar notificaciones del usuario anterior al cambiar/cerrar sesión
    setNotifs([])
    cargarRequestId.current += 1
    cargarController.current?.abort()
  }, [user?.id])

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
    } catch { /* permiso revocado a mitad de vuelo, sin notificación no pasa nada */ }
  }

  /* WebSocket + fallback polling */
  useEffect(() => {
    if (!user) return

    cargar()

    if (!accessToken) return
    let disposed = false
    let socket = null

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsBase = (import.meta.env.VITE_WS_URL || '').replace(/\/$/, '')
    const wsUrl = wsBase
      ? `${wsBase}/ws/notificaciones/?token=${accessToken}`
      : `${proto}://${window.location.host}/ws/notificaciones/?token=${accessToken}`

    const connect = () => {
      if (disposed) return
      try {
        const ws = new WebSocket(wsUrl)
        socket = ws
        wsRef.current = ws

        ws.onopen = () => {
          if (disposed) return
          reconnectIntentos.current = 0
          if (pollingId.current) { clearInterval(pollingId.current); pollingId.current = null }
        }

        ws.onmessage = (e) => {
          if (disposed) return
          try {
            const notif = JSON.parse(e.data)
            setNotifs(prev => {
              if (prev.some(n => n.id === notif.id)) return prev
              _disparar(notif)
              /* Señal para que ROL2 refresque su lista cuando llega un nuevo turnado */
              if (notif.tipo === 'TURNADO') setTurnadoKey(k => k + 1)
              return [notif, ...prev]
            })
          } catch { /* mensaje WS mal formado, se ignora */ }
        }

        ws.onerror = () => {
          if (disposed) return
          if (!pollingId.current) pollingId.current = setInterval(cargar, 30_000)
        }

        ws.onclose = (e) => {
          if (wsRef.current === ws) wsRef.current = null
          if (!disposed && e.code !== 4001 && user) {
            if (!pollingId.current) pollingId.current = setInterval(cargar, 30_000)
            const delay = Math.min(1000 * (2 ** reconnectIntentos.current), 30_000)
            reconnectIntentos.current += 1
            reconnectId.current = setTimeout(connect, delay)
          }
        }
      } catch {
        if (!pollingId.current) pollingId.current = setInterval(cargar, 30_000)
      }
    }

    connect()

    return () => {
      disposed = true
      if (socket) {
        socket.onclose = null
        socket.close()
        if (wsRef.current === socket) wsRef.current = null
      }
      if (pollingId.current) { clearInterval(pollingId.current); pollingId.current = null }
      if (reconnectId.current) { clearTimeout(reconnectId.current); reconnectId.current = null }
      reconnectIntentos.current = 0
      cargarRequestId.current += 1
      cargarController.current?.abort()
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

  const limpiarTodas = () => {
    api.delete('/notificaciones/limpiar/').catch(() => {})
    setNotifs([])
  }

  const noLeidas = notifs.filter(n => !n.leida).length

  return (
    <NotificacionesContext.Provider value={{
      notifs, noLeidas, cargar, marcarLeida, marcarTodas, limpiarTodas,
      browserNotif, showPrompt, turnadoKey,
      activarBrowserNotif, desactivarBrowserNotif, dismissPrompt,
    }}>
      {children}
    </NotificacionesContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- Context + Provider + hook en un solo archivo, mismo patrón que AuthContext.jsx (ver esa justificación)
export const useNotificaciones = () => useContext(NotificacionesContext)
