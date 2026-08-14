import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { obtenerSaludSistema } from '../api/adminApi'

const QUERY_KEY = ['admin', 'salud']

export default function useSaludSistema() {
  const queryClient = useQueryClient()
  const { data = {}, isFetching: loading, error, refetch: reload } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ signal }) => obtenerSaludSistema({ signal }),
  })

  const setData = useCallback(
    updater => queryClient.setQueryData(QUERY_KEY, updater),
    [queryClient],
  )

  const comprobarAhora = useCallback(async () => {
    const fresca = await obtenerSaludSistema({ forzar: true })
    setData(fresca)
    return fresca
  }, [setData])

  return { data, loading, error, reload, setData, comprobarAhora }
}
