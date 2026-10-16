import { useCallback, useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import { useNotificaciones } from '../context/NotificacionesContext'
import { useAnalytics } from '../analytics'
import FusFolioPicker from '../components/Calendario/FusFolioPicker'
import ModalDetalleFUS from '../components/ModalDetalleFUS'
import { obtenerIniciales } from '../utils/personas'
import { PRIORIDAD_NIVELES } from '../utils/prioridades'
import FechaInput from '../components/FechaInput'
import './CalendarioActividades.css'

const TIPO_INFO = {
  reunion:       { label: 'Reunión',       color: '#5b7fe0', chipBg: '#5b7fe0', chipText: '#ffffff' },
  fus:           { label: 'FUS vinculado', color: '#4a9d6f', chipBg: '#4a9d6f', chipText: '#ffffff' },
  limite:        { label: 'Fecha límite',  color: '#dd9a3a', chipBg: '#dd9a3a', chipText: '#ffffff' },
}

// Límites ya vencidos (el backend marca `vencido`): rojo en todas las vistas
const COLOR_VENCIDO = '#b23030'
const INFO_VENCIDO = { label: 'Vencidos', color: COLOR_VENCIDO }
const infoDe = (ev) => {
  const base = TIPO_INFO[ev.tipo] || TIPO_INFO.reunion
  return ev.vencido ? { ...base, color: COLOR_VENCIDO, chipBg: COLOR_VENCIDO } : base
}
// Momento en que termina una actividad (hora local; en un límite, es la hora límite)
const finDeActividad = (a) => new Date(`${a.fecha}T${a.horaFin}`)
// El recordatorio automático dice "Vence FUS: …"; ya vencido se lee "Vencido FUS: …"
const tituloDe = (ev) => (ev.vencido ? ev.titulo.replace(/^Vence(?=[\s:])/, 'Vencido') : ev.titulo)
// Un folio como ANAM/PARTICULAR/FUS/0004/2026 solo puede partirse tras una "/"
// (no a media palabra): se intercala <wbr> después de cada diagonal.
const conCortes = (texto) => String(texto).split('/').flatMap((parte, i, partes) => (
  i < partes.length - 1 ? [parte, '/', <wbr key={i} />] : [parte]
))

const DIAS_SEMANA      = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_SEMANA_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DIAS_SEMANA_MIN  = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const HORAS = Array.from({ length: 24 }, (_, h) => h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`)
const ALTURA_HORA = 56
const ALTURA_HORA_DIA = 60

const ACTIVIDADES_QUERY_KEY = ['actividades']

// Campos obligatorios del modal de actividad, en el orden en que aparecen.
const CAMPOS_OBLIGATORIOS = [
  { clave: 'titulo',     nombre: 'Título',         mensaje: 'Escribe un título.' },
  { clave: 'fecha',      nombre: 'Fecha',          mensaje: 'Elige la fecha.' },
  { clave: 'horaInicio', nombre: 'Hora de inicio', mensaje: 'Elige la hora de inicio.' },
  { clave: 'horaFin',    nombre: 'Hora de fin',    mensaje: 'Elige la hora de fin.' },
]

// Mezcla por id. Si una actividad ya estaba en caché, gana la versión recién
// pedida: antes se conservaba la vieja, así que campos que cambian con el
// tiempo o por ediciones ajenas (p. ej. `vencido`) se quedaban desactualizados
// hasta recargar la página completa.
function combinarActividades(anteriores, nuevas) {
  const nuevasPorId = new Map(nuevas.map(actividad => [actividad.id, actividad]))
  const ids = new Set(anteriores.map(actividad => actividad.id))
  return [
    ...anteriores.map(actividad => nuevasPorId.get(actividad.id) || actividad),
    ...nuevas.filter(actividad => !ids.has(actividad.id)),
  ]
}

const toKeyMes   = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const toISODate  = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const isSameDay  = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const startOfWeek = d => { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0, 0, 0, 0); return r }
const minutos    = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const sumarHora  = t => { const m = minutos(t) + 60; return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }

const horaDesdeClick = (evento, alturaHora) => {
  const rect = evento.currentTarget.getBoundingClientRect()
  const y = Math.max(0, Math.min(evento.clientY - rect.top, alturaHora * 24 - 1))
  const totalMinutos = Math.round((y / alturaHora) * 60 / 15) * 15
  const acotado = Math.max(0, Math.min(totalMinutos, 23 * 60 + 45))
  return `${String(Math.floor(acotado / 60)).padStart(2, '0')}:${String(acotado % 60).padStart(2, '0')}`
}

/* Matriz de 42 celdas (6 semanas x 7 días) que cubre el mes mostrado */
function construirGrid(mesRef) {
  const year  = mesRef.getFullYear()
  const month = mesRef.getMonth()
  const inicioOffset = new Date(year, month, 1).getDay()
  const celdas = []
  const cursor = new Date(year, month, 1 - inicioOffset)
  for (let i = 0; i < 42; i++) {
    celdas.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return celdas
}

/* Meses que hay que tener cargados para ver correctamente la vista actual
   (el grid mensual de 42 celdas puede asomar días del mes anterior/siguiente) */
function mesesNecesarios(vista, referencia) {
  if (vista === 'dia') return [toKeyMes(referencia)]
  if (vista === 'semana') {
    const inicio = startOfWeek(referencia)
    const fin = new Date(inicio); fin.setDate(fin.getDate() + 6)
    const a = toKeyMes(inicio), b = toKeyMes(fin)
    return a === b ? [a] : [a, b]
  }
  const grid = construirGrid(referencia)
  return [...new Set(grid.map(toKeyMes))]
}

/* ── Toast ── */
function Toast({ toast, sobreModal }) {
  if (!toast) return null
  return createPortal(
    <div className={`cal-toast${toast.tipo === 'error' ? ' cal-toast-error' : ''}${sobreModal ? ' cal-toast-sobre-modal' : ''}`}>
      <span>{toast.tipo === 'error' ? '⚠️' : '✓'}</span>
      {toast.mensaje}
    </div>,
    document.body
  )
}

/* ── Mini-calendario navegable del sidebar ── */
function MiniCalendario({ mesCursor, seleccionado, actividadesPorDia, onCambiarMes, onSeleccionarDia }) {
  const celdas = useMemo(() => construirGrid(mesCursor), [mesCursor])
  const hoy = new Date()
  return (
    <div className="cal-mini">
      <div className="cal-mini-header">
        <button type="button" onClick={() => onCambiarMes(-1)} aria-label="Mes anterior">‹</button>
        <span>{MESES[mesCursor.getMonth()].slice(0, 3)} {mesCursor.getFullYear()}</span>
        <button type="button" onClick={() => onCambiarMes(1)} aria-label="Mes siguiente">›</button>
      </div>
      <div className="cal-mini-dias">
        {DIAS_SEMANA.map(d => <span key={d}>{d[0]}</span>)}
      </div>
      <div className="cal-mini-grid">
        {celdas.map((c, i) => {
          const fueraDeMes = c.getMonth() !== mesCursor.getMonth()
          const esHoy = isSameDay(c, hoy)
          const esSeleccionado = isSameDay(c, seleccionado)
          const tieneActividad = (actividadesPorDia[toISODate(c)] || []).length > 0
          return (
            <span
              key={i}
              onClick={() => onSeleccionarDia(c)}
              className={`cal-mini-dia${fueraDeMes ? ' cal-mini-dia-fuera' : ''}${esHoy ? ' cal-mini-dia-hoy' : ''}${esSeleccionado ? ' cal-mini-dia-sel' : ''}${tieneActividad ? ' cal-mini-dia-actividad' : ''}`}
            >
              {c.getDate()}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ── Detalle flotante de una actividad de la agenda (al pasar el cursor) ──
   Se pinta fuera del sidebar (portal, posición fija) porque la tarjeta recorta
   su contenido: aparece a la derecha del sidebar, y si no cabe, debajo/encima
   de la fila. Con FUS vinculado muestra un resumen de la solicitud; sin FUS,
   la descripción y los participantes de la actividad. */
const ESTADO_FUS = {
  Registrado:           { label: 'Registrado',             color: '#9F2241' },
  Turnado:              { label: 'Turnado',                color: '#7c5cd6' },
  Recibido:             { label: 'Recibido',               color: '#9F2241' },
  En_seguimiento:       { label: 'En seguimiento',         color: '#b7791f' },
  Atendido:             { label: 'En seguimiento',         color: '#b7791f' },
  Pendiente_validacion: { label: 'Pendiente de validación', color: '#7c5cd6' },
  Concluido:            { label: 'Concluido',              color: '#2f855a' },
  Rechazado:            { label: 'Rechazado',              color: '#b23030' },
}

const duracionTexto = (inicio, fin) => {
  const total = minutos(fin) - minutos(inicio)
  if (total <= 0) return ''
  const h = Math.floor(total / 60), m = total % 60
  return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`
}

function DetalleActividadFlotante({ ev, rect, sidebar }) {
  const { user } = useAuth()
  const ref = useRef(null)
  const info = infoDe(ev)
  // El Comisionado no puede consultar el detalle de auditoría del FUS.
  const puedeConsultarFus = Boolean(ev.fusFolio) && user?.rol !== 'COMISIONADO'
  const { data: fus, isFetching } = useQuery({
    queryKey: ['fusDetalleAuditoria', ev.fusFolio],
    queryFn: ({ signal }) => api
      .get(`/fus/detalle-auditoria/${ev.fusFolio.split('/').map(encodeURIComponent).join('/')}/`, { signal })
      .then(respuesta => respuesta.data),
    enabled: puedeConsultarFus,
    staleTime: 5 * 60_000,
    retry: false,
  })

  // Posición: a la derecha del sidebar si cabe; si no, bajo (o sobre) la fila.
  // Se ajusta directo en el DOM para no re-renderizar por cada medición.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const margen = 12
    const ancho = el.offsetWidth
    const alto = el.offsetHeight
    let left, top
    // Fila de la agenda: a la derecha del sidebar. Actividad del calendario
    // grande: a la derecha de la propia actividad, o a su izquierda si no cabe.
    const bordeDerecho = (sidebar || rect).right
    if (bordeDerecho + margen + ancho <= window.innerWidth - margen) {
      left = bordeDerecho + margen
      top = rect.top - 6
    } else if (!sidebar && rect.left - margen - ancho >= margen) {
      left = rect.left - margen - ancho
      top = rect.top - 6
    } else {
      left = Math.min(Math.max(rect.left, margen), window.innerWidth - ancho - margen)
      top = rect.bottom + 8
      if (top + alto > window.innerHeight - margen) top = rect.top - alto - 8
    }
    top = Math.max(margen, Math.min(top, window.innerHeight - alto - margen))
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.classList.add('cal-flotante-listo')
  }, [rect, sidebar, fus, isFetching])

  const [anio, mes, dia] = ev.fecha.split('-').map(Number)
  const fecha = new Date(anio, mes - 1, dia)
  const inicio = ev.horaInicio.slice(0, 5)
  const fin = ev.horaFin.slice(0, 5)
  const estado = fus ? (ESTADO_FUS[fus.estatusParticular] || { label: String(fus.estatusParticular || '').replace(/_/g, ' '), color: '#4a635b' }) : null
  const prioridad = fus?.prioridad ? PRIORIDAD_NIVELES.find(p => p.valor === fus.prioridad) : null
  const participantes = ev.participantesInfo || []
  let avisoVencido = ''
  if (ev.vencido) {
    const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0)
    const dias = Math.round((hoy0 - fecha) / 86400000)
    avisoVencido = dias <= 0 ? 'Venció hoy' : `Venció hace ${dias} día${dias > 1 ? 's' : ''}`
  }

  return createPortal(
    <div ref={ref} className={`cal-flotante${ev.vencido ? ' cal-flotante-vencido' : ''}`} role="tooltip" style={{ '--tipo': info.color }}>
      <header className="cal-flotante-header">
        <div className="cal-flotante-header-main">
          <span className="cal-flotante-tipo"><span className="cal-flotante-punto" />{ev.vencido ? `${info.label} · Vencido` : info.label}</span>
          <p className="cal-flotante-titulo">{conCortes(tituloDe(ev))}</p>
          <p className="cal-flotante-hora">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
            {inicio} – {fin}{duracionTexto(inicio, fin) && <span className="cal-flotante-dur">{duracionTexto(inicio, fin)}</span>}
          </p>
        </div>
        <span className="cal-flotante-hoja" aria-label={`${DIAS_SEMANA_FULL[fecha.getDay()]} ${dia} de ${MESES[mes - 1]}`}>
          <span className="cal-flotante-hoja-dia">{DIAS_SEMANA[fecha.getDay()]}</span>
          <b className="cal-flotante-hoja-num">{dia}</b>
          <span className="cal-flotante-hoja-mes">{MESES[mes - 1].slice(0, 3)}</span>
        </span>
      </header>

      {ev.vencido && (
        <div className="cal-flotante-aviso" role="alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          {avisoVencido}
        </div>
      )}

      <div className="cal-flotante-cuerpo">
        {ev.fusFolio ? (
          <section className="cal-flotante-bloque">
            <p className="cal-flotante-seccion cal-flotante-seccion-fus">Solicitud vinculada</p>
            <div className="cal-flotante-fus-top">
              <span className="cal-flotante-folio">{ev.fusFolio}</span>
              {estado && <span className="cal-flotante-pildora" style={{ '--c': estado.color }}>{estado.label}</span>}
              {prioridad && <span className="cal-flotante-pildora" style={{ '--c': prioridad.color }}>Prioridad {prioridad.valor}</span>}
            </div>
            {puedeConsultarFus && isFetching && !fus && (
              <div className="cal-flotante-esqueleto" aria-hidden="true"><span /><span /></div>
            )}
            {fus?.descripcion && <p className="cal-flotante-texto cal-flotante-clamp">{fus.descripcion}</p>}
            {fus?.idSolicitanteInterno?.nombre && (
              <p className="cal-flotante-meta">
                <span className="cal-flotante-avatar">{obtenerIniciales(fus.idSolicitanteInterno.nombre, fus.idSolicitanteInterno.email)}</span>
                <span>Solicitante · <b>{fus.idSolicitanteInterno.nombre}</b></span>
              </p>
            )}
            {ev.descripcion && <p className="cal-flotante-nota"><b>Nota</b>{ev.descripcion}</p>}
          </section>
        ) : (
          <section className="cal-flotante-bloque">
            <p className="cal-flotante-seccion">Descripción</p>
            {ev.descripcion
              ? <p className="cal-flotante-texto cal-flotante-clamp">{ev.descripcion}</p>
              : <p className="cal-flotante-texto cal-flotante-vacio">Sin descripción</p>}
          </section>
        )}

        {participantes.length > 0 && (
          <section className="cal-flotante-bloque">
            <p className="cal-flotante-seccion">Participantes</p>
            <div className="cal-flotante-personas">
              {participantes.slice(0, 4).map(u => (
                <span key={u.id} className="cal-flotante-persona" title={u.nombre || u.email}>
                  <span className="cal-flotante-avatar">{obtenerIniciales(u.nombre, u.email)}</span>
                  <span className="cal-flotante-persona-nombre">{(u.nombre || u.email || '').split(' ')[0]}</span>
                </span>
              ))}
              {participantes.length > 4 && <span className="cal-flotante-mas">+{participantes.length - 4}</span>}
            </div>
          </section>
        )}
      </div>

      <footer className="cal-flotante-pie">
        <span><kbd className="cal-flotante-tecla">Clic</kbd> {ev.fusFolio ? 'editar' : 'ver o editar'}</span>
        {ev.fusFolio && (
          <span>
            <kbd className="cal-flotante-tecla" aria-label="Ojo">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </kbd> ver solicitud
          </span>
        )}
      </footer>
    </div>,
    document.body
  )
}

