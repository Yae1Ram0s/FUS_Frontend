import { useCallback, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import AppLayout from '../components/AppLayout'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import ModalTimeline from '../components/ModalTimeline'
import SeguimientoComisionadoFeed, { SeguimientoComisionadoForm } from '../components/Comisionado/SeguimientoComisionadoFeed'
import EvidenciaItem from '../components/FUS/EvidenciaItem'
import PrioridadPills from '../components/FUS/PrioridadPills'
import api from '../api/api'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useNotificaciones } from '../context/NotificacionesContext'
import { useToast } from '../context/ToastContext'
import { formatearFechaHora } from '../utils/fechas'
import { formatMedioRecepcion } from '../utils/medio'
import { FolioTexto } from '../utils/folio'
import { truncarTexto } from '../utils/texto'
// Reusa el layout de lista+detalle (.st-*, .seccion, .sec-*, .dt-panel,
// .drow, .fus-card...) tal cual SolicitudesTurnadas — este chunk se carga
// aparte (lazy-loading por ruta) y no lo hereda solo, así que hay que
// importarlo explícitamente. FUSComisionados.css va después: solo lo
// específico del comisionado, y puede sobreescribir si hiciera falta.
import './SolicitudesTurnadas.css'
import './FUSComisionados.css'

const PAGE_SIZE = 30

