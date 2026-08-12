const etiquetas = { operativo: 'Operativo', advertencia: 'Advertencia', error: 'Error', sin_comprobar: 'Sin comprobar' }
export default function EstadoServicio({ nombre, estado = 'sin_comprobar', detalle, latencia }) {
  const clave = String(estado || 'sin_comprobar').toLowerCase().replaceAll(' ', '_')
  return <article className="sa-service"><span className={`sa-status-dot sa-status-dot--${clave}`} aria-hidden="true"/><div><strong>{nombre}</strong><small>{detalle || 'Sin información disponible'}</small></div><span className={`sa-badge sa-badge--${clave}`}>{etiquetas[clave] || estado}</span>{latencia != null && <small className="sa-service__latency">{latencia} ms</small>}</article>
}
