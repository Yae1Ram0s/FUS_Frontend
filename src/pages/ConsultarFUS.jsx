import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import StatCard from '../components/StatCard'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import { useEstatus } from '../hooks/useEstatus'
import { useResizablePanel } from '../hooks/useResizablePanel'
import './ConsultarFUS.css'

function descargar(url, nombre) {
  const token = sessionStorage.getItem('access_token')
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = nombre
      a.click()
      URL.revokeObjectURL(a.href)
    })
    .catch(() => alert('No se pudo descargar el archivo.'))
}

/* ── Panel de estadísticas ROL1 ── */
function StatsPanel({ stats, cargando, onStatClick }) {
  const { user } = useAuth()
  const nombre = user?.nombre || user?.email || 'Usuario'
  const total  = (stats.pendientes || 0) + (stats.turnadas || 0) + (stats.atendidas || 0) + (stats.concluidas || 0)
  const esMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  return (
    <div className="std-panel">

      {/* Bienvenida */}
      <div className="std-greeting">
        <div className="std-avatar">{nombre.charAt(0).toUpperCase()}</div>
        <div className="std-greeting-text">
          <span className="std-greeting-hello">Bienvenido(a)</span>
          <span className="std-greeting-name">{nombre}</span>
          <span className="std-greeting-role">{user?.unidadAdministrativa || 'Sin unidad asignada'} · ANAM</span>
        </div>
        <div className="std-greeting-badge">
          <span className="std-badge-num">{total}</span>
          <span className="std-badge-lbl">FUS registradas</span>
        </div>
      </div>

      {/* Divisor */}
      <div className="std-divider">
        <span className="std-divider-line" />
        <span className="std-divider-text">Resumen de solicitudes</span>
        <span className="std-divider-line" />
      </div>

      {/* Métricas 2×2 — clicables, filtran la lista por categoría */}
      {cargando
        ? <div className="std-stats-loading"><Spinner overlay={false} label="Cargando resumen…" /></div>
        : <div className="std-grid std-grid-2x2">
        <StatCard
          delay="0ms" accent="#235b4e"
          value={stats.pendientes} label="Registradas" sublabel="En espera de trámite"
          onClick={() => onStatClick?.('Registrado')}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          }
        />
        <StatCard
          delay="80ms" accent="#c9a227"
          value={stats.turnadas} label="Turnadas" sublabel="Enviadas al área responsable"
          live
          onClick={() => onStatClick?.('Turnado')}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          }
        />
        <StatCard
          delay="160ms" accent="#1a7a52"
          value={stats.atendidas} label="En atención" sublabel="Con respuesta en proceso"
          onClick={() => onStatClick?.('Atendido')}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          }
        />
        <StatCard
          delay="240ms" accent="#1a7a52"
          value={stats.concluidas} label="Concluidas" sublabel="Atendidas y cerradas"
          onClick={() => onStatClick?.('Concluido')}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          }
        />
      </div>}

      {/* Pista */}
      <div className="std-hint">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {esMobile
          ? 'Toca una categoría para ver las solicitudes'
          : 'Haz clic en una categoría para filtrar las solicitudes, o selecciona una del panel izquierdo para ver el detalle completo'
        }
      </div>

    </div>
  )
}

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

