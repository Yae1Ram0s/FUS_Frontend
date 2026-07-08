import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import api from '../api/api'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import { useAuth } from '../context/AuthContext'
import './Bitacora.css'

const ESTATUS_FUS_OPCIONES = ['Registrado', 'Turnado', 'Atendido', 'Concluido']

const COLUMNAS_TOGGLEABLES = [
  { key: 'nombre',         label: 'Nombre',       admOnly: true },
  { key: 'usuario',        label: 'Usuario',      admOnly: true },
  { key: 'fecha',          label: 'Fecha y hora' },
  { key: 'accion',         label: 'Acción' },
  { key: 'estadoAnterior', label: 'Estado ant.' },
  { key: 'estadoNuevo',    label: 'Estado nuevo' },
  { key: 'observaciones',  label: 'Observaciones' },
]

const COL_VISIBLES_DEFAULT = {
  folio: true, nombre: true, usuario: true, fecha: true, accion: true,
  estadoAnterior: false, estadoNuevo: false, observaciones: false,
}

/* ── Ordenamiento inteligente por tipo de dato (solo escritorio) ── */
const SORT_GETTERS = {
  folio:          r => r.fusFolio || '',
  nombre:         r => r.nombre || '',
  usuario:        r => r.usuario || '',
  fecha:          r => r.fechaHora || '',
  accion:         r => ACCION_LABELS[r.accion] || r.accion || '',
  estadoAnterior: r => r.estadoAnterior || '',
  estadoNuevo:    r => r.estadoNuevo || '',
  observaciones:  r => r.observaciones || '',
}

