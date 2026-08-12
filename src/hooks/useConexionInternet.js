import { useEffect, useState } from 'react'

// Señal general de "el navegador tiene internet", basada en los eventos
// nativos online/offline — distinta del `conectado` de NotificacionesContext,
// que solo refleja el WebSocket de notificaciones y no dice nada sobre si las
// peticiones normales (turnar, responder, registrar, etc.) van a funcionar.
export function useConexionInternet() {
  const [enLinea, setEnLinea] = useState(() => navigator.onLine)

  useEffect(() => {
    const marcarEnLinea = () => setEnLinea(true)
    const marcarSinConexion = () => setEnLinea(false)
    window.addEventListener('online', marcarEnLinea)
    window.addEventListener('offline', marcarSinConexion)
    return () => {
      window.removeEventListener('online', marcarEnLinea)
      window.removeEventListener('offline', marcarSinConexion)
    }
  }, [])

  return enLinea
}
