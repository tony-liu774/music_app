import { useCallback, useEffect, useRef } from 'react'
import offlineManager from '../services/OfflineManager'
import { useLibraryStore } from '../stores/useLibraryStore'

/**
 * useScoreCache — on first load, caches all score metadata and MusicXML data
 * to IndexedDB via OfflineManager. On subsequent loads, serves from cache
 * if offline.
 */
export function useScoreCache() {
  const scores = useLibraryStore((s) => s.scores)
  const setScores = useLibraryStore((s) => s.setScores)
  const setIsLoading = useLibraryStore((s) => s.setIsLoading)
  const setError = useLibraryStore((s) => s.setError)
  const hasCachedRef = useRef(false)

  // Cache scores to IndexedDB whenever the library updates (online)
  useEffect(() => {
    if (scores.length > 0 && navigator.onLine) {
      offlineManager.cacheScores(scores).catch(() => {
        // Silently fail — cache is best-effort
      })
      hasCachedRef.current = true
    }
  }, [scores])

  const loadFromCache = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const cached = await offlineManager.getCachedScores()
      if (cached.length > 0) {
        setScores(cached)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [setScores, setIsLoading, setError])

  const getCachedScore = useCallback(async (id) => {
    return offlineManager.getCachedScore(id)
  }, [])

  return {
    loadFromCache,
    getCachedScore,
  }
}

export default useScoreCache
