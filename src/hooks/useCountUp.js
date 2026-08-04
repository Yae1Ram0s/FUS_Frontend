import { useState, useRef, useEffect } from 'react'

/* Cuenta animada hacia `end` en `duration` ms, usada por las tarjetas de
   estadísticas. Anima desde el valor actualmente mostrado (no siempre desde
   0): los dashboards se refrescan solos cuando llega una notificación en
   vivo, y reiniciar la cuenta a 0 en cada refresh se veía como un parpadeo/
   reinicio en vez de una actualización en vivo. */
export function useCountUp(end, duration = 900) {
  const [val, setVal] = useState(0)
  const valRef = useRef(0)
  const rafRef = useRef(null)
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (!end) {
      valRef.current = 0
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el conteo cuando `end` cambia a 0/undefined, antes de decidir si anima
      setVal(0)
      return
    }
    const from = valRef.current
    if (from === end) return
    const startTime = performance.now()
    const tick = now => {
      const p = Math.min((now - startTime) / duration, 1)
      const current = Math.round(from + (end - from) * p)
      valRef.current = current
      setVal(current)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [end, duration])
  return val
}
