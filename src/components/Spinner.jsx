import './Spinner.css'

export default function Spinner({ label }) {
  return (
    <div className="spinner-overlay">
      <div className="spinner">
        <span /><span /><span /><span />
        <span /><span /><span /><span />
      </div>
      {label && <span className="spinner-label">{label}</span>}
    </div>
  )
}
