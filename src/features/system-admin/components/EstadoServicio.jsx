import { useState } from 'react'

const etiquetas = { operativo: 'Operativo', advertencia: 'Advertencia', error: 'Error', sin_comprobar: 'Sin comprobar' }

export default function EstadoServicio({
  nombre,
  estado = 'sin_comprobar',
  detalle,
  latencia,
  diagnostico,
  impacto,
  recomendacion,
  codigo,
  comprobaciones = [],
}) {
  const [abierto, setAbierto] = useState(false)
  const clave = String(estado || 'sin_comprobar').toLowerCase().replaceAll(' ', '_')
  const tieneDiagnostico = Boolean(diagnostico || impacto || recomendacion || codigo || comprobaciones.length)
  const diagnosticoId = `diagnostico-${nombre.replaceAll(' ', '-').toLowerCase()}`

  return (
    <article className={`sa-service sa-service--${clave}${abierto ? ' is-open' : ''}`}>
      <div className="sa-service__summary">
        <span className={`sa-status-dot sa-status-dot--${clave}`} aria-hidden="true" />
        <div className="sa-service__identity">
          <strong>{nombre}</strong>
          <small>{detalle || 'Sin información disponible'}</small>
        </div>
        <div className="sa-service__status">
          <span className={`sa-badge sa-badge--${clave}`}>{etiquetas[clave] || estado}</span>
          {latencia != null && <small className="sa-service__latency">{latencia} ms</small>}
        </div>
        {tieneDiagnostico && (
          <button
            type="button"
            className="sa-service__toggle"
            aria-expanded={abierto}
            aria-controls={diagnosticoId}
            onClick={() => setAbierto(valor => !valor)}
            data-analytics-event="INTERACTION"
            data-analytics-component="ADMIN_SALUD_SERVICIO_DETALLE"
            data-analytics-action="OPEN"
          >
            {abierto ? 'Ocultar detalle' : 'Ver detalle'}
            <span aria-hidden="true">{abierto ? '⌃' : '⌄'}</span>
          </button>
        )}
      </div>

      {tieneDiagnostico && abierto && (
        <div id={diagnosticoId} className="sa-service__diagnostic">
          <div className="sa-service__diagnostic-heading">
            <span aria-hidden="true">!</span>
            <div>
              <strong>¿Qué está pasando?</strong>
              {diagnostico && <p>{diagnostico}</p>}
            </div>
          </div>
          <div className="sa-service__diagnostic-grid">
            {impacto && <div><small>Impacto posible</small><p>{impacto}</p></div>}
            {recomendacion && <div><small>Acción recomendada</small><p>{recomendacion}</p></div>}
          </div>
          {!!comprobaciones.length && (
            <dl className="sa-service__checks">
              {comprobaciones.map(item => (
                <div key={`${item.etiqueta}-${item.valor}`}>
                  <dt>{item.etiqueta}</dt>
                  <dd>{item.valor}</dd>
                </div>
              ))}
            </dl>
          )}
          {codigo && <small className="sa-service__code">Referencia técnica: {codigo}</small>}
        </div>
      )}
    </article>
  )
}
