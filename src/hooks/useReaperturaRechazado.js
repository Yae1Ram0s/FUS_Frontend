import { useState, useEffect } from 'react'
import api from '../api/api'

/* El backend reabre Rechazado→Atendido (no En_seguimiento: llegar a
   Rechazado implica que el comisionado ya había respondido al menos una
   vez) como efecto colateral de leer GET /fus/{id}/seguimiento/ (ver
   SeguimientoComisionadoListCreateView.get en el backend). Este hook
   dispara esa lectura en cuanto detecta el estatus y expone el motivo del
   último rechazo mientras se resuelve — `null` = verificando, string vacío
   = sin motivo o falló la consulta. */
export function useReaperturaRechazado(fus, setFusData) {
  const [motivoRechazo, setMotivoRechazo] = useState(null)

  useEffect(() => {
    if (!fus?.id || fus.estatusParticular !== 'Rechazado') { setMotivoRechazo(null); return }
    let alive = true
    api.get(`/fus/${fus.id}/seguimiento/`)
      .then(r => {
        if (!alive) return
        const ultimo = [...r.data].reverse().find(s => s.tipo === 'rechazo')
        setMotivoRechazo(ultimo?.contenido || '')
        setFusData(prev => prev.estatusParticular === 'Rechazado' ? { ...prev, estatusParticular: 'Atendido' } : prev)
      })
      .catch(() => { if (alive) setMotivoRechazo('') })
    return () => { alive = false }
  }, [fus?.id, fus?.estatusParticular])

  return motivoRechazo
}