const MEDIA_BASE = ''

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
        {evidencias.map(ev => {
          const url = `${MEDIA_BASE}/media/${ev.rutaArchivo}`
          const imagen = esImagen(ev.tipoMime)
          return (
            <a
              key={ev.id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="ev-item"
              title={ev.nombreArchivo}
            >
              {imagen ? (
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
        })}
      </div>
    </div>
  )
}

const ESTATUS_TURNADO_LABEL = {
  Recibido:       { label: 'Recibido',       color: '#b45309' },
  En_seguimiento: { label: 'En seguimiento', color: '#9F2241' },
  Concluido:      { label: 'Concluido',      color: '#15803d' },
}

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

  if (cargando) return <Spinner overlay={false} />
  if (!turnados.length) return <p className="act-msg">Sin actividad registrada aún.</p>

  return (
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

            {/* Seguimientos */}
            {t.seguimientos?.length > 0 && (
              <div className="act-section">
                <p className="act-section-title act-title-respuesta">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Respuestas y seguimiento
                </p>
                <div className="act-tl">
                  {t.seguimientos.map((s, i) => (
                    <div key={s.id} className="act-tl-item">
                      <div className="act-tl-track">
                        <div className="act-tl-dot" />
                        {i < t.seguimientos.length - 1 && <div className="act-tl-connector" />}
                      </div>
                      <div className="act-tl-content">
                        <span className="act-tl-fecha">{fmtFecha(s.fechaActividad)}</span>
                        <p className="act-tl-desc">{s.descripcionActividad}</p>
                        {s.accionTexto && (
                          <p className="act-tl-accion">→ {s.accionTexto}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Acciones */}
            {t.acciones?.length > 0 && (
              <div className="act-section">
                <p className="act-section-title act-title-accion">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="9 11 12 14 22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                  Acciones por emprender
                </p>
                <ol className="act-acciones">
                  {t.acciones.map(a => (
                    <li key={a.id} className={`act-accion${a.completada ? ' act-accion-ok' : ''}`}>
                      <span className="act-accion-check">{a.completada ? '✓' : '○'}</span>
                      {a.descripcion}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {t.seguimientos?.length === 0 && t.acciones?.length === 0 && (
              <p className="act-sin-resp">Pendiente de respuesta del titular.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Modal: elegir con/sin imágenes al descargar el PDF ── */
function ModalDescargarPDF({ onCancelar, onConfirmar }) {
  const [conImagenes, setConImagenes] = useState(true)
  const [cargando, setCargando] = useState(false)

  const confirmar = () => {
    setCargando(true)
    Promise.resolve(onConfirmar(conImagenes)).finally(() => setCargando(false))
  }

  return createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card modal-card-pdf">
        <div className="modal-header">
          <h3 className="modal-title">Descargar solicitud en PDF</h3>
          <button className="modal-close" onClick={onCancelar} aria-label="Cerrar" disabled={cargando}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-pdf-sub">Elige si deseas incluir las imágenes de evidencia adjuntas.</p>

          <label className={`modal-pdf-opcion${conImagenes ? ' modal-pdf-opcion-activa' : ''}`}>
            <input type="radio" name="pdf-imagenes" checked={conImagenes} onChange={() => setConImagenes(true)} disabled={cargando} />
            <span>Descargar con imágenes de evidencia</span>
          </label>
          <label className={`modal-pdf-opcion${!conImagenes ? ' modal-pdf-opcion-activa' : ''}`}>
            <input type="radio" name="pdf-imagenes" checked={!conImagenes} onChange={() => setConImagenes(false)} disabled={cargando} />
            <span>Descargar sin imágenes</span>
          </label>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancelar} disabled={cargando}>Cancelar</button>
          <button className="btn-turnar" onClick={confirmar} disabled={cargando}>
            {cargando ? <span className="btn-spinner" /> : null}
            {cargando ? 'Generando…' : 'Descargar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ── Panel de detalle FUS ── */
function DetalleFUS({ fus, onTurnar, onBack }) {
  const navigate = useNavigate()
  const [mostrarModalPdf, setMostrarModalPdf] = useState(false)
  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  const puedesTurnar   = fus.estatusParticular === 'Registrado' || fus.estatusParticular === 'Turnado'
  const puedesEditar   = fus.estatusParticular === 'Registrado'
  const tieneActividad = fus.estatusParticular !== 'Registrado'
  const tieneExterno   = fus.nombreExterno || fus.telefonoExterno || fus.correoExterno
  const nombreSolicitante = fus.idSolicitanteInterno?.nombre

  const descargarPdf = (conImagenes) => {
    const folioUrl = fus.folio.split('/').map(encodeURIComponent).join('/')
    const query = conImagenes ? '?imagenes=1' : ''
    return descargar(`/api/fus/${folioUrl}/pdf/${query}`, `FUS_${fus.folio.replace(/\//g, '_')}.pdf`)
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
            <Badge estatus={fus.estatusParticular} />
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
      </div>

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

      {/* ── Sección: Se turnó ── */}
      {tieneActividad && (
        <div className="det-section">
          <span className="det-section-legend det-section-legend-activity">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Se turnó
          </span>
          <TimelineActividad fusId={fus.id} />
        </div>
      )}

      {puedesTurnar && (
        <div className="detalle-footer">
          <button className="btn-turnar" onClick={() => onTurnar(fus)}>
            Turnar solicitud
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Tarjeta en la lista ── */
function FusCard({ fus, activo, onClick, highlight }) {
  const fmt = d => d
    ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'
  return (
    <div className={`fus-card${activo ? ' fus-card-activo' : ''}${highlight ? ' fus-card-highlight' : ''}`} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="fus-card-top">
        <strong className="fus-folio">{fus.folio}</strong>
        <Badge estatus={fus.estatusParticular} />
      </div>
      <p className="fus-meta"><b>Fecha:</b> {fmt(fus.fechaHora)}</p>
      <p className="fus-meta"><b>Medio:</b> {fus.idMedioRecepcion?.nombreMedio || '—'}</p>
      {fus.descripcion && <p className="fus-desc">{fus.descripcion.slice(0, 90)}…</p>}
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
  const [cargando,     setCargando]     = useState(true)
  const [stats,        setStats]        = useState({ concluidas: 0, turnadas: 0, atendidas: 0, pendientes: 0 })
  const [statsCargando, setStatsCargando] = useState(true)
  const [highlightId,  setHighlightId]  = useState(null)
  const [pagina,       setPagina]       = useState(1)
  const [totalItems,   setTotalItems]   = useState(0)
  const PAGE_SIZE = 30
  const reordenadoRef = useRef(false)

  const cargarStats = () => {
    api.get('/fus/', { params: { page: 1, page_size: 500 } }).then(r => {
      const todos = r.data.results || []
      setStats({
        pendientes: todos.filter(f => f.estatusParticular === 'Registrado').length,
        turnadas:   todos.filter(f => f.estatusParticular === 'Turnado').length,
        atendidas:  todos.filter(f => f.estatusParticular === 'Atendido').length,
        concluidas: todos.filter(f => f.estatusParticular === 'Concluido').length,
      })
    }).catch(() => {}).finally(() => setStatsCargando(false))
  }

  const cargar = (pag = 1, append = false) => {
    if (reordenadoRef.current) { reordenadoRef.current = false; return }
    setCargando(true)
    const params = { page: pag, page_size: PAGE_SIZE }
    if (!folioParam && filtro)   params.estatusParticular = filtro
    if (!folioParam && busqueda) params.search = busqueda
    api.get('/fus/', { params })
      .then(r => {
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
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  const cargarMas = () => cargar(pagina + 1, true)

  useEffect(() => {
    cargarStats()
    const interval = setInterval(cargarStats, 30_000)
    return () => clearInterval(interval)
  }, [])
  useEffect(() => { setPagina(1); cargar(1) }, [filtro, busqueda, folioParam])

  const handleTurnarDone = () => {
    setTurnarFUS(null)
    setSeleccionado(null)
    cargar()
    cargarStats()
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
                placeholder="Buscar por folio, descripción…"
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
              {estatusROL1.map(e => (
                <button
                  key={e.clave}
                  className={`filtro-chip filtro-chip-${e.clave.toLowerCase()}${filtro === e.clave ? ' filtro-chip-active' : ''}`}
                  onClick={() => toggleFiltro(e.clave)}
                >
                  {e.nombre}
                </button>
              ))}
            </div>

            <div className="left-lista">
              {cargando && <Spinner overlay={false} label="Cargando solicitudes…" />}
              {!cargando && lista.length === 0 && (
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
                fus={seleccionado}
                onTurnar={f => setTurnarFUS(f)}
                onBack={() => setSeleccionado(null)}
              />
            : panelAbierto
              ? (
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
              : <StatsPanel stats={stats} cargando={statsCargando} onStatClick={status => { setFiltro(status); setPanelAbierto(true) }} />
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
    </AppLayout>
  )
}
