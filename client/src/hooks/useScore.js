import { useState, useEffect, useRef, useCallback } from 'react'
import { parseMusicXML } from '../services/MusicXMLParser'

/**
 * In-memory cache keyed by URL or a stable identifier.
 * Survives across component mounts within a single session.
 */
const scoreCache = new Map()

/**
 * useScore — load, parse, and cache a MusicXML score.
 *
 * @param {string|null} source – URL to fetch, raw MusicXML string, or null
 * @param {object} [options]
 * @param {boolean} [options.isRaw=false] – if true, `source` is treated as raw XML
 * @returns {{ score, isLoading, error, refetch }}
 */
export default function useScore(source, { isRaw = false } = {}) {
  const [score, setScore] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const load = useCallback(
    async (src) => {
      if (!src) {
        setScore(null)
        setError(null)
        setIsLoading(false)
        return
      }

      // Check cache
      const cacheKey = isRaw ? null : src
      if (cacheKey && scoreCache.has(cacheKey)) {
        setScore(scoreCache.get(cacheKey))
        setError(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        let xmlString
        if (isRaw) {
          xmlString = src
        } else {
          // Abort previous fetch if still in flight
          if (abortRef.current) abortRef.current.abort()
          const controller = new AbortController()
          abortRef.current = controller

          const res = await fetch(src, { signal: controller.signal })
          if (!res.ok) throw new Error(`Failed to fetch score: ${res.status}`)
          xmlString = await res.text()
        }

        const parsed = parseMusicXML(xmlString)
        if (cacheKey) scoreCache.set(cacheKey, parsed)
        setScore(parsed)
        setError(null)
      } catch (err) {
        if (err.name === 'AbortError') return
        setError(err.message || 'Failed to load score')
        setScore(null)
      } finally {
        setIsLoading(false)
      }
    },
    [isRaw],
  )

  useEffect(() => {
    load(source)
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [source, load])

  const refetch = useCallback(() => {
    // Clear cache for this source and re-load
    if (source && !isRaw) scoreCache.delete(source)
    load(source)
  }, [source, isRaw, load])

  return { score, isLoading, error, refetch }
}

/**
 * Clear the entire score cache. Useful for testing or when the library changes.
 */
export function clearScoreCache() {
  scoreCache.clear()
}
