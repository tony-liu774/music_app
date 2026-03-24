import { describe, it, expect, beforeEach } from 'vitest'
import { SessionLogger } from '../SessionLogger'

describe('SessionLogger (ES module)', () => {
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

  it('logs pitch deviations', () => {
    logger.startSession('test')
    logger.logPitchDeviation({
      measure: 5,
      beat: 2,
      expectedPitch: 'C#5',
      actualPitch: 'C5',
      deviationCents: -10,
      expectedFrequency: 554.37,
      actualFrequency: 523.25,
    })

    expect(logger.deviations).toHaveLength(1)
    expect(logger.deviations[0].type).toBe('pitch')
    expect(logger.deviations[0].deviation_cents).toBe(-10)
    expect(logger.deviations[0].expected_frequency).toBe(554.37)
  })

  it('logs rhythm deviations', () => {
    logger.startSession('test')
    logger.logRhythmDeviation({
      measure: 3,
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
      measure: 7,
      fromNote: 'D4',
      toNote: 'E4',
      transitionQuality: 65,
      issue: 'position_shift',
    })

    expect(logger.deviations).toHaveLength(1)
    expect(logger.deviations[0].type).toBe('intonation')
    expect(logger.deviations[0].transition_quality).toBe(65)
  })

  it('logs dynamics deviations', () => {
    logger.startSession('test')
    logger.logDynamicsDeviation({
      measure: 2,
      beat: 1,
      expectedDynamic: 'f',
      actualDynamic: 'mf',
      deviation: 1,
    })

    expect(logger.deviations).toHaveLength(1)
    expect(logger.deviations[0].type).toBe('dynamics')
  })

  it('logs articulation deviations', () => {
    logger.startSession('test')
    logger.logArticulationDeviation({
      measure: 1,
      beat: 1,
      expectedArticulation: 'legato',
      detectedArticulation: 'detache',
      score: 60,
      feedback: 'Use smoother bow changes',
    })

    expect(logger.deviations).toHaveLength(1)
    expect(logger.deviations[0].type).toBe('articulation')
    expect(logger.deviations[0].score).toBe(60)
  })

  it('logs tone quality deviations with nullish coalescing for zero', () => {
    logger.startSession('test')
    logger.logToneQualityDeviation({
      measure: 1,
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
    logger.logPitchDeviation({ measure: 1, deviationCents: -10 })
    logger.logPitchDeviation({ measure: 2, deviationCents: -20 })
    logger.logRhythmDeviation({ measure: 3, deviationMs: 30 })
    logger.logToneQualityDeviation({ measure: 4, qualityScore: 75 })

    const log = logger.getSessionLog()
    expect(log.total_deviations).toBe(4)
    expect(log.pitch_deviations).toBe(2)
    expect(log.rhythm_deviations).toBe(1)
    expect(log.tone_quality_deviations).toBe(1)
    expect(log.tone_quality_average).toBe(75)
  })

  it('calculates summary statistics', () => {
    logger.startSession('test')
    logger.logPitchDeviation({ measure: 1, deviationCents: -10 })
    logger.logPitchDeviation({ measure: 1, deviationCents: -20 })
    logger.logPitchDeviation({ measure: 2, deviationCents: 15 })

    const stats = logger.getSummaryStats()
    expect(stats.pitch_deviation_count).toBe(3)
    expect(stats.average_pitch_deviation_cents).toBe(15)
    expect(stats.worst_measure).toBe(1)
  })

  it('exports for LLM', () => {
    logger.startSession('test')
    logger.logPitchDeviation({ measure: 1, deviationCents: -10 })

    const exported = logger.exportForLLM()
    const parsed = JSON.parse(exported)
    expect(parsed.summary.pitch_deviation_count).toBe(1)
    expect(parsed.recent_deviations).toHaveLength(1)
  })

  it('clears session data', () => {
    logger.startSession('test')
    logger.logPitchDeviation({ measure: 1, deviationCents: -10 })
    logger.clear()

    expect(logger.deviations).toEqual([])
    expect(logger.sessionId).toBeNull()
    expect(logger.startTime).toBeNull()
  })
})
