import { useQuery } from '@tanstack/react-query'
import { obtenerSerieAuditoria } from '../api/adminApi'

export default function useSerieAuditoria(dias = 14) {
  const { data = [], refetch: reload } = useQuery({
    queryKey: ['admin', 'auditoria', 'serie', dias],
    queryFn: ({ signal }) => obtenerSerieAuditoria({ dias }, { signal }),
    // El original pasaba maxAutoRetries:0 — sin reintento automático.
    retry: false,
  })
  return { data, reload }
}
