export function esImagen(mime) {
  return Boolean(mime?.startsWith('image/'))
}

const EXTENSIONES_PERMITIDAS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'docx'])
const MIME_PERMITIDOS = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const MAX_ARCHIVO = 10 * 1024 * 1024
const MAX_TOTAL = 30 * 1024 * 1024

const archivoReal = item => item?.file || item
const claveArchivo = archivo => (
  `${archivo.name.toLowerCase()}|${archivo.size}`
)

export function validarEvidencias(files, existentes = []) {
  const nuevos = Array.from(files || [])
  const existentesReales = existentes.map(archivoReal)
  const claves = new Set(existentesReales.map(claveArchivo))

  for (const archivo of nuevos) {
    const extension = archivo.name.split('.').pop()?.toLowerCase()
    if (!EXTENSIONES_PERMITIDAS.has(extension)) {
      return { error: `“${archivo.name}” no tiene un formato permitido. Usa PDF, JPG, PNG o DOCX.` }
    }
    if (archivo.type && !MIME_PERMITIDOS.has(archivo.type)) {
      return { error: `“${archivo.name}” tiene un tipo de archivo no permitido.` }
    }
    if (archivo.size > MAX_ARCHIVO) {
      return { error: `“${archivo.name}” supera el límite de 10 MB.` }
    }
    const clave = claveArchivo(archivo)
    if (claves.has(clave)) {
      return { error: `“${archivo.name}” ya fue agregado.` }
    }
    claves.add(clave)
  }

  const total = [...existentesReales, ...nuevos]
    .reduce((suma, archivo) => suma + archivo.size, 0)
  if (total > MAX_TOTAL) {
    return { error: 'El total de evidencias supera el límite de 30 MB.' }
  }

  return { archivos: nuevos, error: null }
}
