import { useQuery } from '@tanstack/react-query'
import { obtenerResumenAdmin } from '../api/adminApi'

export default function useAdminResumen() {
  const { data = {}, isFetching: loading, error, refetch: reload } = useQuery({
    queryKey: ['admin', 'resumen'],
    queryFn: ({ signal }) => obtenerResumenAdmin({ signal }),
  })
  return { data, loading, error, reload }
}
