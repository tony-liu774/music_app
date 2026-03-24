import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import usePredictiveCursor, { getBeatPosition } from '../usePredictiveCursor'
import { useAudioStore } from '../../stores/useAudioStore'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })

  useAudioStore.setState({
    pitchData: { frequency: null, note: null, cents: null, confidence: 0 },
    cursorPosition: { measure: null, beat: null, progress: 0 },
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function advanceTime(ms) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

const mockScore = {
  parts: [
    {
      measures: [
        {
          number: 1,
          timeSignature: '4/4',
          notes: [
            { keys: ['c/4'], duration: 'q', isRest: false },
            { keys: ['d/4'], duration: 'q', isRest: false },
            { keys: ['e/4'], duration: 'q', isRest: false },
            { keys: ['f/4'], duration: 'q', isRest: false },
          ],
        },
        {
          number: 2,
          notes: [
            { keys: ['g/4'], duration: 'q', isRest: false },
            { keys: ['a/4'], duration: 'q', isRest: false },
            { keys: ['b/4'], duration: 'q', isRest: false },
            { keys: ['c/5'], duration: 'q', isRest: false },
          ],
        },
        {
          number: 3,
          notes: [
            { keys: ['d/5'], duration: 'h', isRest: false },
            { keys: ['e/5'], duration: 'h', isRest: false },
          ],
        },
      ],
    },
  ],
}

// ─── getBeatPosition unit tests ─────────────────────────────────────────────

describe('getBeatPosition', () => {
  it('returns a position for the first beat of the first measure', () => {
    const pos = getBeatPosition(1, 1, 4)
    expect(pos.x).toBeGreaterThan(0)
    expect(pos.y).toBeGreaterThan(0)
  })

  it('advances x as beat increases within a measure', () => {
    const beat1 = getBeatPosition(1, 1, 4)
    const beat2 = getBeatPosition(1, 2, 4)
    const beat4 = getBeatPosition(1, 4, 4)
    expect(beat2.x).toBeGreaterThan(beat1.x)
    expect(beat4.x).toBeGreaterThan(beat2.x)
  })

  it('keeps y constant within the same system', () => {
    const pos1 = getBeatPosition(1, 1, 4)
    const pos2 = getBeatPosition(2, 1, 4)
    const pos4 = getBeatPosition(4, 1, 4)
    expect(pos1.y).toBe(pos2.y)
    expect(pos2.y).toBe(pos4.y)
  })

  it('moves to a new y for a different system (measure 5+)', () => {
    const firstSystem = getBeatPosition(1, 1, 4)
    const secondSystem = getBeatPosition(5, 1, 4)
    expect(secondSystem.y).toBeGreaterThan(firstSystem.y)
  })

  it('handles 3/4 time signature', () => {
    const beat1 = getBeatPosition(1, 1, 3)
    const beat3 = getBeatPosition(1, 3, 3)
    expect(beat3.x).toBeGreaterThan(beat1.x)
  })
})

// ─── usePredictiveCursor hook tests ─────────────────────────────────────────

describe('usePredictiveCursor', () => {
  it('returns initial cursor state when not practicing', () => {
    const { result } = renderHook(() =>
      usePredictiveCursor({
        score: mockScore,
        isPracticing: false,
        tempo: 120,
        metronomeMode: true,
      }),
    )

    expect(result.current.currentMeasure).toBe(1)
    expect(result.current.currentBeat).toBe(1)
    expect(result.current.isBouncing).toBe(false)
    expect(typeof result.current.reset).toBe('function')
    expect(result.current.cursorRef).toBeDefined()
  })

  it('starts animation loop when practicing begins', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame')
    renderHook(() =>
      usePredictiveCursor({
        score: mockScore,
        isPracticing: true,
        tempo: 120,
        metronomeMode: true,
      }),
    )

    expect(rafSpy).toHaveBeenCalled()
  })

  it('does not start animation when there is no score', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame')
    renderHook(() =>
      usePredictiveCursor({
        score: null,
        isPracticing: true,
        tempo: 120,
        metronomeMode: true,
      }),
    )

    expect(rafSpy).not.toHaveBeenCalled()
  })

  it('cancels animation frame and bounce timer on cleanup', () => {
    const cafSpy = vi.spyOn(window, 'cancelAnimationFrame')
    const { unmount } = renderHook(() =>
      usePredictiveCursor({
        score: mockScore,
        isPracticing: true,
        tempo: 120,
        metronomeMode: true,
      }),
    )

    unmount()
    expect(cafSpy).toHaveBeenCalled()
  })

  it('advances beat in metronome mode when enough time passes', () => {
    const { result } = renderHook(() =>
      usePredictiveCursor({
        score: mockScore,
        isPracticing: true,
        tempo: 120,
        metronomeMode: true,
      }),
    )

    expect(result.current.currentBeat).toBe(1)
    advanceTime(550)
    expect(result.current.currentBeat).toBe(2)
  })

  it('wraps to next measure after all beats', () => {
    const { result } = renderHook(() =>
      usePredictiveCursor({
        score: mockScore,
        isPracticing: true,
        tempo: 120,
        metronomeMode: true,
      }),
    )

    advanceTime(2100)
    expect(result.current.currentMeasure).toBe(2)
    expect(result.current.currentBeat).toBe(1)
  })

  it('triggers bounce on beat advance and cleans up timer', () => {
    const { result } = renderHook(() =>
      usePredictiveCursor({
        score: mockScore,
        isPracticing: true,
        tempo: 120,
        metronomeMode: true,
      }),
    )

    advanceTime(550)
    expect(result.current.isBouncing).toBe(true)

    advanceTime(300)
    expect(result.current.isBouncing).toBe(false)
  })

  it('updates cursor position in audio store on beat advance', () => {
    renderHook(() =>
      usePredictiveCursor({
        score: mockScore,
        isPracticing: true,
        tempo: 120,
        metronomeMode: true,
      }),
    )

    advanceTime(550)

    const { cursorPosition } = useAudioStore.getState()
    expect(cursorPosition.measure).toBe(1)
    expect(cursorPosition.beat).toBe(2)
    expect(cursorPosition.progress).toBeGreaterThan(0)
  })

  it('reset() returns cursor to beginning', () => {
    const { result } = renderHook(() =>
      usePredictiveCursor({
        score: mockScore,
        isPracticing: true,
        tempo: 120,
        metronomeMode: true,
      }),
    )

    advanceTime(550)
    expect(result.current.currentBeat).toBe(2)

    act(() => result.current.reset())
    expect(result.current.currentMeasure).toBe(1)
    expect(result.current.currentBeat).toBe(1)

    const { cursorPosition } = useAudioStore.getState()
    expect(cursorPosition.measure).toBe(1)
    expect(cursorPosition.beat).toBe(1)
    expect(cursorPosition.progress).toBe(0)
  })

  it('does not advance past the last measure', () => {
    const { result } = renderHook(() =>
      usePredictiveCursor({
        score: mockScore,
        isPracticing: true,
        tempo: 120,
        metronomeMode: true,
      }),
    )

    advanceTime(8000)
    expect(result.current.currentMeasure).toBeLessThanOrEqual(3)
  })

  it('returns a cursorRef for direct DOM position updates', () => {
    const { result } = renderHook(() =>
      usePredictiveCursor({
        score: mockScore,
        isPracticing: true,
        tempo: 120,
        metronomeMode: true,
      }),
    )

    expect(result.current.cursorRef).toBeDefined()
    expect(result.current.cursorRef.current).toBeNull() // no DOM in hook test
  })
})

