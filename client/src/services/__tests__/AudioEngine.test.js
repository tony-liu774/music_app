import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AudioEngine } from '../AudioEngine'

// Mock Web Worker
class MockWorker {
  constructor() {
    this.onmessage = null
    this.onerror = null
    this.postMessage = vi.fn()
    this.terminate = vi.fn()
  }
}

// Mock AudioContext
function createMockAudioContext() {
  const analyser = {
    fftSize: 0,
    frequencyBinCount: 128,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteTimeDomainData: vi.fn((buffer) => {
      // Fill with 128 (silence)
      for (let i = 0; i < buffer.length; i++) buffer[i] = 128
    }),
  }
  const source = { connect: vi.fn(), disconnect: vi.fn() }
  const processor = {
    onaudioprocess: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }

  const ctx = {
    state: 'running',
    sampleRate: 44100,
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createMediaStreamSource: vi.fn().mockReturnValue(source),
    createAnalyser: vi.fn().mockReturnValue(analyser),
    createScriptProcessor: vi.fn().mockReturnValue(processor),
    destination: {},
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }

  return { ctx, analyser, source, processor }
}

describe('AudioEngine', () => {
  let originalAudioContext

  beforeEach(() => {
    originalAudioContext = window.AudioContext
    vi.stubGlobal('Worker', MockWorker)
  })

  afterEach(() => {
    window.AudioContext = originalAudioContext
    vi.restoreAllMocks()
  })

  it('initializes with default options', () => {
    const engine = new AudioEngine()
    expect(engine.bufferSize).toBe(2048)
    expect(engine.instrument).toBe('violin')
    expect(engine.tuningReference).toBe(440)
    expect(engine.isRunning).toBe(false)
    expect(engine.contextState).toBe('closed')
  })

  it('accepts custom options', () => {
    const engine = new AudioEngine({
      bufferSize: 4096,
      instrument: 'cello',
      tuningReference: 442,
    })
    expect(engine.bufferSize).toBe(4096)
    expect(engine.instrument).toBe('cello')
    expect(engine.tuningReference).toBe(442)
  })

  it('starts with a MediaStream', async () => {
    const { ctx } = createMockAudioContext()
    vi.stubGlobal('AudioContext', vi.fn().mockReturnValue(ctx))

    const engine = new AudioEngine()
    const stream = { getTracks: () => [{ stop: vi.fn() }] }

    await engine.start(stream)

    expect(engine.isRunning).toBe(true)
    expect(engine.contextState).toBe('running')
    expect(engine.sampleRate).toBe(44100)
    expect(ctx.createMediaStreamSource).toHaveBeenCalledWith(stream)
    expect(ctx.createAnalyser).toHaveBeenCalled()

    engine.stop()
  })

  it('resumes suspended AudioContext on start', async () => {
    const { ctx } = createMockAudioContext()
    ctx.state = 'suspended'
    vi.stubGlobal('AudioContext', vi.fn().mockReturnValue(ctx))

    const engine = new AudioEngine()
    const stream = { getTracks: () => [{ stop: vi.fn() }] }

    await engine.start(stream)

    expect(ctx.resume).toHaveBeenCalled()
    engine.stop()
  })

  it('sends INIT message to worker with tuning reference', async () => {
    const { ctx } = createMockAudioContext()
    vi.stubGlobal('AudioContext', vi.fn().mockReturnValue(ctx))

    const engine = new AudioEngine({ tuningReference: 442, instrument: 'viola' })
    const stream = { getTracks: () => [{ stop: vi.fn() }] }

    await engine.start(stream)

    expect(engine.worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'INIT',
        sampleRate: 44100,
        bufferSize: 2048,
        instrument: 'viola',
        tuningReference: 442,
      }),
    )

    engine.stop()
  })

  it('stops and cleans up all resources', async () => {
    const { ctx, processor, analyser, source } = createMockAudioContext()
    vi.stubGlobal('AudioContext', vi.fn().mockReturnValue(ctx))

    const trackStop = vi.fn()
    const stream = { getTracks: () => [{ stop: trackStop }] }
    const engine = new AudioEngine()

    await engine.start(stream)
    engine.stop()

    expect(engine.isRunning).toBe(false)
    expect(processor.disconnect).toHaveBeenCalled()
    expect(analyser.disconnect).toHaveBeenCalled()
    expect(source.disconnect).toHaveBeenCalled()
    expect(ctx.close).toHaveBeenCalled()
    expect(trackStop).toHaveBeenCalled()
  })

  it('does not start twice', async () => {
    const { ctx } = createMockAudioContext()
    vi.stubGlobal('AudioContext', vi.fn().mockReturnValue(ctx))

    const engine = new AudioEngine()
    const stream = { getTracks: () => [{ stop: vi.fn() }] }

    await engine.start(stream)
    await engine.start(stream) // should be no-op

    expect(engine.isRunning).toBe(true)
    engine.stop()
  })

  it('calls onResult callback for RESULT messages', async () => {
    const { ctx } = createMockAudioContext()
    vi.stubGlobal('AudioContext', vi.fn().mockReturnValue(ctx))

    const engine = new AudioEngine()
    const resultCallback = vi.fn()
    engine.onResult(resultCallback)

    const stream = { getTracks: () => [{ stop: vi.fn() }] }
    await engine.start(stream)

    // Simulate worker message
    engine.worker.onmessage({
      data: {
        type: 'RESULT',
        frequency: 440,
        confidence: 0.95,
        note: 'A4',
        cents: 0,
        vibrato: null,
      },
    })

    expect(resultCallback).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'RESULT', frequency: 440 }),
    )

    engine.stop()
  })

  it('calls onError callback for ERROR messages', async () => {
    const { ctx } = createMockAudioContext()
    vi.stubGlobal('AudioContext', vi.fn().mockReturnValue(ctx))

    const engine = new AudioEngine()
    const errorCallback = vi.fn()
    engine.onError(errorCallback)

    const stream = { getTracks: () => [{ stop: vi.fn() }] }
    await engine.start(stream)

    engine.worker.onmessage({
      data: { type: 'ERROR', error: 'test error' },
    })

    expect(errorCallback).toHaveBeenCalledWith(expect.any(Error))
    expect(errorCallback.mock.calls[0][0].message).toBe('test error')

    engine.stop()
  })

  it('getInputLevel returns 0 when not started', () => {
    const engine = new AudioEngine()
    expect(engine.getInputLevel()).toBe(0)
  })

  it('getInputLevel returns value from AnalyserNode', async () => {
    const { ctx, analyser } = createMockAudioContext()
    analyser.getByteTimeDomainData = vi.fn((buffer) => {
      // Simulate a loud signal
      for (let i = 0; i < buffer.length; i++) buffer[i] = 200
    })
    vi.stubGlobal('AudioContext', vi.fn().mockReturnValue(ctx))

    const engine = new AudioEngine()
    const stream = { getTracks: () => [{ stop: vi.fn() }] }
    await engine.start(stream)

    const level = engine.getInputLevel()
    expect(level).toBeGreaterThan(0)

    engine.stop()
  })

  it('resume returns true when not suspended', async () => {
    const engine = new AudioEngine()
    const result = await engine.resume()
    expect(result).toBe(true)
  })
})
