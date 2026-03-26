import { useEffect, useRef, useCallback } from 'react'
import { useAudioStore } from '../stores/useAudioStore'

/**
 * Maximum number of consecutive resume attempts before giving up.
 */
const MAX_RESUME_RETRIES = 3

/**
 * Base delay (ms) for exponential backoff between resume attempts.
 */
const BASE_RETRY_DELAY_MS = 200

/**
 * React hook that monitors an AudioContext for browser-initiated suspension
 * (e.g. tab backgrounded, phone call, OS audio focus loss) and automatically
 * attempts to resume it when possible.
 *
 * Listens for:
 * - `document.visibilitychange` — resumes when the page returns to foreground
 * - `AudioContext.onstatechange` — detects suspension that happens mid-session
 *
 * Uses exponential backoff for retries and exposes state via useAudioStore.
 *
 * @param {AudioContext|null} audioContext — the AudioContext to monitor
 * @param {object} [options]
 * @param {boolean} [options.enabled=true] — whether monitoring is active
 * @returns {{ resume: () => Promise<boolean> }} resume — manually resume a suspended context; resolves true on success
 */
export function useAudioContextSuspension(audioContext, options = {}) {
  const enabled = options.enabled ?? true

  const setAudioContextState = useAudioStore((s) => s.setAudioContextState)
  const setIsSuspendedBySystem = useAudioStore((s) => s.setIsSuspendedBySystem)
  const setResumeFailCount = useAudioStore((s) => s.setResumeFailCount)

  const retryCountRef = useRef(0)
  const retryTimerRef = useRef(null)
  // Track whether the context was running before suspension
  const wasRunningRef = useRef(false)

  /**
   * Attempt to resume a suspended AudioContext with exponential backoff.
   * Returns true if resume succeeded, false otherwise.
   */
  const attemptResume = useCallback(
    async (ctx) => {
      if (!ctx || ctx.state !== 'suspended') return true

      try {
        await ctx.resume()
        // Success — reset counters
        retryCountRef.current = 0
        setResumeFailCount(0)
        setIsSuspendedBySystem(false)
        setAudioContextState(ctx.state)
        return true
      } catch {
        retryCountRef.current += 1
        setResumeFailCount(retryCountRef.current)

        if (retryCountRef.current < MAX_RESUME_RETRIES) {
          // Schedule retry with exponential backoff.
          // Note: each retry overwrites retryTimerRef.current. If unmount
          // occurs between the setTimeout callback and the next scheduled
          // retry, the in-flight promise chain may complete post-unmount.
          // This is safe because only Zustand state updates run (no DOM ops).
          const delay =
            BASE_RETRY_DELAY_MS * Math.pow(2, retryCountRef.current - 1)
          return new Promise((resolve) => {
            retryTimerRef.current = setTimeout(async () => {
              const result = await attemptResume(ctx)
              resolve(result)
            }, delay)
          })
        }

        // Exhausted retries
        return false
      }
    },
    [setAudioContextState, setIsSuspendedBySystem, setResumeFailCount],
  )

  /**
   * Handle AudioContext state transitions.
   */
  const handleStateChange = useCallback(
    (ctx) => {
      const state = ctx.state
      setAudioContextState(state)

      if (state === 'suspended' && wasRunningRef.current) {
        // Browser suspended our context mid-session
        setIsSuspendedBySystem(true)
        attemptResume(ctx)
      } else if (state === 'running') {
        wasRunningRef.current = true
        setIsSuspendedBySystem(false)
        retryCountRef.current = 0
        setResumeFailCount(0)
      } else if (state === 'closed') {
        wasRunningRef.current = false
        setIsSuspendedBySystem(false)
      }
    },
    [
      attemptResume,
      setAudioContextState,
      setIsSuspendedBySystem,
      setResumeFailCount,
    ],
  )

  /**
   * When the page becomes visible again, try to resume a suspended context.
   */
  const handleVisibilityChange = useCallback(() => {
    if (
      document.visibilityState === 'visible' &&
      audioContext &&
      audioContext.state === 'suspended' &&
      wasRunningRef.current
    ) {
      retryCountRef.current = 0
      setResumeFailCount(0)
      attemptResume(audioContext)
    }
  }, [audioContext, attemptResume, setResumeFailCount])

  // Attach listeners when an AudioContext is provided and monitoring is enabled
  useEffect(() => {
    if (!audioContext || !enabled) return

    // Seed initial state
    if (audioContext.state === 'running') {
      wasRunningRef.current = true
    }
    setAudioContextState(audioContext.state)

    const onStateChange = () => handleStateChange(audioContext)
    audioContext.addEventListener('statechange', onStateChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      audioContext.removeEventListener('statechange', onStateChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearTimeout(retryTimerRef.current)
    }
  }, [
    audioContext,
    enabled,
    handleStateChange,
    handleVisibilityChange,
    setAudioContextState,
  ])

  /**
   * Manual resume — lets the UI trigger a resume (e.g. via a "Tap to resume" button).
   */
  const resume = useCallback(async () => {
    if (!audioContext || audioContext.state !== 'suspended') return true
    retryCountRef.current = 0
    setResumeFailCount(0)
    return attemptResume(audioContext)
  }, [audioContext, attemptResume, setResumeFailCount])

  return { resume }
}
