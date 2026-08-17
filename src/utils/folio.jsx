import { Fragment } from 'react'

// Inserta un punto de corte explícito (<wbr>) después de cada "/" del
// folio — sin esto, el navegador no siempre rompe la línea justo ahí (la
// regla de Unicode que evita partir un "/" pegado al dígito que sigue) y
// termina partiendo el año a la mitad (ej. "2026" → "20" + "26") en vez de
// bajar el año completo a la siguiente línea.
export function FolioTexto({ folio }) {
  const partes = (folio || '').split('/')
  return partes.map((parte, i) => (
    <Fragment key={i}>
      {i > 0 && '/'}
      {i > 0 && <wbr />}
      {parte}
    </Fragment>
  ))
}
