import { useEffect, useState } from 'react'
import api from '../api/api'

/** Descarga una evidencia vía la API autenticada (JWT) y expone un object URL temporal para <a>/<img>. */
export function useEvidenciaUrl(evidenciaId) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!evidenciaId) return undefined
    let objectUrl
    let cancelado = false
    api.get(`/evidencias/${evidenciaId}/descargar/`, { responseType: 'blob' })
      .then(res => {
        if (cancelado) return
        objectUrl = URL.createObjectURL(res.data)
        setUrl(objectUrl)
      })
      .catch(() => {})
    return () => {
      cancelado = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [evidenciaId])

  return url
}
