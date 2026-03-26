import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing the service
// vi.hoisted ensures the variable is available when vi.mock factory runs
const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  return { mockFrom }
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

import {
  savePracticeSession,
  loadPracticeHistory,
  loadUserPieces,
  getProgressTrend,
} from '../PracticeSessionService'

function makeSessionLog() {
  return {
    duration_ms: 120000,
    deviations: [
      {
        type: 'pitch',
        measureNumber: 1,
        beat: 1,
        expectedNote: 'C4',
        detectedNote: 'C4',
        centsDeviation: 15,
        confidence: 0.9,
        isVibrato: false,
        timestamp: 100,
      },
      {
        type: 'pitch',
        measureNumber: 2,
        beat: 1,
        expectedNote: 'D4',
        detectedNote: 'D4',
        centsDeviation: -20,
        confidence: 0.85,
        timestamp: 200,
      },
    ],
  }
}

function makeSummary() {
  return {
    total_deviations: 2,
    pitch_deviation_count: 2,
    average_pitch_deviation_cents: 17.5,
    worst_measure: 2,
  }
}

// Helper to create a chainable query mock
function createChainMock(finalResult) {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(finalResult),
    maybeSingle: vi.fn().mockResolvedValue(finalResult),
  }
  return chain
}

describe('PracticeSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('savePracticeSession', () => {
    it('returns null when userId is missing', async () => {
      const result = await savePracticeSession({
        userId: null,
        sessionLog: makeSessionLog(),
      })
      expect(result).toBeNull()
    })

    it('returns null when sessionLog is missing', async () => {
      const result = await savePracticeSession({
        userId: 'user-1',
        sessionLog: null,
      })
      expect(result).toBeNull()
    })

    it('inserts session and errors into supabase', async () => {
      const sessionChain = createChainMock({
        data: { id: 'session-123' },
        error: null,
      })
      const errorsChain = createChainMock({ error: null })
      const userPiecesSelectChain = createChainMock({
        data: null,
        error: null,
      })
      const userPiecesInsertChain = createChainMock({ error: null })

      mockFrom.mockImplementation((table) => {
        if (table === 'practice_sessions') return sessionChain
        if (table === 'session_errors') return errorsChain
        if (table === 'user_pieces') {
          // First call is select, second is insert
          if (userPiecesSelectChain.select.mock.calls.length === 0) {
            return userPiecesSelectChain
          }
          return userPiecesInsertChain
        }
        return createChainMock({ data: null, error: null })
      })

      const result = await savePracticeSession({
        userId: 'user-1',
        scoreId: 'score-1',
        scoreTitle: 'Sonata',
        sessionLog: makeSessionLog(),
        sessionSummary: makeSummary(),
        accuracyPercent: 85,
        instrument: 'violin',
      })

      expect(result).toEqual({ sessionId: 'session-123' })
      expect(mockFrom).toHaveBeenCalledWith('practice_sessions')
      expect(sessionChain.insert).toHaveBeenCalled()
    })

    it('returns null on session insert error', async () => {
      const sessionChain = createChainMock({
        data: null,
        error: { message: 'DB error' },
      })

      mockFrom.mockReturnValue(sessionChain)

      const result = await savePracticeSession({
        userId: 'user-1',
        sessionLog: makeSessionLog(),
        sessionSummary: makeSummary(),
        accuracyPercent: 80,
        instrument: 'violin',
      })

      expect(result).toBeNull()
    })
  })

  describe('loadPracticeHistory', () => {
    it('returns sessions for a user', async () => {
      const chain = createChainMock(null)
      // Override limit to return data directly
      chain.limit = vi.fn().mockResolvedValue({
        data: [
          { id: '1', accuracy_percent: 85 },
          { id: '2', accuracy_percent: 72 },
        ],
        error: null,
      })
      mockFrom.mockReturnValue(chain)

      const result = await loadPracticeHistory('user-1')
      expect(result).toHaveLength(2)
      expect(mockFrom).toHaveBeenCalledWith('practice_sessions')
    })

    it('returns empty array on error', async () => {
      const chain = createChainMock(null)
      chain.limit = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      })
      mockFrom.mockReturnValue(chain)

      const result = await loadPracticeHistory('user-1')
      expect(result).toEqual([])
    })

    it('respects limit option', async () => {
      const chain = createChainMock(null)
      chain.limit = vi.fn().mockResolvedValue({ data: [], error: null })
      mockFrom.mockReturnValue(chain)

      await loadPracticeHistory('user-1', { limit: 5 })

      expect(chain.limit).toHaveBeenCalledWith(5)
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    })
  })

  describe('loadUserPieces', () => {
    it('returns user pieces data', async () => {
      const chain = createChainMock(null)
      chain.order = vi.fn().mockResolvedValue({
        data: [{ score_id: 'score-1', best_accuracy: 90 }],
        error: null,
      })
      mockFrom.mockReturnValue(chain)

      const result = await loadUserPieces('user-1')
      expect(result).toHaveLength(1)
      expect(mockFrom).toHaveBeenCalledWith('user_pieces')
    })

    it('returns empty array on error', async () => {
      const chain = createChainMock(null)
      chain.order = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'error' },
      })
      mockFrom.mockReturnValue(chain)

      const result = await loadUserPieces('user-1')
      expect(result).toEqual([])
    })
  })

  describe('getProgressTrend', () => {
    it('returns accuracy trend for a score', async () => {
      const chain = createChainMock(null)
      chain.limit = vi.fn().mockResolvedValue({
        data: [
          { accuracy_percent: 60, created_at: '2026-03-01' },
          { accuracy_percent: 75, created_at: '2026-03-10' },
          { accuracy_percent: 85, created_at: '2026-03-20' },
        ],
        error: null,
      })
      mockFrom.mockReturnValue(chain)

      const result = await getProgressTrend('user-1', 'score-1')
      expect(result).toHaveLength(3)
      expect(result[0].accuracy_percent).toBe(60)
      expect(result[2].accuracy_percent).toBe(85)
    })

    it('returns empty array on error', async () => {
      const chain = createChainMock(null)
      chain.limit = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'error' },
      })
      mockFrom.mockReturnValue(chain)

      const result = await getProgressTrend('user-1', 'score-1')
      expect(result).toEqual([])
    })
  })
})
