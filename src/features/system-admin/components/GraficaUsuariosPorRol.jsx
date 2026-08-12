import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const ROL_LABELS_CORTOS = {
  ROL1: 'Particular',
  ROL2: 'Titular',
  COMISIONADO: 'Comisionado',
  EQUIPO_PARTICULAR: 'Equipo particular',
  ADMIN: 'Administrador',
}

export default function GraficaUsuariosPorRol({ porRol = {} }) {
  const data = Object.entries(ROL_LABELS_CORTOS).map(([rol, label]) => ({ rol: label, valor: porRol[rol] || 0 }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 8 }}>
        <CartesianGrid vertical={false} stroke="#f0f0f2" />
        <XAxis dataKey="rol" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={46} />
        <YAxis tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="valor" name="Usuarios activos" fill="#1F5647" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
