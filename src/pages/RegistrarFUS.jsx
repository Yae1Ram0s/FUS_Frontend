import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import './RegistrarFUS.css'

const PRIORIDAD_INFO = {
  Alta: {
    color: 'alta',
    icono: '🔴',
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
    icono: '🟡',
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
    icono: '🟢',
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

export default function RegistrarFUS() {
  const { user }   = useAuth()
  const navigate   = useNavigate()

  const [medios,  setMedios]  = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [exito,   setExito]   = useState('')

  const [form, setForm] = useState({
    descripcion:         '',
    contexto:            '',
    idMedioRecepcion:    '',
    medioEspecificacion: '',
    prioridad:           '',
    criterios:           [],
    solicitante_nombre:  '',
    solicitante_tel:     '',
    solicitante_correo:  '',
    evidencias:          [],
  })

  useEffect(() => {
    api.get('/catalogos/medios/').then(r => setMedios(r.data)).catch(() => {})
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const setPrioridad = (v) => setForm(f => ({ ...f, prioridad: v, criterios: [] }))

  const previewsRef = useRef([])

  const agregarArchivos = (files) => {
    const nuevos = Array.from(files).map(f => ({
      file: f,
      preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
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
    if (!form.descripcion || form.descripcion.length < 20) {
      setError('La descripción debe tener al menos 20 caracteres.')
      return
    }
    if (!form.idMedioRecepcion) { setError('Selecciona un medio de recepción.'); return }
    if (!form.prioridad)         { setError('Selecciona una prioridad.'); return }

    setError(''); setLoading(true)
    try {
      const fd = new FormData()
      fd.append('descripcion',          form.descripcion)
      fd.append('contexto',             form.contexto)
      fd.append('idMedioRecepcion',     form.idMedioRecepcion)
      fd.append('medioEspecificacion',  form.medioEspecificacion)
      fd.append('prioridad',            form.prioridad)
      fd.append('criterios',            form.criterios.join(' | '))
      fd.append('nombreExterno',    form.solicitante_nombre)
      fd.append('telefonoExterno', form.solicitante_tel)
      fd.append('correoExterno',   form.solicitante_correo)
      form.evidencias.forEach(ev => fd.append('evidencias', ev.file))

      await api.post('/fus/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setExito('Solicitud registrada correctamente.')
      setTimeout(() => navigate('/rol1/consultar-fus'), 1500)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar la solicitud. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout mainClass="app-main-scroll">
      <div className="reg-bg">
      <div className="reg-content">
        <div className="reg-page-header">
          <h2 className="reg-page-title">Nueva solicitud FUS</h2>
          <p className="reg-page-sub">Completa los campos para registrar la solicitud.</p>
        </div>

        <div className="reg-form-card">
          {loading && <Spinner label="Guardando solicitud…" />}
          <form className="reg-form" onSubmit={handleSubmit} noValidate>

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
                  onChange={e => set('descripcion', e.target.value)}
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
                  onChange={e => set('contexto', e.target.value)}
                />
              </div>
            </fieldset>

            <fieldset className="reg-fieldset">
              <legend className="reg-legend">Solicitante externo (opcional)</legend>

              <div className="reg-row reg-externo">
                <label>Datos de contacto</label>
                <div className="externo-grid">
                  <input
                    placeholder="Nombre completo"
                    value={form.solicitante_nombre}
                    onChange={e => set('solicitante_nombre', e.target.value)}
                  />
                  <input
                    placeholder="Teléfono"
                    value={form.solicitante_tel}
                    onChange={e => set('solicitante_tel', e.target.value)}
                  />
                  <input
                    placeholder="Correo electrónico"
                    value={form.solicitante_correo}
                    onChange={e => set('solicitante_correo', e.target.value)}
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="reg-fieldset">
              <legend className="reg-legend">Clasificación</legend>

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
                </div>
              </div>

              <div className="reg-row">
                <label htmlFor="reg-prioridad">Prioridad <span className="req">*</span></label>
                <div className="prioridad-wrapper">
                  <div className="prioridad-pills">
                    {Object.entries(PRIORIDAD_INFO).map(([valor, info]) => (
                      <button
                        key={valor}
                        type="button"
                        className={`prioridad-pill prioridad-${info.color}${form.prioridad === valor ? ' prioridad-selected' : ''}`}
                        onClick={() => setPrioridad(valor)}
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
                            <span className="criterio-check">{activo ? '☑' : '☐'}</span>
                            {texto}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="reg-row reg-row-evidencia">
                <label>Evidencia</label>
                <div className="evidencia-col">
                  <label className="file-btn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Cargar documento
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.docx"
                      style={{ display: 'none' }}
                      onChange={e => { agregarArchivos(e.target.files); e.target.value = '' }}
                    />
                  </label>
                  {form.evidencias.length > 0 && (
                    <div className="ev-preview-grid">
                      {form.evidencias.map((ev, idx) => (
                        <div key={idx} className="ev-preview-item">
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
                          <span className="ev-preview-nombre">{ev.file.name}</span>
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

            {error && <p className="reg-error" role="alert">{error}</p>}
            {exito && <p className="reg-ok"  role="status">{exito}</p>}

            <div className="reg-actions">
              <button type="button" className="btn-secondary" onClick={() => navigate('/rol1/consultar-fus')}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Guardando…' : 'Guardar solicitud'}
              </button>
            </div>
          </form>
        </div>
      </div>
      </div>
    </AppLayout>
  )
}
