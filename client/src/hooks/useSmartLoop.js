import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Minimum BPM floor — tempo will never go below this during smart loop.
 */
const MIN_TEMPO = 40

/**
 * Tempo reduction factor — 15% reduction.
 */
const TEMPO_REDUCTION = 0.85

/**
 * Default error threshold: measures with avgDeviation above this (in cents)
 * are candidates for the smart loop.
 */
const DEFAULT_DEVIATION_THRESHOLD = 25

/**
 * Auto-exit threshold: average deviation below this (in cents) is "acceptable".
 */
const ACCEPTABLE_DEVIATION = 15

/**
 * Number of consecutive loops with acceptable accuracy needed to auto-exit.
 */
const CONSECUTIVE_GOOD_LOOPS = 3

/**
 * Improvement badge threshold: >10% improvement from first loop.
 */
const IMPROVEMENT_THRESHOLD = 0.1

/**
 * Extract the worst measures from heat map data.
 *
 * Selection logic:
 *  1. Measures with avgDeviation > deviationThreshold
 *  2. If none, take top 20% worst measures by avgDeviation
 *  3. Cap at maxMeasures
 *
 * @param {Array} heatMapData - from useHeatMapData
 * @param {object} [options]
 * @param {number} [options.deviationThreshold=25]
 * @param {number} [options.maxMeasures=6]
 * @returns {Array<{measureNumber: number, avgDeviation: number}>}
 */
export function extractWorstMeasures(heatMapData, options = {}) {
  const threshold = options.deviationThreshold ?? DEFAULT_DEVIATION_THRESHOLD
  const maxMeasures = options.maxMeasures ?? 6

  if (!heatMapData || heatMapData.length === 0) return []

  // Sort by avgDeviation descending
  const sorted = [...heatMapData].sort(
    (a, b) => b.avgDeviation - a.avgDeviation,
  )

  // Strategy 1: measures above the deviation threshold
  let candidates = sorted.filter((m) => m.avgDeviation > threshold)

  // Strategy 2: if none above threshold, take top 20%
  if (candidates.length === 0) {
    const top20Count = Math.max(1, Math.ceil(sorted.length * 0.2))
    candidates = sorted.slice(0, top20Count)
  }

  // Cap and return sorted by measure number for contiguous looping
  return candidates
    .slice(0, maxMeasures)
    .sort((a, b) => a.measureNumber - b.measureNumber)
}

/**
 * Calculate the reduced tempo for smart loop practice.
 * @param {number} currentTempo - Current BPM
 * @returns {number} Reduced BPM (floor of 40)
 */
export function calculateLoopTempo(currentTempo) {
  return Math.max(MIN_TEMPO, Math.round(currentTempo * TEMPO_REDUCTION))
}

/**
 * React hook for Smart Loop practice mode.
 *
 * Ported and enhanced from src/js/components/practice-loop.js.
 * Manages loop state, accuracy tracking across loops, and auto-exit.
 *
 * @param {object} options
 * @param {Array} options.heatMapData - Heat map data from useHeatMapData
 * @param {number} options.currentTempo - Current practice tempo
 * @param {object} options.cursorPosition - { measure, beat, progress } from audio store
 * @param {Function} options.onTempoChange - Callback to change the tempo
 * @param {Function} [options.onSeekToMeasure] - Callback to reposition cursor to a measure
 * @param {Function} [options.onAutoExit] - Callback when auto-exit triggers
 * @returns {object} Smart loop state and controls
 */
