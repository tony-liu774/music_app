import { describe, it, expect, beforeEach } from 'vitest'
import { SessionLogger } from '../SessionLogger'

describe('SessionLogger (ESM re-export)', () => {
  let logger

  beforeEach(() => {
    logger = new SessionLogger()
  })

  it('initializes with empty state', () => {
    expect(logger.deviations).toEqual([])
    expect(logger.sessionId).toBeNull()
    expect(logger.startTime).toBeNull()
  })

  it('starts a session', () => {
    logger.startSession('test-score')
    expect(logger.sessionId).toBe('test-score')
    expect(logger.startTime).toBeGreaterThan(0)
    expect(logger.deviations).toEqual([])
  })

  it('logs pitch deviations with spec-compliant fields', () => {
    logger.startSession('test')
    logger.logPitchDeviation({
      measureNumber: 5,
      beat: 2,
      expectedNote: 'C#5',
      detectedNote: 'C5',
      centsDeviation: -10,
      confidence: 0.95,
      isVibrato: true,
      expectedFrequency: 554.37,
      actualFrequency: 523.25,
    })

    expect(logger.deviations).toHaveLength(1)
    const d = logger.deviations[0]
    expect(d.type).toBe('pitch')
    expect(d.measureNumber).toBe(5)
    expect(d.expectedNote).toBe('C#5')
    expect(d.detectedNote).toBe('C5')
    expect(d.centsDeviation).toBe(-10)
    expect(d.confidence).toBe(0.95)
    expect(d.isVibrato).toBe(true)
    expect(d.expectedFrequency).toBe(554.37)
  })

  it('logs rhythm deviations', () => {
    logger.startSession('test')
    logger.logRhythmDeviation({
      measureNumber: 3,
      beat: 1,
      expectedMs: 500,
      actualMs: 530,
      deviationMs: 30,
    })

    expect(logger.deviations).toHaveLength(1)
    expect(logger.deviations[0].type).toBe('rhythm')
    expect(logger.deviations[0].deviation_ms).toBe(30)
  })

  it('logs intonation deviations', () => {
    logger.startSession('test')
    logger.logIntonationDeviation({
      measureNumber: 7,
      fromNote: 'D4',
      toNote: 'E4',
      transitionQuality: 65,
      issue: 'position_shift',
    })

    expect(logger.deviations).toHaveLength(1)
    expect(logger.deviations[0].type).toBe('intonation')
    expect(logger.deviations[0].transition_quality).toBe(65)
  })

  it('logs tone quality deviations with nullish coalescing for zero', () => {
    logger.startSession('test')
    logger.logToneQualityDeviation({
      measureNumber: 1,
      note: 'A4',
      qualityScore: 0,
      purityScore: 0,
      harshnessScore: 0,
    })

    expect(logger.deviations[0].quality_score).toBe(0)
    expect(logger.deviations[0].purity_score).toBe(0)
    expect(logger.deviations[0].harshness_score).toBe(0)
  })

  it('generates session log with correct counts', () => {
    logger.startSession('test')
    logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -10, confidence: 0.9 })
    logger.logPitchDeviation({ measureNumber: 2, centsDeviation: -20, confidence: 0.9 })
    logger.logRhythmDeviation({ measureNumber: 3, deviationMs: 30 })
    logger.logToneQualityDeviation({ measureNumber: 4, qualityScore: 75 })

    const log = logger.getSessionLog()
    expect(log.total_deviations).toBe(4)
    expect(log.pitch_deviations).toBe(2)
    expect(log.rhythm_deviations).toBe(1)
    expect(log.tone_quality_deviations).toBe(1)
    expect(log.tone_quality_average).toBe(75)
  })

  it('getErrorsByMeasure groups errors correctly', () => {
    logger.startSession('test')
    logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -10, confidence: 0.9 })
    logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -20, confidence: 0.9 })
    logger.logPitchDeviation({ measureNumber: 2, centsDeviation: 15, confidence: 0.9 })

    const byMeasure = logger.getErrorsByMeasure()
    expect(byMeasure[1]).toHaveLength(2)
    expect(byMeasure[2]).toHaveLength(1)
  })

  it('getWorstMeasures(n) returns n measures ranked by average deviation', () => {
    logger.startSession('test')
    logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -10, confidence: 0.9 })
    logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -20, confidence: 0.9 })
    logger.logPitchDeviation({ measureNumber: 2, centsDeviation: 50, confidence: 0.9 })
    logger.logPitchDeviation({ measureNumber: 3, centsDeviation: 5, confidence: 0.9 })

    const worst = logger.getWorstMeasures(2)
    expect(worst).toHaveLength(2)
    expect(worst[0].measureNumber).toBe(2)
    expect(worst[0].averageDeviation).toBe(50)
    expect(worst[1].measureNumber).toBe(1)
    expect(worst[1].averageDeviation).toBe(15)
  })

  it('supports pause and resume', () => {
    logger.startSession('test')
    logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -10, confidence: 0.9 })

    logger.pauseSession()
    expect(logger._paused).toBe(true)

    logger.resumeSession()
    expect(logger._paused).toBe(false)

    logger.logPitchDeviation({ measureNumber: 2, centsDeviation: -20, confidence: 0.9 })
    expect(logger.deviations).toHaveLength(2)
  })

  it('exports for LLM', () => {
    logger.startSession('test')
    logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -10, confidence: 0.9 })

    const exported = logger.exportForLLM()
    const parsed = JSON.parse(exported)
    expect(parsed.summary.pitch_deviation_count).toBe(1)
    expect(parsed.recent_deviations).toHaveLength(1)
  })

  it('clears session data', () => {
    logger.startSession('test')
    logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -10, confidence: 0.9 })
    logger.clear()

    expect(logger.deviations).toEqual([])
    expect(logger.sessionId).toBeNull()
    expect(logger.startTime).toBeNull()
  })

  it('getSessionSummary is an alias for getSummaryStats', () => {
    logger.startSession('test')
    logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -10, confidence: 0.9 })

    expect(logger.getSessionSummary()).toEqual(logger.getSummaryStats())
  })
})
