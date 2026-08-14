import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { obtenerAuditoriaAdmin } from '../api/adminApi'

export default function useAdminAuditoria(filtros) {
  const { data = { results: [], count: 0 }, isFetching: loading, error, refetch: reload } = useQuery({
    queryKey: ['admin', 'auditoria', filtros],
    queryFn: ({ signal }) => obtenerAuditoriaAdmin(filtros, { signal }),
    // Mantiene la página/tabla anterior visible mientras carga la siguiente
    // (equivalente al `data` que useAsyncResource conservaba entre fetches).
    placeholderData: keepPreviousData,
    // El original pasaba maxAutoRetries:0 — sin reintento automático.
    retry: false,
  })
  return { data, loading, error, reload }
}
