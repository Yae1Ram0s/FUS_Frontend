import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient }            from './queryClient'
import { AuthProvider }          from './context/AuthContext'
import { NotificacionesProvider } from './context/NotificacionesContext'
import { ToastProvider }          from './context/ToastContext'
import PrivateRoute               from './components/PrivateRoute'
import ErrorBoundary              from './components/ErrorBoundary'
import Spinner                    from './components/Spinner'
import BannerSinConexion          from './components/BannerSinConexion'

import './context/Toast.css'

const Login = lazy(() => import('./pages/Login'))
const DashboardROL1 = lazy(() => import('./pages/DashboardROL1'))
const DashboardROL2 = lazy(() => import('./pages/DashboardROL2'))
const ConsultarFUS = lazy(() => import('./pages/ConsultarFUS'))
const RegistrarFUS = lazy(() => import('./pages/RegistrarFUS'))
const SolicitudesTurnadas = lazy(() => import('./pages/SolicitudesTurnadas'))
const Bitacora = lazy(() => import('./pages/Bitacora'))
const PanelAdmin = lazy(() => import('./pages/PanelAdmin'))
const CalendarioActividades = lazy(() => import('./pages/CalendarioActividades'))
const FUSComisionados = lazy(() => import('./pages/FUSComisionados'))
const Reportes = lazy(() => import('./pages/Reportes'))
const ReportesROL2 = lazy(() => import('./pages/ReportesROL2'))
const NotFound = lazy(() => import('./pages/NotFound'))
const AdminDashboard = lazy(() => import('./features/system-admin/pages/AdminDashboard'))
const AdminUsuarios = lazy(() => import('./features/system-admin/pages/AdminUsuarios'))
const AdminSalud = lazy(() => import('./features/system-admin/pages/AdminSalud'))
const AdminAuditoria = lazy(() => import('./features/system-admin/pages/AdminAuditoria'))
const AdminOTP = lazy(() => import('./features/system-admin/pages/AdminOTP'))

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
        <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificacionesProvider>
            <ToastProvider>
              <BannerSinConexion />
              <Suspense fallback={<Spinner label="Cargando módulo…" />}>
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
                  <Route path="/rol1/reportes"       element={<Reportes />} />
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
                  <Route path="/rol2/reportes"    element={<ReportesROL2 />} />
                </Route>

                {/* COMISIONADO */}
                <Route element={<PrivateRoute roles={['COMISIONADO']} />}>
                  <Route path="/comisionado/calendario"       element={<CalendarioActividades />} />
                  <Route path="/comisionado/fus-comisionados" element={<FUSComisionados />} />
                  <Route path="/comisionado/bitacora"         element={<Bitacora />} />
                </Route>

                {/* ADMIN — administración técnica, sin funciones operativas FUS */}
                <Route element={<PrivateRoute roles={['ADMIN']} />}>
                  <Route path="/admin/inicio" element={<AdminDashboard />} />
                  <Route path="/admin/usuarios" element={<AdminUsuarios />} />
                  <Route path="/admin/salud" element={<AdminSalud />} />
                  <Route path="/admin/auditoria" element={<AdminAuditoria />} />
                  <Route path="/admin/otp" element={<AdminOTP />} />
                </Route>

                {/* Raíz → login */}
                <Route path="/"  element={<Navigate to="/login" replace />} />
                <Route path="*"  element={<NotFound />} />
                </Routes>
              </Suspense>
            </ToastProvider>
          </NotificacionesProvider>
        </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
