import { useEffect, useRef, useState } from 'react'

export function useDebouncedSearch(
  query,
  searcher,
  { delay = 300, enabled = true, searchEmpty = false } = {},
) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const normalizedQuery = query.trim()
    const requestId = ++requestIdRef.current
    const controller = new AbortController()

    if (!enabled || (!searchEmpty && !normalizedQuery)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia resultados cuando la búsqueda queda inactiva
      setResults([])
      setLoading(false)
      setError(null)
      return () => controller.abort()
    }

    setLoading(true)
    const timeoutId = setTimeout(async () => {
      try {
        const nextResults = await searcher(normalizedQuery, { signal: controller.signal })
        if (requestId !== requestIdRef.current || controller.signal.aborted) return
        setResults(nextResults)
        setError(null)
      } catch (searchError) {
        if (requestId !== requestIdRef.current || controller.signal.aborted) return
        setResults([])
        setError(searchError)
      } finally {
        if (requestId === requestIdRef.current && !controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, delay)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [delay, enabled, query, searchEmpty, searcher])

  return { results, loading, error }
}
