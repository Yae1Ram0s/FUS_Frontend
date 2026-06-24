import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Spinner from '../components/Spinner'
import api from '../api/api'
import { useAuth } from '../context/AuthContext'
import './RegistrarFUS.css'

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
    solicitante_nombre:  '',
    solicitante_tel:     '',
    solicitante_correo:  '',
    evidencia:           null,
  })

  useEffect(() => {
    api.get('/catalogos/medios/').then(r => setMedios(r.data)).catch(() => {})
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

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
      fd.append('solicitante_nombre',   form.solicitante_nombre)
      fd.append('solicitante_tel',      form.solicitante_tel)
      fd.append('solicitante_correo',   form.solicitante_correo)
      if (form.evidencia) fd.append('evidencia', form.evidencia)

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
                <select
                  id="reg-prioridad"
                  value={form.prioridad}
                  onChange={e => set('prioridad', e.target.value)}
                  required
                >
                  <option value="">Selecciona una prioridad</option>
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
              </div>

              <div className="reg-row">
                <label>Evidencia</label>
                <div className="evidencia-row">
                  <label className="file-btn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Cargar documento
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.docx"
                      style={{ display: 'none' }}
                      onChange={e => set('evidencia', e.target.files[0])}
                    />
                  </label>
                  {form.evidencia && (
                    <span className="file-name">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      {form.evidencia.name}
                    </span>
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
