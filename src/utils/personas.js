export function obtenerIniciales(nombre, email) {
  return (nombre || email || '?')
    .split(' ')
    .slice(0, 2)
    .map(palabra => palabra[0])
    .join('')
    .toUpperCase()
}
