import { useQuery } from '@tanstack/react-query'
import { obtenerMetricasAdmin } from '../api/adminApi'

export default function useAdminMetricas(dias = 30, intervaloMs = 30000) {
  const { data = {}, isFetching: loading, error, refetch: reload } = useQuery({
    queryKey: ['admin', 'metricas', dias],
    queryFn: ({ signal }) => obtenerMetricasAdmin({ dias }, { signal }),
    // Reemplaza el setInterval + chequeo manual de document.visibilityState
    // que había antes — refetchIntervalInBackground:false hace exactamente
    // eso mismo (pausar en pestaña no visible) de forma nativa.
    refetchInterval: intervaloMs,
    refetchIntervalInBackground: false,
  })
  return { data, loading, error, reload }
}
