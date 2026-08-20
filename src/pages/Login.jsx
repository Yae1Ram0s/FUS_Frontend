import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/api'
import { rutaInicioPorRol } from '../utils/rutas'
import useInstallPrompt from '../hooks/useInstallPrompt'
import { useAnalytics } from '../analytics'
import logosImg from '../assets/Logos_P_Hacienda_ANAM.png'
import './Login.css'

const STEP_EMAIL    = 'email'
const STEP_PASS     = 'pass'
const STEP_OTP      = 'otp'
const STEP_NEWPASS  = 'newpass'
const DOMINIO_INSTITUCIONAL = '@anam.gob.mx'
const REENVIO_COOLDOWN_MS = 2 * 60 * 1000
const REENVIO_STORAGE_KEY = 'scs_otp_reenvio'

const usuarioGuardado = () => {
  try { return JSON.parse(localStorage.getItem('scs_user') || 'null') }
  catch { return null }
}

export default function Login() {
  const [step,        setStep]        = useState(() => usuarioGuardado()?.requiereCambioContrasena ? STEP_NEWPASS : STEP_EMAIL)
  const [email,       setEmail]       = useState(() => localStorage.getItem('scs_email') || usuarioGuardado()?.email || '')
  const [password,    setPassword]    = useState('')
  const [otp,         setOtp]         = useState('')
  const [newPass,     setNewPass]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [reenvioMsg,  setReenvioMsg]  = useState('')
  const [reenviando,  setReenviando]  = useState(false)
  const [reenvioHasta, setReenvioHasta] = useState(0)
  const [reenvioRestante, setReenvioRestante] = useState(0)
  const [passBloqueadoHasta, setPassBloqueadoHasta] = useState(0)
  const [passBloqueoRestante, setPassBloqueoRestante] = useState(0)
  const [isRecovery,  setIsRecovery]  = useState(false)
  const [cambioObligatorio, setCambioObligatorio] = useState(() => Boolean(usuarioGuardado()?.requiereCambioContrasena))
  const [recoveryOk,  setRecoveryOk]  = useState(false)
  const [remember,    setRemember]    = useState(() => localStorage.getItem('scs_remember') === 'true')
  const [esMovil,     setEsMovil]     = useState(() => window.matchMedia('(max-width: 768px)').matches)

  const { user, login, loginWithTokens, completarCambioContrasena, logout } = useAuth()
  const navigate = useNavigate()
  const { instalado, puedeInstalar, esIOS, instalar } = useInstallPrompt()
  const { track, startTask, completeTask, failTask, abandonTask } = useAnalytics({ modulo: 'ACCESO' })

  useEffect(() => {
    if (user && !user.requiereCambioContrasena) navigate(rutaInicioPorRol(user.rol), { replace: true })
  }, [user, navigate])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)')
    const actualizar = (evento) => setEsMovil(evento.matches)
    media.addEventListener('change', actualizar)
    return () => media.removeEventListener('change', actualizar)
  }, [])

  useEffect(() => {
    if (step !== STEP_OTP || !email) return undefined

    try {
      const guardado = JSON.parse(localStorage.getItem(REENVIO_STORAGE_KEY) || 'null')
      if (guardado?.email === email && guardado?.hasta > Date.now()) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura desde localStorage el cronómetro de reenvío vigente al entrar al paso OTP con este correo
        setReenvioHasta(guardado.hasta)
      } else {
        setReenvioHasta(0)
        localStorage.removeItem(REENVIO_STORAGE_KEY)
      }
    } catch {
      localStorage.removeItem(REENVIO_STORAGE_KEY)
    }
    return undefined
  }, [step, email])

  useEffect(() => {
    if (!reenvioHasta) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetea el contador visible cuando el cronómetro (reenvioHasta) se apaga
      setReenvioRestante(0)
      return undefined
    }

    const actualizarContador = () => {
      const restante = Math.max(0, Math.ceil((reenvioHasta - Date.now()) / 1000))
      setReenvioRestante(restante)
      if (restante === 0) {
        setReenvioHasta(0)
        localStorage.removeItem(REENVIO_STORAGE_KEY)
      }
    }

    actualizarContador()
    const intervalo = window.setInterval(actualizarContador, 1000)
    return () => window.clearInterval(intervalo)
  }, [reenvioHasta])

  /* Cuenta regresiva del bloqueo por intentos fallidos de contraseña (ver
     handlePassword) — mismo patrón que el cronómetro de reenvío de OTP. */
  useEffect(() => {
    if (!passBloqueadoHasta) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetea el contador visible cuando el bloqueo (passBloqueadoHasta) se apaga
      setPassBloqueoRestante(0)
      return undefined
    }

    const actualizarContador = () => {
      const restante = Math.max(0, Math.ceil((passBloqueadoHasta - Date.now()) / 1000))
      setPassBloqueoRestante(restante)
      if (restante === 0) setPassBloqueadoHasta(0)
    }

    actualizarContador()
    const intervalo = window.setInterval(actualizarContador, 1000)
    return () => window.clearInterval(intervalo)
  }, [passBloqueadoHasta])

  // La franja de status bar (notch/Dynamic Island) en Safari/iOS no es parte
  // del DOM — la pinta el navegador con el color de <meta name="theme-color">,
  // así que el fondo verde de .login-wrap no le llega. Solo el Login la quiere
  // verde (el resto de la app se dejó en blanco a propósito); se cambia el
  // meta al montar y se restaura el valor original al desmontar.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) return undefined
    const original = meta.getAttribute('content')
    meta.setAttribute('content', '#1c4a3e')
    return () => meta.setAttribute('content', original)
  }, [])

  const redirect = (rol) => navigate(rutaInicioPorRol(rol))

  const activarEsperaReenvio = (correo = email) => {
    const hasta = Date.now() + REENVIO_COOLDOWN_MS
    localStorage.setItem(REENVIO_STORAGE_KEY, JSON.stringify({ email: correo, hasta }))
    setReenvioHasta(hasta)
  }

  const resetAll = () => {
    setError(''); setOtp(''); setPassword(''); setNewPass(''); setConfirmPass('')
    setIsRecovery(false); setReenvioMsg(''); setRecoveryOk(false)
    setCambioObligatorio(false)
  }

  /* ── Paso 1: verificar correo ── */
  const handleEmail = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    // Se limpia una sola vez aquí y se reescribe el estado: los pasos
    // siguientes (contraseña, olvidé mi contraseña, OTP, nueva contraseña)
    // reusan `email` tal cual, sin volver a limpiarlo — sin esto, un espacio
    // o mayúscula que el teclado de un celular agrega solo (autocompletado)
    // sobrevivía a este paso y rompía la búsqueda en los pasos de después,
    // que si comparan el correo exacto (a diferencia de éste, que ya llegó
    // limpio a verificar-correo).
    const limpio = email.trim().toLowerCase()
    setEmail(limpio)
    const taskId = startTask({ componente: 'LOGIN_EMAIL_STEP', accion: 'OPEN' })
    try {
      const { data } = await api.post('/auth/verificar-correo/', { email: limpio })
      completeTask(taskId)
      if (data.estado === 'existente') {
        setStep(STEP_PASS)
      } else {
        // Primer ingreso: verificar-correo ya generó y envió el OTP —
        // pasa por el paso de código antes de crear la contraseña.
        setOtp('')
        setStep(STEP_OTP)
        activarEsperaReenvio(limpio)
      }
    } catch (err) {
      failTask(taskId, { metadatos: { motivo: err.response ? 'error_servidor' : 'sin_conexion' } })
      setError(err.response?.data?.detail || 'Error al verificar el correo.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Paso 2a: login usuario existente ── */
  const handlePassword = async (e) => {
    e.preventDefault()
    if (passBloqueoRestante > 0) return
    setError('')
    setLoading(true)
    const taskId = startTask({ componente: 'LOGIN_PASSWORD_STEP', accion: 'OPEN' })
    try {
      const u = await login(email, password)
      if (remember) {
        localStorage.setItem('scs_remember', 'true')
        localStorage.setItem('scs_email', email.trim().toLowerCase())
      } else {
        localStorage.removeItem('scs_remember')
        localStorage.removeItem('scs_email')
      }
      completeTask(taskId, { metadatos: { rol: u.rol } })
      if (u.requiereCambioContrasena) {
        setCambioObligatorio(true)
        setNewPass('')
        setConfirmPass('')
        setStep(STEP_NEWPASS)
        return
      }
      redirect(u.rol)
    } catch (err) {
      if (err.response?.data?.code === 'cuenta_no_activada') {
        // El correo está autorizado pero nunca se activó la cuenta (no hay
        // User todavía) — en vez de dejarlo varado, reinicia el flujo de
        // activación automáticamente (mismo que seguiría un usuario nuevo).
        failTask(taskId, { metadatos: { motivo: 'cuenta_no_activada' } })
        setPassword('')
        try {
          const { data } = await api.post('/auth/verificar-correo/', { email: email.trim().toLowerCase() })
          setStep(data.estado === 'existente' ? STEP_PASS : STEP_NEWPASS)
        } catch (err2) {
          setError(err2.response?.data?.detail || err.response.data.detail)
        }
      } else if (err.response?.data?.code === 'login_bloqueado') {
        const segundos = err.response.data.segundosRestantes || 60
        setPassBloqueadoHasta(Date.now() + segundos * 1000)
        failTask(taskId, { metadatos: { motivo: 'login_bloqueado' } })
        setError(err.response.data.detail)
      } else {
        failTask(taskId, { metadatos: { motivo: err.response ? 'error_servidor' : 'sin_conexion' } })
        setError(err.response?.data?.detail || 'Contraseña incorrecta.')
      }
    } finally {
      setLoading(false)
    }
  }

  /* ── Olvidé mi contraseña ── */
  const handleForgot = async () => {
    setError(''); setReenvioMsg(''); setLoading(true)
    const taskId = startTask({ componente: 'LOGIN_FORGOT_PASSWORD', accion: 'OPEN' })
    try {
      await api.post('/auth/recuperar-contrasena/', { email })
      completeTask(taskId)
      setIsRecovery(true)
      setOtp('')
      setStep(STEP_OTP)
      activarEsperaReenvio()
      setReenvioMsg('Código de recuperación enviado a tu correo.')
    } catch (err) {
      failTask(taskId, { metadatos: { motivo: err.response ? 'error_servidor' : 'sin_conexion' } })
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
    const taskId = startTask({ componente: 'LOGIN_OTP_STEP', accion: 'OPEN' })
    try {
      await api.post('/auth/verificar-otp/', { email, codigo: otp.trim() })
      completeTask(taskId)
      setStep(STEP_NEWPASS)
    } catch (err) {
      failTask(taskId, { metadatos: { motivo: err.response ? 'error_servidor' : 'sin_conexion' } })
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
    const esCambioObligatorio = cambioObligatorio || user?.requiereCambioContrasena
    const taskId = startTask({
      componente: 'LOGIN_NEWPASS_STEP',
      accion: esCambioObligatorio || isRecovery ? 'UPDATE' : 'CREATE',
    })
    try {
      if (esCambioObligatorio) {
        if (!password) {
          abandonTask(taskId, { metadatos: { motivo: 'falta_password_temporal' } })
          setError('Ingresa nuevamente la contraseña temporal.')
          return
        }
        if (password === newPass) {
          abandonTask(taskId, { metadatos: { motivo: 'password_igual' } })
          setError('La nueva contraseña debe ser diferente de la contraseña temporal.')
          return
        }
        const { data } = await api.post('/auth/cambiar-contrasena-obligatoria/', {
          passwordActual: password,
          passwordNueva: newPass,
        })
        completeTask(taskId)
        const usuarioActualizado = completarCambioContrasena(data)
        redirect(usuarioActualizado.rol)
      } else if (isRecovery) {
        await api.post('/auth/restablecer-contrasena/', { email, codigo: otp, password: newPass })
        completeTask(taskId)
        setRecoveryOk(true)
      } else {
        const { data } = await api.post('/auth/establecer-contrasena/', {
          email, codigo: otp, password: newPass,
        })
        completeTask(taskId)
        const u = loginWithTokens(data)
        redirect(u.rol)
      }
    } catch (err) {
      failTask(taskId, { metadatos: { motivo: err.response ? 'error_servidor' : 'sin_conexion' } })
      setError(err.response?.data?.detail || 'Error al procesar la contraseña.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Reenviar OTP ── */
  const handleReenviar = async () => {
    if (reenviando || reenvioRestante > 0) return
    setReenvioMsg(''); setError(''); setReenviando(true)
    const taskId = startTask({ componente: 'LOGIN_REENVIAR_OTP', accion: 'OPEN' })
    try {
      const endpoint = isRecovery ? '/auth/recuperar-contrasena/' : '/auth/reenviar-otp/'
      await api.post(endpoint, { email })
      completeTask(taskId)
      setOtp('')
      activarEsperaReenvio()
      setReenvioMsg('Nuevo código enviado a tu correo.')
    } catch (err) {
      failTask(taskId, { metadatos: { motivo: err.response ? 'error_servidor' : 'sin_conexion' } })
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
          {/* Mismo campo dividido (usuario + dominio fijo) en PC y móvil —
              antes solo aparecía en móvil; en desktop había que teclear el
              "@anam.gob.mx" a mano. */}
          <div className="lf-email-mobile-wrap">
            <input
              id="login-email"
              type="text"
              inputMode="email"
              placeholder="usuario@anam.gob.mx"
              value={email.toLowerCase().endsWith(DOMINIO_INSTITUCIONAL)
                ? email.slice(0, -DOMINIO_INSTITUCIONAL.length)
                : email.split('@')[0]}
              onChange={e => {
                const nombre = e.target.value.toLowerCase().split('@')[0].replace(/\s/g, '')
                setEmail(nombre ? `${nombre}${DOMINIO_INSTITUCIONAL}` : '')
              }}
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              autoFocus
            />
            {email && <span aria-hidden="true">{DOMINIO_INSTITUCIONAL}</span>}
          </div>
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
          <button type="button" className="lf-cambiar" onClick={() => { track({ componente: 'LOGIN_PASSWORD_STEP', accion: 'NAVIGATE', metadatos: { control: 'cambiar_correo' } }); setStep(STEP_EMAIL); setError(''); setPassword(''); setPassBloqueadoHasta(0) }}>
            Cambiar
          </button>
        </div>
        {/* Input oculto (no display:none/visibility:hidden — algunos
            gestores de contraseñas los ignoran) con autoComplete="username":
            el correo se pidió en el paso anterior, en otro <form>, así que
            sin esto el navegador no tiene con qué asociar la contraseña de
            este formulario y no ofrece guardar el par correo+contraseña en
            su gestor (cifrado por el SO, no accesible por JS/XSS) — la
            forma segura de "recordar la contraseña". */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden tabIndex={-1} aria-hidden="true" />
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
        <button className="btn-entrar" type="submit" disabled={loading || !password || passBloqueoRestante > 0}>
          {loading
            ? 'Verificando…'
            : passBloqueoRestante > 0
              ? `Espera ${String(Math.floor(passBloqueoRestante / 60)).padStart(2, '0')}:${String(passBloqueoRestante % 60).padStart(2, '0')}`
              : 'Entrar'}
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
        <div className="lf-group lf-group-otp">
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
          <button type="button" className="lf-link" onClick={() => { track({ componente: 'LOGIN_OTP_STEP', accion: 'NAVIGATE', metadatos: { control: isRecovery ? 'volver_login' : 'cambiar_correo' } }); resetAll(); setStep(isRecovery ? STEP_PASS : STEP_EMAIL) }}>
            ← {isRecovery ? 'Volver al login' : 'Cambiar correo'}
          </button>
          <button
            type="button"
            className="lf-link lf-resend-link"
            onClick={handleReenviar}
            disabled={reenviando || reenvioRestante > 0}
            aria-live="polite"
          >
            {reenviando && <span className="btn-spinner" />}
            {reenviando
              ? 'Reenviando…'
              : reenvioRestante > 0
                ? `Reenviar en ${String(Math.floor(reenvioRestante / 60)).padStart(2, '0')}:${String(reenvioRestante % 60).padStart(2, '0')}`
                : 'Reenviar código'}
          </button>
        </div>
      </form>
    )

    if (step === STEP_NEWPASS) return (
      <form className={`login-form${isRecovery ? ' login-form-recovery' : ''}`} onSubmit={handleNewPass} noValidate>
        <p className="lf-step-info">
          {(cambioObligatorio || user?.requiereCambioContrasena)
            ? 'Por seguridad, reemplaza la contraseña temporal antes de entrar al sistema.'
            : isRecovery ? 'Elige tu nueva contraseña.' : 'Elige una contraseña segura para activar tu cuenta.'}
        </p>
        {/* Mismo motivo que en el paso de contraseña: sin un campo de
            usuario en este <form>, el navegador no puede ofrecer guardar
            (o actualizar) la contraseña en su gestor. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden tabIndex={-1} aria-hidden="true" />
        {(cambioObligatorio || user?.requiereCambioContrasena) && (
          <div className="lf-group">
            <label htmlFor="login-temp-pass">Contraseña temporal</label>
            <div className="lf-pass-wrap">
              <input
                id="login-temp-pass"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                autoFocus={!password}
              />
            </div>
          </div>
        )}
        <div className="lf-group">
          <label htmlFor="login-np">{(isRecovery || cambioObligatorio || user?.requiereCambioContrasena) ? 'Nueva contraseña' : 'Contraseña'}</label>
          <div className="lf-pass-wrap">
            <input
              id="login-np"
              type={showPass ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              required
              autoComplete="new-password"
              autoFocus={!(cambioObligatorio || user?.requiereCambioContrasena) || Boolean(password)}
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
            autoComplete="new-password"
          />
        </div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="btn-entrar" type="submit" disabled={loading || !newPass || !confirmPass}>
          {loading
            ? ((isRecovery || cambioObligatorio || user?.requiereCambioContrasena) ? 'Guardando…' : 'Creando cuenta…')
            : ((cambioObligatorio || user?.requiereCambioContrasena)
              ? 'Guardar nueva contraseña y entrar'
              : isRecovery ? 'Restablecer contraseña' : 'Crear cuenta y entrar')
          }
        </button>
        {(cambioObligatorio || user?.requiereCambioContrasena) && (
          <div className="lf-actions-row">
            <button
              type="button"
              className="lf-link"
              data-analytics-event="INTERACTION"
              data-analytics-component="LOGIN_USAR_OTRA_CUENTA"
              onClick={() => logout()}
            >
              Usar otra cuenta
            </button>
          </div>
        )}
      </form>
    )
  }

  const titles = {
    [STEP_EMAIL]:   '¡Bienvenido/a!',
    [STEP_PASS]:    '¡Bienvenido/a!',
    [STEP_OTP]:     isRecovery ? 'Recuperar contraseña' : 'Verifica tu correo',
    [STEP_NEWPASS]: (cambioObligatorio || user?.requiereCambioContrasena)
      ? 'Cambia tu contraseña temporal'
      : isRecovery ? 'Nueva contraseña' : 'Crea tu contraseña',
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
            {!recoveryOk && (step === STEP_EMAIL || step === STEP_PASS) && (
              <p className="login-personal-message">
                Ingresa tus credenciales para continuar en tu espacio de trabajo.
              </p>
            )}
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

          {!instalado && (
            puedeInstalar ? (
              <button type="button" className="ll-install-hint" onClick={instalar}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>
                </svg>
                Agrega esta app a tu pantalla de inicio
              </button>
            ) : (
              <p className="ll-install-hint">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>
                </svg>
                {esIOS
                  ? 'Agrégala desde Compartir → «Agregar a inicio»'
                  : esMovil
                    ? 'Agrégala desde el menú ⋮ de tu navegador → «Agregar a pantalla de inicio»'
                    : 'Instálala desde el ícono ⊕ de la barra de direcciones, o el menú ⋮ → «Instalar aplicación»'
                }
              </p>
            )
          )}
        </div>
      </div>
    </div>
  )
}
