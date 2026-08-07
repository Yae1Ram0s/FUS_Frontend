import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '../../api/api'
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

/* Marcadores de auditoría creados por MarcarTurnadoAtendidoView/
   ConcluirPersonaTurnadoView/RechazarPersonaTurnadoView — mismo modelo
   Seguimiento que las respuestas reales (sin campo `tipo` propio), se
   distinguen por el texto para no mostrarlos con la etiqueta genérica
   "Respuesta". Mismo criterio que FUSTrazabilidadView en el backend. */
function tipoDeRespuesta(respuesta) {
  if (respuesta.tipo) return TIPO_SEGUIMIENTO[respuesta.tipo] || TIPO_POR_DEFECTO
  const texto = respuesta.descripcionActividad || ''
  if (texto.startsWith('Rechazado por el Particular:')) return { label: 'Rechazo', clase: 'fc-tag-rojo' }
  if (texto === 'Concluido por el Particular.') return { label: 'Concluido', clase: 'fc-tag-verde' }
  if (texto.startsWith('Atendido:')) return { label: 'Atendido', clase: 'fc-tag-azul' }
  return TIPO_POR_DEFECTO
}

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
  turnado = null,
  onValidado,
}) {
  const [mostrarMotivo, setMostrarMotivo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const envioEnCursoRef = useRef(false)
  useModalBehavior(onClose, { closeEnabled: !enviando })
  const grupos = agruparPorFecha(respuestas)

  // El Particular (Rol 1) valida la parte de ESTA persona una vez que ya
  // marcó su turnado como "Atendido" — ver MarcarTurnadoAtendidoView/
  // ConcluirPersonaTurnadoView/RechazarPersonaTurnadoView en el backend. No
  // afecta a las demás personas del mismo FUS ni, al concluir, al FUS
  // completo hasta que todas estén concluidas.
  const puedeValidar = turnado?.estatusTitular === 'Atendido'

  const enviar = async (accion, datos) => {
    if (envioEnCursoRef.current) return
    envioEnCursoRef.current = true
    setError(''); setEnviando(true)
    try {
      const { data } = await api.post(`/turnados/${turnado.id}/${accion}/`, datos)
      onValidado?.(data.estatusParticular)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo completar la acción. Intenta nuevamente.')
      setEnviando(false)
    } finally {
      envioEnCursoRef.current = false
    }
  }

  const concluir = () => enviar('concluir-persona')
  const rechazar = () => {
    if (!motivo.trim()) { setError('Escribe un motivo antes de rechazar.'); return }
    enviar('rechazar-persona', { motivo })
  }

  return createPortal(
    <div className="com-overlay" role="dialog" aria-modal="true" aria-label={titulo} onClick={() => !enviando && onClose()}>
      <div className="com-modal com-modal-respuestas" onClick={e => e.stopPropagation()}>
        <div className="com-modal-top">
          <h3>{titulo}</h3>
          <button type="button" className="com-modal-x" onClick={onClose} disabled={enviando} aria-label="Cerrar">✕</button>
        </div>

        <div className="drm-lista">
          {respuestas.length ? (
            grupos.map(grupo => (
              <div key={grupo.clave} className="drm-grupo">
                <span className="drm-grupo-fecha">{grupo.clave}</span>
                <div className="act-tl">
                  {grupo.items.map((respuesta, index) => {
                    const tipo = tipoDeRespuesta(respuesta)
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

        {puedeValidar && (
          <>
            <div className="drm-validar-divider" />
            {mostrarMotivo ? (
              <>
                <textarea
                  className="com-pill-input com-textarea"
                  value={motivo}
                  onChange={e => { setMotivo(e.target.value); if (error) setError('') }}
                  placeholder="Explica por qué se rechaza la respuesta de esta persona…"
                  rows={3}
                  disabled={enviando}
                  autoFocus
                />
                {error && <div className="com-alert-error">{error}</div>}
                <div className="com-confirm-acciones">
                  <button type="button" className="com-btn-ghost" onClick={() => { setMostrarMotivo(false); setMotivo(''); setError('') }} disabled={enviando}>
                    Cancelar
                  </button>
                  <button type="button" className="com-btn-rojo" onClick={rechazar} disabled={enviando}>
                    {enviando && <span className="btn-spinner" />}
                    {enviando ? 'Rechazando…' : 'Confirmar rechazo'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {error && <div className="com-alert-error">{error}</div>}
                <div className="com-confirm-acciones">
                  <button type="button" className="com-btn-rojo" onClick={() => setMostrarMotivo(true)} disabled={enviando}>
                    Rechazar
                  </button>
                  <button type="button" className="com-btn-verde" onClick={concluir} disabled={enviando}>
                    {enviando && <span className="btn-spinner" />}
                    {enviando ? 'Concluyendo…' : 'Concluir'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
