import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import FechaInput from '../components/FechaInput'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useAnalytics } from '../analytics'
import { useEvidenciaUrl } from '../hooks/useEvidenciaUrl'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useConexionInternet } from '../hooks/useConexionInternet'
import { validarEvidencias } from '../utils/archivos'
import { guardarBorrador, leerBorrador, borrarBorrador, tieneContenido } from '../utils/borradorFUS'
import './RegistrarFUS.css'

const PRIORIDAD_INFO = {
  Alta: {
    color: 'alta',
    titulo: 'Alta',
    criterios: [
      'Posible corrupción, denuncia, falta administrativa o delito.',
      'Solicitud directa a la persona Titular sobre asunto sensible.',
      'Riesgo jurídico, administrativo, político, mediático, operativo o de seguridad.',
      'Plazo urgente.',
      'Posible afectación a derechos, recursos públicos o imagen institucional.',
    ],
  },
  Media: {
    color: 'media',
    titulo: 'Media',
    criterios: [
      'Sea relevante para la gestión institucional.',
      'Requiera análisis o canalización.',
      'No tenga riesgo inmediato.',
      'No exija decisión urgente de la persona Titular.',
      'Pueda resolverse por un área competente con seguimiento de la Oficina Particular.',
      'Acceso a instalaciones, información o decisiones estratégicas.',
    ],
  },
  Baja: {
    color: 'baja',
    titulo: 'Baja',
    criterios: [
      'Sea informativa, protocolaria o de cortesía.',
      'No implique riesgo institucional.',
      'No tenga plazo crítico.',
      'No requiera intervención de la persona Titular.',
      'Pueda responderse con formato estándar, canalizarse o archivarse.',
    ],
  },
}

const formVacio = () => ({
  descripcion:         '',
  contexto:            '',
  idMedioRecepcion:    '',
  medioEspecificacion: '',
  prioridad:           '',
  criterios:           [],
  // Criterio libre, aparte de la lista fija de arriba — vive dentro de la
  // prioridad elegida (Alta/Media/Baja), no como una prioridad propia: así
  // el FUS siempre queda con una prioridad real con la que se puede filtrar,
  // en vez de un "Otro" suelto sin prioridad asignada.
  otroCriterio:        '',
  fechaLimite:         '',
  solicitante_nombre:  '',
  solicitante_tel:     '',
  solicitante_correo:  '',
  evidencias:          [],
})

// Filtra a minúsculas y solo caracteres válidos en un correo (evita
// emojis/espacios/símbolos que un email real no admite) mientras se escribe.
const sanitizarCorreo = (valor) => valor.toLowerCase().replace(/[^a-z0-9.@_%+-]/g, '')

// Pone en mayúscula la primera letra de cada palabra (al inicio y después
// de cada espacio) mientras se escribe el nombre.
const capitalizarPalabras = (valor) => valor.replace(/(^|\s)(\p{L})/gu, (_, sep, letra) => sep + letra.toUpperCase())

// Pone en mayúscula solo la primera letra del texto (para párrafos como
// Descripción/Contexto, donde capitalizar cada palabra sería excesivo).
const capitalizarInicio = (valor) => valor.charAt(0).toUpperCase() + valor.slice(1)

