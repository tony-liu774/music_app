import { useMemo } from 'react'

/**
 * Maximum opacity for the crimson overlay.
 * Error-dense measures scale up to 60% (0.6).
 */
const MAX_OPACITY = 0.6

/**
 * Minimum error count for a measure to be considered "error" vs "success".
 * Measures with fewer errors than this AND low avg deviation get a success overlay.
 */
const SUCCESS_THRESHOLD_ERRORS = 2

/**
 * Maximum average deviation (cents) for a measure to qualify as "excellent".
 */
const SUCCESS_MAX_AVG_DEVIATION = 10

/**
 * Opacity for the success (emerald) overlay on excellent measures.
 */
const SUCCESS_OPACITY = 0.2

/**
 * Calculate heat map data from a session log's deviations array.
 *
 * Maps error density per measure to an opacity value using a logarithmic scale
 * so that even a few errors produce a visible (light pink) overlay, while
 * heavily-errored measures approach MAX_OPACITY.
 *
 * @param {object|null} sessionLog - Session log from SessionLogger.getSessionLog()
 * @param {number} [totalMeasures=0] - Total measures in the score (for success overlays on clean measures)
 * @returns {Array<{measureNumber: number, errorCount: number, avgDeviation: number, maxDeviation: number, worstNote: string, opacity: number, type: 'error'|'success'}>}
 */
export function useHeatMapData(sessionLog, totalMeasures = 0) {
  return useMemo(() => {
    if (!sessionLog || !sessionLog.deviations || sessionLog.deviations.length === 0) {
      return []
    }

    return calculateHeatMapData(sessionLog.deviations, totalMeasures)
  }, [sessionLog, totalMeasures])
}

/**
 * Pure function to compute heat map data from an array of deviations.
 * Exported for testing.
 *
 * @param {Array} deviations - Array of deviation objects
 * @param {number} [totalMeasures=0] - Total measures in the score (enables success overlays)
 * @returns {Array<{measureNumber: number, errorCount: number, avgDeviation: number, maxDeviation: number, worstNote: string, opacity: number, type: 'error'|'success'}>}
 */
export function calculateHeatMapData(deviations, totalMeasures = 0) {
  if (!deviations || deviations.length === 0) return []

  // Group deviations by measure
  const byMeasure = {}
  for (const d of deviations) {
    const m = d.measureNumber
    if (!byMeasure[m]) byMeasure[m] = []
    byMeasure[m].push(d)
  }

  // Calculate per-measure stats
  const measures = Object.entries(byMeasure).map(([measure, devs]) => {
    let totalDeviation = 0
    let maxDeviation = 0
    let worstNote = null
    let worstDeviationValue = 0

    for (const d of devs) {
      let dev = 0
      if (d.type === 'pitch') {
        dev = Math.abs(d.centsDeviation || 0)
        if (dev > worstDeviationValue) {
          worstDeviationValue = dev
          worstNote = d.detectedNote || d.expectedNote || null
        }
      } else if (d.type === 'rhythm') {
        dev = Math.abs(d.deviation_ms || 0)
      } else {
        dev = 1
      }
      totalDeviation += dev
      if (dev > maxDeviation) maxDeviation = dev
    }

    const avgDeviation = devs.length > 0
      ? Math.round((totalDeviation / devs.length) * 10) / 10
      : 0

    return {
      measureNumber: parseInt(measure),
      errorCount: devs.length,
      avgDeviation,
      maxDeviation: Math.round(maxDeviation * 10) / 10,
      worstNote,
    }
  })

  if (measures.length === 0) return []

  // Find the max error count for logarithmic scaling
  const maxErrors = Math.max(...measures.map((m) => m.errorCount))

  // Map error count → opacity using logarithmic scale
  // log(1 + count) / log(1 + maxCount) gives 0..1, then scale to MAX_OPACITY
  const logMax = Math.log(1 + maxErrors)

  const errorMeasures = measures
    .map((m) => ({
      ...m,
      type: 'error',
      opacity: logMax > 0
        ? (Math.log(1 + m.errorCount) / logMax) * MAX_OPACITY
        : 0,
    }))

  // Identify "excellent" measures: those with very few/no errors
  const errorMeasureNumbers = new Set(measures.map((m) => m.measureNumber))
  const successMeasures = []

  if (totalMeasures > 0) {
    for (let i = 1; i <= totalMeasures; i++) {
      if (!errorMeasureNumbers.has(i)) {
        // No errors at all — mark as success
        successMeasures.push({
          measureNumber: i,
          errorCount: 0,
          avgDeviation: 0,
          maxDeviation: 0,
          worstNote: null,
          type: 'success',
          opacity: SUCCESS_OPACITY,
        })
      }
    }
    // Also mark error measures that have very low error counts and deviation as success
    for (const m of errorMeasures) {
      if (
        m.errorCount <= SUCCESS_THRESHOLD_ERRORS &&
        m.avgDeviation <= SUCCESS_MAX_AVG_DEVIATION
      ) {
        m.type = 'success'
        m.opacity = SUCCESS_OPACITY
      }
    }
  }

  return [...errorMeasures, ...successMeasures]
    .sort((a, b) => a.measureNumber - b.measureNumber)
}
