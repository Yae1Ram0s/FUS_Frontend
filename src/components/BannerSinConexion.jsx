import { useConexionInternet } from '../hooks/useConexionInternet'
import './BannerSinConexion.css'

export default function BannerSinConexion() {
  const enLinea = useConexionInternet()
  if (enLinea) return null

  return (
    <div className="bsc-banner" role="status" aria-live="polite">
      Sin conexión a internet — registrar, turnar, responder, concluir o rechazar no funcionará hasta que vuelva.
    </div>
  )
}
