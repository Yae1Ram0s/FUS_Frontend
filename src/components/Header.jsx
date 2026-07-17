import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import logoImg from '../assets/Logos_P_Hacienda_ANAM.png'
import NotificacionesBell from './NotificacionesBell'
import BuscadorGlobal from './BuscadorGlobal'
import { useAuth } from '../context/AuthContext'
import './Header.css'

export default function Header({ onMenuClick }) {
  const [showSearch, setShowSearch] = useState(false)
  const [showMore, setShowMore] = useState(false)
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

  useEffect(() => {
    if (!showMore) return
    const onDocClick = (e) => { if (!e.target.closest('.header-actions-wrap')) setShowMore(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showMore])

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

        <div className="header-actions-wrap">
          {/* Kebab — solo se muestra en móvil dentro del Calendario (ver Header.css) */}
          <button className="header-more-btn" onClick={() => setShowMore(v => !v)} aria-label="Más opciones" aria-expanded={showMore}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>
            </svg>
          </button>

          <div className={`header-actions${showMore ? ' header-actions-flotante' : ''}`}>
            <button className="header-search-btn" onClick={() => { setShowSearch(true); setShowMore(false) }} title="Buscar FUS (Ctrl+K)" aria-label="Buscar">
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
          </div>
        </div>
      </header>

      {showSearch && <BuscadorGlobal onClose={() => setShowSearch(false)} />}
    </>
  )
}
