import { useCallback } from 'react'
import { useAsyncResource } from '../../../hooks/useAsyncResource'
import { obtenerSaludSistema } from '../api/adminApi'

export default function useSaludSistema() {
  const fetcher = useCallback(({ signal }) => obtenerSaludSistema({ signal }), [])
  const resource = useAsyncResource(fetcher, { initialData: {}, maxAutoRetries: 0 })
  const comprobarAhora = useCallback(async () => {
    resource.setData(await obtenerSaludSistema({ forzar: true }))
  }, [resource])
  return { ...resource, comprobarAhora }
}
