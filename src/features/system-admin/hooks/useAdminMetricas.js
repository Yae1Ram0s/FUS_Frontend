import { useCallback, useEffect } from 'react'
import { useAsyncResource } from '../../../hooks/useAsyncResource'
import { obtenerMetricasAdmin } from '../api/adminApi'

export default function useAdminMetricas(dias = 30, intervaloMs = 30000) {
  const fetcher = useCallback(({ signal }) => obtenerMetricasAdmin({ dias }, { signal }), [dias])
  const resource = useAsyncResource(fetcher, { initialData: {}, maxAutoRetries: 0 })
  const { reload } = resource
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload()
    }, intervaloMs)
    return () => window.clearInterval(timer)
  }, [intervaloMs, reload])
  return resource
}
