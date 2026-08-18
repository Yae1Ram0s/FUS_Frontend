import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './AuthContext'
import api from '../api/api'
import { registrarServiceWorker, suscribirPush, desuscribirPush } from '../utils/webPush'

const NotificacionesContext = createContext(null)

const esHttps = () => window.location.protocol === 'https:'

export function NotificacionesProvider({ children }) {
  const { user, accessToken } = useAuth()
  const [notifs,        setNotifs]        = useState([])
  const [browserNotif,  setBrowserNotif]  = useState(() => localStorage.getItem('scs_browser_notif'))
  const [showPrompt,    setShowPrompt]    = useState(false)
  const [turnadoKey,    setTurnadoKey]    = useState(0)   // sube cuando llega TURNADO nuevo (para ROL2)
  // null = aún no se intentó conectar; true = WS abierto; false = caído,
  // operando con el fallback de polling cada 30s (ver más abajo).
  const [conectado,     setConectado]     = useState(null)
  const wsRef           = useRef(null)
  const pollingId       = useRef(null)
  const reconnectId     = useRef(null)
  const reconnectIntentos = useRef(0)
  const cargarController = useRef(null)
  const cargarRequestId = useRef(0)

  /* Registro del Service Worker (una sola vez por carga de la app) — sin
     esto, el aviso real del sistema operativo nunca llega ni en PC con el
     navegador cerrado ni en celular (ver public/sw.js). Independiente de si
     el usuario ya dio permiso o no: hace falta tenerlo listo desde antes de
     poder suscribirse. */
  useEffect(() => { registrarServiceWorker() }, [])

  /* Re-suscribe al iniciar sesión si ya había permiso otorgado de una vez
     anterior — el navegador puede haber invalidado la suscripción vieja
     (reinstaló el Service Worker, se limpió el storage, etc.) sin que el
     usuario haya tenido que volver a aceptar el permiso del sistema.
     suscribirPush ya es idempotente (reusa la suscripción si sigue viva). */
  useEffect(() => {
    if (!user || browserNotif !== 'on') return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    suscribirPush(api)
  }, [user, browserNotif])

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
      ? `${wsBase}/ws/notificaciones/`
      : `${proto}://${window.location.host}/ws/notificaciones/`

    const connect = () => {
      if (disposed) return
      try {
        const ws = new WebSocket(wsUrl)
        socket = ws
        wsRef.current = ws

        ws.onopen = () => {
          if (disposed) return
          // El token va como primer mensaje (no en la URL) para que no
          // quede registrado en logs de proxies/servidores intermedios.
          ws.send(JSON.stringify({ token: accessToken }))
          reconnectIntentos.current = 0
          setConectado(true)
          if (pollingId.current) { clearInterval(pollingId.current); pollingId.current = null }
        }

        ws.onmessage = (e) => {
          if (disposed) return
          try {
            const notif = JSON.parse(e.data)
            setNotifs(prev => {
              if (prev.some(n => n.id === notif.id)) return prev
              /* El aviso del sistema operativo ya no sale de aquí — lo dispara
                 el Service Worker al recibir el push real del backend (ver
                 public/sw.js), que a diferencia de esto sí llega con la app
                 cerrada. Esto solo mantiene la campanita/lista en vivo. */
              /* Señal para que ROL2 refresque su lista cuando llega un nuevo turnado */
              if (notif.tipo === 'TURNADO') setTurnadoKey(k => k + 1)
              return [notif, ...prev]
            })
          } catch { /* mensaje WS mal formado, se ignora */ }
        }

        ws.onerror = () => {
          if (disposed) return
          setConectado(false)
          if (!pollingId.current) pollingId.current = setInterval(cargar, 30_000)
        }

        ws.onclose = (e) => {
          if (wsRef.current === ws) wsRef.current = null
          if (!disposed && e.code !== 4001 && user) {
            setConectado(false)
            if (!pollingId.current) pollingId.current = setInterval(cargar, 30_000)
            const delay = Math.min(1000 * (2 ** reconnectIntentos.current), 30_000)
            reconnectIntentos.current += 1
            reconnectId.current = setTimeout(connect, delay)
          }
        }
      } catch {
        setConectado(false)
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
    if (pref === 'on') suscribirPush(api)
  }

  /* Desactivar notificaciones del navegador */
  const desactivarBrowserNotif = () => {
    localStorage.setItem('scs_browser_notif', 'off')
    setBrowserNotif('off')
    desuscribirPush(api)
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
      browserNotif, showPrompt, turnadoKey, conectado,
      activarBrowserNotif, desactivarBrowserNotif, dismissPrompt,
    }}>
      {children}
    </NotificacionesContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- Context + Provider + hook en un solo archivo, mismo patrón que AuthContext.jsx (ver esa justificación)
export const useNotificaciones = () => useContext(NotificacionesContext)
