import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './Spinner'
import { rutaInicioPorRol } from '../utils/rutas'

export default function PrivateRoute({ roles }) {
  const { user, cargando } = useAuth()
  // Mismo texto que el fallback de <Suspense> en App.jsx a propósito: esta
  // pantalla (validar la sesión) y la siguiente (descargar el chunk de la
  // ruta, que ni siquiera arranca hasta que esta termina — Outlet no se
  // renderiza mientras cargando=true) son secuenciales pero para el usuario
  // deben verse como una sola carga continua, no dos mensajes distintos uno
  // atrás del otro (se leía como si algo hubiera fallado a medio camino).
  if (cargando) return <Spinner label="Cargando…" />
  if (!user) return <Navigate to="/login" replace />
  if (user.requiereCambioContrasena) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.rol)) {
    return <Navigate to={rutaInicioPorRol(user.rol)} replace />
  }
  return <Outlet />
}
