import { useState, useRef, useCallback, useEffect } from 'react'
import { useAudioStore } from '../stores/useAudioStore'
import { useSessionStore } from '../stores/useSessionStore'
import { SessionLogger } from '../lib/SessionLogger.js'

/**
 * Pitch deviation threshold in cents — deviations below this are not logged
 * to avoid flooding the log with micro-fluctuations.
 */
const PITCH_DEVIATION_THRESHOLD = 5

/**
 * Minimum confidence from the pitch detector to consider a reading valid.
 */
const MIN_CONFIDENCE = 0.7

/**
 * React hook that integrates the SessionLogger with the live audio pipeline.
 *
 * Subscribes to pitch data from useAudioStore and automatically logs
 * deviations into a SessionLogger instance while a practice session
 * is active. On session end, persists the session log and summary
 * stats into useSessionStore.
 *
 * Lifecycle: startSession → pauseSession → resumeSession → endSession
 *
 * @param {object} [options]
 * @param {number} [options.deviationThreshold=5] — minimum cents deviation to log
 * @param {number} [options.minConfidence=0.7] — minimum pitch confidence to accept
 * @returns {{ startSession, pauseSession, resumeSession, endSession, getSessionLog, getSummaryStats, getWorstMeasures, getErrorsByMeasure, setPosition, isActive }}
 */
