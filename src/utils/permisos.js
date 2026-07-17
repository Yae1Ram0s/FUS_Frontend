// Roles con facultad de gestionar el ciclo de Comisionado sobre un FUS
// (comisionar, ver seguimiento, aprobar, rechazar), con scoping por dirección
// aplicado del lado del backend.
export const puedeGestionarComisionados = (user) =>
  user?.rol === 'ROL1' || user?.rol === 'ROL2'
