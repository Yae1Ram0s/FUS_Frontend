import { useState, useEffect } from 'react'
import api from '../api/api'

/* El backend YA NO reabre solo con leer GET /fus/{id}/seguimiento/ — un
   FUS "Rechazado" se queda así hasta que el comisionado registre una nueva
   respuesta (esa respuesta es la que lo reabre directo a "Atendido", ver
   SeguimientoComisionadoListCreateView.post). Este hook solo consulta ese
   mismo endpoint para leer el motivo del último rechazo y mostrarlo — ya no
   toca el estatus local. `null` = verificando, string vacío = sin motivo o
   falló la consulta. */
export function useMotivoRechazo(fus) {
  const [motivoRechazo, setMotivoRechazo] = useState(null)

  useEffect(() => {
    if (!fus?.id || fus.estatusParticular !== 'Rechazado') { setMotivoRechazo(null); return }
    let alive = true
    api.get(`/fus/${fus.id}/seguimiento/`)
      .then(r => {
        if (!alive) return
        const ultimo = [...r.data].reverse().find(s => s.tipo === 'rechazo')
        setMotivoRechazo(ultimo?.contenido || '')
      })
      .catch(() => { if (alive) setMotivoRechazo('') })
    return () => { alive = false }
  }, [fus?.id, fus?.estatusParticular])

  return motivoRechazo
}
