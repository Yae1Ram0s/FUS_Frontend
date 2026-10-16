import { useLayoutEffect } from 'react'
import { animate } from 'motion'

/* Coreografía de entrada para el contenido de cualquier módulo.

   En vez de envolver a mano cada tarjeta, tabla y panel de las ~20 pantallas,
   se observa el DOM del área principal y lo que aparece entra animado. Esto
   incluye lo que llega después de montar la pantalla (React Query), que un
   efecto de montaje no vería. Hay tres niveles:

   1. Contenido genérico (tarjetas, KPIs, paneles, filas, estados vacíos):
      fundido + ascenso escalonado.
   2. Panel de detalle del lado derecho (al seleccionar un FUS): se despliega
      con un recorte que se abre desde la lista, y por dentro encabezado,
      secciones, campos y botones entran en cascada.
   3. Microinteracciones: pulso al seleccionar una tarjeta de la lista y
      elevación al pasar el cursor.

   Reglas para no estorbar al CSS existente:
   - se omite todo elemento que ya tenga una animación/transform CSS propia;
   - no se anima un elemento dentro de otro que ya se está animando;
   - al terminar se limpian los estilos en línea, así no pisan lo que definen
     las hojas de estilo. */

const EXPO = [0.16, 1, 0.3, 1]
const REBOTE = [0.34, 1.56, 0.64, 1] // solo para el icono del estado vacío
const MAX_ESCALONADOS = 14
const MAX_POR_LOTE = 60
const PASO = 0.045

// Clases "de contenido": `*-card`, `*-kpi`, `*-panel`, `seccion`, etc.
const TOKEN_CONTENIDO = /^(?:[a-z0-9]+-)*(?:card|kpi\d?|panel|seccion|empty-state)$/
// Se excluyen superposiciones/piezas internas y los paneles de detalle, que
// tienen su propia coreografía (ver revelarDetalle).
const EXCLUIDOS = /^(?:login-card|modal-card|header-profile-card|notif-panel|perfil-modal|bita-modal-preview|detalle-panel|dt-panel)$/
const SELECTOR_DETALLE = '.detalle-panel, .dt-panel'
const SELECTOR_HINT = '.cfus-hint-select, .st-hint-select'
const SELECTOR_ELEVAR = '.fus-card, .kpi2-card, .stat-card, .dash2-card, .sa-kpi, .sau-kpi'

const reducirMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function esContenido(el) {
  if (el.nodeType !== 1 || el.dataset?.revelado) return false
  const esFila = el.tagName === 'TR' && el.parentElement?.tagName === 'TBODY'
  const esTarjeta = !esFila && [...el.classList].some(c => TOKEN_CONTENIDO.test(c) && !EXCLUIDOS.test(c))
  if (!esFila && !esTarjeta) return false
  if (el.closest('[data-sin-revelar]')) return false
  // Dentro de algo que ya se está revelando, o con animación/transform propios.
  if (el.parentElement?.closest('[data-revelado]')) return false
  const estilo = getComputedStyle(el)
  if (estilo.animationName !== 'none' || estilo.transform !== 'none') return false
  if (estilo.position === 'fixed' || estilo.display === 'none') return false
  return true
}

function limpiar(el) {
  ;['opacity', 'transform', 'filter', 'clip-path'].forEach(p => el.style.removeProperty(p))
  delete el.dataset.revelado
}

/* Anima `el` desde un estado oculto y limpia los estilos en línea al terminar.
   La opacidad se fija a 0 de inmediato: con `delay`, sin esto el elemento se
   vería completo hasta que arranca su animación. */
function entrar(el, keyframes, opciones) {
  el.dataset.revelado = '1'
  if (keyframes.opacity) el.style.opacity = '0'
  const controles = animate(el, keyframes, { ease: EXPO, ...opciones })
  // Un frame después: Motion confirma los valores finales justo al resolver, y
  // limpiar antes dejaba `opacity`, `filter` y `clip-path` pegados en línea.
  const fin = () => requestAnimationFrame(() => limpiar(el))
  controles.then(fin, fin)
}

function revelar(elementos) {
  elementos.slice(0, MAX_POR_LOTE).forEach((el, i) => {
    entrar(el, { opacity: [0, 1], y: [14, 0] }, { duration: 0.55, delay: Math.min(i, MAX_ESCALONADOS) * PASO })
  })
}

