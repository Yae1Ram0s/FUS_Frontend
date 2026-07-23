import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import ModalTimeline from '../components/ModalTimeline'
import ModalDescargarPDF, { descargar } from '../components/ModalDescargarPDF'
import ComisionarModal from '../components/Comisionado/ComisionarModal'
import AccionesValidacion from '../components/Comisionado/AccionesValidacion'
import SeguimientoComisionadoFeed from '../components/Comisionado/SeguimientoComisionadoFeed'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import { useNotificaciones } from '../context/NotificacionesContext'
import { useEstatus } from '../hooks/useEstatus'
import { useResizablePanel } from '../hooks/useResizablePanel'
import { useEvidenciaUrl } from '../hooks/useEvidenciaUrl'
import { useToast } from '../context/ToastContext'
import { puedeGestionarComisionados, puedeComisionar } from '../utils/permisos'
import './ConsultarFUS.css'

const initialesComisionado = (nombre, email) => (nombre || email || '?')
  .split(' ')
  .slice(0, 2)
  .map(w => w[0])
  .join('')
  .toUpperCase()

/* ── Modal Turnar ── */
function ModalTurnar({ fus, onClose, onDone }) {
  const [usuarios, setUsuarios] = useState([])
  const [medios,   setMedios]   = useState([])
  const [selUser,  setSelUser]  = useState('')
  const [selMedio, setSelMedio] = useState('')
  const [texto,    setTexto]    = useState('')
  const [lista,    setLista]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    api.get('/auth/usuarios-rol2/').then(r => setUsuarios(r.data)).catch(() => {})
    api.get('/catalogos/medios/?paraTurnado=1').then(r => setMedios(r.data)).catch(() => {})
  }, [])

  const agregar = () => {
    if (!selUser || !selMedio) return
    const u = usuarios.find(u => String(u.id) === String(selUser))
    const m = medios.find(m => String(m.id) === String(selMedio))
    if (!u || !m) return
    const yaExiste = lista.some(x => x.userId === u.id && x.medioId === m.id)
    if (yaExiste) return
    setLista(l => [...l, {
      userId: u.id,
      nombre: u.nombre,
      medioId: m.id,
      medioNombre: m.nombreMedio,
    }])
    setSelUser('')
  }

  const quitar = idx => setLista(l => l.filter((_, i) => i !== idx))

  const handleTurnar = async () => {
    if (!lista.length || !texto.trim()) {
      setError('Agrega al menos un destinatario y escribe el texto de la solicitud.')
      return
    }
    setError(''); setLoading(true)
    try {
      await api.post(`/fus/${fus.id}/turnar/`, {
        destinatarios: lista.map(l => ({ idDestinatario: l.userId, idMedio: l.medioId })),
        solicitudTexto: texto,
      })
      onDone()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo turnar. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h3 className="modal-title">Turnar solicitud</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-fila">
            <label htmlFor="modal-user">Titular / Enlace estratégico</label>
            <div className="modal-row-inline">
              <select id="modal-user" value={selUser} onChange={e => setSelUser(e.target.value)}>
                <option value="">Selecciona un destinatario</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
              <button type="button" className="btn-add-dest" onClick={agregar} title="Agregar destinatario">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="modal-fila">
            <label htmlFor="modal-medio">Medio de envío</label>
            <div className="modal-row-inline">
              <select id="modal-medio" value={selMedio} onChange={e => setSelMedio(e.target.value)}>
                <option value="">Selecciona un medio</option>
                {medios.map(m => <option key={m.id} value={m.id}>{m.nombreMedio}</option>)}
              </select>
            </div>
          </div>

          {lista.length > 0 && (
            <div className="dest-table-wrap">
              <table className="dest-table">
                <thead>
                  <tr>
                    <th>Destinatario</th>
                    <th>Medio</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((d, i) => (
                    <tr key={i}>
                      <td>{d.nombre}</td>
                      <td>{d.medioNombre}</td>
                      <td>
                        <button className="btn-del" onClick={() => quitar(i)} title="Quitar">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="modal-fila">
            <label htmlFor="modal-texto">Texto de la solicitud</label>
            <textarea
              id="modal-texto"
              rows={5}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Describe el asunto o instrucciones para el destinatario..."
            />
          </div>

          {error && <p className="modal-error" role="alert">{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn-turnar" onClick={handleTurnar} disabled={loading}>
            {loading && <span className="btn-spinner" />}
            {loading ? 'Turnando…' : 'Turnar solicitud'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function esImagen(mime) {
  return mime && mime.startsWith('image/')
}

/* ── Fila de detalle ── */
function Row({ label, value, tall }) {
  return (
    <div className={`det-row${tall ? ' det-row-tall' : ''}`}>
      <span className="det-label">{label}</span>
      <span className="det-value">{value || '—'}</span>
    </div>
  )
}

// Relabel puntual del chip de filtro para ROL1 — el catálogo comparte
// "Pendiente de validación" con ROL2, pero en su propia bandeja se lee mejor
// como acción pendiente de él: "Por validar".
const FILTRO_LABEL_ROL1 = { Pendiente_validacion: 'Por validar' }

/* ── Prioridad — pills de solo lectura, resalta la seleccionada ── */
const PRIORIDAD_NIVELES = [
  { valor: 'Alta',  color: '#b91c1c' },
  { valor: 'Media', color: '#92400e' },
  { valor: 'Baja',  color: '#15803d' },
]

function PrioridadPills({ valor, criterios }) {
  const listaCriterios = criterios ? criterios.split('|').map(c => c.trim()).filter(Boolean) : []
  return (
    <div>
      <div className="det-prioridad-pills">
        {PRIORIDAD_NIVELES.map(p => (
          <span
            key={p.valor}
            className={`det-prioridad-pill${valor === p.valor ? ' det-prioridad-pill-selected' : ''}`}
            style={{ '--c': p.color }}
          >
            {p.valor}
          </span>
        ))}
      </div>
      {listaCriterios.length > 0 && (
        <ul className="det-criterios-lista">
          {listaCriterios.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      )}
    </div>
  )
}

/* ── Ítem de evidencia individual (descarga autenticada) ── */
function EvidenciaItem({ ev }) {
  const url = useEvidenciaUrl(ev.id)
  const imagen = esImagen(ev.tipoMime)
  return (
    <a
      href={url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`ev-item${url ? '' : ' ev-item-cargando'}`}
      title={ev.nombreArchivo}
      onClick={e => { if (!url) e.preventDefault() }}
    >
      {imagen && url ? (
        <img src={url} alt={ev.nombreArchivo} className="ev-thumb" />
      ) : (
        <span className="ev-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </span>
      )}
      <span className="ev-nombre">{ev.nombreArchivo}</span>
      {ev.comentarios && <span className="ev-comentario">{ev.comentarios}</span>}
    </a>
  )
}

/* ── Lista de evidencias ── */
function EvidenciaList({ evidencias }) {
  if (!evidencias?.length) return (
    <div className="det-row">
      <span className="det-label">Evidencia</span>
      <span className="det-value">—</span>
    </div>
  )

  return (
    <div className="det-row det-row-evidencia">
      <span className="det-label">Evidencia</span>
      <div className="ev-lista">
        {evidencias.map(ev => <EvidenciaItem key={ev.id} ev={ev} />)}
      </div>
    </div>
  )
}

const ESTATUS_TURNADO_LABEL = {
  Recibido:       { label: 'Recibido',       color: '#b45309' },
  En_seguimiento: { label: 'En seguimiento', color: '#9F2241' },
  Concluido:      { label: 'Concluido',      color: '#15803d' },
}

// Estructura uniforme para toda entrada de "Respuestas y seguimiento",
// venga del flujo directo de Rol 2 (modelo Seguimiento, sin `tipo` propio —
// se le asigna 'Respuesta' por defecto) o del flujo de Comisionado (trae
// `tipo`, ver DEFAULT_TIPO_INFO más abajo para el caso sin match).
const TIPO_SEGUIMIENTO_INFO = {
  accion_por_emprender: { label: 'Acción',  clase: 'fc-tag-azul' },
  avance:               { label: 'Respuesta', clase: 'fc-tag-verde' },
  finalizacion:         { label: 'Respuesta', clase: 'fc-tag-verde' },
  rechazo:              { label: 'Rechazo',   clase: 'fc-tag-rojo' },
}
const DEFAULT_TIPO_INFO = { label: 'Respuesta', clase: 'fc-tag-verde' }

/* ── Timeline de actividad ── */
function TimelineActividad({ fusId }) {
  const [turnados, setTurnados] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    api.get(`/fus/${fusId}/actividad/`)
      .then(r => setTurnados(r.data))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [fusId])

  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  const fmtFecha = d => d
    ? new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'
  const fmtHora = d => d
    ? new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : ''

  const legendTurnado = (
    <span className="det-section-legend det-section-legend-activity">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
      Se turnó
    </span>
  )

  if (cargando) return (
    <div className="det-section">
      {legendTurnado}
      <Spinner overlay={false} />
    </div>
  )
  if (!turnados.length) return (
    <div className="det-section">
      {legendTurnado}
      <p className="act-msg">Sin actividad registrada aún.</p>
    </div>
  )

  // Todas las respuestas de todos los turnados (normalmente hay uno solo) en
  // una sola línea de tiempo, en su propia sección — mismo tratamiento visual
  // que "Respuestas y seguimiento" en la vista de Rol 2 (.seccion/.sec-header).
  // Las que no traen `autorNombre` (flujo directo de Rol 2, modelo
  // Seguimiento) se atribuyen al destinatario del turnado — mismo Titular
  // que ya se muestra como "Nombre" en la tarjeta de arriba.
  const todasRespuestas = turnados.flatMap(t =>
    (t.seguimientos || []).map(s => ({
      ...s,
      autorNombre: 'autorNombre' in s ? s.autorNombre : (t.idDestinatario?.nombre ?? null),
    }))
  )

  return (
    <>
      <div className="det-section">
        {legendTurnado}
        <div className="act-timeline">
          {turnados.map((t, ti) => {
            const meta = ESTATUS_TURNADO_LABEL[t.estatusTitular] || { label: t.estatusTitular, color: '#6b7280' }
            return (
              <div key={t.id} className="act-turnado">
                <div className="act-turnado-header">
                  <div className="act-turnado-dot" />
                  <span className="act-estatus-pill" style={{ '--c': meta.color }}>{meta.label}</span>
                </div>
                <div className="det-grid-2 act-turnado-datos">
                  <Row label="Nombre" value={t.idDestinatario?.nombre} />
                  <Row label="Área" value={t.idDestinatario?.area} />
                  <Row label="Medio de envío" value={t.idMedio?.nombreMedio} />
                  <Row label="Fecha y hora" value={fmt(t.fechaHoraTurnado)} />
                </div>
                {t.solicitudTexto && (
                  <Row label="Texto de la solicitud" value={t.solicitudTexto} tall />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="seccion act-seccion-respuestas">
        <div className="sec-header sec-resp">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Respuestas y seguimiento
        </div>
        <div className="sec-body">
          {todasRespuestas.length > 0 ? (
            <div className="act-tl">
              {todasRespuestas.map((s, i) => {
                const info = TIPO_SEGUIMIENTO_INFO[s.tipo] || DEFAULT_TIPO_INFO
                return (
                  <div key={s.id} className="act-tl-item">
                    <div className="act-tl-track">
                      <div className="act-tl-dot" />
                      {i < todasRespuestas.length - 1 && <div className="act-tl-connector" />}
                    </div>
                    <div className="act-tl-content">
                      <div className="seg-tl-meta">
                        <span className={`fc-tag ${info.clase}`}>{info.label}</span>
                        <span className="seg-tl-fecha">
                          {s.autorNombre ? `${s.autorNombre} · ` : ''}
                          {fmtFecha(s.fechaActividad)}
                          {s.fechaRegistro && <span className="act-tl-hora"> · {fmtHora(s.fechaRegistro)}</span>}
                        </span>
                      </div>
                      <p className="act-tl-desc">{s.descripcionActividad}</p>
                      {s.accionTexto && (
                        <p className="act-tl-accion">→ {s.accionTexto}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="seg-empty">Pendiente de respuesta del titular.</p>
          )}
        </div>
      </div>
    </>
  )
}

/* ── Panel de detalle FUS ── */
function DetalleFUS({ fus: fusInicial, onTurnar, onBack, onVerHistorial }) {
  const navigate = useNavigate()
  const { user, accessToken } = useAuth()
  const toast = useToast()
  const [fusData, setFusData] = useState(fusInicial)
  const fus = fusData
  const [mostrarModalPdf, setMostrarModalPdf] = useState(false)
  const [modalComisionar, setModalComisionar] = useState(false)
  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  const puedesTurnar   = fus.estatusParticular === 'Registrado' || fus.estatusParticular === 'Turnado'
  const puedesEditar   = fus.estatusParticular === 'Registrado'
  const tieneActividad = fus.estatusParticular !== 'Registrado'
  const tieneExterno   = fus.nombreExterno || fus.telefonoExterno || fus.correoExterno
  const nombreSolicitante = fus.idSolicitanteInterno?.nombre

  // ROL1 comisiona directamente desde "Registrado" (antes de turnar); ROL2 lo
  // hace desde "Turnado" en su propia vista (SolicitudesTurnadas), no aquí.
  const puedesComisionar = puedeComisionar(user, fus)

  const descargarPdf = (conImagenes) => {
    const folioUrl = fus.folio.split('/').map(encodeURIComponent).join('/')
    const query = conImagenes ? '?imagenes=1' : ''
    return descargar(`/api/fus/${folioUrl}/pdf/${query}`, `FUS_${fus.folio.replace(/\//g, '_')}.pdf`, accessToken)
      .finally(() => setMostrarModalPdf(false))
  }

  return (
    <div className="detalle-panel">

      {/* ── Cabecera ── */}
      <div className="detalle-header">
        <button className="btn-volver-mobile" onClick={onBack} aria-label="Volver">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Volver
        </button>
        <div className="detalle-header-main">
          <div>
            <h2 className="detalle-title">Detalle de la solicitud</h2>
            <span className="detalle-folio">{fus.folio}</span>
          </div>
          <div className="detalle-header-acciones">
            <button
              className="btn-descargar-fus"
              onClick={() => setMostrarModalPdf(true)}
              title="Descargar PDF"
              aria-label="Descargar PDF"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            {puedesEditar && (
              <button
                className="btn-editar-fus"
                onClick={() => navigate(`/rol1/registrar-fus?editar=${fus.id}`)}
                title="Editar solicitud"
                aria-label="Editar solicitud"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            )}
            {puedesComisionar && (
              <button type="button" className="btn-comisionar" onClick={() => setModalComisionar(true)}>
                Comisionar
              </button>
            )}
          </div>
        </div>
      </div>

      {mostrarModalPdf && (
        <ModalDescargarPDF
          onCancelar={() => setMostrarModalPdf(false)}
          onConfirmar={descargarPdf}
        />
      )}

      {/* ── Sección: Datos generales ── */}
      <div className="det-section">
        <span className="det-section-legend">Datos generales</span>
        <div className="det-grid-2">
          <Row label="Fecha y hora"        value={fmt(fus.fechaHora)} />
          <Row label="Medio de recepción"  value={fus.idMedioRecepcion?.nombreMedio} />
          <Row label="Solicitante interno" value={nombreSolicitante} />
        </div>
        {/* Mismo criterio que el feed de abajo: si se turnó, el comisionado
            es asunto del Titular — no se le muestra a Rol 1 quién es. */}
        {fus.idComisionado && !fus.tieneTurnado && (
          <div className="dt-comisionado-chip">
            <span className="dt-comisionado-avatar">{initialesComisionado(fus.idComisionado.nombre, fus.idComisionado.email)}</span>
            <div className="dt-comisionado-info">
              <span className="dt-comisionado-nombre">{fus.idComisionado.nombre || fus.idComisionado.email}</span>
              <span className="dt-comisionado-direccion">{fus.direccionComisionado || 'Sin dirección asignada'}</span>
            </div>
          </div>
        )}
      </div>

      {fus.fechaLimite && (
        <div className="det-section">
          <span className="det-section-legend det-section-legend-activity">Límite de respuesta</span>
          <div className="det-grid-2">
            <Row label="Fecha y hora" value={fmt(fus.fechaLimite)} />
          </div>
        </div>
      )}

      {/* ── Sección: Descripción de la solicitud ── */}
      <div className="det-section">
        <span className="det-section-legend">Descripción de la solicitud</span>
        <Row label="Descripción" value={fus.descripcion} tall />
        {fus.contexto && <Row label="Datos o antecedentes de contexto de la solicitud" value={fus.contexto} tall />}
      </div>

      {/* ── Sección: Datos de contacto de solicitante externo ── */}
      {tieneExterno && (
        <div className="det-section">
          <span className="det-section-legend">Datos de contacto de solicitante externo</span>
          <div className="det-grid-3">
            {fus.nombreExterno   && <Row label="Nombre"            value={fus.nombreExterno} />}
            {fus.telefonoExterno && <Row label="Teléfono/Celular"  value={fus.telefonoExterno} />}
            {fus.correoExterno   && <Row label="Correo"            value={fus.correoExterno} />}
          </div>
        </div>
      )}

      {/* ── Sección: Evidencia ── */}
      <div className="det-section">
        <span className="det-section-legend">Evidencia</span>
        <EvidenciaList evidencias={fus.evidencias} />
      </div>

      {/* ── Sección: Prioridad ── */}
      <div className="det-section">
        <span className="det-section-legend">Prioridad</span>
        <PrioridadPills valor={fus.prioridad} criterios={fus.criterios} />
      </div>

      {/* ── Sección: Se turnó + Respuestas y seguimiento (esta última en su
          propia .seccion, mismo tratamiento visual que la vista de Rol 2) ── */}
      {tieneActividad && <TimelineActividad fusId={fus.id} />}

      <div className="detalle-footer">
        {puedesTurnar && (
          <button className="btn-turnar" onClick={() => onTurnar(fus)}>
            Turnar solicitud
          </button>
        )}
      </div>

      {/* Solo si el propio Particular comisionó directo (sin pasar por
          Turnado/Rol 2) se le muestra el feed real del comisionado. Si se
          turnó, esa delegación es asunto del Titular — aquí solo se ve la
          actividad del turnado (sección "Se turnó" arriba), como si el
          Titular lo hubiera atendido él mismo. */}
      {fus.idComisionado && !fus.tieneTurnado && <SeguimientoComisionadoFeed fusId={fus.id} />}

      <AccionesValidacion
        user={user}
        fus={fus}
        setFusData={setFusData}
        tieneFacultad={puedeGestionarComisionados(user)}
      />

      {modalComisionar && (
        <ComisionarModal
          fusId={fus.id}
          onClose={() => setModalComisionar(false)}
          onConfirmado={(data) => {
            setFusData(data)
            setModalComisionar(false)
            toast.success('Comisionado asignado correctamente.')
          }}
        />
      )}
    </div>
  )
}

/* ── Tarjeta en la lista ── */
function FusCard({ fus, activo, onClick, highlight, onVerHistorial }) {
  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  return (
    <div className={`fus-card${activo ? ' fus-card-activo' : ''}${highlight ? ' fus-card-highlight' : ''}${fus.slaVencido ? ' fus-card-vencido' : ''}${!fus.slaVencido && fus.slaPorVencer ? ' fus-card-por-vencer' : ''}`} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="fus-card-top">
        <strong className="fus-folio">{fus.folio}</strong>
        <span className="fus-card-badges">
          <Badge estatus={fus.estatusParticular} />
          {fus.estadoTemporalidad && <Badge estatus={fus.estadoTemporalidad} />}
        </span>
      </div>
      <p className="fus-meta">
        <span className="fus-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          {fmt(fus.fechaHora)}
        </span>
        <span className="fus-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="m22 7-10 6L2 7"/>
          </svg>
          {fus.idMedioRecepcion?.nombreMedio || '—'}
        </span>
      </p>
      {fus.descripcion && <p className="fus-desc">{fus.descripcion}</p>}
      <button
        className="fus-card-historial-btn"
        title="Ver historial"
        onClick={e => { e.stopPropagation(); onVerHistorial() }}
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
export default function ConsultarFUS() {
  const [searchParams, setSearchParams] = useSearchParams()
  const folioParam = searchParams.get('folio')

  const { estatus: estatusROL1 } = useEstatus('PARTICULAR')

  const [lista,        setLista]        = useState([])
  const [busqueda,     setBusqueda]     = useState('')
  const [filtro,       setFiltro]       = useState(() => searchParams.get('filtro') || '')
  const [seleccionado, setSeleccionado] = useState(null)
  const [turnarFUS,    setTurnarFUS]    = useState(null)
  const [modalTimelineFolio, setModalTimelineFolio] = useState(null)
  const [cargando,     setCargando]     = useState(true)
  const [errorCarga,   setErrorCarga]   = useState(false)
  const [highlightId,  setHighlightId]  = useState(null)
  const [pagina,       setPagina]       = useState(1)
  const [totalItems,   setTotalItems]   = useState(0)
  const PAGE_SIZE = 30
  const reordenadoRef = useRef(false)
  const autoRetriedRef = useRef(false)
  const retryTimeoutRef = useRef(null)

  const cargar = (pag = 1, append = false) => {
    if (reordenadoRef.current) { reordenadoRef.current = false; return }
    setCargando(true)
    const params = { page: pag, page_size: PAGE_SIZE }
    if (!folioParam && filtro)   params.estatusParticular = filtro
    if (!folioParam && busqueda) params.search = busqueda
    api.get('/fus/', { params })
      .then(r => {
        setErrorCarga(false)
        autoRetriedRef.current = false
        if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null }
        const items = r.data.results || []
        setTotalItems(r.data.total || 0)
        if (folioParam) {
          const match = items.find(f => f.folio === folioParam)
          if (match) {
            setLista([match, ...items.filter(f => f.id !== match.id)])
            setFiltro('')
            setBusqueda('')
            setSeleccionado(match)
            setHighlightId(match.id)
            setPanelAbierto(true)
            reordenadoRef.current = true
            setSearchParams({}, { replace: true })
            return
          }
        }
        setLista(prev => append ? [...prev, ...items] : items)
        setPagina(pag)
        // Si el FUS abierto en el detalle sigue en la respuesta, refresca su
        // estatus in place (sin perder el panel abierto ni el scroll).
        setSeleccionado(prev => {
          if (!prev) return prev
          const actualizado = items.find(f => f.id === prev.id)
          return actualizado || prev
        })
      })
      .catch(() => {
        setErrorCarga(true)
        if (!autoRetriedRef.current) {
          autoRetriedRef.current = true
          retryTimeoutRef.current = setTimeout(() => cargar(pag, append), 5000)
        }
      })
      .finally(() => setCargando(false))
  }

  useEffect(() => () => { if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current) }, [])

  const cargarMas = () => cargar(pagina + 1, true)

  /* En vivo: si llega por WebSocket un aviso de SLA por vencer, el FUS
     correspondiente (si ya está cargado en la lista) se sube al inicio y
     queda marcado como "por vencer" — sin esperar a un refresh manual. */
  const notifCtx = useNotificaciones()
  const ultimaNotifId = notifCtx?.notifs?.[0]?.id
  useEffect(() => {
    const notif = notifCtx?.notifs?.[0]
    if (!notif || notif.tipo !== 'SLA_POR_VENCER') return
    setLista(prev => {
      const idx = prev.findIndex(f => f.folio === notif.fusFolio)
      if (idx === -1) return prev
      const item = { ...prev[idx], slaPorVencer: true }
      return [item, ...prev.slice(0, idx), ...prev.slice(idx + 1)]
    })
  }, [ultimaNotifId])

  /* En vivo: cualquier notificación ligada a un FUS (comisionar, atendido,
     concluir, rechazar, etc.) dispara un refresh silencioso — cubre tanto
     un cambio de estatus en algo que ya se ve en la lista/detalle como una
     asignación nueva que todavía no aparecía. SLA_POR_VENCER queda fuera:
     ya tiene su propio parche puntual arriba, sin recargar todo. */
  useEffect(() => {
    const notif = notifCtx?.notifs?.[0]
    if (!notif?.fusFolio || notif.tipo === 'SLA_POR_VENCER') return
    cargar(1)
  }, [ultimaNotifId])

  useEffect(() => { setPagina(1); cargar(1) }, [filtro, busqueda, folioParam])

  const handleTurnarDone = () => {
    setTurnarFUS(null)
    setSeleccionado(null)
    cargar()
  }

  const toggleFiltro = f => setFiltro(prev => prev === f ? '' : f)

  /* ── Panel izquierdo: cerrado por defecto (modo dashboard) ── */
  const [panelAbierto, setPanelAbierto] = useState(() => searchParams.get('modo') === 'lista' || Boolean(searchParams.get('filtro')))

  useEffect(() => {
    if (searchParams.get('filtro')) {
      const next = new URLSearchParams(searchParams)
      next.delete('filtro')
      setSearchParams(next, { replace: true })
    }
  }, [])

  useEffect(() => {
    const handleConsultar = () => { setPanelAbierto(true); setSeleccionado(null) }
    window.addEventListener('scs:consultar', handleConsultar)
    return () => window.removeEventListener('scs:consultar', handleConsultar)
  }, [])

  const { leftWidth, containerRef, startResize } = useResizablePanel('cfus-left-width')

  return (
    <AppLayout>
      <div className={`cfus-inner${seleccionado ? ' has-detail' : ''}${panelAbierto && !seleccionado ? ' lista-mode' : ''}`} ref={containerRef}>

        {/* ── Panel izquierdo ── */}
        <div className={`cfus-left${!panelAbierto ? ' panel-cerrado' : ''}`} style={{ width: panelAbierto ? leftWidth : 44 }}>
          <div className="panel-header">
            {panelAbierto && (
              <div className="panel-header-left">
                <h3 className="panel-title">Solicitudes FUS</h3>
              </div>
            )}
            <button className="panel-toggle" onClick={() => setPanelAbierto(p => !p)} title={panelAbierto ? 'Cerrar panel' : 'Abrir panel'}>
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
                placeholder="Buscar por folio, descripción, contacto, medio…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>

            <div className="left-filtros">
              <button
                className={`filtro-chip${filtro === '' ? ' filtro-chip-active' : ''}`}
                onClick={() => setFiltro('')}
              >
                Todos
              </button>
              {estatusROL1.filter(e => e.clave !== 'Rechazado').map(e => (
                <button
                  key={e.clave}
                  className={`filtro-chip filtro-chip-${e.clave.toLowerCase()}${filtro === e.clave ? ' filtro-chip-active' : ''}`}
                  onClick={() => toggleFiltro(e.clave)}
                >
                  {FILTRO_LABEL_ROL1[e.clave] || e.nombre}
                </button>
              ))}
              <button
                className={`filtro-chip filtro-chip-vencido${filtro === 'Vencido' ? ' filtro-chip-active' : ''}`}
                onClick={() => toggleFiltro('Vencido')}
              >
                Vencido
              </button>
              <button
                className={`filtro-chip filtro-chip-porvencer${filtro === 'PorVencer' ? ' filtro-chip-active' : ''}`}
                onClick={() => toggleFiltro('PorVencer')}
              >
                Por vencer
              </button>
            </div>

            {errorCarga && lista.length > 0 && (
              <div className="banner-error-carga">
                <span>No se pudo actualizar — mostrando la última información disponible.</span>
                <button type="button" onClick={() => cargar(1)}>Reintentar</button>
              </div>
            )}

            <div className="left-lista">
              {cargando && lista.length === 0 && <Spinner overlay={false} label="Cargando solicitudes…" />}
              {!cargando && errorCarga && lista.length === 0 && (
                <div className="empty-state empty-state-error">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="empty-state-title">No se pudo cargar</p>
                  <p className="empty-state-sub">Ocurrió un error al obtener las solicitudes.</p>
                  <button type="button" className="btn-reintentar" onClick={() => cargar(1)}>Reintentar</button>
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
                  <p className="empty-state-sub">{busqueda || filtro ? 'Ningún FUS coincide con tu búsqueda.' : 'Aún no hay FUS registrados.'}</p>
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

        {/* ── Handle de resize ── */}
        {panelAbierto && (
          <div className="resize-handle" onMouseDown={startResize} onTouchStart={startResize}>
            <span className="resize-dots" />
          </div>
        )}

        {/* ── Panel derecho ── */}
        <div className="cfus-right">
          {seleccionado
            ? <DetalleFUS
                key={`${seleccionado.id}_${seleccionado.estatusParticular}`}
                fus={seleccionado}
                onTurnar={f => setTurnarFUS(f)}
                onBack={() => setSeleccionado(null)}
                onVerHistorial={setModalTimelineFolio}
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
