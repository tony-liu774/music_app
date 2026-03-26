import { describe, it, expect } from 'vitest'
import { VibratoSmoother } from '../dsp-core'

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

/**
 * Generate a frequency sequence that simulates vibrato around a center
 * frequency. Returns an array of { freq, ts } objects.
 *
 * @param {number} centerHz    — center pitch (Hz)
 * @param {number} rateHz      — vibrato oscillation rate (Hz)
 * @param {number} extentCents — peak-to-peak extent in cents
 * @param {number} durationMs  — total duration of the sequence
 * @param {number} frameMs     — time between frames (~46 ms for 2048 @ 44.1k)
 */
function generateVibratoSequence(
  centerHz,
  rateHz,
  extentCents,
  durationMs,
  frameMs = 46,
) {
  const samples = []
  const halfExtent = extentCents / 2
  for (let t = 0; t < durationMs; t += frameMs) {
    // Sinusoidal vibrato: deviation oscillates ± halfExtent cents
    const devCents = halfExtent * Math.sin(2 * Math.PI * rateHz * (t / 1000))
    const freq = centerHz * Math.pow(2, devCents / 1200)
    samples.push({ freq, ts: t })
  }
  return samples
}

/* ------------------------------------------------------------------ */
/*  BASIC BEHAVIOUR                                                    */
/* ------------------------------------------------------------------ */

