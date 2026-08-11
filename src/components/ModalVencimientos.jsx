import { createPortal } from 'react-dom'
import { useModalBehavior } from '../hooks/useModalBehavior'
import './Comisionado/Comisionado.css'
import '../pages/DashboardROL1.css'
import './ModalVencimientos.css'

export default function ModalVencimientos({ vencimientos, onClose, onSelect }) {
  useModalBehavior(onClose)

  return createPortal(
    <div className="com-overlay" role="dialog" aria-modal="true" aria-label="Todos mis vencimientos" onClick={onClose}>
      <div className="com-modal mvc-modal" onClick={e => e.stopPropagation()}>
        <div className="com-modal-top">
          <h3>Todos mis vencimientos</h3>
          <button type="button" className="com-modal-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="mvc-body">
          {vencimientos.length === 0 ? (
            <p className="dash-empty">No tienes más vencimientos además de los que ya se muestran.</p>
          ) : (
            vencimientos.map(v => (
              <div
                key={v.id}
                className="venc-item venc-item-clickable"
                onClick={() => onSelect(v.folio)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && onSelect(v.folio)}
              >
                <div className={`venc-icon venc-icon--${v.tipo}`}>{v.icon}</div>
                <div className="venc-texto">
                  <div className="venc-folio">{v.folio}</div>
                  <div className="venc-fecha">{v.asunto}</div>
                </div>
                <span className={`venc-badge venc-badge--${v.tipo}`}>{v.badge}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
