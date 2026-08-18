import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import api, { mensajeErrorConexion } from '../../api/api'
import { useConexionInternet } from '../../hooks/useConexionInternet'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useModalBehavior } from '../../hooks/useModalBehavior'
import { useAnalytics } from '../../analytics'
import { formatearFechaHora } from '../../utils/fechas'
import './ModalTurnar.css'

const MAX_TEXTO = 1000

const normalizar = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const iniciales = usuario => (usuario?.nombre || usuario?.email || 'U')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(parte => parte[0])
  .join('')
  .toUpperCase()

const tiempoRestante = fecha => {
  if (!fecha) return 'Sin fecha límite'
  const diferencia = new Date(fecha).getTime() - Date.now()
  if (Number.isNaN(diferencia)) return 'Sin fecha límite'
  if (diferencia <= 0) return 'Vencido'
  const horas = Math.ceil(diferencia / 3_600_000)
  if (horas < 24) return `${horas} h`
  const dias = Math.ceil(horas / 24)
  return `${dias} día${dias === 1 ? '' : 's'}`
}

const cargarBorrador = id => {
  try {
    const guardado = sessionStorage.getItem(`scs_turnar_borrador_${id}`)
    if (!guardado) return {}
    const borrador = JSON.parse(guardado)
    return {
      texto: borrador.texto || '',
      selMedio: borrador.selMedio || '',
      medioEspecificacion: borrador.medioEspecificacion || '',
      lista: Array.isArray(borrador.lista) ? borrador.lista : [],
    }
  } catch {
    sessionStorage.removeItem(`scs_turnar_borrador_${id}`)
    return {}
  }
}

