import { animate } from 'motion'

/* Coreografía global de modales — apertura y cierre.

   Todos los modales del proyecto se montan con createPortal directamente en
   <body> (overlay + tarjeta), así que se animan desde un solo observador en
   vez de tocar cada componente:

   - Apertura: el fondo se desvanece y la tarjeta emerge (escala + ascenso +
     desenfoque que se enfoca); su contenido entra en cascada.
   - Cierre: React desmonta el modal al instante, así que el nodo retirado se
     vuelve a insertar como "fantasma" (inerte, sin interacción) solo el tiempo
     de la animación de salida y después se elimina.

   Se respeta lo existente: si un modal ya define su propia animación CSS (p. ej.
   PerfilModal) se deja tal cual. */

const EXPO = [0.16, 1, 0.3, 1]
const SALIDA = [0.7, 0, 0.84, 0]

// Overlay "completo": contiene a su tarjeta (com-overlay, cal-modal-overlay…).
const SELECTOR_OVERLAY = '[role="dialog"][aria-modal="true"]'
// Sistema base de styles/modal.css: overlay y tarjeta son hermanos y la tarjeta
// se centra con transform, así que no se le puede aplicar escala/traslación.
const SELECTOR_BASE = '.modal-overlay, .modal-card'

const reducirMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const tieneAnimacionCss = (el) => getComputedStyle(el).animationName !== 'none'

function limpiar(el) {
  ;['opacity', 'transform', 'filter', 'clip-path'].forEach(p => el.style.removeProperty(p))
}

function terminar(el, controles, alFinal) {
  // Un frame después: Motion confirma los valores finales al resolver y limpiar
  // antes los dejaba pegados en línea (p. ej. `filter: blur(0px)`).
  const fin = () => requestAnimationFrame(() => { limpiar(el); alFinal?.() })
  controles.then(fin, fin)
}

/* Contenido de la tarjeta (encabezado, cuerpo, acciones) en cascada. */
function cascada(tarjeta, retraso) {
  ;[...tarjeta.children]
    .filter(h => getComputedStyle(h).position !== 'absolute')
    .slice(0, 8)
    .forEach((hijo, i) => {
      hijo.style.opacity = '0'
      terminar(hijo, animate(hijo, { opacity: [0, 1], y: [16, 0] }, { duration: 0.55, delay: retraso + i * 0.055, ease: EXPO }))
    })
}

function abrir(nodo) {
  if (nodo.dataset.modalAnimado || nodo.dataset.modalSaliendo) return
  const esBase = nodo.matches(SELECTOR_BASE)
  if (tieneAnimacionCss(nodo)) return
  const esTarjetaBase = esBase && nodo.classList.contains('modal-card')
  const tarjeta = esBase ? (esTarjetaBase ? nodo : null) : nodo.firstElementChild
  if (tarjeta && tarjeta !== nodo && tieneAnimacionCss(tarjeta)) return

  nodo.dataset.modalAnimado = '1'

  // Fondo (overlay): fundido.
  if (!esTarjetaBase) {
    nodo.style.opacity = '0'
    terminar(nodo, animate(nodo, { opacity: [0, 1] }, { duration: 0.4, ease: 'easeOut' }))
  }
  if (!tarjeta) return

  if (esTarjetaBase) {
    // Centrada con transform: se revela con un recorte que se abre + enfoque.
    const radio = getComputedStyle(tarjeta).borderRadius || '0px'
    tarjeta.style.opacity = '0'
    terminar(tarjeta, animate(tarjeta, {
      opacity: [0, 1],
      filter: ['blur(14px)', 'blur(0px)'],
      clipPath: [`inset(10% 10% 10% 10% round ${radio})`, `inset(0% 0% 0% 0% round ${radio})`],
    }, { duration: 0.7, ease: EXPO }))
  } else {
    tarjeta.style.opacity = '0'
    terminar(tarjeta, animate(tarjeta, {
      opacity: [0, 1],
      scale: [0.9, 1],
      y: [40, 0],
      filter: ['blur(14px)', 'blur(0px)'],
    }, { duration: 0.75, ease: EXPO }))
  }
  cascada(tarjeta, 0.2)
}

function cerrar(nodo) {
  if (!nodo.dataset.modalAnimado || nodo.dataset.modalSaliendo) return
  nodo.dataset.modalSaliendo = '1'
  nodo.setAttribute('aria-hidden', 'true')
  nodo.inert = true
  nodo.style.pointerEvents = 'none'
  document.body.appendChild(nodo)

  const esTarjetaBase = nodo.classList.contains('modal-card')
  const quitar = () => nodo.remove()

  if (esTarjetaBase) {
    const radio = getComputedStyle(nodo).borderRadius || '0px'
    terminar(nodo, animate(nodo, {
      opacity: [1, 0],
      filter: ['blur(0px)', 'blur(10px)'],
      clipPath: [`inset(0% 0% 0% 0% round ${radio})`, `inset(10% 10% 10% 10% round ${radio})`],
    }, { duration: 0.35, ease: SALIDA }), quitar)
    return
  }

  const tarjeta = nodo.classList.contains('modal-overlay') ? null : nodo.firstElementChild
  const controles = animate(nodo, { opacity: [1, 0] }, { duration: 0.4, delay: 0.05, ease: 'easeIn' })
  if (tarjeta) {
    animate(tarjeta, {
      opacity: [1, 0],
      scale: [1, 0.94],
      y: [0, 24],
      filter: ['blur(0px)', 'blur(8px)'],
    }, { duration: 0.35, ease: SALIDA })
  }
  terminar(nodo, controles, quitar)
}

const esModal = (n) => n.nodeType === 1 && n.matches?.(`${SELECTOR_OVERLAY}, ${SELECTOR_BASE}`)

export function instalarAnimacionModales() {
  if (reducirMovimiento()) return () => {}

  const observador = new MutationObserver(registros => {
    registros.forEach(r => {
      r.addedNodes.forEach(n => {
        if (esModal(n)) abrir(n)
        else n.querySelectorAll?.(`${SELECTOR_OVERLAY}, ${SELECTOR_BASE}`).forEach(abrir)
      })
      r.removedNodes.forEach(n => { if (esModal(n)) cerrar(n) })
    })
  })
  // Solo hijos directos de <body>: ahí se montan todos los portales.
  observador.observe(document.body, { childList: true })
  return () => observador.disconnect()
}
