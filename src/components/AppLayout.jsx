import { useRef } from 'react'
import { motion, MotionConfig } from 'motion/react'
import Header from './Header'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import NotifBrowserPrompt from './NotifBrowserPrompt'
import BorradorFUSPrompt from './BorradorFUSPrompt'
import useRevelarContenido from '../hooks/useRevelarContenido'
import './AppLayout.css'

export default function AppLayout({ children, mainClass = '' }) {
  const mainRef = useRef(null)
  // Tarjetas, KPIs, paneles y filas de cualquier módulo entran escalonadas.
  useRevelarContenido(mainRef)

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-wrap">
        <Header />
        <div className="app-body">
          <Sidebar />
          <motion.main
            ref={mainRef}
            className={`app-main ${mainClass}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            {children}
          </motion.main>
        </div>
        <BottomNav />
        <NotifBrowserPrompt />
        <BorradorFUSPrompt />
      </div>
    </MotionConfig>
  )
}
