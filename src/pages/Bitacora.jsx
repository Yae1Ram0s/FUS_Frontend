import { useState, useEffect, useCallback } from 'react'
import api from '../api/api'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import { useAuth } from '../context/AuthContext'
import './Bitacora.css'

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

const ACCIONES_EXCLUIDAS = ['INICIO_SESION','CIERRE_SESION']

const PAGE_SIZE = 50

function descargar(url, nombre) {
  const token = sessionStorage.getItem('access_token')
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
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

export default function Bitacora() {
  const { user }  = useAuth()
  const rol       = user?.rol || 'ROL1'
  const esADM     = rol === 'ROL1'
  const acciones  = ACCIONES_POR_ROL[rol] || ACCIONES_POR_ROL.ROL1

  const [registros, setRegistros] = useState([])
  const [total,     setTotal]     = useState(0)
  const [pagina,    setPagina]    = useState(1)
  const [cargando,  setCargando]  = useState(true)

  const [fUsuario, setFUsuario] = useState('')
  const [fAccion,  setFAccion]  = useState('')
  const [fFolio,   setFFolio]   = useState('')
  const [fDesde,   setFDesde]   = useState('')
  const [fHasta,   setFHasta]   = useState('')

  const cargar = useCallback((pag = 1, append = false) => {
    setCargando(true)
    const params = { page: pag, page_size: PAGE_SIZE }
    if (fUsuario && esADM) params.usuario     = fUsuario
    if (fAccion)           params.accion      = fAccion
    if (fFolio)            params.folio       = fFolio
    if (fDesde)            params.fecha_desde = fDesde
    if (fHasta)            params.fecha_hasta = fHasta

    api.get('/bitacora/', { params })
      .then(r => {
        const filtrados = r.data.results.filter(x => !ACCIONES_EXCLUIDAS.includes(x.accion))
        setTotal(r.data.total)
        setPagina(pag)
        setRegistros(prev => append ? [...prev, ...filtrados] : filtrados)
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [fUsuario, fAccion, fFolio, fDesde, fHasta, esADM])

  useEffect(() => { cargar(1) }, [fUsuario, fAccion, fFolio, fDesde, fHasta])

  const limpiar    = () => { setFUsuario(''); setFAccion(''); setFFolio(''); setFDesde(''); setFHasta('') }
  const hayFiltros = fUsuario || fAccion || fFolio || fDesde || fHasta

  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
    : '—'

  const exportParams = () => {
    const p = new URLSearchParams()
    if (fAccion)           p.set('accion',      fAccion)
    if (fFolio)            p.set('folio',       fFolio)
    if (fDesde)            p.set('fecha_desde', fDesde)
    if (fHasta)            p.set('fecha_hasta', fHasta)
    if (fUsuario && esADM) p.set('usuario',     fUsuario)
    const qs = p.toString()
    return qs ? `?${qs}` : ''
  }

  const COLS = esADM ? 9 : 6

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
            <span className="bita-total">{total.toLocaleString()} registros</span>
            <button className="bita-export-btn bita-export-excel"
              onClick={() => descargar(`/api/bitacora/exportar/excel/${exportParams()}`, 'bitacora.xlsx')}
              title="Exportar a Excel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              Excel
            </button>
            <button className="bita-export-btn bita-export-pdf"
              onClick={() => descargar(`/api/bitacora/exportar/pdf/${exportParams()}`, 'bitacora.pdf')}
              title="Exportar a PDF">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
              </svg>
              PDF
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bita-filtros">
          {esADM && (
            <input className="bita-input" placeholder="Usuario (correo)"
              value={fUsuario} onChange={e => setFUsuario(e.target.value)} />
          )}
          <input className="bita-input" placeholder="Folio FUS"
            value={fFolio} onChange={e => setFFolio(e.target.value)} />
          <select className="bita-input" value={fAccion} onChange={e => setFAccion(e.target.value)}>
            <option value="">Todas las acciones</option>
            {acciones.map(a => (
              <option key={a} value={a}>{ACCION_LABELS[a] || a}</option>
            ))}
          </select>
          <div className="bita-fechas">
            <input className="bita-input" type="date" value={fDesde} onChange={e => setFDesde(e.target.value)} title="Desde" />
            <span className="bita-sep">–</span>
            <input className="bita-input" type="date" value={fHasta} onChange={e => setFHasta(e.target.value)} title="Hasta" />
          </div>
          {hayFiltros && <button className="bita-limpiar" onClick={limpiar}>Limpiar filtros</button>}
        </div>

        {/* Tabla */}
        <div className="bita-table-wrap">
          <table className="bita-table">
            <thead>
              <tr>
                <th>Folio</th>
                {esADM && <th>Nombre</th>}
                {esADM && <th>Usuario</th>}
                <th>Fecha y hora</th>
                <th>Acción</th>
                <th>Estado ant.</th>
                <th>Estado nuevo</th>
                <th>Observaciones</th>
                <th>PDF</th>
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
                  <td className="bita-folio">{r.fusFolio || '—'}</td>
                  {esADM && <td className="bita-usuario">{r.nombre || '—'}</td>}
                  {esADM && <td className="bita-email-col">{r.usuario}</td>}
                  <td className="bita-fecha">{fmt(r.fechaHora)}</td>
                  <td>
                    <span className={`bita-accion bita-accion-${r.accion}`}>
                      {ACCION_LABELS[r.accion] || r.accion}
                    </span>
                  </td>
                  <td>{r.estadoAnterior || '—'}</td>
                  <td>{r.estadoNuevo   || '—'}</td>
                  <td className="bita-obs">{r.observaciones || '—'}</td>
                  <td className="bita-col-pdf">
                    {r.fusFolio ? (
                      <button
                        className="bita-dl-btn"
                        title={`Descargar FUS ${r.fusFolio}`}
                        onClick={() => descargar(`/api/fus/${r.fusFolio.split('/').map(encodeURIComponent).join('/')}/pdf/`, `FUS_${r.fusFolio}.pdf`)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                      </button>
                    ) : <span className="bita-no-pdf">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!cargando && registros.length < total && (
          <button className="bita-mas" onClick={() => cargar(pagina + 1, true)}>
            Cargar más ({registros.length} de {total})
          </button>
        )}

      </div>
      </div>
    </AppLayout>
  )
}
