import { useQuery } from '@tanstack/react-query'
import { obtenerAuditoriaAdmin } from '../api/adminApi'

export default function useAuditoriaReciente(pageSize = 5) {
  const { data = { results: [] }, refetch: reload } = useQuery({
    queryKey: ['admin', 'auditoria', 'reciente', pageSize],
    queryFn: ({ signal }) => obtenerAuditoriaAdmin({ pageSize }, { signal }),
    // El original pasaba maxAutoRetries:0 — sin reintento automático.
    retry: false,
  })
  return { data, reload }
}
