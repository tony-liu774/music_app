import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionLogger } from '../useSessionLogger'
import { useAudioStore } from '../../stores/useAudioStore'
import { useSessionStore } from '../../stores/useSessionStore'

describe('useSessionLogger', () => {
  beforeEach(() => {
    // Reset stores
    useAudioStore.setState({
      pitchData: { frequency: null, note: null, cents: null, confidence: 0 },
      vibratoData: { rate: null, extent: null, centerFrequency: null },
      selectedInstrument: 'violin',
    })
    useSessionStore.setState({
      sessionId: null,
      sessionStartTime: null,
      sessionLog: null,
      sessionSummary: null,
      scoreId: null,
      errorLog: [],
    })
  })

  it('returns expected API shape', () => {
    const { result } = renderHook(() => useSessionLogger())
    expect(result.current.startSession).toBeInstanceOf(Function)
    expect(result.current.pauseSession).toBeInstanceOf(Function)
    expect(result.current.resumeSession).toBeInstanceOf(Function)
    expect(result.current.endSession).toBeInstanceOf(Function)
    expect(result.current.getSessionLog).toBeInstanceOf(Function)
    expect(result.current.getSummaryStats).toBeInstanceOf(Function)
    expect(result.current.getErrorsByMeasure).toBeInstanceOf(Function)
    expect(result.current.getWorstMeasures).toBeInstanceOf(Function)
    expect(result.current.setPosition).toBeInstanceOf(Function)
    expect(typeof result.current.isActive).toBe('boolean')
    expect(typeof result.current.isPaused).toBe('boolean')
  })

  it('starts a session and updates the session store', () => {
    const { result } = renderHook(() => useSessionLogger())

    act(() => {
      result.current.startSession('score-123')
    })

    const state = useSessionStore.getState()
    expect(state.sessionId).toBe('score-123')
    expect(state.sessionStartTime).toBeGreaterThan(0)
    expect(result.current.isActive).toBe(true)
  })

  it('uses scoreId from store when no id is provided', () => {
    useSessionStore.setState({ scoreId: 'store-score-456' })

    const { result } = renderHook(() => useSessionLogger())

    act(() => {
      result.current.startSession()
    })

    const state = useSessionStore.getState()
    expect(state.sessionId).toBe('store-score-456')
  })

  it('generates a fallback session id when none available', () => {
    const { result } = renderHook(() => useSessionLogger())

    act(() => {
      result.current.startSession()
    })

    const state = useSessionStore.getState()
    expect(state.sessionId).toMatch(/^session-\d+$/)
  })

  it('ends session and persists log + summary to store', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })

    // Add deviation via audio store
    act(() => {
      useAudioStore.setState({
        pitchData: {
          frequency: 442,
          note: 'A4',
          cents: 15,
          confidence: 0.95,
        },
      })
    })

    let sessionResult
    act(() => {
      sessionResult = result.current.endSession()
    })

    expect(sessionResult).not.toBeNull()
    expect(sessionResult.log.total_deviations).toBe(1)
    expect(sessionResult.summary.pitch_deviation_count).toBe(1)

    const state = useSessionStore.getState()
    expect(state.sessionLog).not.toBeNull()
    expect(state.sessionLog.total_deviations).toBe(1)
    expect(state.sessionSummary).not.toBeNull()
    expect(state.sessionSummary.pitch_deviation_count).toBe(1)
    expect(state.sessionId).toBeNull() // endSession clears it
    expect(result.current.isActive).toBe(false)
  })

  it('returns null when ending a session that was not started', () => {
    const { result } = renderHook(() => useSessionLogger())

    let sessionResult
    act(() => {
      sessionResult = result.current.endSession()
    })

    expect(sessionResult).toBeNull()
  })

  it('logs pitch deviations with spec-compliant fields from audio store', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })

    act(() => {
      useAudioStore.setState({
        pitchData: {
          frequency: 442,
          note: 'A4',
          cents: 8,
          confidence: 0.95,
        },
      })
    })

    const log = result.current.getSessionLog()
    expect(log.pitch_deviations).toBe(1)
    const d = log.deviations[0]
    expect(d.type).toBe('pitch')
    expect(d.centsDeviation).toBe(8)
    expect(d.confidence).toBe(0.95)
    expect(d.detectedNote).toBe('A4')
    expect(d.expectedNote).toBe('A4')
    expect(d.isVibrato).toBe(false)
    expect(d.actualFrequency).toBe(442)
  })

  it('captures isVibrato flag from vibratoData', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })

    // Set vibrato data first
    act(() => {
      useAudioStore.setState({
        vibratoData: { rate: 5.5, extent: 25, centerFrequency: 440 },
        pitchData: {
          frequency: 442,
          note: 'A4',
          cents: 8,
          confidence: 0.95,
        },
      })
    })

    const log = result.current.getSessionLog()
    expect(log.deviations[0].isVibrato).toBe(true)
  })

  it('ignores pitch data below confidence threshold', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ minConfidence: 0.7 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })

    act(() => {
      useAudioStore.setState({
        pitchData: {
          frequency: 442,
          note: 'A4',
          cents: 15,
          confidence: 0.3,
        },
      })
    })

    const log = result.current.getSessionLog()
    expect(log.total_deviations).toBe(0)
  })

  it('ignores pitch deviations below threshold', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 10, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })

    act(() => {
      useAudioStore.setState({
        pitchData: {
          frequency: 440.5,
          note: 'A4',
          cents: 3,
          confidence: 0.95,
        },
      })
    })

    const log = result.current.getSessionLog()
    expect(log.pitch_deviations).toBe(0)
  })

  it('does not log when session is not active', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    act(() => {
      useAudioStore.setState({
        pitchData: {
          frequency: 442,
          note: 'A4',
          cents: 15,
          confidence: 0.95,
        },
      })
    })

    expect(result.current.getSessionLog()).toBeNull()
  })

  it('logs intonation deviations on note transitions', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })

    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 440, note: 'A4', cents: 8, confidence: 0.95 },
      })
    })

    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 494, note: 'B4', cents: 12, confidence: 0.9 },
      })
    })

    const log = result.current.getSessionLog()
    const intonationDevs = log.deviations.filter((d) => d.type === 'intonation')
    expect(intonationDevs.length).toBe(1)
    expect(intonationDevs[0].from_note).toBe('A4')
    expect(intonationDevs[0].to_note).toBe('B4')
    expect(intonationDevs[0].issue).toBe('note_transition')
  })

  it('setPosition updates measure and beat for logged deviations', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
      result.current.setPosition(3, 2)
    })

    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 442, note: 'A4', cents: 10, confidence: 0.95 },
      })
    })

    const log = result.current.getSessionLog()
    expect(log.deviations[0].measureNumber).toBe(3)
    expect(log.deviations[0].beat).toBe(2)
  })

  it('getSessionLog returns null when no logger exists', () => {
    const { result } = renderHook(() => useSessionLogger())
    expect(result.current.getSessionLog()).toBeNull()
  })

  it('getSummaryStats returns null when no logger exists', () => {
    const { result } = renderHook(() => useSessionLogger())
    expect(result.current.getSummaryStats()).toBeNull()
  })

  // --- Pause/Resume lifecycle ---

  it('pauseSession stops logging and sets isPaused', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })
    expect(result.current.isActive).toBe(true)
    expect(result.current.isPaused).toBe(false)

    act(() => {
      result.current.pauseSession()
    })
    expect(result.current.isActive).toBe(false)
    expect(result.current.isPaused).toBe(true)

    // Should not log while paused
    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 442, note: 'A4', cents: 15, confidence: 0.95 },
      })
    })

    const log = result.current.getSessionLog()
    expect(log.total_deviations).toBe(0)
  })

  it('resumeSession resumes logging', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })

    // Log one deviation
    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 442, note: 'A4', cents: 10, confidence: 0.95 },
      })
    })

    act(() => {
      result.current.pauseSession()
    })

    act(() => {
      result.current.resumeSession()
    })
    expect(result.current.isActive).toBe(true)
    expect(result.current.isPaused).toBe(false)

    // Log another deviation
    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 330, note: 'E4', cents: 20, confidence: 0.9 },
      })
    })

    const log = result.current.getSessionLog()
    // Both deviations should be present (session was not reset)
    expect(log.pitch_deviations).toBe(2)
  })

  it('pause→resume preserves deviations (does not reset session)', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })

    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 442, note: 'A4', cents: 10, confidence: 0.95 },
      })
    })

    act(() => {
      result.current.pauseSession()
    })
    act(() => {
      result.current.resumeSession()
    })

    // The session id should still be the same
    const log = result.current.getSessionLog()
    expect(log.session_id).toBe('score-1')
    expect(log.pitch_deviations).toBe(1)
  })

  it('endSession after pause still persists data', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })

    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 442, note: 'A4', cents: 10, confidence: 0.95 },
      })
    })

    act(() => {
      result.current.pauseSession()
    })

    let sessionResult
    act(() => {
      sessionResult = result.current.endSession()
    })

    expect(sessionResult).not.toBeNull()
    expect(sessionResult.log.total_deviations).toBe(1)
    expect(result.current.isPaused).toBe(false)
    expect(result.current.isActive).toBe(false)
  })

  // --- getErrorsByMeasure / getWorstMeasures ---

  it('getErrorsByMeasure groups deviations by measure', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 1, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
      result.current.setPosition(1, 1)
    })
    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 442, note: 'A4', cents: 10, confidence: 0.95 },
      })
    })
    act(() => {
      result.current.setPosition(2, 1)
    })
    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 330, note: 'E4', cents: 20, confidence: 0.9 },
      })
    })

    const byMeasure = result.current.getErrorsByMeasure()
    expect(byMeasure[1]).toHaveLength(1)
    expect(byMeasure[2]).toHaveLength(2) // pitch + intonation (note transition)
  })

  it('getWorstMeasures returns measures ranked by average deviation', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 1, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
      result.current.setPosition(1, 1)
    })
    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 442, note: 'A4', cents: 5, confidence: 0.95 },
      })
    })
    act(() => {
      result.current.setPosition(2, 1)
    })
    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 442, note: 'A4', cents: 50, confidence: 0.95 },
      })
    })

    const worst = result.current.getWorstMeasures(2)
    expect(worst.length).toBeGreaterThanOrEqual(1)
    // Measure 2 should have higher average deviation
    expect(worst[0].measureNumber).toBe(2)
  })

  // --- Cleanup ---

  it('persists session data on unmount if active', () => {
    const { result, unmount } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })

    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 442, note: 'A4', cents: 15, confidence: 0.95 },
      })
    })

    unmount()

    const state = useSessionStore.getState()
    expect(state.sessionLog).not.toBeNull()
    expect(state.sessionLog.total_deviations).toBe(1)
    expect(state.sessionSummary).not.toBeNull()
  })

  it('persists session data on unmount if paused', () => {
    const { result, unmount } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })
    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 442, note: 'A4', cents: 15, confidence: 0.95 },
      })
    })
    act(() => {
      result.current.pauseSession()
    })

    unmount()

    const state = useSessionStore.getState()
    expect(state.sessionLog).not.toBeNull()
    expect(state.sessionLog.total_deviations).toBe(1)
  })

  it('can start a new session after ending a previous one', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })
    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 442, note: 'A4', cents: 10, confidence: 0.95 },
      })
    })
    act(() => {
      result.current.endSession()
    })

    act(() => {
      result.current.startSession('score-2')
    })
    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 330, note: 'E4', cents: 20, confidence: 0.9 },
      })
    })

    const log = result.current.getSessionLog()
    expect(log.session_id).toBe('score-2')
    expect(log.pitch_deviations).toBe(1)
    expect(log.deviations[0].detectedNote).toBe('E4')
  })
})
