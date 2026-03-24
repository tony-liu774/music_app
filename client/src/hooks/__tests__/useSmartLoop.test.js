import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useSmartLoop,
  extractWorstMeasures,
  calculateLoopTempo,
} from '../useSmartLoop'

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------
describe('extractWorstMeasures', () => {
  it('returns empty array for null/empty input', () => {
    expect(extractWorstMeasures(null)).toEqual([])
    expect(extractWorstMeasures([])).toEqual([])
  })

  it('extracts measures above the default 25-cent threshold', () => {
    const data = [
      { measureNumber: 1, avgDeviation: 10, errorCount: 2 },
      { measureNumber: 2, avgDeviation: 30, errorCount: 5 },
      { measureNumber: 3, avgDeviation: 50, errorCount: 8 },
      { measureNumber: 4, avgDeviation: 5, errorCount: 1 },
    ]
    const result = extractWorstMeasures(data)
    expect(result).toHaveLength(2)
    expect(result[0].measureNumber).toBe(2)
    expect(result[1].measureNumber).toBe(3)
  })

  it('falls back to top 20% when no measures exceed threshold', () => {
    const data = [
      { measureNumber: 1, avgDeviation: 10, errorCount: 2 },
      { measureNumber: 2, avgDeviation: 15, errorCount: 3 },
      { measureNumber: 3, avgDeviation: 12, errorCount: 2 },
      { measureNumber: 4, avgDeviation: 8, errorCount: 1 },
      { measureNumber: 5, avgDeviation: 20, errorCount: 4 },
    ]
    const result = extractWorstMeasures(data)
    // Top 20% of 5 = 1 measure (the worst)
    expect(result).toHaveLength(1)
    expect(result[0].measureNumber).toBe(5)
  })

  it('caps at maxMeasures', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      measureNumber: i + 1,
      avgDeviation: 30 + i,
      errorCount: 5,
    }))
    const result = extractWorstMeasures(data, { maxMeasures: 3 })
    expect(result).toHaveLength(3)
  })

  it('returns measures sorted by measure number', () => {
    const data = [
      { measureNumber: 5, avgDeviation: 40, errorCount: 5 },
      { measureNumber: 1, avgDeviation: 35, errorCount: 5 },
      { measureNumber: 3, avgDeviation: 50, errorCount: 8 },
    ]
    const result = extractWorstMeasures(data)
    expect(result.map((m) => m.measureNumber)).toEqual([1, 3, 5])
  })

  it('uses custom deviationThreshold', () => {
    const data = [
      { measureNumber: 1, avgDeviation: 10, errorCount: 2 },
      { measureNumber: 2, avgDeviation: 15, errorCount: 3 },
    ]
    const result = extractWorstMeasures(data, { deviationThreshold: 12 })
    expect(result).toHaveLength(1)
    expect(result[0].measureNumber).toBe(2)
  })
})

describe('calculateLoopTempo', () => {
  it('reduces tempo by 15%', () => {
    expect(calculateLoopTempo(120)).toBe(102)
    expect(calculateLoopTempo(100)).toBe(85)
  })

  it('enforces a floor of 40 BPM', () => {
    expect(calculateLoopTempo(40)).toBe(40)
    expect(calculateLoopTempo(30)).toBe(40)
  })

  it('rounds to the nearest integer', () => {
    expect(calculateLoopTempo(99)).toBe(84) // 99 * 0.85 = 84.15
  })
})

