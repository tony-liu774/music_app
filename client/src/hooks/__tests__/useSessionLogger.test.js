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
    expect(result.current.endSession).toBeInstanceOf(Function)
    expect(result.current.getSessionLog).toBeInstanceOf(Function)
    expect(result.current.getSummaryStats).toBeInstanceOf(Function)
    expect(result.current.setPosition).toBeInstanceOf(Function)
  })

  it('starts a session and updates the session store', () => {
    const { result } = renderHook(() => useSessionLogger())

    act(() => {
      result.current.startSession('score-123')
    })

    const state = useSessionStore.getState()
    expect(state.sessionId).toBe('score-123')
    expect(state.sessionStartTime).toBeGreaterThan(0)
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
    const { result } = renderHook(() => useSessionLogger())

    act(() => {
      result.current.startSession('score-1')
    })

    // Manually add some deviations via the logger ref
    act(() => {
      result.current._loggerRef.current.logPitchDeviation({
        measure: 1,
        beat: 1,
        expectedPitch: 'A4',
        actualPitch: 'A4',
        deviationCents: 15,
        actualFrequency: 442,
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
  })

  it('returns null when ending a session that was not started', () => {
    const { result } = renderHook(() => useSessionLogger())

    let sessionResult
    act(() => {
      sessionResult = result.current.endSession()
    })

    expect(sessionResult).toBeNull()
  })

  it('logs pitch deviations from audio store updates', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })

    // Simulate pitch detection result with deviation above threshold
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
    expect(log.deviations[0].type).toBe('pitch')
    expect(log.deviations[0].deviation_cents).toBe(8)
    expect(log.deviations[0].actual_frequency).toBe(442)
  })

  it('ignores pitch data below confidence threshold', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ minConfidence: 0.7 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })

    // Low confidence reading
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

    // Small deviation, below threshold
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

    // Don't start session — just push pitch data
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

    // Logger hasn't been created yet
    expect(result.current.getSessionLog()).toBeNull()
  })

  it('logs intonation deviations on note transitions', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })

    // First note
    act(() => {
      useAudioStore.setState({
        pitchData: {
          frequency: 440,
          note: 'A4',
          cents: 8,
          confidence: 0.95,
        },
      })
    })

    // Transition to second note
    act(() => {
      useAudioStore.setState({
        pitchData: {
          frequency: 494,
          note: 'B4',
          cents: 12,
          confidence: 0.9,
        },
      })
    })

    const log = result.current.getSessionLog()
    const intonationDevs = log.deviations.filter(
      (d) => d.type === 'intonation',
    )
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
        pitchData: {
          frequency: 442,
          note: 'A4',
          cents: 10,
          confidence: 0.95,
        },
      })
    })

    const log = result.current.getSessionLog()
    expect(log.deviations[0].measure).toBe(3)
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

  it('persists session data on unmount if active', () => {
    const { result, unmount } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })

    // Add a deviation
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

    unmount()

    const state = useSessionStore.getState()
    expect(state.sessionLog).not.toBeNull()
    expect(state.sessionLog.total_deviations).toBe(1)
    expect(state.sessionSummary).not.toBeNull()
  })

  it('can start a new session after ending a previous one', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 5, minConfidence: 0.5 }),
    )

    // First session
    act(() => {
      result.current.startSession('score-1')
    })
    act(() => {
      useAudioStore.setState({
        pitchData: {
          frequency: 442,
          note: 'A4',
          cents: 10,
          confidence: 0.95,
        },
      })
    })
    act(() => {
      result.current.endSession()
    })

    // Second session
    act(() => {
      result.current.startSession('score-2')
    })
    act(() => {
      useAudioStore.setState({
        pitchData: {
          frequency: 330,
          note: 'E4',
          cents: 20,
          confidence: 0.9,
        },
      })
    })

    const log = result.current.getSessionLog()
    expect(log.session_id).toBe('score-2')
    // Should only have deviations from second session
    expect(log.pitch_deviations).toBe(1)
    expect(log.deviations[0].actual_pitch).toBe('E4')
  })

  it('assigns transition quality based on cents deviation', () => {
    const { result } = renderHook(() =>
      useSessionLogger({ deviationThreshold: 1, minConfidence: 0.5 }),
    )

    act(() => {
      result.current.startSession('score-1')
    })

    // Small cents → high quality (90)
    act(() => {
      useAudioStore.setState({
        pitchData: {
          frequency: 440,
          note: 'A4',
          cents: 5,
          confidence: 0.95,
        },
      })
    })
    act(() => {
      useAudioStore.setState({
        pitchData: {
          frequency: 494,
          note: 'B4',
          cents: 5,
          confidence: 0.95,
        },
      })
    })

    const log = result.current.getSessionLog()
    const intonationDevs = log.deviations.filter(
      (d) => d.type === 'intonation',
    )
    expect(intonationDevs[0].transition_quality).toBe(90)

    // Large cents → low quality (50)
    act(() => {
      useAudioStore.setState({
        pitchData: {
          frequency: 440,
          note: 'A4',
          cents: 30,
          confidence: 0.95,
        },
      })
    })

    const log2 = result.current.getSessionLog()
    const intonationDevs2 = log2.deviations.filter(
      (d) => d.type === 'intonation',
    )
    expect(intonationDevs2[1].transition_quality).toBe(50)
  })
})
