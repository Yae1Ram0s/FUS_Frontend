import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function formatFecha(iso) {
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function GraficaLatenciaBaseDatos({ historial = [] }) {
  const data = historial
    .filter(p => p.latenciaMs != null)
    .map(p => ({ label: formatFecha(p.fechaHora), latenciaMs: p.latenciaMs }))

  if (!data.length) {
    return <p className="sa-muted">Aún no hay suficiente historial — se acumula cada vez que corre `registrar_salud_sistema`.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 8 }}>
        <CartesianGrid vertical={false} stroke="#f0f0f2" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#86868b' }} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} unit=" ms" />
        <Tooltip formatter={v => [`${v} ms`, 'Latencia de base de datos']} />
        <Line type="monotone" dataKey="latenciaMs" stroke="#1F5647" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