// ─── Pitch-based advance ────────────────────────────────────────────────────

describe('usePredictiveCursor — pitch mode', () => {
  it('advances on detected note change', () => {
    const { result } = renderHook(() =>
      usePredictiveCursor({
        score: mockScore,
        isPracticing: true,
        tempo: 120,
        metronomeMode: false,
      }),
    )

    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 440, note: 'A4', cents: 0, confidence: 0.8 },
      })
    })

    expect(result.current.currentBeat).toBe(2)
  })

  it('does not advance when confidence is too low', () => {
    const { result } = renderHook(() =>
      usePredictiveCursor({
        score: mockScore,
        isPracticing: true,
        tempo: 120,
        metronomeMode: false,
      }),
    )

    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 440, note: 'A4', cents: 0, confidence: 0.3 },
      })
    })

    expect(result.current.currentBeat).toBe(1)
  })

  it('does not advance on same note repeated', () => {
    const { result } = renderHook(() =>
      usePredictiveCursor({
        score: mockScore,
        isPracticing: true,
        tempo: 120,
        metronomeMode: false,
      }),
    )

    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 440, note: 'A4', cents: 0, confidence: 0.8 },
      })
    })
    expect(result.current.currentBeat).toBe(2)

    act(() => {
      useAudioStore.setState({
        pitchData: { frequency: 441, note: 'A4', cents: 1, confidence: 0.9 },
      })
    })
    expect(result.current.currentBeat).toBe(2)
  })
})
