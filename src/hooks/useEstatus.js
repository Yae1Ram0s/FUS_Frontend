import { useState, useEffect } from 'react'
import api from '../api/api'

const cache = {}

/**
 * Carga los estatus activos desde /catalogos/estatus/.
 * @param {string} tipoFlujo  'PARTICULAR' | 'TITULAR' | undefined (todos)
 * @returns {{ estatus: Array, loading: boolean }}
 */
export function useEstatus(tipoFlujo) {
  const key = tipoFlujo || 'TODOS'
  const [estatus, setEstatus]   = useState(cache[key] ?? [])
  const [loading, setLoading]   = useState(!cache[key])

  useEffect(() => {
    if (cache[key]) {
      setEstatus(cache[key])
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    const params = tipoFlujo ? { tipoFlujo } : {}
    api.get('/catalogos/estatus/', { params })
      .then(r => {
        if (!alive) return
        cache[key] = r.data
        setEstatus(r.data)
      })
      .catch(() => {}) // silencioso — los chips seguirán funcionando con los estáticos
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [key, tipoFlujo])

  return { estatus, loading }
}
