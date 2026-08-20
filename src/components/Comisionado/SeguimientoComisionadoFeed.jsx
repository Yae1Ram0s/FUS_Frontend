import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../api/api'
import { useNotificaciones } from '../../context/NotificacionesContext'
import { useAnalytics } from '../../analytics'
import { formatearFecha, formatearFechaISO, formatearHora } from '../../utils/fechas'
import FechaInput from '../FechaInput'
import Spinner from '../Spinner'

const TIPO_SEGUIMIENTO_INFO = {
  accion_por_emprender: { label: 'Acción',  clase: 'fc-tag-azul' },
  avance:               { label: 'Respuesta', clase: 'fc-tag-verde' },
  finalizacion:         { label: 'Respuesta', clase: 'fc-tag-verde' },
  rechazo:              { label: 'Rechazo',   clase: 'fc-tag-rojo' },
}

/* Historial de respuestas del Comisionado (avances, acciones por emprender,
   rechazos) — solo lectura para Rol 1, y también para Rol 2 salvo que sea el
   destinatario del Turnado de este FUS (ver SeguimientoComisionadoForm más
   abajo, que ese caso sí puede usar). Mismo endpoint, mismas clases
   (.seccion/.seg-timeline/.fc-tag-*, ya globales en el bundle único) y mismo
   diseño de fila (fecha + hora + acción → aparte) que el Seguimiento directo
   de Turnado (SolicitudesTurnadas.jsx) — solo cambia de dónde saca los datos.
   Se muestra en el detalle de FUS en cuanto hay un comisionado asignado. */
export default function SeguimientoComisionadoFeed({ fusId, folio }) {
  const {
    data: lista = [],
    isFetching: cargando,
    error: errorCarga,
    refetch: cargar,
  } = useQuery({
    queryKey: ['fusSeguimiento', fusId],
    queryFn: ({ signal }) => api
      .get(`/fus/${fusId}/seguimiento/`, { signal })
      .then(response => (
        Array.isArray(response.data) ? response.data : []
      )),
  })

  // En vivo: cualquier notificación de este FUS (nueva respuesta, atendido,
  // rechazo...) refresca el feed sin esperar a que se remonte el panel.
  const notifCtx = useNotificaciones()
  const ultimaNotifId = notifCtx?.notifs?.[0]?.id
  useEffect(() => {
    if (notifCtx?.notifs?.[0]?.fusFolio === folio) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ultimaNotifId` ya es el proxy primitivo estable de `notifCtx?.notifs` usado en todo el proyecto
  }, [ultimaNotifId, folio])

  return (
    <div className="seccion">
      <div className="sec-header sec-resp">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Respuestas y seguimiento
      </div>
      <div className="sec-body">
        {errorCarga && lista.length > 0 && (
          <div className="banner-error-carga">
            <span>No se pudo actualizar — mostrando la última información disponible.</span>
            <button type="button" onClick={cargar}>Reintentar</button>
          </div>
        )}

        <div className="seg-timeline">
          {cargando && lista.length === 0 && <Spinner overlay={false} fill />}
          {!cargando && errorCarga && lista.length === 0 ? (
            <div className="seg-error">
              <p className="seg-error-msg">No se pudo cargar el historial.</p>
              <button type="button" className="btn-reintentar" onClick={cargar}>Reintentar</button>
            </div>
          ) : (!cargando && lista.length === 0) ? (
            <p className="seg-empty">El comisionado aún no ha registrado respuestas.</p>
          ) : lista.map((s, i) => {
            const info = TIPO_SEGUIMIENTO_INFO[s.tipo] || { label: s.tipo, clase: 'fc-tag-azul' }
            return (
              <div key={s.id} className="seg-tl-item">
                <div className="seg-tl-track">
                  <div className="seg-tl-dot" />
                  {i < lista.length - 1 && <div className="seg-tl-connector" />}
                </div>
                <div className="seg-tl-content">
                  <div className="seg-tl-meta">
                    <span className={`fc-tag ${info.clase}`}>{info.label}</span>
                    <span className="seg-tl-fecha">
                      {s.idAutor?.nombre ? `${s.idAutor.nombre} · ` : ''}
                      {s.fechaActividad ? formatearFechaISO(s.fechaActividad) : formatearFecha(s.fechaRegistro, '')}
                      {s.fechaRegistro && <span className="seg-tl-hora"> · {formatearHora(s.fechaRegistro)}</span>}
                    </span>
                  </div>
                  {s.contenido && <p className="seg-tl-actividad">{s.contenido}</p>}
                  {s.accionTexto && <p className="seg-tl-accion">→ {s.accionTexto}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* Formulario para agregar una respuesta de seguimiento — lo usa el
   Comisionado asignado (FUSComisionados.jsx) y, una vez comisionado, también
   Rol 2 destinatario del Turnado de ese FUS (SolicitudesTurnadas.jsx); el
   backend valida quién puede hacerlo (ver EsComisionadoAsignado). Mismos
   campos y mismo botón que el Seguimiento directo de Turnado: fecha +
   "Describe la actividad" + "Acción por emprender", una respuesta puede
   llevar solo una de las dos o ambas juntas (el backend exige al menos una,
   ver SeguimientoComisionadoCreateSerializer). */
export function SeguimientoComisionadoForm({ fusId, onAgregado }) {
  const hoy = new Date().toISOString().split('T')[0]
  const [fecha,       setFecha]       = useState(hoy)
  const [actividad,   setActividad]   = useState('')
  const [accionTexto, setAccionTexto] = useState('')
  const [enviando,    setEnviando]    = useState(false)
  const [error,       setError]       = useState('')
  const { startTask, completeTask, failTask } = useAnalytics({ componente: 'FUS_COMISIONADO_SEGUIMIENTO', accion: 'CREATE' })

  const agregar = async () => {
    if (!fecha || (!actividad.trim() && !accionTexto.trim())) {
      setError('Completa la fecha y una respuesta o una acción.')
      return
    }
    setError(''); setEnviando(true)
    const taskId = startTask()
    try {
      await api.post(`/fus/${fusId}/seguimiento/`, {
        fechaActividad: fecha,
        descripcionActividad: actividad,
        accionTexto,
      })
      completeTask(taskId)
      setFecha(hoy); setActividad(''); setAccionTexto('')
      onAgregado?.()
    } catch (e) {
      failTask(taskId, { metadatos: { motivo: e.response ? 'error_servidor' : 'sin_conexion' } })
      setError(e.response?.data?.detail || 'No se pudo registrar. Intenta nuevamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="seccion">
      <div className="sec-body">
        <div className="seg-nueva">
          <div className="seg-nueva-inputs">
            <FechaInput type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="seg-nueva-fecha" wrapClassName="seg-nueva-fecha-wrap" />
            <input type="text" placeholder="Describe la actividad…" value={actividad} onChange={e => setActividad(e.target.value)} />
            <input type="text" placeholder="Acción por emprender…" value={accionTexto} onChange={e => setAccionTexto(e.target.value)} />
          </div>
          <button className="btn-agregar" onClick={agregar} disabled={enviando}>
            {enviando
              ? <span className="btn-spinner" />
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  <line x1="12" y1="7" x2="12" y2="13"/><line x1="9" y1="10" x2="15" y2="10"/>
                </svg>}
            {enviando ? 'Guardando…' : 'Agregar seguimiento'}
          </button>
        </div>
        {error && <p className="sec-error" role="alert">{error}</p>}
      </div>
    </div>
  )
}
