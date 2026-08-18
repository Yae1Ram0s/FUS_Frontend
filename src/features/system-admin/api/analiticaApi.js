import api from '../../../api/api'

const numero = (valor, respaldo = 0) => {
  const convertido = Number(valor)
  return Number.isFinite(convertido) ? convertido : respaldo
}

const texto = (valor, respaldo = '') => {
  if (valor === null || valor === undefined) return respaldo
  return String(valor)
}

const lista = valor => Array.isArray(valor) ? valor : []

const opcion = (valor, indice) => {
  if (valor && typeof valor === 'object') {
    const id = valor.valor ?? valor.value ?? valor.id ?? valor.codigo ?? valor.nombre ?? indice
    return {
      valor: texto(id),
      etiqueta: texto(valor.etiqueta ?? valor.label ?? valor.nombre ?? valor.descripcion ?? id),
    }
  }
  return { valor: texto(valor), etiqueta: texto(valor) }
}

const catalogo = valor => lista(valor)
  .map(opcion)
  .filter(item => item.valor && item.etiqueta)

const porcentaje = valor => Math.min(100, Math.max(0, numero(valor)))

const etiquetaFecha = valor => {
  const partes = texto(valor).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return partes ? `${partes[3]}/${partes[2]}` : texto(valor)
}

const duracionOpcional = item => {
  const valor = item?.duracionMedianaMs ?? item?.duracionMs
  return valor === null || valor === undefined ? null : numero(valor)
}

const normalizarSerie = valor => lista(valor).map((item, indice) => ({
  fecha: texto(item?.fecha ?? item?.dia ?? item?.periodo ?? indice),
  etiqueta: texto(item?.etiqueta ?? item?.label ?? etiquetaFecha(item?.fecha ?? item?.dia) ?? indice),
  usuariosActivos: numero(item?.usuariosActivos ?? item?.usuarios ?? item?.usuariosUnicos),
  sesiones: numero(item?.sesiones),
  accionesSignificativas: numero(item?.accionesSignificativas ?? item?.acciones ?? item?.eventos),
  errores: numero(item?.errores ?? item?.accionesError),
}))

const normalizarModulos = valor => lista(valor).map((item, indice) => ({
  id: texto(item?.id ?? item?.modulo ?? item?.codigo ?? indice),
  nombre: texto(item?.nombre ?? item?.etiqueta ?? item?.modulo ?? 'Módulo sin nombre'),
  usuariosUnicos: numero(item?.usuariosUnicos ?? item?.usuarios),
  accionesSignificativas: numero(item?.accionesSignificativas ?? item?.acciones ?? item?.total),
  sesiones: numero(item?.sesiones),
  tasaExito: porcentaje(item?.tasaExito),
  tasaError: porcentaje(item?.tasaError),
  tasaAbandono: porcentaje(item?.tasaAbandono),
  duracionMedianaMs: numero(item?.duracionMedianaMs ?? item?.duracionMs),
}))

const normalizarAcciones = valor => lista(valor).map((item, indice) => ({
  id: texto(item?.id ?? item?.accion ?? item?.componente ?? item?.codigo ?? indice),
  nombre: texto(item?.nombre ?? item?.etiqueta ?? item?.accion ?? item?.componente ?? 'Acción sin nombre'),
  modulo: texto(item?.modulo ?? item?.moduloNombre ?? '—'),
  usuariosUnicos: numero(item?.usuariosUnicos ?? item?.usuarios),
  total: numero(item?.total ?? item?.eventos ?? item?.accionesSignificativas ?? item?.acciones),
  tasaExito: item?.tasaExito === null || item?.tasaExito === undefined ? null : porcentaje(item.tasaExito),
  tasaError: item?.tasaError === null || item?.tasaError === undefined ? null : porcentaje(item.tasaError),
  duracionMedianaMs: duracionOpcional(item),
}))

