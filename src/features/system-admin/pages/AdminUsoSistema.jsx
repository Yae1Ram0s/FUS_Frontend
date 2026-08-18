import { useState } from 'react'
import AppLayout from '../../../components/AppLayout'
import Spinner from '../../../components/Spinner'
import { mensajeErrorAnalitica } from '../api/analiticaApi'
import useAnaliticaSistema from '../hooks/useAnaliticaSistema'
import {
  AnaliticaKpi,
  DefinicionesUso,
  DistribucionSegmentos,
  EmbudosUso,
  EstadoVacio,
  OportunidadesUso,
  RankingModulos,
  TablaAcciones,
  TendenciaUso,
} from '../components/AnaliticaUso'
import { formatearDuracion, formatearNumero } from '../utils/formatAnalitica'
import '../styles/SystemAdmin.css'
import '../styles/UsoSistema.css'

const FILTROS_INICIALES = {
  dias: 30,
  rol: '',
  unidad: '',
  dispositivo: '',
  modulo: '',
}

function fechaLegible(valor, opciones = {}) {
  if (!valor) return 'Sin información'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return 'Sin información'
  return fecha.toLocaleString('es-MX', opciones)
}

function SelectorFiltro({ id, label, valor, opciones, onChange, todos }) {
  return (
    <label className="sau-filter" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={valor} onChange={event => onChange(event.target.value)}>
        <option value="">{todos}</option>
        {opciones.map(item => <option key={item.valor} value={item.valor}>{item.etiqueta}</option>)}
      </select>
    </label>
  )
}

