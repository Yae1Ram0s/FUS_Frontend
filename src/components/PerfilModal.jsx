import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './PerfilModal.css'

const ICON_USER = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21a8 8 0 0 0-16 0" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const ICON_BUILDING = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 21v-6h6v6M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01" />
  </svg>
)

const ICON_MAIL = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
)

function obtenerNombre(user) {
  return user?.nombreCompleto
    || user?.nombre_completo
    || user?.nombre
    || [user?.first_name, user?.last_name].filter(Boolean).join(' ')
    || 'Nombre no disponible'
}

export default function PerfilModal({ abierto, cerrando, user, ancla, onClose, onCierreCompleto }) {
  const cerrarRef = useRef(null)

  useEffect(() => {
    if (!abierto) return undefined

    const previo = document.activeElement
    const onKeyDown = event => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('perfil-modal-abierto')
    window.requestAnimationFrame(() => cerrarRef.current?.focus())

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('perfil-modal-abierto')
      previo?.focus?.()
    }
  }, [abierto, onClose])

  if (!abierto) return null

  const nombre = obtenerNombre(user)
  const unidad = user?.unidadAdministrativa
    || user?.unidad_administrativa
    || user?.unidad
    || 'Sin unidad administrativa asignada'
  const correo = user?.email || user?.correo || 'Correo no disponible'
  const anchoEstimado = 440
  const posicionFlotante = window.innerWidth > 620
  const left = Math.min((ancla?.left || 256) + 14, window.innerWidth - anchoEstimado - 20)
  const top = Math.min(Math.max(ancla?.top || 72, 20), Math.max(20, window.innerHeight - 500))
  const modalStyle = posicionFlotante
    ? {
        '--perfil-modal-left': `${Math.max(20, left)}px`,
        '--perfil-modal-top': `${top}px`,
        '--perfil-modal-origen-y': `${Math.max(24, (ancla?.centroY || 110) - top)}px`,
      }
    : undefined

  return createPortal(
    <div
      className={`perfil-modal-overlay${cerrando ? ' perfil-modal-overlay--cerrando' : ''}`}
      onMouseDown={onClose}
      onAnimationEnd={event => {
        if (cerrando && event.target === event.currentTarget) onCierreCompleto()
      }}
      style={modalStyle}
    >
      <section
        className="perfil-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="perfil-modal-titulo"
        onMouseDown={event => event.stopPropagation()}
      >
        <button ref={cerrarRef} type="button" className="perfil-modal-cerrar" onClick={onClose} aria-label="Cerrar perfil">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>

        <header className="perfil-modal-header">
          <div className="perfil-modal-icono">{ICON_USER}</div>
          <div>
            <span className="perfil-modal-eyebrow">Mi perfil</span>
            <h2 id="perfil-modal-titulo">Información del usuario</h2>
          </div>
        </header>

        <div className="perfil-modal-datos">
          <div className="perfil-modal-campo">
            <span className="perfil-modal-campo-icono">{ICON_USER}</span>
            <div>
              <span>Nombre completo</span>
              <strong>{nombre}</strong>
            </div>
          </div>
          <div className="perfil-modal-campo">
            <span className="perfil-modal-campo-icono">{ICON_BUILDING}</span>
            <div>
              <span>Unidad administrativa</span>
              <strong>{unidad}</strong>
            </div>
          </div>
          <div className="perfil-modal-campo">
            <span className="perfil-modal-campo-icono">{ICON_MAIL}</span>
            <div>
              <span>Correo institucional</span>
              <strong>{correo}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  )
}
