import { useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import NotifBrowserPrompt from './NotifBrowserPrompt'
import './AppLayout.css'

export default function AppLayout({ children, mainClass = '' }) {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768)

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="app-wrap">
      <Header onMenuClick={() => setSidebarOpen(o => !o)} />
      <div className="app-body">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={closeSidebar}
          onToggle={() => setSidebarOpen(o => !o)}
        />
        {sidebarOpen && (
          <div className="sidebar-overlay" onClick={closeSidebar} aria-hidden="true" />
        )}
        <main className={`app-main ${mainClass}`}>{children}</main>
      </div>
      <BottomNav />
      <NotifBrowserPrompt />
    </div>
  )
}