function compararValores(va, vb, dir) {
  const da = Date.parse(va), db = Date.parse(vb)
  if (va && vb && !isNaN(da) && !isNaN(db)) return dir === 'asc' ? da - db : db - da
  return dir === 'asc'
    ? String(va).localeCompare(String(vb), 'es', { sensitivity: 'base', numeric: true })
    : String(vb).localeCompare(String(va), 'es', { sensitivity: 'base', numeric: true })
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

function descargar(url, nombre) {
  const token = sessionStorage.getItem('access_token')
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

  useEffect(() => {
    const token = sessionStorage.getItem('access_token')
    let url = null
    fetch(urlPdfFus(folio), { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(); return r.blob() })
      .then(blob => { url = URL.createObjectURL(blob); setBlobUrl(url) })
      .catch(() => setError(true))
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [folio])

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
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const rol       = user?.rol || 'ROL1'
  const esADM     = rol === 'ROL1'
  const acciones  = ACCIONES_POR_ROL[rol] || ACCIONES_POR_ROL.ROL1

  const irAlFus = (folio) => {
    if (!folio) return
    const ruta = esADM ? '/rol1/consultar-fus' : '/rol2/solicitudes'
    navigate(`${ruta}?folio=${encodeURIComponent(folio)}`)
  }

  const [registros, setRegistros] = useState([])
  const [total,     setTotal]     = useState(0)
  const [pagina,    setPagina]    = useState(1)
  const [cargando,  setCargando]  = useState(true)

  const [fUsuario,    setFUsuario]    = useState('')
  const [fAccion,     setFAccion]     = useState('')
  const [fFolio,      setFFolio]      = useState('')
  const [fNombre,     setFNombre]     = useState('')
  const [fEstatusFus, setFEstatusFus] = useState('')
  const [fDesde,      setFDesde]      = useState('')
  const [fHasta,      setFHasta]      = useState('')

  const [colVisibles, setColVisibles] = useState(COL_VISIBLES_DEFAULT)
  const [colMenuAbierto, setColMenuAbierto] = useState(false)
  const colMenuRef = useRef(null)
  const [previewFolio, setPreviewFolio] = useState(null)
  const [exportando, setExportando] = useState(null)
  const [descargandoFolio, setDescargandoFolio] = useState(null)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const ordenarPor = (key) => {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(key); setSortDir('asc') }
  }

  useEffect(() => {
    if (!colMenuAbierto) return
    const cerrar = e => { if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setColMenuAbierto(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [colMenuAbierto])

  const cargar = useCallback((pag = 1, append = false) => {
    setCargando(true)
    const params = { page: pag, page_size: PAGE_SIZE }
    if (fUsuario && esADM)    params.usuario     = fUsuario
    if (fAccion)              params.accion      = fAccion
    if (fFolio)               params.folio       = fFolio
    if (fNombre && esADM)     params.nombre      = fNombre
    if (fEstatusFus)          params.estatus_fus = fEstatusFus
    if (fDesde)               params.fecha_desde = fDesde
    if (fHasta)               params.fecha_hasta = fHasta

    api.get('/bitacora/', { params })
      .then(r => {
        setTotal(r.data.total)
        setPagina(pag)
        setRegistros(prev => append ? [...prev, ...r.data.results] : r.data.results)
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [fUsuario, fAccion, fFolio, fNombre, fEstatusFus, fDesde, fHasta, esADM])

  useEffect(() => { cargar(1) }, [fUsuario, fAccion, fFolio, fNombre, fEstatusFus, fDesde, fHasta])

  const limpiar = () => {
    setFUsuario(''); setFAccion(''); setFFolio(''); setFNombre('')
    setFEstatusFus(''); setFDesde(''); setFHasta('')
    setColVisibles(COL_VISIBLES_DEFAULT)
    setSortCol(null); setSortDir('asc')
  }
  const colVisiblesModificadas = COLUMNAS_TOGGLEABLES.some(c => colVisibles[c.key] !== COL_VISIBLES_DEFAULT[c.key])
  const hayFiltros = fUsuario || fAccion || fFolio || fNombre || fEstatusFus || fDesde || fHasta || colVisiblesModificadas || sortCol !== null
  const toggleColumna = (key) => setColVisibles(v => ({ ...v, [key]: !v[key] }))
  const cantFiltrosActivos = [fUsuario, fAccion, fFolio, fNombre, fEstatusFus, fDesde, fHasta].filter(Boolean).length

  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
    : '—'

  const columnasVisibles = () => {
    const cols = []
    if (colVisibles.folio)            cols.push('folio')
    if (esADM && colVisibles.nombre)  cols.push('nombre')
    if (esADM && colVisibles.usuario) cols.push('usuario')
    if (colVisibles.fecha)            cols.push('fecha')
    if (colVisibles.accion)           cols.push('accion')
    if (colVisibles.estadoAnterior)   cols.push('estado_ant')
    if (colVisibles.estadoNuevo)      cols.push('estado_nuevo')
    if (colVisibles.observaciones)    cols.push('observaciones')
    return cols
  }

  const exportParams = () => {
    const p = new URLSearchParams()
    if (fAccion)              p.set('accion',      fAccion)
    if (fFolio)               p.set('folio',       fFolio)
    if (fNombre && esADM)     p.set('nombre',      fNombre)
    if (fEstatusFus)          p.set('estatus_fus', fEstatusFus)
    if (fDesde)               p.set('fecha_desde', fDesde)
    if (fHasta)               p.set('fecha_hasta', fHasta)
    if (fUsuario && esADM)    p.set('usuario',     fUsuario)
    p.set('columnas', columnasVisibles().join(','))
    const qs = p.toString()
    return qs ? `?${qs}` : ''
  }

  const COLS = 1 + columnasVisibles().length

  const registrosOrdenados = sortCol
    ? [...registros].sort((a, b) => compararValores(SORT_GETTERS[sortCol](a), SORT_GETTERS[sortCol](b), sortDir))
    : registros

  const th = (key, label) => (
    <th className="bita-th-sort" onClick={() => ordenarPor(key)}>
      {label}
      <span className={`bita-sort-arrow${sortCol === key ? ' bita-sort-arrow-activa' : ''}`}>
        {sortCol === key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  )

  return (
    <AppLayout>
      <div className="bita-bg">
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
                descargar(`/api/bitacora/exportar/excel/${exportParams()}`, 'bitacora.xlsx')
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
                descargar(`/api/bitacora/exportar/pdf/${exportParams()}`, 'bitacora.pdf')
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
        <button type="button" className="bita-filtros-toggle" onClick={() => setFiltrosAbiertos(v => !v)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="1.6" fill="currentColor" stroke="none"/>
            <line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none"/>
            <line x1="4" y1="18" x2="20" y2="18"/><circle cx="11" cy="18" r="1.6" fill="currentColor" stroke="none"/>
          </svg>
          Filtros
          {cantFiltrosActivos > 0 && (
            <span className="bita-filtros-badge">{cantFiltrosActivos} activo{cantFiltrosActivos > 1 ? 's' : ''}</span>
          )}
          <svg className={`bita-filtros-chevron${filtrosAbiertos ? ' open' : ''}`} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div className={`bita-filtros${filtrosAbiertos ? ' bita-filtros-open' : ''}`}>
          {esADM && (
            <input className="bita-input" placeholder="Usuario (correo)"
              value={fUsuario} onChange={e => setFUsuario(e.target.value)} />
          )}
          <input className="bita-input" placeholder="Folio FUS"
            value={fFolio} onChange={e => setFFolio(e.target.value)} />
          {esADM && (
            <input className="bita-input" placeholder="Nombre del servidor público"
              value={fNombre} onChange={e => setFNombre(e.target.value)} />
          )}
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

          <div className="bita-col-menu desktop-only" ref={colMenuRef}>
            <button type="button" className="bita-col-menu-btn" onClick={() => setColMenuAbierto(v => !v)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
                <circle cx="9" cy="6" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.6" fill="currentColor" stroke="none"/>
              </svg>
              Columnas
            </button>
            {colMenuAbierto && (
              <div className="bita-col-dropdown">
                {COLUMNAS_TOGGLEABLES.filter(c => !c.admOnly || esADM).map(c => (
                  <label key={c.key} className="bita-col-opcion">
                    <input
                      type="checkbox"
                      checked={colVisibles[c.key]}
                      onChange={() => toggleColumna(c.key)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {hayFiltros && <button className="bita-limpiar" onClick={limpiar}>Limpiar filtros</button>}
        </div>

        <div className="cols-toggle-bar">
          {COLUMNAS_TOGGLEABLES.filter(c => !c.admOnly || esADM).map(c => (
            <button
              key={c.key}
              type="button"
              className={`col-toggle-btn${colVisibles[c.key] ? ' activa' : ''}`}
              onClick={() => toggleColumna(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Tabla */}
        <div className={`bita-table-wrap${cargando && registros.length > 0 ? ' bita-table-refrescando' : ''}`}>
          <table className="bita-table">
            <thead>
              <tr>
                {colVisibles.folio   && th('folio', 'Folio')}
                {esADM && colVisibles.nombre  && th('nombre', 'Nombre')}
                {esADM && colVisibles.usuario && th('usuario', 'Usuario')}
                {colVisibles.fecha   && th('fecha', 'Fecha y hora')}
                {colVisibles.accion  && th('accion', 'Acción')}
                {colVisibles.estadoAnterior && th('estadoAnterior', 'Estado ant.')}
                {colVisibles.estadoNuevo    && th('estadoNuevo', 'Estado nuevo')}
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
              {registrosOrdenados.map(r => (
                <tr key={r.id}>
                  {colVisibles.folio && (
                    <td className="bita-folio" data-label="Folio">
                      {r.fusFolio
                        ? <a
                            href={`${esADM ? '/rol1/consultar-fus' : '/rol2/solicitudes'}?folio=${encodeURIComponent(r.fusFolio)}`}
                            className="bita-folio-link"
                            onClick={e => { e.preventDefault(); irAlFus(r.fusFolio) }}
                          >
                            {r.fusFolio}
                          </a>
                        : '—'}
                      <span className="bita-mobile-badge">{ACCION_LABELS[r.accion] || r.accion}</span>
                    </td>
                  )}
                  {esADM && colVisibles.nombre  && <td className="bita-usuario" data-label="Nombre">{r.nombre || '—'}</td>}
                  {esADM && colVisibles.usuario && <td className="bita-email-col" data-label="Usuario">{r.usuario}</td>}
                  {colVisibles.fecha && <td className="bita-fecha" data-label="Fecha y hora">{fmt(r.fechaHora)}</td>}
                  {colVisibles.accion && (
                    <td data-label="Acción">
                      <span className={`bita-accion bita-accion-${r.accion}`}>
                        {ACCION_LABELS[r.accion] || r.accion}
                      </span>
                    </td>
                  )}
                  {colVisibles.estadoAnterior && <td data-label="Estado ant.">{r.estadoAnterior || '—'}</td>}
                  {colVisibles.estadoNuevo    && <td data-label="Estado nuevo">{r.estadoNuevo   || '—'}</td>}
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
                            descargar(urlPdfFus(r.fusFolio), `FUS_${r.fusFolio}.pdf`)
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
    </AppLayout>
  )
}
