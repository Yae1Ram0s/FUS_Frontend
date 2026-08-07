import Header from './Header'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import NotifBrowserPrompt from './NotifBrowserPrompt'
import BorradorFUSPrompt from './BorradorFUSPrompt'
import './AppLayout.css'

export default function AppLayout({ children, mainClass = '' }) {
  return (
    <div className="app-wrap">
      <Header />
      <div className="app-body">
        <Sidebar />
        <main className={`app-main ${mainClass}`}>{children}</main>
      </div>
      <BottomNav />
      <NotifBrowserPrompt />
      <BorradorFUSPrompt />
    </div>
  )
}
