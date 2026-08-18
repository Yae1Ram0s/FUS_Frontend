import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatearDuracion, formatearNumero } from '../utils/formatAnalitica'

export function AnaliticaKpi({ etiqueta, valor, ayuda, tono = 'verde' }) {
  return (
    <article className={`sau-kpi sau-kpi--${tono}`}>
      <span className="sau-kpi__dot" aria-hidden="true" />
      <p>{etiqueta}</p>
      <strong>{valor}</strong>
      {ayuda && <small>{ayuda}</small>}
    </article>
  )
}

export function EstadoVacio({ titulo = 'Aún no hay información', detalle }) {
  return (
    <div className="sau-empty" role="status">
      <span aria-hidden="true">◇</span>
      <strong>{titulo}</strong>
      {detalle && <p>{detalle}</p>}
    </div>
  )
}

export function TendenciaUso({ serie = [] }) {
  if (!serie.length) {
    return <EstadoVacio detalle="La tendencia aparecerá cuando se registren eventos dentro del periodo seleccionado." />
  }

  const totalUsuarios = serie.reduce((suma, item) => suma + item.usuariosActivos, 0)
  const totalAcciones = serie.reduce((suma, item) => suma + item.accionesSignificativas, 0)

  return (
    <div className="sau-chart" role="img" aria-label={`Tendencia con ${formatearNumero(totalUsuarios)} usuarios activos diarios acumulados y ${formatearNumero(totalAcciones)} acciones significativas.`}>
      <ResponsiveContainer width="100%" height={310}>
        <AreaChart data={serie} margin={{ top: 12, right: 8, left: -18, bottom: 2 }}>
          <defs>
            <linearGradient id="sauUsuarios" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1c7a61" stopOpacity=".38" />
              <stop offset="100%" stopColor="#1c7a61" stopOpacity=".02" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#dce7e3" strokeDasharray="4 5" />
          <XAxis dataKey="etiqueta" axisLine={false} tickLine={false} minTickGap={25} tick={{ fill: '#687d76', fontSize: 11 }} />
          <YAxis yAxisId="usuarios" axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: '#687d76', fontSize: 11 }} />
          <YAxis yAxisId="acciones" orientation="right" axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: '#8a6b37', fontSize: 11 }} />
          <Tooltip
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fecha || ''}
            contentStyle={{ borderRadius: 16, border: '1px solid rgba(31,86,71,.14)', boxShadow: '0 12px 30px rgba(18,55,46,.12)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Area yAxisId="usuarios" type="monotone" dataKey="usuariosActivos" name="Usuarios activos" stroke="#17664f" strokeWidth={3} fill="url(#sauUsuarios)" />
          <Line yAxisId="acciones" type="monotone" dataKey="accionesSignificativas" name="Acciones significativas" stroke="#b8873d" strokeWidth={2.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RankingModulos({ modulos = [] }) {
  if (!modulos.length) {
    return <EstadoVacio detalle="No hay módulos con actividad para esta combinación de filtros." />
  }
  const maxUsuarios = Math.max(...modulos.map(item => item.usuariosUnicos), 1)

  return (
    <ol className="sau-ranking">
      {modulos.map((item, indice) => (
        <li key={`${item.id}-${indice}`}>
          <div className="sau-ranking__position" aria-label={`Posición ${indice + 1}`}>{indice + 1}</div>
          <div className="sau-ranking__body">
            <div className="sau-ranking__heading">
              <strong>{item.nombre}</strong>
              <span>{formatearNumero(item.usuariosUnicos)} usuarios únicos</span>
            </div>
            <div className="sau-progress" aria-hidden="true">
              <span style={{ width: `${(item.usuariosUnicos / maxUsuarios) * 100}%` }} />
            </div>
            <div className="sau-ranking__metrics">
              <span><b>{formatearNumero(item.accionesSignificativas)}</b> acciones útiles</span>
              <span><b>{formatearNumero(item.tasaExito)}%</b> éxito</span>
              <span><b>{formatearNumero(item.tasaAbandono)}%</b> abandono</span>
              <span><b>{formatearDuracion(item.duracionMedianaMs)}</b> mediana</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function TablaAcciones({ acciones = [] }) {
  if (!acciones.length) {
    return <EstadoVacio detalle="Todavía no se registran acciones significativas para estos filtros." />
  }

  return (
    <div className="sau-table-wrap">
      <table className="sau-table">
        <thead>
          <tr>
            <th>Componente o acción</th>
            <th>Módulo</th>
            <th>Usuarios</th>
            <th>Acciones</th>
            <th>Éxito</th>
            <th>Tiempo mediano</th>
          </tr>
        </thead>
        <tbody>
          {acciones.map((item, indice) => (
            <tr key={`${item.id}-${indice}`}>
              <td data-label="Acción"><strong>{item.nombre}</strong></td>
              <td data-label="Módulo">{item.modulo}</td>
              <td data-label="Usuarios">{formatearNumero(item.usuariosUnicos)}</td>
              <td data-label="Acciones">{formatearNumero(item.total)}</td>
              <td data-label="Éxito">{item.tasaExito === null ? '—' : <span className={`sau-rate ${item.tasaExito < 70 ? 'is-low' : ''}`}>{formatearNumero(item.tasaExito)}%</span>}</td>
              <td data-label="Tiempo mediano">{item.duracionMedianaMs === null ? '—' : formatearDuracion(item.duracionMedianaMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DistribucionSegmentos({ titulo, datos = [] }) {
  const conDatos = datos.filter(item => item.usuariosUnicos || item.accionesSignificativas || item.porcentaje)
  if (!conDatos.length) return null
  const maximo = Math.max(...conDatos.map(item => item.usuariosUnicos || item.accionesSignificativas), 1)

  return (
    <div className="sau-segment">
      <h3>{titulo}</h3>
      <ul>
        {conDatos.slice(0, 6).map((item, indice) => {
          const magnitud = item.usuariosUnicos || item.accionesSignificativas
          return (
            <li key={`${item.id}-${indice}`}>
              <div><span>{item.nombre}</span><b>{item.porcentaje ? `${formatearNumero(item.porcentaje)}%` : formatearNumero(magnitud)}</b></div>
              <div className="sau-mini-bar" aria-hidden="true"><span style={{ width: `${(magnitud / maximo) * 100}%` }} /></div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function EmbudosUso({ embudos = [] }) {
  if (!embudos.length) {
    return <EstadoVacio detalle="Los embudos estarán disponibles cuando existan procesos instrumentados de inicio a fin." />
  }

  return (
    <div className="sau-funnels">
      {embudos.map((embudo, indice) => {
        const maximo = Math.max(...embudo.pasos.map(paso => paso.usuarios), 1)
        return (
          <article key={`${embudo.id}-${indice}`} className="sau-funnel">
            <header>
              <div><strong>{embudo.nombre}</strong>{embudo.modulo && <small>{embudo.modulo}</small>}</div>
              <span>{formatearNumero(embudo.conversionPct)}% conversión</span>
            </header>
            {embudo.pasos.length ? (
              <ol>
                {embudo.pasos.map((paso, pasoIndice) => (
                  <li key={`${paso.id}-${pasoIndice}`}>
                    <div className="sau-funnel__label"><span>{paso.nombre}</span><b>{formatearNumero(paso.usuarios)}</b></div>
                    <div className="sau-funnel__rail"><span style={{ width: `${Math.max(5, (paso.usuarios / maximo) * 100)}%` }} /></div>
                    <small>{formatearNumero(paso.conversionPct)}% continúa{paso.abandonoPct ? ` · ${formatearNumero(paso.abandonoPct)}% abandona` : ''}</small>
                  </li>
                ))}
              </ol>
            ) : <EstadoVacio titulo="Proceso sin pasos" />}
          </article>
        )
      })}
    </div>
  )
}

const prioridadLabel = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' }

export function OportunidadesUso({ oportunidades = [] }) {
  if (!oportunidades.length) {
    return <EstadoVacio titulo="Sin alertas prioritarias" detalle="No se detectaron oportunidades automáticas para esta ventana." />
  }

  return (
    <div className="sau-opportunities">
      {oportunidades.map((item, indice) => (
        <article key={`${item.id}-${indice}`} className={`sau-opportunity sau-opportunity--${item.prioridad}`}>
          <header><span>{prioridadLabel[item.prioridad]}</span><small>{item.modulo}</small></header>
          <h3>{item.titulo}</h3>
          {item.detalle && <p>{item.detalle}</p>}
          {(item.metrica || item.valor !== null) && <div className="sau-opportunity__metric"><span>{item.metrica || 'Valor observado'}</span><b>{String(item.valor ?? '—')}</b></div>}
          {item.recomendacion && <footer><strong>Siguiente paso</strong><p>{item.recomendacion}</p></footer>}
        </article>
      ))}
    </div>
  )
}

export function DefinicionesUso({ definiciones = [] }) {
  if (!definiciones.length) return null
  return (
    <details className="sau-definitions">
      <summary>Cómo se calculan estas métricas</summary>
      <dl>
        {definiciones.map((item, indice) => (
          <div key={`${item.id}-${indice}`}><dt>{item.termino}</dt><dd>{item.descripcion || 'Sin definición disponible.'}</dd></div>
        ))}
      </dl>
    </details>
  )
}
