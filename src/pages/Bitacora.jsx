import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import api from '../api/api'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import ModalDetalleFUS from '../components/ModalDetalleFUS'
import ModalTimeline from '../components/ModalTimeline'
import ModalDescargarBitacora from '../components/ModalDescargarBitacora'
import FechaInput from '../components/FechaInput'
import Badge from '../components/Badge'
import { useAuth } from '../context/AuthContext'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { descargar } from '../utils/descargarArchivo'
import './Bitacora.css'

// Mismo conjunto de valores crudos que FUS.estatusParticular_id puede tener
// en la práctica, más Vencido/PorVencer (calculados a partir de fechaLimite,
// no un estatus guardado — el backend ya sabe resolverlos como caso especial).
// Cada rol ve los estatus relevantes a su parte del flujo — para ROL1 (y su
// Equipo del Particular), "que se dio una respuesta" se llama "Atendido" en
// vez de "En seguimiento".
const ESTATUS_POR_ROL = {
  ROL1:             ['Registrado', 'Turnado', 'Atendido', 'Pendiente_validacion', 'Concluido', 'Rechazado', 'Vencido', 'PorVencer'],
  EQUIPO_PARTICULAR: ['Registrado', 'Turnado', 'Atendido', 'Pendiente_validacion', 'Concluido', 'Rechazado', 'Vencido', 'PorVencer'],
  ROL2:             ['Recibido', 'En_seguimiento', 'Concluido', 'Pendiente_validacion', 'Rechazado', 'Vencido', 'PorVencer'],
  COMISIONADO:      ['En_seguimiento', 'Atendido', 'Pendiente_validacion', 'Concluido', 'Rechazado', 'Vencido', 'PorVencer'],
}
const ESTATUS_FUS_LABELS = {
  En_seguimiento: 'En seguimiento',
  Pendiente_validacion: 'Pendiente de validación',
  PorVencer: 'Por vencer',
}

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
  estatus: true, cambioEstatus: false, observaciones: false,
}

const PAGE_SIZE = 50

function combinarPaginasBitacora(estadoAnterior, paginaNueva) {
  if (!paginaNueva.append) return paginaNueva
  const existentes = new Set(estadoAnterior.items.map(item => item.id))
  return {
    ...paginaNueva,
    items: [
      ...estadoAnterior.items,
      ...paginaNueva.items.filter(item => !existentes.has(item.id)),
    ],
  }
}

function urlPdfFus(folio) {
  return `/fus/${folio.split('/').map(encodeURIComponent).join('/')}/pdf/`
}

