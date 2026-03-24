import { useState, useEffect, useCallback, useRef } from 'react'
import offlineManager from '../services/OfflineManager'

/**
 * useOffline — tracks online/offline status via navigator.onLine and
 * online/offline events. Queues session data when offline and processes
 * the sync queue when connectivity is restored.
 *
 * @param {Object} options
 * @param {Function} [options.onSync] - Custom upload function for sync queue processing
 * @param {Object} [options.toast] - Toast API ({ addToast }) for showing sync notifications
 */
export function useOffline({ onSync, toast } = {}) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const onSyncRef = useRef(onSync)
  onSyncRef.current = onSync
  const toastRef = useRef(toast)
  toastRef.current = toast

  const refreshPendingCount = useCallback(async () => {
    try {
      const queue = await offlineManager.getSyncQueue()
      setPendingCount(queue.length)
    } catch {
      // Silently ignore — DB may not be open yet
    }
  }, [])

  const processQueue = useCallback(async () => {
    setIsSyncing(true)
    try {
      const uploadFn =
        onSyncRef.current ||
        (async (item) => {
          const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data),
          })
          return response.ok
        })

      const result = await offlineManager.processSyncQueue(uploadFn)

      if (result.processed > 0 && toastRef.current) {
        toastRef.current.addToast({
          variant: 'success',
          message: `Synced ${result.processed} item${result.processed !== 1 ? 's' : ''}`,
          duration: 3000,
        })
      }

      await refreshPendingCount()
      return result
    } catch {
      return { processed: 0, failed: 0, remaining: 0 }
    } finally {
      setIsSyncing(false)
    }
  }, [refreshPendingCount])

  const queueSessionData = useCallback(async (sessionData) => {
    const id = await offlineManager.addToSyncQueue('session', sessionData)
    await offlineManager.saveSession({
      ...sessionData,
      id: sessionData.id || id,
    })
    setPendingCount((c) => c + 1)
    return id
  }, [])

  const queueDebriefRequest = useCallback(async (debriefData) => {
    const id = await offlineManager.addToSyncQueue('debrief', debriefData)
    setPendingCount((c) => c + 1)
    return id
  }, [])

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      // Auto-sync when connection is restored
      await processQueue()
    }

    const handleOffline = () => {
      setIsOnline(false)
      if (toastRef.current) {
        toastRef.current.addToast({
          variant: 'info',
          message: 'You are offline. Changes will sync when reconnected.',
          duration: 4000,
        })
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Load initial pending count
    refreshPendingCount()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [processQueue, refreshPendingCount])

  return {
    isOnline,
    isSyncing,
    pendingCount,
    queueSessionData,
    queueDebriefRequest,
    processQueue,
    refreshPendingCount,
  }
}

export default useOffline
