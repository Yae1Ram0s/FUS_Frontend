import { useCallback, useEffect, useState } from 'react'
import api from '../api/api'
import { useNotificaciones } from '../context/NotificacionesContext'

export function useTurnadosFUS(fusId, folio) {
  const [turnados, setTurnados] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(() => {
    setCargando(true)
    return api.get(`/fus/${fusId}/actividad/`)
      .then(response => setTurnados(response.data))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [fusId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicia una carga al cambiar el FUS
    cargar()
  }, [cargar])

  // En vivo: cualquier notificación de este FUS (nueva respuesta, turnado,
  // atendido...) refresca el listado sin esperar a que se remonte el panel.
  const notifCtx = useNotificaciones()
  const ultimaNotifId = notifCtx?.notifs?.[0]?.id
  useEffect(() => {
    if (notifCtx?.notifs?.[0]?.fusFolio !== folio) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el listado con un evento WebSocket externo
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ultimaNotifId` ya es el proxy primitivo estable de `notifCtx?.notifs` usado en todo el proyecto
  }, [ultimaNotifId, folio])

  return { turnados, cargando, recargar: cargar }
}
