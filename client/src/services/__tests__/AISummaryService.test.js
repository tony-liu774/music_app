import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildPayload,
  buildPrompt,
  generateLocalDebrief,
  requestAIDebrief,
} from '../AISummaryService'

function makePitchDev(cents, isVibrato = false) {
  return { type: 'pitch', centsDeviation: cents, isVibrato, measureNumber: 1 }
}

function makeSessionLog(deviations = []) {
  return {
    session_id: 'test-session',
    duration_ms: 120000,
    deviations,
  }
}

function makeSummary(overrides = {}) {
  return {
    total_deviations: 10,
    pitch_deviation_count: 8,
    average_pitch_deviation_cents: 18,
    worst_measure: 4,
    problem_measures: [
      { measureNumber: 4, averageDeviation: 25, errorCount: 3 },
    ],
    ...overrides,
  }
}

describe('AISummaryService', () => {
  describe('buildPayload', () => {
    it('computes accuracy percentage from pitch deviations', () => {
      const deviations = [
        makePitchDev(5), // within 15 → accurate
        makePitchDev(10), // within 15 → accurate
        makePitchDev(30), // outside 15 → inaccurate
        makePitchDev(-20), // outside 15 → inaccurate
      ]
      const payload = buildPayload({
        sessionLog: makeSessionLog(deviations),
        sessionSummary: makeSummary(),
        worstMeasures: [],
      })
      // 2 out of 4 accurate = 50%
      expect(payload.accuracyPercent).toBe(50)
    })

    it('returns 100% accuracy when no pitch deviations exist', () => {
      const payload = buildPayload({
        sessionLog: makeSessionLog([]),
        sessionSummary: makeSummary(),
        worstMeasures: [],
      })
      expect(payload.accuracyPercent).toBe(100)
    })

    it('detects improving intonation trend', () => {
      // First half: high deviation, second half: low deviation
      const deviations = [
        makePitchDev(40),
        makePitchDev(35),
        makePitchDev(10),
        makePitchDev(5),
      ]
      const payload = buildPayload({
        sessionLog: makeSessionLog(deviations),
        sessionSummary: makeSummary(),
        worstMeasures: [],
      })
      expect(payload.intonationTrend).toBe('improving')
    })

    it('detects deteriorating intonation trend', () => {
      const deviations = [
        makePitchDev(5),
        makePitchDev(10),
        makePitchDev(40),
        makePitchDev(45),
      ]
      const payload = buildPayload({
        sessionLog: makeSessionLog(deviations),
        sessionSummary: makeSummary(),
        worstMeasures: [],
      })
      expect(payload.intonationTrend).toBe('deteriorating')
    })

    it('reports stable intonation when halves are similar', () => {
      const deviations = [
        makePitchDev(20),
        makePitchDev(22),
        makePitchDev(21),
        makePitchDev(19),
      ]
      const payload = buildPayload({
        sessionLog: makeSessionLog(deviations),
        sessionSummary: makeSummary(),
        worstMeasures: [],
      })
      expect(payload.intonationTrend).toBe('stable')
    })

    it('calculates vibrato usage percentage', () => {
      const deviations = [
        makePitchDev(10, true),
        makePitchDev(10, false),
        makePitchDev(10, true),
        makePitchDev(10, true),
      ]
      const payload = buildPayload({
        sessionLog: makeSessionLog(deviations),
        sessionSummary: makeSummary(),
        worstMeasures: [],
      })
      expect(payload.vibratoUsagePercent).toBe(75)
    })

    it('limits worst measures to 5', () => {
      const many = Array.from({ length: 10 }, (_, i) => ({
        measureNumber: i + 1,
        averageDeviation: 30 - i,
        errorCount: 5,
      }))
      const payload = buildPayload({
        sessionLog: makeSessionLog([]),
        sessionSummary: makeSummary(),
        worstMeasures: many,
      })
      expect(payload.worstMeasures).toHaveLength(5)
    })

    it('uses provided instrument', () => {
      const payload = buildPayload({
        sessionLog: makeSessionLog([]),
        sessionSummary: makeSummary(),
        worstMeasures: [],
        instrument: 'cello',
      })
      expect(payload.instrument).toBe('cello')
    })

    it('defaults instrument to violin', () => {
      const payload = buildPayload({
        sessionLog: makeSessionLog([]),
        sessionSummary: makeSummary(),
        worstMeasures: [],
      })
      expect(payload.instrument).toBe('violin')
    })

    it('includes recent deviations capped at 30', () => {
      const deviations = Array.from({ length: 50 }, (_, i) => makePitchDev(i))
      const payload = buildPayload({
        sessionLog: makeSessionLog(deviations),
        sessionSummary: makeSummary(),
        worstMeasures: [],
      })
      expect(payload.recentDeviations).toHaveLength(30)
    })
  })

  describe('buildPrompt', () => {
    it('includes key session data in the prompt string', () => {
      const payload = buildPayload({
        sessionLog: makeSessionLog([makePitchDev(20)]),
        sessionSummary: makeSummary({ average_pitch_deviation_cents: 20 }),
        worstMeasures: [
          { measureNumber: 4, averageDeviation: 25, errorCount: 3 },
        ],
        instrument: 'viola',
      })
      const prompt = buildPrompt(payload)

      expect(prompt).toContain('viola')
      expect(prompt).toContain('measure 4')
      expect(prompt).toContain('TWO sentences')
      expect(prompt).toContain('"debrief"')
      expect(prompt).toContain('"score"')
    })
  })

  describe('generateLocalDebrief', () => {
    it('returns high-accuracy praise for >= 85%', () => {
      const payload = {
        accuracyPercent: 90,
        intonationTrend: 'stable',
        worstMeasures: [],
      }
      const result = generateLocalDebrief(payload)
      expect(result.debrief).toContain('Excellent accuracy')
      expect(result.score).toBe(90)
      expect(result.isOfflineFallback).toBe(true)
    })

    it('returns medium-accuracy praise for 65-84%', () => {
      const payload = {
        accuracyPercent: 70,
        intonationTrend: 'stable',
        worstMeasures: [],
      }
      const result = generateLocalDebrief(payload)
      expect(result.debrief).toContain('Good effort')
    })

    it('returns encouragement for < 65%', () => {
      const payload = {
        accuracyPercent: 40,
        intonationTrend: 'stable',
        worstMeasures: [],
      }
      const result = generateLocalDebrief(payload)
      expect(result.debrief).toContain('muscle memory')
    })

    it('gives measure-specific tip when worst measures exist', () => {
      const payload = {
        accuracyPercent: 70,
        intonationTrend: 'stable',
        worstMeasures: [
          { measureNumber: 7, averageDeviation: 30, errorCount: 5 },
        ],
      }
      const result = generateLocalDebrief(payload)
      expect(result.debrief).toContain('measure 7')
    })

    it('gives trend-specific tip when intonation is deteriorating', () => {
      const payload = {
        accuracyPercent: 80,
        intonationTrend: 'deteriorating',
        worstMeasures: [],
      }
      const result = generateLocalDebrief(payload)
      expect(result.debrief).toContain('drifted')
    })
  })

  describe('requestAIDebrief', () => {
    let originalFetch

    beforeEach(() => {
      originalFetch = global.fetch
    })

    afterEach(() => {
      global.fetch = originalFetch
    })

    it('returns AI debrief on successful response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            summary: JSON.stringify({ debrief: 'Great session!', score: 82 }),
          }),
      })

      const payload = buildPayload({
        sessionLog: makeSessionLog([]),
        sessionSummary: makeSummary(),
        worstMeasures: [],
      })
      const result = await requestAIDebrief(payload)

      expect(result.debrief).toBe('Great session!')
      expect(result.score).toBe(82)
      expect(result.isOfflineFallback).toBe(false)
    })

    it('returns fallback when response has use_fallback flag', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ use_fallback: true }),
      })

      const payload = buildPayload({
        sessionLog: makeSessionLog([]),
        sessionSummary: makeSummary(),
        worstMeasures: [],
      })
      const result = await requestAIDebrief(payload)
      expect(result.isOfflineFallback).toBe(true)
    })

    it('returns fallback on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const payload = buildPayload({
        sessionLog: makeSessionLog([]),
        sessionSummary: makeSummary(),
        worstMeasures: [],
      })
      const result = await requestAIDebrief(payload)
      expect(result.isOfflineFallback).toBe(true)
      expect(result.debrief).toBeTruthy()
    })

    it('returns fallback on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'server error' }),
      })

      const payload = buildPayload({
        sessionLog: makeSessionLog([]),
        sessionSummary: makeSummary(),
        worstMeasures: [],
      })
      const result = await requestAIDebrief(payload)
      expect(result.isOfflineFallback).toBe(true)
    })

    it('handles plain text summary from backend', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            summary: 'Your bowing was excellent today.',
            overall_assessment: 'Your bowing was excellent today.',
          }),
      })

      const payload = buildPayload({
        sessionLog: makeSessionLog([]),
        sessionSummary: makeSummary(),
        worstMeasures: [],
      })
      const result = await requestAIDebrief(payload)
      expect(result.debrief).toBe('Your bowing was excellent today.')
      expect(result.isOfflineFallback).toBe(false)
    })

    it('sends correct request body to API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            summary: JSON.stringify({ debrief: 'test', score: 50 }),
          }),
      })

      const payload = buildPayload({
        sessionLog: makeSessionLog([]),
        sessionSummary: makeSummary(),
        worstMeasures: [],
        instrument: 'cello',
      })
      await requestAIDebrief(payload)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/ai-summary',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      const body = JSON.parse(global.fetch.mock.calls[0][1].body)
      expect(body.prompt).toContain('cello')
      expect(body.session_data).toBeDefined()
    })
  })
})
