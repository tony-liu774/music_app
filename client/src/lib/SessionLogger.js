/**
 * ESM re-export of the canonical SessionLogger.
 *
 * The single source of truth lives in src/js/analysis/session-logger.js.
 * That file uses CJS exports with named export { SessionLogger }.
 */

// Note: This file intentionally mirrors the backend session-logger
// For the client, we'll create a standalone version

/**
 * Session Logger - tracks practice session data
 */
class SessionLogger {
  constructor() {
    this.sessionId = null
    this.scoreId = null
    this.startTime = null
    this.deviations = []
    this.pitchDeviations = []
    this.timingDeviations = []
    this.dynamicsDeviations = []
  }

  startSession(scoreId) {
    this.sessionId = `session_${Date.now()}`
    this.scoreId = scoreId
    this.startTime = Date.now()
    this.deviations = []
    this.pitchDeviations = []
    this.timingDeviations = []
    this.dynamicsDeviations = []
  }

  logPitchDeviation({ measureNumber, expectedNote, detectedNote, centsDeviation, confidence, isVibrato }) {
    const deviation = {
      type: 'pitch',
      measureNumber,
      expectedNote,
      detectedNote,
      centsDeviation,
      confidence,
      isVibrato,
      timestamp: Date.now(),
    }
    this.deviations.push(deviation)
    this.pitchDeviations.push(deviation)
  }

  logRhythmDeviation({ measureNumber, expectedTiming, actualTiming, beat }) {
    const deviation = {
      type: 'rhythm',
      measureNumber,
      expectedTiming,
      actualTiming,
      beat,
      timestamp: Date.now(),
    }
    this.deviations.push(deviation)
    this.timingDeviations.push(deviation)
  }

  logIntonationDeviation({ measureNumber, note, transitionQuality, centsDeviation }) {
    const deviation = {
      type: 'intonation',
      measureNumber,
      note,
      transitionQuality,
      centsDeviation,
      timestamp: Date.now(),
    }
    this.deviations.push(deviation)
  }

  logDynamicsDeviation({ measureNumber, expectedDynamics, actualDynamics, beat }) {
    const deviation = {
      type: 'dynamics',
      measureNumber,
      expectedDynamics,
      actualDynamics,
      beat,
      timestamp: Date.now(),
    }
    this.deviations.push(deviation)
    this.dynamicsDeviations.push(deviation)
  }

  logArticulationDeviation({ measureNumber, expectedArticulation, actualArticulation }) {
    const deviation = {
      type: 'articulation',
      measureNumber,
      expectedArticulation,
      actualArticulation,
      timestamp: Date.now(),
    }
    this.deviations.push(deviation)
  }

  logToneQualityDeviation({ measureNumber, quality, score }) {
    const deviation = {
      type: 'tone',
      measureNumber,
      quality,
      score,
      timestamp: Date.now(),
    }
    this.deviations.push(deviation)
  }

  getSessionLog() {
    return {
      id: this.sessionId,
      scoreId: this.scoreId,
      startTime: this.startTime,
      endTime: Date.now(),
      duration_ms: Date.now() - (this.startTime || Date.now()),
      deviations: this.deviations,
    }
  }

  getSummaryStats() {
    const pitchDevs = this.pitchDeviations
    const avgPitchDeviation = pitchDevs.length > 0
      ? pitchDevs.reduce((sum, d) => sum + Math.abs(d.centsDeviation || 0), 0) / pitchDevs.length
      : 0

    // Find worst measure
    const measureCounts = {}
    this.deviations.forEach(d => {
      if (d.measureNumber != null) {
        measureCounts[d.measureNumber] = (measureCounts[d.measureNumber] || 0) + 1
      }
    })
    const worstMeasure = Object.entries(measureCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0]

    return {
      total_deviations: this.deviations.length,
      pitch_deviation_count: pitchDevs.length,
      average_pitch_deviation_cents: avgPitchDeviation,
      worst_measure: worstMeasure ? parseInt(worstMeasure, 10) : null,
      problem_measures: Object.entries(measureCounts)
        .map(([measure, count]) => ({ measure: parseInt(measure, 10), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    }
  }

  clear() {
    this.sessionId = null
    this.scoreId = null
    this.startTime = null
    this.deviations = []
    this.pitchDeviations = []
    this.timingDeviations = []
    this.dynamicsDeviations = []
  }
}

export { SessionLogger }