function combinarPaginas(estadoAnterior, paginaNueva) {
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

/* ── Fila de detalle ── */
function DRow({ label, value, tall }) {
  return (
    <div className={`drow${tall ? ' drow-tall' : ''}`}>
      <span className="drow-label">{label}</span>
      <span className="drow-value">{value || '—'}</span>
    </div>
  )
}

function EvidenciaList({ evidencias }) {
  if (!evidencias?.length) return (
    <div className="drow"><span className="drow-label">Evidencia</span><span className="drow-value">—</span></div>
  )
  return <div className="ev-lista">{evidencias.map(ev => <EvidenciaItem key={ev.id} evidencia={ev} />)}</div>
}

/* ── Feed de Respuestas y seguimiento (comisionado) ──
   El historial (lectura) vive en SeguimientoComisionadoFeed, y el
   formulario para agregar en SeguimientoComisionadoForm — ambos reusados
   tal cual por SolicitudesTurnadas, donde Rol 2 también puede agregar una
   vez que comisionó (ver EsComisionadoAsignado en el backend). `refreshKey`
   remonta el feed para reflejar lo recién agregado, ya que el feed
   compartido administra su propio fetch internamente. */
function SeguimientoComisionado({ fusId, folio, estatusParticular }) {
  const [refreshKey, setRefreshKey] = useState(0)

  // 'En_seguimiento' = aún sin responder; 'Atendido' = ya respondió al menos
  // una vez (el backend hace esa transición sola); 'Rechazado' = el
  // Particular lo rechazó — su próxima respuesta es la que lo reabre directo
  // a "Atendido" (ya no basta con que alguien lo consulte). Ya no hay
  // "finalizar" de su parte: quien manda el FUS a validación es Rol 1/Rol 2
  // desde el botón "Atendido" (ver AccionesValidacion).
  const puedeAgregar = ['En_seguimiento', 'Atendido', 'Rechazado'].includes(estatusParticular)

  return (
    <>
      <SeguimientoComisionadoFeed key={refreshKey} fusId={fusId} folio={folio} />

      {puedeAgregar && (
        <SeguimientoComisionadoForm fusId={fusId} onAgregado={() => setRefreshKey(k => k + 1)} />
      )}

      {estatusParticular === 'Concluido' && (
        <p className="dt-concluido-texto">Solicitud concluida — sin acciones pendientes</p>
      )}
    </>
  )
}

/* ── Detalle de FUS comisionado ── */
function DetalleFUSComisionado({ fus, onBack }) {
  const tieneExterno = fus.nombreExterno || fus.telefonoExterno || fus.correoExterno
  const nombreSolicitante = fus.idSolicitanteInterno?.nombre

  return (
    <div className="dt-panel">
      <button className="btn-volver-mobile" onClick={onBack} aria-label="Volver a la lista">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Volver a la lista
      </button>

      <div className="seccion">
        <div className="sec-header sec-datos">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          {fus.folio}
        </div>

        <div className="sec-subseccion">
          <span className="sec-sublabel">Datos generales</span>
          <div className="sec-grid-2">
            <DRow label="Fecha y hora"        value={formatearFechaHora(fus.fechaHora)} />
            <DRow label="Medio de recepción"  value={formatMedioRecepcion(fus.idMedioRecepcion, fus.medioEspecificacion)} />
            <DRow label="Solicitante interno" value={nombreSolicitante} />
          </div>
        </div>

        <div className="sec-subseccion">
          <span className="sec-sublabel">Descripción de la solicitud</span>
          <DRow label="Descripción" value={fus.descripcion} tall />
          {fus.contexto && <DRow label="Datos o antecedentes de contexto de la solicitud" value={fus.contexto} tall />}
        </div>

        {tieneExterno && (
          <div className="sec-subseccion">
            <span className="sec-sublabel">Datos de contacto de solicitante externo</span>
            <div className="sec-grid-3">
              {fus.nombreExterno   && <DRow label="Nombre"           value={fus.nombreExterno} />}
              {fus.telefonoExterno && <DRow label="Teléfono/Celular" value={fus.telefonoExterno} />}
              {fus.correoExterno   && <DRow label="Correo"           value={fus.correoExterno} />}
            </div>
          </div>
        )}

        <div className="sec-subseccion">
          <span className="sec-sublabel">Evidencia</span>
          <EvidenciaList evidencias={fus.evidencias} />
        </div>

        <div className="sec-subseccion">
          <span className="sec-sublabel">Prioridad</span>
          <PrioridadPills valor={fus.prioridad} criterios={fus.criterios} />
        </div>
      </div>

      <SeguimientoComisionado
        fusId={fus.id}
        folio={fus.folio}
        estatusParticular={fus.estatusParticular}
      />
    </div>
  )
}

/* ── Tarjeta de la lista — mismo layout que FusCard.jsx (Consultar FUS):
   fila de meta con íconos y botón de historial, en vez del bloque anterior
   de párrafos "Etiqueta: valor" sin íconos. Conserva la fecha de asignación
   (no la de registro) porque es el dato relevante para el Comisionado. ── */
function FUSCard({ f, activo, onClick, onVerHistorial }) {
  return (
    <div
      className={`fus-card${activo ? ' fus-card-activo' : ''}${f.slaVencido ? ' fus-card-vencido' : ''}${!f.slaVencido && f.slaPorVencer ? ' fus-card-por-vencer' : ''}`}
      onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      <div className="fus-card-top">
        <strong className="fus-folio"><FolioTexto folio={f.folio} /></strong>
        <span className="fus-card-badges">
          <Badge estatus={f.estatusParticular} />
          {f.estadoTemporalidad && <Badge estatus={f.estadoTemporalidad} />}
        </span>
      </div>
      <p className="fus-meta">
        <span className="fus-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          {formatearFechaHora(f.fechaAsignacion)}
        </span>
        <span className="fus-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="m22 7-10 6L2 7"/>
          </svg>
          {f.idMedioRecepcion?.nombreMedio || '—'}
        </span>
      </p>
      {f.descripcion && <p className="fus-desc">{truncarTexto(f.descripcion)}</p>}
      <button
        className="fus-card-historial-btn"
        title="Ver historial"
        aria-label={`Ver historial de ${f.folio}`}
        onClick={e => { e.stopPropagation(); onVerHistorial(f.folio) }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 3-6.7"/>
          <path d="M3 5v4h4"/>
          <polyline points="12 7 12 12 15.5 14"/>
        </svg>
      </button>
    </div>
  )
}

/* ── Página principal ── */
export default function FUSComisionados() {
  const [searchParams, setSearchParams] = useSearchParams()
  // Deep-link puntual (ej. clic en el FUS vinculado de una actividad del
  // Calendario): igual que ConsultarFUS/SolicitudesTurnadas, se busca por
  // folio y se selecciona en cuanto llega — este endpoint no tiene un
  // parámetro de folio exacto propio, así que se reusa `search` (icontains)
  // y se afina con un match exacto sobre los resultados.
  const folioParam = searchParams.get('folio')

  const [busqueda,     setBusqueda]     = useState('')
  const [seleccionado, setSeleccionado] = useState(null)
  const [modalTimelineFolio, setModalTimelineFolio] = useState(null)
  const [cargandoMas, setCargandoMas] = useState(false)
  const toast = useToast()
  const queryClient = useQueryClient()
  const busquedaDeb = useDebouncedValue(busqueda, 300)

  // Cambiar la búsqueda o el folio aísla la consulta en su propia entrada de
  // caché (siempre arranca en página 1) — ya no hace falta el efecto manual
  // que antes reiniciaba la paginación al cambiar el filtro.
  const queryKey = ['fusComisionadosListado', { folioParam, busquedaDeb }]
  const construirParams = useCallback((page) => {
    const params = { page, page_size: PAGE_SIZE }
    if (folioParam) params.search = folioParam
    else if (busquedaDeb) params.search = busquedaDeb
    return params
  }, [busquedaDeb, folioParam])

  const {
    data: resultado = { items: [], total: 0, page: 1, append: false, match: null },
    isFetching: cargando,
    error: errorCarga,
    refetch: recargar,
  } = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const response = await api.get('/fus/mis-comisionados/', { params: construirParams(1), signal })
      const items = response.data.results || []
      const match = folioParam ? items.find(fus => fus.folio === folioParam) : null
      return { items, total: response.data.total || 0, page: 1, append: false, match }
    },
  })
  const lista = resultado.items
  const totalItems = resultado.total
  const pagina = resultado.page

  const procesarCargaExitosa = useCallback(resultado => {
    if (resultado.match) {
      setBusqueda('')
      setSeleccionado(resultado.match)
      setSearchParams({}, { replace: true })
    }
  }, [setSearchParams])
  // Equivalente al onSuccess que useAsyncResource ya no ofrece con useQuery (v5).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reemplaza el onSuccess ya removido de useQuery en v5
  useEffect(() => { procesarCargaExitosa(resultado) }, [resultado, procesarCargaExitosa])

  useEffect(() => {
    if (!seleccionado) return
    const actualizado = lista.find(fus => fus.id === seleccionado.id)
    if (actualizado && actualizado !== seleccionado) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el detalle con la página recién cargada
      setSeleccionado(actualizado)
    }
  }, [lista, seleccionado])

  const cargarMas = async () => {
    if (cargandoMas) return
    setCargandoMas(true)
    try {
      const siguientePagina = pagina + 1
      const response = await api.get('/fus/mis-comisionados/', { params: construirParams(siguientePagina) })
      const paginaNueva = { items: response.data.results || [], total: response.data.total || 0, page: siguientePagina, append: true, match: null }
      queryClient.setQueryData(queryKey, prev => combinarPaginas(prev, paginaNueva))
    } catch {
      toast.error('No se pudieron cargar más solicitudes.')
    } finally {
      setCargandoMas(false)
    }
  }

  /* En vivo: cualquier notificación ligada a un FUS (asignación nueva,
     validación, rechazo, etc.) dispara un refresh silencioso — cubre tanto
     un cambio de estatus en algo que ya se ve en la lista/detalle como una
     asignación nueva que todavía no aparecía. */
  const notifCtx = useNotificaciones()
  const ultimaNotifId = notifCtx?.notifs?.[0]?.id
  useEffect(() => {
    const notif = notifCtx?.notifs?.[0]
    if (!notif?.fusFolio) return
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ultimaNotifId identifica el evento que dispara la recarga
  }, [ultimaNotifId])

  const [panelAbierto, setPanelAbierto] = useState(() => window.innerWidth > 768)

  return (
    <AppLayout>
      <div className={`st-inner${seleccionado ? ' has-detail' : ''}${panelAbierto && !seleccionado ? ' lista-mode' : ''}`}>

        <div className={`st-left${!panelAbierto ? ' panel-cerrado' : ''}`}>
          <div className="panel-header">
            {panelAbierto && <h3 className="panel-title">FUS Comisionados</h3>}
            <button className="panel-toggle" onClick={() => setPanelAbierto(p => !p)} title={panelAbierto ? 'Cerrar panel' : 'Abrir panel'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {panelAbierto ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
              </svg>
            </button>
          </div>

          <div className={`panel-content${!panelAbierto ? ' panel-content-oculto' : ''}`}>
            <div className="left-search">
              <svg className="search-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input placeholder="Buscar por folio o descripción…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>

            {errorCarga && lista.length > 0 && (
              <div className="banner-error-carga">
                <span>No se pudo actualizar — mostrando la última información disponible.</span>
                <button type="button" onClick={recargar}>Reintentar</button>
              </div>
            )}

            <div className="left-lista">
              {cargando && lista.length === 0 && <Spinner overlay={false} fill label="Cargando FUS comisionados…" />}
              {!cargando && errorCarga && lista.length === 0 && (
                <div className="empty-state empty-state-error">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="empty-state-title">No se pudo cargar</p>
                  <p className="empty-state-sub">Ocurrió un error al obtener tus FUS comisionados.</p>
                  <button type="button" className="btn-reintentar" onClick={recargar}>Reintentar</button>
                </div>
              )}
              {!cargando && !errorCarga && lista.length === 0 && (
                <div className="empty-state">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                  <p className="empty-state-title">Sin asignaciones</p>
                  <p className="empty-state-sub">{busqueda ? 'Ningún FUS coincide con tu búsqueda.' : 'No tienes FUS comisionados por atender.'}</p>
                </div>
              )}
              {lista.map(f => (
                <FUSCard key={f.id} f={f} activo={seleccionado?.id === f.id}
                  onClick={() => { setSeleccionado(f); if (window.innerWidth <= 768) setPanelAbierto(false) }}
                  onVerHistorial={setModalTimelineFolio} />
              ))}
              {lista.length < totalItems && (
                <button className="btn-cargar-mas" onClick={cargarMas} disabled={cargando || cargandoMas}>
                  {(cargando || cargandoMas) && <span className="btn-spinner" />}
                  {(cargando || cargandoMas) ? 'Cargando…' : `Cargar más (${lista.length} de ${totalItems})`}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="st-right">
          {seleccionado
            ? <DetalleFUSComisionado
                fus={seleccionado}
                onBack={() => setSeleccionado(null)}
              />
            : (
              <div className="st-hint-select">
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <p>Selecciona un FUS del panel izquierdo para ver el detalle completo</p>
              </div>
            )
          }
        </div>
      </div>

      {modalTimelineFolio && (
        <ModalTimeline folio={modalTimelineFolio} onClose={() => setModalTimelineFolio(null)} />
      )}
    </AppLayout>
  )
}
