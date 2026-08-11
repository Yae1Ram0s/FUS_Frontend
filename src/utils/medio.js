/* Medio de recepción para mostrar en detalle — cuando es "Otro", agrega lo
   que la persona especificó en medioEspecificacion (ver RegistrarFUS). */
export function formatMedioRecepcion(idMedioRecepcion, medioEspecificacion) {
  const nombre = idMedioRecepcion?.nombreMedio
  if (!nombre) return null
  return nombre === 'Otro' && medioEspecificacion
    ? `${nombre} — ${medioEspecificacion}`
    : nombre
}
