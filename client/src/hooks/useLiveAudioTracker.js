/**
 * useLiveAudioTracker - React hook for LiveAudioTracker integration
 *
 * This hook provides a simple interface for integrating the LiveAudioTracker
 * (real-time pitch tracking with score comparison) into React components.
 *
 * It wraps the vanilla JS LiveAudioTracker and provides:
 * - Pitch detection callbacks
 * - Score comparison results
 * - Rhythm analysis data
 * - Practice state management
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { useAudioStore } from '../stores/useAudioStore'
import { useSessionLogger } from './useSessionLogger'

/**
 * @typedef {Object} LiveAudioTrackerOptions
 * @property {string} [instrument='violin']
 * @property {number} [tempo=120] - Beats per minute for rhythm tracking
 * @property {number} [centsTolerance=50] - Acceptable pitch deviation in cents
 */

/**
 * @typedef {Object} PitchResult
 * @property {Object|null} frequency - Detected frequency data
 * @property {number|null} cents - Cents deviation from target
 * @property {number} confidence - Detection confidence (0-1)
 */

/**
 * @typedef {Object} RhythmResult
 * @property {number} deviationMs - Timing deviation in ms (positive = late, negative = early)
 * @property {boolean} isOnTime - Whether deviation is within tolerance
 */

export function useLiveAudioTracker(options = {}) {
  const {
    instrument = 'violin',
    tempo = 120,
    centsTolerance = 50
  } = options

  // Refs for the tracker and audio stream
  const trackerRef = useRef(null)
  const streamRef = useRef(null)

  // State
  const [isTracking, setIsTracking] = useState(false)
  const [currentPitch, setCurrentPitch] = useState(null)
  const [currentRhythm, setCurrentRhythm] = useState(null)
  const [error, setError] = useState(null)
  const [isReady, setIsReady] = useState(false)

  // Store interactions
  const setPitchData = useAudioStore((s) => s.setPitchData)
  const setVibratoData = useAudioStore((s) => s.setVibratoData)
  const setCursorPosition = useAudioStore((s) => s.setCursorPosition)
  const isPracticing = useAudioStore((s) => s.isPracticing)

  // Session logger for persisting practice data
  const sessionLogger = useSessionLogger()

  /**
   * Initialize the tracker
   */
  const initialize = useCallback(async () => {
    try {
      // Dynamically import LiveAudioTracker
      const { LiveAudioTracker } = await import(
        /* webpackChunkName: "live-audio-tracker" */
        '../../../../src/js/audio/live-audio-tracker.js'
      )

      const tracker = new LiveAudioTracker()
      tracker.config.centsTolerance = centsTolerance
      tracker.setTempo(tempo)
      tracker.setInstrument(instrument)

      // Set up callbacks
      tracker.onPitchDetected = (data) => {
        if (data.notes && data.notes.length > 0) {
          const note = data.notes[0]
          setCurrentPitch(note)

          // Update the audio store
          setPitchData({
            frequency: note.frequency,
            confidence: note.confidence,
            note: note.name ? `${note.name}${note.octave}` : null,
            cents: note.smoothedCentsDeviation ?? note.centsDeviation ?? 0
          })

          if (note.isVibrato !== undefined) {
            setVibratoData({
              isVibrato: note.isVibrato,
              vibratoRate: note.vibratoRate || null,
              vibratoWidth: note.vibratoDepth || null,
              centerFrequency: note.smoothedFrequency || null
            })
          }
        }
      }

      tracker.onNoteMatch = (data) => {
        // Update cursor position
        setCursorPosition({
          measure: Math.floor(data.position / 4) + 1,
          beat: (data.position % 4) + 1,
          progress: data.position / (data.totalNotes || 1)
        })

        // Log to session
        if (sessionLogger.isActive) {
          sessionLogger.logPitchDeviation({
            measure: Math.floor(data.position / 4) + 1,
            beat: (data.position % 4) + 1,
            expectedNote: data.expectedNote?.name || '?',
            detectedPitch: data.detectedNote?.name || '?',
            centsDeviation: data.centsDeviation,
            confidence: data.detectedNote?.confidence || 0,
            isVibrato: data.detectedNote?.isVibrato || false
          })
        }
      }

      tracker.onRhythmMatch = (data) => {
        setCurrentRhythm(data)

        // Log rhythm deviation
        if (sessionLogger.isActive) {
          sessionLogger.logRhythmDeviation({
            measure: Math.floor(data.position / 4) + 1,
            beat: (data.position % 4) + 1,
            deviationMs: data.deviationMs,
            isOnTime: data.isOnTime
          })
        }
      }

      tracker.onError = (err) => {
        console.error('LiveAudioTracker error:', err)
        setError(err)
      }

      await tracker.initialize()
      trackerRef.current = tracker
      setIsReady(true)

      return true
    } catch (err) {
      console.error('Failed to initialize LiveAudioTracker:', err)
      setError(err)
      return false
    }
  }, [instrument, tempo, centsTolerance, setPitchData, setVibratoData, setCursorPosition, sessionLogger])

  /**
   * Start tracking audio
   */
  const startTracking = useCallback(async (score = null) => {
    if (!trackerRef.current) {
      const initialized = await initialize()
      if (!initialized) return false
    }

    try {
      const tracker = trackerRef.current

      if (score) {
        tracker.setScore(score)
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })
      streamRef.current = stream

      // Connect stream to tracker
      await tracker.startTracking()

      setIsTracking(true)
      return true
    } catch (err) {
      console.error('Failed to start tracking:', err)
      setError(err)
      return false
    }
  }, [initialize])

  /**
   * Stop tracking audio
   */
  const stopTracking = useCallback(() => {
    if (trackerRef.current) {
      trackerRef.current.stopTracking()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    setIsTracking(false)
    setCurrentPitch(null)
    setCurrentRhythm(null)
  }, [])

  /**
   * Set the score for comparison
   */
  const setScore = useCallback((score) => {
    if (trackerRef.current) {
      trackerRef.current.setScore(score)
    }
  }, [])

  /**
   * Update tempo for rhythm tracking
   */
  const setTempoBpm = useCallback((bpm) => {
    if (trackerRef.current) {
      trackerRef.current.setTempo(bpm)
    }
  }, [])

  /**
   * Get current tracker state
   */
  const getState = useCallback(() => {
    if (!trackerRef.current) return null
    return trackerRef.current.getState()
  }, [])

  /**
   * Get rhythm analysis summary
   */
  const getRhythmAnalysis = useCallback(() => {
    if (!trackerRef.current) return null
    return trackerRef.current.getRhythmAnalysis()
  }, [])

  // Initialize on mount
  useEffect(() => {
    initialize()

    return () => {
      if (trackerRef.current) {
        trackerRef.current.dispose()
        trackerRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [initialize])

  // Auto-stop when practice ends
  useEffect(() => {
    if (!isPracticing && isTracking) {
      stopTracking()
    }
  }, [isPracticing, isTracking, stopTracking])

  return {
    // State
    isTracking,
    isReady,
    currentPitch,
    currentRhythm,
    error,

    // Actions
    startTracking,
    stopTracking,
    setScore,
    setTempoBpm,

    // Analysis
    getState,
    getRhythmAnalysis,

    // Session logging
    sessionLogger
  }
}

export default useLiveAudioTracker
