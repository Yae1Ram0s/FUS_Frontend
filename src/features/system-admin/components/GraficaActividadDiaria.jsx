import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function formatFecha(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

export default function GraficaActividadDiaria({ serie = [] }) {
  const data = serie.map(p => ({ ...p, label: formatFecha(p.fecha) }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 8 }}>
        <CartesianGrid vertical={false} stroke="#f0f0f2" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.fecha} formatter={v => [v, 'Acciones']} />
        <Bar dataKey="total" name="Acciones" fill="#1F5647" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
