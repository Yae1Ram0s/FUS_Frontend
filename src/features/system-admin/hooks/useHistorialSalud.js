import { useQuery } from '@tanstack/react-query'
import { obtenerHistorialSalud } from '../api/adminApi'

export default function useHistorialSalud(dias = 14) {
  const { data = [] } = useQuery({
    queryKey: ['admin', 'salud', 'historial', dias],
    queryFn: ({ signal }) => obtenerHistorialSalud({ dias }, { signal }),
    // El original pasaba maxAutoRetries:0 — sin reintento automático.
    retry: false,
  })
  return { data }
}