describe('VibratoSmoother', () => {
  it('initialises with default options', () => {
    const s = new VibratoSmoother()
    expect(s.windowMs).toBe(200)
    expect(s.minConfidence).toBe(0.5)
    expect(s.minVibratoRate).toBe(4)
    expect(s.maxVibratoRate).toBe(8)
    expect(s.minVibratoExtent).toBe(30)
  })

  it('accepts custom options', () => {
    const s = new VibratoSmoother({
      windowMs: 300,
      minConfidence: 0.7,
      minVibratoRate: 3,
      maxVibratoRate: 10,
      minVibratoExtent: 15,
    })
    expect(s.windowMs).toBe(300)
    expect(s.minConfidence).toBe(0.7)
    expect(s.minVibratoRate).toBe(3)
    expect(s.maxVibratoRate).toBe(10)
    expect(s.minVibratoExtent).toBe(15)
  })

  it('returns nulls when no valid samples exist', () => {
    const s = new VibratoSmoother()
    const result = s.process(null, 0, 0)
    expect(result.smoothedFrequency).toBeNull()
    expect(result.smoothedCents).toBeNull()
    expect(result.smoothedNote).toBeNull()
    expect(result.vibratoRate).toBeNull()
    expect(result.vibratoExtent).toBeNull()
    expect(result.isVibrato).toBe(false)
  })

  it('returns nulls for low-confidence samples', () => {
    const s = new VibratoSmoother({ minConfidence: 0.5 })
    const result = s.process(440, 0.3, 0) // below minConfidence
    expect(result.smoothedFrequency).toBeNull()
    expect(result.isVibrato).toBe(false)
  })

  it('returns the frequency itself for a single valid sample', () => {
    const s = new VibratoSmoother()
    const result = s.process(440, 0.9, 0)
    expect(result.smoothedFrequency).toBeCloseTo(440, 1)
    expect(result.smoothedNote).toBe('A4')
    expect(result.smoothedCents).toBe(0)
  })

  it('reset() clears all history', () => {
    const s = new VibratoSmoother()
    s.process(440, 0.9, 0)
    s.process(442, 0.9, 50)
    s.reset()
    const result = s.process(null, 0, 100)
    expect(result.smoothedFrequency).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/*  SMOOTHING — STEADY PITCH                                           */
/* ------------------------------------------------------------------ */

describe('VibratoSmoother — steady pitch smoothing', () => {
  it('smoothed frequency is close to input when pitch is stable', () => {
    const s = new VibratoSmoother()
    // Feed a steady 440 Hz for 200ms
    for (let t = 0; t <= 200; t += 46) {
      s.process(440, 0.95, t)
    }
    const result = s.process(440, 0.95, 230)
    expect(result.smoothedFrequency).toBeCloseTo(440, 0)
    expect(result.smoothedNote).toBe('A4')
  })

  it('prunes samples outside the window', () => {
    const s = new VibratoSmoother({ windowMs: 200 })
    // Feed samples that will be outside the window
    s.process(300, 0.9, 0)
    s.process(300, 0.9, 50)
    // Jump 500ms ahead — old samples should be pruned
    const result = s.process(440, 0.9, 500)
    // Only the 440 Hz sample should remain
    expect(result.smoothedFrequency).toBeCloseTo(440, 0)
  })

  it('smoothed cents stays within ±5 for small jitter', () => {
    const s = new VibratoSmoother()
    // Simulate slight pitch jitter: ±3 Hz around 440
    const freqs = [438, 441, 439, 442, 440, 441, 439]
    freqs.forEach((f, i) => s.process(f, 0.9, i * 30))

    const result = s.process(440, 0.9, freqs.length * 30)
    // Smoothed should be very close to 440
    const centsDev = Math.abs(1200 * Math.log2(result.smoothedFrequency / 440))
    expect(centsDev).toBeLessThan(5)
  })
})

/* ------------------------------------------------------------------ */
/*  VIBRATO DETECTION                                                  */
/* ------------------------------------------------------------------ */

describe('VibratoSmoother — vibrato detection', () => {
  it('detects vibrato with 6 Hz rate and 40 cents extent', () => {
    const s = new VibratoSmoother({ windowMs: 500 }) // wider window to capture full cycle
    const seq = generateVibratoSequence(440, 6, 40, 600, 10) // 10ms frames for density

    let result
    for (const { freq, ts } of seq) {
      result = s.process(freq, 0.95, ts)
    }

    expect(result.isVibrato).toBe(true)
    expect(result.vibratoExtent).toBeGreaterThanOrEqual(30)
    // Rate should be roughly 6 Hz (allow some tolerance)
    expect(result.vibratoRate).toBeGreaterThanOrEqual(3)
    expect(result.vibratoRate).toBeLessThanOrEqual(10)
  })

  it('does NOT flag vibrato for steady pitch', () => {
    const s = new VibratoSmoother({ windowMs: 500 })
    // Feed perfectly steady 440 Hz
    for (let t = 0; t < 500; t += 10) {
      s.process(440, 0.95, t)
    }
    const result = s.process(440, 0.95, 500)
    expect(result.isVibrato).toBe(false)
    // Extent should be very small
    expect(result.vibratoExtent).toBeLessThan(5)
  })

  it('does NOT flag vibrato for slow oscillation (< 4 Hz)', () => {
    const s = new VibratoSmoother({ windowMs: 1000 })
    // 2 Hz oscillation with 40 cents extent
    const seq = generateVibratoSequence(440, 2, 40, 1200, 10)
    let result
    for (const { freq, ts } of seq) {
      result = s.process(freq, 0.95, ts)
    }
    // Rate should be ~2 Hz which is below minVibratoRate=4
    expect(result.isVibrato).toBe(false)
  })

  it('does NOT flag vibrato for small extent (< 30 cents)', () => {
    const s = new VibratoSmoother({ windowMs: 500 })
    // 6 Hz oscillation but only 20 cents extent — below 30-cent default threshold
    const seq = generateVibratoSequence(440, 6, 20, 600, 10)
    let result
    for (const { freq, ts } of seq) {
      result = s.process(freq, 0.95, ts)
    }
    expect(result.isVibrato).toBe(false)
    expect(result.vibratoExtent).toBeLessThan(30)
  })

  it('smoothed center frequency stable during vibrato', () => {
    const s = new VibratoSmoother({ windowMs: 500 })
    // 6 Hz, 40 cents vibrato around 440 Hz
    const seq = generateVibratoSequence(440, 6, 40, 800, 10)

    let result
    for (const { freq, ts } of seq) {
      result = s.process(freq, 0.95, ts)
    }

    // Smoothed frequency should be close to the center (440 Hz)
    // Within 5 cents means within ~1.27 Hz of 440
    const centsDev = Math.abs(1200 * Math.log2(result.smoothedFrequency / 440))
    expect(centsDev).toBeLessThan(5)
  })
})

/* ------------------------------------------------------------------ */
/*  EDGE CASES                                                         */
/* ------------------------------------------------------------------ */

describe('VibratoSmoother — edge cases', () => {
  it('handles intermittent null frequencies gracefully', () => {
    const s = new VibratoSmoother()
    s.process(440, 0.9, 0)
    s.process(null, 0, 50) // dropout
    s.process(441, 0.9, 100)
    const result = s.process(440, 0.9, 150)

    expect(result.smoothedFrequency).not.toBeNull()
    // Should be close to 440
    expect(result.smoothedFrequency).toBeGreaterThan(438)
    expect(result.smoothedFrequency).toBeLessThan(443)
  })

  it('handles all samples being below confidence threshold', () => {
    const s = new VibratoSmoother({ minConfidence: 0.8 })
    s.process(440, 0.3, 0)
    s.process(441, 0.4, 50)
    const result = s.process(442, 0.5, 100)
    expect(result.smoothedFrequency).toBeNull()
  })

  it('uses default timestamp (Date.now) when not provided', () => {
    const s = new VibratoSmoother()
    // Just verify it doesn't throw
    const result = s.process(440, 0.9)
    expect(result.smoothedFrequency).toBeCloseTo(440, 0)
  })

  it('returns correct note for different pitches', () => {
    const s = new VibratoSmoother()
    const resultA = s.process(440, 0.9, 0)
    expect(resultA.smoothedNote).toBe('A4')

    s.reset()
    const resultE = s.process(659.25, 0.9, 0)
    expect(resultE.smoothedNote).toBe('E5')
  })

  it('vibrato extent is reported in cents', () => {
    const s = new VibratoSmoother({ windowMs: 500 })
    const seq = generateVibratoSequence(440, 6, 30, 600, 10)
    let result
    for (const { freq, ts } of seq) {
      result = s.process(freq, 0.95, ts)
    }
    // Extent should be roughly 30 cents (with some tolerance for windowing)
    expect(result.vibratoExtent).toBeGreaterThan(15)
    expect(result.vibratoExtent).toBeLessThan(45)
  })
})
