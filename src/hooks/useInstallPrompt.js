import { useCallback, useEffect, useState } from 'react'

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream

const esStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

/* Chrome/Edge (PC y Android) avisan con `beforeinstallprompt` cuando la PWA
   es instalable — se captura ese evento para poder disparar el diálogo
   nativo después, a demanda, en vez del momento (arbitrario) en que el
   navegador decide ofrecerlo. iOS Safari nunca dispara ese evento (no tiene
   instalación programática), así que ahí solo se puede mostrar la
   instrucción manual de "Compartir → Agregar a inicio". */
export default function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null)
  const [instalado, setInstalado] = useState(esStandalone)

  useEffect(() => {
    if (instalado) return undefined

    const alDisponible = (e) => {
      e.preventDefault()
      setPromptEvent(e)
    }
    const alInstalar = () => {
      setInstalado(true)
      setPromptEvent(null)
    }

    window.addEventListener('beforeinstallprompt', alDisponible)
    window.addEventListener('appinstalled', alInstalar)
    return () => {
      window.removeEventListener('beforeinstallprompt', alDisponible)
      window.removeEventListener('appinstalled', alInstalar)
    }
  }, [instalado])

  const instalar = useCallback(async () => {
    if (!promptEvent) return
    promptEvent.prompt()
    await promptEvent.userChoice
    setPromptEvent(null)
  }, [promptEvent])

  return {
    instalado,
    puedeInstalar: !!promptEvent,
    esIOS: esIOS() && !instalado,
    instalar,
  }
}
