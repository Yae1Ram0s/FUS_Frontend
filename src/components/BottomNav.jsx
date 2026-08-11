import { useState, useRef, useEffect, useLayoutEffect } from 'react'
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

const ICON_USUARIOS = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const ICON_REPORTES = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
)

/* Ícono del botón "más" — solo se usa cuando el menú tiene varios ítems
   (con uno solo, el botón muestra directo el ícono de ese ítem, ver abajo). */
const ICON_MAS = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

const ICON_INICIO = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)

const ICON_CALENDARIO = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

/* ── Ítems principales de la barra, por rol ── */
const NAV_ROL1 = [
  { path: '/rol1/dashboard', label: 'Inicio', icon: ICON_INICIO },
  { path: '/rol1/calendario', label: 'Calendario', icon: ICON_CALENDARIO },
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
    raised: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
      </svg>
    ),
  },
]

const NAV_ROL2 = [
  { path: '/rol2/dashboard', label: 'Inicio', icon: ICON_INICIO },
  { path: '/rol2/calendario', label: 'Calendario', icon: ICON_CALENDARIO },
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
]

const NAV_COMISIONADO = [
  { path: '/comisionado/calendario', label: 'Calendario', icon: ICON_CALENDARIO },
  {
    path: '/comisionado/fus-comisionados',
    label: 'FUS Comisionados',
    consultar: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
      </svg>
    ),
  },
]

/* Rol 4 (asistente de ROL1): mismas pantallas principales que ROL1. */
const NAV_EQUIPO_PARTICULAR = NAV_ROL1

/* ── 5º ícono: con un solo ítem, el botón navega directo a él (mismo ícono,
   ej. ROL2/Comisionado → Bitácora); con varios, se vuelve un botón "+" que
   despliega un popover con todos (ROL1: Bitácora, Reportes, Usuarios). ── */
const MENU_ROL1 = [
  { path: '/rol1/bitacora', label: 'Bitácora', icon: ICON_BITACORA },
  { path: '/rol1/reportes', label: 'Reportes', icon: ICON_REPORTES },
  { path: '/rol1/panel', label: 'Usuarios y accesos', icon: ICON_USUARIOS },
]
const MENU_ROL2 = [
  { path: '/rol2/bitacora', label: 'Bitácora', icon: ICON_BITACORA },
  { path: '/rol2/reportes', label: 'Reportes', icon: ICON_REPORTES },
]
const MENU_COMISIONADO = [
  { path: '/comisionado/bitacora', label: 'Bitácora', icon: ICON_BITACORA },
]
const MENU_EQUIPO_PARTICULAR = [
  { path: '/rol1/bitacora', label: 'Bitácora', icon: ICON_BITACORA },
  { path: '/rol1/reportes', label: 'Reportes', icon: ICON_REPORTES },
]

