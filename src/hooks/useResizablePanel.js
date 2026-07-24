import { useState, useRef, useCallback, useEffect } from 'react'

const MIN_WIDTH     = 160
const MAX_WIDTH     = 520
const DEFAULT_WIDTH = 290
const MOBILE_BREAKPOINT = 768

/* Lógica de arrastre para el panel izquierdo redimensionable (ConsultarFUS, SolicitudesTurnadas). */
export function useResizablePanel(storageKey) {
  const [leftWidth, setLeftWidth] = useState(() => {
    const s = localStorage.getItem(storageKey)
    return s ? Math.min(Math.max(parseInt(s), MIN_WIDTH), MAX_WIDTH) : DEFAULT_WIDTH
  })
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_BREAKPOINT)
  const resizingRef  = useRef(false)
  const widthRef     = useRef(leftWidth)
  const containerRef = useRef(null)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const startResize = useCallback((e) => {
    e.preventDefault()
    resizingRef.current = true

    const move = (ev) => {
      if (!resizingRef.current) return
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const w = Math.min(Math.max(clientX - rect.left, MIN_WIDTH), MAX_WIDTH)
      widthRef.current = w
      setLeftWidth(w)
    }

    const stop = () => {
      resizingRef.current = false
      localStorage.setItem(storageKey, String(widthRef.current))
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup',   stop)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend',  stop)
    }

    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup',   stop)
    document.addEventListener('touchmove', move, { passive: true })
    document.addEventListener('touchend',  stop)
  }, [storageKey])

  return { leftWidth: isMobile ? null : leftWidth, containerRef, startResize }
}
