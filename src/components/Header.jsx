import { useCallback, useEffect, useRef, useState } from 'react'
import institutionalLogo from '../assets/Logos_P_Hacienda_ANAM.png'
import NotificacionesBell from './NotificacionesBell'
import { useAuth } from '../context/AuthContext'
import './Header.css'

const PROFILE_ANIMATION_MS = 220

export default function Header() {
  const [profileMounted, setProfileMounted] = useState(false)
  const [profileClosing, setProfileClosing] = useState(false)
  const [profileDetailsOpen, setProfileDetailsOpen] = useState(false)
  const profileRef = useRef(null)
  const closeTimerRef = useRef(null)
  const { user, logout } = useAuth()

  const initials = (user?.nombre || user?.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase()

  const closeProfile = useCallback(() => {
    if (!profileMounted || profileClosing) return
    setProfileClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      setProfileMounted(false)
      setProfileClosing(false)
      setProfileDetailsOpen(false)
    }, PROFILE_ANIMATION_MS)
  }, [profileMounted, profileClosing])

  const toggleProfile = () => {
    if (profileMounted) {
      closeProfile()
      return
    }
    window.clearTimeout(closeTimerRef.current)
    setProfileClosing(false)
    setProfileMounted(true)
  }

  useEffect(() => {
    if (!profileMounted) return undefined

    const handlePointerDown = event => {
      if (profileRef.current && !profileRef.current.contains(event.target)) closeProfile()
    }
    const handleKeyDown = event => {
      if (event.key === 'Escape') closeProfile()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [profileMounted, closeProfile])

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), [])

  const handleLogout = () => {
    closeProfile()
    logout()
  }

  return (
    <header className="scs-header">
      <div className="header-brand header-brand-mobile">
        <img src="/Logo SCS 2026_2.png" alt="" className="header-logo-img" />
        <span className="header-title">Sistema de Control de Solicitudes</span>
      </div>

      <div className="header-brand-desktop">
        <img
          src={institutionalLogo}
          alt="Secretaría de Hacienda y Crédito Público y Agencia Nacional de Aduanas de México"
          className="header-institutional-logo"
        />
      </div>
      <span className="header-desktop-title">Sistema de Control de Solicitudes</span>

      <div className="header-actions">
        <NotificacionesBell />

        <div className="header-profile-wrap" ref={profileRef}>
          <button
            type="button"
            className="header-avatar"
            onClick={toggleProfile}
            aria-label="Abrir perfil"
            aria-expanded={profileMounted && !profileClosing}
            aria-haspopup="dialog"
          >
            {initials}
          </button>

          {profileMounted && (
            <section
              className={`header-profile-card${profileClosing ? ' is-closing' : ''}`}
              role="dialog"
              aria-label="Perfil de usuario"
            >
              <div className="header-profile-heading">
                <span className="header-profile-avatar" aria-hidden="true">{initials}</span>
                <div>
                  <strong>{user?.nombre || 'Usuario'}</strong>
                </div>
              </div>

              {profileDetailsOpen && (
                <dl className="header-profile-details">
                  <div>
                    <dt>Nombre completo</dt>
                    <dd>{user?.nombre || 'No disponible'}</dd>
                  </div>
                  <div>
                    <dt>Correo institucional</dt>
                    <dd>{user?.email || 'No disponible'}</dd>
                  </div>
                  <div>
                    <dt>Unidad administrativa</dt>
                    <dd>{user?.unidadAdministrativa || 'Sin unidad asignada'}</dd>
                  </div>
                </dl>
              )}

              <div className="header-profile-actions">
                <button
                  type="button"
                  className="header-view-profile"
                  onClick={() => setProfileDetailsOpen(open => !open)}
                  aria-expanded={profileDetailsOpen}
                >
                  {profileDetailsOpen ? 'Ocultar perfil' : 'Ver perfil'}
                </button>
                <button type="button" className="header-sign-out" onClick={handleLogout}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            </section>
          )}
        </div>

        <button
          type="button"
          className="header-desktop-logout"
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </header>
  )
}
