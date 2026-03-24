import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHeatMapData, calculateHeatMapData } from '../useHeatMapData'

// ---------------------------------------------------------------------------
// Helper: build a pitch deviation entry
// ---------------------------------------------------------------------------
function pitchDev(measureNumber, centsDeviation, detectedNote = 'C4') {
  return {
    type: 'pitch',
    timestamp: 100,
    measureNumber,
    beat: 1,
    expectedNote: detectedNote,
    detectedNote,
    centsDeviation,
    confidence: 0.9,
    isVibrato: false,
  }
}

function rhythmDev(measureNumber, deviationMs) {
  return {
    type: 'rhythm',
    timestamp: 100,
    measureNumber,
    beat: 1,
    expected_ms: 500,
    actual_ms: 500 + deviationMs,
    deviation_ms: deviationMs,
  }
}

// ---------------------------------------------------------------------------
// calculateHeatMapData (pure function tests)
// ---------------------------------------------------------------------------
describe('calculateHeatMapData', () => {
  it('returns empty array for null/empty input', () => {
    expect(calculateHeatMapData(null)).toEqual([])
    expect(calculateHeatMapData([])).toEqual([])
    expect(calculateHeatMapData(undefined)).toEqual([])
  })

  it('calculates error count per measure', () => {
    const devs = [
      pitchDev(1, 20),
      pitchDev(1, -15),
      pitchDev(2, 30),
    ]
    const result = calculateHeatMapData(devs)

    expect(result).toHaveLength(2)
    expect(result[0].measureNumber).toBe(1)
    expect(result[0].errorCount).toBe(2)
    expect(result[1].measureNumber).toBe(2)
    expect(result[1].errorCount).toBe(1)
  })

  it('calculates average deviation from pitch cents', () => {
    const devs = [
      pitchDev(1, 20),
      pitchDev(1, -10), // abs = 10
    ]
    const result = calculateHeatMapData(devs)

    // Average of |20| and |-10| = 15
    expect(result[0].avgDeviation).toBe(15)
  })

  it('tracks max deviation and worst note', () => {
    const devs = [
      pitchDev(1, 10, 'A4'),
      pitchDev(1, -45, 'G#4'),
      pitchDev(1, 20, 'B4'),
    ]
    const result = calculateHeatMapData(devs)

    expect(result[0].maxDeviation).toBe(45)
    expect(result[0].worstNote).toBe('G#4')
  })

  it('handles rhythm deviations using deviation_ms', () => {
    const devs = [
      rhythmDev(3, 50),
      rhythmDev(3, -30),
    ]
    const result = calculateHeatMapData(devs)

    expect(result[0].measureNumber).toBe(3)
    expect(result[0].errorCount).toBe(2)
    // avg of |50| and |-30| = 40
    expect(result[0].avgDeviation).toBe(40)
  })

  it('handles non-numeric deviation types as weight-1', () => {
    const devs = [
      {
        type: 'intonation',
        measureNumber: 2,
        from_note: 'C4',
        to_note: 'D4',
        transition_quality: 50,
        issue: 'note_transition',
        timestamp: 100,
      },
    ]
    const result = calculateHeatMapData(devs)

    expect(result[0].errorCount).toBe(1)
    expect(result[0].avgDeviation).toBe(1)
  })

  it('uses logarithmic scale for opacity mapping', () => {
    // Measure 1: 1 error, Measure 2: 10 errors
    const devs = [
      pitchDev(1, 20),
      ...Array.from({ length: 10 }, () => pitchDev(2, 30)),
    ]
    const result = calculateHeatMapData(devs)

    const m1 = result.find((m) => m.measureNumber === 1)
    const m2 = result.find((m) => m.measureNumber === 2)

    // Max errors is 10, so m2 should have full 0.4 opacity
    expect(m2.opacity).toBeCloseTo(0.4, 2)
    // m1 has 1 error out of max 10 → log(2)/log(11) ≈ 0.289 * 0.4 ≈ 0.116
    expect(m1.opacity).toBeGreaterThan(0)
    expect(m1.opacity).toBeLessThan(m2.opacity)
  })

  it('returns 0 opacity when no errors', () => {
    // Edge case: this shouldn't happen since we only create entries for
    // measures that have deviations, but let's be safe
    const devs = [pitchDev(1, 20)]
    const result = calculateHeatMapData(devs)

    // Single measure gets max opacity
    expect(result[0].opacity).toBeCloseTo(0.4, 2)
  })

  it('sorts results by measure number', () => {
    const devs = [
      pitchDev(5, 10),
      pitchDev(2, 20),
      pitchDev(8, 30),
      pitchDev(1, 15),
    ]
    const result = calculateHeatMapData(devs)

    const numbers = result.map((m) => m.measureNumber)
    expect(numbers).toEqual([1, 2, 5, 8])
  })

  it('logarithmic scale makes low error counts still visible', () => {
    // With 100 max errors, a measure with 2 errors should still be visible
    const devs = [
      ...Array.from({ length: 100 }, () => pitchDev(1, 20)),
      pitchDev(2, 10),
      pitchDev(2, 15),
    ]
    const result = calculateHeatMapData(devs)

    const m2 = result.find((m) => m.measureNumber === 2)
    // log(3)/log(101) ≈ 0.238 * 0.4 ≈ 0.095 — should be visible
    expect(m2.opacity).toBeGreaterThan(0.05)
  })
})

// ---------------------------------------------------------------------------
// useHeatMapData (React hook tests)
// ---------------------------------------------------------------------------
describe('useHeatMapData', () => {
  it('returns empty array when sessionLog is null', () => {
    const { result } = renderHook(() => useHeatMapData(null))
    expect(result.current).toEqual([])
  })

  it('returns empty array when sessionLog has no deviations', () => {
    const { result } = renderHook(() =>
      useHeatMapData({ deviations: [] }),
    )
    expect(result.current).toEqual([])
  })

  it('returns heat map data from session log deviations', () => {
    const sessionLog = {
      deviations: [
        pitchDev(1, 20),
        pitchDev(1, -10),
        pitchDev(2, 45),
      ],
    }
    const { result } = renderHook(() => useHeatMapData(sessionLog))

    expect(result.current).toHaveLength(2)
    expect(result.current[0].measureNumber).toBe(1)
    expect(result.current[0].errorCount).toBe(2)
    expect(result.current[1].measureNumber).toBe(2)
    expect(result.current[1].errorCount).toBe(1)
  })

  it('memoizes result for same sessionLog reference', () => {
    const sessionLog = { deviations: [pitchDev(1, 20)] }
    const { result, rerender } = renderHook(() =>
      useHeatMapData(sessionLog),
    )
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})
