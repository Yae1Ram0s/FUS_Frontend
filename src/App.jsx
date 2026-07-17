import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }          from './context/AuthContext'
import { NotificacionesProvider } from './context/NotificacionesContext'
import { ToastProvider }          from './context/ToastContext'
import PrivateRoute               from './components/PrivateRoute'
import ErrorBoundary              from './components/ErrorBoundary'
import NotFound                   from './pages/NotFound'

import './context/Toast.css'

import Login               from './pages/Login'
import DashboardROL1       from './pages/DashboardROL1'
import DashboardROL2       from './pages/DashboardROL2'
import ConsultarFUS        from './pages/ConsultarFUS'
import RegistrarFUS        from './pages/RegistrarFUS'
import SolicitudesTurnadas from './pages/SolicitudesTurnadas'
import Bitacora            from './pages/Bitacora'
import PanelAdmin          from './pages/PanelAdmin'
import CalendarioActividades from './pages/CalendarioActividades'
import FUSComisionados     from './pages/FUSComisionados'

export default function App() {
  // --app-vh: alto real de viewport visible (excluye barras dinámicas del navegador
  // móvil). Lo usan los modales (.modal-card, .bita-modal-preview, .mdet-modal) en vez
  // de vh/dvh para no quedar cortados/descentrados en Safari iOS y webviews.
  useEffect(() => {
    const setAppVh = () => {
      document.documentElement.style.setProperty('--app-vh', `${window.innerHeight}px`)
    }
    setAppVh()
    window.addEventListener('resize', setAppVh)
    window.visualViewport?.addEventListener('resize', setAppVh)
    return () => {
      window.removeEventListener('resize', setAppVh)
      window.visualViewport?.removeEventListener('resize', setAppVh)
    }
  }, [])

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <NotificacionesProvider>
            <ToastProvider>
              <Routes>
                {/* Pública */}
                <Route path="/login" element={<Login />} />

                {/* ROL1 — Particular del Titular (rol 4 "Equipo del Particular" comparte estas mismas pantallas) */}
                <Route element={<PrivateRoute roles={['ROL1', 'EQUIPO_PARTICULAR']} />}>
                  <Route path="/rol1/consultar-fus" element={<ConsultarFUS />} />
                  <Route path="/rol1/registrar-fus" element={<RegistrarFUS />} />
                  <Route path="/rol1/bitacora"       element={<Bitacora />} />
                  <Route path="/rol1/dashboard"      element={<DashboardROL1 />} />
                  <Route path="/rol1/calendario"     element={<CalendarioActividades />} />
                </Route>

                {/* ROL1 — administración de usuarios/accesos (rol 4 no tiene acceso) */}
                <Route element={<PrivateRoute roles={['ROL1']} />}>
                  <Route path="/rol1/panel" element={<PanelAdmin />} />
                </Route>

                {/* ROL2 — Titular / Enlace Estratégico */}
                <Route element={<PrivateRoute roles={['ROL2']} />}>
                  <Route path="/rol2/solicitudes" element={<SolicitudesTurnadas />} />
                  <Route path="/rol2/bitacora"    element={<Bitacora />} />
                  <Route path="/rol2/dashboard"   element={<DashboardROL2 />} />
                  <Route path="/rol2/calendario"  element={<CalendarioActividades />} />
                </Route>

                {/* COMISIONADO */}
                <Route element={<PrivateRoute roles={['COMISIONADO']} />}>
                  <Route path="/comisionado/calendario"       element={<CalendarioActividades />} />
                  <Route path="/comisionado/fus-comisionados" element={<FUSComisionados />} />
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
