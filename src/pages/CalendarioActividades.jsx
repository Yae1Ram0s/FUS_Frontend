import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import { useResizablePanel } from '../hooks/useResizablePanel'
import './CalendarioActividades.css'

const TIPO_INFO = {
  reunion:       { label: 'Reunión',       color: '#5b7fe0' },
  fus:           { label: 'FUS vinculado', color: '#4a9d6f' },
  limite:        { label: 'Fecha límite',  color: '#e0955b' },
  institucional: { label: 'Institucional', color: '#8a6fd6' },
}

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const toKeyMes  = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const toISODate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

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

/* ── Mini-calendario navegable del sidebar ── */
function MiniCalendario({ mesActual, onCambiarMes }) {
  const celdas = useMemo(() => construirGrid(mesActual), [mesActual])
  const hoy = new Date()
  return (
    <div className="cal-mini">
      <div className="cal-mini-header">
        <button type="button" onClick={() => onCambiarMes(-1)} aria-label="Mes anterior">‹</button>
        <span>{MESES[mesActual.getMonth()]} {mesActual.getFullYear()}</span>
        <button type="button" onClick={() => onCambiarMes(1)} aria-label="Mes siguiente">›</button>
      </div>
      <div className="cal-mini-dias">
        {DIAS_SEMANA.map(d => <span key={d}>{d[0]}</span>)}
      </div>
      <div className="cal-mini-grid">
        {celdas.map((c, i) => (
          <span
            key={i}
            className={`cal-mini-dia${c.getMonth() !== mesActual.getMonth() ? ' cal-mini-dia-fuera' : ''}${isSameDay(c, hoy) ? ' cal-mini-dia-hoy' : ''}`}
          >
            {c.getDate()}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Modal: nueva actividad ── */
function ModalNuevaActividad({ onClose, onCreada, fechaInicial }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    titulo: '', fecha: fechaInicial, horaInicio: '09:00', horaFin: '10:00',
    descripcion: '', tipo: 'reunion', folioFus: '', participantes: [],
  })
  const [fusEncontrado, setFusEncontrado] = useState(null) // null | 'buscando' | 'no-encontrado' | {id, folio}
  const [usuarios, setUsuarios] = useState([])
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [conflicto, setConflicto] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    api.get('/auth/usuarios-rol2/').then(r => setUsuarios(r.data)).catch(() => {})
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const onFolioFusChange = (value) => {
    set('folioFus', value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const folio = value.trim()
    if (!folio) { setFusEncontrado(null); return }
    setFusEncontrado('buscando')
    debounceRef.current = setTimeout(() => {
      // /fus/ es solo para ROL1 (403 para ROL2) -- cada rol consulta el
      // listado al que sí tiene acceso.
      const esROL2 = user?.rol === 'ROL2'
      const endpoint = esROL2 ? '/turnados/mis-turnados/' : '/fus/'
      api.get(endpoint, { params: { search: folio, page_size: 5 } })
        .then(r => {
          const resultados = r.data.results || []
          const match = esROL2
            ? resultados.find(t => t.idFus?.folio === folio)
            : resultados.find(f => f.folio === folio)
          const idFus = esROL2 ? match?.idFus?.id : match?.id
          setFusEncontrado(match ? { id: idFus, folio } : 'no-encontrado')
        })
        .catch(() => setFusEncontrado('no-encontrado'))
    }, 500)
  }

  const toggleParticipante = (id) => {
    setForm(f => ({
      ...f,
      participantes: f.participantes.includes(id)
        ? f.participantes.filter(p => p !== id)
        : [...f.participantes, id],
    }))
  }

  const guardar = async (forzar = false) => {
    if (!form.titulo.trim())                          { setError('Escribe un título.'); return }
    if (!form.fecha || !form.horaInicio || !form.horaFin) { setError('Completa fecha y horario.'); return }
    if (form.horaFin <= form.horaInicio)               { setError('La hora fin debe ser posterior a la hora inicio.'); return }
    setError(''); setGuardando(true)
    try {
      await api.post('/actividades/', {
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
      onCreada()
    } catch (e) {
      if (e.response?.status === 409) {
        setConflicto(true)
      } else {
        setError(e.response?.data?.detail || 'No se pudo guardar la actividad.')
      }
    } finally {
      setGuardando(false)
    }
  }

  return createPortal(
    <div className="modal-overlay cal-modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card cal-modal">
        <div className="modal-header">
          <h3 className="modal-title">Nueva actividad</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="cal-modal-body">
          <label className="cal-modal-field">
            Título <span className="req">*</span>
            <input value={form.titulo} onChange={e => set('titulo', e.target.value)} />
          </label>

          <div className="cal-modal-row">
            <label className="cal-modal-field">
              Fecha <span className="req">*</span>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </label>
            <label className="cal-modal-field">
              Hora inicio <span className="req">*</span>
              <input type="time" value={form.horaInicio} onChange={e => set('horaInicio', e.target.value)} />
            </label>
            <label className="cal-modal-field">
              Hora fin <span className="req">*</span>
              <input type="time" value={form.horaFin} onChange={e => set('horaFin', e.target.value)} />
            </label>
          </div>

          <label className="cal-modal-field">
            Tipo
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              {Object.entries(TIPO_INFO).map(([key, info]) => (
                <option key={key} value={key}>{info.label}</option>
              ))}
            </select>
          </label>

          <label className="cal-modal-field">
            Descripción
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={3} />
          </label>

          <label className="cal-modal-field">
            Folio de FUS (opcional)
            <input
              value={form.folioFus}
              onChange={e => onFolioFusChange(e.target.value)}
              placeholder="ANAM/PARTICULAR/FUS/0001/2026"
            />
            {fusEncontrado === 'buscando'      && <span className="cal-fus-check cal-fus-buscando">Buscando…</span>}
            {fusEncontrado === 'no-encontrado' && <span className="cal-fus-check cal-fus-no">✕ No se encontró ese folio</span>}
            {fusEncontrado && typeof fusEncontrado === 'object' && <span className="cal-fus-check cal-fus-si">✓ FUS vinculado</span>}
          </label>

          <div className="cal-modal-participantes">
            <p className="cal-modal-field-label">Participantes</p>
            <div className="cal-participantes-lista">
              {usuarios.map(u => (
                <label key={u.id} className="cal-participante-item">
                  <input
                    type="checkbox"
                    checked={form.participantes.includes(u.id)}
                    onChange={() => toggleParticipante(u.id)}
                  />
                  {u.nombre || u.email}
                </label>
              ))}
              {usuarios.length === 0 && <p className="cal-participantes-vacio">Sin usuarios disponibles.</p>}
            </div>
          </div>

          {error && <p className="cal-modal-error" role="alert">{error}</p>}
        </div>

        <div className="cal-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={() => guardar(false)} disabled={guardando}>
            {guardando && <span className="btn-spinner" />}
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {conflicto && (
        <div className="modal-overlay cal-confirm-overlay" role="dialog" aria-modal="true">
          <div className="modal-card cal-confirm-modal">
            <p>Ya existe otra actividad en ese horario, ¿deseas continuar?</p>
            <div className="cal-confirm-actions">
              <button type="button" className="btn-secondary" onClick={() => setConflicto(false)}>Cancelar</button>
              <button type="button" className="btn-primary" onClick={() => { setConflicto(false); guardar(true) }}>Continuar</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

/* ── Página principal ── */
export default function CalendarioActividades() {
  const [mesActual, setMesActual]   = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [actividades, setActividades] = useState([])
  const [cargando, setCargando]     = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [vista, setVista]           = useState('mes')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [panelAbierto, setPanelAbierto] = useState(() => window.innerWidth > 768)
  const { leftWidth, containerRef, startResize } = useResizablePanel('scs_calendario_panel_w')
  const autoRetriedRef  = useRef(false)
  const retryTimeoutRef = useRef(null)

  const cargar = () => {
    setCargando(true)
    api.get('/actividades/', { params: { mes: toKeyMes(mesActual) } })
      .then(r => {
        setErrorCarga(false)
        autoRetriedRef.current = false
        if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null }
        setActividades(r.data || [])
      })
      .catch(() => {
        setErrorCarga(true)
        if (!autoRetriedRef.current) {
          autoRetriedRef.current = true
          retryTimeoutRef.current = setTimeout(cargar, 5000)
        }
      })
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargar() }, [mesActual])
  useEffect(() => () => { if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current) }, [])

  const cambiarMes = (delta) => {
    setMesActual(prev => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() + delta)
      return d
    })
  }
  const irAHoy = () => { const d = new Date(); d.setDate(1); setMesActual(d) }

  const celdas = useMemo(() => construirGrid(mesActual), [mesActual])
  const actividadesPorDia = useMemo(() => {
    const map = {}
    actividades.forEach(a => {
      map[a.fecha] = map[a.fecha] || []
      map[a.fecha].push(a)
    })
    return map
  }, [actividades])

  const hoy = new Date()

  return (
    <AppLayout>
      <div className="cal-page" ref={containerRef}>
        {/* ── Sidebar propio del calendario ── */}
        <div className={`cal-sidebar${!panelAbierto ? ' panel-cerrado' : ''}`} style={{ width: panelAbierto ? leftWidth : 44 }}>
          <div className="panel-header">
            {panelAbierto && (
              <div className="panel-header-left">
                <h3 className="panel-title">Calendario</h3>
              </div>
            )}
            <button className="panel-toggle" onClick={() => setPanelAbierto(p => !p)} title={panelAbierto ? 'Cerrar panel' : 'Abrir panel'}>
              <svg
                className={panelAbierto ? 'panel-toggle-icon-open' : 'panel-toggle-icon-closed'}
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                {panelAbierto ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
              </svg>
            </button>
          </div>

          {panelAbierto && (
            <div className="cal-sidebar-content">
              <MiniCalendario mesActual={mesActual} onCambiarMes={cambiarMes} />
              <div className="cal-leyenda">
                <p className="cal-leyenda-title">Tipos de actividad</p>
                {Object.entries(TIPO_INFO).map(([key, info]) => (
                  <div key={key} className="cal-leyenda-item">
                    <span className="cal-leyenda-dot" style={{ background: info.color }} />
                    {info.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {panelAbierto && (
            <div className="resize-handle" onMouseDown={startResize} onTouchStart={startResize}>
              <span className="resize-dots" />
            </div>
          )}
        </div>

        {/* ── Panel principal ── */}
        <div className="cal-main">
          {errorCarga && actividades.length > 0 && (
            <div className="banner-error-carga">
              <span>No se pudo actualizar — mostrando la última información disponible.</span>
              <button type="button" onClick={cargar}>Reintentar</button>
            </div>
          )}

          <div className="cal-toolbar">
            <div className="cal-toolbar-nav">
              <button type="button" className="cal-btn-hoy" onClick={irAHoy}>Hoy</button>
              <button type="button" className="cal-btn-flecha" onClick={() => cambiarMes(-1)} aria-label="Mes anterior">‹</button>
              <button type="button" className="cal-btn-flecha" onClick={() => cambiarMes(1)} aria-label="Mes siguiente">›</button>
              <span className="cal-toolbar-titulo">{MESES[mesActual.getMonth()]} {mesActual.getFullYear()}</span>
            </div>
            <div className="cal-toolbar-right">
              <div className="cal-toggle-vista">
                <button type="button" className={vista === 'mes' ? 'activo' : ''} onClick={() => setVista('mes')}>Mes</button>
                <button type="button" className="cal-vista-deshabilitada" disabled title="Próximamente">Semana</button>
                <button type="button" className="cal-vista-deshabilitada" disabled title="Próximamente">Día</button>
              </div>
              <button type="button" className="cal-btn-nueva" onClick={() => setModalAbierto(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Nueva actividad
              </button>
            </div>
          </div>

          {cargando && actividades.length === 0 && <Spinner overlay={false} label="Cargando calendario…" />}

          {!cargando && errorCarga && actividades.length === 0 && (
            <div className="cal-error-state">
              <p className="cal-error-msg">No se pudo cargar el calendario.</p>
              <button type="button" className="btn-reintentar" onClick={cargar}>Reintentar</button>
            </div>
          )}

          {!(!cargando && errorCarga && actividades.length === 0) && !(cargando && actividades.length === 0) && (
            <div className="cal-grid">
              {DIAS_SEMANA.map(d => <div key={d} className="cal-grid-dia-header">{d}</div>)}
              {celdas.map((c, i) => {
                const key = toISODate(c)
                const eventos = actividadesPorDia[key] || []
                const esHoy = isSameDay(c, hoy)
                const fueraDeMes = c.getMonth() !== mesActual.getMonth()
                return (
                  <div key={i} className={`cal-grid-celda${fueraDeMes ? ' cal-celda-fuera' : ''}${esHoy ? ' cal-celda-hoy' : ''}`}>
                    <span className="cal-celda-numero">{c.getDate()}</span>
                    <div className="cal-celda-eventos">
                      {eventos.slice(0, 3).map(ev => (
                        <span
                          key={ev.id}
                          className="cal-evento-pill"
                          style={{ background: TIPO_INFO[ev.tipo]?.color || '#888' }}
                          title={ev.titulo}
                        >
                          {ev.titulo}
                        </span>
                      ))}
                      {eventos.length > 3 && <span className="cal-evento-mas">+{eventos.length - 3} más</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {modalAbierto && (
        <ModalNuevaActividad
          onClose={() => setModalAbierto(false)}
          onCreada={() => { setModalAbierto(false); cargar() }}
          fechaInicial={toISODate(new Date())}
        />
      )}
    </AppLayout>
  )
}
