import { useCallback } from 'react'
import { useAsyncResource } from '../../../hooks/useAsyncResource'
import { obtenerUsuariosAdmin } from '../api/adminApi'

export default function useAdminUsuarios(filtros) {
  const fetcher = useCallback(({ signal }) => {
    // El backend espera el texto libre como `busqueda` (no `search`, que es
    // como se nombra el estado en la UI para ser consistente con el resto de
    // filtros de la app).
    const { search, ...resto } = filtros
    const params = search ? { ...resto, busqueda: search } : resto
    return obtenerUsuariosAdmin(params, { signal })
  }, [filtros])
  return useAsyncResource(fetcher, { initialData: { results: [], count: 0 }, maxAutoRetries: 0 })
}
