import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  frequencyToMidi,
  frequencyToNote,
  PYINPitchDetector,
  SympatheticResonanceFilter,
  PerformanceMonitor,
} from '../dsp-core'

/* ------------------------------------------------------------------ */
/*  FREQUENCY / NOTE CONVERSION                                       */
/* ------------------------------------------------------------------ */

describe('frequencyToMidi', () => {
  it('returns 69 for A4 (440 Hz)', () => {
    expect(frequencyToMidi(440)).toBe(69)
  })

  it('returns 60 for middle C (261.63 Hz)', () => {
    expect(Math.round(frequencyToMidi(261.63))).toBe(60)
  })

  it('returns 81 for A5 (880 Hz)', () => {
    expect(frequencyToMidi(880)).toBe(81)
  })
})

describe('frequencyToNote', () => {
  it('returns A4 for 440 Hz', () => {
    const result = frequencyToNote(440)
    expect(result.note).toBe('A')
    expect(result.octave).toBe(4)
    expect(result.cents).toBe(0)
  })

  it('returns null fields for frequency <= 0', () => {
    expect(frequencyToNote(0)).toEqual({
      note: null,
      octave: null,
      cents: null,
    })
    expect(frequencyToNote(-100)).toEqual({
      note: null,
      octave: null,
      cents: null,
    })
  })

  it('returns correct note for E5 (659.25 Hz)', () => {
    const result = frequencyToNote(659.25)
    expect(result.note).toBe('E')
    expect(result.octave).toBe(5)
  })

  it('returns non-zero cents for slightly sharp pitch', () => {
    // 445 Hz is slightly above A4
    const result = frequencyToNote(445)
    expect(result.note).toBe('A')
    expect(result.cents).toBeGreaterThan(0)
  })

  it('returns non-zero cents for slightly flat pitch', () => {
    // 435 Hz is slightly below A4
    const result = frequencyToNote(435)
    expect(result.note).toBe('A')
    expect(result.cents).toBeLessThan(0)
  })
})

/* ------------------------------------------------------------------ */
/*  pYIN PITCH DETECTOR                                               */
/* ------------------------------------------------------------------ */

/**
 * Generate a pure sine wave Float32Array.
 */
function generateSineWave(frequency, sampleRate, length) {
  const buffer = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate)
  }
  return buffer
}

describe('PYINPitchDetector', () => {
  const sampleRate = 44100
  const bufferSize = 2048

  it('initialises with correct parameters', () => {
    const detector = new PYINPitchDetector(sampleRate, bufferSize)
    expect(detector.sampleRate).toBe(sampleRate)
    expect(detector.bufferSize).toBe(bufferSize)
    expect(detector.halfSize).toBe(1024)
    expect(detector.yinBuffer).toHaveLength(1024)
  })

  it('detects A4 (440 Hz) from a clean sine wave', () => {
    const detector = new PYINPitchDetector(sampleRate, bufferSize)
    const buffer = generateSineWave(440, sampleRate, bufferSize)
    const result = detector.detect(buffer)

    expect(result.frequency).not.toBeNull()
    // Allow ±2 Hz tolerance
    expect(result.frequency).toBeGreaterThan(438)
    expect(result.frequency).toBeLessThan(442)
    expect(result.confidence).toBeGreaterThan(0.8)
  })

  it('detects G3 (196 Hz) — violin G string', () => {
    const detector = new PYINPitchDetector(sampleRate, bufferSize)
    const buffer = generateSineWave(196, sampleRate, bufferSize)
    const result = detector.detect(buffer)

    expect(result.frequency).not.toBeNull()
    expect(result.frequency).toBeGreaterThan(194)
    expect(result.frequency).toBeLessThan(198)
    expect(result.confidence).toBeGreaterThan(0.8)
  })

  it('detects E5 (659.25 Hz) — violin E string', () => {
    const detector = new PYINPitchDetector(sampleRate, bufferSize)
    const buffer = generateSineWave(659.25, sampleRate, bufferSize)
    const result = detector.detect(buffer)

    expect(result.frequency).not.toBeNull()
    expect(result.frequency).toBeGreaterThan(657)
    expect(result.frequency).toBeLessThan(662)
  })

  it('returns null frequency for silence', () => {
    const detector = new PYINPitchDetector(sampleRate, bufferSize)
    const buffer = new Float32Array(bufferSize) // all zeros
    const result = detector.detect(buffer)

    expect(result.frequency).toBeNull()
    expect(result.confidence).toBe(0)
  })

  it('returns null frequency for random noise', () => {
    const detector = new PYINPitchDetector(sampleRate, bufferSize)
    const buffer = new Float32Array(bufferSize)
    for (let i = 0; i < bufferSize; i++) {
      buffer[i] = Math.random() * 2 - 1
    }
    const result = detector.detect(buffer)

    // Noise should either return null or have very low confidence
    if (result.frequency !== null) {
      expect(result.confidence).toBeLessThan(0.5)
    }
  })

  it('returns null for buffer shorter than bufferSize', () => {
    const detector = new PYINPitchDetector(sampleRate, bufferSize)
    const shortBuffer = new Float32Array(256)
    const result = detector.detect(shortBuffer)

    expect(result.frequency).toBeNull()
    expect(result.confidence).toBe(0)
  })

  it('respects custom threshold', () => {
    // Very strict threshold — harder to detect
    const strict = new PYINPitchDetector(sampleRate, bufferSize, {
      threshold: 0.01,
    })
    const buffer = generateSineWave(440, sampleRate, bufferSize)
    const result = strict.detect(buffer)

    // Clean sine should still pass even a strict threshold
    expect(result.frequency).not.toBeNull()
  })

  it('clamps maxLag to halfSize when minFreq is very low', () => {
    const detector = new PYINPitchDetector(sampleRate, 512, { minFreq: 20 })
    // maxLag would be ceil(44100/20) = 2205, but halfSize = 256
    expect(detector.maxLag).toBeLessThanOrEqual(detector.halfSize)
  })
})

