import { useState } from 'react'
import api from '../../api/api'
import { esParticular } from '../../utils/permisos'
import { useMotivoRechazo } from '../../hooks/useMotivoRechazo'
import { useToast } from '../../context/ToastContext'
import { useAnalytics } from '../../analytics'
import ConfirmModal from './ConfirmModal'
import RechazarModal from './RechazarModal'
import './Comisionado.css'

/* Pie de acciones del ciclo de validación de Comisionado (después de
   "Respuestas y seguimiento"): Atendido / Concluir asunto / Rechazar
   solicitud / banner de rechazo / nota de solo lectura — según estatus y
   rol. Reusado por ConsultarFUS (ROL1) y SolicitudesTurnadas (ROL2).
   `tieneFacultad`: puede este usuario operar el ciclo sobre este FUS
   (comisionar/atendido) — en ambas pantallas ya viene garantizado por el
   propio scoping de la lista (solo ven sus propios FUS/turnados). */
export default function AccionesValidacion({ user, fus, setFusData, tieneFacultad }) {
  const [modalAtendido, setModalAtendido] = useState(false)
  const [modalConcluir, setModalConcluir] = useState(false)
  const [modalRechazar, setModalRechazar] = useState(false)
  const toast = useToast()
  const motivoRechazo = useMotivoRechazo(fus)
  const { startTask, completeTask, failTask } = useAnalytics({ componente: 'FUS_VALIDACION' })

  const estatus = fus.estatusParticular

  if (estatus === 'Rechazado') {
    return (
      <div className="dt-actions">
        <div className="com-banner-danger">
          <strong>Solicitud rechazada</strong>
          {motivoRechazo === null ? 'Verificando estatus…' : (motivoRechazo || 'Sin motivo registrado.')}
        </div>
      </div>
    )
  }

  // Validación final (Concluir asunto / Rechazar solicitud), exclusiva del
  // Particular (Rol 1 — el nivel jerárquico más alto, nunca tiene el botón
  // "Atendido"). Aparece en 'Pendiente_validacion' (turnado a Rol 2, que ya
  // confirmó "Atendido"), o directo en 'Atendido' cuando el FUS no tiene
  // turnado: ahí Rol 1 comisionó de frente, nadie más confirma "Atendido",
  // así que valida sobre la primera respuesta del comisionado sin ese paso
  // intermedio.
  const puedeValidar = esParticular(user) && (
    estatus === 'Pendiente_validacion' || (estatus === 'Atendido' && !fus.tieneTurnado)
  )
  if (puedeValidar) {
    return (
      <div className="dt-actions dt-actions-comisionado">
        <div className="dt-comisionado-botones">
          <button type="button" className="com-btn-rojo" onClick={() => setModalRechazar(true)}>
            Rechazar solicitud
          </button>
          <button type="button" className="com-btn-verde" onClick={() => setModalConcluir(true)}>
            Concluir asunto
          </button>
        </div>

        {modalRechazar && (
          <RechazarModal
            fusId={fus.id}
            onClose={() => setModalRechazar(false)}
            onRechazado={(data) => {
              setFusData(data)
              setModalRechazar(false)
              toast.success('Solicitud rechazada.')
            }}
          />
        )}

        {modalConcluir && (
          <ConfirmModal
            titulo="Concluir asunto"
            texto="¿Confirmas que esta solicitud fue atendida satisfactoriamente? Esta acción no se puede deshacer."
            textoBoton="Sí, concluir asunto"
            colorBoton="verde"
            onClose={() => setModalConcluir(false)}
            onConfirmar={async () => {
              const taskId = startTask({ accion: 'UPDATE' })
              try {
                const { data } = await api.post(`/fus/${fus.id}/concluir-asunto/`)
                completeTask(taskId)
                setFusData(data)
                setModalConcluir(false)
                toast.success('Solicitud concluida.')
              } catch (err) {
                failTask(taskId, { metadatos: { motivo: err.response ? 'error_servidor' : 'sin_conexion' } })
                throw err
              }
            }}
          />
        )}
      </div>
    )
  }

  if (estatus === 'Pendiente_validacion') {
    return <p className="com-nota-discreta">Pendiente de validación por el Particular.</p>
  }

  // 'Atendido' con comisionado asignado (fus.idComisionado): sin importar si
  // llegó ahí directo desde Rol 1 o vía un Turnado que un Titular delegó, es
  // este botón FUS-completo el que corresponde — las respuestas del
  // comisionado viven en SeguimientoRespuesta, no en el Seguimiento del
  // Turnado, así que turnado.estatusTitular nunca avanza solo. Antes esto
  // exigía además "!fus.tieneTurnado", lo que ocultaba el botón por completo
  // en el caso Titular→Comisionado (nadie podía mandarlo a validación).
  // Sin comisionado, cada persona turnada confirma "Atendido" por su cuenta
  // desde su propia fila en Personas y respuestas (PersonasYRespuestasCard).
  if (estatus === 'Atendido' && fus.idComisionado && tieneFacultad && !esParticular(user)) {
    return (
      <div className="dt-actions">
        <button type="button" className="com-btn-verde" onClick={() => setModalAtendido(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Enviar para validación
        </button>
        {modalAtendido && (
          <ConfirmModal
            titulo="Marcar como atendido"
            texto="¿Confirmas que el seguimiento es satisfactorio? Se enviará al Particular para su validación."
            textoBoton="Confirmar"
            colorBoton="verde"
            onClose={() => setModalAtendido(false)}
            onConfirmar={async () => {
              const taskId = startTask({ accion: 'UPDATE' })
              try {
                const { data } = await api.post(`/fus/${fus.id}/atendido/`)
                completeTask(taskId)
                setFusData(data)
                setModalAtendido(false)
                toast.success('Solicitud marcada como atendida.')
              } catch (err) {
                failTask(taskId, { metadatos: { motivo: err.response ? 'error_servidor' : 'sin_conexion' } })
                throw err
              }
            }}
          />
        )}
      </div>
    )
  }

  if (estatus === 'Concluido' && fus.idComisionado) {
    return <p className="dt-concluido-texto">Solicitud concluida — sin acciones pendientes</p>
  }

  return null
}
