import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

let _nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts(prev => prev.map(t => t.id === id ? { ...t, saliendo: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 320)
  }, [])

  const toast = useCallback((mensaje, tipo = 'info', duracion = 4000) => {
    const id = ++_nextId
    setToasts(prev => [...prev, { id, mensaje, tipo, saliendo: false }])
    timers.current[id] = setTimeout(() => dismiss(id), duracion)
    return id
  }, [dismiss])

  const success = useCallback((msg, dur) => toast(msg, 'success', dur), [toast])
  const error   = useCallback((msg, dur) => toast(msg, 'error',   dur ?? 6000), [toast])
  const warning = useCallback((msg, dur) => toast(msg, 'warning', dur), [toast])
  const info    = useCallback((msg, dur) => toast(msg, 'info',    dur), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, dismiss }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.tipo}${t.saliendo ? ' toast-out' : ''}`} role="alert">
            <span className="toast-icon">{ICONS[t.tipo]}</span>
            <span className="toast-msg">{t.mensaje}</span>
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Cerrar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const ICONS = {
  success: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>,
  error:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>,
  warning: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  info:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
