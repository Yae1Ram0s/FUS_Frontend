import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import './DashboardROL1.css'

function CardMenu({ icono, label, onClick }) {
  return (
    <button className="card-menu" onClick={onClick}>
      <div className="card-icon">{icono}</div>
      <span className="card-label">{label}</span>
    </button>
  )
}

export default function DashboardROL1() {
  const navigate = useNavigate()
  return (
    <div className="dash-wrap">
      <Header />
      <main className="dash-main">
        <CardMenu
          icono={
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="10" y="6" width="28" height="36" rx="3"/>
              <rect x="16" y="14" width="6" height="6" rx="1"/>
              <line x1="24" y1="16" x2="34" y2="16"/>
              <rect x="16" y="22" width="6" height="6" rx="1"/>
              <line x1="24" y1="24" x2="34" y2="24"/>
              <rect x="16" y="30" width="6" height="6" rx="1"/>
              <line x1="24" y1="32" x2="34" y2="32"/>
              <path d="M22 2h4a2 2 0 0 1 2 2v2H20V4a2 2 0 0 1 2-2z"/>
            </svg>
          }
          label="CONSULTAR FUS"
          onClick={() => navigate('/rol1/consultar-fus')}
        />
        <CardMenu
          icono={
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="10" y="6" width="28" height="36" rx="3"/>
              <rect x="16" y="14" width="6" height="6" rx="1"/>
              <line x1="24" y1="16" x2="34" y2="16"/>
              <rect x="16" y="22" width="6" height="6" rx="1"/>
              <line x1="24" y1="24" x2="34" y2="24"/>
              <path d="M22 2h4a2 2 0 0 1 2 2v2H20V4a2 2 0 0 1 2-2z"/>
              <path d="M30 36l6-6-2-2-6 6v2h2z" fill="currentColor" stroke="none"/>
              <path d="M32 28l2 2" strokeLinecap="round"/>
            </svg>
          }
          label="REGISTRAR FUS"
          onClick={() => navigate('/rol1/registrar-fus')}
        />
      </main>
    </div>
  )
}
