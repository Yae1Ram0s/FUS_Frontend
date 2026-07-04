import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import logoImg from '../assets/Logos_P_Hacienda_ANAM.png'
import NotificacionesBell from './NotificacionesBell'
import BuscadorGlobal from './BuscadorGlobal'
import { useAuth } from '../context/AuthContext'
import './Header.css'

export default function Header({ onMenuClick }) {
  const [showSearch, setShowSearch] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <header className="scs-header">
        <button className="header-menu-btn" onClick={onMenuClick} aria-label="Abrir menú">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <div className="header-logos">
          <img src={logoImg} alt="Secretaría de Hacienda y Crédito Público — Agencia Nacional de Aduanas de México" className="header-logo-img" />
        </div>

        <span className="header-titulo">Sistema de Control de Solicitudes</span>

        <button className="header-search-btn" onClick={() => setShowSearch(true)} title="Buscar FUS (Ctrl+K)" aria-label="Buscar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <span className="header-search-hint">Ctrl K</span>
        </button>

        <NotificacionesBell />

        {/* Cerrar sesión — lado derecho, mismo estilo que la campana de notificaciones */}
        <button
          className="header-logout-btn"
          onClick={() => { logout(); navigate('/login') }}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </header>

      {showSearch && <BuscadorGlobal onClose={() => setShowSearch(false)} />}
    </>
  )
}