/* ── Agenda: lista bajo el mini-calendario ──
   Por defecto lista la semana en curso (dom–sáb), sin importar el mes que se
   esté viendo en el mini-calendario; lo que ya pasó se atenúa. Si hay un día
   seleccionado en el mini-calendario, lista las actividades de ese día. La
   lista hace scroll dentro de su propia tarjeta. */
function AgendaSemana({ actividades, diaSeleccionado, resaltadoId, onAbrir, onVerFus, onLimpiarDia, mostrarDetalle, ocultarDetalle }) {
  const claveDia = diaSeleccionado ? toISODate(diaSeleccionado) : null
  const { rango, lista } = useMemo(() => {
    const inicio = startOfWeek(new Date())
    const fin = new Date(inicio); fin.setDate(fin.getDate() + 6)
    const dias = claveDia
      ? new Set([claveDia])
      : new Set(Array.from({ length: 7 }, (_, i) => { const d = new Date(inicio); d.setDate(d.getDate() + i); return toISODate(d) }))
    const ordenadas = actividades
      .filter(a => dias.has(a.fecha))
      .sort((a, b) => `${a.fecha} ${a.horaInicio}`.localeCompare(`${b.fecha} ${b.horaInicio}`))
    let etiqueta
    if (diaSeleccionado) {
      etiqueta = `${DIAS_SEMANA_FULL[diaSeleccionado.getDay()]} ${diaSeleccionado.getDate()} de ${MESES[diaSeleccionado.getMonth()]}`
    } else if (inicio.getMonth() === fin.getMonth()) {
      etiqueta = `${inicio.getDate()}–${fin.getDate()} de ${MESES[inicio.getMonth()]}`
    } else {
      etiqueta = `${inicio.getDate()} ${MESES[inicio.getMonth()].slice(0, 3)} – ${fin.getDate()} ${MESES[fin.getMonth()].slice(0, 3)}`
    }
    return { rango: etiqueta, lista: ordenadas }
  }, [actividades, claveDia, diaSeleccionado])

  const ahora = new Date()
  const hoyISO = toISODate(ahora)
  const ahoraTexto = `${hoyISO} ${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`

  return (
    <section className="cal-agenda" aria-label={diaSeleccionado ? 'Agenda del día' : 'Agenda de la semana'}>
      <div className="cal-agenda-top">
        <div className="cal-agenda-encabezado">
          <p className="cal-agenda-title">{diaSeleccionado ? 'Día seleccionado' : 'Esta semana'}</p>
          <span className="cal-agenda-rango">{rango}</span>
        </div>
        <span className="cal-agenda-total" title={diaSeleccionado ? 'Actividades del día' : 'Actividades en la semana'}>{lista.length}</span>
      </div>

      {lista.length === 0 ? (
        <p className="cal-agenda-vacio">{diaSeleccionado ? 'Sin actividades este día.' : 'Sin actividades esta semana.'}</p>
      ) : (
        <ul className="cal-agenda-lista" onScroll={ocultarDetalle}>
          {lista.map(ev => {
            const info = infoDe(ev)
            const [anio, mes, dia] = ev.fecha.split('-').map(Number)
            const fecha = new Date(anio, mes - 1, dia)
            const esHoyEv = ev.fecha === hoyISO
            const yaPaso = `${ev.fecha} ${ev.horaFin}` < ahoraTexto
            return (
              <li
                key={ev.id}
                className="cal-agenda-fila"
                onMouseEnter={e => mostrarDetalle(ev, e.currentTarget)}
                onMouseLeave={ocultarDetalle}
                onFocus={e => mostrarDetalle(ev, e.currentTarget)}
                onBlur={ocultarDetalle}
              >
                <button type="button" className={`cal-agenda-item${yaPaso ? ' cal-agenda-item-pasada' : ''}${ev.vencido ? ' cal-agenda-item-vencido' : ''}${resaltadoId === ev.id ? ' cal-resaltado' : ''}`} onClick={() => { ocultarDetalle(); onAbrir(ev) }}>
                  <span className={`cal-agenda-fecha${esHoyEv ? ' cal-agenda-fecha-hoy' : ''}`} style={{ borderColor: info.color }}>
                    <span className="cal-agenda-fecha-dia">{DIAS_SEMANA[fecha.getDay()]}</span>
                    <span className="cal-agenda-fecha-num">{fecha.getDate()}</span>
                  </span>
                  <span className="cal-agenda-info">
                    <span className="cal-agenda-titulo">{tituloDe(ev)}</span>
                    <span className="cal-agenda-meta">
                      {esHoyEv ? 'Hoy · ' : ''}{ev.horaInicio.slice(0, 5)} – {ev.horaFin.slice(0, 5)} · {ev.vencido ? 'Vencido' : info.label}
                    </span>
                  </span>
                </button>
                {ev.fusFolio && (
                  <button type="button" className="cal-agenda-fus" onClick={() => { ocultarDetalle(); onVerFus(ev.fusFolio) }} aria-label={`Ver solicitud ${ev.fusFolio}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {diaSeleccionado && (
        <div className="cal-agenda-acciones">
          <button type="button" className="cal-agenda-accion cal-agenda-accion-sec" onClick={onLimpiarDia}>Ver semana actual</button>
        </div>
      )}

    </section>
  )
}

/* ── Modal: nueva actividad / editar actividad ── */
function ModalActividad({ modal, usuarios, esCreador, onClose, onGuardado, onEliminado, onError, onVerFus }) {
  const [form, setForm] = useState({
    titulo: modal.titulo || '',
    fecha: modal.fecha,
    horaInicio: modal.horaInicio || '09:00',
    horaFin: modal.horaFin || '10:00',
    descripcion: modal.descripcion || '',
    tipo: modal.tipo || 'reunion',
    folioFus: modal.fusFolio || '',
    participantes: (modal.participantesInfo || []).map(p => p.id),
  })
  const [fusEncontrado, setFusEncontrado] = useState(modal.fusFolio ? { id: modal.idFusRelacionado, folio: modal.fusFolio } : null)
  const [error, setError] = useState('')
  const [faltantes, setFaltantes] = useState([])
  const [busquedaParticipante, setBusquedaParticipante] = useState('')
  const modalRef = useRef(null)
  const descripcionRef = useRef(null)
  const [conflicto, setConflicto] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const guardarEnCursoRef = useRef(false)
  const eliminarEnCursoRef = useRef(false)
  const { user } = useAuth()
  // El recordatorio "Vence FUS" (tipo límite con FUS ligado) lo crea el sistema
  // al registrar/turnar con fecha límite: no se edita ni se desvincula; solo se
  // consulta y se salta al FUS con "Ver solicitud".
  const bloqueadoPorFus = modal.mode === 'editar' && modal.tipo === 'limite' && Boolean(modal.fusFolio)
  const soloLectura = (modal.mode === 'editar' && !esCreador) || bloqueadoPorFus
  const { startTask, completeTask, failTask } = useAnalytics({ componente: 'CALENDARIO_ACTIVIDAD' })

  // La descripción crece con su contenido (sin esto quedaba recortada a 2 filas).
  useLayoutEffect(() => {
    const el = descripcionRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [form.descripcion])

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    setFaltantes(prev => (prev.includes(k) ? prev.filter(c => c !== k) : prev))
  }
  const invalido = (clave) => faltantes.includes(clave)

  // Lleva la vista del modal al primer campo con problema y lo enfoca.
  const irAlCampo = (clave) => {
    requestAnimationFrame(() => {
      const el = modalRef.current?.querySelector(`[data-campo="${clave}"]`)
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.querySelector('input, textarea, select')?.focus({ preventScroll: true })
    })
  }

  const onFolioSeleccionado = (folio) => {
    set('folioFus', folio || '')
    if (!folio) setFusEncontrado(null)
  }
  const onFusSeleccionado = (item) => setFusEncontrado(item ? { id: item.id, folio: item.folio } : null)

  const enfocarCampo = (e) => {
    e.target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  // Filtra por nombre o correo, sin distinguir mayúsculas ni acentos. Los ya
  // marcados siguen en `form.participantes` aunque el filtro los oculte.
  const usuariosFiltrados = useMemo(() => {
    const normalizar = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const q = normalizar(busquedaParticipante).trim()
    if (!q) return usuarios
    return usuarios.filter(u => normalizar(`${u.nombre} ${u.email}`).includes(q))
  }, [usuarios, busquedaParticipante])

  const toggleParticipante = (id) => {
    setForm(f => ({
      ...f,
      participantes: f.participantes.includes(id)
        ? f.participantes.filter(p => p !== id)
        : [...f.participantes, id],
    }))
  }

  // Devuelve { mensaje, campos } con lo que falta o está mal, o null si todo bien.
  const validar = () => {
    const vacios = CAMPOS_OBLIGATORIOS.filter(c => !String(form[c.clave] || '').trim())
    if (vacios.length) {
      return {
        mensaje: `Falta completar: ${vacios.map(c => c.nombre).join(', ')}.`,
        campos: vacios.map(c => c.clave),
      }
    }
    if (form.horaFin <= form.horaInicio) {
      return { mensaje: 'La hora de fin debe ser posterior a la hora de inicio.', campos: ['horaFin'] }
    }
    return null
  }

  const construirPayload = (forzar) => ({
    titulo: form.titulo,
    fecha: form.fecha,
    horaInicio: form.horaInicio,
    horaFin: form.horaFin,
    descripcion: form.descripcion,
    tipo: form.tipo,
    idFusRelacionado: (fusEncontrado && typeof fusEncontrado === 'object') ? fusEncontrado.id : null,
    participantes: form.participantes,
    forzarConflicto: forzar,
  })

  const guardar = async (forzar = false) => {
    const problema = validar()
    if (problema) {
      setError(problema.mensaje); setFaltantes(problema.campos); setConflicto(null)
      irAlCampo(problema.campos[0])
      return
    }
    if (guardarEnCursoRef.current) return
    guardarEnCursoRef.current = true
    setError(''); setFaltantes([]); setGuardando(true)
    const taskId = startTask({ accion: modal.mode === 'crear' ? 'CREATE' : 'UPDATE' })
    try {
      const respuesta = modal.mode === 'crear'
        ? await api.post('/actividades/', construirPayload(forzar))
        : await api.patch(`/actividades/${modal.id}/`, construirPayload(forzar))
      completeTask(taskId)
      // Si la API no devolviera la actividad, se usa lo que se acaba de capturar.
      onGuardado({
        id: modal.mode === 'crear' ? undefined : modal.id,
        fecha: form.fecha, horaInicio: form.horaInicio, horaFin: form.horaFin, titulo: form.titulo,
        ...(respuesta?.data || {}),
      })
    } catch (e) {
      if (e.response?.status === 409) {
        failTask(taskId, { metadatos: { motivo: 'conflicto' } })
        setConflicto(e.response.data?.detail || 'Ya existe otra actividad en ese horario.')
      } else {
        failTask(taskId, { metadatos: { motivo: e.response ? 'error_servidor' : 'sin_conexion' } })
        const detalle = e.response?.data?.detail || 'No se pudo guardar la actividad.'
        setError(detalle)
        onError(detalle)
      }
    } finally {
      setGuardando(false)
      guardarEnCursoRef.current = false
    }
  }

  const eliminar = async () => {
    if (eliminarEnCursoRef.current) return
    eliminarEnCursoRef.current = true
    setEliminando(true)
    const taskId = startTask({ componente: 'CALENDARIO_ACTIVIDAD_ELIMINAR', accion: 'UPDATE' })
    try {
      await api.delete(`/actividades/${modal.id}/`)
      completeTask(taskId)
      onEliminado()
    } catch (e) {
      failTask(taskId, { metadatos: { motivo: e.response ? 'error_servidor' : 'sin_conexion' } })
      onError('No se pudo eliminar la actividad.')
    } finally {
      setEliminando(false)
      eliminarEnCursoRef.current = false
    }
  }

  return createPortal(
    <div className="cal-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="cal-modal" ref={modalRef} onClick={e => e.stopPropagation()}>
        <div className="cal-modal-top">
          <h3>{modal.mode === 'crear' ? 'Nueva actividad' : bloqueadoPorFus ? 'Detalle de actividad' : 'Editar actividad'}</h3>
          <button type="button" className="cal-modal-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {error && <div className="cal-modal-alert cal-modal-alert-error" role="alert">{error}</div>}

        {!soloLectura && <p className="cal-modal-hint">Los campos con <span className="cal-req">*</span> son obligatorios.</p>}

        {conflicto && (
          <div className="cal-modal-alert cal-modal-alert-conflicto">
            <div>{conflicto}</div>
            <div className="cal-modal-alert-acciones">
              <button type="button" onClick={() => setConflicto(null)}>Modificar horario</button>
              <button type="button" className="cal-modal-alert-confirmar" onClick={() => { setConflicto(null); guardar(true) }}>
                Confirmar de todas formas
              </button>
            </div>
          </div>
        )}

        <div className={`cal-campo${invalido('titulo') ? ' cal-campo-error' : ''}`} data-campo="titulo">
          <input
            className="cal-pill-input"
            value={form.titulo}
            onChange={e => set('titulo', e.target.value)}
            onFocus={enfocarCampo}
            placeholder="Título de la actividad *"
            aria-label="Título de la actividad (obligatorio)"
            aria-invalid={invalido('titulo')}
            disabled={soloLectura}
          />
          {invalido('titulo') && <span className="cal-campo-msg">{CAMPOS_OBLIGATORIOS[0].mensaje}</span>}
        </div>

        <div className={`cal-campo${invalido('fecha') ? ' cal-campo-error' : ''}`} data-campo="fecha">
          <label className="cal-campo-label">Fecha <span className="cal-req">*</span></label>
          <div className="cal-pill-clip">
            <FechaInput
              className="cal-pill-input"
              wrapClassName="cal-pill-input-wrap"
              type="date"
              value={form.fecha}
              onChange={e => set('fecha', e.target.value)}
              onFocus={enfocarCampo}
              aria-invalid={invalido('fecha')}
              disabled={soloLectura}
            />
          </div>
          {invalido('fecha') && <span className="cal-campo-msg">{CAMPOS_OBLIGATORIOS[1].mensaje}</span>}
        </div>

        <div className="cal-modal-row2">
          <div className={`cal-campo${invalido('horaInicio') ? ' cal-campo-error' : ''}`} data-campo="horaInicio">
            <label className="cal-campo-label">Inicio <span className="cal-req">*</span></label>
            <div className="cal-pill-clip">
              <input className="cal-pill-input" type="time" value={form.horaInicio} onChange={e => set('horaInicio', e.target.value)} onFocus={enfocarCampo} aria-invalid={invalido('horaInicio')} disabled={soloLectura} />
            </div>
            {invalido('horaInicio') && <span className="cal-campo-msg">{CAMPOS_OBLIGATORIOS[2].mensaje}</span>}
          </div>
          <div className={`cal-campo${invalido('horaFin') ? ' cal-campo-error' : ''}`} data-campo="horaFin">
            <label className="cal-campo-label">Fin <span className="cal-req">*</span></label>
            <div className="cal-pill-clip">
              <input className="cal-pill-input" type="time" value={form.horaFin} onChange={e => set('horaFin', e.target.value)} onFocus={enfocarCampo} aria-invalid={invalido('horaFin')} disabled={soloLectura} />
            </div>
            {invalido('horaFin') && <span className="cal-campo-msg">{form.horaInicio && form.horaFin && form.horaFin <= form.horaInicio ? 'Debe ser posterior al inicio.' : CAMPOS_OBLIGATORIOS[3].mensaje}</span>}
          </div>
        </div>

        <select className="cal-pill-input" value={form.tipo} onChange={e => set('tipo', e.target.value)} onFocus={enfocarCampo} disabled={soloLectura}>
          {Object.entries(TIPO_INFO).map(([key, info]) => (
            <option key={key} value={key}>{info.label}</option>
          ))}
        </select>

        <textarea
          ref={descripcionRef}
          className="cal-pill-input cal-pill-textarea"
          value={form.descripcion}
          onChange={e => set('descripcion', e.target.value)}
          onFocus={enfocarCampo}
          placeholder="Descripción (opcional)"
          rows={2}
          disabled={soloLectura}
        />

        {!bloqueadoPorFus && (
          <FusFolioPicker
            value={form.folioFus || null}
            onChange={onFolioSeleccionado}
            onSelect={onFusSeleccionado}
            disabled={soloLectura}
          />
        )}

        {form.folioFus && onVerFus && (
          <button type="button" className="cal-btn-ver-fus" onClick={() => onVerFus(form.folioFus)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            Ver solicitud {form.folioFus}
          </button>
        )}

        {user?.rol !== 'ROL2' && (
          <div className="cal-modal-participantes">
            <p className="cal-modal-label">Participantes</p>
            {bloqueadoPorFus ? (
              <div className="cal-participantes-lista">
                {(modal.participantesInfo || []).map(p => (
                  <span key={p.id} className="cal-participante-item cal-participante-solo">{p.nombre || p.email}</span>
                ))}
                {!modal.participantesInfo?.length && <p className="cal-participantes-vacio">Sin participantes.</p>}
              </div>
            ) : (
              <>
                <input
                  type="search"
                  className="cal-pill-input cal-participantes-buscar"
                  placeholder="Buscar participante…"
                  aria-label="Buscar participante"
                  value={busquedaParticipante}
                  onChange={e => setBusquedaParticipante(e.target.value)}
                />
                <div className="cal-participantes-lista">
                  {usuariosFiltrados.map(u => (
                    <label key={u.id} className="cal-participante-item">
                      <input
                        type="checkbox"
                        checked={form.participantes.includes(u.id)}
                        onChange={() => toggleParticipante(u.id)}
                        disabled={soloLectura}
                      />
                      {u.nombre || u.email}
                    </label>
                  ))}
                  {usuarios.length === 0 && <p className="cal-participantes-vacio">Sin usuarios disponibles.</p>}
                  {usuarios.length > 0 && usuariosFiltrados.length === 0 && <p className="cal-participantes-vacio">Sin resultados.</p>}
                </div>
              </>
            )}
          </div>
        )}

        {modal.mode === 'editar' && (
          <p className="cal-modal-audit">
            Creada {esCreador ? 'por ti' : ''} · {modal.fechaCreacion ? new Date(modal.fechaCreacion).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
          </p>
        )}

        {!soloLectura && (
          <div className="cal-modal-acciones">
            {modal.mode === 'editar' && (
              <button type="button" className="cal-btn-eliminar" onClick={eliminar} disabled={eliminando || guardando}>
                {eliminando ? 'Eliminando…' : 'Eliminar'}
              </button>
            )}
            <button type="button" className="cal-btn-guardar" onClick={() => guardar(false)} disabled={guardando || eliminando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

/* ── Página principal ── */
export default function CalendarioActividades() {
  const [vista, setVista]       = useState('mes') // 'mes' | 'semana' | 'dia'
  const [current, setCurrent]   = useState(() => new Date())
  const [miniCursor, setMiniCursor] = useState(() => new Date())
  const [usuarios, setUsuarios] = useState([])
  const [modal, setModal]       = useState(null)
  const [fusRapido, setFusRapido] = useState(null)
  // Actividad recién guardada: se resalta y se lleva a la vista para mostrar dónde quedó.
  const [resaltadoId, setResaltadoId] = useState(null)
  const pendienteScrollRef = useRef(null)
  const resaltadoTimeoutRef = useRef(null)
  const navigate = useNavigate()
  const [toast, setToast]       = useState(null)
  const [compacto, setCompacto] = useState(() => window.innerWidth <= 768)
  const [ultraCompacto, setUltraCompacto] = useState(() => window.innerWidth < 640)
  const { user } = useAuth()
  const notifCtx = useNotificaciones()
  const mesesCargadosRef = useRef(new Set())
  const toastTimeoutRef  = useRef(null)
  const diaScrollRef     = useRef(null)
  const semanaScrollRef  = useRef(null)

  useEffect(() => {
    api.get('/auth/usuarios-rol2/').then(r => setUsuarios(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const onResize = () => {
      setCompacto(window.innerWidth <= 768)
      setUltraCompacto(window.innerWidth < 640)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const mostrarToast = (mensaje, tipo = 'exito') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToast({ mensaje, tipo })
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3200)
  }
  useEffect(() => () => { if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current) }, [])

  const queryClient = useQueryClient()
  // `actividades` vive en la caché de TanStack Query bajo una única clave
  // estable (no una por mes/vista) para que sobreviva a navegar fuera del
  // calendario y volver. La carga real es imperativa (ver `cargar` abajo):
  // solo pide los meses que aún faltan según `mesesCargadosRef` y mezcla el
  // resultado en la caché por id — por eso useQuery va con `enabled: false`
  // (nunca dispara su propio fetch) y solo se usa para leer/reaccionar a lo
  // que `queryClient.setQueryData` va escribiendo.
  const { data: actividadesBase = [] } = useQuery({
    queryKey: ACTIVIDADES_QUERY_KEY,
    queryFn: () => queryClient.getQueryData(ACTIVIDADES_QUERY_KEY) ?? [],
    enabled: false,
    initialData: [],
  })
  // Un límite que vence con la página abierta pasa a "vencido" solo, sin sondear
  // cada cierto tiempo: se programa UN temporizador hacia el próximo límite por
  // vencer (en un recordatorio de límite, la hora de fin es la hora límite). Al
  // llegar, se marca en rojo al instante con el cálculo local y se confirma con
  // el servidor (por si ese FUS se concluyó o prorrogó mientras tanto). También
  // se revisa al volver a la pestaña, por si el equipo estuvo suspendido o en
  // segundo plano.
  const [ahora, setAhora] = useState(() => new Date())

  // Vuelve a pedir los meses ya cargados y REEMPLAZA lo que había de esos meses:
  // así se corrigen vencidos que dejaron de serlo (prórroga) y desaparecen los
  // FUS concluidos, cosa que el simple "mezclar por id" no hace.
  const confirmarConServidor = useCallback(async () => {
    const meses = [...mesesCargadosRef.current]
    if (meses.length === 0) return
    try {
      const respuestas = await Promise.all(meses.map(mes => api.get('/actividades/', { params: { mes } })))
      const nuevas = respuestas.flatMap(respuesta => respuesta.data || [])
      const recargados = new Set(meses)
      queryClient.setQueryData(ACTIVIDADES_QUERY_KEY, prev => [
        ...(prev || []).filter(a => !recargados.has(a.fecha.slice(0, 7))),
        ...nuevas,
      ])
    } catch {
      // Sin conexión o error: se queda el cálculo local; la próxima carga lo corrige.
    }
  }, [queryClient])

  const actividades = useMemo(
    () => actividadesBase.map(a => (
      !a.vencido && a.tipo === 'limite' && finDeActividad(a) <= ahora ? { ...a, vencido: true } : a
    )),
    [actividadesBase, ahora],
  )
  useEffect(() => {
    let timer
    const programar = () => {
      clearTimeout(timer)
      const ahoraReal = new Date()
      let proximo = null
      for (const a of actividadesBase) {
        if (a.tipo !== 'limite' || a.vencido) continue
        const fin = finDeActividad(a)
        if (fin > ahoraReal && (!proximo || fin < proximo)) proximo = fin
      }
      if (!proximo) return
      // Tope de ~23 días (setTimeout no admite más de 2^31 ms); si el límite es
      // más lejano, al disparar simplemente se reprograma.
      const espera = Math.min(proximo - ahoraReal + 500, 2_000_000_000)
      timer = setTimeout(() => { setAhora(new Date()); confirmarConServidor(); programar() }, espera)
    }
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return
      setAhora(new Date())
      // Solo se consulta si, mientras estuvo oculta, algún límite ya pasó.
      const ahoraReal = new Date()
      if (actividadesBase.some(a => a.tipo === 'limite' && !a.vencido && finDeActividad(a) <= ahoraReal)) confirmarConServidor()
      programar()
    }
    programar()
    document.addEventListener('visibilitychange', alVolver)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', alVolver) }
  }, [actividadesBase, confirmarConServidor])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)

  const cargar = useCallback(async () => {
    // Además de la vista principal: el mes del mini-calendario (sus puntos) y
    // la semana en curso (la agenda de abajo), que puede cruzar de mes.
    const meses = [...new Set([
      ...mesesNecesarios(vista, current),
      toKeyMes(miniCursor),
      ...mesesNecesarios('semana', new Date()),
    ])]
    const faltantes = meses.filter(m => !mesesCargadosRef.current.has(m))
    if (faltantes.length === 0) { setCargando(false); return }
    setCargando(true)
    try {
      const respuestas = await Promise.all(
        faltantes.map(mes => api.get('/actividades/', { params: { mes } })),
      )
      faltantes.forEach(mes => mesesCargadosRef.current.add(mes))
      const nuevas = respuestas.flatMap(response => response.data || [])
      queryClient.setQueryData(ACTIVIDADES_QUERY_KEY, prev => combinarActividades(prev || [], nuevas))
      setErrorCarga(null)
    } catch (e) {
      setErrorCarga(e)
    } finally {
      setCargando(false)
    }
  }, [current, vista, miniCursor, queryClient])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- inicia la carga de los meses que falten para la vista actual
  useEffect(() => { cargar() }, [cargar])

  const refrescar = () => {
    mesesCargadosRef.current = new Set()
    queryClient.setQueryData(ACTIVIDADES_QUERY_KEY, [])
    cargar()
  }

  /* En vivo: si llega por WebSocket un nuevo turnado (ROL2) con fecha límite,
     el backend ya nos agregó como participante de la Actividad — refrescar
     (sin vaciar actividades: solo se agregan las nuevas, vía merge por id). */
  useEffect(() => {
    if (!notifCtx?.turnadoKey) return
    mesesCargadosRef.current = new Set()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza la caché con un evento WebSocket externo
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `cargar` se recrea cada render; solo debe dispararse al llegar un turnado nuevo
  }, [notifCtx?.turnadoKey])

  /* Al entrar a Día/Semana, arrancar el scroll cerca de horario hábil (~7 a. m.)
     en vez de medianoche, para no tener que desplazar manualmente cada vez. */
  useEffect(() => {
    requestAnimationFrame(() => {
      if (vista === 'dia' && diaScrollRef.current) diaScrollRef.current.scrollTop = 7 * 60 - 20
      if (vista === 'semana' && semanaScrollRef.current) semanaScrollRef.current.scrollTop = 7 * ALTURA_HORA - 20
    })
  }, [vista, current])

  const irAHoy = () => { const d = new Date(); setCurrent(d); setMiniCursor(d); setDiaAgenda(null) }
  const avanzar = (dir) => {
    setCurrent(prev => {
      const d = new Date(prev)
      if (vista === 'mes') d.setMonth(d.getMonth() + dir)
      else if (vista === 'semana') d.setDate(d.getDate() + dir * 7)
      else d.setDate(d.getDate() + dir)
      return d
    })
  }
  const cambiarMesMini = (dir) => setMiniCursor(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + dir); return d })

  const flashDiaRef = useRef(null)
  const [flashTick, setFlashTick] = useState(0)
  // Día elegido en el mini-calendario: la agenda de abajo lista ese día en
  // lugar de la semana en curso. Volver a tocarlo lo deselecciona.
  const [diaAgenda, setDiaAgenda] = useState(null)
  const seleccionarDiaMini = (d) => {
    setDiaAgenda(prev => (prev && isSameDay(prev, d) ? null : d))
    setMiniCursor(d)
    setCurrent(d)
    setVista('mes')
    flashDiaRef.current = toISODate(d)
    setFlashTick(t => t + 1)
  }
  useEffect(() => {
    if (!flashDiaRef.current) return
    const fecha = flashDiaRef.current
    flashDiaRef.current = null
    requestAnimationFrame(() => {
      const el = document.querySelector(`.cal-grid-celda[data-fecha="${fecha}"]`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('cell-flash')
      setTimeout(() => el.classList.remove('cell-flash'), 1000)
    })
  }, [flashTick, current, vista])

  const abrirDia = (d) => { setCurrent(d); setVista('dia') }

  // Detalle flotante al pasar el cursor por una actividad (agenda o calendario
  // grande). Solo con puntero real; en táctil no aplica.
  const [hover, setHover] = useState(null)
  const hoverTimerRef = useRef(null)
  const mostrarDetalle = (ev, el) => {
    if (!window.matchMedia?.('(hover: hover)').matches) return
    clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => {
      setHover({ ev, rect: el.getBoundingClientRect(), sidebar: el.closest('.cal-sidebar')?.getBoundingClientRect() || null })
    }, 200)
  }
  const ocultarDetalle = () => { clearTimeout(hoverTimerRef.current); setHover(null) }
  useEffect(() => {
    // Cualquier scroll (lista, calendario o página) deja el detalle fuera de lugar
    const ocultar = () => { clearTimeout(hoverTimerRef.current); setHover(null) }
    window.addEventListener('scroll', ocultar, true)
    return () => { window.removeEventListener('scroll', ocultar, true); clearTimeout(hoverTimerRef.current) }
  }, [])

  // Vista rápida del FUS ligado a una actividad, sin salir del calendario.
  // El Comisionado no tiene acceso a ese detalle: se le lleva a su bandeja.
  const verFus = (folio) => {
    if (!folio) return
    if (user?.rol === 'COMISIONADO') {
      navigate(`/comisionado/fus-comisionados?folio=${encodeURIComponent(folio)}`)
      return
    }
    setFusRapido(folio)
  }

  // Del resumen rápido al FUS completo, en la pantalla de consulta de cada rol.
  const verFusCompleto = (folio) => {
    setFusRapido(null)
    const ruta = user?.rol === 'ROL2' ? '/rol2/solicitudes'
      : user?.rol === 'COMISIONADO' ? '/comisionado/fus-comisionados'
      : '/rol1/consultar-fus'
    navigate(`${ruta}?folio=${encodeURIComponent(folio)}`)
  }

  const abrirCrear = (fecha, hora) => {
    setModal({
      mode: 'crear',
      fecha: toISODate(fecha),
      horaInicio: hora || '09:00',
      horaFin: hora ? sumarHora(hora) : '10:00',
    })
  }
  const abrirEditar = (a) => {
    setModal({ mode: 'editar', ...a })
  }

  const onGuardado = (guardada) => {
    setModal(null)
    refrescar()
    // Lleva el calendario al día guardado y resalta la actividad.
    const [anio, mes, dia] = (guardada?.fecha || '').split('-').map(Number)
    if (anio && mes && dia) {
      const fecha = new Date(anio, mes - 1, dia)
      setCurrent(fecha)
      setMiniCursor(fecha)
      mostrarToast(`Actividad guardada: ${DIAS_SEMANA_FULL[fecha.getDay()]} ${dia} de ${MESES[mes - 1]}, ${guardada.horaInicio?.slice(0, 5)} – ${guardada.horaFin?.slice(0, 5)}.`)
    } else {
      mostrarToast('La actividad fue registrada correctamente.')
    }
    if (guardada?.id) {
      pendienteScrollRef.current = guardada.id
      setResaltadoId(guardada.id)
      if (resaltadoTimeoutRef.current) clearTimeout(resaltadoTimeoutRef.current)
      resaltadoTimeoutRef.current = setTimeout(() => setResaltadoId(null), 5000)
    }
  }
  useEffect(() => () => { if (resaltadoTimeoutRef.current) clearTimeout(resaltadoTimeoutRef.current) }, [])

  // Cuando la actividad guardada ya está pintada, se lleva a la vista. En la
  // vista Mes, si cayó en el "+N más" de su celda, se resalta la celda del día.
  useEffect(() => {
    const id = pendienteScrollRef.current
    if (!id || !actividades.some(a => a.id === id)) return
    requestAnimationFrame(() => {
      let el = document.querySelector(`.cal-main [data-actividad-id="${id}"]`)
      if (!el) {
        const guardada = actividades.find(a => a.id === id)
        el = guardada && document.querySelector(`.cal-grid-celda[data-fecha="${guardada.fecha}"]`)
        el?.classList.add('cell-flash')
        setTimeout(() => el?.classList.remove('cell-flash'), 1000)
      }
      if (!el) return
      pendienteScrollRef.current = null
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [actividades, current, vista])
  const onEliminado = () => {
    setModal(null)
    refrescar()
    mostrarToast('Actividad eliminada.')
  }
  const onErrorModal = (detalle) => mostrarToast(detalle, 'error')

  const actividadesPorDia = useMemo(() => {
    const map = {}
    actividades.forEach(a => {
      map[a.fecha] = map[a.fecha] || []
      map[a.fecha].push(a)
    })
    Object.values(map).forEach(lista => lista.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)))
    return map
  }, [actividades])

  // Cuántas actividades de cada tipo hay en el periodo que se está viendo
  // (mes, semana o día) — alimenta la leyenda de colores del encabezado.
  const conteosPeriodo = useMemo(() => {
    let dentro
    if (vista === 'mes') {
      const clave = toKeyMes(current)
      dentro = fecha => fecha.startsWith(clave)
    } else if (vista === 'semana') {
      const inicio = startOfWeek(current)
      const dias = new Set(Array.from({ length: 7 }, (_, i) => { const d = new Date(inicio); d.setDate(d.getDate() + i); return toISODate(d) }))
      dentro = fecha => dias.has(fecha)
    } else {
      const clave = toISODate(current)
      dentro = fecha => fecha === clave
    }
    const conteo = {}
    actividades.forEach(a => {
      if (!dentro(a.fecha)) return
      const clave = a.vencido ? 'vencido' : a.tipo
      conteo[clave] = (conteo[clave] || 0) + 1
    })
    return conteo
  }, [actividades, vista, current])
  const nombrePeriodo = vista === 'mes' ? 'este mes' : vista === 'semana' ? 'esta semana' : 'este día'

  const hoy = new Date()
  const hayDatos = actividades.length > 0
  const mostrandoErrorTotal = !cargando && errorCarga && !hayDatos

  let tituloHeader
  if (vista === 'mes') {
    tituloHeader = `${MESES[current.getMonth()]} ${current.getFullYear()}`
  } else if (vista === 'semana') {
    const sw = startOfWeek(current)
    const ew = new Date(sw); ew.setDate(ew.getDate() + 6)
    tituloHeader = sw.getMonth() === ew.getMonth()
      ? `${sw.getDate()}–${ew.getDate()} de ${MESES[sw.getMonth()]}`
      : `${sw.getDate()} ${MESES[sw.getMonth()].slice(0, 3)} – ${ew.getDate()} ${MESES[ew.getMonth()].slice(0, 3)}`
  } else {
    tituloHeader = `${DIAS_SEMANA_FULL[current.getDay()]} ${current.getDate()} de ${MESES[current.getMonth()]}`
  }

  return (
    <AppLayout>
      <div className="cal-page">
        {/* ── Sidebar propio del calendario ── */}
        <div className={`cal-sidebar${compacto ? ' panel-cerrado' : ''}`}>
          <div className="panel-header">
            <div className="panel-header-left"><h3 className="panel-title">Calendario</h3></div>
          </div>

          {!compacto && (
            <div className="cal-sidebar-content">
              <button type="button" className="cal-btn-nueva-sidebar" onClick={() => abrirCrear(current)}>
                <span className="cal-btn-nueva-icon">+</span>
                Nueva actividad
              </button>

              {/* Dos tarjetas separadas: mini-calendario y, debajo, la agenda */}
              <div className="cal-mini-grupo">
                <MiniCalendario
                  mesCursor={miniCursor}
                  seleccionado={current}
                  actividadesPorDia={actividadesPorDia}
                  onCambiarMes={cambiarMesMini}
                  onSeleccionarDia={seleccionarDiaMini}
                />

                <AgendaSemana
                  actividades={actividades}
                  diaSeleccionado={diaAgenda}
                  resaltadoId={resaltadoId}
                  mostrarDetalle={mostrarDetalle}
                  ocultarDetalle={ocultarDetalle}
                  onAbrir={abrirEditar}
                  onVerFus={verFus}
                  onLimpiarDia={() => setDiaAgenda(null)}
                />
              </div>

              <div className="cal-hoy-label">
                Hoy: {DIAS_SEMANA_FULL[hoy.getDay()]} {hoy.getDate()} de {MESES[hoy.getMonth()]}
              </div>
            </div>
          )}

        </div>

        {/* ── Panel principal ── */}
        <div className="cal-main">
          {errorCarga && hayDatos && (
            <div className="banner-error-carga">
              <span>No se pudo actualizar — mostrando la última información disponible.</span>
              <button type="button" onClick={cargar}>Reintentar</button>
            </div>
          )}

          <div className="cal-toolbar">
            <div className="cal-toolbar-nav">
              <button type="button" className="cal-btn-hoy" onClick={irAHoy}>Hoy</button>
              <button type="button" className="cal-btn-flecha" onClick={() => avanzar(-1)} aria-label="Anterior">‹</button>
              <button type="button" className="cal-btn-flecha" onClick={() => avanzar(1)} aria-label="Siguiente">›</button>
              <span className="cal-toolbar-titulo">{tituloHeader}</span>
              <ul className="cal-toolbar-leyenda" aria-label="Tipos de actividad">
                {[...Object.entries(TIPO_INFO), ['vencido', INFO_VENCIDO]].map(([key, info]) => {
                  const total = conteosPeriodo[key] || 0
                  return (
                    <li key={key} className={`cal-toolbar-leyenda-item${key === 'vencido' ? ' cal-toolbar-leyenda-item-vencido' : ''}${total ? '' : ' cal-toolbar-leyenda-item-vacio'}`} title={`${info.label}: ${total} ${nombrePeriodo}`}>
                      <span className="cal-leyenda-dot" style={{ background: info.color }} />
                      {info.label}
                      <span className="cal-leyenda-conteo">{total}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="cal-toolbar-right">
              <div className="cal-toggle-vista">
                <button type="button" className={vista === 'mes' ? 'activo' : ''} onClick={() => setVista('mes')}>Mes</button>
                <button type="button" className={vista === 'semana' ? 'activo' : ''} onClick={() => setVista('semana')}>Semana</button>
                <button type="button" className={vista === 'dia' ? 'activo' : ''} onClick={() => setVista('dia')}>Día</button>
              </div>
            </div>
          </div>

          {cargando && !hayDatos && <Spinner overlay={false} fill label="Cargando calendario…" />}

          {mostrandoErrorTotal && (
            <div className="cal-error-state">
              <p className="cal-error-msg">No se pudo cargar el calendario.</p>
              <button type="button" className="btn-reintentar" onClick={cargar}>Reintentar</button>
            </div>
          )}

          {!mostrandoErrorTotal && !(cargando && !hayDatos) && vista === 'mes' && (
            <div className="cal-grid">
              {(ultraCompacto ? DIAS_SEMANA_MIN : compacto ? DIAS_SEMANA : DIAS_SEMANA_FULL).map((d, i) => <div key={`${d}-${i}`} className="cal-grid-dia-header">{d}</div>)}
              {construirGrid(current).map((c, i) => {
                const key = toISODate(c)
                const fueraDeMes = c.getMonth() !== current.getMonth()
                const eventos = (fueraDeMes && ultraCompacto) ? [] : (actividadesPorDia[key] || [])
                const limiteChips = ultraCompacto ? 1 : compacto ? 2 : 3
                const mostrados = eventos.slice(0, limiteChips)
                const esHoy = isSameDay(c, hoy)
                return (
                  <div key={i} data-fecha={key} className={`cal-grid-celda${fueraDeMes ? ' cal-celda-fuera' : ''}`} onClick={() => { ultraCompacto ? setCurrent(c) : abrirDia(c) }}>
                    <div className="cal-celda-numero-wrap">
                      <span className={`cal-celda-numero${esHoy ? ' cal-celda-numero-hoy' : ''}`}>{c.getDate()}</span>
                    </div>
                    <div className="cal-celda-eventos">
                      {mostrados.map(ev => {
                        const info = infoDe(ev)
                        return (
                          <span
                            key={ev.id}
                            className={`cal-evento-chip${ev.vencido ? ' cal-evento-vencido' : ''}${resaltadoId === ev.id ? ' cal-resaltado' : ''}`}
                            data-actividad-id={ev.id}
                            onMouseEnter={e => mostrarDetalle(ev, e.currentTarget)}
                            onMouseLeave={ocultarDetalle}
                            style={{ background: info.chipBg, color: info.chipText }}
                            title={tituloDe(ev)}
                            onClick={e => { e.stopPropagation(); ocultarDetalle(); ultraCompacto ? setCurrent(c) : abrirEditar(ev) }}
                          >
                            {tituloDe(ev)}
                          </span>
                        )
                      })}
                      {eventos.length > limiteChips && <span className="cal-evento-mas">+{eventos.length - limiteChips}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!mostrandoErrorTotal && !(cargando && !hayDatos) && vista === 'mes' && ultraCompacto && (
            <div className="cal-dia-panel">
              <div className="cal-dia-panel-header">
                <span>{DIAS_SEMANA_FULL[current.getDay()]} {current.getDate()} de {MESES[current.getMonth()]}</span>
                <button type="button" className="cal-dia-panel-agregar" onClick={() => abrirCrear(current)}>
                  <span className="cal-btn-nueva-icon">+</span>
                  Agregar actividad
                </button>
              </div>
              {(actividadesPorDia[toISODate(current)] || []).length === 0 ? (
                <p className="cal-dia-panel-vacio">Sin actividades este día.</p>
              ) : (
                <div className="cal-dia-panel-list" tabIndex="0" aria-label="Actividades del día">
                  {(actividadesPorDia[toISODate(current)] || []).map(ev => {
                    const info = infoDe(ev)
                    return (
                      <div key={ev.id} className={`cal-dia-panel-item${resaltadoId === ev.id ? ' cal-resaltado' : ''}`} data-actividad-id={ev.id} onClick={() => abrirEditar(ev)}>
                        <span className="cal-dia-panel-dot" style={{ background: info.color }} />
                        <div className="cal-dia-panel-info">
                          <span className="cal-dia-panel-titulo">{tituloDe(ev)}</span>
                          <span className="cal-dia-panel-hora">{ev.horaInicio} – {ev.horaFin}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {!mostrandoErrorTotal && !(cargando && !hayDatos) && vista === 'semana' && (
            <div className="cal-semana-wrap">
              <div className="cal-semana-header">
                <div className="cal-semana-gutter" />
                {Array.from({ length: 7 }, (_, i) => { const d = new Date(startOfWeek(current)); d.setDate(d.getDate() + i); return d }).map((d, i) => (
                  <div key={i} className="cal-semana-header-dia" onClick={() => abrirDia(d)}>
                    <div className="cal-semana-header-wd">{DIAS_SEMANA[d.getDay()]}</div>
                    <div className={`cal-semana-header-num${isSameDay(d, hoy) ? ' cal-semana-header-num-hoy' : ''}`}>{d.getDate()}</div>
                  </div>
                ))}
              </div>
              <div className="cal-semana-body" ref={semanaScrollRef}>
                <div className="cal-semana-horas">
                  {HORAS.map(h => <div key={h} className="cal-hora-label">{h}</div>)}
                </div>
                {Array.from({ length: 7 }, (_, i) => { const d = new Date(startOfWeek(current)); d.setDate(d.getDate() + i); return d }).map((d, i) => {
                  const key = toISODate(d)
                  const eventos = actividadesPorDia[key] || []
                  return (
                    <div key={i} className="cal-semana-col" onClick={e => abrirCrear(d, horaDesdeClick(e, ALTURA_HORA))}>
                      {HORAS.map(h => <div key={h} className="cal-hora-slot" />)}
                      {eventos.map(ev => {
                        const info = infoDe(ev)
                        const top = (minutos(ev.horaInicio) / 60) * ALTURA_HORA
                        const alto = Math.max(((minutos(ev.horaFin) - minutos(ev.horaInicio)) / 60) * ALTURA_HORA, 16)
                        return (
                          <div
                            key={ev.id}
                            className={`cal-semana-evento${ev.vencido ? ' cal-evento-vencido' : ''}${resaltadoId === ev.id ? ' cal-resaltado' : ''}`}
                            data-actividad-id={ev.id}
                            onMouseEnter={e => mostrarDetalle(ev, e.currentTarget)}
                            onMouseLeave={ocultarDetalle}
                            style={{ top, height: alto, background: info.chipBg, borderLeftColor: info.color, color: info.chipText }}
                            onClick={e => { e.stopPropagation(); ocultarDetalle(); abrirEditar(ev) }}
                          >
                            {tituloDe(ev)}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!mostrandoErrorTotal && !(cargando && !hayDatos) && vista === 'dia' && (
            <div className="cal-dia-wrap" ref={diaScrollRef}>
              <div className="cal-dia-grid">
                <div className="cal-dia-horas">
                  {HORAS.map(h => <div key={h} className="cal-hora-label">{h}</div>)}
                </div>
                <div className="cal-dia-col" onClick={e => abrirCrear(current, horaDesdeClick(e, ALTURA_HORA_DIA))}>
                  {HORAS.map(h => <div key={h} className="cal-hora-slot-dia" />)}
                  {(actividadesPorDia[toISODate(current)] || []).map(ev => {
                    const info = infoDe(ev)
                    const top = (minutos(ev.horaInicio) / 60) * ALTURA_HORA_DIA
                    const alto = Math.max(((minutos(ev.horaFin) - minutos(ev.horaInicio)) / 60) * ALTURA_HORA_DIA, 22)
                    return (
                      <div
                        key={ev.id}
                        className={`cal-dia-evento${ev.vencido ? ' cal-evento-vencido' : ''}${resaltadoId === ev.id ? ' cal-resaltado' : ''}`}
                        data-actividad-id={ev.id}
                        onMouseEnter={e => mostrarDetalle(ev, e.currentTarget)}
                        onMouseLeave={ocultarDetalle}
                        style={{ top, height: alto, background: info.chipBg, borderLeftColor: info.color }}
                        onClick={e => { e.stopPropagation(); ocultarDetalle(); abrirEditar(ev) }}
                      >
                        <div className="cal-dia-evento-titulo" style={{ color: info.chipText }}>{tituloDe(ev)}</div>
                        <div className="cal-dia-evento-hora" style={{ color: info.chipText }}>{ev.horaInicio} – {ev.horaFin}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <ModalActividad
          modal={modal}
          usuarios={usuarios}
          esCreador={modal.mode === 'crear' || modal.idCreador === user?.id}
          onClose={() => setModal(null)}
          onGuardado={onGuardado}
          onEliminado={onEliminado}
          onError={onErrorModal}
          onVerFus={verFus}
        />
      )}

      {fusRapido && <ModalDetalleFUS folio={fusRapido} onClose={() => setFusRapido(null)} onVerCompleto={() => verFusCompleto(fusRapido)} />}

      {hover && <DetalleActividadFlotante ev={hover.ev} rect={hover.rect} sidebar={hover.sidebar} />}

      <Toast toast={toast} sobreModal={!!modal} />
    </AppLayout>
  )
}
