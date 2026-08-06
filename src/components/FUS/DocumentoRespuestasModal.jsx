import { createPortal } from 'react-dom'
import { useModalBehavior } from '../../hooks/useModalBehavior'
import '../Comisionado/Comisionado.css'
import './DocumentoRespuestasModal.css'

const TIPO_SEGUIMIENTO = {
  accion_por_emprender: { label: 'Acción', clase: 'fc-tag-azul' },
  avance: { label: 'Respuesta', clase: 'fc-tag-verde' },
  finalizacion: { label: 'Respuesta', clase: 'fc-tag-verde' },
  rechazo: { label: 'Rechazo', clase: 'fc-tag-rojo' },
}
const TIPO_POR_DEFECTO = { label: 'Respuesta', clase: 'fc-tag-verde' }

/* Agrupa la lista (ya viene ordenada cronológicamente) por el día calendario
   de fechaRegistro — siempre presente (auto_now_add), a diferencia de
   fechaActividad, que es opcional y puede faltar en algunas respuestas. */
function agruparPorFecha(respuestas) {
  const grupos = []
  for (const respuesta of respuestas) {
    const clave = respuesta.fechaRegistro
      ? new Date(respuesta.fechaRegistro).toLocaleDateString('es-MX', {
          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        })
      : 'Sin fecha'
    const grupo = grupos.at(-1)
    if (grupo?.clave === clave) grupo.items.push(respuesta)
    else grupos.push({ clave, items: [respuesta] })
  }
  return grupos
}

export default function DocumentoRespuestasModal({
  respuestas,
  onClose,
  titulo = 'Respuestas del FUS',
  mensajeVacio = 'Este FUS aún no cuenta con respuestas registradas.',
}) {
  useModalBehavior(onClose)
  const grupos = agruparPorFecha(respuestas)

  return createPortal(
    <div className="com-overlay" role="dialog" aria-modal="true" aria-label={titulo} onClick={onClose}>
      <div className="com-modal com-modal-respuestas" onClick={e => e.stopPropagation()}>
        <div className="com-modal-top">
          <h3>{titulo}</h3>
          <button type="button" className="com-modal-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="drm-lista">
          {respuestas.length ? (
            grupos.map(grupo => (
              <div key={grupo.clave} className="drm-grupo">
                <span className="drm-grupo-fecha">{grupo.clave}</span>
                <div className="act-tl">
                  {grupo.items.map((respuesta, index) => {
                    const tipo = TIPO_SEGUIMIENTO[respuesta.tipo] || TIPO_POR_DEFECTO
                    const hora = respuesta.fechaRegistro
                      ? new Date(respuesta.fechaRegistro).toLocaleTimeString('es-MX', {
                          hour: '2-digit', minute: '2-digit',
                        })
                      : ''
                    return (
                      <div key={respuesta.id} className="act-tl-item">
                        <div className="act-tl-track">
                          <div className="act-tl-dot" />
                          {index < grupo.items.length - 1 && <div className="act-tl-connector" />}
                        </div>
                        <div className="act-tl-content">
                          <div className="act-tl-meta">
                            <span className={`fc-tag ${tipo.clase}`}>{tipo.label}</span>
                            <span className="act-tl-fecha">
                              {respuesta.autorNombre ? `${respuesta.autorNombre} · ` : ''}
                              {hora}
                            </span>
                          </div>
                          {respuesta.descripcionActividad && <p className="act-tl-desc">{respuesta.descripcionActividad}</p>}
                          {respuesta.accionTexto && <p className="act-tl-accion">→ {respuesta.accionTexto}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          ) : (
            <p className="com-vacio">{mensajeVacio}</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
