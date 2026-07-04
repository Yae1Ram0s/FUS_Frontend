import './Spinner.css'

/* overlay=true (default): bloquea el panel/formulario contenedor mientras carga.
   overlay=false: se muestra en el flujo normal, en el lugar de un texto "Cargando…". */
export default function Spinner({ label, overlay = true }) {
  const dominoes = (
    <div className="spinner">
      <span /><span /><span /><span />
      <span /><span /><span /><span />
    </div>
  )

  return (
    <div className={overlay ? 'spinner-overlay' : 'spinner-inline'}>
      {dominoes}
      {label && <span className="spinner-label">{label}</span>}
    </div>
  )
}
