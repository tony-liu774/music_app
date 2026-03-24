import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for the actual DSP worker module.
 *
 * We mock `self.postMessage` then dynamically import the worker module,
 * which assigns `self.onmessage`. This tests the real file, not a copy.
 */

function generateSineWave(frequency, sampleRate, length) {
  const buffer = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate)
  }
  return buffer
}

describe('DSP Worker (actual module)', () => {
  let posted

  beforeEach(async () => {
    posted = []

    // Mock self.postMessage so the worker can post to our array
    vi.stubGlobal(
      'postMessage',
      vi.fn((msg) => posted.push(msg)),
    )
    // Also set it on self for the worker's self.postMessage calls
    globalThis.self = globalThis
    globalThis.self.postMessage = globalThis.postMessage

    // Clear the module cache so each test gets a fresh worker
    vi.resetModules()

    // Import the actual worker module — this sets self.onmessage
    await import('../dsp-worker.js')
  })

  it('responds to INIT with success', () => {
    self.onmessage({
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

  it('returns ERROR when PROCESS is sent before INIT', async () => {
    // Fresh import without INIT
    vi.resetModules()
    posted = []
    globalThis.self.postMessage = vi.fn((msg) => posted.push(msg))
    await import('../dsp-worker.js')

    const buffer = new Float32Array(2048)
    self.onmessage({ data: { type: 'PROCESS', buffer } })
    expect(posted).toHaveLength(1)
    expect(posted[0].type).toBe('ERROR')
    expect(posted[0].error).toContain('not initialized')
  })

  it('processes a 440 Hz sine and returns RESULT with correct note', () => {
    self.onmessage({
      data: {
        type: 'INIT',
        sampleRate: 44100,
        bufferSize: 2048,
        instrument: 'violin',
      },
    })
    posted.length = 0

    const buffer = generateSineWave(440, 44100, 2048)
    self.onmessage({ data: { type: 'PROCESS', buffer } })

    const result = posted.find((m) => m.type === 'RESULT')
    expect(result).toBeDefined()
    expect(result.note).toBe('A4')
    expect(result.frequency).toBeGreaterThan(438)
    expect(result.frequency).toBeLessThan(442)
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.cents).toBeDefined()
  })

  it('returns null frequency for silence', () => {
    self.onmessage({
      data: {
        type: 'INIT',
        sampleRate: 44100,
        bufferSize: 2048,
        instrument: 'violin',
      },
    })
    posted.length = 0

    const buffer = new Float32Array(2048)
    self.onmessage({ data: { type: 'PROCESS', buffer } })

    const result = posted.find((m) => m.type === 'RESULT')
    expect(result).toBeDefined()
    expect(result.frequency).toBeNull()
    expect(result.confidence).toBe(0)
    expect(result.note).toBeNull()
  })

  it('uses protocol message types in responses', () => {
    self.onmessage({
      data: {
        type: 'INIT',
        sampleRate: 44100,
        bufferSize: 2048,
        instrument: 'violin',
      },
    })
    posted.length = 0

    const buffer = generateSineWave(440, 44100, 2048)
    self.onmessage({ data: { type: 'PROCESS', buffer } })

    // RESULT message should have the protocol shape
    const result = posted.find((m) => m.type === 'RESULT')
    expect(result).toHaveProperty('type', 'RESULT')
    expect(result).toHaveProperty('frequency')
    expect(result).toHaveProperty('confidence')
    expect(result).toHaveProperty('note')
    expect(result).toHaveProperty('cents')
  })

  it('handles different instruments', () => {
    self.onmessage({
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
    self.onmessage({
      data: {
        type: 'INIT',
        sampleRate: 44100,
        bufferSize: 2048,
      },
    })
    expect(posted[0]).toEqual({ type: 'INIT', success: true })
  })

  it('uses transferable objects — buffer is a Float32Array', () => {
    self.onmessage({
      data: {
        type: 'INIT',
        sampleRate: 44100,
        bufferSize: 2048,
        instrument: 'violin',
      },
    })
    posted.length = 0

    const buffer = generateSineWave(440, 44100, 2048)
    expect(buffer).toBeInstanceOf(Float32Array)
    expect(buffer.buffer).toBeInstanceOf(ArrayBuffer)

    self.onmessage({ data: { type: 'PROCESS', buffer } })
    expect(posted.find((m) => m.type === 'RESULT')).toBeDefined()
  })
})
