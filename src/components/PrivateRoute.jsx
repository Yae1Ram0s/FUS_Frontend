import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './Spinner'

export default function PrivateRoute({ roles }) {
  const { user, cargando } = useAuth()
  if (cargando) return <Spinner label="Restaurando sesión…" />
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.rol)) return <Navigate to="/login" replace />
  return <Outlet />
}
