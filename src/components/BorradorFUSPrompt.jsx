import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { leerBorrador, borrarBorrador, tieneContenido } from '../utils/borradorFUS'
import './BorradorFUSPrompt.css'

const RUTA_REGISTRAR = '/rol1/registrar-fus'

/* Aviso flotante: "te quedó un FUS a medio registrar" — cuando RegistrarFUS
   detecta que el usuario salió (cerró la pestaña, se le fue la conexión,
   navegó a otra pantalla) sin enviar el formulario, deja un borrador en
   localStorage (ver utils/borradorFUS.js). Este componente vive en
   AppLayout, así que aparece en cualquier pantalla de Rol 1/Equipo del
   Particular hasta que retoma el borrador o lo descarta — no se muestra
   sobre el propio formulario, para no estorbar mientras lo sigue llenando. */
export default function BorradorFUSPrompt() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const puedeRegistrar = user?.rol === 'ROL1' || user?.rol === 'EQUIPO_PARTICULAR'

  const [borrador, setBorrador] = useState(() => (
    puedeRegistrar ? leerBorrador(user?.email) : null
  ))

  if (!puedeRegistrar || !tieneContenido(borrador) || location.pathname === RUTA_REGISTRAR) {
    return null
  }

  const descartar = () => {
    borrarBorrador(user.email)
    setBorrador(null)
  }

  // RegistrarFUS recupera el borrador solo (localStorage) en cuanto detecta
  // que no hay `editar` en la URL — no hace falta ninguna marca extra aquí.
  const continuar = () => navigate(RUTA_REGISTRAR)

  return (
    <div className="bfp-wrap" role="dialog" aria-label="Solicitud FUS sin terminar de registrar">
      <div className="bfp-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
      </div>
      <div className="bfp-text">
        <p className="bfp-title">Te quedó una solicitud FUS sin terminar de registrar</p>
        <p className="bfp-sub">Guardamos lo que ya habías llenado — puedes continuar donde te quedaste.</p>
      </div>
      <div className="bfp-actions">
        <button className="bfp-btn-continuar" onClick={continuar}>
          Continuar registro
        </button>
        <button className="bfp-btn-descartar" onClick={descartar}>
          Descartar
        </button>
      </div>
    </div>
  )
}
