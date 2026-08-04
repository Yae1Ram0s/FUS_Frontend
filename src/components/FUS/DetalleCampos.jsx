import EvidenciaItem from './EvidenciaItem'

export function CampoDetalle({ label, value, tall = false }) {
  return (
    <div className={`det-row${tall ? ' det-row-tall' : ''}`}>
      <span className="det-label">{label}</span>
      <span className="det-value">{value || '—'}</span>
    </div>
  )
}

export function ListaEvidencias({ evidencias }) {
  if (!evidencias?.length) {
    return <CampoDetalle label="Evidencia" value="—" />
  }

  return (
    <div className="det-row det-row-evidencia">
      <span className="det-label">Evidencia</span>
      <div className="ev-lista">
        {evidencias.map(evidencia => (
          <EvidenciaItem key={evidencia.id} evidencia={evidencia} />
        ))}
      </div>
    </div>
  )
}
