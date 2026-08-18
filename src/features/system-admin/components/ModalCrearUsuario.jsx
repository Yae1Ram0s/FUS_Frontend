import { useEffect, useRef, useState } from 'react'
import api from '../../../api/api'
import { crearUsuarioAdmin, mensajeErrorAdmin } from '../api/adminApi'
import { useAnalytics } from '../../../analytics'

const roles = [['ROL1','Particular del Titular'],['ROL2','Titular / Enlace Estratégico'],['COMISIONADO','Comisionado'],['EQUIPO_PARTICULAR','Equipo del Particular']]

export default function ModalCrearUsuario({ onClose, onCreated }) {
  const firstRef = useRef(null); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [unidades,setUnidades]=useState([])
  const [form,setForm]=useState({nombre:'',email:'',rol:'ROL2',unidadAdministrativaId:''})
  const { startTask, completeTask, failTask } = useAnalytics({ componente: 'ADMIN_USUARIO_CREAR_FORM', accion: 'CREATE' })
  useEffect(()=>{firstRef.current?.focus();const key=e=>e.key==='Escape'&&onClose();document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[onClose])
  useEffect(()=>{api.get('/catalogos/unidades-administrativas/').then(r=>setUnidades(Array.isArray(r.data)?r.data:[])).catch(()=>{})},[])
  const guardar=async e=>{e.preventDefault();setBusy(true);setError('');const taskId=startTask();try{const user=await crearUsuarioAdmin({...form,email:form.email.trim().toLowerCase(),unidadAdministrativaId:form.unidadAdministrativaId||null});completeTask(taskId);onCreated(user)}catch(err){failTask(taskId,{metadatos:{motivo:err.response?'error_servidor':'sin_conexion'}});setError(mensajeErrorAdmin(err))}finally{setBusy(false)}}
  return <div className="sa-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="sa-modal" role="dialog" aria-modal="true" aria-labelledby="sa-create-title"><button className="sa-modal__close" onClick={onClose} aria-label="Cerrar">×</button><h2 id="sa-create-title">Dar de alta usuario</h2><p>Quedará autorizado para completar su primer acceso y crear una contraseña.</p>{error&&<div className="sa-error">{error}</div>}<form data-analytics-form="ADMIN_USUARIO_CREAR_FORM" onSubmit={guardar}><label>Nombre completo<input ref={firstRef} required value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></label><label>Correo institucional<input required type="email" placeholder="usuario@anam.gob.mx" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Rol<select value={form.rol} onChange={e=>setForm({...form,rol:e.target.value})}>{roles.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Unidad administrativa<select value={form.unidadAdministrativaId} onChange={e=>setForm({...form,unidadAdministrativaId:e.target.value})}><option value="">Sin unidad asignada</option>{unidades.map(u=><option key={u.idUnidadAdministrativa} value={u.idUnidadAdministrativa}>{u.unidadAdministrativa}</option>)}</select></label><div className="sa-modal__actions"><button type="button" onClick={onClose}>Cancelar</button><button className="sa-primary" disabled={busy}>{busy?'Registrando…':'Dar de alta'}</button></div></form></section></div>
}