export default function BottomNav() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [open, setOpen] = useState(false)
  const navRef = useRef(null)
  const itemRefs = useRef([])
  const [thumb, setThumb] = useState(null)

  /* Cerrar el popover al tocar fuera */
  useEffect(() => {
    if (!open) return
    const handle = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const items = !user ? [] : user.rol === 'ROL2' ? NAV_ROL2
    : user.rol === 'COMISIONADO' ? NAV_COMISIONADO
    : user.rol === 'EQUIPO_PARTICULAR' ? NAV_EQUIPO_PARTICULAR
    : NAV_ROL1

  const menuItems = !user ? [] : user.rol === 'ROL2' ? MENU_ROL2
    : user.rol === 'COMISIONADO' ? MENU_COMISIONADO
    : user.rol === 'EQUIPO_PARTICULAR' ? MENU_EQUIPO_PARTICULAR
    : MENU_ROL1

  const isActive = (item) => item.consultar
    ? location.pathname === item.path && location.search.includes('modo=lista')
    : location.pathname === item.path

  const menuActive = menuItems.some(mi => location.pathname === mi.path)
  const activeIdx = items.findIndex(isActive)
  const thumbIdx = activeIdx !== -1 ? activeIdx : (menuActive ? items.length : -1)

  /* Thumb deslizante detrás del ícono activo — se mide en vez de asumir
     columnas de ancho fijo, porque bottom-nav-compact usa columnas de 72px
     y el resto usa 1fr (ancho variable según el número de ítems). */
  useLayoutEffect(() => {
    const navEl = navRef.current
    const target = itemRefs.current[thumbIdx]
    if (!navEl || !target) { setThumb(null); return }

    const medir = () => {
      const navRect = navEl.getBoundingClientRect()
      const iconEl = target.querySelector('.bn-icon')
      const rect = (iconEl || target).getBoundingClientRect()
      // Pastilla más ovalada que el ícono (más ancha que alta), en vez de
      // un círculo del mismo tamaño exacto del ícono.
      const width = rect.width * 1.55
      setThumb({
        width,
        height: rect.height,
        x: rect.left - navRect.left - (width - rect.width) / 2,
        y: rect.top - navRect.top,
      })
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [thumbIdx, items.length])

  if (!user) return null

  // Con un solo ítem no hay nada que "desplegar" — el botón navega directo
  // a él (mismo ícono que ese ítem, ej. Bitácora para ROL2/Comisionado). El
  // botón "+"/popover solo aparece cuando de verdad hay varias opciones.
  const tieneVarios = menuItems.length > 1
  const itemUnico = !tieneVarios ? menuItems[0] : null

  const ir = (item) => {
    if (item.consultar) {
      window.dispatchEvent(new CustomEvent('scs:consultar'))
      navigate(`${item.path}?modo=lista`)
    } else {
      navigate(item.path)
    }
  }

  const alClicMas = () => {
    if (itemUnico) navigate(itemUnico.path)
    else setOpen(o => !o)
  }

  return (
    <nav
      className={`bottom-nav${items.length <= 2 ? ' bottom-nav-compact' : ''}`}
      role="navigation"
      aria-label="Navegación principal"
      ref={navRef}
    >
      {thumb && (
        <span
          className="bn-thumb"
          style={{
            width: thumb.width,
            height: thumb.height,
            transform: `translate(${thumb.x}px, ${thumb.y}px)`,
          }}
          aria-hidden="true"
        />
      )}

      {items.map((item, idx) => (
        <button
          key={`${item.path}-${idx}`}
          ref={el => { itemRefs.current[idx] = el }}
          className={`bn-item${item.raised ? ' bn-item-raised' : ''}${isActive(item) ? ' bn-item-active' : ''}`}
          onClick={() => ir(item)}
          aria-label={item.label}
          aria-current={isActive(item) ? 'page' : undefined}
        >
          <span className="bn-icon">{item.icon}</span>
          <span className="bn-label">{item.label}</span>
        </button>
      ))}

      <button
        ref={el => { itemRefs.current[items.length] = el }}
        className={`bn-item bn-more${menuActive ? ' bn-item-active' : ''}`}
        onClick={alClicMas}
        aria-label={itemUnico ? itemUnico.label : 'Más opciones'}
        aria-haspopup={tieneVarios ? 'menu' : undefined}
        aria-expanded={tieneVarios ? open : undefined}
      >
        <span className="bn-icon">{itemUnico ? itemUnico.icon : ICON_MAS}</span>
        <span className="bn-label">{itemUnico ? itemUnico.label : 'Más'}</span>
      </button>

      {tieneVarios && open && (
        <div className="bn-popover" role="menu" aria-label="Bitácora y más opciones">
          {menuItems.map(mi => (
            <button
              key={mi.path}
              className="bn-popover-item"
              role="menuitem"
              onClick={() => { setOpen(false); navigate(mi.path) }}
            >
              <span className="bn-popover-icon">{mi.icon}</span>
              {mi.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  )
}
