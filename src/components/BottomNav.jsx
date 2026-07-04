import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './BottomNav.css'

const ICON_BITACORA = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
)

const ICON_INICIO = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)

const NAV_ROL1 = [
  {
    path: '/rol1/consultar-fus',
    label: 'Inicio',
    home: true,
    icon: ICON_INICIO,
  },
  {
    path: '/rol1/consultar-fus',
    label: 'Consultar FUS',
    consultar: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    ),
  },
  {
    path: '/rol1/registrar-fus',
    label: 'Registrar',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
      </svg>
    ),
  },
  { path: '/rol1/bitacora', label: 'Búsqueda', icon: ICON_BITACORA },
  {
    path: '/rol1/panel',
    label: 'Usuarios',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
]

const NAV_ROL2 = [
  {
    path: '/rol2/solicitudes',
    label: 'Inicio',
    home: true,
    icon: ICON_INICIO,
  },
  {
    path: '/rol2/solicitudes',
    label: 'Solicitudes',
    consultar: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
      </svg>
    ),
  },
  { path: '/rol2/bitacora', label: 'Búsqueda', icon: ICON_BITACORA },
]

export default function BottomNav() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  if (!user) return null

  const items = user.rol === 'ROL2' ? NAV_ROL2 : NAV_ROL1

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navegación principal">
      {items.map((item, idx) => {
        let active = false
        if (item.home) {
          active = location.pathname === item.path && !location.search.includes('modo=lista')
        } else if (item.consultar) {
          active = location.pathname === item.path && location.search.includes('modo=lista')
        } else {
          active = location.pathname === item.path
        }
        return (
          <button
            key={`${item.path}-${idx}`}
            className={`bn-item${active ? ' bn-item-active' : ''}`}
            onClick={() => {
              if (item.home) {
                window.dispatchEvent(new CustomEvent('scs:inicio'))
                navigate(item.path)
              } else if (item.consultar) {
                window.dispatchEvent(new CustomEvent('scs:consultar'))
                navigate(`${item.path}?modo=lista`)
              } else {
                navigate(item.path)
              }
            }}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
          >
            <span className="bn-icon">{item.icon}</span>
            <span className="bn-label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
