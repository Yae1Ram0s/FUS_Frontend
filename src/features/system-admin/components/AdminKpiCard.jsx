export default function AdminKpiCard({ titulo, valor = 0, ayuda, tono = 'verde' }) {
  return <article className={`sa-kpi sa-kpi--${tono}`}><span className="sa-kpi__icon" aria-hidden="true">{titulo?.slice(0, 1)}</span><p>{titulo}</p><strong>{valor ?? 0}</strong>{ayuda && <small>{ayuda}</small>}</article>
}
