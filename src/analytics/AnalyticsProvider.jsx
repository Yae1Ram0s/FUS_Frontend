import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  abandonAllAnalyticsTasks,
  flushAnalytics,
  moduleFromPath,
  resetAnalyticsSession,
  startAnalytics,
  stopAnalytics,
  trackAnalytics,
} from './analyticsClient'

const recentPageViews = new Map()

function datasetEvent(element, fallbackEvent = 'INTERACTION') {
  return {
    modulo: moduleFromPath(),
    componente: element.dataset.analyticsComponent || 'CONTROL',
    evento: element.dataset.analyticsEvent || fallbackEvent,
    accion: element.dataset.analyticsAction || 'OPEN',
    resultado: element.dataset.analyticsResult || 'RECORDED',
    metadatos: element.dataset.analyticsMetadata
      ? { tipo: element.dataset.analyticsMetadata }
      : {},
  }
}

export default function AnalyticsProvider({ children }) {
  const location = useLocation()
  const { user, cargando } = useAuth()
  const formStarts = useRef(new Map())

  useEffect(() => {
    startAnalytics()
    return () => stopAnalytics()
  }, [])

  useEffect(() => {
    // Una cola de la cuenta anterior nunca debe atribuirse al siguiente
    // usuario que inicie sesion en esta misma pestana.
    if (!cargando && !user) resetAnalyticsSession()
  }, [cargando, user])

  useEffect(() => {
    if (!user || cargando) return
    const route = location.pathname
    const now = Date.now()
    const last = recentPageViews.get(route) || 0
    if (now - last < 1_000) return
    recentPageViews.set(route, now)
    trackAnalytics({
      modulo: moduleFromPath(route),
      componente: 'PAGINA',
      evento: 'PAGE_VIEW',
      accion: 'NAVIGATE',
      resultado: 'COMPLETED',
      ruta: route,
    })
  }, [cargando, location.pathname, user])

  useEffect(() => {
    if (!user || cargando) return undefined

    const handleInteraction = event => {
      const element = event.target.closest?.('[data-analytics-event]')
      if (!element) return
      const trigger = (element.dataset.analyticsTrigger || 'click').toLowerCase()
      if (trigger !== event.type) return
      trackAnalytics(datasetEvent(element))
    }

    const handleFormStart = event => {
      const form = event.target.closest?.('form[data-analytics-form]')
      if (!form || formStarts.current.has(form)) return
      const startedAt = performance.now()
      formStarts.current.set(form, startedAt)
      trackAnalytics({
        ...datasetEvent(form, 'FORM_STARTED'),
        componente: form.dataset.analyticsForm,
        evento: 'FORM_STARTED',
        resultado: 'STARTED',
      })
    }

    const handleFormSubmit = event => {
      const form = event.target.closest?.('form[data-analytics-form]')
      if (!form) return
      const startedAt = formStarts.current.get(form)
      formStarts.current.delete(form)
      trackAnalytics({
        ...datasetEvent(form, 'FORM_SUBMITTED'),
        componente: form.dataset.analyticsForm,
        evento: 'FORM_SUBMITTED',
        resultado: 'SUBMITTED',
        duracionMs: startedAt == null ? null : performance.now() - startedAt,
      })
    }

    document.addEventListener('click', handleInteraction, true)
    document.addEventListener('change', handleInteraction, true)
    document.addEventListener('focusin', handleFormStart, true)
    document.addEventListener('submit', handleFormSubmit, true)
    return () => {
      document.removeEventListener('click', handleInteraction, true)
      document.removeEventListener('change', handleInteraction, true)
      document.removeEventListener('focusin', handleFormStart, true)
      document.removeEventListener('submit', handleFormSubmit, true)
    }
  }, [cargando, user])

  useEffect(() => {
    if (!user || cargando) return undefined
    const abandonForms = motivo => {
      formStarts.current.forEach((startedAt, form) => {
        trackAnalytics({
          ...datasetEvent(form, 'FORM_ABANDONED'),
          componente: form.dataset.analyticsForm,
          evento: 'FORM_ABANDONED',
          resultado: 'ABANDONED',
          duracionMs: performance.now() - startedAt,
          metadatos: { motivo },
        })
      })
      formStarts.current.clear()
    }

    const handlePageHide = () => {
      abandonForms('pagehide')
      abandonAllAnalyticsTasks({ metadatos: { motivo: 'pagehide' } })
      flushAnalytics({ keepalive: true })
    }
    const handleVisibility = () => {
      if (document.visibilityState !== 'hidden') return
      flushAnalytics({ keepalive: true })
    }

    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [cargando, user])

  useEffect(() => {
    formStarts.current.forEach((startedAt, form) => {
      if (document.contains(form)) return
      trackAnalytics({
        ...datasetEvent(form, 'FORM_ABANDONED'),
        componente: form.dataset.analyticsForm,
        evento: 'FORM_ABANDONED',
        resultado: 'ABANDONED',
        duracionMs: performance.now() - startedAt,
        metadatos: { motivo: 'navigation' },
      })
      formStarts.current.delete(form)
    })
  }, [location.pathname])

  return children
}
