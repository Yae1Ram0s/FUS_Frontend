import { useCallback, useState, useEffect, useRef } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import ModalTimeline from '../components/ModalTimeline'
import ModalTurnar from '../components/FUS/ModalTurnar'
import FusCard from '../components/FUS/FusCard'
import PrioridadFiltroChip from '../components/FUS/PrioridadFiltroChip'
import FiltrosActivosChips from '../components/FiltrosActivosChips'
import DetalleFUS from '../components/FUS/DetalleFUS'
import api from '../api/api'
import { useToast } from '../context/ToastContext'
import { useNotificaciones } from '../context/NotificacionesContext'
import { useEstatus } from '../hooks/useEstatus'
import { useAsyncResource } from '../hooks/useAsyncResource'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import './ConsultarFUS.css'

const PAGE_SIZE = 30

function combinarPaginasFUS(estadoAnterior, paginaNueva) {
  if (!paginaNueva.append) return paginaNueva
  const ids = new Set(estadoAnterior.items.map(item => item.id))
  return {
    ...paginaNueva,
    items: [
      ...estadoAnterior.items,
      ...paginaNueva.items.filter(item => !ids.has(item.id)),
    ],
  }
}

// Relabel puntual del chip de filtro para ROL1 — el catálogo comparte
// "Pendiente de validación" con ROL2, pero en su propia bandeja se lee mejor
// como acción pendiente de él: "Por validar".
const FILTRO_LABEL_ROL1 = { Pendiente_validacion: 'Por validar' }

