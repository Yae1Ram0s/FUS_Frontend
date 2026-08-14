import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { obtenerOtpAdmin } from '../api/adminApi'

export default function useAdminOTP(filtros) {
  const { data = { results: [], resumen: {} }, isFetching: loading, error, refetch: reload } = useQuery({
    queryKey: ['admin', 'otp', filtros],
    queryFn: ({ signal }) => obtenerOtpAdmin(filtros, { signal }),
    // Mantiene la página/tabla anterior visible mientras carga la siguiente.
    placeholderData: keepPreviousData,
    // El original pasaba maxAutoRetries:0 — sin reintento automático.
    retry: false,
    // Reemplaza el setInterval(reload, 30000) manual de la página.
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  })
  return { data, loading, error, reload }
}
