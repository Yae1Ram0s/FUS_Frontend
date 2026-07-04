import { useState, useRef, useEffect } from 'react'

/* Cuenta animada de 0 a `end` en `duration` ms, usada por las tarjetas de estadísticas. */
export function useCountUp(end, duration = 900) {
  const [val, setVal] = useState(0)
  const rafRef = useRef(null)
  useEffect(() => {
    if (!end) { setVal(0); return }
    const startTime = performance.now()
    const tick = now => {
      const p = Math.min((now - startTime) / duration, 1)
      setVal(Math.round(p * end))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [end, duration])
  return val
}
