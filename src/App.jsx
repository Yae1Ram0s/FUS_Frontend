import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificacionesProvider } from './context/NotificacionesContext'
import PrivateRoute from './components/PrivateRoute'

import Login               from './pages/Login'
import ConsultarFUS        from './pages/ConsultarFUS'
import RegistrarFUS        from './pages/RegistrarFUS'
import SolicitudesTurnadas from './pages/SolicitudesTurnadas'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificacionesProvider>
        <Routes>
          {/* Pública */}
          <Route path="/login" element={<Login />} />

          {/* ROL1 — Particular del Titular */}
          <Route element={<PrivateRoute roles={['ROL1']} />}>
            <Route path="/rol1/consultar-fus" element={<ConsultarFUS />} />
            <Route path="/rol1/registrar-fus" element={<RegistrarFUS />} />
            {/* Compatibilidad con la ruta anterior del dashboard */}
            <Route path="/rol1/dashboard" element={<Navigate to="/rol1/consultar-fus" replace />} />
          </Route>

          {/* ROL2 — Titular / Enlace Estratégico */}
          <Route element={<PrivateRoute roles={['ROL2']} />}>
            <Route path="/rol2/solicitudes" element={<SolicitudesTurnadas />} />
          </Route>

          {/* Raíz → login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </NotificacionesProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
