import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import api from '../api/api'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import ModalDetalleFUS from '../components/ModalDetalleFUS'
import { useAuth } from '../context/AuthContext'
import './Bitacora.css'

const ESTATUS_FUS_OPCIONES = ['Registrado', 'Turnado', 'Atendido', 'Concluido']

const COLUMNAS_TOGGLEABLES = [
  { key: 'fecha',                 label: 'Fecha y hora (CDMX)' },
  { key: 'nombre',                label: 'Responsable',            admOnly: true },
  { key: 'usuario',               label: 'Correo del responsable', admOnly: true },
  { key: 'unidadAdministrativa',  label: 'Unidad administrativa',  admOnly: true },
  { key: 'cambioEstatus',         label: 'Cambio de estatus' },
  { key: 'observaciones',         label: 'Observaciones' },
]

const COL_VISIBLES_DEFAULT = {
  folio: true, fecha: true, nombre: true, usuario: true, unidadAdministrativa: false,
  accion: true, cambioEstatus: false, observaciones: false,
}

const ACCION_LABELS = {
  REGISTRO_FUS:       'Registro FUS',
  TURNAR_FUS:         'Turnar FUS',
  ASIGNACION_ESTADO:  'Cambio de estado',
  REGISTRO_RESPUESTA: 'Registro respuesta',
  REGISTRO_ACCION:    'Registro acción',
  CONCLUSION_FUS:     'Conclusión FUS',
  INICIO_SESION:      'Inicio sesión',
  CIERRE_SESION:      'Cierre sesión',
  RESTABLECER_CONTRASENA: 'Restablecer contraseña',
  ELIMINACION:        'Eliminación',
}

const ACCIONES_POR_ROL = {
  ROL1: ['REGISTRO_FUS','TURNAR_FUS','ASIGNACION_ESTADO','REGISTRO_RESPUESTA',
         'REGISTRO_ACCION','CONCLUSION_FUS','ELIMINACION'],
  ROL2: ['CONCLUSION_FUS','REGISTRO_RESPUESTA','REGISTRO_ACCION'],
}

const PAGE_SIZE = 50

function descargar(url, nombre, token) {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => {
      if (!r.ok) throw new Error(`Error ${r.status}`)
      return r.blob()
    })
    .then(blob => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = nombre
      a.click()
      URL.revokeObjectURL(a.href)
    })
    .catch(e => alert(`No se pudo descargar el archivo. ${e.message}`))
}

function urlPdfFus(folio) {
  return `/api/fus/${folio.split('/').map(encodeURIComponent).join('/')}/pdf/`
}

