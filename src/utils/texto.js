// Trunca por caracteres en vez de -webkit-line-clamp: el clamp por CSS se
// probó poco fiable para este caso (Safari/iOS y algunos Chrome dejaban
// pasar líneas de más después del "…", que luego el borde de la tarjeta
// cortaba a media palabra — se veía como un error del sistema). Cortar el
// string en JS siempre da un resultado predecible en cualquier navegador.
export function truncarTexto(texto, max = 110) {
  if (!texto || texto.length <= max) return texto
  const cortado = texto.slice(0, max)
  const ultimoEspacio = cortado.lastIndexOf(' ')
  return (ultimoEspacio > 20 ? cortado.slice(0, ultimoEspacio) : cortado).trimEnd() + '…'
}
