import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import logosImg from '../assets/Logos_P_Hacienda_ANAM.png'
import './Login.css'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { login } = useAuth()
  const navigate   = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const u = await login(email, password)
      navigate(u.rol === 'ROL2' ? '/rol2/solicitudes' : '/rol1/consultar-fus')
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        'Correo o contraseña incorrectos. Intenta nuevamente.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">

      {/* ── Panel izquierdo ── */}
      <div className="login-left">
        <div className="ll-brand">
          <img
            src={logosImg}
            alt="Secretaría de Hacienda y Crédito Público — Agencia Nacional de Aduanas de México"
            className="ll-brand-img"
          />
        </div>

        {/* Esfera pequeña arriba */}
        <div className="ll-sphere ll-sphere-a" />
        {/* Esfera mediana borde derecho */}
        <div className="ll-sphere ll-sphere-b" />

        <div className="ll-hero">
          <p className="ll-sub">Agencia Nacional de Aduanas de México</p>
          <h1 className="ll-title">
            Sistema de<br />Control de<br />Solicitudes
          </h1>
          <div className="ll-title-rule" />
        </div>

        {/* Decoración inferior */}
        <div className="ll-dots" />
        <span className="ll-xmark">×</span>
        <div className="ll-sphere ll-sphere-c" />
        <div className="ll-sphere ll-sphere-d" />

        <div className="ll-beige-strip" />
      </div>

      {/* Esfera con flecha (en la unión de paneles) */}
      <div className="ll-arrow-sphere">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="#777" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>

      {/* ── Panel derecho ── */}
      <div className="login-right">

        {/* Branding solo visible en móvil */}
        <div className="login-mobile-brand">
          <img src={logosImg} className="login-mobile-logo" alt="SHCP — ANAM" />
          <span className="login-mobile-sys">Sistema de Control de Solicitudes</span>
        </div>

        <div className="login-card">
          {loading && <Spinner label="Verificando…" />}
          <div className="login-card-header">
            <h2 className="login-welcome">¡Bienvenido/a!</h2>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="lf-group">
              <label htmlFor="login-email">Correo Institucional</label>
              <input
                id="login-email"
                type="email"
                placeholder="Particular@anam.gob.mx"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="lf-group">
              <label htmlFor="login-password">Contraseña</label>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && <p className="login-error" role="alert">{error}</p>}

            <div className="login-opts">
              <label className="lf-remember" htmlFor="login-remember">
                <input id="login-remember" type="checkbox" /> Recordar cuenta
              </label>
              <button type="button" className="lf-forgot">Olvidé mi contraseña</button>
            </div>

            <button className="btn-entrar" type="submit" disabled={loading}>
              {loading ? 'Verificando…' : 'Entrar'}
            </button>
          </form>

          {/* Iconos informativos */}
          <div className="ll-bottom-icons">
            <div className="ll-bottom-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div className="ll-bottom-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div className="ll-bottom-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
