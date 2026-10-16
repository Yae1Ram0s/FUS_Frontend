import { useState, useEffect, useRef, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  motion, AnimatePresence, MotionConfig, animate,
  useMotionValue, useSpring, useTransform, useReducedMotion,
} from 'motion/react'
import { useAuth } from '../context/AuthContext'
import api, { mensajeErrorConexion } from '../api/api'
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
const LOGIN_ANCHO_DISENO = 1920

const TITULO_SISTEMA = 'Sistema de Control de Solicitudes'
const EASE_SALIDA = [0.22, 1, 0.36, 1]

/* ── Variantes de animación ──
   El contenedor de cada paso escalona la entrada de sus hijos (campos, botón,
   enlaces) y éstos solo declaran `variants={variantesItem}`. */
const variantesPaso = {
  hidden: { opacity: 0, x: 24 },
  show: {
    opacity: 1, x: 0,
    transition: { duration: 0.45, ease: EASE_SALIDA, delayChildren: 0.06, staggerChildren: 0.07 },
  },
}
const variantesItem = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_SALIDA } },
}
const variantesIconos = {
  hidden: {},
  show:   { transition: { delayChildren: 0.7, staggerChildren: 0.09 } },
}
const variantesIcono = {
  hidden: { opacity: 0, scale: 0.5, y: 10 },
  show:   { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 18 } },
}

const usuarioGuardado = () => {
  try { return JSON.parse(localStorage.getItem('scs_user') || 'null') }
  catch { return null }
}

const EyeOpen  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const EyeClose = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>

/* Texto que aparece letra por letra. Las palabras se mantienen juntas
   (nowrap) para que el salto de línea siga ocurriendo entre palabras.
   `mascara`: cada letra sube desde un recorte; `desenfoque`: se enfoca. */
