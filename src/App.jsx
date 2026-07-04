import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }          from './context/AuthContext'
import { NotificacionesProvider } from './context/NotificacionesContext'
import { ToastProvider }          from './context/ToastContext'
import PrivateRoute               from './components/PrivateRoute'
import ErrorBoundary              from './components/ErrorBoundary'
import NotFound                   from './pages/NotFound'

import './context/Toast.css'

import Login               from './pages/Login'
import ConsultarFUS        from './pages/ConsultarFUS'
import RegistrarFUS        from './pages/RegistrarFUS'
import SolicitudesTurnadas from './pages/SolicitudesTurnadas'
import Bitacora            from './pages/Bitacora'
import PanelAdmin          from './pages/PanelAdmin'

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <NotificacionesProvider>
            <ToastProvider>
              <Routes>
                {/* Pública */}
                <Route path="/login" element={<Login />} />

                {/* ROL1 — Particular del Titular */}
                <Route element={<PrivateRoute roles={['ROL1']} />}>
                  <Route path="/rol1/consultar-fus" element={<ConsultarFUS />} />
                  <Route path="/rol1/registrar-fus" element={<RegistrarFUS />} />
                  <Route path="/rol1/bitacora"       element={<Bitacora />} />
                  <Route path="/rol1/panel"          element={<PanelAdmin />} />
                  <Route path="/rol1/dashboard"      element={<Navigate to="/rol1/consultar-fus" replace />} />
                </Route>

                {/* ROL2 — Titular / Enlace Estratégico */}
                <Route element={<PrivateRoute roles={['ROL2']} />}>
                  <Route path="/rol2/solicitudes" element={<SolicitudesTurnadas />} />
                  <Route path="/rol2/bitacora"    element={<Bitacora />} />
                </Route>

                {/* Raíz → login */}
                <Route path="/"  element={<Navigate to="/login" replace />} />
                <Route path="*"  element={<NotFound />} />
              </Routes>
            </ToastProvider>
          </NotificacionesProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