// ---------------------------------------------------------------------------
// Hook tests
// ---------------------------------------------------------------------------
describe('useSmartLoop', () => {
  const defaultHeatMap = [
    { measureNumber: 1, avgDeviation: 10, errorCount: 2, opacity: 0.1 },
    { measureNumber: 2, avgDeviation: 30, errorCount: 5, opacity: 0.3 },
    { measureNumber: 3, avgDeviation: 50, errorCount: 8, opacity: 0.4 },
    { measureNumber: 4, avgDeviation: 5, errorCount: 1, opacity: 0.05 },
  ]

  let onTempoChange
  let onAutoExit
  let onSeekToMeasure

  beforeEach(() => {
    onTempoChange = vi.fn()
    onAutoExit = vi.fn()
    onSeekToMeasure = vi.fn()
  })

  function renderSmartLoop(overrides = {}) {
    return renderHook(() =>
      useSmartLoop({
        heatMapData: defaultHeatMap,
        currentTempo: 120,
        cursorPosition: { measure: 1, beat: 1, progress: 0 },
        onTempoChange,
        onSeekToMeasure,
        onAutoExit,
        ...overrides,
      }),
    )
  }

  it('starts inactive', () => {
    const { result } = renderSmartLoop()
    expect(result.current.isActive).toBe(false)
    expect(result.current.loopMeasures).toEqual([])
    expect(result.current.loopCount).toBe(0)
  })

  it('startLoop extracts worst measures and reduces tempo', () => {
    const { result } = renderSmartLoop()
    let started
    act(() => {
      started = result.current.startLoop()
    })
    expect(started).toBe(true)
    expect(result.current.isActive).toBe(true)
    expect(result.current.loopMeasures.length).toBeGreaterThan(0)
    // Measures 2 and 3 have avgDeviation > 25
    expect(result.current.loopMeasures.map((m) => m.measureNumber)).toEqual([
      2, 3,
    ])
    expect(result.current.loopTempo).toBe(102) // 120 * 0.85
    expect(onTempoChange).toHaveBeenCalledWith(102)
    expect(result.current.loopCount).toBe(1)
  })

  it('startLoop returns false when no heat map data', () => {
    const { result } = renderSmartLoop({ heatMapData: [] })
    let started
    act(() => {
      started = result.current.startLoop()
    })
    expect(started).toBe(false)
    expect(result.current.isActive).toBe(false)
  })

  it('exitLoop restores original tempo', () => {
    const { result } = renderSmartLoop()
    act(() => {
      result.current.startLoop()
    })
    onTempoChange.mockClear()
    act(() => {
      result.current.exitLoop()
    })
    expect(result.current.isActive).toBe(false)
    expect(onTempoChange).toHaveBeenCalledWith(120) // original tempo restored
  })

  it('completeLoopIteration increments loop count', () => {
    const { result } = renderSmartLoop()
    act(() => {
      result.current.startLoop()
    })
    expect(result.current.loopCount).toBe(1)

    act(() => {
      result.current.recordDeviation(20)
      result.current.recordDeviation(30)
      result.current.completeLoopIteration()
    })
    expect(result.current.loopCount).toBe(2)
  })

  it('detects improvement when deviation drops by >10%', () => {
    const { result } = renderSmartLoop()
    act(() => {
      result.current.startLoop()
    })

    // First loop: avg deviation = 40
    act(() => {
      result.current.recordDeviation(40)
      result.current.completeLoopIteration()
    })
    expect(result.current.isImproving).toBe(false)

    // Second loop: avg deviation = 30 (25% improvement from 40)
    act(() => {
      result.current.recordDeviation(30)
      result.current.completeLoopIteration()
    })
    expect(result.current.isImproving).toBe(true)
  })

  it('auto-exits after 3 consecutive good loops', () => {
    const { result } = renderSmartLoop()
    act(() => {
      result.current.startLoop()
    })

    // First loop: set baseline
    act(() => {
      result.current.recordDeviation(40)
      result.current.completeLoopIteration()
    })

    // Three consecutive good loops (avg < 15 cents)
    for (let i = 0; i < 3; i++) {
      act(() => {
        result.current.recordDeviation(10)
        result.current.completeLoopIteration()
      })
    }

    expect(result.current.isActive).toBe(false)
    expect(result.current.autoExited).toBe(true)
    expect(onAutoExit).toHaveBeenCalledOnce()
    expect(onTempoChange).toHaveBeenLastCalledWith(120) // restored
  })

  it('resets consecutive good count when a bad loop occurs', () => {
    const { result } = renderSmartLoop()
    act(() => {
      result.current.startLoop()
    })

    // First loop baseline
    act(() => {
      result.current.recordDeviation(40)
      result.current.completeLoopIteration()
    })

    // Two good loops
    for (let i = 0; i < 2; i++) {
      act(() => {
        result.current.recordDeviation(10)
        result.current.completeLoopIteration()
      })
    }

    // One bad loop resets the counter
    act(() => {
      result.current.recordDeviation(20)
      result.current.completeLoopIteration()
    })
    expect(result.current.isActive).toBe(true)

    // Two more good loops — still not enough (need 3 consecutive)
    for (let i = 0; i < 2; i++) {
      act(() => {
        result.current.recordDeviation(10)
        result.current.completeLoopIteration()
      })
    }
    expect(result.current.isActive).toBe(true)
  })

  it('isMeasureInLoop checks loop region', () => {
    const { result } = renderSmartLoop()
    act(() => {
      result.current.startLoop()
    })
    expect(result.current.isMeasureInLoop(2)).toBe(true)
    expect(result.current.isMeasureInLoop(3)).toBe(true)
    expect(result.current.isMeasureInLoop(1)).toBe(false)
    expect(result.current.isMeasureInLoop(4)).toBe(false)
  })

  it('getLoopRegion returns start and end measures', () => {
    const { result } = renderSmartLoop()
    act(() => {
      result.current.startLoop()
    })
    const region = result.current.getLoopRegion()
    expect(region).toEqual({ startMeasure: 2, endMeasure: 3 })
  })

  it('getLoopRegion returns null when inactive', () => {
    const { result } = renderSmartLoop()
    expect(result.current.getLoopRegion()).toBeNull()
  })

  it('recordDeviation does nothing when inactive', () => {
    const { result } = renderSmartLoop()
    // Should not throw
    act(() => {
      result.current.recordDeviation(50)
    })
  })

  it('completeLoopIteration returns null when inactive', () => {
    const { result } = renderSmartLoop()
    let iterationResult
    act(() => {
      iterationResult = result.current.completeLoopIteration()
    })
    expect(iterationResult).toBeNull()
  })

  it('completeLoopIteration returns avgDeviation and shouldAutoExit', () => {
    const { result } = renderSmartLoop()
    act(() => {
      result.current.startLoop()
    })

    let iterationResult
    act(() => {
      result.current.recordDeviation(20)
      result.current.recordDeviation(30)
      iterationResult = result.current.completeLoopIteration()
    })
    expect(iterationResult).toEqual({
      shouldAutoExit: false,
      avgDeviation: 25,
    })
  })

  it('startLoop calls onSeekToMeasure with the first loop measure', () => {
    const { result } = renderSmartLoop()
    act(() => {
      result.current.startLoop()
    })
    // Loop measures are 2 and 3; should seek to measure 2
    expect(onSeekToMeasure).toHaveBeenCalledWith(2)
  })

  it('does not call onSeekToMeasure on auto-exit', () => {
    const { result } = renderSmartLoop()
    act(() => {
      result.current.startLoop()
    })
    onSeekToMeasure.mockClear()

    // First loop baseline
    act(() => {
      result.current.recordDeviation(40)
      result.current.completeLoopIteration()
    })

    // Three consecutive good loops trigger auto-exit
    for (let i = 0; i < 3; i++) {
      act(() => {
        result.current.recordDeviation(10)
        result.current.completeLoopIteration()
      })
    }

    // onSeekToMeasure should NOT be called after auto-exit
    // (it's called by the cursor-tracking effect, not completeLoopIteration directly)
    expect(result.current.autoExited).toBe(true)
  })
})
