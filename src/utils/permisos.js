// Roles con facultad de gestionar el ciclo de Comisionado sobre un FUS
// (comisionar, ver seguimiento, aprobar, rechazar), con scoping por dirección
// aplicado del lado del backend.
export const puedeGestionarComisionados = (user) =>
  user?.rol === 'ROL1' || user?.rol === 'ROL2'

// Único Particular de la solicitud. La validación final (concluir/rechazar
// solicitud) quedó exclusiva de este rol — el Titular (ROL2) ya no puede
// llamar a esos dos endpoints.
export const esParticular = (user) => user?.rol === 'ROL1'

// Resuelve si corresponde mostrar "Comisionar" según el rol de quien mira,
// sin repetir el if/else en cada pantalla. ROL1 comisiona directo desde
// "Registrado" (sin turnado de por medio). ROL2 solo puede comisionar desde
// el Turnado que le fue asignado a él específicamente — por eso recibe el
// `turnado` de esta pantalla, no basta con el estatus del FUS: el backend
// exige tanto fus.estatusParticular === 'Turnado' (evita pisarse con otro
// titular que ya haya comisionado el mismo FUS) como que ESE turnado siga
// "Recibido".
export const puedeComisionar = (user, fus, turnado = null) => {
  if (!fus) return false
  if (user?.rol === 'ROL1') return fus.estatusParticular === 'Registrado'
  if (user?.rol === 'ROL2') return fus.estatusParticular === 'Turnado' && turnado?.estatusTitular === 'Recibido'
  return false
}