export default function AdminUsoSistema() {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const { data, loading, initialLoading, error, reload } = useAnaliticaSistema(filtros)
  const resultado = data || {}
  const kpis = resultado.kpis || {}
  const cobertura = resultado.cobertura || {}
  const catalogos = resultado.filtros || {}
  const cambiarFiltro = (clave, valor) => setFiltros(actuales => ({ ...actuales, [clave]: valor }))
  const hayFiltros = Object.entries(filtros).some(([clave, valor]) => clave !== 'dias' && valor)
  const hayActividad = Boolean(kpis.usuariosActivos || kpis.sesiones || kpis.accionesSignificativas || resultado.serie?.length)
  const coberturaPct = cobertura.diasEsperados
    ? Math.min(100, Math.round((cobertura.diasConDatos / cobertura.diasEsperados) * 100))
    : 0
  const sesionesIdentificadasPct = cobertura.sesionesTotales
    ? Math.min(100, Math.round((cobertura.sesionesConUsuario / cobertura.sesionesTotales) * 100))
    : 0

  return (
    <AppLayout mainClass="sa-main sau-main app-main-scroll">
      <div className="sa-page sau-page" aria-busy={loading}>
        <header className="sa-heading sau-heading">
          <div>
            <div className="sau-eyebrow"><span aria-hidden="true">◎</span> Analítica de producto</div>
            <h1>Uso del sistema</h1>
            <p>Entiende qué módulos generan valor, dónde se detienen los procesos y qué conviene mejorar.</p>
            <small className="sa-freshness">
              <span /> Actualización automática · {fechaLegible(resultado.generadoEn, { hour: '2-digit', minute: '2-digit' })}
            </small>
          </div>
          <div className="sau-heading-actions">
            <div className="sau-period" aria-label="Periodo de análisis">
              {[7, 30, 90].map(dias => (
                <button
                  type="button"
                  key={dias}
                  className={filtros.dias === dias ? 'is-active' : ''}
                  aria-pressed={filtros.dias === dias}
                  onClick={() => cambiarFiltro('dias', dias)}
                >
                  {dias} días
                </button>
              ))}
            </div>
            <button className="sau-refresh" type="button" onClick={reload} disabled={loading}>
              <span aria-hidden="true">↻</span> {loading ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </header>

        <section className="sau-filters" aria-labelledby="sau-filters-title">
          <div className="sau-filters__intro">
            <strong id="sau-filters-title">Segmentar métricas</strong>
            <small>Los filtros se aplican a toda la vista.</small>
          </div>
          <SelectorFiltro id="sau-rol" label="Rol" valor={filtros.rol} opciones={catalogos.roles || []} todos="Todos los roles" onChange={valor => cambiarFiltro('rol', valor)} />
          <SelectorFiltro id="sau-unidad" label="Unidad" valor={filtros.unidad} opciones={catalogos.unidades || []} todos="Todas las unidades" onChange={valor => cambiarFiltro('unidad', valor)} />
          <SelectorFiltro id="sau-dispositivo" label="Dispositivo" valor={filtros.dispositivo} opciones={catalogos.dispositivos || []} todos="Todos" onChange={valor => cambiarFiltro('dispositivo', valor)} />
          <SelectorFiltro id="sau-modulo" label="Módulo" valor={filtros.modulo} opciones={catalogos.modulos || []} todos="Todos los módulos" onChange={valor => cambiarFiltro('modulo', valor)} />
          {hayFiltros && <button className="sau-clear" type="button" onClick={() => setFiltros(actual => ({ ...FILTROS_INICIALES, dias: actual.dias }))}>Limpiar filtros</button>}
        </section>

        {error && (
          <div className="sa-error sau-error" role="alert">
            <div><strong>No pudimos cargar la analítica</strong><p>{mensajeErrorAnalitica(error)}</p></div>
            <button type="button" onClick={reload}>Reintentar</button>
          </div>
        )}

        {initialLoading && !data ? (
          <div className="sau-loading" role="status" aria-live="polite"><Spinner overlay={false} /><span>Cargando métricas de uso…</span></div>
        ) : data ? (
          <>
            {!hayActividad && (
              <div className="sau-no-data-banner" role="status">
                <span aria-hidden="true">◇</span>
                <div><strong>Sin actividad en esta selección</strong><p>Amplía el periodo o limpia los filtros. La instrumentación puede tardar en construir su primera línea base.</p></div>
              </div>
            )}

            <section className="sau-kpis" aria-label="Indicadores principales de uso">
              <AnaliticaKpi etiqueta="Usuarios activos" valor={formatearNumero(kpis.usuariosActivos)} ayuda={`En ${resultado.ventana?.dias || filtros.dias} días`} />
              <AnaliticaKpi etiqueta="Sesiones" valor={formatearNumero(kpis.sesiones)} ayuda="Sesiones con actividad útil" tono="azul" />
              <AnaliticaKpi etiqueta="Módulos usados" valor={formatearNumero(kpis.modulosUsados)} ayuda="Con al menos una acción" tono="azul" />
              <AnaliticaKpi etiqueta="Acciones significativas" valor={formatearNumero(kpis.accionesSignificativas)} ayuda="No incluye clics decorativos" tono="dorado" />
            </section>

            <section className="sau-health-strip" aria-label="Indicadores de desempeño">
              <div><span>Finalización exitosa</span><strong className="is-good">{formatearNumero(kpis.tasaExito)}%</strong></div>
              <div><span>Errores</span><strong className={kpis.tasaError > 10 ? 'is-alert' : ''}>{formatearNumero(kpis.tasaError)}%</strong></div>
              <div><span>Abandono</span><strong className={kpis.tasaAbandono > 20 ? 'is-alert' : ''}>{formatearNumero(kpis.tasaAbandono)}%</strong></div>
              <div><span>Tiempo para completar</span><strong>{formatearDuracion(kpis.duracionMedianaMs)}</strong></div>
            </section>

            <div className="sau-grid sau-grid--overview">
              <section className="sa-panel sau-panel sau-panel--trend">
                <div className="sau-panel-heading">
                  <div><span className="sau-section-number">01</span><h2>Tendencia de adopción</h2><p>Usuarios activos y acciones útiles por día.</p></div>
                  <span className="sau-insight-chip">{resultado.ventana?.dias || filtros.dias} días</span>
                </div>
                <TendenciaUso serie={resultado.serie} />
              </section>

              <section className="sa-panel sau-panel">
                <div className="sau-panel-heading">
                  <div><span className="sau-section-number">02</span><h2>Módulos que generan valor</h2><p>Ordenados por usuarios únicos, acompañados de acciones significativas.</p></div>
                </div>
                <RankingModulos modulos={resultado.modulos} />
              </section>
            </div>

            <section className="sa-panel sau-panel sau-panel--actions">
              <div className="sau-panel-heading">
                <div><span className="sau-section-number">03</span><h2>Componentes y acciones</h2><p>Uso efectivo, resultado y esfuerzo requerido por operación.</p></div>
              </div>
              <TablaAcciones acciones={resultado.acciones} />
            </section>

            {(resultado.roles?.length || resultado.dispositivos?.length) ? (
              <section className="sa-panel sau-panel sau-segments-panel">
                <div className="sau-panel-heading">
                  <div><span className="sau-section-number">04</span><h2>Quién usa el sistema</h2><p>Distribución para detectar necesidades por perfil y dispositivo.</p></div>
                </div>
                <div className="sau-segments">
                  <DistribucionSegmentos titulo="Uso por rol" datos={resultado.roles} />
                  <DistribucionSegmentos titulo="Uso por dispositivo" datos={resultado.dispositivos} />
                </div>
              </section>
            ) : null}

            <div className="sau-grid sau-grid--decisions">
              <section className="sa-panel sau-panel">
                <div className="sau-panel-heading">
                  <div><span className="sau-section-number">05</span><h2>Embudos de procesos</h2><p>Identifica el paso exacto donde los usuarios se detienen.</p></div>
                </div>
                <EmbudosUso embudos={resultado.embudos} />
              </section>
              <section className="sa-panel sau-panel">
                <div className="sau-panel-heading">
                  <div><span className="sau-section-number">06</span><h2>Oportunidades priorizadas</h2><p>Hallazgos traducidos en siguientes pasos accionables.</p></div>
                </div>
                <OportunidadesUso oportunidades={resultado.oportunidades} />
              </section>
            </div>

            <section className="sa-panel sau-panel sau-quality" aria-labelledby="sau-quality-title">
              <div className="sau-panel-heading">
                <div><span className="sau-section-number">07</span><h2 id="sau-quality-title">Calidad y cobertura</h2><p>Contexto necesario para interpretar las métricas con confianza.</p></div>
                <span className={`sau-quality-state sau-quality-state--${cobertura.estado}`}>{cobertura.estado.replaceAll('_', ' ')}</span>
              </div>
              <div className="sau-quality__grid">
                <div><span>Cobertura temporal</span><strong>{coberturaPct}%</strong><small>{cobertura.diasConDatos || 0} de {cobertura.diasEsperados || resultado.ventana?.dias || 0} días con datos</small></div>
                <div><span>Eventos válidos</span><strong>{formatearNumero(cobertura.eventosValidos)}</strong><small>{formatearNumero(cobertura.eventosDescartados)} descartados por calidad</small></div>
                <div><span>Sesiones identificadas</span><strong>{sesionesIdentificadasPct}%</strong><small>{formatearNumero(cobertura.sesionesConUsuario)} de {formatearNumero(cobertura.sesionesTotales)}</small></div>
                <div><span>Ventana observada</span><strong>{resultado.ventana?.dias || filtros.dias} días</strong><small>{fechaLegible(resultado.ventana?.desde, { day: '2-digit', month: 'short' })} — {fechaLegible(resultado.ventana?.hasta, { day: '2-digit', month: 'short' })}</small></div>
                <div><span>Frescura</span><strong>{resultado.generadoEn ? 'Actualizada' : 'Sin sincronizar'}</strong><small>{fechaLegible(resultado.generadoEn)}</small></div>
              </div>
              <DefinicionesUso definiciones={resultado.definiciones} />
            </section>
          </>
        ) : !error ? <EstadoVacio /> : null}
      </div>
    </AppLayout>
  )
}