function Letras({ texto, retraso = 0, paso = 0.03, mascara = false, desenfoque = false }) {
  let n = 0
  return texto.split(' ').map((palabra, i, palabras) => (
    <Fragment key={i}>
      <span className={mascara ? 'll-word-mask' : 'll-word-nowrap'}>
        {[...palabra].map((letra, j) => (
          <motion.span
            key={j}
            className="ll-word"
            initial={{ opacity: 0, y: mascara ? '115%' : 10, filter: desenfoque ? 'blur(8px)' : 'blur(0px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: mascara ? 0.8 : 0.7, delay: retraso + (n++) * paso, ease: EASE_SALIDA }}
          >
            {letra}
          </motion.span>
        ))}
      </span>
      {i < palabras.length - 1 && ' '}
    </Fragment>
  ))
}

/* Logo SHCP/ANAM: se revela de izquierda a derecha y un destello dorado lo
   recorre cada pocos segundos. El destello usa el propio logo como máscara
   para iluminar solo sus trazos. */
function LogoAnam({ imgClassName, retraso = 0 }) {
  return (
    <motion.div
      className="ll-anam"
      initial={{ clipPath: 'inset(0 100% 0 0)', opacity: 0, scale: 0.94 }}
      animate={{ clipPath: 'inset(0 0% 0 0)', opacity: 1, scale: 1 }}
      transition={{ duration: 1.2, delay: retraso, ease: EASE_SALIDA }}
      whileHover={{ scale: 1.04 }}
    >
      <img src={logosImg} alt="SHCP — ANAM" className={imgClassName} />
      <motion.span
        className="ll-anam-shine"
        aria-hidden="true"
        style={{ WebkitMaskImage: `url(${logosImg})`, maskImage: `url(${logosImg})` }}
        initial={{ backgroundPosition: '220% 0%' }}
        animate={{ backgroundPosition: ['220% 0%', '-120% 0%'] }}
        transition={{ duration: 1.8, delay: retraso + 1.4, repeat: Infinity, repeatDelay: 5.5, ease: 'easeInOut' }}
      />
    </motion.div>
  )
}

/* Mensaje de error con entrada suave y un pequeño "sacudón" horizontal. */
function Alerta({ children }) {
  return (
    <AnimatePresence initial={false}>
      {children && (
        <motion.p
          key={children}
          className="login-error"
          role="alert"
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1, x: [0, -9, 8, -5, 3, 0] }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.3, ease: EASE_SALIDA, x: { duration: 0.5, ease: 'easeOut' } }}
        >
          {children}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

/* Botón principal: reacciona al hover y al clic salvo cuando está deshabilitado. */
function BotonEntrar({ disabled, children, ...props }) {
  return (
    <motion.button
      variants={variantesItem}
      className="btn-entrar"
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -2, scale: 1.015 }}
      whileTap={disabled ? undefined : { y: 0, scale: 0.975 }}
      {...props}
    >
      {children}
    </motion.button>
  )
}

/* Ojo de mostrar/ocultar contraseña con giro al alternar. */
function IconoOjo({ visible }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={visible ? 'oculto' : 'visible'}
        style={{ display: 'flex' }}
        initial={{ opacity: 0, scale: 0.5, rotate: -50 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        exit={{ opacity: 0, scale: 0.5, rotate: 50 }}
        transition={{ duration: 0.16 }}
      >
        {visible ? <EyeClose /> : <EyeOpen />}
      </motion.span>
    </AnimatePresence>
  )
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

  // Mantiene el login del mismo tamaño visual aunque se cambie el zoom del
  // navegador en PC: el zoom reduce el ancho del viewport en px CSS, así que se
  // compensa escalando respecto al ancho de diseño. En móvil no se escala.
  useEffect(() => {
    const raiz = document.documentElement
    const actualizar = () => {
      const w = window.innerWidth
      raiz.style.setProperty('--login-zoom', w > 768 ? Math.max(0.4, w / LOGIN_ANCHO_DISENO).toFixed(4) : '1')
    }
    actualizar()
    window.addEventListener('resize', actualizar)
    return () => {
      window.removeEventListener('resize', actualizar)
      raiz.style.removeProperty('--login-zoom')
    }
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

  /* ── Parallax del panel izquierdo ──
     El puntero (normalizado a -0.5…0.5 dentro del panel) alimenta valores de
     movimiento con resorte: el logo se inclina en 3D, el halo y el texto se
     desplazan a distinta profundidad y un foco de luz sigue al cursor. Se usan
     porcentajes del panel (no px) para que no les afecte el zoom del login. */
  const sinMovimiento = useReducedMotion()
  const panelRef = useRef(null)
  const punteroX = useMotionValue(0)
  const punteroY = useMotionValue(0)
  const resorteX = useSpring(punteroX, { stiffness: 80, damping: 16, mass: 0.7 })
  const resorteY = useSpring(punteroY, { stiffness: 80, damping: 16, mass: 0.7 })
  const logoX  = useTransform(resorteX, [-0.5, 0.5], [-14, 14])
  const logoY  = useTransform(resorteY, [-0.5, 0.5], [-14, 14])
  const logoRotY = useTransform(resorteX, [-0.5, 0.5], [-9, 9])
  const logoRotX = useTransform(resorteY, [-0.5, 0.5], [8, -8])
  const halo2X = useTransform(resorteX, [-0.5, 0.5], [22, -22])
  const halo2Y = useTransform(resorteY, [-0.5, 0.5], [22, -22])
  const textoX = useTransform(resorteX, [-0.5, 0.5], [-6, 6])
  const textoY = useTransform(resorteY, [-0.5, 0.5], [-4, 4])
  const focoX = useTransform(resorteX, v => `${(v + 0.5) * 100}%`)
  const focoY = useTransform(resorteY, v => `${(v + 0.5) * 100}%`)
  const focoOpacidad = useMotionValue(0)

  const moverPuntero = (e) => {
    if (sinMovimiento || e.pointerType === 'touch') return
    const r = panelRef.current?.getBoundingClientRect()
    if (!r || !r.width || !r.height) return
    punteroX.set((e.clientX - r.left) / r.width - 0.5)
    punteroY.set((e.clientY - r.top) / r.height - 0.5)
  }
  const entrarPuntero = (e) => {
    if (sinMovimiento || e.pointerType === 'touch') return
    animate(focoOpacidad, 1, { duration: 0.7 })
  }
  const salirPuntero = () => {
    animate(focoOpacidad, 0, { duration: 0.9 })
    punteroX.set(0)
    punteroY.set(0)
  }

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
        // Sin err.response (caída de red, backend inalcanzable) no hay forma
        // de saber si la contraseña era correcta — decir "Contraseña
        // incorrecta." ahí engañaba: el usuario reintentaba la MISMA
        // contraseña buena creyendo que estaba mal.
        setError(mensajeErrorConexion(err, 'Contraseña incorrecta.'))
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
      setError(mensajeErrorConexion(err, 'Error al procesar la contraseña.'))
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
  const renderStep = () => {
    /* ── Contraseña restablecida ── */
    if (recoveryOk) return (
      <div className="login-form" style={{ textAlign: 'center' }}>
        <motion.div
          variants={{ hidden: { opacity: 0, scale: 0.4 }, show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 16 } } }}
          style={{ margin: '0 auto 1rem', width: 52, height: 52, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', border: '1.5px solid rgba(74,222,128,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round">
            <motion.path
              d="M20 6L9 17l-5-5"
              variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { duration: 0.5, delay: 0.25, ease: EASE_SALIDA } } }}
            />
          </svg>
        </motion.div>
        <motion.p variants={variantesItem} className="lf-step-info">Tu contraseña fue restablecida exitosamente.</motion.p>
        <BotonEntrar onClick={() => { resetAll(); setStep(STEP_PASS) }}>
          Iniciar sesión
        </BotonEntrar>
      </div>
    )

    if (step === STEP_EMAIL) return (
      <form className="login-form" onSubmit={handleEmail} noValidate>
        <motion.div variants={variantesItem} className="lf-group">
          <label htmlFor="login-email">Correo Institucional</label>
          {/* Mismo campo dividido (usuario + dominio fijo) en PC y móvil —
              antes solo aparecía en móvil; en desktop había que teclear el
              "@anam.gob.mx" a mano. */}
          <div className="lf-email-mobile-wrap">
            <input
              id="login-email"
              readOnly={loading}
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
        </motion.div>
        <Alerta>{error}</Alerta>
        <BotonEntrar type="submit" disabled={loading || !email.trim()}>
          {loading ? 'Verificando…' : 'Continuar'}
        </BotonEntrar>
      </form>
    )

    if (step === STEP_PASS) return (
      <form className="login-form" onSubmit={handlePassword} noValidate>
        <motion.div variants={variantesItem} className="lf-email-locked">
          <span>{email}</span>
          <button type="button" className="lf-cambiar" onClick={() => { track({ componente: 'LOGIN_PASSWORD_STEP', accion: 'NAVIGATE', metadatos: { control: 'cambiar_correo' } }); setStep(STEP_EMAIL); setError(''); setPassword(''); setPassBloqueadoHasta(0) }}>
            Cambiar
          </button>
        </motion.div>
        {/* Input oculto (no display:none/visibility:hidden — algunos
            gestores de contraseñas los ignoran) con autoComplete="username":
            el correo se pidió en el paso anterior, en otro <form>, así que
            sin esto el navegador no tiene con qué asociar la contraseña de
            este formulario y no ofrece guardar el par correo+contraseña en
            su gestor (cifrado por el SO, no accesible por JS/XSS) — la
            forma segura de "recordar la contraseña". */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden tabIndex={-1} aria-hidden="true" />
        <motion.div variants={variantesItem} className="lf-group">
          <label htmlFor="login-pass">Contraseña</label>
          <div className="lf-pass-wrap">
            <input
              id="login-pass"
              readOnly={loading}
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              autoFocus
            />
            <motion.button type="button" className="lf-eye" onClick={() => setShowPass(v => !v)} tabIndex={-1} whileTap={{ scale: 0.8 }}>
              <IconoOjo visible={showPass} />
            </motion.button>
          </div>
        </motion.div>
        <Alerta>{error}</Alerta>
        <motion.div variants={variantesItem} className="login-opts">
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
        </motion.div>
        <BotonEntrar type="submit" disabled={loading || !password || passBloqueoRestante > 0}>
          {loading
            ? 'Verificando…'
            : passBloqueoRestante > 0
              ? `Espera ${String(Math.floor(passBloqueoRestante / 60)).padStart(2, '0')}:${String(passBloqueoRestante % 60).padStart(2, '0')}`
              : 'Entrar'}
        </BotonEntrar>
      </form>
    )

    if (step === STEP_OTP) return (
      <form className="login-form" onSubmit={handleOtp} noValidate>
        <motion.p variants={variantesItem} className="lf-step-info">
          {isRecovery
            ? <>Enviamos un código de recuperación a <strong>{email}</strong>.</>
            : <>Enviamos un código de 6 dígitos a <strong>{email}</strong>. Revisa tu bandeja.</>
          }
        </motion.p>
        <motion.div variants={variantesItem} className="lf-group lf-group-otp">
          <label htmlFor="login-otp">Código de verificación</label>
          <input
            id="login-otp"
            readOnly={loading}
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
        </motion.div>
        <Alerta>{error}</Alerta>
        {reenvioMsg && (
          <motion.p
            key={reenvioMsg}
            className="lf-resend-ok"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: EASE_SALIDA }}
          >
            {reenvioMsg}
          </motion.p>
        )}
        <BotonEntrar type="submit" disabled={loading || otp.length < 6}>
          {loading ? 'Verificando…' : 'Verificar código'}
        </BotonEntrar>
        <motion.div variants={variantesItem} className="lf-actions-row">
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
        </motion.div>
      </form>
    )

    if (step === STEP_NEWPASS) return (
      <form className={`login-form${isRecovery ? ' login-form-recovery' : ''}`} onSubmit={handleNewPass} noValidate>
        <motion.p variants={variantesItem} className="lf-step-info">
          {(cambioObligatorio || user?.requiereCambioContrasena)
            ? 'Por seguridad, reemplaza la contraseña temporal antes de entrar al sistema.'
            : isRecovery ? 'Elige tu nueva contraseña.' : 'Elige una contraseña segura para activar tu cuenta.'}
        </motion.p>
        {/* Mismo motivo que en el paso de contraseña: sin un campo de
            usuario en este <form>, el navegador no puede ofrecer guardar
            (o actualizar) la contraseña en su gestor. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden tabIndex={-1} aria-hidden="true" />
        {(cambioObligatorio || user?.requiereCambioContrasena) && (
          <motion.div variants={variantesItem} className="lf-group">
            <label htmlFor="login-temp-pass">Contraseña temporal</label>
            <div className="lf-pass-wrap">
              <input
                id="login-temp-pass"
                readOnly={loading}
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                autoFocus={!password}
              />
            </div>
          </motion.div>
        )}
        <motion.div variants={variantesItem} className="lf-group">
          <label htmlFor="login-np">{(isRecovery || cambioObligatorio || user?.requiereCambioContrasena) ? 'Nueva contraseña' : 'Contraseña'}</label>
          <div className="lf-pass-wrap">
            <input
              id="login-np"
              readOnly={loading}
              type={showPass ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              required
              autoComplete="new-password"
              autoFocus={!(cambioObligatorio || user?.requiereCambioContrasena) || Boolean(password)}
            />
            <motion.button type="button" className="lf-eye" onClick={() => setShowPass(v => !v)} tabIndex={-1} whileTap={{ scale: 0.8 }}>
              <IconoOjo visible={showPass} />
            </motion.button>
          </div>
        </motion.div>
        <motion.div variants={variantesItem} className="lf-group">
          <label htmlFor="login-cp">Confirmar contraseña</label>
          <input
            id="login-cp"
            readOnly={loading}
            type={showPass ? 'text' : 'password'}
            placeholder="Repite la contraseña"
            value={confirmPass}
            onChange={e => setConfirmPass(e.target.value)}
            required
            autoComplete="new-password"
          />
        </motion.div>
        <Alerta>{error}</Alerta>
        <BotonEntrar type="submit" disabled={loading || !newPass || !confirmPass}>
          {loading
            ? ((isRecovery || cambioObligatorio || user?.requiereCambioContrasena) ? 'Guardando…' : 'Creando cuenta…')
            : ((cambioObligatorio || user?.requiereCambioContrasena)
              ? 'Guardar nueva contraseña y entrar'
              : isRecovery ? 'Restablecer contraseña' : 'Crear cuenta y entrar')
          }
        </BotonEntrar>
        {(cambioObligatorio || user?.requiereCambioContrasena) && (
          <motion.div variants={variantesItem} className="lf-actions-row">
            <button
              type="button"
              className="lf-link"
              data-analytics-event="INTERACTION"
              data-analytics-component="LOGIN_USAR_OTRA_CUENTA"
              onClick={() => logout()}
            >
              Usar otra cuenta
            </button>
          </motion.div>
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
    <MotionConfig reducedMotion="user">
    <div className="login-wrap">

      {/* ── Panel izquierdo ── */}
      <motion.div
        className="login-left"
        ref={panelRef}
        onPointerMove={moverPuntero}
        onPointerEnter={entrarPuntero}
        onPointerLeave={salirPuntero}
        initial={{ opacity: 0, x: -80 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, ease: EASE_SALIDA }}
      >
        <motion.div className="ll-spotlight" aria-hidden="true" style={{ left: focoX, top: focoY, opacity: focoOpacidad }} />

        <div className="ll-brand">
          <LogoAnam imgClassName="ll-brand-img" retraso={0.3} />
        </div>
        <div className="ll-sphere ll-sphere-a" />
        <div className="ll-sphere ll-sphere-b" />

        <div className="ll-center-block">
          <motion.div
            className="ll-logo-scs-wrap"
            initial={{ opacity: 0, scale: 0.5, rotate: -14 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.45, opacity: { duration: 0.8 }, default: { type: 'spring', stiffness: 70, damping: 12 } }}
            style={{ x: logoX, y: logoY, rotateX: logoRotX, rotateY: logoRotY, transformPerspective: 900 }}
          >
            <motion.div
              className="ll-logo-scs-ring"
              style={{ x: halo2X, y: halo2Y }}
              initial={{ scale: 0.4 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1.6, delay: 0.7, ease: EASE_SALIDA }}
            />
            <img src="/Logo SCS 2026_1.png" alt="SCS 2026" className="ll-logo-scs" />
          </motion.div>
          <motion.div className="ll-hero" style={{ x: textoX, y: textoY }}>
            <p className="ll-sub" aria-label="Agencia Nacional de Aduanas de México">
              <Letras texto="Agencia Nacional de Aduanas de México" retraso={1.1} paso={0.022} desenfoque />
            </p>
            <h1 className="ll-title" aria-label={TITULO_SISTEMA}>
              <Letras texto={TITULO_SISTEMA} retraso={1.35} paso={0.035} mascara />
            </h1>
            <motion.div
              className="ll-title-rule"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 120, opacity: 1 }}
              transition={{ duration: 0.9, delay: 2.3, ease: EASE_SALIDA }}
            />
          </motion.div>
        </div>
        <div className="ll-dots" />
        <div className="ll-sphere ll-sphere-c" />
        <div className="ll-sphere ll-sphere-d" />
        <motion.div
          className="ll-beige-strip"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          style={{ originX: 0 }}
          transition={{ duration: 1.1, delay: 0.1, ease: [0.65, 0, 0.35, 1] }}
        />
      </motion.div>

      {/* ── Panel derecho ── */}
      <div className="login-right">

        <motion.div
          className="login-mobile-brand"
          initial={{ opacity: 0, y: -28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_SALIDA }}
        >
          <LogoAnam imgClassName="login-mobile-logo" retraso={0.3} />
          <span className="login-mobile-sys">Sistema de Control de Solicitudes</span>
        </motion.div>

        <motion.div
          className="login-card"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: EASE_SALIDA }}
        >
          {showStepIndicator && (
            <div className="lf-steps">
              <motion.span className="lf-step-dot lf-step-done" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }} />
              <motion.span className="lf-step-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} style={{ originX: 0 }} transition={{ duration: 0.4, delay: 0.1 }} />
              <motion.span className={`lf-step-dot ${step === STEP_NEWPASS ? 'lf-step-done' : 'lf-step-active'}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.2 }} />
              <motion.span className="lf-step-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} style={{ originX: 0 }} transition={{ duration: 0.4, delay: 0.3 }} />
              <motion.span className={`lf-step-dot ${step === STEP_NEWPASS ? 'lf-step-active' : ''}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.4 }} />
            </div>
          )}

          <div className="login-card-header">
            <motion.h2
              key={recoveryOk ? 'listo' : titles[step]}
              className="login-welcome"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE_SALIDA }}
            >
              {recoveryOk ? '¡Listo!' : titles[step]}
            </motion.h2>
            {!recoveryOk && (step === STEP_EMAIL || step === STEP_PASS) && (
              <p className="login-personal-message">
                Ingresa tus credenciales para continuar en tu espacio de trabajo.
              </p>
            )}
          </div>

          {/* La key reinicia la entrada escalonada en cada cambio de paso. */}
          <motion.div
            key={recoveryOk ? 'recovery-ok' : step}
            variants={variantesPaso}
            initial="hidden"
            animate="show"
          >
            {renderStep()}
          </motion.div>

          <motion.div className="ll-bottom-icons" variants={variantesIconos} initial="hidden" animate="show">
            <motion.div className="ll-bottom-icon" variants={variantesIcono} whileHover={{ y: -4, scale: 1.1 }} whileTap={{ scale: 0.92 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </motion.div>
            <motion.div className="ll-bottom-icon" variants={variantesIcono} whileHover={{ y: -4, scale: 1.1 }} whileTap={{ scale: 0.92 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </motion.div>
            <motion.div className="ll-bottom-icon" variants={variantesIcono} whileHover={{ y: -4, scale: 1.1 }} whileTap={{ scale: 0.92 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </motion.div>
          </motion.div>

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
        </motion.div>
      </div>
    </div>
    </MotionConfig>
  )
}