/* ── Evidencia ya guardada (descarga autenticada) + opción de eliminarla ── */
function EvidenciaExistenteLink({ ev, onEliminar }) {
  const url = useEvidenciaUrl(ev.id)
  return (
    <div className="ev-existente-item">
      <a
        href={url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className={`ev-existente-link${url ? '' : ' ev-item-cargando'}`}
        onClick={e => { if (!url) e.preventDefault() }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        {ev.nombreArchivo}
      </a>
      <button
        type="button"
        className="ev-existente-quitar"
        onClick={onEliminar}
        title="Eliminar evidencia"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}

export default function RegistrarFUS() {
  const { user }   = useAuth()
  const toast      = useToast()
  const navigate   = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('editar')

  const [medios,  setMedios]  = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [exito,   setExito]   = useState('')
  const [cargandoFus, setCargandoFus] = useState(!!editId)
  const [evidenciasExistentes, setEvidenciasExistentes] = useState([])
  const [evidenciasEliminarIds, setEvidenciasEliminarIds] = useState([])
  const [limpiado, setLimpiado] = useState(false)
  const envioEnCursoRef = useRef(false)
  const enLinea = useConexionInternet()
  const { startTask, completeTask, failTask } = useAnalytics({ componente: 'REGISTRAR_FUS_FORM' })

  // Un FUS en edición no usa borrador local (ya vive guardado en el
  // servidor) — el borrador es solo para una solicitud nueva a medio llenar.
  const borradorInicial = editId ? null : leerBorrador(user?.email)
  const [avisoBorrador] = useState(() => (
    !editId && tieneContenido(borradorInicial) && borradorInicial.evidenciasNombres?.length
      ? `Recuperamos tu borrador — vuelve a adjuntar: ${borradorInicial.evidenciasNombres.join(', ')}.`
      : ''
  ))

  const [form, setForm] = useState(() => (
    // Se combina sobre formVacio() (no solo el borrador) para que un
    // borrador guardado antes de agregar un campo nuevo (ej. otroCriterio)
    // no deje ese campo en `undefined`.
    !editId && tieneContenido(borradorInicial)
      ? { ...formVacio(), ...borradorInicial, evidencias: [] }
      : formVacio()
  ))

  useEffect(() => {
    api.get('/catalogos/medios/').then(r => setMedios(r.data)).catch(() => {})
  }, [])

  const toDatetimeLocal = d => {
    if (!d) return ''
    const dt = new Date(d)
    const pad = n => String(n).padStart(2, '0')
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
  }

  useEffect(() => {
    if (!editId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marca "cargando" antes del fetch al entrar en modo edición
    setCargandoFus(true)
    api.get(`/fus/${editId}/`).then(r => {
      const f = r.data
      // El criterio libre ("Otro") se guardó mezclado con los de la lista
      // fija (todos en el mismo campo `criterios`, separados por "|") — al
      // cargar se separa: lo que coincide con la lista fija de esa
      // prioridad vuelve a los checkboxes, y lo que no coincide (el texto
      // que la persona escribió) vuelve al campo de texto libre.
      const guardados = f.criterios ? f.criterios.split('|').map(c => c.trim()).filter(Boolean) : []
      const listaFija = PRIORIDAD_INFO[f.prioridad]?.criterios || []
      setForm({
        descripcion:         f.descripcion || '',
        contexto:            f.contexto || '',
        idMedioRecepcion:    f.idMedioRecepcion?.id || '',
        medioEspecificacion: f.medioEspecificacion || '',
        prioridad:           f.prioridad || '',
        criterios:           guardados.filter(c => listaFija.includes(c)),
        otroCriterio:        guardados.find(c => !listaFija.includes(c)) || '',
        fechaLimite:         toDatetimeLocal(f.fechaLimite),
        solicitante_nombre:  f.nombreExterno || '',
        solicitante_tel:     f.telefonoExterno || '',
        solicitante_correo:  f.correoExterno || '',
        evidencias:          [],
      })
      setEvidenciasExistentes(f.evidencias || [])
      setEvidenciasEliminarIds([])
    }).catch(() => {
      setError('No se pudo cargar la solicitud a editar.')
    }).finally(() => setCargandoFus(false))
  }, [editId])

  // Borrador local: guarda en localStorage mientras se llena una solicitud
  // nueva (no en modo edición) — si se pierde la conexión, se cierra la
  // pestaña sin querer o navega a otra pantalla, BorradorFUSPrompt (en
  // AppLayout) avisa y deja retomarlo. No depende de red, así que sigue
  // funcionando aunque la API esté caída.
  const formParaGuardar = useDebouncedValue(form, 600)
  useEffect(() => {
    if (editId || exito) return
    guardarBorrador(user?.email, formParaGuardar)
  }, [formParaGuardar, editId, exito, user?.email])

  // Guardado de último momento al salir de la pantalla (ej. clic al menú
  // antes de que pasen los 600ms del debounce de arriba): sin esto, lo
  // escrito en esa ventana corta se perdía porque el debounce nunca llegaba
  // a disparar el guardado antes de desmontarse el componente. `noGuardarRef`
  // evita que este mismo guardado de salida resucite el borrador justo
  // después de que ya se borró a propósito (envío exitoso o "Cancelar").
  const formRef      = useRef(form)
  const noGuardarRef = useRef(false)
  useEffect(() => { formRef.current = form }, [form])
  useEffect(() => { if (exito) noGuardarRef.current = true }, [exito])
  useEffect(() => {
    return () => {
      if (editId || noGuardarRef.current) return
      guardarBorrador(user?.email, formRef.current)
    }
  }, [editId, user?.email])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const setPrioridad = (v) => setForm(f => ({ ...f, prioridad: v, criterios: [], otroCriterio: '' }))

  const prioridadOrden = ['Alta', 'Media', 'Baja']
  const prioridadIndex = prioridadOrden.indexOf(form.prioridad)
  const prioridadSeleccionada = form.prioridad && PRIORIDAD_INFO[form.prioridad] ? PRIORIDAD_INFO[form.prioridad].color : ''

  const previewsRef = useRef([])

  const agregarArchivos = (files) => {
    const validacion = validarEvidencias(files, form.evidencias)
    if (validacion.error) {
      setError(validacion.error)
      return
    }
    setError('')
    const nuevos = validacion.archivos.map(f => ({
      file: f,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      comentario: '',
    }))
    previewsRef.current = [...previewsRef.current, ...nuevos.map(n => n.preview).filter(Boolean)]
    setForm(f => ({ ...f, evidencias: [...f.evidencias, ...nuevos] }))
  }

  const quitarArchivo = (idx) => {
    setForm(f => {
      const item = f.evidencias[idx]
      if (item?.preview) URL.revokeObjectURL(item.preview)
      return { ...f, evidencias: f.evidencias.filter((_, i) => i !== idx) }
    })
  }

  // No borra en el servidor de inmediato: solo la quita de la vista y la
  // marca para eliminar al guardar, igual que las evidencias nuevas no se
  // suben hasta el submit — así "Cancelar" deja la solicitud intacta.
  const quitarEvidenciaExistente = (id) => {
    setEvidenciasExistentes(lista => lista.filter(ev => ev.id !== id))
    setEvidenciasEliminarIds(ids => [...ids, id])
  }

  const setComentarioEvidencia = (idx, texto) => {
    setForm(f => ({
      ...f,
      evidencias: f.evidencias.map((ev, i) => i === idx ? { ...ev, comentario: texto } : ev),
    }))
  }

  useEffect(() => {
    return () => previewsRef.current.forEach(url => URL.revokeObjectURL(url))
  }, [])

  const toggleCriterio = (texto) => setForm(f => ({
    ...f,
    criterios: f.criterios.includes(texto)
      ? f.criterios.filter(c => c !== texto)
      : [...f.criterios, texto],
  }))

  const ahora = new Date().toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (envioEnCursoRef.current) return
    if (!form.descripcion || form.descripcion.length < 20) {
      setError('La descripción debe tener al menos 20 caracteres.')
      return
    }
    if (!form.idMedioRecepcion) { setError('Selecciona un medio de recepción.'); return }
    const medioSeleccionado = medios.find(m => String(m.id) === String(form.idMedioRecepcion))
    if (medioSeleccionado?.nombreMedio === 'Otro' && !form.medioEspecificacion.trim()) {
      setError('Especifica el medio de recepción.')
      return
    }
    if (!form.prioridad)         { setError('Selecciona una prioridad.'); return }

    envioEnCursoRef.current = true
    setError(''); setLoading(true)
    const taskId = startTask({ accion: editId ? 'UPDATE' : 'CREATE' })
    try {
      // El criterio libre se manda como uno más dentro de la misma lista de
      // criterios de la prioridad elegida (no aparte) — así el FUS siempre
      // queda con una prioridad real (Alta/Media/Baja) filtrable, y el
      // texto libre es solo un criterio adicional dentro de ella.
      const criteriosFinal = form.otroCriterio.trim()
        ? [...form.criterios, form.otroCriterio.trim()]
        : form.criterios
      const fd = new FormData()
      fd.append('descripcion',          form.descripcion)
      fd.append('contexto',             form.contexto)
      fd.append('idMedioRecepcion',     form.idMedioRecepcion)
      fd.append('medioEspecificacion',  medioSeleccionado?.nombreMedio === 'Otro' ? form.medioEspecificacion.trim() : '')
      fd.append('prioridad',            form.prioridad)
      fd.append('criterios',            criteriosFinal.join(' | '))
      fd.append('fechaLimite', form.fechaLimite)
      fd.append('nombreExterno',    form.solicitante_nombre)
      fd.append('telefonoExterno', form.solicitante_tel)
      fd.append('correoExterno',   form.solicitante_correo)
      form.evidencias.forEach(ev => fd.append('evidencias', ev.file))
      fd.append('comentariosEvidencias', JSON.stringify(form.evidencias.map(ev => ev.comentario || '')))
      if (editId && evidenciasEliminarIds.length) {
        fd.append('evidenciasEliminar', JSON.stringify(evidenciasEliminarIds))
      }

      // La instancia de `api` fija Content-Type: application/json por defecto
      // (api/api.js) — sin overridearlo aquí, axios ve ese header ya puesto y
      // en vez de mandar el FormData como multipart, lo serializa con
      // JSON.stringify() (formDataToJSON). Los File no tienen propiedades
      // enumerables, así que se pierden en silencio: el FUS se guardaba bien
      // (los campos de texto sí sobreviven), pero ninguna evidencia llegaba a
      // crearse nunca, aunque el formulario mostrara éxito. Pasar
      // Content-Type: undefined borra el header heredado y deja que el
      // navegador genere el "multipart/form-data; boundary=..." real.
      // timeout más alto que el default de `api` (20s) — con evidencias
      // adjuntas y conexión lenta, 20s no alcanza para terminar la subida.
      const config = { headers: { 'Content-Type': undefined }, timeout: 60000 }
      const { data } = editId
        ? await api.patch(`/fus/${editId}/`, fd, config)
        : await api.post('/fus/', fd, config)
      if (!editId) borrarBorrador(user?.email)
      const mensajeExito = editId ? 'Solicitud actualizada correctamente.' : 'Solicitud registrada correctamente.'
      setExito(mensajeExito)
      completeTask(taskId)
      toast.success(mensajeExito)
      setTimeout(() => navigate(
        `/rol1/consultar-fus?folio=${encodeURIComponent(data.folio)}`,
        { state: { recienRegistrado: true } },
      ), 1200)
      // se mantiene loading=true a propósito: el formulario queda deshabilitado
      // hasta que ocurre la navegación, para evitar un doble envío en ese lapso.
    } catch (err) {
      // Sin err.response = no llegó respuesta del servidor (conexión caída) —
      // se distingue del resto de errores porque el borrador local sigue
      // intacto (no depende de la red) y conviene decirlo, no solo "reintenta".
      const mensaje = err.response?.data?.detail
        ?? (err.response
          ? 'No se pudo guardar la solicitud. Intenta nuevamente.'
          : 'Se perdió la conexión. Lo que llevas llenado sigue guardado en este formulario — intenta de nuevo cuando vuelva la conexión.')
      setError(mensaje)
      failTask(taskId, { metadatos: { motivo: err.response ? 'error_servidor' : 'sin_conexion' } })
      envioEnCursoRef.current = false
      setLoading(false)
    }
  }

  // Registrando de cero (no en edición): si el formulario ya está vacío no
  // hay nada que "Cancelar" pueda limpiar — el botón se deshabilita para que
  // no de la impresión de que hace algo, y no dispara el toast/destello.
  const hayAlgoQueLimpiar = editId || tieneContenido(form)

  const cancelar = () => {
    // En edición no hay "formulario en blanco" al que volver — se sale a
    // Consultar FUS igual que antes. Registrando de cero, en cambio, se
    // reinicia la misma pantalla (sin navegar) para poder capturar otra
    // solicitud de inmediato.
    if (editId) {
      navigate('/rol1/consultar-fus')
      return
    }
    if (!tieneContenido(form)) return
    borrarBorrador(user?.email)
    previewsRef.current.forEach(url => URL.revokeObjectURL(url))
    previewsRef.current = []
    setForm(formVacio())
    setError('')
    setExito('')
    // El reinicio no navega a ningún lado, así que sin una señal aparte el
    // usuario no tiene forma de saber si el clic realmente limpió el
    // formulario — destello en la tarjeta + toast, mismo patrón de
    // confirmación que usa el resto de la app (ToastContext).
    setLimpiado(true)
    setTimeout(() => setLimpiado(false), 700)
    toast.info('Formulario limpiado — puedes registrar una nueva solicitud.')
  }

  // Confirmación nativa del navegador al cerrar/recargar con cambios sin
  // guardar — complementa al borrador (que ya cubre la recuperación): esto
  // intenta evitar el cierre accidental antes de que pase.
  useEffect(() => {
    if (editId || loading || exito) return
    const onBeforeUnload = e => {
      if (!tieneContenido(form)) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [editId, loading, exito, form])

  return (
    <AppLayout mainClass="app-main-scroll">
      {/* Fuera de .reg-bg/.reg-form-card a propósito: esos contenedores tienen
          backdrop-filter, que crea su propio "containing block" para los
          descendientes position:fixed — anidado ahí, el overlay del Spinner
          quedaba recortado/posicionado relativo a la tarjeta en vez de a toda
          la pantalla, y por eso no se veía. */}
      {exito && <Spinner overlay dots label={exito} />}
      <div className="reg-bg">
      <div className="reg-content">
        <div className="reg-header">
          <div className="reg-header-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="11" x2="12" y2="17"/>
              <line x1="9" y1="14" x2="15" y2="14"/>
            </svg>
            <h1>{editId ? 'Editar solicitud FUS' : 'Nueva solicitud FUS'}</h1>
          </div>
          <div className="reg-header-right">
            <span className="reg-header-sub">
              {editId ? 'Modifica los campos y guarda los cambios.' : 'Completa los campos para registrar la solicitud.'}
            </span>
          </div>
        </div>

        <div className={`reg-form-card${limpiado ? ' reg-form-card-limpiado' : ''}`}>
          {avisoBorrador && <p className="reg-aviso-borrador" role="status">{avisoBorrador}</p>}
          {cargandoFus && <Spinner overlay={false} fill />}
          {!cargandoFus && !exito && <form className="reg-form" data-analytics-form="REGISTRAR_FUS_FORM" onSubmit={handleSubmit} noValidate>

            <fieldset className="reg-fieldset">
              <legend className="reg-legend">Datos generales</legend>

              <div className="reg-row">
                <label htmlFor="reg-fecha">Fecha y hora</label>
                <input id="reg-fecha" type="text" value={ahora} readOnly className="input-readonly" />
              </div>

              <div className="reg-row">
                <label htmlFor="reg-solicitante">Solicitante interno</label>
                <input id="reg-solicitante" type="text" value={user?.nombre || user?.email || ''} readOnly className="input-readonly" />
              </div>

              <div className="reg-row">
                <label htmlFor="reg-medio">Medio de recepción <span className="req">*</span></label>
                <div className="medio-wrapper">
                  <select
                    id="reg-medio"
                    value={form.idMedioRecepcion}
                    onChange={e => set('idMedioRecepcion', e.target.value)}
                    required
                  >
                    <option value="">Selecciona un medio</option>
                    {medios.map(m => (
                      <option key={m.id} value={m.id}>{m.nombreMedio}</option>
                    ))}
                  </select>
                  {medios.filter(m => m.paraTurnado).length > 0 && (
                    <div className="medios-quick">
                      {medios.filter(m => m.paraTurnado).map(m => (
                        <label key={m.id} className="quick-opt">
                          <input
                            type="radio"
                            name="medioQuick"
                            value={m.id}
                            checked={String(form.idMedioRecepcion) === String(m.id)}
                            onChange={() => set('idMedioRecepcion', m.id)}
                          />
                          {m.nombreMedio}
                        </label>
                      ))}
                    </div>
                  )}
                  {medios.find(m => String(m.id) === String(form.idMedioRecepcion))?.nombreMedio === 'Otro' && (
                    <input
                      type="text"
                      className="medio-otro-input"
                      placeholder="Especifica el medio de recepción"
                      value={form.medioEspecificacion}
                      onChange={e => set('medioEspecificacion', e.target.value)}
                    />
                  )}
                </div>
              </div>
            </fieldset>

            <fieldset className="reg-fieldset">
              <legend className="reg-legend">Descripción de la solicitud</legend>

              <div className="reg-row reg-row-tall">
                <label htmlFor="reg-descripcion">Descripción <span className="req">*</span></label>
                <textarea
                  id="reg-descripcion"
                  rows={4}
                  placeholder="Describe detalladamente la solicitud (mínimo 20 caracteres)"
                  value={form.descripcion}
                  onChange={e => set('descripcion', capitalizarInicio(e.target.value))}
                  required
                />
              </div>

              <div className="reg-row reg-row-tall">
                <label htmlFor="reg-contexto">Contexto</label>
                <textarea
                  id="reg-contexto"
                  rows={3}
                  placeholder="Antecedentes o información adicional relevante (opcional)"
                  value={form.contexto}
                  onChange={e => set('contexto', capitalizarInicio(e.target.value))}
                />
              </div>
            </fieldset>

            <fieldset className="reg-fieldset">
              <legend className="reg-legend">Datos de contacto de solicitante externo (opcional)</legend>

              <div className="reg-row reg-externo">
                <label>Datos de contacto</label>
                <div className="externo-grid">
                  <input
                    placeholder="Nombre completo"
                    value={form.solicitante_nombre}
                    onChange={e => set('solicitante_nombre', capitalizarPalabras(e.target.value))}
                  />
                  <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Teléfono/Celular"
                    value={form.solicitante_tel}
                    onChange={e => set('solicitante_tel', e.target.value.replace(/\D/g, ''))}
                  />
                  <div className="externo-correo-wrap">
                    <input
                      type="email"
                      placeholder="Correo electrónico"
                      value={form.solicitante_correo}
                      onChange={e => set('solicitante_correo', sanitizarCorreo(e.target.value))}
                    />
                    <div className="correo-chips">
                      {['@gmail.com', '@hotmail.com', '@outlook.com', '@anam.gob.mx'].map(dominio => (
                        <button
                          key={dominio}
                          type="button"
                          className="correo-chip"
                          onClick={() => set('solicitante_correo', `${form.solicitante_correo.split('@')[0]}${dominio}`)}
                        >
                          {dominio}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className="reg-fieldset">
              <legend className="reg-legend">Evidencia</legend>

              <div className="reg-row reg-row-evidencia">
                <label>Adjuntar evidencias</label>
                <div className="evidencia-col">
                  {evidenciasExistentes.length > 0 && (
                    <div className="ev-existentes-list">
                      {evidenciasExistentes.map(ev => (
                        <EvidenciaExistenteLink key={ev.id} ev={ev} onEliminar={() => quitarEvidenciaExistente(ev.id)} />
                      ))}
                    </div>
                  )}
                  <label className="file-btn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Agregar evidencia
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.docx"
                      style={{ display: 'none' }}
                      onChange={e => { agregarArchivos(e.target.files); e.target.value = '' }}
                    />
                  </label>
                  {form.evidencias.length > 0 && (
                    <div className="ev-preview-list">
                      {form.evidencias.map((ev, idx) => (
                        <div key={idx} className="ev-preview-row">
                          {ev.preview ? (
                            <img src={ev.preview} alt={ev.file.name} className="ev-preview-thumb" />
                          ) : (
                            <span className="ev-preview-icon">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                              </svg>
                            </span>
                          )}
                          <div className="ev-preview-datos">
                            <span className="ev-preview-nombre">{ev.file.name}</span>
                            <input
                              type="text"
                              className="ev-preview-comentario"
                              placeholder="Comentarios o notas relevantes (opcional)"
                              value={ev.comentario}
                              onChange={e => setComentarioEvidencia(idx, e.target.value)}
                            />
                          </div>
                          <button
                            type="button"
                            className="ev-preview-quitar"
                            onClick={() => quitarArchivo(idx)}
                            title="Quitar archivo"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </fieldset>

            <fieldset className="reg-fieldset">
              <legend className="reg-legend">Prioridad</legend>

              <div className="reg-row">
                <label htmlFor="reg-prioridad">Seleccione la prioridad <span className="req">*</span></label>
                <div className="prioridad-wrapper">
                  <div className="prioridad-pills" style={{ '--prioridad-index': prioridadIndex >= 0 ? prioridadIndex : 0 }}>
                    <div className={`prioridad-glider${prioridadSeleccionada ? ` prioridad-${prioridadSeleccionada}` : ''}`} aria-hidden="true" />
                    {Object.entries(PRIORIDAD_INFO).map(([valor, info]) => (
                      <button
                        key={valor}
                        type="button"
                        className={`prioridad-pill prioridad-${info.color}${form.prioridad === valor ? ' prioridad-selected' : ''}`}
                        onClick={() => setPrioridad(valor)}
                        aria-pressed={form.prioridad === valor}
                      >
                        {info.icono} {info.titulo}
                      </button>
                    ))}
                  </div>
                  {form.prioridad && PRIORIDAD_INFO[form.prioridad] && (
                    <div className={`prioridad-criterios prioridad-${PRIORIDAD_INFO[form.prioridad].color}`}>
                      <p className="criterios-hint">Selecciona los criterios que aplican:</p>
                      {PRIORIDAD_INFO[form.prioridad].criterios.map((texto) => {
                        const activo = form.criterios.includes(texto)
                        return (
                          <button
                            key={texto}
                            type="button"
                            className={`criterio-item${activo ? ' criterio-activo' : ''}`}
                            onClick={() => toggleCriterio(texto)}
                          >
                            <span className="criterio-check-svg" aria-hidden="true">
                              <svg viewBox="0 0 18 18">
                                <path d="M 1 9 L 1 9 C 1 4 4 1 9 1 L 9 1 C 14 1 17 4 17 9 L 17 9 C 17 14 14 17 9 17 L 9 17 C 4 17 1 14 1 9 Z"></path>
                                <polyline points="1 9 7 14 15 4"></polyline>
                              </svg>
                            </span>
                            {texto}
                          </button>
                        )
                      })}
                      <input
                        type="text"
                        className="criterio-otro-input"
                        value={form.otroCriterio}
                        onChange={e => set('otroCriterio', e.target.value)}
                        placeholder="Otro criterio (opcional)…"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="reg-row">
                <label htmlFor="reg-fecha-limite">Fecha y hora límite (opcional)</label>
                <FechaInput
                  id="reg-fecha-limite"
                  type="datetime-local"
                  value={form.fechaLimite}
                  onChange={e => set('fechaLimite', e.target.value)}
                />
              </div>
            </fieldset>

            {error && <p className="reg-error" role="alert">{error}</p>}
            {!enLinea && <p className="reg-error" role="alert">Sin conexión a internet — no se puede enviar en este momento.</p>}

            <div className="reg-actions">
              <button type="button" className="btn-secondary" onClick={cancelar} disabled={loading || !hayAlgoQueLimpiar}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={loading || !enLinea}>
                {loading && <span className="btn-spinner" />}
                {loading ? 'Guardando…' : !enLinea ? 'Sin conexión' : (editId ? 'Guardar cambios' : 'Guardar solicitud')}
              </button>
            </div>
          </form>}
        </div>
      </div>
      </div>
    </AppLayout>
  )
}
