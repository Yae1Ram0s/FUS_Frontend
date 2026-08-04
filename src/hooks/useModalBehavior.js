import { useEffect, useRef } from 'react'

const modalStack = []
let previousBodyOverflow = ''

export function useModalBehavior(onClose, { closeEnabled = true } = {}) {
  const modalIdRef = useRef(Symbol('modal'))
  const onCloseRef = useRef(onClose)
  const closeEnabledRef = useRef(closeEnabled)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    onCloseRef.current = onClose
    closeEnabledRef.current = closeEnabled
  }, [closeEnabled, onClose])

  useEffect(() => {
    const modalId = modalIdRef.current
    previousFocusRef.current = document.activeElement
    if (modalStack.length === 0) {
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    modalStack.push(modalId)

    const getModal = () => {
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
      return dialogs[dialogs.length - 1]
    }
    const getFocusable = modal => [...(modal?.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) || [])].filter(element => !element.hasAttribute('hidden'))

    const handleKeyDown = event => {
      const isTopModal = modalStack.at(-1) === modalId
      if (event.key === 'Escape' && isTopModal && closeEnabledRef.current) {
        onCloseRef.current()
        return
      }
      if (event.key === 'Tab' && isTopModal) {
        const focusable = getFocusable(getModal())
        if (!focusable.length) {
          event.preventDefault()
          return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    queueMicrotask(() => getFocusable(getModal())[0]?.focus())

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      const index = modalStack.lastIndexOf(modalId)
      if (index >= 0) modalStack.splice(index, 1)
      if (modalStack.length === 0) {
        document.body.style.overflow = previousBodyOverflow
      }
      const previousFocus = previousFocusRef.current
      if (previousFocus?.isConnected) queueMicrotask(() => previousFocus.focus())
    }
  }, [])
}
