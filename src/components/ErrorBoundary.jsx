import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (!this.state.hasError) return this.props.children

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
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="rgba(248,113,113,0.8)" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: '1.5rem' }}>
          <circle cx="12" cy="12" r="10"/>
          <path d="M15 9l-6 6M9 9l6 6"/>
        </svg>
        <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, margin: '0 0 .6rem' }}>
          Algo salió mal
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '.9rem', margin: '0 0 2rem', maxWidth: 380, lineHeight: 1.6 }}>
          Ocurrió un error inesperado. Por favor recarga la página. Si el problema persiste, contacta al administrador.
        </p>
        <button
          onClick={() => window.location.reload()}
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
          Recargar página
        </button>
      </div>
    )
  }
}