export default function ModalTurnar({ fus, onClose, onDone }) {
  const borradorInicial = useMemo(() => cargarBorrador(fus.id), [fus.id])
  const [usuarios, setUsuarios] = useState([])
  const [medios, setMedios] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [mostrarResultados, setMostrarResultados] = useState(false)
  const [selMedio, setSelMedio] = useState(borradorInicial.selMedio || '')
  const [medioEspecificacion, setMedioEspecificacion] = useState(borradorInicial.medioEspecificacion || '')
  const [texto, setTexto] = useState(borradorInicial.texto || '')
  const [lista, setLista] = useState(borradorInicial.lista || [])
  const [loading, setLoading] = useState(false)
  const [catalogosCargando, setCatalogosCargando] = useState(true)
  const [error, setError] = useState('')
  const [borradorGuardado, setBorradorGuardado] = useState(false)
  const envioEnCursoRef = useRef(false)
  const { startTask, completeTask, failTask } = useAnalytics({ componente: 'FUS_TURNAR', accion: 'CREATE' })
  const enLinea = useConexionInternet()
  const buscadorRef = useRef(null)
  const busquedaWrapRef = useRef(null)
  const borradorKey = `scs_turnar_borrador_${fus.id}`

  useModalBehavior(onClose, { closeEnabled: !loading })

  // Autoguardado — antes solo se guardaba si el usuario hacía clic en
  // "Guardar borrador"; si la conexión se caía a mitad de escribir (sin haber
  // hecho ese clic), los destinatarios/instrucciones se perdían al cerrar el
  // modal. No depende de red, así que sigue funcionando aunque la API esté
  // caída — mismo criterio que el borrador de Registrar FUS.
  const borradorDeb = useDebouncedValue({ lista, selMedio, medioEspecificacion, texto }, 500)
  useEffect(() => {
    if (!borradorDeb.lista.length && !borradorDeb.selMedio && !borradorDeb.texto.trim()) return
    sessionStorage.setItem(borradorKey, JSON.stringify(borradorDeb))
  }, [borradorDeb, borradorKey])

  // El listado de resultados solo se cerraba al elegir un destinatario — un
  // clic afuera (ej. para ir directo a "Instrucciones") lo dejaba abierto y
  // tapando el resto del formulario.
  useEffect(() => {
    if (!mostrarResultados) return
    const cerrar = e => {
      if (busquedaWrapRef.current?.contains(e.target)) return
      setMostrarResultados(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [mostrarResultados])

  useEffect(() => {
    let activo = true
    Promise.all([
      api.get('/auth/usuarios-rol2/'),
      api.get('/catalogos/medios/?paraTurnado=1'),
    ])
      .then(([usuariosResponse, mediosResponse]) => {
        if (!activo) return
        setUsuarios(usuariosResponse.data)
        setMedios(mediosResponse.data)
        if (mediosResponse.data.length === 1) {
          setSelMedio(actual => actual || String(mediosResponse.data[0].id))
        }
      })
      .catch(() => {
        if (activo) setError('No fue posible cargar los destinatarios o medios de envío.')
      })
      .finally(() => {
        if (activo) setCatalogosCargando(false)
      })
    return () => { activo = false }
  }, [])

  const resultados = useMemo(() => {
    const termino = normalizar(busqueda)
    return usuarios
      .filter(usuario => !lista.some(item => String(item.id) === String(usuario.id)))
      .filter(usuario => !termino || normalizar(`${usuario.nombre} ${usuario.email}`).includes(termino))
      .slice(0, 6)
  }, [busqueda, lista, usuarios])

  const agregar = usuario => {
    if (!usuario || lista.some(item => String(item.id) === String(usuario.id))) return
    setLista(actual => [...actual, usuario])
    setBusqueda('')
    setMostrarResultados(false)
    setError('')
  }

  const quitar = id => setLista(actual => actual.filter(item => String(item.id) !== String(id)))

  const guardarBorrador = () => {
    sessionStorage.setItem(borradorKey, JSON.stringify({ lista, selMedio, medioEspecificacion, texto }))
    setBorradorGuardado(true)
    window.setTimeout(() => setBorradorGuardado(false), 2200)
  }

  const medioSeleccionado = medios.find(medio => String(medio.id) === String(selMedio))
  const esMedioOtro = medioSeleccionado?.nombreMedio === 'Otro'

  const handleTurnar = async () => {
    if (!lista.length) {
      setError('Agrega al menos un destinatario.')
      return
    }
    if (!selMedio) {
      setError('Selecciona un medio de envío.')
      return
    }
    if (esMedioOtro && !medioEspecificacion.trim()) {
      setError('Especifica el medio de envío.')
      return
    }
    if (!texto.trim()) {
      setError('Escribe las instrucciones para el destinatario.')
      return
    }
    if (envioEnCursoRef.current) return
    envioEnCursoRef.current = true
    setError('')
    setLoading(true)
    const taskId = startTask({ metadatos: { total: lista.length } })
    try {
      await api.post(`/fus/${fus.id}/turnar/`, {
        destinatarios: lista.map(item => ({
          idDestinatario: item.id,
          idMedio: Number(selMedio),
        })),
        medioEspecificacion: esMedioOtro ? medioEspecificacion.trim() : '',
        solicitudTexto: texto.trim(),
      })
      completeTask(taskId)
      sessionStorage.removeItem(borradorKey)
      onDone()
    } catch (err) {
      failTask(taskId, { metadatos: { motivo: err.response ? 'error_servidor' : 'sin_conexion' } })
      setError(mensajeErrorConexion(err, 'No se pudo turnar. Intenta nuevamente.'))
    } finally {
      envioEnCursoRef.current = false
      setLoading(false)
    }
  }

  const prioridad = fus.prioridad || 'Sin prioridad'
  const limite = fus.fechaLimite ? formatearFechaHora(fus.fechaLimite) : 'Sin fecha límite'

  return createPortal(
    <div className="com-overlay" role="dialog" aria-modal="true" aria-labelledby="turnar-title" onClick={() => !loading && onClose()}>
      <section className="com-modal turnar-modal" onClick={e => e.stopPropagation()}>
        <header className="com-modal-top">
          <div className="turnar-modal-titulo">
            <h3 id="turnar-title">Turnar solicitud</h3>
            <span>{fus.folio}</span>
          </div>
          <button type="button" className="com-modal-x" onClick={onClose} disabled={loading} aria-label="Cerrar">✕</button>
        </header>

        <div className="turnar-body">
          <section className="turnar-section">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              1. Asignación
            </h3>

            <div className="turnar-search-wrap" ref={busquedaWrapRef}>
              <svg className="turnar-search-icon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                ref={buscadorRef}
                value={busqueda}
                onChange={event => { setBusqueda(event.target.value); setMostrarResultados(true) }}
                onFocus={() => setMostrarResultados(true)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && resultados[0]) {
                    event.preventDefault()
                    agregar(resultados[0])
                  }
                }}
                placeholder={catalogosCargando ? 'Cargando destinatarios…' : 'Buscar por nombre o correo'}
                aria-label="Buscar destinatario"
                disabled={catalogosCargando || loading}
              />
              {mostrarResultados && !catalogosCargando && (
                <div className="turnar-results">
                  {resultados.length ? resultados.map(usuario => (
                    <button key={usuario.id} type="button" onClick={() => agregar(usuario)}>
                      <span className="turnar-mini-avatar">{iniciales(usuario)}</span>
                      <span><strong>{usuario.nombre}</strong><small>{usuario.unidadAdministrativa || 'Sin unidad asignada'}</small></span>
                    </button>
                  )) : <p>Sin destinatarios disponibles.</p>}
                </div>
              )}
            </div>

            <div className="turnar-selected-list">
              {lista.map(usuario => (
                <article className="turnar-recipient" key={usuario.id}>
                  <span className="turnar-avatar">{iniciales(usuario)}</span>
                  <div>
                    <strong>{usuario.nombre}</strong>
                    <span>{usuario.unidadAdministrativa || 'Sin unidad asignada'}</span>
                  </div>
                  <button type="button" onClick={() => quitar(usuario.id)} disabled={loading} aria-label={`Quitar a ${usuario.nombre}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </article>
              ))}
            </div>

            <button type="button" className="turnar-add" onClick={() => buscadorRef.current?.focus()} disabled={loading}>
              <span>＋</span> Agregar destinatario
            </button>

            <div className="turnar-inherited">
              <strong>Datos heredados del FUS</strong>
              <div>
                <span><b>Prioridad:</b> {prioridad}</span>
                <span><b>Fecha límite:</b> {limite}</span>
                <span><b>Tiempo restante:</b> {tiempoRestante(fus.fechaLimite)}</span>
              </div>
            </div>
          </section>

          <section className="turnar-section">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4h16v16H4z"/><path d="m4 6 8 6 8-6"/>
              </svg>
              2. Comunicación
            </h3>

            <label className="turnar-field">
              <span>Medio de envío</span>
              <select
                value={selMedio}
                onChange={event => {
                  setSelMedio(event.target.value)
                  setError('')
                  // Al cambiar de "Otro" a un medio del catálogo, no se
                  // arrastra una especificación que ya no aplica.
                  const nuevo = medios.find(medio => String(medio.id) === event.target.value)
                  if (nuevo?.nombreMedio !== 'Otro') setMedioEspecificacion('')
                }}
                disabled={loading || catalogosCargando}
              >
                <option value="">Selecciona un medio</option>
                {medios.map(medio => <option key={medio.id} value={medio.id}>{medio.nombreMedio}</option>)}
              </select>
              {esMedioOtro && (
                <input
                  type="text"
                  value={medioEspecificacion}
                  onChange={event => { setMedioEspecificacion(event.target.value); setError('') }}
                  placeholder="Especifica el medio de envío…"
                  disabled={loading}
                  autoFocus
                />
              )}
            </label>

            <label className="turnar-field">
              <span>Instrucciones para el destinatario</span>
              <textarea
                rows={4}
                maxLength={MAX_TEXTO}
                value={texto}
                onChange={event => { setTexto(event.target.value); setError('') }}
                placeholder="Describe el asunto o las instrucciones para el destinatario…"
                disabled={loading}
              />
              <small>{texto.length} / {MAX_TEXTO}</small>
            </label>
          </section>

          <button type="button" className="turnar-draft" onClick={guardarBorrador} disabled={loading}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>
            </svg>
            {borradorGuardado ? 'Borrador guardado' : 'Guardar borrador'}
          </button>

          {error && <p className="turnar-error" role="alert">{error}</p>}
          {!enLinea && <p className="turnar-error" role="alert">Sin conexión a internet — no se puede turnar en este momento.</p>}
        </div>

        <footer className="turnar-footer">
          <button type="button" className="com-btn-ghost" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="button" className="com-btn-verde turnar-submit" onClick={handleTurnar} disabled={loading || catalogosCargando || !enLinea}>
            {loading && <span className="btn-spinner" />}
            {loading ? 'Turnando…' : !enLinea ? 'Sin conexión' : 'Turnar solicitud'}
            {!loading && (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>
              </svg>
            )}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
