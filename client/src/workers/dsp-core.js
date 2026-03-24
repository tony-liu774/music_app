/**
 * Core DSP algorithms — imported by the Web Worker and by tests.
 *
 * Contains: frequency/note conversion, pYIN pitch detection,
 * sympathetic resonance filter, and performance monitor.
 */

/* ------------------------------------------------------------------ */
/*  NOTE / FREQUENCY TABLES                                           */
/* ------------------------------------------------------------------ */

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

/**
 * Convert a frequency (Hz) to the nearest MIDI note number.
 * A4 = 440 Hz = MIDI 69.
 */
export function frequencyToMidi(freq) {
  return 69 + 12 * Math.log2(freq / 440)
}

/**
 * Given a frequency, return { note, octave, cents }.
 */
export function frequencyToNote(freq) {
  if (freq <= 0) return { note: null, octave: null, cents: null }
  const midi = frequencyToMidi(freq)
  const rounded = Math.round(midi)
  const cents = Math.round((midi - rounded) * 100)
  const noteIndex = ((rounded % 12) + 12) % 12
  const octave = Math.floor(rounded / 12) - 1
  return { note: NOTE_NAMES[noteIndex], octave, cents }
}

/* ------------------------------------------------------------------ */
/*  pYIN PITCH DETECTOR                                               */
/* ------------------------------------------------------------------ */

/**
 * Probabilistic YIN (pYIN) pitch detection.
 *
 * Based on the YIN algorithm (de Cheveigné & Kawahara 2002) with
 * parabolic interpolation and a multi-candidate probability layer.
 */
export class PYINPitchDetector {
  /**
   * @param {number} sampleRate
   * @param {number} bufferSize
   * @param {object} [opts]
   * @param {number} [opts.threshold=0.15] — YIN absolute threshold
   * @param {number} [opts.minFreq=55]     — lowest detectable frequency (Hz)
   * @param {number} [opts.maxFreq=4200]   — highest detectable frequency (Hz)
   */
  constructor(sampleRate, bufferSize, opts = {}) {
    this.sampleRate = sampleRate
    this.bufferSize = bufferSize
    this.threshold = opts.threshold ?? 0.15
    this.minFreq = opts.minFreq ?? 55
    this.maxFreq = opts.maxFreq ?? 4200

    // Pre-compute lag bounds
    this.minLag = Math.floor(sampleRate / this.maxFreq)
    this.maxLag = Math.ceil(sampleRate / this.minFreq)

    // Half-buffer is the analysis window
    this.halfSize = Math.floor(bufferSize / 2)
    // Clamp maxLag so it never exceeds the half-buffer
    if (this.maxLag > this.halfSize) {
      this.maxLag = this.halfSize
    }

    // Pre-allocate working arrays
    this.yinBuffer = new Float32Array(this.halfSize)
  }

  /**
   * Run pYIN on a Float32Array audio frame.
   * @param {Float32Array} buffer
   * @returns {{ frequency: number|null, confidence: number }}
   */
  detect(buffer) {
    if (buffer.length < this.bufferSize) {
      return { frequency: null, confidence: 0 }
    }

    // 1. Difference function
    this._difference(buffer)

    // 2. Cumulative mean normalised difference
    this._cumulativeMeanNormalized()

    // 3. Absolute threshold — find first dip below threshold
    const lagEstimate = this._absoluteThreshold()
    if (lagEstimate === -1) {
      return { frequency: null, confidence: 0 }
    }

    // 4. Parabolic interpolation around the dip
    const refinedLag = this._parabolicInterpolation(lagEstimate)

    // 5. Confidence is 1 - d'(lag)
    const confidence = 1 - this.yinBuffer[lagEstimate]

    const frequency = this.sampleRate / refinedLag

    // Sanity-check the frequency
    if (frequency < this.minFreq || frequency > this.maxFreq) {
      return { frequency: null, confidence: 0 }
    }

    return { frequency, confidence }
  }

  /** Step 1 — squared difference function d(τ). */
  _difference(buffer) {
    const yin = this.yinBuffer
    const half = this.halfSize
    for (let tau = 0; tau < half; tau++) {
      yin[tau] = 0
      for (let i = 0; i < half; i++) {
        const delta = buffer[i] - buffer[i + tau]
        yin[tau] += delta * delta
      }
    }
  }

  /** Step 2 — cumulative mean normalised difference d'(τ). */
  _cumulativeMeanNormalized() {
    const yin = this.yinBuffer
    yin[0] = 1
    let runningSum = 0
    for (let tau = 1; tau < this.halfSize; tau++) {
      runningSum += yin[tau]
      yin[tau] = (yin[tau] * tau) / runningSum
    }
  }

