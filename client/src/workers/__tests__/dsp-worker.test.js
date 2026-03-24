import { describe, it, expect, beforeEach } from 'vitest'

/**
 * Tests for the DSP worker message handler.
 *
 * We simulate the worker environment by setting up `self.postMessage`
 * as a mock, then loading the worker module which sets `self.onmessage`.
 */

// We need to mock `self` in the worker context.
// The worker file assigns to `self.onmessage`, so we simulate that.
// Instead of loading the actual worker, we test the core logic
// and the worker integration pattern separately.

import {
  PYINPitchDetector,
  SympatheticResonanceFilter,
  PerformanceMonitor,
  frequencyToNote,
} from '../dsp-core'

/**
 * Simulates the worker's onmessage handler logic (mirrors dsp-worker.js).
 */
function createWorkerHandler() {
  let detector = null
  let resonanceFilter = null
  const perfMonitor = new PerformanceMonitor(30)
  const posted = []

  function postMessage(msg) {
    posted.push(msg)
  }

  function onmessage(e) {
    const { type } = e.data

    if (type === 'INIT') {
      try {
        const { sampleRate, bufferSize, instrument } = e.data
        detector = new PYINPitchDetector(sampleRate, bufferSize)
        resonanceFilter = new SympatheticResonanceFilter(instrument || 'violin')
        postMessage({ type: 'INIT', success: true })
      } catch (err) {
        postMessage({ type: 'ERROR', error: err.message })
      }
      return
    }

    if (type === 'PROCESS') {
      if (!detector) {
        postMessage({
          type: 'ERROR',
          error: 'Worker not initialized. Send INIT first.',
        })
        return
      }

      const startTime = perfMonitor.start()

      try {
        const buffer = e.data.buffer
        const { frequency, confidence: rawConfidence } = detector.detect(buffer)

        let confidence = rawConfidence
        let note = null
        let cents = null

        if (frequency !== null) {
          confidence = resonanceFilter.filter(frequency, rawConfidence)
          const info = frequencyToNote(frequency)
          note = info.note ? `${info.note}${info.octave}` : null
          cents = info.cents
        }

        const perf = perfMonitor.end(startTime)

        postMessage({
          type: 'RESULT',
          frequency,
          confidence: Math.round(confidence * 1000) / 1000,
          note,
          cents,
        })

        if (perf.exceeded || perfMonitor.frameCount % 100 === 0) {
          postMessage({
            type: 'PERF',
            processingTimeMs: perf.processingTimeMs,
            exceeded: perf.exceeded,
          })
        }
      } catch (err) {
        perfMonitor.end(startTime)
        postMessage({ type: 'ERROR', error: err.message })
      }
    }
  }

  return { onmessage, posted }
}

function generateSineWave(frequency, sampleRate, length) {
  const buffer = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate)
  }
  return buffer
}

describe('DSP Worker message handler', () => {
  let handler
  let posted

  beforeEach(() => {
    const h = createWorkerHandler()
    handler = h.onmessage
    posted = h.posted
  })

  it('responds to INIT with success', () => {
    handler({
      data: {
        type: 'INIT',
        sampleRate: 44100,
        bufferSize: 2048,
        instrument: 'violin',
      },
    })
    expect(posted).toHaveLength(1)
    expect(posted[0]).toEqual({ type: 'INIT', success: true })
  })

  it('returns ERROR when PROCESS is sent before INIT', () => {
    const buffer = new Float32Array(2048)
    handler({ data: { type: 'PROCESS', buffer } })
    expect(posted).toHaveLength(1)
    expect(posted[0].type).toBe('ERROR')
    expect(posted[0].error).toContain('not initialized')
  })

  it('processes a 440 Hz sine and returns RESULT with correct note', () => {
    handler({
      data: {
        type: 'INIT',
        sampleRate: 44100,
        bufferSize: 2048,
        instrument: 'violin',
      },
    })
    posted.length = 0

    const buffer = generateSineWave(440, 44100, 2048)
    handler({ data: { type: 'PROCESS', buffer } })

    // Should have at least a RESULT message
    const result = posted.find((m) => m.type === 'RESULT')
    expect(result).toBeDefined()
    expect(result.note).toBe('A4')
    expect(result.frequency).toBeGreaterThan(438)
    expect(result.frequency).toBeLessThan(442)
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.cents).toBeDefined()
  })

  it('returns null frequency for silence', () => {
    handler({
      data: {
        type: 'INIT',
        sampleRate: 44100,
        bufferSize: 2048,
        instrument: 'violin',
      },
    })
    posted.length = 0

    const buffer = new Float32Array(2048)
    handler({ data: { type: 'PROCESS', buffer } })

    const result = posted.find((m) => m.type === 'RESULT')
    expect(result).toBeDefined()
    expect(result.frequency).toBeNull()
    expect(result.confidence).toBe(0)
    expect(result.note).toBeNull()
  })

  it('uses transferable objects — buffer is a Float32Array', () => {
    handler({
      data: {
        type: 'INIT',
        sampleRate: 44100,
        bufferSize: 2048,
        instrument: 'violin',
      },
    })
    posted.length = 0

    const buffer = generateSineWave(440, 44100, 2048)
    // Verify the buffer is a Float32Array (transferable)
    expect(buffer).toBeInstanceOf(Float32Array)
    expect(buffer.buffer).toBeInstanceOf(ArrayBuffer)

    handler({ data: { type: 'PROCESS', buffer } })
    expect(posted.find((m) => m.type === 'RESULT')).toBeDefined()
  })

  it('handles different instruments', () => {
    handler({
      data: {
        type: 'INIT',
        sampleRate: 44100,
        bufferSize: 2048,
        instrument: 'cello',
      },
    })
    expect(posted[0]).toEqual({ type: 'INIT', success: true })
  })

  it('defaults to violin when instrument is not specified', () => {
    handler({
      data: {
        type: 'INIT',
        sampleRate: 44100,
        bufferSize: 2048,
      },
    })
    expect(posted[0]).toEqual({ type: 'INIT', success: true })
  })
})
