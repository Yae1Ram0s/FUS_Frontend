/* Borrador local de "Registrar FUS" — guardado en localStorage (no depende
   de red, así que sobrevive a que se caiga la conexión) para poder avisar y
   recuperar una solicitud que se quedó a medias si el usuario cierra la
   pestaña, navega a otra pantalla o pierde la conexión sin haber enviado el
   formulario. Los archivos adjuntos (File) no son serializables — solo se
   guardan sus nombres, para avisar que hay que volver a adjuntarlos. */

const PREFIJO = 'scs_borrador_fus_'

const claveDe = email => `${PREFIJO}${email}`

export function guardarBorrador(email, form) {
  if (!email) return
  try {
    const datos = {
      descripcion:         form.descripcion,
      contexto:            form.contexto,
      idMedioRecepcion:    form.idMedioRecepcion,
      medioEspecificacion: form.medioEspecificacion,
      prioridad:           form.prioridad,
      criterios:           form.criterios,
      otroCriterio:        form.otroCriterio,
      fechaLimite:         form.fechaLimite,
      solicitante_nombre:  form.solicitante_nombre,
      solicitante_tel:     form.solicitante_tel,
      solicitante_correo:  form.solicitante_correo,
      evidenciasNombres:   form.evidencias.map(ev => ev.file.name),
      guardadoEn:          Date.now(),
    }
    if (!tieneContenido(datos)) {
      borrarBorrador(email)
      return
    }
    localStorage.setItem(claveDe(email), JSON.stringify(datos))
  } catch { /* localStorage lleno o deshabilitado: sin borrador, no rompe el formulario */ }
}

export function leerBorrador(email) {
  if (!email) return null
  try {
    const crudo = localStorage.getItem(claveDe(email))
    return crudo ? JSON.parse(crudo) : null
  } catch {
    return null
  }
}

export function borrarBorrador(email) {
  if (!email) return
  try { localStorage.removeItem(claveDe(email)) } catch { /* noop */ }
}

/* Evita guardar/mostrar un borrador "vacío" (formulario recién abierto y
   cerrado sin escribir nada). Acepta tanto el borrador ya serializado
   (`evidenciasNombres`) como el estado en vivo del formulario
   (`evidencias`, objetos File) — mismos campos de texto en ambos. */
export function tieneContenido(datos) {
  if (!datos) return false
  return Boolean(
    datos.descripcion?.trim() ||
    datos.contexto?.trim() ||
    datos.idMedioRecepcion ||
    datos.prioridad ||
    datos.solicitante_nombre?.trim() ||
    datos.solicitante_tel?.trim() ||
    datos.solicitante_correo?.trim() ||
    datos.evidenciasNombres?.length ||
    datos.evidencias?.length,
  )
}
