export function rutaInicioPorRol(rol) {
  if (rol === 'ROL1' || rol === 'EQUIPO_PARTICULAR') return '/rol1/dashboard'
  if (rol === 'ROL2') return '/rol2/dashboard'
  if (rol === 'COMISIONADO') return '/comisionado/calendario'
  return '/login'
}
