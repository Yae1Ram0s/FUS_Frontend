import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { obtenerResumenAnalitica } from '../api/analiticaApi'

export default function useAnaliticaSistema(filtros, intervaloMs = 60000) {
  const query = useQuery({
    queryKey: ['admin', 'analitica-uso', filtros],
    queryFn: ({ signal }) => obtenerResumenAnalitica(filtros, { signal }),
    placeholderData: keepPreviousData,
    refetchInterval: intervaloMs,
    refetchIntervalInBackground: false,
  })

  return {
    data: query.data,
    loading: query.isFetching,
    initialLoading: query.isPending,
    error: query.error,
    reload: query.refetch,
  }
}