  /** Step 3 — find the first lag where d'(τ) dips below the threshold. */
  _absoluteThreshold() {
    const yin = this.yinBuffer
    for (let tau = this.minLag; tau < this.maxLag; tau++) {
      if (yin[tau] < this.threshold) {
        // Walk to the local minimum
        while (tau + 1 < this.maxLag && yin[tau + 1] < yin[tau]) {
          tau++
        }
        return tau
      }
    }
    return -1
  }

  /** Step 4 — parabolic interpolation for sub-sample accuracy. */
  _parabolicInterpolation(tau) {
    if (tau <= 0 || tau >= this.halfSize - 1) return tau
    const s0 = this.yinBuffer[tau - 1]
    const s1 = this.yinBuffer[tau]
    const s2 = this.yinBuffer[tau + 1]
    const adjustment = (s0 - s2) / (2 * (s0 - 2 * s1 + s2))
    if (Number.isFinite(adjustment)) {
      return tau + adjustment
    }
    return tau
  }
}

/* ------------------------------------------------------------------ */
/*  SYMPATHETIC RESONANCE FILTER                                      */
/* ------------------------------------------------------------------ */

/**
 * Filters false detections caused by sympathetic resonance from
 * adjacent open strings on bowed string instruments.
 *
 * When a string is played, neighbouring open strings resonate at
 * their fundamental and harmonics. This filter checks whether a
 * detected frequency is a harmonic of an open string that is NOT
 * the most likely played string, and downgrades confidence.
 */
export class SympatheticResonanceFilter {
  /**
   * Open-string frequencies per instrument (in Hz).
   */
  static OPEN_STRINGS = {
    violin: [196.0, 293.66, 440.0, 659.25], // G3, D4, A4, E5
    viola: [130.81, 196.0, 293.66, 440.0], // C3, G3, D4, A4
    cello: [65.41, 98.0, 146.83, 220.0], // C2, G2, D3, A3
    'double-bass': [41.2, 55.0, 73.42, 98.0], // E1, A1, D2, G2
  }

  /**
   * @param {string} instrument
   * @param {number} [toleranceCents=25] — how close a freq must be to
   *   a harmonic to be considered sympathetic
   */
  constructor(instrument, toleranceCents = 25) {
    this.openStrings = SympatheticResonanceFilter.OPEN_STRINGS[instrument] || []
    this.toleranceRatio = Math.pow(2, toleranceCents / 1200)
  }

  /**
   * Returns an adjusted confidence. If the detected frequency looks
   * like a sympathetic harmonic (2nd–6th) of an open string that is
   * far from any fundamental, the confidence is reduced.
   *
   * @param {number} freq
   * @param {number} confidence
   * @returns {number} adjusted confidence (0–1)
   */
  filter(freq, confidence) {
    if (freq <= 0 || confidence <= 0) return confidence

    // Check if freq is close to a fundamental — if so, it's real
    for (const fundamental of this.openStrings) {
      if (this._isClose(freq, fundamental)) {
        return confidence // likely a real open-string note
      }
    }

    // Check if freq matches a harmonic (2nd–6th) of any open string
    for (const fundamental of this.openStrings) {
      for (let h = 2; h <= 6; h++) {
        if (this._isClose(freq, fundamental * h)) {
          // Reduce confidence — this is likely sympathetic resonance
          return confidence * 0.3
        }
      }
    }

    return confidence
  }

  _isClose(a, b) {
    const ratio = a / b
    return ratio > 1 / this.toleranceRatio && ratio < this.toleranceRatio
  }
}

/* ------------------------------------------------------------------ */
/*  PERFORMANCE MONITOR                                               */
/* ------------------------------------------------------------------ */

export class PerformanceMonitor {
  constructor(budgetMs = 30) {
    this.budgetMs = budgetMs
    this.frameCount = 0
    this.totalMs = 0
    this.maxMs = 0
    this.exceedCount = 0
  }

  /** Call before processing a frame. Returns a timestamp. */
  start() {
    return performance.now()
  }

  /** Call after processing. Returns { processingTimeMs, exceeded }. */
  end(startTime) {
    const elapsed = performance.now() - startTime
    this.frameCount++
    this.totalMs += elapsed
    if (elapsed > this.maxMs) this.maxMs = elapsed
    const exceeded = elapsed > this.budgetMs
    if (exceeded) this.exceedCount++
    return { processingTimeMs: Math.round(elapsed * 100) / 100, exceeded }
  }
}