/* ── Modal: previsualizar el PDF individual de un FUS ── */
function ModalPreviewPDF({ folio, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    let url = null
    const controller = new AbortController()
    // Vía `api` (no fetch directo): así un access token vencido se refresca
    // solo antes de reintentar, en vez de fallar la vista previa.
    api.get(urlPdfFus(folio), { responseType: 'blob', signal: controller.signal })
      .then(({ data: blob }) => { url = URL.createObjectURL(blob); setBlobUrl(url) })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
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

function SkeletonRow() {
  return (
    <div className="skeleton-row">
      <div className="skeleton-bar larga" />
      <div className="skeleton-bar media" />
      <div className="skeleton-bar corta" />
    </div>
  )
}

function SkeletonList() {
  return Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
}

export default function Bitacora() {
  const { user } = useAuth()
  const rol       = user?.rol || 'ROL1'
  const esADM     = rol === 'ROL1'
  const estatusOpciones = ESTATUS_POR_ROL[rol] || ESTATUS_POR_ROL.ROL1

  const [searchParams, setSearchParams] = useSearchParams()

  const [detalleFolio, setDetalleFolio] = useState(null)

  // Filtros restaurados de la URL al entrar (ver el useEffect de sincronización
  // más abajo, que hace el camino inverso) — así una búsqueda se puede
  // compartir/recargar sin perderla; antes vivían solo en estado local.
  const [fBusqueda, setFBusqueda] = useState(() => searchParams.get('q') || '')
  // Multi-selección (antes un solo valor): cada estatus elegido suma
  // resultados, igual que Unidad administrativa/Responsable.
  const [fEstatus,  setFEstatus]  = useState(() => searchParams.getAll('estatus_fus'))
  const [fDesde,    setFDesde]    = useState(() => searchParams.get('fecha_desde') || '')
  const [fHasta,    setFHasta]    = useState(() => searchParams.get('fecha_hasta') || '')

  const [fBusquedaDeb, setFBusquedaDeb] = useState(fBusqueda)

  useEffect(() => {
    const t = setTimeout(() => setFBusquedaDeb(fBusqueda), 350)
    return () => clearTimeout(t)
  }, [fBusqueda])

  const [colVisibles, setColVisibles] = useState(COL_VISIBLES_DEFAULT)
  const [previewFolio, setPreviewFolio] = useState(null)
  const [modalTimelineFolio, setModalTimelineFolio] = useState(null)
  const [exportando, setExportando] = useState(false)
  const [modalDescargarAbierto, setModalDescargarAbierto] = useState(false)
  const [descargandoFolio, setDescargandoFolio] = useState(null)
  const ordInicial = searchParams.get('ordering') || ''
  const [sortCol, setSortCol] = useState(() => ordInicial.replace(/^-/, '') || null)
  const [sortDir, setSortDir] = useState(() => ordInicial.startsWith('-') ? 'desc' : 'asc')
  const [presetFecha, setPresetFecha] = useState(() => (searchParams.get('fecha_desde') || searchParams.get('fecha_hasta')) ? 'rango' : null)

  const [unidades, setUnidades] = useState([])
  const [unidadesCargadas, setUnidadesCargadas] = useState(false)
  const [unidadPopoverAbierto, setUnidadPopoverAbierto] = useState(false)
  const [unidadPopoverPos, setUnidadPopoverPos] = useState({ top: 0, left: 0 })
  const [unidadSeleccionadas, setUnidadSeleccionadas] = useState([])
  const [fUnidades, setFUnidades] = useState(() => searchParams.getAll('unidadAdministrativa').map(Number).filter(Boolean))
  const unidadPopoverRef = useRef(null)
  const unidadBtnRef = useRef(null)

  // ── Responsable (solo ROL1): filtro explícito, separado del buscador
  // combinado `q` — con autocompletar sobre /auth/correos-autorizados/
  // (mismo endpoint que ya usa Panel Admin), mismo patrón visual que Unidad
  // administrativa (pastilla + popover con checkboxes). ──
  const [respBusqueda, setRespBusqueda] = useState('')
  const [respResultados, setRespResultados] = useState([])
  const [respBuscando, setRespBuscando] = useState(false)
  const [respPopoverAbierto, setRespPopoverAbierto] = useState(false)
  const [respPopoverPos, setRespPopoverPos] = useState({ top: 0, left: 0 })
  const [respSeleccionados, setRespSeleccionados] = useState([])
  const [fResponsables, setFResponsables] = useState(() => searchParams.getAll('usuario'))
  const respPopoverRef = useRef(null)
  const respBtnRef = useRef(null)

  // ── Estatus: mismo patrón de pastilla + popover con checkboxes que Unidad
  // administrativa/Responsable (antes un <select> de un solo valor). ──
  const [estatusPopoverAbierto, setEstatusPopoverAbierto] = useState(false)
  const [estatusPopoverPos, setEstatusPopoverPos] = useState({ top: 0, left: 0 })
  const estatusPopoverRef = useRef(null)
  const estatusBtnRef = useRef(null)
  const busquedaInputRef = useRef(null)

  const [compacto, setCompacto] = useState(false)
  const bitaBgRef = useRef(null)
  const abriendoFiltrosRef = useRef(false)
  const desbloquearFiltrosTimerRef = useRef(null)

  const ordenarPor = (key) => {
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(key); setSortDir('asc') }
  }

  useEffect(() => {
    const el = bitaBgRef.current
    if (!el) return
    const onScroll = () => {
      const top = el.scrollTop
      if (abriendoFiltrosRef.current) {
        setCompacto(false)
        return
      }
      setCompacto(top > 50)
    }
    el.addEventListener('scroll', onScroll)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.clearTimeout(desbloquearFiltrosTimerRef.current)
    }
  }, [])

  const editarFiltros = () => {
    abriendoFiltrosRef.current = true
    setCompacto(false)
    window.clearTimeout(desbloquearFiltrosTimerRef.current)
    desbloquearFiltrosTimerRef.current = window.setTimeout(() => {
      abriendoFiltrosRef.current = false
    }, 450)
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
    setColVisibles(v => ({ ...v, unidadAdministrativa: true }))
    setUnidadPopoverAbierto(v => !v)
  }

  const toggleUnidad = (u) => {
    setUnidadSeleccionadas(prev => {
      const existe = prev.some(item => item.idUnidadAdministrativa === u.idUnidadAdministrativa)
      return existe ? prev.filter(item => item.idUnidadAdministrativa !== u.idUnidadAdministrativa) : [...prev, u]
    })
    setFUnidades(prev => prev.includes(u.idUnidadAdministrativa)
      ? prev.filter(item => item !== u.idUnidadAdministrativa)
      : [...prev, u.idUnidadAdministrativa]
    )
  }

  const quitarUnidad = (id) => {
    setUnidadSeleccionadas(prev => {
      const siguiente = prev.filter(item => item.idUnidadAdministrativa !== id)
      setColVisibles(v => ({ ...v, unidadAdministrativa: siguiente.length > 0 }))
      return siguiente
    })
    setFUnidades(prev => prev.filter(item => item !== id))
  }

  const quitarColumna = (key) => {
    toggleColumna(key)
    if (key === 'unidadAdministrativa') {
      setUnidadSeleccionadas([])
      setFUnidades([])
    }
  }

  useEffect(() => {
    if (!respPopoverAbierto) return
    const cerrar = e => {
      if (respPopoverRef.current?.contains(e.target)) return
      if (respBtnRef.current?.contains(e.target)) return
      setRespPopoverAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [respPopoverAbierto])

  // Autocompletar del popover — mismo endpoint que ya usa Panel Admin para
  // buscar correos autorizados por nombre o email.
  useEffect(() => {
    if (!respPopoverAbierto) return
    setRespBuscando(true)
    const t = setTimeout(() => {
      api.get('/auth/correos-autorizados/', { params: { search: respBusqueda } })
        .then(r => setRespResultados(Array.isArray(r.data) ? r.data : []))
        .catch(() => setRespResultados([]))
        .finally(() => setRespBuscando(false))
    }, 300)
    return () => clearTimeout(t)
  }, [respBusqueda, respPopoverAbierto])

  const abrirRespPopover = () => {
    if (!respPopoverAbierto && respBtnRef.current) {
      const r = respBtnRef.current.getBoundingClientRect()
      setRespPopoverPos({ top: r.bottom + 6, left: r.left })
    }
    setRespPopoverAbierto(v => !v)
  }

  const toggleResponsable = (c) => {
    setRespSeleccionados(prev => {
      const existe = prev.some(item => item.email === c.email)
      return existe ? prev.filter(item => item.email !== c.email) : [...prev, { email: c.email, nombre: c.nombre }]
    })
    setFResponsables(prev => prev.includes(c.email) ? prev.filter(item => item !== c.email) : [...prev, c.email])
  }

  const quitarResponsable = (email) => {
    setRespSeleccionados(prev => prev.filter(item => item.email !== email))
    setFResponsables(prev => prev.filter(item => item !== email))
  }

  useEffect(() => {
    if (!estatusPopoverAbierto) return
    const cerrar = e => {
      if (estatusPopoverRef.current?.contains(e.target)) return
      if (estatusBtnRef.current?.contains(e.target)) return
      setEstatusPopoverAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [estatusPopoverAbierto])

  const abrirEstatusPopover = () => {
    if (!estatusPopoverAbierto && estatusBtnRef.current) {
      const r = estatusBtnRef.current.getBoundingClientRect()
      setEstatusPopoverPos({ top: r.bottom + 6, left: r.left })
    }
    setEstatusPopoverAbierto(v => !v)
  }

  const toggleEstatus = (valor) => {
    setFEstatus(prev => prev.includes(valor) ? prev.filter(v => v !== valor) : [...prev, valor])
  }

  // Reabrir un filtro desde su chip: si el panel está en modo compacto (los
  // botones siguen en el DOM pero colapsados/ocultos por CSS, no desmontados)
  // primero hay que expandirlo y esperar a que termine su transición (200ms)
  // antes de medir la posición del botón — si no, el popover se abriría en
  // un punto (0,0) o mal calculado.
  const abrirDesdeChip = (abrirPopover) => {
    if (compacto) {
      editarFiltros()
      setTimeout(abrirPopover, 220)
    } else {
      abrirPopover()
    }
  }

  // Al entrar con filtros ya en la URL (búsqueda compartida/recargada), acá
  // solo viajan ids/correos — hay que resolver sus nombres para las
  // pastillas y chips, igual que si el usuario los hubiera elegido a mano.
  useEffect(() => {
    if (fUnidades.length && !unidadesCargadas) {
      api.get('/catalogos/unidades-administrativas/')
        .then(r => {
          const lista = Array.isArray(r.data) ? r.data : []
          setUnidades(lista)
          setUnidadSeleccionadas(lista.filter(u => fUnidades.includes(u.idUnidadAdministrativa)))
          setColVisibles(v => ({ ...v, unidadAdministrativa: true }))
        })
        .catch(() => {})
      setUnidadesCargadas(true)
    }
    if (fResponsables.length) {
      Promise.all(fResponsables.map(email =>
        api.get('/auth/correos-autorizados/', { params: { search: email } })
          .then(r => (Array.isArray(r.data) ? r.data : []).find(c => c.email === email))
          .catch(() => null)
      )).then(resultados => {
        setRespSeleccionados(resultados.filter(Boolean).map(c => ({ email: c.email, nombre: c.nombre })))
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar, para resolver las etiquetas de los filtros que llegaron por la URL
  }, [])

  const [solicitud, setSolicitud] = useState({ page: 1, append: false, version: 0 })

  const cargarPagina = useCallback(async ({ signal }) => {
    const params = new URLSearchParams()
    params.set('page', solicitud.page)
    params.set('page_size', PAGE_SIZE)
    if (fBusquedaDeb)         params.set('q',           fBusquedaDeb)
    fEstatus.forEach(e => params.append('estatus_fus', e))
    fUnidades.forEach(id => params.append('unidadAdministrativa', id))
    fResponsables.forEach(email => params.append('usuario', email))
    if (fDesde)               params.set('fecha_desde', fDesde)
    if (fHasta)               params.set('fecha_hasta', fHasta)
    if (sortCol)              params.set('ordering', `${sortDir === 'desc' ? '-' : ''}${sortCol}`)

    const respuesta = await api.get(`/bitacora/?${params.toString()}`, { signal })
    return {
      items: respuesta.data.results || [],
      total: respuesta.data.total || 0,
      page: solicitud.page,
      append: solicitud.append,
    }
  }, [fBusquedaDeb, fEstatus, fUnidades, fResponsables, fDesde, fHasta, sortCol, sortDir, solicitud])

  const {
    data: resultado,
    error: errorCarga,
    loading: cargando,
  } = useAsyncResource(cargarPagina, {
    initialData: { items: [], total: 0, page: 1, append: false },
    mergeData: combinarPaginasBitacora,
  })
  const registros = resultado.items
  const total = resultado.total
  const pagina = resultado.page
  const cargar = (pag = 1, append = false) => {
    setSolicitud(actual => ({ page: pag, append, version: actual.version + 1 }))
  }


  useEffect(() => { cargar(1) }, [fBusquedaDeb, fEstatus, fUnidades, fResponsables, fDesde, fHasta, sortCol, sortDir])

  // Refleja los filtros/orden vigentes en la URL (reemplazando la entrada
  // actual del historial, no apilando una nueva en cada tecleo) — así la
  // búsqueda se puede compartir o recargar sin perderla. Las columnas
  // visibles no viajan aquí: son preferencia de vista, no parte de "qué
  // busqué", y ensuciarían la URL sin aportar a poder compartirla.
  useEffect(() => {
    const params = new URLSearchParams()
    if (fBusquedaDeb) params.set('q', fBusquedaDeb)
    fEstatus.forEach(e => params.append('estatus_fus', e))
    fUnidades.forEach(id => params.append('unidadAdministrativa', id))
    fResponsables.forEach(email => params.append('usuario', email))
    if (fDesde) params.set('fecha_desde', fDesde)
    if (fHasta) params.set('fecha_hasta', fHasta)
    if (sortCol) params.set('ordering', `${sortDir === 'desc' ? '-' : ''}${sortCol}`)
    setSearchParams(params, { replace: true })
  }, [fBusquedaDeb, fEstatus, fUnidades, fResponsables, fDesde, fHasta, sortCol, sortDir, setSearchParams])

  const limpiar = () => {
    setFBusqueda('')
    setFEstatus([]); setFDesde(''); setFHasta('')
    setPresetFecha(null)
    setColVisibles(COL_VISIBLES_DEFAULT)
    setUnidadSeleccionadas([])
    setFUnidades([])
    setRespSeleccionados([])
    setFResponsables([])
    setSortCol(null); setSortDir('asc')
  }
  const toggleColumna = (key) => setColVisibles(v => ({ ...v, [key]: !v[key] }))
  // Solo columnas AGREGADAS (activadas) más allá del default — no las que el
  // usuario desactivó desde su estado por defecto (esas no generan chip).
  const columnasAgregadas = COLUMNAS_TOGGLEABLES.filter(c => colVisibles[c.key] && !COL_VISIBLES_DEFAULT[c.key])
  const filtrosActivosChips = Boolean(fBusqueda || fEstatus.length || fUnidades.length || fResponsables.length || fDesde || fHasta)

  const formatearFechaHoraBitacora = d => d
    ? new Date(d).toLocaleString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
    : '—'

  // No todo evento de bitácora es un cambio de estatus (ej. una respuesta
  // registrada o una eliminación): en esos casos no hay estadoNuevo/Anterior
  // y el registro simplemente no lleva badge de estatus.
  const estatusDeRegistro = r => r.estadoNuevo || r.estadoAnterior || null

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
    if (colVisibles.estatus)          cols.push('estatus')
    if (colVisibles.cambioEstatus)  { cols.push('estado_ant'); cols.push('estado_nuevo') }
    if (colVisibles.observaciones)    cols.push('observaciones')
    return cols
  }

  const exportParams = () => {
    const p = new URLSearchParams()
    if (fBusquedaDeb)         p.set('q',           fBusquedaDeb)
    fEstatus.forEach(e => p.append('estatus_fus', e))
    fUnidades.forEach(id => p.append('unidadAdministrativa', id))
    fResponsables.forEach(email => p.append('usuario', email))
    if (fDesde)               p.set('fecha_desde', fDesde)
    if (fHasta)               p.set('fecha_hasta', fHasta)
    if (sortCol)              p.set('ordering', `${sortDir === 'desc' ? '-' : ''}${sortCol}`)
    p.set('columnas', columnasVisibles().join(','))
    const qs = p.toString()
    return qs ? `?${qs}` : ''
  }

  const cantColumnasUI = [
    colVisibles.fecha, colVisibles.folio,
    esADM && colVisibles.nombre, esADM && colVisibles.usuario,
    esADM && colVisibles.unidadAdministrativa,
    colVisibles.estatus, colVisibles.cambioEstatus, colVisibles.observaciones,
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
            <button className="bita-export-btn bita-export-descargar"
              disabled={exportando}
              onClick={() => setModalDescargarAbierto(true)}
              title="Descargar bitácora">
              {exportando
                ? <span className="btn-spinner" />
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>}
              {exportando ? 'Generando…' : 'Descargar'}
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
                  ref={busquedaInputRef}
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
                      {colVisibles.unidadAdministrativa && unidadSeleccionadas.length === 1
                        ? unidadSeleccionadas[0].unidadAdministrativa
                        : unidadSeleccionadas.length > 1
                          ? `${unidadSeleccionadas.length} unidades`
                          : c.label}
                    </button>
                    {unidadPopoverAbierto && createPortal(
                      <div className="bita-unidad-popover" ref={unidadPopoverRef} style={{ position: 'fixed', top: unidadPopoverPos.top, left: unidadPopoverPos.left }}>
                        {unidades.map(u => {
                          const seleccionado = unidadSeleccionadas.some(item => item.idUnidadAdministrativa === u.idUnidadAdministrativa)
                          return (
                            <label
                              key={u.idUnidadAdministrativa}
                              className={`bita-unidad-opcion${seleccionado ? ' seleccionada' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={seleccionado}
                                onChange={() => toggleUnidad(u)}
                              />
                              <span>{u.unidadAdministrativa}</span>
                            </label>
                          )
                        })}
                      </div>,
                      document.body
                    )}
                  </div>
                ) : (
                  <button key={c.key} type="button" className={`bita-pildora${colVisibles[c.key] ? ' activa' : ''}`} onClick={() => toggleColumna(c.key)}>
                    {c.label}
                  </button>
                ))}
                {esADM && (
                  <div className="bita-unidad-pill-wrap">
                    <button type="button" ref={respBtnRef} className={`bita-pildora${respSeleccionados.length ? ' activa' : ''}`} onClick={abrirRespPopover}>
                      {respSeleccionados.length === 1
                        ? respSeleccionados[0].nombre
                        : respSeleccionados.length > 1
                          ? `${respSeleccionados.length} responsables`
                          : 'Responsable'}
                    </button>
                    {respPopoverAbierto && createPortal(
                      <div className="bita-unidad-popover bita-resp-popover" ref={respPopoverRef} style={{ position: 'fixed', top: respPopoverPos.top, left: respPopoverPos.left }}>
                        <input
                          className="bita-resp-popover-buscar"
                          type="text"
                          placeholder="Buscar por nombre o correo…"
                          value={respBusqueda}
                          onChange={e => setRespBusqueda(e.target.value)}
                          autoFocus
                        />
                        {respBuscando && <div className="bita-resp-popover-cargando"><span className="btn-spinner" /></div>}
                        {!respBuscando && respResultados.length === 0 && (
                          <p className="bita-resp-popover-vacio">Sin resultados.</p>
                        )}
                        {!respBuscando && respResultados.map(c => {
                          const seleccionado = respSeleccionados.some(item => item.email === c.email)
                          return (
                            <label key={c.id} className={`bita-unidad-opcion${seleccionado ? ' seleccionada' : ''}`}>
                              <input type="checkbox" checked={seleccionado} onChange={() => toggleResponsable(c)} />
                              <span>{c.nombre} <small className="bita-resp-popover-email">({c.email})</small></span>
                            </label>
                          )
                        })}
                      </div>,
                      document.body
                    )}
                  </div>
                )}
                <span className="bita-pildoras-sep" />
                <button type="button" className={`bita-pildora${fEstatus.includes('Vencido') ? ' activa' : ''}`} onClick={() => toggleEstatus('Vencido')}>Vencido</button>
                <button type="button" className={`bita-pildora${fEstatus.includes('PorVencer') ? ' activa' : ''}`} onClick={() => toggleEstatus('PorVencer')}>Por vencer</button>
              </div>
            </div>

            {presetFecha === 'rango' && (
              <div className="bita-fechas">
                <div className="bita-fecha-grupo">
                  <span className="bita-fecha-lbl">Desde</span>
                  <FechaInput className="bita-input" type="date" value={fDesde} onChange={e => setFDesde(e.target.value)} />
                </div>
                <span className="bita-sep">–</span>
                <div className="bita-fecha-grupo">
                  <span className="bita-fecha-lbl">Hasta</span>
                  <FechaInput className="bita-input" type="date" value={fHasta} onChange={e => setFHasta(e.target.value)} />
                </div>
              </div>
            )}

            {/* Fila 3: Estatus (multi-selección) */}
            <div className="bita-fila-selects">
              <div className="bita-unidad-pill-wrap">
                <button type="button" ref={estatusBtnRef} className={`bita-pildora bita-pildora-estatus${fEstatus.length ? ' activa' : ''}`} onClick={abrirEstatusPopover}>
                  {fEstatus.length === 1
                    ? (ESTATUS_FUS_LABELS[fEstatus[0]] || fEstatus[0])
                    : fEstatus.length > 1
                      ? `${fEstatus.length} estatus`
                      : 'Todos los estatus'}
                </button>
                {estatusPopoverAbierto && createPortal(
                  <div className="bita-unidad-popover" ref={estatusPopoverRef} style={{ position: 'fixed', top: estatusPopoverPos.top, left: estatusPopoverPos.left }}>
                    {estatusOpciones.map(e => {
                      const seleccionado = fEstatus.includes(e)
                      return (
                        <label key={e} className={`bita-unidad-opcion${seleccionado ? ' seleccionada' : ''}`}>
                          <input type="checkbox" checked={seleccionado} onChange={() => toggleEstatus(e)} />
                          <span>{ESTATUS_FUS_LABELS[e] || e}</span>
                        </label>
                      )
                    })}
                  </div>,
                  document.body
                )}
              </div>
            </div>
          </div>

          {/* Fila 4: FILTROS ACTIVOS — dentro del panel verde */}
          {filtrosActivosChips && <hr className="bita-divider" />}
          {(filtrosActivosChips || compacto) && (
            <div className={`bita-chips${compacto ? ' bita-chips-compacta' : ''}`}>
              {filtrosActivosChips && <span className="chips-label">FILTROS ACTIVOS:</span>}
              {fBusqueda && (
                <span className="bita-chip bita-chip-clickable" onClick={() => busquedaInputRef.current?.focus()} title="Editar la búsqueda">
                  Búsqueda: "{fBusqueda}"
                  <button type="button" onClick={e => { e.stopPropagation(); setFBusqueda('') }} aria-label="Quitar filtro de búsqueda">×</button>
                </span>
              )}
              {fUnidades.length > 0 && unidadSeleccionadas.map(u => (
                <span key={u.idUnidadAdministrativa} className="bita-chip bita-chip-clickable" onClick={() => abrirDesdeChip(abrirUnidadPopover)} title="Editar unidades seleccionadas">
                  Unidad administrativa: {u.unidadAdministrativa}
                  <button type="button" onClick={e => { e.stopPropagation(); quitarUnidad(u.idUnidadAdministrativa) }} aria-label="Quitar unidad administrativa seleccionada">×</button>
                </span>
              ))}
              {fResponsables.length > 0 && respSeleccionados.map(r => (
                <span key={r.email} className="bita-chip bita-chip-clickable" onClick={() => abrirDesdeChip(abrirRespPopover)} title="Editar responsables seleccionados">
                  Responsable: {r.nombre}
                  <button type="button" onClick={e => { e.stopPropagation(); quitarResponsable(r.email) }} aria-label="Quitar responsable seleccionado">×</button>
                </span>
              ))}
              {fEstatus.map(e => (
                <span key={e} className="bita-chip bita-chip-clickable" onClick={() => abrirDesdeChip(abrirEstatusPopover)} title="Editar estatus seleccionados">
                  Estatus: {ESTATUS_FUS_LABELS[e] || e}
                  <button type="button" onClick={ev => { ev.stopPropagation(); toggleEstatus(e) }} aria-label={`Quitar estatus ${ESTATUS_FUS_LABELS[e] || e}`}>×</button>
                </span>
              ))}
              {fDesde && fHasta ? (
                <span className="bita-chip bita-chip-clickable" onClick={() => setPresetFecha('rango')} title="Editar rango de fechas">
                  Fecha: {fmtFechaCorta(fDesde)} – {fmtFechaCorta(fHasta)}
                  <button type="button" onClick={e => { e.stopPropagation(); setFDesde(''); setFHasta(''); setPresetFecha(null) }} aria-label="Quitar filtro de fecha">×</button>
                </span>
              ) : (
                <>
                  {fDesde && (
                    <span className="bita-chip bita-chip-clickable" onClick={() => setPresetFecha('rango')} title="Editar fecha desde">
                      Desde: {fmtFechaCorta(fDesde)}
                      <button type="button" onClick={e => { e.stopPropagation(); setFDesde(''); setPresetFecha(null) }} aria-label="Quitar filtro de fecha desde">×</button>
                    </span>
                  )}
                  {fHasta && (
                    <span className="bita-chip bita-chip-clickable" onClick={() => setPresetFecha('rango')} title="Editar fecha hasta">
                      Hasta: {fmtFechaCorta(fHasta)}
                      <button type="button" onClick={e => { e.stopPropagation(); setFHasta(''); setPresetFecha(null) }} aria-label="Quitar filtro de fecha hasta">×</button>
                    </span>
                  )}
                </>
              )}
              {columnasAgregadas.filter(c => c.key !== 'unidadAdministrativa').map(c => (
                <span key={c.key} className="bita-chip">
                  Columnas: {c.label}
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
                {colVisibles.estatus && th('estatus', 'Estatus')}
                {colVisibles.cambioEstatus  && th('cambioEstatus', 'Cambio de estatus', false)}
                {colVisibles.observaciones  && th('observaciones', 'Observaciones')}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando && registros.length === 0 && (
                <tr><td colSpan={COLS} className="bita-loading"><SkeletonList /></td></tr>
              )}
              {!cargando && errorCarga && (
                <tr>
                  <td colSpan={COLS} className="bita-error-cell">
                    <p className="bita-error-msg">No se pudo cargar la lista.</p>
                    <button className="bita-retry-btn" onClick={() => cargar(1)}>Reintentar</button>
                  </td>
                </tr>
              )}
              {!cargando && !errorCarga && registros.length === 0 && (
                <tr><td colSpan={COLS} className="bita-empty">No hay registros que coincidan con los filtros.</td></tr>
              )}
              {registros.map(r => (
                <tr key={r.id}>
                  {colVisibles.fecha && <td className="bita-fecha" data-label="Fecha y hora (CDMX)">{formatearFechaHoraBitacora(r.fechaHora)}</td>}
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
                      <span className="bita-folio-fecha-mobile">{formatearFechaHoraBitacora(r.fechaHora)}</span>
                      {estatusDeRegistro(r) && (
                        <span className="bita-mobile-badge">
                          {ESTATUS_FUS_LABELS[estatusDeRegistro(r)] || estatusDeRegistro(r)}
                        </span>
                      )}
                    </td>
                  )}
                  {esADM && colVisibles.nombre  && <td className="bita-usuario" data-label="Responsable">{r.nombre || '—'}</td>}
                  {esADM && colVisibles.usuario && <td className="bita-email-col" data-label="Correo del responsable">{r.usuario}</td>}
                  {esADM && colVisibles.unidadAdministrativa && (
                    <td data-label="Unidad administrativa">{r.unidadAdministrativa || '—'}</td>
                  )}
                  {colVisibles.estatus && (
                    <td data-label="Estatus">
                      {estatusDeRegistro(r) ? <Badge estatus={estatusDeRegistro(r)} theme="light" /> : '—'}
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
                          className="bita-historial-btn"
                          title={`Ver historial FUS ${r.fusFolio}`}
                          onClick={() => setModalTimelineFolio(r.fusFolio)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12a9 9 0 1 0 3-6.7"/>
                            <path d="M3 5v4h4"/>
                            <polyline points="12 7 12 12 15.5 14"/>
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
      {detalleFolio && (
        <ModalDetalleFUS folio={detalleFolio} onClose={() => setDetalleFolio(null)} />
      )}
      {modalTimelineFolio && (
        <ModalTimeline folio={modalTimelineFolio} onClose={() => setModalTimelineFolio(null)} />
      )}
      {modalDescargarAbierto && (
        <ModalDescargarBitacora
          onCancelar={() => setModalDescargarAbierto(false)}
          onConfirmar={formato => {
            setExportando(true)
            const archivo = formato === 'pdf' ? 'bitacora.pdf' : 'bitacora.xlsx'
            return descargar(`/bitacora/exportar/${formato}/${exportParams()}`, archivo)
              .finally(() => { setExportando(false); setModalDescargarAbierto(false) })
          }}
        />
      )}
    </AppLayout>
  )
}