const normalizarSegmentos = valor => lista(valor).map((item, indice) => ({
  id: texto(item?.id ?? item?.codigo ?? item?.nombre ?? indice),
  nombre: texto(item?.nombre ?? item?.etiqueta ?? item?.rol ?? item?.dispositivo ?? 'Sin identificar'),
  usuariosUnicos: numero(item?.usuariosUnicos ?? item?.usuarios),
  accionesSignificativas: numero(item?.accionesSignificativas ?? item?.acciones ?? item?.total),
  porcentaje: porcentaje(item?.porcentaje ?? item?.participacionPct),
}))

const normalizarEmbudos = valor => lista(valor).map((item, indice) => ({
  id: texto(item?.id ?? item?.codigo ?? indice),
  nombre: texto(item?.nombre ?? item?.etiqueta ?? item?.tipo ?? 'Proceso'),
  modulo: texto(item?.modulo ?? ''),
  conversionPct: porcentaje(item?.conversionPct ?? item?.tasaConversion),
  pasos: lista(item?.pasos).map((paso, pasoIndice) => ({
    id: texto(paso?.id ?? paso?.codigo ?? pasoIndice),
    nombre: texto(paso?.nombre ?? paso?.etiqueta ?? paso?.evento ?? `Paso ${pasoIndice + 1}`),
    usuarios: numero(paso?.usuarios ?? paso?.usuariosUnicos ?? paso?.sesiones ?? paso?.total),
    conversionPct: porcentaje(paso?.conversionPct ?? paso?.conversionDesdeInicio ?? paso?.conversion ?? paso?.porcentaje),
    abandonoPct: porcentaje(paso?.abandonoPct ?? paso?.abandono),
  })),
}))

const prioridadValida = valor => {
  const normalizada = texto(valor, 'media').toLowerCase()
  return ['critica', 'alta', 'media', 'baja'].includes(normalizada) ? normalizada : 'media'
}

const tituloOportunidad = item => {
  const porTipo = {
    ERRORES: 'Errores frecuentes',
    ABANDONO: 'Abandono elevado',
    DURACION: 'Proceso con duración elevada',
  }
  return texto(item?.titulo ?? item?.nombre ?? porTipo[item?.tipo] ?? item?.tipo ?? 'Oportunidad de mejora')
}

const normalizarOportunidades = valor => lista(valor).map((item, indice) => ({
  id: texto(item?.id ?? item?.codigo ?? indice),
  titulo: tituloOportunidad(item),
  detalle: texto(item?.detalle ?? item?.descripcion ?? item?.hallazgo),
  recomendacion: texto(item?.recomendacion ?? item?.accionSugerida),
  modulo: texto(item?.modulo ?? 'General'),
  prioridad: prioridadValida(item?.prioridad),
  metrica: typeof item?.metrica === 'string' ? item.metrica : texto(item?.nombreMetrica ?? 'Valor observado'),
  valor: item?.valor ?? item?.valorMetrica ?? (typeof item?.metrica === 'number' ? item.metrica : null),
}))

const normalizarDefiniciones = valor => {
  if (Array.isArray(valor)) {
    return valor.map((item, indice) => ({
      id: texto(item?.id ?? item?.clave ?? indice),
      termino: texto(item?.termino ?? item?.nombre ?? item?.clave ?? 'Métrica'),
      descripcion: texto(item?.descripcion ?? item?.definicion ?? item?.detalle),
    }))
  }
  if (!valor || typeof valor !== 'object') return []
  return Object.entries(valor).map(([termino, descripcion]) => ({
    id: termino,
    termino,
    descripcion: texto(descripcion?.descripcion ?? descripcion?.definicion ?? descripcion),
  }))
}

