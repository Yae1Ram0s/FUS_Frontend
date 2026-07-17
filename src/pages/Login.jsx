import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/api'
import Spinner from '../components/Spinner'
import logosImg from '../assets/Logos_P_Hacienda_ANAM.png'
import './Login.css'

const STEP_EMAIL    = 'email'
const STEP_PASS     = 'pass'
const STEP_OTP      = 'otp'
const STEP_NEWPASS  = 'newpass'
const STEP_RECOVERY = 'recovery'   // ingresa correo para recuperar

export default function Login() {
  const [step,        setStep]        = useState(STEP_EMAIL)
  const [email,       setEmail]       = useState(() => localStorage.getItem('scs_email') || '')
  const [password,    setPassword]    = useState('')
  const [otp,         setOtp]         = useState('')
  const [newPass,     setNewPass]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [reenvioMsg,  setReenvioMsg]  = useState('')
  const [reenviando,  setReenviando]  = useState(false)
  const [isRecovery,  setIsRecovery]  = useState(false)
  const [recoveryOk,  setRecoveryOk]  = useState(false)
  const [remember,    setRemember]    = useState(() => localStorage.getItem('scs_remember') === 'true')

  const { user, login, loginWithTokens } = useAuth()
  const navigate = useNavigate()

  const rutaInicio = (rol) => {
    if (rol === 'ROL2') return '/rol2/dashboard'
    if (rol === 'COMISIONADO') return '/comisionado/calendario'
    return '/rol1/dashboard'
  }

  useEffect(() => {
    if (user) navigate(rutaInicio(user.rol), { replace: true })
  }, [user])

  const redirect = (rol) => navigate(rutaInicio(rol))

  const resetAll = () => {
    setError(''); setOtp(''); setNewPass(''); setConfirmPass('')
    setIsRecovery(false); setReenvioMsg(''); setRecoveryOk(false)
  }

  /* ── Paso 1: verificar correo ── */
  const handleEmail = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/verificar-correo/', { email: email.trim().toLowerCase() })
      setStep(data.estado === 'existente' ? STEP_PASS : STEP_OTP)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al verificar el correo.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Paso 2a: login usuario existente ── */
  const handlePassword = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const u = await login(email, password)
      if (remember) {
        localStorage.setItem('scs_remember', 'true')
        localStorage.setItem('scs_email', email.trim().toLowerCase())
      } else {
        localStorage.removeItem('scs_remember')
        localStorage.removeItem('scs_email')
      }
      redirect(u.rol)
    } catch (err) {
      setError(err.response?.data?.detail || 'Contraseña incorrecta.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Olvidé mi contraseña ── */
  const handleForgot = async () => {
    setError(''); setReenvioMsg(''); setLoading(true)
    try {
      await api.post('/auth/recuperar-contrasena/', { email })
      setIsRecovery(true)
      setOtp('')
      setStep(STEP_OTP)
      setReenvioMsg('Código de recuperación enviado a tu correo.')
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo enviar el código.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Paso 2b: verificar OTP ── */
  const handleOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/verificar-otp/', { email, codigo: otp.trim() })
      setStep(STEP_NEWPASS)
    } catch (err) {
      setError(err.response?.data?.detail || 'Código incorrecto o expirado.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Paso 3: crear o restablecer contraseña ── */
  const handleNewPass = async (e) => {
    e.preventDefault()
    if (newPass !== confirmPass) { setError('Las contraseñas no coinciden.'); return }
    if (newPass.length < 8)     { setError('Mínimo 8 caracteres.'); return }
    setError('')
    setLoading(true)
    try {
      if (isRecovery) {
        await api.post('/auth/restablecer-contrasena/', { email, codigo: otp, password: newPass })
        setRecoveryOk(true)
      } else {
        const { data } = await api.post('/auth/establecer-contrasena/', {
          email, codigo: otp, password: newPass,
        })
        const u = loginWithTokens(data)
        redirect(u.rol)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al procesar la contraseña.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Reenviar OTP ── */
  const handleReenviar = async () => {
    if (reenviando) return
    setReenvioMsg(''); setError(''); setReenviando(true)
    try {
      const endpoint = isRecovery ? '/auth/recuperar-contrasena/' : '/auth/reenviar-otp/'
      await api.post(endpoint, { email })
      setOtp('')
      setReenvioMsg('Nuevo código enviado a tu correo.')
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo reenviar el código.')
    } finally {
      setReenviando(false)
    }
  }

  /* ── Paneles del lado derecho ── */
  const EyeOpen  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  const EyeClose = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>

  const renderStep = () => {
    /* ── Contraseña restablecida ── */
    if (recoveryOk) return (
      <div className="login-form" style={{ textAlign: 'center' }}>
        <div style={{ margin: '0 auto 1rem', width: 52, height: 52, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', border: '1.5px solid rgba(74,222,128,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <p className="lf-step-info">Tu contraseña fue restablecida exitosamente.</p>
        <button className="btn-entrar" onClick={() => { resetAll(); setStep(STEP_PASS) }}>
          Iniciar sesión
        </button>
      </div>
    )

    if (step === STEP_EMAIL) return (
      <form className="login-form" onSubmit={handleEmail} noValidate>
        <div className="lf-group">
          <label htmlFor="login-email">Correo Institucional</label>
          <input
            id="login-email"
            type="email"
            placeholder="usuario@anam.gob.mx"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
        </div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="btn-entrar" type="submit" disabled={loading || !email.trim()}>
          {loading ? 'Verificando…' : 'Continuar'}
        </button>
      </form>
    )

    if (step === STEP_PASS) return (
      <form className="login-form" onSubmit={handlePassword} noValidate>
        <div className="lf-email-locked">
          <span>{email}</span>
          <button type="button" className="lf-cambiar" onClick={() => { setStep(STEP_EMAIL); setError(''); setPassword('') }}>
            Cambiar
          </button>
        </div>
        <div className="lf-group">
          <label htmlFor="login-pass">Contraseña</label>
          <div className="lf-pass-wrap">
            <input
              id="login-pass"
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              autoFocus
            />
            <button type="button" className="lf-eye" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
              {showPass ? <EyeClose /> : <EyeOpen />}
            </button>
          </div>
        </div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <div className="login-opts">
          <label className="lf-remember" htmlFor="login-remember">
            <input
              id="login-remember"
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
            /> Recordar cuenta
          </label>
          <button type="button" className="lf-forgot" onClick={handleForgot} disabled={loading}>
            {loading ? 'Enviando…' : 'Olvidé mi contraseña'}
          </button>
        </div>
        <button className="btn-entrar" type="submit" disabled={loading || !password}>
          {loading ? 'Verificando…' : 'Entrar'}
        </button>
      </form>
    )

    if (step === STEP_OTP) return (
      <form className="login-form" onSubmit={handleOtp} noValidate>
        <p className="lf-step-info">
          {isRecovery
            ? <>Enviamos un código de recuperación a <strong>{email}</strong>.</>
            : <>Enviamos un código de 6 dígitos a <strong>{email}</strong>. Revisa tu bandeja.</>
          }
        </p>
        <div className="lf-group">
          <label htmlFor="login-otp">Código de verificación</label>
          <input
            id="login-otp"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            required
            autoFocus
            className="lf-otp-input"
          />
        </div>
        {error      && <p className="login-error"  role="alert">{error}</p>}
        {reenvioMsg && <p className="lf-resend-ok">{reenvioMsg}</p>}
        <button className="btn-entrar" type="submit" disabled={loading || otp.length < 6}>
          {loading ? 'Verificando…' : 'Verificar código'}
        </button>
        <div className="lf-actions-row">
          <button type="button" className="lf-link" onClick={() => { resetAll(); setStep(isRecovery ? STEP_PASS : STEP_EMAIL) }}>
            ← {isRecovery ? 'Volver al login' : 'Cambiar correo'}
          </button>
          <button type="button" className="lf-link" onClick={handleReenviar} disabled={reenviando}>
            {reenviando && <span className="btn-spinner" />}
            {reenviando ? 'Reenviando…' : 'Reenviar código'}
          </button>
        </div>
      </form>
    )

    if (step === STEP_NEWPASS) return (
      <form className="login-form" onSubmit={handleNewPass} noValidate>
        <p className="lf-step-info">
          {isRecovery ? 'Elige tu nueva contraseña.' : 'Elige una contraseña segura para activar tu cuenta.'}
        </p>
        <div className="lf-group">
          <label htmlFor="login-np">{isRecovery ? 'Nueva contraseña' : 'Contraseña'}</label>
          <div className="lf-pass-wrap">
            <input
              id="login-np"
              type={showPass ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              required
              autoFocus
            />
            <button type="button" className="lf-eye" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
              {showPass ? <EyeClose /> : <EyeOpen />}
            </button>
          </div>
        </div>
        <div className="lf-group">
          <label htmlFor="login-cp">Confirmar contraseña</label>
          <input
            id="login-cp"
            type={showPass ? 'text' : 'password'}
            placeholder="Repite la contraseña"
            value={confirmPass}
            onChange={e => setConfirmPass(e.target.value)}
            required
          />
        </div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="btn-entrar" type="submit" disabled={loading || !newPass || !confirmPass}>
          {loading
            ? (isRecovery ? 'Restableciendo…' : 'Creando cuenta…')
            : (isRecovery ? 'Restablecer contraseña' : 'Crear cuenta y entrar')
          }
        </button>
      </form>
    )
  }

  const titles = {
    [STEP_EMAIL]:   '¡Bienvenido/a!',
    [STEP_PASS]:    '¡Bienvenido/a!',
    [STEP_OTP]:     isRecovery ? 'Recuperar contraseña' : 'Verifica tu correo',
    [STEP_NEWPASS]: isRecovery ? 'Nueva contraseña'     : 'Crea tu contraseña',
  }

  const showStepIndicator = (step === STEP_OTP || step === STEP_NEWPASS) && !isRecovery

  return (
    <div className="login-wrap">

      {/* ── Panel izquierdo ── */}
      <div className="login-left">
        <div className="ll-brand">
          <img src={logosImg} alt="SHCP — ANAM" className="ll-brand-img" />
        </div>
        <div className="ll-sphere ll-sphere-a" />
        <div className="ll-sphere ll-sphere-b" />

        <div className="ll-center-block">
          <div className="ll-logo-scs-wrap">
            <div className="ll-logo-scs-ring" />
            <img src="/Logo SCS 2026_1.png" alt="SCS 2026" className="ll-logo-scs" />
          </div>
          <div className="ll-hero">
            <p className="ll-sub">Agencia Nacional de Aduanas de México</p>
            <h1 className="ll-title">Sistema de Control de Solicitudes</h1>
            <div className="ll-title-rule" />
          </div>
        </div>
        <div className="ll-dots" />
        <span className="ll-xmark">×</span>
        <div className="ll-sphere ll-sphere-c" />
        <div className="ll-sphere ll-sphere-d" />
        <div className="ll-beige-strip" />
      </div>

      <div className="ll-arrow-sphere">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="#777" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>

      {/* ── Panel derecho ── */}
      <div className="login-right">

        <div className="login-mobile-brand">
          <img src={logosImg} className="login-mobile-logo" alt="SHCP — ANAM" />
          <span className="login-mobile-sys">Sistema de Control de Solicitudes</span>
        </div>

        <div className="login-card">
          {loading && <Spinner label="Verificando…" />}

          {showStepIndicator && (
            <div className="lf-steps">
              <span className="lf-step-dot lf-step-done" />
              <span className="lf-step-line" />
              <span className={`lf-step-dot ${step === STEP_NEWPASS ? 'lf-step-done' : 'lf-step-active'}`} />
              <span className="lf-step-line" />
              <span className={`lf-step-dot ${step === STEP_NEWPASS ? 'lf-step-active' : ''}`} />
            </div>
          )}

          <div className="login-card-header">
            <h2 className="login-welcome">{recoveryOk ? '¡Listo!' : titles[step]}</h2>
          </div>

          {renderStep()}

          <div className="ll-bottom-icons">
            <div className="ll-bottom-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div className="ll-bottom-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div className="ll-bottom-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
