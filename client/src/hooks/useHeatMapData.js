import { useMemo } from 'react'

/**
 * Maximum opacity for the crimson overlay (40% = 0.4).
 * Matches the design spec: `bg-crimson/40`.
 */
const MAX_OPACITY = 0.4

/**
 * Calculate heat map data from a session log's deviations array.
 *
 * Maps error density per measure to an opacity value using a logarithmic scale
 * so that even a few errors produce a visible (light pink) overlay, while
 * heavily-errored measures approach MAX_OPACITY.
 *
 * @param {object|null} sessionLog - Session log from SessionLogger.getSessionLog()
 * @returns {Array<{measureNumber: number, errorCount: number, avgDeviation: number, maxDeviation: number, worstNote: string, opacity: number}>}
 */
export function useHeatMapData(sessionLog) {
  return useMemo(() => {
    if (
      !sessionLog ||
      !sessionLog.deviations ||
      sessionLog.deviations.length === 0
    ) {
      return []
    }

    return calculateHeatMapData(sessionLog.deviations)
  }, [sessionLog])
}

/**
 * Pure function to compute heat map data from an array of deviations.
 * Exported for testing.
 */
export function calculateHeatMapData(deviations) {
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

    const avgDeviation =
      devs.length > 0 ? Math.round((totalDeviation / devs.length) * 10) / 10 : 0

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

  return measures
    .map((m) => ({
      ...m,
      opacity:
        logMax > 0 ? (Math.log(1 + m.errorCount) / logMax) * MAX_OPACITY : 0,
    }))
    .sort((a, b) => a.measureNumber - b.measureNumber)
}
