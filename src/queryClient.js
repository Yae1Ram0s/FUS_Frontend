import { QueryClient } from '@tanstack/react-query'

// staleTime de 30s: al volver a una pantalla ya visitada hace poco, se
// muestra el dato en caché al instante (sin spinner) y se revalida en
// segundo plano en vez de repetir el fetch completo desde cero — mismo
// espíritu que el patrón "refrescando sin pantalla en blanco" que ya usan
// Bitácora/Reportes en este proyecto, ahora aplicado de forma general.
// retry: 1 (no el 3 por defecto de la librería) para no insistir tanto
// contra un backend caído — mismo criterio que useAsyncResource.js.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})