export function normalizarResumenAnalitica(respuesta = {}) {
  const fuente = respuesta && typeof respuesta === 'object' ? respuesta : {}
  const kpis = fuente.kpis && typeof fuente.kpis === 'object' ? fuente.kpis : {}
  const ventana = fuente.ventana && typeof fuente.ventana === 'object' ? fuente.ventana : {}
  const cobertura = fuente.cobertura && typeof fuente.cobertura === 'object' ? fuente.cobertura : {}
  const filtros = fuente.filtros && typeof fuente.filtros === 'object' ? fuente.filtros : {}
  const opcionesFiltro = filtros.opciones && typeof filtros.opciones === 'object' ? filtros.opciones : filtros

  return {
    generadoEn: fuente.generadoEn ?? null,
    ventana: {
      dias: numero(ventana.dias ?? fuente.dias, 30),
      desde: ventana.desde ?? null,
      hasta: ventana.hasta ?? null,
    },
    cobertura: {
      inicio: cobertura.inicio ?? cobertura.desde ?? null,
      fin: cobertura.fin ?? cobertura.hasta ?? null,
      diasConDatos: numero(cobertura.diasConDatos),
      diasEsperados: numero(cobertura.diasEsperados ?? ventana.dias),
      eventosValidos: numero(cobertura.eventosValidos ?? cobertura.eventos),
      eventosDescartados: numero(cobertura.eventosDescartados),
      sesionesConUsuario: numero(cobertura.sesionesConUsuario),
      sesionesTotales: numero(cobertura.sesionesTotales),
      estado: texto(cobertura.estado ?? cobertura.calidad ?? 'sin_datos'),
    },
    kpis: {
      usuariosActivos: numero(kpis.usuariosActivos),
      sesiones: numero(kpis.sesiones),
      modulosUsados: numero(kpis.modulosUsados),
      accionesSignificativas: numero(kpis.accionesSignificativas),
      tasaExito: porcentaje(kpis.tasaExito),
      tasaError: porcentaje(kpis.tasaError),
      tasaAbandono: porcentaje(kpis.tasaAbandono),
      duracionMedianaMs: numero(kpis.duracionMedianaMs),
    },
    serie: normalizarSerie(fuente.serie ?? fuente.serieDiaria),
    modulos: normalizarModulos(fuente.modulos),
    acciones: normalizarAcciones([...lista(fuente.componentes), ...lista(fuente.acciones)]),
    roles: normalizarSegmentos(fuente.roles),
    dispositivos: normalizarSegmentos(fuente.dispositivos),
    embudos: normalizarEmbudos(fuente.embudos),
    oportunidades: normalizarOportunidades(fuente.oportunidades),
    filtros: {
      roles: catalogo(opcionesFiltro.roles ?? fuente.catalogos?.roles),
      unidades: catalogo(opcionesFiltro.unidades ?? opcionesFiltro.unidadesAdministrativas ?? fuente.catalogos?.unidades),
      dispositivos: catalogo(opcionesFiltro.dispositivos ?? fuente.catalogos?.dispositivos),
      modulos: catalogo(opcionesFiltro.modulos ?? fuente.catalogos?.modulos),
    },
    definiciones: normalizarDefiniciones(fuente.definiciones),
  }
}

export async function obtenerResumenAnalitica(params = {}, { signal } = {}) {
  const filtros = Object.fromEntries(
    Object.entries(params).filter(([, valor]) => valor !== '' && valor !== null && valor !== undefined)
  )
  const { data } = await api.get('/analitica/admin/resumen/', { params: filtros, signal })
  return normalizarResumenAnalitica(data)
}

export function mensajeErrorAnalitica(error) {
  const status = error?.response?.status
  const detalle = error?.response?.data?.detail || error?.response?.data?.mensaje
  if (detalle) return detalle
  if (status === 403) return 'No tienes permisos para consultar las métricas de uso.'
  if (status === 404) return 'La analítica de uso todavía no está disponible en este entorno.'
  if (status === 503) return 'La analítica no está disponible temporalmente.'
  return 'No fue posible cargar las métricas. Revisa tu conexión e intenta nuevamente.'
}
