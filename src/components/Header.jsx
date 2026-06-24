import logoImg from '../assets/Logos_P_Hacienda_ANAM.png'
import NotificacionesBell from './NotificacionesBell'
import './Header.css'

export default function Header({ onMenuClick }) {
  return (
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

      <NotificacionesBell />
    </header>
  )
}