/* Panel de detalle: entra con un deslizamiento corto y un fundido, y sus
   bloques (encabezado, secciones, pie) se escalonan apenas después. Sobrio a
   propósito: sin desenfoque ni recortes, para que se sienta fluido y no
   distraiga. */
function revelarDetalle(panel) {
  entrar(panel, { opacity: [0, 1], x: [28, 0] }, { duration: 0.55 })

  const bloques = panel.querySelectorAll(':scope > .detalle-header, :scope > .det-section, :scope > .detalle-footer, :scope > .seccion')
  bloques.forEach((bloque, i) => {
    entrar(bloque, { opacity: [0, 1], y: [12, 0] }, { duration: 0.5, delay: 0.12 + Math.min(i, 8) * 0.05 })
  })
}

function revelarHint(el) {
  entrar(el, { opacity: [0, 1], y: [18, 0], filter: ['blur(8px)', 'blur(0px)'] }, { duration: 0.8 })
  const icono = el.querySelector('svg')
  if (icono) entrar(icono, { opacity: [0, 1], scale: [0.5, 1], rotate: [-12, 0] }, { duration: 0.8, delay: 0.1, ease: REBOTE })
}

export default function useRevelarContenido(ref) {
  // useLayoutEffect: el primer pase debe ocultar el contenido antes del primer
  // pintado, o se vería un parpadeo antes de la animación.
  useLayoutEffect(() => {
    const raiz = ref.current
    if (!raiz || reducirMovimiento()) return undefined

    const procesar = (nodos) => {
      const candidatos = []
      const visitar = (el) => {
        if (el.nodeType !== 1) return
        if (el.matches(SELECTOR_DETALLE) && !el.dataset.revelado) { revelarDetalle(el); return }
        if (el.matches(SELECTOR_HINT) && !el.dataset.revelado) { revelarHint(el); return }
        if (esContenido(el)) candidatos.push(el)
      }
      nodos.forEach(nodo => {
        if (nodo.nodeType !== 1) return
        visitar(nodo)
        nodo.querySelectorAll?.('*').forEach(visitar)
      })
      // Quita los que quedaron anidados en otro candidato del mismo lote.
      const sinAnidados = candidatos.filter(el => !candidatos.some(o => o !== el && o.contains(el)))
      if (sinAnidados.length) revelar(sinAnidados)
    }

    procesar([...raiz.children])

    const observador = new MutationObserver(registros => {
      const nuevos = []
      registros.forEach(r => r.addedNodes.forEach(n => nuevos.push(n)))
      procesar(nuevos)
    })
    observador.observe(raiz, { childList: true, subtree: true })

    // Al seleccionar una tarjeta de la lista (clase fus-card-activo) da un
    // pequeño pulso, para confirmar visualmente la selección.
    const observadorSeleccion = new MutationObserver(registros => {
      registros.forEach(r => {
        const el = r.target
        if (!el.classList?.contains('fus-card-activo') || (r.oldValue || '').includes('fus-card-activo')) return
        animate(el, { scale: [1, 1.03, 1] }, { duration: 0.6, ease: EXPO })
      })
    })
    observadorSeleccion.observe(raiz, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, subtree: true })

    // Elevación al pasar el cursor, por delegación (las tarjetas cambian).
    let elevado = null
    const bajar = () => {
      if (!elevado) return
      animate(elevado, { y: 0 }, { type: 'spring', stiffness: 320, damping: 26 })
      elevado = null
    }
    const alEntrar = (e) => {
      if (e.pointerType === 'touch') return
      const el = e.target.closest?.(SELECTOR_ELEVAR)
      if (!el || el === elevado || el.dataset.revelado) return
      if (getComputedStyle(el).animationName !== 'none') return
      bajar()
      elevado = el
      animate(el, { y: -3 }, { type: 'spring', stiffness: 320, damping: 22 })
    }
    const alSalir = (e) => {
      if (elevado && !elevado.contains(e.relatedTarget)) bajar()
    }
    raiz.addEventListener('pointerover', alEntrar)
    raiz.addEventListener('pointerout', alSalir)

    return () => {
      observador.disconnect()
      observadorSeleccion.disconnect()
      raiz.removeEventListener('pointerover', alEntrar)
      raiz.removeEventListener('pointerout', alSalir)
    }
  }, [ref])
}
