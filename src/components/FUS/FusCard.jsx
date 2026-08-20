import Badge from '../Badge'
import { formatearFechaHora } from '../../utils/fechas'
import { FolioTexto } from '../../utils/folio'
import { truncarTexto } from '../../utils/texto'

export default function FusCard({ fus, activo, onClick, highlight, onVerHistorial }) {
  const handleKeyDown = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className={`fus-card${activo ? ' fus-card-activo' : ''}${highlight ? ' fus-card-highlight' : ''}${fus.slaVencido ? ' fus-card-vencido' : ''}${!fus.slaVencido && fus.slaPorVencer ? ' fus-card-por-vencer' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="fus-card-top">
        <strong className="fus-folio"><FolioTexto folio={fus.folio} /></strong>
        <span className="fus-card-badges">
          <Badge estatus={fus.estatusVisual || fus.estatusParticular} />
          {fus.estadoTemporalidad && <Badge estatus={fus.estadoTemporalidad} />}
        </span>
      </div>
      <p className="fus-meta">
        <span className="fus-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          {formatearFechaHora(fus.fechaHora)}
        </span>
        <span className="fus-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="m22 7-10 6L2 7"/>
          </svg>
          {fus.idMedioRecepcion?.nombreMedio || '—'}
        </span>
      </p>
      {fus.descripcion && <p className="fus-desc">{truncarTexto(fus.descripcion)}</p>}
      <button
        className="fus-card-historial-btn"
        title="Ver historial"
        aria-label={`Ver historial de ${fus.folio}`}
        onClick={event => {
          event.stopPropagation()
          onVerHistorial()
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 3-6.7"/>
          <path d="M3 5v4h4"/>
          <polyline points="12 7 12 12 15.5 14"/>
        </svg>
      </button>
    </div>
  )
}
