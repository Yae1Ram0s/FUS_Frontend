from pathlib import Path

## Objetivo
Trabaja con el mínimo contexto posible. Prioriza cambios pequeños, dirigidos y fáciles de verificar.

## Stack
- React 19
- Vite 8
- React Router
- Axios
- Recharts
- ESLint
- Playwright E2E

## Comandos
- Desarrollo: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- E2E: `npm run test:e2e`

## Mapa del proyecto
- `src/api/` — cliente y llamadas al backend
- `src/components/` — componentes reutilizables
- `src/context/` — estado/contextos globales
- `src/hooks/` — hooks personalizados
- `src/pages/` — pantallas/rutas principales
- `src/styles/` — estilos compartidos
- `src/utils/` — utilidades
- `src/App.jsx` — composición/rutas principales
- `src/main.jsx` — entrada de la aplicación
- `tests/e2e/` — pruebas Playwright
- `public/` y `src/assets/` — recursos estáticos

## Reglas para ahorrar tokens
- NO leas todo `src/`.
- Empieza buscando el nombre de la página, componente, ruta, endpoint o texto mencionado por el usuario.
- Abre primero el archivo exacto encontrado y solo sus imports directos si son necesarios.
- No vuelvas a leer archivos ya inspeccionados salvo que hayan cambiado.
- No inspecciones `node_modules/`, `dist/`, `.git/`, `coverage/` ni archivos generados.
- Si el cambio es de una página, revisa primero `src/pages/<Página>.jsx` y su CSS asociado.
- Si el problema es de API, revisa primero `src/api/` y luego únicamente el componente que consume esa llamada.
- Si el problema es de navegación, revisa primero `src/App.jsx`.
- Si es un estilo visual, evita recorrer lógica de negocio.
- No hagas refactors, renombres o limpiezas fuera de la tarea.
- No agregues dependencias si puede resolverse con las existentes.

## Convenciones de edición
- Mantén JavaScript/JSX; no migres a TypeScript.
- Conserva el patrón y estilo existente del archivo.
- Prefiere componentes pequeños y reutilización de componentes ya existentes.
- No dupliques llamadas Axios si ya existe una función equivalente en `src/api/`.
- No cambies contratos con el backend sin revisar primero el endpoint correspondiente.
- Conserva compatibilidad con React Router actual.

## Verificación
- Cambio de JSX/CSS pequeño: ejecuta primero `npm run lint`.
- Cambio que afecta build/imports: `npm run build`.
- Flujo de usuario importante: ejecuta solo la prueba Playwright relacionada si existe.
- No ejecutes E2E completo por defecto.
- Si una verificación falla por algo preexistente y no relacionado, indícalo y no arregles código ajeno a la tarea.

## Respuesta final
Sé breve. Usa:
- `Hecho:` qué cambió.
- `Archivos:` archivos modificados.
- `Verificación:` comando y resultado.

No expliques razonamiento interno ni repitas el diff completo.
"""
base = Path("/mnt/data")
(base/"CLAUDE_FUS_Frontend.md").write_text(frontend, encoding="utf-8")
(base/"CLAUDE_FUS_Backend.md").write_text(backend, encoding="utf-8")

print(base/"CLAUDE_FUS_Frontend.md")
print(base/"CLAUDE_FUS_Backend.md")