/* ── Panel de detalle FUS ── */
/* ── Página principal ── */
export default function ConsultarFUS() {
  const [searchParams, setSearchParams] = useSearchParams()
  const folioParam = searchParams.get('folio')
  const location = useLocation()
  // Solo RegistrarFUS manda esta bandera al navegar aquí (ver RegistrarFUS.jsx)
  // — así el loader de pantalla completa queda reservado para ese hueco
  // puntual y no aparece al entrar por folio desde otros lados (ej. clic en
  // una notificación), donde solo se quiere ir directo al FUS sin aviso.
  const recienRegistrado = Boolean(location.state?.recienRegistrado)

  const { estatus: estatusROL1 } = useEstatus('PARTICULAR')
  const toast = useToast()

  const [busqueda,     setBusqueda]     = useState('')
  const busquedaAplicada = useDebouncedValue(busqueda, 300)
  // Varios chips de estatus a la vez (ej. Registrado + Turnado): se guardan
  // como lista y se combinan con OR en el backend — un FUS solo puede tener
  // un estatus, así que "varios seleccionados" amplía la bandeja, no la
  // reduce. En la URL viaja como un solo string separado por comas.
  const [filtro,       setFiltro]       = useState(() => (searchParams.get('filtro') || '').split(',').filter(Boolean))
  const [prioridadFiltro, setPrioridadFiltro] = useState(() => searchParams.get('prioridad') || '')
  const [seleccionado, setSeleccionado] = useState(null)
  const [turnarFUS,    setTurnarFUS]    = useState(null)
  const [modalTimelineFolio, setModalTimelineFolio] = useState(null)
  const [highlightId,  setHighlightId]  = useState(null)
  const [panelAbierto, setPanelAbierto] = useState(() => searchParams.get('modo') === 'lista' || Boolean(searchParams.get('filtro')) || Boolean(searchParams.get('prioridad')))
  const [solicitud, setSolicitud] = useState({
    page: 1,
    append: false,
    version: 0,
  })

  // Firma de "qué se está pidiendo" (sin página/append): si cambia entre una
  // llamada y la siguiente, la página/append que traía `solicitud` quedaron
  // obsoletos (pertenecen al filtro anterior) y se ignoran para esta
  // llamada — si no, cambiar de filtro estando en "página 2" mezclaba
  // resultados de dos conjuntos filtrados distintos.
  const filtrosKeyRef = useRef('')
  const cargarPagina = useCallback(async ({ signal }) => {
    const filtrosKey = JSON.stringify([folioParam, filtro, prioridadFiltro, busquedaAplicada])
    const filtrosCambiaron = filtrosKeyRef.current !== filtrosKey
    filtrosKeyRef.current = filtrosKey
    const page   = filtrosCambiaron ? 1 : solicitud.page
    const append = filtrosCambiaron ? false : solicitud.append

    const params = { page, page_size: PAGE_SIZE }
    if (folioParam) {
      // Consulta puntual por folio (clic en notificación/bitácora/dashboard):
      // se filtra en el servidor, así se encuentra aunque no esté entre los
      // más recientes de la bandeja general.
      params.folio = folioParam
    } else {
      if (filtro.length)   params.estatusParticular = filtro.join(',')
      if (prioridadFiltro) params.prioridad = prioridadFiltro
      if (busquedaAplicada) params.search = busquedaAplicada
    }
    const response = await api.get('/fus/', { params, signal })
    const items = response.data.results || []
    const match = folioParam ? (items[0] || null) : null
    return {
      items,
      total: response.data.total || 0,
      page,
      append,
      match,
      folioNoEncontrado: Boolean(folioParam) && !match,
    }
  }, [
    busquedaAplicada,
    filtro,
    folioParam,
    prioridadFiltro,
    solicitud,
  ])
  const procesarCargaExitosa = useCallback(result => {
    if (result.match) {
      setFiltro([])
      setPrioridadFiltro('')
      setBusqueda('')
      setSeleccionado(result.match)
      setHighlightId(result.match.id)
      setPanelAbierto(true)
      setSearchParams({}, { replace: true })
      return
    }
    if (result.folioNoEncontrado) {
      toast.error(`No se encontró la solicitud ${folioParam}.`)
      setSearchParams({}, { replace: true })
      return
    }
    setSeleccionado(anterior => {
      if (!anterior) return anterior
      return result.items.find(item => item.id === anterior.id) || anterior
    })
  }, [folioParam, setSearchParams, toast])
  const {
    data: resultado,
    loading: cargando,
    error: errorCarga,
    setData: setResultado,
  } = useAsyncResource(cargarPagina, {
    initialData: {
      items: [],
      total: 0,
      page: 1,
      append: false,
      match: null,
    },
    mergeData: combinarPaginasFUS,
    onSuccess: procesarCargaExitosa,
  })
  const lista = resultado.items
  const totalItems = resultado.total
  const pagina = resultado.page
  const recargar = () => setSolicitud(actual => ({
    page: 1,
    append: false,
    version: actual.version + 1,
  }))
  const cargarMas = () => setSolicitud(actual => ({
    page: pagina + 1,
    append: true,
    version: actual.version + 1,
  }))

  /* En vivo: si llega por WebSocket un aviso de SLA por vencer, el FUS
     correspondiente (si ya está cargado en la lista) se sube al inicio y
     queda marcado como "por vencer" — sin esperar a un refresh manual. */
  const notifCtx = useNotificaciones()
  const ultimaNotifId = notifCtx?.notifs?.[0]?.id
  useEffect(() => {
    const notif = notifCtx?.notifs?.[0]
    if (!notif || notif.tipo !== 'SLA_POR_VENCER') return
    setResultado(prev => {
      const idx = prev.items.findIndex(f => f.folio === notif.fusFolio)
      if (idx === -1) return prev
      const item = { ...prev.items[idx], slaPorVencer: true }
      return {
        ...prev,
        items: [
          item,
          ...prev.items.slice(0, idx),
          ...prev.items.slice(idx + 1),
        ],
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ultimaNotifId` ya es el proxy primitivo estable de `notifCtx?.notifs` usado en todo el proyecto
  }, [ultimaNotifId])

  /* En vivo: cualquier notificación ligada a un FUS (comisionar, atendido,
     concluir, rechazar, etc.) dispara un refresh silencioso — cubre tanto
     un cambio de estatus en algo que ya se ve en la lista/detalle como una
     asignación nueva que todavía no aparecía. SLA_POR_VENCER queda fuera:
     ya tiene su propio parche puntual arriba, sin recargar todo. */
  useEffect(() => {
    const notif = notifCtx?.notifs?.[0]
    if (!notif?.fusFolio || notif.tipo === 'SLA_POR_VENCER') return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza la bandeja con un evento WebSocket externo
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ultimaNotifId identifica el evento externo
  }, [ultimaNotifId])

  // Tras turnar, se pide el FUS ya actualizado (mismo FUSSerializer que usa
  // la lista) y se coloca al inicio en vez de recargar toda la bandeja —
  // así se ve de inmediato con el estatus "Turnado" y el destinatario
  // asignado, en la misma posición donde ya está seleccionado.
  const handleTurnarDone = async () => {
    const fusId = turnarFUS?.id
    setTurnarFUS(null)
    if (!fusId) return
    try {
      const { data: fusActualizado } = await api.get(`/fus/${fusId}/`)
      setResultado(prev => ({
        ...prev,
        items: [fusActualizado, ...prev.items.filter(item => item.id !== fusActualizado.id)],
      }))
      setSeleccionado(fusActualizado)
      setHighlightId(fusActualizado.id)
      toast.success(`Solicitud ${fusActualizado.folio} turnada correctamente.`)
    } catch {
      // El turnado ya se guardó en el servidor (ModalTurnar solo llama a
      // onDone tras una respuesta exitosa) — si este refresco puntual
      // falla, un recargar() de respaldo evita que la bandeja quede
      // desincronizada.
      setSeleccionado(null)
      recargar()
    }
  }

  const toggleFiltro = f => setFiltro(prev => (
    prev.includes(f) ? prev.filter(v => v !== f) : [...prev, f]
  ))

  const labelEstatusFiltro = clave => {
    if (clave === 'Vencido') return 'Vencido'
    if (clave === 'PorVencer') return 'Por vencer'
    return FILTRO_LABEL_ROL1[clave] || estatusROL1.find(e => e.clave === clave)?.nombre || clave
  }

  /* Resumen de "filtros activos" + Limpiar todo (búsqueda + estatus +
     prioridad) — mismo diseño que ya usa Bitácora. */
  const chipsActivos = [
    ...(busqueda ? [{ key: 'busqueda', label: `Búsqueda: "${busqueda}"`, onQuitar: () => setBusqueda('') }] : []),
    ...filtro.map(f => ({ key: `estatus-${f}`, label: labelEstatusFiltro(f), onQuitar: () => toggleFiltro(f) })),
    ...(prioridadFiltro ? [{ key: 'prioridad', label: `Prioridad: ${prioridadFiltro}`, onQuitar: () => setPrioridadFiltro('') }] : []),
  ]
  const limpiarTodosFiltros = () => {
    setBusqueda('')
    setFiltro([])
    setPrioridadFiltro('')
  }

  /* ── Panel izquierdo: cerrado por defecto (modo dashboard) ── */

  useEffect(() => {
    if (searchParams.get('filtro') || searchParams.get('prioridad')) {
      const next = new URLSearchParams(searchParams)
      next.delete('filtro')
      next.delete('prioridad')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe ejecutarse una vez al montar, para limpiar los params iniciales de la URL
  }, [])

  useEffect(() => {
    const handleConsultar = () => { setPanelAbierto(true); setSeleccionado(null) }
    window.addEventListener('scs:consultar', handleConsultar)
    return () => window.removeEventListener('scs:consultar', handleConsultar)
  }, [])

  return (
    <AppLayout>
      {/* Fuera de .cfus-inner/.cfus-left a propósito: tienen backdrop-filter,
          que le crea su propio "containing block" a los descendientes
          position:fixed — anidado ahí, el overlay del Spinner quedaba
          recortado/posicionado relativo al panel en vez de a toda la
          pantalla. Recién llegado desde "Registrar FUS" (folio en la URL,
          aún sin resolver) — mismo loader que se ve justo antes de navegar
          aquí, para que no se sienta un corte. */}
      {cargando && folioParam && recienRegistrado && <Spinner overlay dots label="Cargando la solicitud registrada…" />}
      <div className={`cfus-inner${seleccionado ? ' has-detail' : ''}${panelAbierto && !seleccionado ? ' lista-mode' : ''}`}>

        {/* ── Panel izquierdo ── */}
        <div className={`cfus-left${!panelAbierto ? ' panel-cerrado' : ''}`}>
          <div className="panel-header">
            {panelAbierto && (
              <div className="panel-header-left">
                <h3 className="panel-title">Solicitudes FUS</h3>
              </div>
            )}
            <button
              className="panel-toggle"
              onClick={() => setPanelAbierto(p => !p)}
              title={panelAbierto ? 'Cerrar panel' : 'Abrir panel'}
              aria-expanded={panelAbierto}
            >
              <svg
                className={panelAbierto ? 'panel-toggle-icon-open' : 'panel-toggle-icon-closed'}
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                {panelAbierto
                  ? <polyline points="15 18 9 12 15 6" />
                  : <polyline points="9 18 15 12 9 6" />}
              </svg>
            </button>
          </div>

          <div className={`panel-content${!panelAbierto ? ' panel-content-oculto' : ''}`}>
            <div className="left-search">
              <svg className="search-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                aria-label="Buscar por folio, descripción, contacto, medio"
                placeholder="Buscar por folio, descripción, contacto, medio…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>

            <div className="left-filtros">
              <button
                className={`filtro-chip${filtro.length === 0 ? ' filtro-chip-active' : ''}`}
                onClick={() => setFiltro([])}
              >
                Todos
              </button>
              {estatusROL1.filter(e => e.clave !== 'Rechazado').map(e => (
                <button
                  key={e.clave}
                  className={`filtro-chip filtro-chip-${e.clave.toLowerCase()}${filtro.includes(e.clave) ? ' filtro-chip-active' : ''}`}
                  onClick={() => toggleFiltro(e.clave)}
                >
                  {FILTRO_LABEL_ROL1[e.clave] || e.nombre}
                </button>
              ))}
              <button
                className={`filtro-chip filtro-chip-vencido${filtro.includes('Vencido') ? ' filtro-chip-active' : ''}`}
                onClick={() => toggleFiltro('Vencido')}
              >
                Vencido
              </button>
              <button
                className={`filtro-chip filtro-chip-porvencer${filtro.includes('PorVencer') ? ' filtro-chip-active' : ''}`}
                onClick={() => toggleFiltro('PorVencer')}
              >
                Por vencer
              </button>
              <PrioridadFiltroChip valor={prioridadFiltro} onChange={setPrioridadFiltro} />
            </div>

            <FiltrosActivosChips chips={chipsActivos} onLimpiarTodo={limpiarTodosFiltros} />

            {errorCarga && lista.length > 0 && (
              <div className="banner-error-carga">
                <span>No se pudo actualizar — mostrando la última información disponible.</span>
                <button type="button" onClick={recargar}>Reintentar</button>
              </div>
            )}

            <div className="left-lista">
              {cargando && lista.length === 0 && <Spinner overlay={false} fill label="Cargando solicitudes…" />}
              {!cargando && errorCarga && lista.length === 0 && (
                <div className="empty-state empty-state-error">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="empty-state-title">No se pudo cargar</p>
                  <p className="empty-state-sub">Ocurrió un error al obtener las solicitudes.</p>
                  <button type="button" className="btn-reintentar" onClick={recargar}>Reintentar</button>
                </div>
              )}
              {!cargando && !errorCarga && lista.length === 0 && (
                <div className="empty-state">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="9" y1="13" x2="15" y2="13"/>
                    <line x1="9" y1="17" x2="12" y2="17"/>
                  </svg>
                  <p className="empty-state-title">Sin solicitudes</p>
                  <p className="empty-state-sub">{busqueda || filtro.length > 0 ? 'Ningún FUS coincide con tu búsqueda.' : 'Aún no hay FUS registrados.'}</p>
                </div>
              )}
              {lista.map(f => (
                <FusCard
                  key={f.id}
                  fus={f}
                  activo={seleccionado?.id === f.id}
                  highlight={highlightId === f.id}
                  onClick={() => { setSeleccionado(f); setHighlightId(null); if (window.innerWidth <= 768) setPanelAbierto(false) }}
                  onVerHistorial={() => setModalTimelineFolio(f.folio)}
                />
              ))}
              {lista.length < totalItems && (
                <button className="btn-cargar-mas" onClick={cargarMas} disabled={cargando}>
                  {cargando && <span className="btn-spinner" />}
                  {cargando ? 'Cargando…' : `Cargar más (${lista.length} de ${totalItems})`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Panel derecho ── */}
        <div className="cfus-right">
          {seleccionado
            ? <DetalleFUS
                key={`${seleccionado.id}_${seleccionado.estatusParticular}`}
                fus={seleccionado}
                onTurnar={f => setTurnarFUS(f)}
                onBack={() => { setSeleccionado(null); setPanelAbierto(true) }}
              />
            : (
              <div className="cfus-hint-select">
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <p>Selecciona una solicitud del panel izquierdo para ver el detalle completo</p>
              </div>
            )
          }
        </div>
      </div>

      {turnarFUS && (
        <ModalTurnar
          fus={turnarFUS}
          onClose={() => setTurnarFUS(null)}
          onDone={handleTurnarDone}
        />
      )}

      {modalTimelineFolio && (
        <ModalTimeline folio={modalTimelineFolio} onClose={() => setModalTimelineFolio(null)} />
      )}
    </AppLayout>
  )
}
