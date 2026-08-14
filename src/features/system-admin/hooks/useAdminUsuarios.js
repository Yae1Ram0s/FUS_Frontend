import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerUsuariosAdmin } from '../api/adminApi'

export default function useAdminUsuarios(filtros) {
  const queryClient = useQueryClient()

  // El backend espera el texto libre como `busqueda` (no `search`, que es
  // como se nombra el estado en la UI para ser consistente con el resto de
  // filtros de la app).
  const { search, ...resto } = filtros
  const params = search ? { ...resto, busqueda: search } : resto
  const queryKey = ['admin', 'usuarios', params]

  const { data = { results: [], count: 0 }, isFetching: loading, error, refetch: reload } = useQuery({
    queryKey,
    queryFn: ({ signal }) => obtenerUsuariosAdmin(params, { signal }),
  })

  const setData = updater => queryClient.setQueryData(queryKey, updater)

  return { data, loading, error, reload, setData }
}
