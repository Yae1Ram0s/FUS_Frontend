import { useCallback, useEffect, useRef, useState } from 'react'

export function useAsyncResource(
  fetcher,
  {
    initialData = null,
    mergeData = null,
    onSuccess = null,
    retryDelay = 5000,
    maxAutoRetries = 1,
  } = {},
) {
  const [data, setData] = useState(() => (
    typeof initialData === 'function' ? initialData() : initialData
  ))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const abortControllerRef = useRef(null)
  const retryTimeoutRef = useRef(null)
  const retryResolveRef = useRef(null)
  const requestIdRef = useRef(0)

  const clearPending = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
      retryResolveRef.current?.()
      retryResolveRef.current = null
    }
  }, [])

  const execute = useCallback(async () => {
    clearPending()
    const requestId = ++requestIdRef.current
    const controller = new AbortController()
    abortControllerRef.current = controller

    for (let attempt = 0; attempt <= maxAutoRetries; attempt += 1) {
      setLoading(true)
      try {
        const result = await fetcher({ signal: controller.signal })
        if (requestId !== requestIdRef.current || controller.signal.aborted) {
          return
        }
        setData(previous => (
          mergeData ? mergeData(previous, result) : result
        ))
        onSuccess?.(result)
        setError(null)
        setLoading(false)
        return
      } catch (requestError) {
        if (requestId !== requestIdRef.current || controller.signal.aborted) {
          return
        }
        setError(requestError)
        setLoading(false)
        if (attempt >= maxAutoRetries) return
        await new Promise(resolve => {
          retryResolveRef.current = resolve
          retryTimeoutRef.current = setTimeout(resolve, retryDelay)
        })
        retryTimeoutRef.current = null
        retryResolveRef.current = null
        if (requestId !== requestIdRef.current || controller.signal.aborted) {
          return
        }
      }
    }
  }, [
    clearPending,
    fetcher,
    maxAutoRetries,
    mergeData,
    onSuccess,
    retryDelay,
  ])

  const reload = useCallback(() => {
    return execute()
  }, [execute])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicia la carga asociada al recurso
    execute()
    return () => {
      requestIdRef.current += 1
      clearPending()
    }
  }, [clearPending, execute])

  return {
    data,
    error,
    loading,
    reload,
    setData,
  }
}
