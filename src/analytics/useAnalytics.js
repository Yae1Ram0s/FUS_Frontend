import { useCallback, useEffect, useRef } from 'react'
import {
  abandonAnalyticsTask,
  beginAnalyticsTask,
  completeAnalyticsTask,
  failAnalyticsTask,
  moduleFromPath,
  trackAnalytics,
} from './analyticsClient'

export default function useAnalytics(defaults = {}) {
  const defaultsRef = useRef(defaults)
  const tasksRef = useRef(new Set())
  useEffect(() => { defaultsRef.current = defaults }, [defaults])

  const track = useCallback(event => trackAnalytics({
    modulo: moduleFromPath(),
    ...defaultsRef.current,
    ...event,
  }), [])

  const startTask = useCallback(event => {
    const taskId = beginAnalyticsTask({
      modulo: moduleFromPath(),
      ...defaultsRef.current,
      ...event,
    })
    tasksRef.current.add(taskId)
    return taskId
  }, [])

  const completeTask = useCallback((taskId, extra) => {
    tasksRef.current.delete(taskId)
    return completeAnalyticsTask(taskId, extra)
  }, [])

  const failTask = useCallback((taskId, extra) => {
    tasksRef.current.delete(taskId)
    return failAnalyticsTask(taskId, extra)
  }, [])

  const abandonTask = useCallback((taskId, extra) => {
    tasksRef.current.delete(taskId)
    return abandonAnalyticsTask(taskId, extra)
  }, [])

  useEffect(() => () => {
    tasksRef.current.forEach(taskId => {
      abandonAnalyticsTask(taskId, { metadatos: { motivo: 'unmount' } })
    })
    tasksRef.current.clear()
  }, [])

  return { track, startTask, completeTask, failTask, abandonTask }
}

