import { useNavigate } from 'react-router-dom'
import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

export default function NotFound() {
  const navigate  = useNavigate()
  const { user }  = useContext(AuthContext)

  const goHome = () => {
    if (!user) { navigate('/login'); return }
    if (user.rol === 'ROL2') navigate('/rol2/solicitudes')
    else navigate('/rol1/consultar-fus')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg,#1a0a12 0%,#2d1020 50%,#1a0818 100%)',
      padding: '2rem',
      textAlign: 'center',
      fontFamily: 'system-ui,sans-serif',
    }}>
      <p style={{ fontSize: '6rem', fontWeight: 800, color: 'rgba(159,34,65,0.55)', lineHeight: 1, margin: '0 0 .5rem' }}>
        404
      </p>
      <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, margin: '0 0 .6rem' }}>
        Página no encontrada
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '.9rem', margin: '0 0 2rem', maxWidth: 340, lineHeight: 1.6 }}>
        La dirección que buscas no existe o no tienes permiso para acceder a ella.
      </p>
      <button
        onClick={goHome}
        style={{
          background: 'rgba(159,34,65,0.85)',
          color: '#fff',
          border: '1px solid rgba(159,34,65,0.5)',
          borderRadius: 14,
          padding: '11px 1.75rem',
          fontSize: '.875rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Ir al inicio
      </button>
    </div>
  )
}