export function useSmartLoop({
  heatMapData,
  currentTempo,
  cursorPosition,
  onTempoChange,
  onSeekToMeasure,
  onAutoExit,
} = {}) {
  const [isActive, setIsActive] = useState(false)
  const [loopMeasures, setLoopMeasures] = useState([])
  const [loopCount, setLoopCount] = useState(0)
  const [loopTempo, setLoopTempo] = useState(null)
  const [isImproving, setIsImproving] = useState(false)
  const [autoExited, setAutoExited] = useState(false)

  // Refs for tracking accuracy across loops
  const originalTempoRef = useRef(null)
  const currentLoopDeviationsRef = useRef([])
  const loopDeviationHistoryRef = useRef([]) // avgDeviation per loop
  const firstLoopAvgRef = useRef(null)
  const consecutiveGoodRef = useRef(0)
  const isActiveRef = useRef(false)
  const loopMeasuresRef = useRef([])
  const prevMeasureRef = useRef(null)

  // Keep refs in sync
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  useEffect(() => {
    loopMeasuresRef.current = loopMeasures
  }, [loopMeasures])

  /**
   * Start smart loop: extract worst measures, reduce tempo, begin looping.
   */
  const startLoop = useCallback(() => {
    if (!heatMapData || heatMapData.length === 0) return false

    const worst = extractWorstMeasures(heatMapData)
    if (worst.length === 0) return false

    const reducedTempo = calculateLoopTempo(currentTempo)

    originalTempoRef.current = currentTempo
    currentLoopDeviationsRef.current = []
    loopDeviationHistoryRef.current = []
    firstLoopAvgRef.current = null
    consecutiveGoodRef.current = 0
    prevMeasureRef.current = null

    setLoopMeasures(worst)
    setLoopCount(1)
    setLoopTempo(reducedTempo)
    setIsImproving(false)
    setAutoExited(false)
    setIsActive(true)

    if (onTempoChange) {
      onTempoChange(reducedTempo)
    }

    // Seek cursor to the start of the loop region
    if (onSeekToMeasure) {
      onSeekToMeasure(worst[0].measureNumber)
    }

    return true
  }, [heatMapData, currentTempo, onTempoChange, onSeekToMeasure])

  /**
   * Exit smart loop: restore original tempo.
   */
  const exitLoop = useCallback(() => {
    if (!isActiveRef.current) return

    setIsActive(false)
    setLoopMeasures([])
    setLoopCount(0)
    setIsImproving(false)

    if (onTempoChange && originalTempoRef.current !== null) {
      onTempoChange(originalTempoRef.current)
    }
    originalTempoRef.current = null
  }, [onTempoChange])

  /**
   * Record a deviation during the current loop iteration.
   * Called externally (e.g., from the session logger subscription).
   * @param {number} centsDeviation - absolute cents deviation
   */
  const recordDeviation = useCallback((centsDeviation) => {
    if (!isActiveRef.current) return
    currentLoopDeviationsRef.current.push(Math.abs(centsDeviation))
  }, [])

  /**
   * Complete a loop iteration — called when cursor wraps back.
   * Calculates average deviation for the loop, updates history and badges.
   * @returns {{ shouldAutoExit: boolean, avgDeviation: number } | null}
   */
  const completeLoopIteration = useCallback(() => {
    if (!isActiveRef.current) return null

    const deviations = currentLoopDeviationsRef.current
    const avgDeviation =
      deviations.length > 0
        ? deviations.reduce((sum, d) => sum + d, 0) / deviations.length
        : 0

    loopDeviationHistoryRef.current.push(avgDeviation)

    // Set first loop baseline
    if (firstLoopAvgRef.current === null) {
      firstLoopAvgRef.current = avgDeviation
    }

    // Check improvement (>10% better than first loop)
    const firstAvg = firstLoopAvgRef.current
    if (firstAvg > 0 && avgDeviation < firstAvg * (1 - IMPROVEMENT_THRESHOLD)) {
      setIsImproving(true)
    } else {
      setIsImproving(false)
    }

    // Check consecutive good loops for auto-exit
    if (avgDeviation < ACCEPTABLE_DEVIATION) {
      consecutiveGoodRef.current++
    } else {
      consecutiveGoodRef.current = 0
    }

    const shouldAutoExit = consecutiveGoodRef.current >= CONSECUTIVE_GOOD_LOOPS

    // Reset for next loop
    currentLoopDeviationsRef.current = []
    setLoopCount((c) => c + 1)

    if (shouldAutoExit) {
      setAutoExited(true)
      setIsActive(false)
      setLoopMeasures([])

      if (onTempoChange && originalTempoRef.current !== null) {
        onTempoChange(originalTempoRef.current)
      }
      originalTempoRef.current = null

      if (onAutoExit) {
        onAutoExit()
      }
    }

    return { shouldAutoExit, avgDeviation }
  }, [onAutoExit, onTempoChange])

  /**
   * Track cursor position to detect when the cursor wraps past the loop region.
   * When a wrap is detected, complete the current iteration and seek back to start.
   */
  useEffect(() => {
    if (!isActive || !cursorPosition || loopMeasures.length === 0) return

    const currentMeasure = cursorPosition.measure
    if (currentMeasure == null) return

    const startMeasure = loopMeasures[0].measureNumber
    const endMeasure = loopMeasures[loopMeasures.length - 1].measureNumber
    const prev = prevMeasureRef.current

    // Detect when cursor moves past the end of the loop region
    if (prev !== null && prev === endMeasure && currentMeasure > endMeasure) {
      const result = completeLoopIteration()

      // Loop back to start of the region (unless auto-exited)
      if (result && !result.shouldAutoExit && onSeekToMeasure) {
        onSeekToMeasure(startMeasure)
      }
    }

    prevMeasureRef.current = currentMeasure
  }, [
    isActive,
    cursorPosition,
    loopMeasures,
    completeLoopIteration,
    onSeekToMeasure,
  ])

  /**
   * Check if a measure is within the loop region.
   * @param {number} measureNumber
   * @returns {boolean}
   */
  const isMeasureInLoop = useCallback(
    (measureNumber) => {
      return loopMeasures.some((m) => m.measureNumber === measureNumber)
    },
    [loopMeasures],
  )

  /**
   * Get the loop region boundaries.
   * @returns {{ startMeasure: number, endMeasure: number } | null}
   */
  const getLoopRegion = useCallback(() => {
    if (loopMeasures.length === 0) return null
    return {
      startMeasure: loopMeasures[0].measureNumber,
      endMeasure: loopMeasures[loopMeasures.length - 1].measureNumber,
    }
  }, [loopMeasures])

  return {
    isActive,
    loopMeasures,
    loopCount,
    loopTempo,
    isImproving,
    autoExited,
    startLoop,
    exitLoop,
    recordDeviation,
    completeLoopIteration,
    isMeasureInLoop,
    getLoopRegion,
  }
}
