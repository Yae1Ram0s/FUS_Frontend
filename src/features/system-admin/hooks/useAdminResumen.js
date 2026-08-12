import { useCallback } from 'react'
import { useAsyncResource } from '../../../hooks/useAsyncResource'
import { obtenerResumenAdmin } from '../api/adminApi'

export default function useAdminResumen() {
  const fetcher = useCallback(({ signal }) => obtenerResumenAdmin({ signal }), [])
  return useAsyncResource(fetcher, { initialData: {}, maxAutoRetries: 0 })
}
