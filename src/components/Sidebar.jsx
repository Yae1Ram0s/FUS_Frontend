import { useCallback, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PerfilModal from './PerfilModal'
import './Sidebar.css'

const ICON_BITACORA = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
)

const ICON_INICIO = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)

const ICON_CALENDARIO = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const NAV_ROL1 = [
  {
    path: '/rol1/dashboard',
    label: 'Inicio',
    icon: ICON_INICIO,
  },
  {
    path: '/rol1/calendario',
    label: 'Calendario',
    icon: ICON_CALENDARIO,
  },
  {
    path: '/rol1/consultar-fus',
    label: 'Consultar FUS',
    consultar: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    ),
  },
  {
    path: '/rol1/registrar-fus',
    label: 'Registrar FUS',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/>
        <line x1="9" y1="14" x2="15" y2="14"/>
      </svg>
    ),
  },
  { path: '/rol1/bitacora', label: 'Búsqueda Avanzada', icon: ICON_BITACORA },
  {
    path: '/rol1/reportes',
    label: 'Reportes',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19H2"/>
      </svg>
    ),
  },
  {
    path: '/rol1/panel',
    label: 'Usuarios y accesos',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
]

const NAV_ROL2 = [
  {
    path: '/rol2/dashboard',
    label: 'Inicio',
    icon: ICON_INICIO,
  },
  {
    path: '/rol2/calendario',
    label: 'Calendario',
    icon: ICON_CALENDARIO,
  },
  {
    path: '/rol2/solicitudes',
    label: 'Solicitudes Turnadas',
    consultar: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
      </svg>
    ),
  },
  { path: '/rol2/bitacora', label: 'Búsqueda Avanzada', icon: ICON_BITACORA },
]

// Rol 4 (asistente de ROL1): mismas pantallas que ROL1, sin administración de usuarios.
const NAV_EQUIPO_PARTICULAR = NAV_ROL1.filter(item => item.path !== '/rol1/panel')

const NAV_COMISIONADO = [
  {
    path: '/comisionado/calendario',
    label: 'Calendario',
    icon: ICON_CALENDARIO,
  },
  {
    path: '/comisionado/fus-comisionados',
    label: 'FUS Comisionados',
    consultar: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
      </svg>
    ),
  },
]

export default function Sidebar() {
  const { user } = useAuth()
  const [perfilAbierto, setPerfilAbierto] = useState(false)
  const [perfilCerrando, setPerfilCerrando] = useState(false)
  const [perfilAncla, setPerfilAncla] = useState(null)
  const navigate  = useNavigate()
  const location  = useLocation()
  const cerrarPerfil = useCallback(() => setPerfilCerrando(true), [])
  const finalizarCierrePerfil = useCallback(() => {
    setPerfilAbierto(false)
    setPerfilCerrando(false)
  }, [])

  const abrirPerfil = event => {
    const rect = event.currentTarget.getBoundingClientRect()
    setPerfilAncla({
      top: rect.top,
      left: rect.right,
      centroY: rect.top + (rect.height / 2),
    })
    setPerfilCerrando(false)
    setPerfilAbierto(true)
  }

  const items = user?.rol === 'ROL2' ? NAV_ROL2
    : user?.rol === 'COMISIONADO' ? NAV_COMISIONADO
    : user?.rol === 'EQUIPO_PARTICULAR' ? NAV_EQUIPO_PARTICULAR
    : NAV_ROL1
  const initials = (user?.nombre || user?.email || 'U')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  const handleNav = (item) => {
    if (item.consultar) {
      window.dispatchEvent(new CustomEvent('scs:consultar'))
      navigate(`${item.path}?modo=lista`)
    } else {
      navigate(item.path)
    }
  }

  return (
    <aside className="sidebar">

      {/* Usuario */}
      <button
        type="button"
        className="sidebar-user"
        onClick={abrirPerfil}
        aria-label="Ver mi perfil"
        title="Ver mi perfil"
      >
        <div className="sidebar-avatar">{initials}</div>
        <div className="sidebar-user-info">
          <span className="sidebar-user-name">{user?.nombre || user?.email}</span>
          <span className="sidebar-user-role">{user?.unidadAdministrativa || 'Sin unidad asignada'}</span>
        </div>
      </button>

      {/* Navegación */}
      <nav className="sidebar-nav">
        <p className="sidebar-section-label">Menú principal</p>
        {items.map((item, idx) => {
          const isActive = item.consultar
            ? location.pathname === item.path && location.search.includes('modo=lista')
            : location.pathname === item.path
          return (
          <button
            key={`${item.path}-${idx}`}
            className={`sidebar-item${isActive ? ' sidebar-item-active' : ''}`}
            onClick={() => handleNav(item)}
            title={item.label}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            <span className="sidebar-item-label">{item.label}</span>
          </button>
          )
        })}
      </nav>

      <PerfilModal
        abierto={perfilAbierto}
        cerrando={perfilCerrando}
        user={user}
        ancla={perfilAncla}
        onClose={cerrarPerfil}
        onCierreCompleto={finalizarCierrePerfil}
      />
    </aside>
  )
}
