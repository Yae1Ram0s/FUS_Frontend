import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import { useNotificaciones } from '../context/NotificacionesContext'
import FusFolioPicker from '../components/Calendario/FusFolioPicker'
import FechaInput from '../components/FechaInput'
import './CalendarioActividades.css'

const TIPO_INFO = {
  reunion:       { label: 'Reunión',       color: '#5b7fe0', chipBg: '#5b7fe0', chipText: '#ffffff' },
  fus:           { label: 'FUS vinculado', color: '#4a9d6f', chipBg: '#4a9d6f', chipText: '#ffffff' },
  limite:        { label: 'Fecha límite',  color: '#dd9a3a', chipBg: '#dd9a3a', chipText: '#ffffff' },
}

const DIAS_SEMANA      = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_SEMANA_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DIAS_SEMANA_MIN  = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const HORAS = Array.from({ length: 24 }, (_, h) => h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`)
const ALTURA_HORA = 56
const ALTURA_HORA_DIA = 60

const ACTIVIDADES_QUERY_KEY = ['actividades']

function combinarActividades(anteriores, nuevas) {
  const ids = new Set(anteriores.map(actividad => actividad.id))
  return [
    ...anteriores,
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

/* ── Modal: nueva actividad / editar actividad ── */
function ModalActividad({ modal, usuarios, esCreador, onClose, onGuardado, onEliminado, onError }) {
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
  const [conflicto, setConflicto] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const guardarEnCursoRef = useRef(false)
  const eliminarEnCursoRef = useRef(false)
  const { user } = useAuth()
  const soloLectura = modal.mode === 'editar' && !esCreador

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const onFolioSeleccionado = (folio) => {
    set('folioFus', folio || '')
    if (!folio) setFusEncontrado(null)
  }
  const onFusSeleccionado = (item) => setFusEncontrado(item ? { id: item.id, folio: item.folio } : null)

  const enfocarCampo = (e) => {
    e.target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const toggleParticipante = (id) => {
    setForm(f => ({
      ...f,
      participantes: f.participantes.includes(id)
        ? f.participantes.filter(p => p !== id)
        : [...f.participantes, id],
    }))
  }

  const validar = () => {
    if (!form.titulo.trim()) return 'Completa todos los campos obligatorios para registrar la actividad.'
    if (!form.fecha || !form.horaInicio || !form.horaFin) return 'Completa todos los campos obligatorios para registrar la actividad.'
    if (form.horaFin <= form.horaInicio) return 'La fecha u hora seleccionada no es válida.'
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
    const msg = validar()
    if (msg) { setError(msg); setConflicto(null); return }
    if (guardarEnCursoRef.current) return
    guardarEnCursoRef.current = true
    setError(''); setGuardando(true)
    try {
      if (modal.mode === 'crear') {
        await api.post('/actividades/', construirPayload(forzar))
      } else {
        await api.patch(`/actividades/${modal.id}/`, construirPayload(forzar))
      }
      onGuardado()
    } catch (e) {
      if (e.response?.status === 409) {
        setConflicto(e.response.data?.detail || 'Ya existe otra actividad en ese horario.')
      } else {
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
    try {
      await api.delete(`/actividades/${modal.id}/`)
      onEliminado()
    } catch {
      onError('No se pudo eliminar la actividad.')
    } finally {
      setEliminando(false)
      eliminarEnCursoRef.current = false
    }
  }

  return createPortal(
    <div className="cal-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="cal-modal" onClick={e => e.stopPropagation()}>
        <div className="cal-modal-top">
          <h3>{modal.mode === 'crear' ? 'Nueva actividad' : 'Editar actividad'}</h3>
          <button type="button" className="cal-modal-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {error && <div className="cal-modal-alert cal-modal-alert-error">{error}</div>}

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

        <input
          className="cal-pill-input"
          value={form.titulo}
          onChange={e => set('titulo', e.target.value)}
          onFocus={enfocarCampo}
          placeholder="Título de la actividad"
          disabled={soloLectura}
        />

        <div className="cal-pill-clip">
          <FechaInput
            className="cal-pill-input"
            wrapClassName="cal-pill-input-wrap"
            type="date"
            value={form.fecha}
            onChange={e => set('fecha', e.target.value)}
            onFocus={enfocarCampo}
            disabled={soloLectura}
          />
        </div>

        <div className="cal-modal-row2">
          <div className="cal-pill-clip">
            <input className="cal-pill-input" type="time" value={form.horaInicio} onChange={e => set('horaInicio', e.target.value)} onFocus={enfocarCampo} disabled={soloLectura} />
          </div>
          <div className="cal-pill-clip">
            <input className="cal-pill-input" type="time" value={form.horaFin} onChange={e => set('horaFin', e.target.value)} onFocus={enfocarCampo} disabled={soloLectura} />
          </div>
        </div>

        <select className="cal-pill-input" value={form.tipo} onChange={e => set('tipo', e.target.value)} onFocus={enfocarCampo} disabled={soloLectura}>
          {Object.entries(TIPO_INFO).map(([key, info]) => (
            <option key={key} value={key}>{info.label}</option>
          ))}
        </select>

        <textarea
          className="cal-pill-input cal-pill-textarea"
          value={form.descripcion}
          onChange={e => set('descripcion', e.target.value)}
          onFocus={enfocarCampo}
          placeholder="Descripción (opcional)"
          rows={2}
          disabled={soloLectura}
        />

        <FusFolioPicker
          value={form.folioFus || null}
          onChange={onFolioSeleccionado}
          onSelect={onFusSeleccionado}
          disabled={soloLectura}
        />

        {user?.rol !== 'ROL2' && (
          <div className="cal-modal-participantes">
            <p className="cal-modal-label">Participantes</p>
            <div className="cal-participantes-lista">
              {usuarios.map(u => (
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
            </div>
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
  const [toast, setToast]       = useState(null)
  const [panelAbierto, setPanelAbierto] = useState(() => window.innerWidth > 768)
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
  const { data: actividades = [] } = useQuery({
    queryKey: ACTIVIDADES_QUERY_KEY,
    queryFn: () => queryClient.getQueryData(ACTIVIDADES_QUERY_KEY) ?? [],
    enabled: false,
    initialData: [],
  })
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)

  const cargar = useCallback(async () => {
    const meses = mesesNecesarios(vista, current)
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
  }, [current, vista, queryClient])

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

  const irAHoy = () => { const d = new Date(); setCurrent(d); setMiniCursor(d) }
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
  const seleccionarDiaMini = (d) => {
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

  const onGuardado = () => {
    setModal(null)
    refrescar()
    mostrarToast('La actividad fue registrada correctamente.')
  }
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
        <div className={`cal-sidebar${!panelAbierto ? ' panel-cerrado' : ''}`}>
          <div className="panel-header">
            {panelAbierto && <div className="panel-header-left"><h3 className="panel-title">Calendario</h3></div>}
            <button className="panel-toggle" onClick={() => setPanelAbierto(p => !p)} title={panelAbierto ? 'Cerrar panel' : 'Abrir panel'}>
              <svg className={panelAbierto ? 'panel-toggle-icon-open' : 'panel-toggle-icon-closed'} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {panelAbierto ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
              </svg>
            </button>
          </div>

          {panelAbierto && (
            <div className="cal-sidebar-content">
              <button type="button" className="cal-btn-nueva-sidebar" onClick={() => abrirCrear(current)}>
                <span className="cal-btn-nueva-icon">+</span>
                Nueva actividad
              </button>

              <MiniCalendario
                mesCursor={miniCursor}
                seleccionado={current}
                actividadesPorDia={actividadesPorDia}
                onCambiarMes={cambiarMesMini}
                onSeleccionarDia={seleccionarDiaMini}
              />

              <div className="cal-leyenda">
                <p className="cal-leyenda-title">Tipos de actividad</p>
                {Object.entries(TIPO_INFO).map(([key, info]) => (
                  <div key={key} className="cal-leyenda-item">
                    <span className="cal-leyenda-dot" style={{ background: info.color }} />
                    {info.label}
                  </div>
                ))}
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
                        const info = TIPO_INFO[ev.tipo] || TIPO_INFO.reunion
                        return (
                          <span
                            key={ev.id}
                            className="cal-evento-chip"
                            style={{ background: info.chipBg, color: info.chipText }}
                            title={ev.titulo}
                            onClick={e => { e.stopPropagation(); ultraCompacto ? setCurrent(c) : abrirEditar(ev) }}
                          >
                            {ev.titulo}
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
                    const info = TIPO_INFO[ev.tipo] || TIPO_INFO.reunion
                    return (
                      <div key={ev.id} className="cal-dia-panel-item" onClick={() => abrirEditar(ev)}>
                        <span className="cal-dia-panel-dot" style={{ background: info.color }} />
                        <div className="cal-dia-panel-info">
                          <span className="cal-dia-panel-titulo">{ev.titulo}</span>
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
                        const info = TIPO_INFO[ev.tipo] || TIPO_INFO.reunion
                        const top = (minutos(ev.horaInicio) / 60) * ALTURA_HORA
                        const alto = Math.max(((minutos(ev.horaFin) - minutos(ev.horaInicio)) / 60) * ALTURA_HORA, 16)
                        return (
                          <div
                            key={ev.id}
                            className="cal-semana-evento"
                            style={{ top, height: alto, background: info.chipBg, borderLeftColor: info.color, color: info.chipText }}
                            onClick={e => { e.stopPropagation(); abrirEditar(ev) }}
                          >
                            {ev.titulo}
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
                    const info = TIPO_INFO[ev.tipo] || TIPO_INFO.reunion
                    const top = (minutos(ev.horaInicio) / 60) * ALTURA_HORA_DIA
                    const alto = Math.max(((minutos(ev.horaFin) - minutos(ev.horaInicio)) / 60) * ALTURA_HORA_DIA, 22)
                    return (
                      <div
                        key={ev.id}
                        className="cal-dia-evento"
                        style={{ top, height: alto, background: info.chipBg, borderLeftColor: info.color }}
                        onClick={e => { e.stopPropagation(); abrirEditar(ev) }}
                      >
                        <div className="cal-dia-evento-titulo" style={{ color: info.chipText }}>{ev.titulo}</div>
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
        />
      )}

      <Toast toast={toast} sobreModal={!!modal} />
    </AppLayout>
  )
}
