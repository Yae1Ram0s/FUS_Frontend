import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const fecha = value => new Date(`${value}T00:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })

export function GraficaTendenciaSupervision({ serie = [] }) {
  const data = serie.map(item => ({ ...item, etiqueta: fecha(item.fecha) }))
  return <ResponsiveContainer width="100%" height={300}><AreaChart data={data} margin={{ top: 12, right: 12, left: -18, bottom: 4 }}><defs><linearGradient id="adminIngresos" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#20856b" stopOpacity=".42"/><stop offset="100%" stopColor="#20856b" stopOpacity=".03"/></linearGradient><linearGradient id="adminAcciones" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#bc955c" stopOpacity=".38"/><stop offset="100%" stopColor="#bc955c" stopOpacity=".03"/></linearGradient></defs><CartesianGrid vertical={false} stroke="#dce7e3" strokeDasharray="4 4"/><XAxis dataKey="etiqueta" axisLine={false} tickLine={false} minTickGap={24}/><YAxis axisLine={false} tickLine={false} allowDecimals={false}/><Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.fecha}/><Legend/><Area type="monotone" dataKey="usuariosConUltimoIngreso" name="Usuarios con último ingreso" stroke="#16745d" fill="url(#adminIngresos)" strokeWidth={3}/><Area type="monotone" dataKey="accionesAdministrativas" name="Acciones administrativas" stroke="#a97b36" fill="url(#adminAcciones)" strokeWidth={3}/></AreaChart></ResponsiveContainer>
}

export function GraficaDistribucion({ datos = [], dataKey = 'total', nameKey = 'nombre', nombre = 'Usuarios' }) {
  return <ResponsiveContainer width="100%" height={280}><BarChart data={datos} layout="vertical" margin={{ top: 5, right: 24, left: 18, bottom: 5 }}><CartesianGrid horizontal={false} stroke="#e2e9e6"/><XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false}/><YAxis dataKey={nameKey} type="category" width={125} axisLine={false} tickLine={false} tick={{ fontSize: 11 }}/><Tooltip/><Bar dataKey={dataKey} name={nombre} fill="#1f6452" radius={[0, 9, 9, 0]}/></BarChart></ResponsiveContainer>
}