/* ── Modal: previsualizar el PDF individual de un FUS ── */
function ModalPreviewPDF({ folio, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [error,   setError]   = useState(false)

  const { accessToken } = useAuth()

  useEffect(() => {
    let url = null
    fetch(urlPdfFus(folio), { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => { if (!r.ok) throw new Error(); return r.blob() })
      .then(blob => { url = URL.createObjectURL(blob); setBlobUrl(url) })
      .catch(() => setError(true))
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [folio, accessToken])

  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card bita-modal-preview">
        <div className="modal-header">
          <h3 className="modal-title">Vista previa — FUS {folio}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="bita-modal-preview-body">
          {error && <p className="modal-error">No se pudo cargar la vista previa.</p>}
          {!error && !blobUrl && <Spinner overlay={false} label="Generando PDF…" />}
          {!error && blobUrl && <iframe title={`FUS ${folio}`} src={blobUrl} />}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function Bitacora() {
  const { user, accessToken } = useAuth()
  const rol       = user?.rol || 'ROL1'
  const esADM     = rol === 'ROL1'
  const acciones  = ACCIONES_POR_ROL[rol] || ACCIONES_POR_ROL.ROL1

  const [detalleFolio, setDetalleFolio] = useState(null)

  const [registros, setRegistros] = useState([])
  const [total,     setTotal]     = useState(0)
  const [pagina,    setPagina]    = useState(1)
  const [cargando,  setCargando]  = useState(true)

  const [fBusqueda,   setFBusqueda]   = useState('')
  const [fAccion,     setFAccion]     = useState('')
  const [fEstatusFus, setFEstatusFus] = useState('')
  const [fDesde,      setFDesde]      = useState('')
  const [fHasta,      setFHasta]      = useState('')

  const [fBusquedaDeb, setFBusquedaDeb] = useState(fBusqueda)

  useEffect(() => {
    const t = setTimeout(() => setFBusquedaDeb(fBusqueda), 350)
    return () => clearTimeout(t)
  }, [fBusqueda])

  const [colVisibles, setColVisibles] = useState(COL_VISIBLES_DEFAULT)
  const [previewFolio, setPreviewFolio] = useState(null)
  const [exportando, setExportando] = useState(null)
  const [descargandoFolio, setDescargandoFolio] = useState(null)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [presetFecha, setPresetFecha] = useState(null)

  const [unidades, setUnidades] = useState([])
  const [unidadesCargadas, setUnidadesCargadas] = useState(false)
  const [unidadPopoverAbierto, setUnidadPopoverAbierto] = useState(false)
  const [unidadPopoverPos, setUnidadPopoverPos] = useState({ top: 0, left: 0 })
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null)
  const unidadPopoverRef = useRef(null)
  const unidadBtnRef = useRef(null)

  const [compacto, setCompacto] = useState(false)
  const bitaBgRef = useRef(null)
  // Cuando no es null, ignora eventos de scroll mientras scrollTop no cambie
  // respecto a este valor (evita que un scroll "fantasma" disparado por el
  // propio cambio de layout al expandir el panel lo vuelva a compactar).
  const scrollBaselineRef = useRef(null)

  const ordenarPor = (key) => {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(key); setSortDir('asc') }
  }

  useEffect(() => {
    const el = bitaBgRef.current
    if (!el) return
    const onScroll = () => {
      const top = el.scrollTop
      if (scrollBaselineRef.current !== null) {
        if (top === scrollBaselineRef.current) return
        scrollBaselineRef.current = null
      }
      setCompacto(top > 50)
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const editarFiltros = () => {
    scrollBaselineRef.current = bitaBgRef.current ? bitaBgRef.current.scrollTop : 0
    setCompacto(false)
  }

  useEffect(() => {
    if (!unidadPopoverAbierto) return
    const cerrar = e => {
      if (unidadPopoverRef.current?.contains(e.target)) return
      if (unidadBtnRef.current?.contains(e.target)) return
      setUnidadPopoverAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [unidadPopoverAbierto])

  const abrirUnidadPopover = () => {
    if (!unidadPopoverAbierto && unidadBtnRef.current) {
      const r = unidadBtnRef.current.getBoundingClientRect()
      setUnidadPopoverPos({ top: r.bottom + 6, left: r.left })
    }
    if (!unidadesCargadas) {
      api.get('/catalogos/unidades-administrativas/')
        .then(r => setUnidades(Array.isArray(r.data) ? r.data : []))
        .catch(() => {})
      setUnidadesCargadas(true)
    }
    setUnidadPopoverAbierto(v => !v)
  }

  const seleccionarUnidad = (u) => {
    setColVisibles(v => ({ ...v, unidadAdministrativa: true }))
    setUnidadSeleccionada(u)
    setUnidadPopoverAbierto(false)
  }

  const quitarColumna = (key) => {
    toggleColumna(key)
    if (key === 'unidadAdministrativa') setUnidadSeleccionada(null)
  }

  const cargar = useCallback((pag = 1, append = false) => {
    setCargando(true)
    const params = { page: pag, page_size: PAGE_SIZE }
    if (fBusquedaDeb)         params.q           = fBusquedaDeb
    if (fAccion)              params.accion      = fAccion
    if (fEstatusFus)          params.estatus_fus = fEstatusFus
    if (fDesde)               params.fecha_desde = fDesde
    if (fHasta)               params.fecha_hasta = fHasta
    if (sortCol)              params.ordering    = `${sortDir === 'desc' ? '-' : ''}${sortCol}`

    api.get('/bitacora/', { params })
      .then(r => {
        setTotal(r.data.total)
        setPagina(pag)
        setRegistros(prev => append ? [...prev, ...r.data.results] : r.data.results)
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [fBusquedaDeb, fAccion, fEstatusFus, fDesde, fHasta, sortCol, sortDir])

  useEffect(() => { cargar(1) }, [fBusquedaDeb, fAccion, fEstatusFus, fDesde, fHasta, sortCol, sortDir])

  const limpiar = () => {
    setFBusqueda(''); setFAccion('')
    setFEstatusFus(''); setFDesde(''); setFHasta('')
    setPresetFecha(null)
    setColVisibles(COL_VISIBLES_DEFAULT)
    setUnidadSeleccionada(null)
    setSortCol(null); setSortDir('asc')
  }
  const toggleColumna = (key) => setColVisibles(v => ({ ...v, [key]: !v[key] }))
  // Solo columnas AGREGADAS (activadas) más allá del default — no las que el
  // usuario desactivó desde su estado por defecto (esas no generan chip).
  const columnasAgregadas = COLUMNAS_TOGGLEABLES.filter(c => colVisibles[c.key] && !COL_VISIBLES_DEFAULT[c.key])
  const hayColumnasAgregadas = columnasAgregadas.length > 0
  const filtrosActivosChips = Boolean(fBusqueda || fAccion || fEstatusFus || fDesde || fHasta || hayColumnasAgregadas)

  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
    : '—'

  const fmtFechaCorta = s => {
    const [y, m, d] = s.split('-')
    return `${d}/${m}/${y}`
  }

  const toISODate = d => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const aplicarPresetFecha = (preset) => {
    const hoy = new Date()
    if (preset === 'hoy') {
      const s = toISODate(hoy)
      setFDesde(s); setFHasta(s)
    } else if (preset === 'semana') {
      const hace7 = new Date(hoy)
      hace7.setDate(hoy.getDate() - 6)
      setFDesde(toISODate(hace7)); setFHasta(toISODate(hoy))
    } else if (preset === 'mes') {
      const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      setFDesde(toISODate(primerDia)); setFHasta(toISODate(hoy))
    }
  }

  const handlePresetClick = (preset) => {
    if (preset === 'rango') {
      setPresetFecha(p => p === 'rango' ? null : 'rango')
      return
    }
    aplicarPresetFecha(preset)
    setPresetFecha(preset)
  }

  const columnasVisibles = () => {
    const cols = []
    if (colVisibles.fecha)            cols.push('fecha')
    if (colVisibles.folio)            cols.push('folio')
    if (esADM && colVisibles.nombre)  cols.push('nombre')
    if (esADM && colVisibles.usuario) cols.push('usuario')
    if (esADM && colVisibles.unidadAdministrativa) cols.push('unidadAdministrativa')
    if (colVisibles.accion)           cols.push('accion')
    if (colVisibles.cambioEstatus)  { cols.push('estado_ant'); cols.push('estado_nuevo') }
    if (colVisibles.observaciones)    cols.push('observaciones')
    return cols
  }

  const exportParams = () => {
    const p = new URLSearchParams()
    if (fBusqueda)            p.set('q',           fBusqueda)
    if (fAccion)              p.set('accion',      fAccion)
    if (fEstatusFus)          p.set('estatus_fus', fEstatusFus)
    if (fDesde)               p.set('fecha_desde', fDesde)
    if (fHasta)               p.set('fecha_hasta', fHasta)
    p.set('columnas', columnasVisibles().join(','))
    const qs = p.toString()
    return qs ? `?${qs}` : ''
  }

  const cantColumnasUI = [
    colVisibles.fecha, colVisibles.folio,
    esADM && colVisibles.nombre, esADM && colVisibles.usuario,
    esADM && colVisibles.unidadAdministrativa,
    colVisibles.accion, colVisibles.cambioEstatus, colVisibles.observaciones,
  ].filter(Boolean).length
  const COLS = 1 + cantColumnasUI

  const th = (key, label, sortable = true) => (
    sortable ? (
      <th className="bita-th-sort" onClick={() => ordenarPor(key)}>
        {label}
        <span className={`bita-sort-arrow${sortCol === key ? ' bita-sort-arrow-activa' : ''}`}>
          {sortCol === key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </th>
    ) : (
      <th>{label}</th>
    )
  )

  return (
    <AppLayout>
      <div className="bita-bg" ref={bitaBgRef}>
      <div className="bita-wrap">

        <div className="bita-header">
          <div className="bita-header-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <h1>Búsqueda Avanzada</h1>
          </div>
          <div className="bita-header-right">
            <span className="bita-total">
              {total.toLocaleString()} registros
              {cargando && registros.length > 0 && <span className="btn-spinner bita-total-spinner" />}
            </span>
            <button className="bita-export-btn bita-export-excel"
              disabled={exportando === 'excel'}
              onClick={() => {
                setExportando('excel')
                descargar(`/api/bitacora/exportar/excel/${exportParams()}`, 'bitacora.xlsx', accessToken)
                  .finally(() => setExportando(null))
              }}
              title="Exportar a Excel">
              {exportando === 'excel'
                ? <span className="btn-spinner" />
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>}
              {exportando === 'excel' ? 'Generando…' : 'Excel'}
            </button>
            <button className="bita-export-btn bita-export-pdf"
              disabled={exportando === 'pdf'}
              onClick={() => {
                setExportando('pdf')
                descargar(`/api/bitacora/exportar/pdf/${exportParams()}`, 'bitacora.pdf', accessToken)
                  .finally(() => setExportando(null))
              }}
              title="Exportar a PDF">
              {exportando === 'pdf'
                ? <span className="btn-spinner" />
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
                  </svg>}
              {exportando === 'pdf' ? 'Generando…' : 'PDF'}
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className={`bita-filtros-sticky${compacto ? ' bita-filtros-compacto' : ''}`}>
          {compacto && (
            <button type="button" className="bita-editar-filtros-btn" onClick={editarFiltros}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              Editar filtros
            </button>
          )}

          <div className="bita-filtros">
            {/* Fila 1: buscador global */}
            <div className="bita-fila-busqueda">
              <div className="bita-busqueda-wrap">
                <svg className="bita-busqueda-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input className="bita-input bita-busqueda"
                  placeholder={esADM ? 'Buscar por folio, usuario o nombre…' : 'Buscar por folio…'}
                  value={fBusqueda} onChange={e => setFBusqueda(e.target.value)} />
              </div>
            </div>

            {/* Fila 2: presets de fecha + columnas opcionales, scroll horizontal combinado */}
            <div className="bita-fila-pildoras">
              <div className="bita-pildoras-scroll">
                <button type="button" className={`bita-pildora${presetFecha === 'hoy' ? ' activa' : ''}`} onClick={() => handlePresetClick('hoy')}>Hoy</button>
                <button type="button" className={`bita-pildora${presetFecha === 'semana' ? ' activa' : ''}`} onClick={() => handlePresetClick('semana')}>Semana</button>
                <button type="button" className={`bita-pildora${presetFecha === 'mes' ? ' activa' : ''}`} onClick={() => handlePresetClick('mes')}>Mes</button>
                <button type="button" className={`bita-pildora${presetFecha === 'rango' ? ' activa' : ''}`} onClick={() => handlePresetClick('rango')}>Rango</button>
                <span className="bita-pildoras-sep" />
                {COLUMNAS_TOGGLEABLES.filter(c => !c.admOnly || esADM).map(c => c.key === 'unidadAdministrativa' ? (
                  <div key={c.key} className="bita-unidad-pill-wrap">
                    <button type="button" ref={unidadBtnRef} className={`bita-pildora${colVisibles.unidadAdministrativa ? ' activa' : ''}`} onClick={abrirUnidadPopover}>
                      {colVisibles.unidadAdministrativa && unidadSeleccionada ? unidadSeleccionada.unidadAdministrativa : c.label}
                    </button>
                    {unidadPopoverAbierto && createPortal(
                      <div className="bita-unidad-popover" ref={unidadPopoverRef} style={{ position: 'fixed', top: unidadPopoverPos.top, left: unidadPopoverPos.left }}>
                        {unidades.map(u => (
                          <button key={u.idUnidadAdministrativa} type="button" className="bita-unidad-opcion" onClick={() => seleccionarUnidad(u)}>
                            {u.unidadAdministrativa}
                          </button>
                        ))}
                      </div>,
                      document.body
                    )}
                  </div>
                ) : (
                  <button key={c.key} type="button" className={`bita-pildora${colVisibles[c.key] ? ' activa' : ''}`} onClick={() => toggleColumna(c.key)}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {presetFecha === 'rango' && (
              <div className="bita-fechas">
                <div className="bita-fecha-grupo">
                  <span className="bita-fecha-lbl">Desde</span>
                  <input className="bita-input" type="date" value={fDesde} onChange={e => setFDesde(e.target.value)} />
                </div>
                <span className="bita-sep">–</span>
                <div className="bita-fecha-grupo">
                  <span className="bita-fecha-lbl">Hasta</span>
                  <input className="bita-input" type="date" value={fHasta} onChange={e => setFHasta(e.target.value)} />
                </div>
              </div>
            )}

            {/* Fila 3: selects Acción + Estatus */}
            <div className="bita-fila-selects">
              <select className="bita-input" value={fAccion} onChange={e => setFAccion(e.target.value)}>
                <option value="">Todas las acciones</option>
                {acciones.map(a => (
                  <option key={a} value={a}>{ACCION_LABELS[a] || a}</option>
                ))}
              </select>
              <select className="bita-input" value={fEstatusFus} onChange={e => setFEstatusFus(e.target.value)}>
                <option value="">Estatus actual del FUS</option>
                {ESTATUS_FUS_OPCIONES.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fila 4: FILTROS ACTIVOS — dentro del panel verde */}
          {filtrosActivosChips && <hr className="bita-divider" />}
          {(filtrosActivosChips || compacto) && (
            <div className={`bita-chips${compacto ? ' bita-chips-compacta' : ''}`}>
              {filtrosActivosChips && <span className="chips-label">FILTROS ACTIVOS:</span>}
              {fBusqueda && (
                <span className="bita-chip">
                  Búsqueda: "{fBusqueda}"
                  <button type="button" onClick={() => setFBusqueda('')} aria-label="Quitar filtro de búsqueda">×</button>
                </span>
              )}
              {fAccion && (
                <span className="bita-chip">
                  Acción: {ACCION_LABELS[fAccion] || fAccion}
                  <button type="button" onClick={() => setFAccion('')} aria-label="Quitar filtro de acción">×</button>
                </span>
              )}
              {fEstatusFus && (
                <span className="bita-chip">
                  Estatus: {fEstatusFus}
                  <button type="button" onClick={() => setFEstatusFus('')} aria-label="Quitar filtro de estatus">×</button>
                </span>
              )}
              {fDesde && (
                <span className="bita-chip">
                  Desde: {fmtFechaCorta(fDesde)}
                  <button type="button" onClick={() => { setFDesde(''); setPresetFecha(null) }} aria-label="Quitar filtro de fecha desde">×</button>
                </span>
              )}
              {fHasta && (
                <span className="bita-chip">
                  Hasta: {fmtFechaCorta(fHasta)}
                  <button type="button" onClick={() => { setFHasta(''); setPresetFecha(null) }} aria-label="Quitar filtro de fecha hasta">×</button>
                </span>
              )}
              {columnasAgregadas.map(c => (
                <span key={c.key} className="bita-chip">
                  Columnas: {c.key === 'unidadAdministrativa' && unidadSeleccionada ? `${c.label} (${unidadSeleccionada.unidadAdministrativa})` : c.label}
                  <button type="button" onClick={() => quitarColumna(c.key)} aria-label={`Quitar columna ${c.label}`}>×</button>
                </span>
              ))}
              {filtrosActivosChips && <button type="button" className="bita-limpiar-todo" onClick={limpiar}>Limpiar todo</button>}
              {compacto && (
                <button type="button" className="bita-editar-filtros-btn-inline" onClick={editarFiltros}>
                  Editar
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabla */}
        <div className={`bita-table-wrap${cargando && registros.length > 0 ? ' bita-table-refrescando' : ''}`}>
          <table className="bita-table">
            <thead>
              <tr>
                {colVisibles.fecha   && th('fecha', 'Fecha y hora (CDMX)')}
                {colVisibles.folio   && th('folio', 'Folio')}
                {esADM && colVisibles.nombre                && th('nombre', 'Responsable', false)}
                {esADM && colVisibles.usuario               && th('usuario', 'Correo del responsable', false)}
                {esADM && colVisibles.unidadAdministrativa  && th('unidadAdministrativa', 'Unidad administrativa', false)}
                {colVisibles.accion  && th('accion', 'Acción')}
                {colVisibles.cambioEstatus  && th('cambioEstatus', 'Cambio de estatus', false)}
                {colVisibles.observaciones  && th('observaciones', 'Observaciones')}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando && registros.length === 0 && (
                <tr><td colSpan={COLS} className="bita-loading"><Spinner overlay={false} label="Cargando registros…" /></td></tr>
              )}
              {!cargando && registros.length === 0 && (
                <tr><td colSpan={COLS} className="bita-empty">No hay registros que coincidan con los filtros.</td></tr>
              )}
              {registros.map(r => (
                <tr key={r.id}>
                  {colVisibles.fecha && <td className="bita-fecha" data-label="Fecha y hora (CDMX)">{fmt(r.fechaHora)}</td>}
                  {colVisibles.folio && (
                    <td className="bita-folio" data-label="Folio">
                      {r.fusFolio
                        ? <a
                            href={`${esADM ? '/rol1/consultar-fus' : '/rol2/solicitudes'}?folio=${encodeURIComponent(r.fusFolio)}`}
                            className="bita-folio-link"
                            onClick={e => { e.preventDefault(); setDetalleFolio(r.fusFolio) }}
                          >
                            {r.fusFolio}
                          </a>
                        : '—'}
                      <span className="bita-folio-fecha-mobile">{fmt(r.fechaHora)}</span>
                      <span className="bita-mobile-badge">{ACCION_LABELS[r.accion] || r.accion}</span>
                    </td>
                  )}
                  {esADM && colVisibles.nombre  && <td className="bita-usuario" data-label="Responsable">{r.nombre || '—'}</td>}
                  {esADM && colVisibles.usuario && <td className="bita-email-col" data-label="Correo del responsable">{r.usuario}</td>}
                  {esADM && colVisibles.unidadAdministrativa && (
                    <td data-label="Unidad administrativa">{r.unidadAdministrativa || '—'}</td>
                  )}
                  {colVisibles.accion && (
                    <td data-label="Acción">
                      <span className={`bita-accion bita-accion-${r.accion}`}>
                        {ACCION_LABELS[r.accion] || r.accion}
                      </span>
                    </td>
                  )}
                  {colVisibles.cambioEstatus && (
                    <td data-label="Cambio de estatus">
                      {r.estadoAnterior && r.estadoNuevo ? `${r.estadoAnterior} → ${r.estadoNuevo}` : '—'}
                    </td>
                  )}
                  {colVisibles.observaciones  && <td className="bita-obs" data-label="Observaciones">{r.observaciones || '—'}</td>}
                  <td className="bita-col-pdf" data-label="">
                    {r.fusFolio ? (
                      <div className="bita-acciones-icons">
                        <button
                          className="bita-eye-btn"
                          title={`Previsualizar FUS ${r.fusFolio}`}
                          onClick={() => setPreviewFolio(r.fusFolio)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        </button>
                        <button
                          className="bita-dl-btn"
                          title={`Descargar FUS ${r.fusFolio}`}
                          disabled={descargandoFolio === r.fusFolio}
                          onClick={() => {
                            setDescargandoFolio(r.fusFolio)
                            descargar(urlPdfFus(r.fusFolio), `FUS_${r.fusFolio}.pdf`, accessToken)
                              .finally(() => setDescargandoFolio(null))
                          }}
                        >
                          {descargandoFolio === r.fusFolio
                            ? <span className="btn-spinner" />
                            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                              </svg>}
                        </button>
                      </div>
                    ) : <span className="bita-no-pdf">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {registros.length < total && (
          <button className="bita-mas" onClick={() => cargar(pagina + 1, true)} disabled={cargando}>
            {cargando && <span className="btn-spinner" />}
            {cargando ? 'Cargando…' : `Cargar más (${registros.length} de ${total})`}
          </button>
        )}

      </div>
      </div>

      {previewFolio && (
        <ModalPreviewPDF folio={previewFolio} onClose={() => setPreviewFolio(null)} />
      )}
      {detalleFolio && (
        <ModalDetalleFUS folio={detalleFolio} onClose={() => setDetalleFolio(null)} />
      )}
    </AppLayout>
  )
}