/* ------------------------------------------------------------------ */
/*  SYMPATHETIC RESONANCE FILTER                                      */
/* ------------------------------------------------------------------ */

describe('SympatheticResonanceFilter', () => {
  it('preserves confidence for open-string fundamental (A4 on violin)', () => {
    const filter = new SympatheticResonanceFilter('violin')
    const result = filter.filter(440, 0.95)
    expect(result).toBe(0.95)
  })

  it('preserves confidence for open-string fundamental (G3 on violin)', () => {
    const filter = new SympatheticResonanceFilter('violin')
    const result = filter.filter(196, 0.9)
    expect(result).toBe(0.9)
  })

  it('reduces confidence for 2nd harmonic of G3 (392 Hz on violin)', () => {
    const filter = new SympatheticResonanceFilter('violin')
    // 392 Hz = 2 × 196 Hz (G3), 2nd harmonic
    const result = filter.filter(392, 0.9)
    expect(result).toBeLessThan(0.9)
    expect(result).toBeCloseTo(0.9 * 0.3, 2)
  })

  it('reduces confidence for 3rd harmonic of D4 (880.98 Hz on violin)', () => {
    const filter = new SympatheticResonanceFilter('violin')
    // 3 × 293.66 = 880.98 Hz
    const result = filter.filter(880.98, 0.85)
    expect(result).toBeLessThan(0.85)
  })

  it('does not reduce confidence for non-harmonic frequency', () => {
    const filter = new SympatheticResonanceFilter('violin')
    // 500 Hz is not close to any violin open-string fundamental or harmonic
    const result = filter.filter(500, 0.9)
    expect(result).toBe(0.9)
  })

  it('works for cello open strings', () => {
    const filter = new SympatheticResonanceFilter('cello')
    // C2 fundamental = 65.41 Hz — should be preserved
    expect(filter.filter(65.41, 0.9)).toBe(0.9)
    // 2nd harmonic of C2 = 130.82 Hz — should be reduced
    expect(filter.filter(130.82, 0.9)).toBeLessThan(0.9)
  })

  it('works for double-bass open strings', () => {
    const filter = new SympatheticResonanceFilter('double-bass')
    // E1 fundamental = 41.2 Hz — should be preserved
    expect(filter.filter(41.2, 0.8)).toBe(0.8)
  })

  it('works for viola open strings', () => {
    const filter = new SympatheticResonanceFilter('viola')
    // C3 fundamental = 130.81 Hz — should be preserved
    expect(filter.filter(130.81, 0.85)).toBe(0.85)
  })

  it('returns original confidence for freq <= 0', () => {
    const filter = new SympatheticResonanceFilter('violin')
    expect(filter.filter(0, 0.9)).toBe(0.9)
    expect(filter.filter(-100, 0.9)).toBe(0.9)
  })

  it('returns 0 for confidence <= 0', () => {
    const filter = new SympatheticResonanceFilter('violin')
    expect(filter.filter(440, 0)).toBe(0)
  })

  it('handles unknown instrument gracefully (empty open strings)', () => {
    const filter = new SympatheticResonanceFilter('banjo')
    // No open strings — confidence should be unchanged
    expect(filter.filter(440, 0.9)).toBe(0.9)
  })
})

/* ------------------------------------------------------------------ */
/*  PERFORMANCE MONITOR                                               */
/* ------------------------------------------------------------------ */

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('initialises with default 30ms budget', () => {
    const monitor = new PerformanceMonitor()
    expect(monitor.budgetMs).toBe(30)
    expect(monitor.frameCount).toBe(0)
  })

  it('accepts a custom budget', () => {
    const monitor = new PerformanceMonitor(50)
    expect(monitor.budgetMs).toBe(50)
  })

  it('tracks frame count', () => {
    const monitor = new PerformanceMonitor()
    const start = monitor.start()
    monitor.end(start)
    expect(monitor.frameCount).toBe(1)

    const start2 = monitor.start()
    monitor.end(start2)
    expect(monitor.frameCount).toBe(2)
  })

  it('reports exceeded=false when within budget', () => {
    const monitor = new PerformanceMonitor(30)
    // Mock performance.now to simulate <30ms processing
    let call = 0
    vi.spyOn(performance, 'now').mockImplementation(() => {
      return call++ === 0 ? 100 : 110 // 10ms elapsed
    })

    const start = monitor.start()
    const result = monitor.end(start)
    expect(result.exceeded).toBe(false)
    expect(result.processingTimeMs).toBe(10)
    expect(monitor.exceedCount).toBe(0)
  })

  it('reports exceeded=true when over budget', () => {
    const monitor = new PerformanceMonitor(30)
    let call = 0
    vi.spyOn(performance, 'now').mockImplementation(() => {
      return call++ === 0 ? 100 : 145 // 45ms elapsed
    })

    const start = monitor.start()
    const result = monitor.end(start)
    expect(result.exceeded).toBe(true)
    expect(result.processingTimeMs).toBe(45)
    expect(monitor.exceedCount).toBe(1)
  })

  it('tracks max processing time', () => {
    const monitor = new PerformanceMonitor()
    let time = 0
    vi.spyOn(performance, 'now').mockImplementation(() => time)

    time = 0
    const s1 = monitor.start()
    time = 10
    monitor.end(s1)

    time = 20
    const s2 = monitor.start()
    time = 45
    monitor.end(s2)

    expect(monitor.maxMs).toBe(25)
  })
})