export function useSessionLogger(options = {}) {
  const deviationThreshold =
    options.deviationThreshold ?? PITCH_DEVIATION_THRESHOLD
  const minConfidence = options.minConfidence ?? MIN_CONFIDENCE

  const loggerRef = useRef(null)
  const [isActive, setIsActive] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const isActiveRef = useRef(false)
  const previousNoteRef = useRef(null)
  const measureRef = useRef(1)
  const beatRef = useRef(1)

  // Session store actions
  const storeStartSession = useSessionStore((s) => s.startSession)
  const storeEndSession = useSessionStore((s) => s.endSession)
  const setSessionLog = useSessionStore((s) => s.setSessionLog)
  const setSessionSummary = useSessionStore((s) => s.setSessionSummary)
  const scoreId = useSessionStore((s) => s.scoreId)

  // Lazily create the logger
  const getLogger = useCallback(() => {
    if (!loggerRef.current) {
      loggerRef.current = new SessionLogger()
    }
    return loggerRef.current
  }, [])

  /**
   * Start a new practice session.
   * @param {string} [id] — optional score ID (falls back to store scoreId)
   */
  const startSession = useCallback(
    (id) => {
      const sessionScoreId = id || scoreId || `session-${Date.now()}`
      const logger = getLogger()
      logger.startSession(sessionScoreId)
      isActiveRef.current = true
      setIsActive(true)
      setIsPaused(false)
      previousNoteRef.current = null
      measureRef.current = 1
      beatRef.current = 1
      storeStartSession(sessionScoreId)
    },
    [scoreId, getLogger, storeStartSession],
  )

  /**
   * Pause the current session (preserves logged deviations).
   */
  const pauseSession = useCallback(() => {
    if (!isActiveRef.current || !loggerRef.current) return
    loggerRef.current.pauseSession()
    isActiveRef.current = false
    setIsActive(false)
    setIsPaused(true)
  }, [])

  /**
   * Resume a paused session.
   */
  const resumeSession = useCallback(() => {
    if (!loggerRef.current || !loggerRef.current._paused) return
    loggerRef.current.resumeSession()
    isActiveRef.current = true
    setIsActive(true)
    setIsPaused(false)
  }, [])

  /**
   * End the current session, persist log + summary to the store.
   * @returns {{ log: object, summary: object } | null}
   */
  const endSession = useCallback(() => {
    if (!loggerRef.current) return null
    // If paused, resume first so timing is correct
    if (loggerRef.current._paused) {
      loggerRef.current.resumeSession()
    }

    isActiveRef.current = false
    setIsActive(false)
    setIsPaused(false)

    const logger = loggerRef.current
    const log = logger.getSessionLog()
    const summary = logger.getSummaryStats()

    setSessionLog(log)
    setSessionSummary(summary)
    storeEndSession()

    // Reset for next session
    previousNoteRef.current = null

    return { log, summary }
  }, [storeEndSession, setSessionLog, setSessionSummary])

  /**
   * Get the current session log (while session is active).
   */
  const getSessionLog = useCallback(() => {
    return loggerRef.current ? loggerRef.current.getSessionLog() : null
  }, [])

  /**
   * Get current summary stats (while session is active).
   */
  const getSummaryStats = useCallback(() => {
    return loggerRef.current ? loggerRef.current.getSummaryStats() : null
  }, [])

  /**
   * Get errors grouped by measure.
   */
  const getErrorsByMeasure = useCallback(() => {
    return loggerRef.current ? loggerRef.current.getErrorsByMeasure() : {}
  }, [])

  /**
   * Get the n measures with highest average deviation.
   * @param {number} n
   */
  const getWorstMeasures = useCallback((n) => {
    return loggerRef.current ? loggerRef.current.getWorstMeasures(n) : []
  }, [])

  /**
   * Manually set current measure and beat position (for score-following).
   */
  const setPosition = useCallback((measure, beat) => {
    measureRef.current = measure
    beatRef.current = beat
  }, [])

  /**
   * Subscribe to pitch data from the audio store and log deviations.
   * Uses vanilla subscribe (no selector) for Zustand v5 compatibility.
   */
  useEffect(() => {
    let prevPitchData = useAudioStore.getState().pitchData

    const unsubscribe = useAudioStore.subscribe((state) => {
      const pitchData = state.pitchData
      // Skip if pitchData reference hasn't changed
      if (pitchData === prevPitchData) return
      prevPitchData = pitchData

      if (!isActiveRef.current || !loggerRef.current) return

      const { frequency, note, cents, confidence } = pitchData

      // Skip low-confidence or null readings
      if (!frequency || !note || confidence < minConfidence) return

      // Read vibrato data for the isVibrato flag
      const vibratoData = state.vibratoData
      const isVibrato = !!(
        vibratoData &&
        vibratoData.rate &&
        vibratoData.rate > 0
      )

      const absCents = Math.abs(cents || 0)

      // Log pitch deviation if above threshold
      if (absCents >= deviationThreshold) {
        loggerRef.current.logPitchDeviation({
          measureNumber: measureRef.current,
          beat: beatRef.current,
          expectedNote: note, // In free-play mode, expected = detected note name
          detectedNote: note,
          centsDeviation: cents,
          confidence,
          isVibrato,
          expectedFrequency: null,
          actualFrequency: frequency,
        })
      }

      // Log intonation deviation on note transitions
      const prevNote = previousNoteRef.current
      if (prevNote && prevNote !== note) {
        loggerRef.current.logIntonationDeviation({
          measureNumber: measureRef.current,
          fromNote: prevNote,
          toNote: note,
          transitionQuality: absCents < 10 ? 90 : absCents < 25 ? 70 : 50,
          issue: 'note_transition',
        })
      }

      previousNoteRef.current = note
    })

    return unsubscribe
  }, [deviationThreshold, minConfidence])

  // Cleanup on unmount — end session if still active
  useEffect(() => {
    return () => {
      if (
        loggerRef.current &&
        (isActiveRef.current || loggerRef.current._paused)
      ) {
        if (loggerRef.current._paused) {
          loggerRef.current.resumeSession()
        }
        const logger = loggerRef.current
        const log = logger.getSessionLog()
        const summary = logger.getSummaryStats()
        const store = useSessionStore.getState()
        store.setSessionLog(log)
        store.setSessionSummary(summary)
        store.endSession()
      }
    }
  }, [])

  return {
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    getSessionLog,
    getSummaryStats,
    getErrorsByMeasure,
    getWorstMeasures,
    setPosition,
    isActive,
    isPaused,
  }
}
