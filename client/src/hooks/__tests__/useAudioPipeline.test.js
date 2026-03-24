import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAudioPipeline } from '../useAudioPipeline'
import { useAudioStore } from '../../stores/useAudioStore'

// Mock Worker
class MockWorker {
  constructor() {
    this.onmessage = null
    this.postMessage = vi.fn()
    this.terminate = vi.fn()
    MockWorker.instances.push(this)
  }

  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data })
    }
  }
}
MockWorker.instances = []

// Mock AudioContext
function createMockAudioContext() {
  const processor = {
    onaudioprocess: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }

  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  }

  const ctx = {
    sampleRate: 44100,
    state: 'running',
    onstatechange: null,
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createMediaStreamSource: vi.fn().mockReturnValue(source),
    createScriptProcessor: vi.fn().mockReturnValue(processor),
    destination: {},
    _source: source,
    _processor: processor,
  }

  return ctx
}

function createMockStream() {
  const track = { stop: vi.fn(), kind: 'audio' }
  return {
    getTracks: () => [track],
    _track: track,
  }
}

describe('useAudioPipeline', () => {
  let mockAudioCtx

  beforeEach(() => {
    MockWorker.instances = []
    mockAudioCtx = createMockAudioContext()

    // Reset the audio store
    useAudioStore.setState({
      pitchData: { frequency: null, note: null, cents: null, confidence: 0 },
      audioContextState: 'suspended',
      selectedInstrument: 'violin',
    })

    // Mock Worker constructor
    vi.stubGlobal(
      'Worker',
      vi.fn().mockImplementation(() => new MockWorker()),
    )

    // Mock AudioContext
    vi.stubGlobal(
      'AudioContext',
      vi.fn().mockImplementation(() => mockAudioCtx),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns start, stop, and isRunning', () => {
    const { result } = renderHook(() => useAudioPipeline())
    expect(result.current.start).toBeInstanceOf(Function)
    expect(result.current.stop).toBeInstanceOf(Function)
    expect(typeof result.current.isRunning).toBe('boolean')
  })

  it('is not running initially', () => {
    const { result } = renderHook(() => useAudioPipeline())
    expect(result.current.isRunning).toBe(false)
  })

  it('creates an AudioContext and Worker when start is called', async () => {
    const { result } = renderHook(() => useAudioPipeline())
    const stream = createMockStream()

    await act(async () => {
      await result.current.start(stream)
    })

    // AudioContext was created
    expect(AudioContext).toHaveBeenCalled()

    // Worker was created
    expect(Worker).toHaveBeenCalled()
    expect(MockWorker.instances).toHaveLength(1)

    // Worker received INIT message
    const worker = MockWorker.instances[0]
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'INIT',
        sampleRate: 44100,
        bufferSize: 2048,
        instrument: 'violin',
      }),
    )
  })

  it('connects MediaStream source to ScriptProcessor', async () => {
    const { result } = renderHook(() => useAudioPipeline())
    const stream = createMockStream()

    await act(async () => {
      await result.current.start(stream)
    })

    expect(mockAudioCtx.createMediaStreamSource).toHaveBeenCalledWith(stream)
    expect(mockAudioCtx.createScriptProcessor).toHaveBeenCalledWith(2048, 1, 1)

    // Source → Processor → Destination
    expect(mockAudioCtx._source.connect).toHaveBeenCalledWith(
      mockAudioCtx._processor,
    )
    expect(mockAudioCtx._processor.connect).toHaveBeenCalledWith(
      mockAudioCtx.destination,
    )
  })

  it('sends audio buffers to worker with transferable ArrayBuffer', async () => {
    const { result } = renderHook(() => useAudioPipeline())
    const stream = createMockStream()

    await act(async () => {
      await result.current.start(stream)
    })

    const processor = mockAudioCtx._processor
    const worker = MockWorker.instances[0]

    // Simulate an audio processing event
    const inputBuffer = {
      getChannelData: vi.fn().mockReturnValue(new Float32Array(2048)),
    }
    const audioEvent = { inputBuffer }

    processor.onaudioprocess(audioEvent)

    // Worker should receive a PROCESS message with transferable
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PROCESS' }),
      expect.any(Array), // transferable list
    )

    // The second argument should contain an ArrayBuffer
    const lastCall = worker.postMessage.mock.calls.at(-1)
    expect(lastCall[1][0]).toBeInstanceOf(ArrayBuffer)
  })

  it('updates audio store when worker posts RESULT', async () => {
    const { result } = renderHook(() => useAudioPipeline())
    const stream = createMockStream()

    await act(async () => {
      await result.current.start(stream)
    })

    const worker = MockWorker.instances[0]

    await act(async () => {
      worker.simulateMessage({
        type: 'RESULT',
        frequency: 440,
        confidence: 0.95,
        note: 'A4',
        cents: 0,
      })
    })

    const state = useAudioStore.getState()
    expect(state.pitchData).toEqual({
      frequency: 440,
      confidence: 0.95,
      note: 'A4',
      cents: 0,
    })
  })

  it('stops pipeline and releases resources', async () => {
    const { result } = renderHook(() => useAudioPipeline())
    const stream = createMockStream()

    await act(async () => {
      await result.current.start(stream)
    })

    const worker = MockWorker.instances[0]

    act(() => {
      result.current.stop()
    })

    expect(worker.terminate).toHaveBeenCalled()
    expect(mockAudioCtx.close).toHaveBeenCalled()
    expect(result.current.isRunning).toBe(false)

    // Pitch data should be reset
    const state = useAudioStore.getState()
    expect(state.pitchData.frequency).toBeNull()
    expect(state.audioContextState).toBe('closed')
  })

  it('terminates worker on unmount', async () => {
    const { result, unmount } = renderHook(() => useAudioPipeline())
    const stream = createMockStream()

    await act(async () => {
      await result.current.start(stream)
    })

    const worker = MockWorker.instances[0]

    unmount()

    expect(worker.terminate).toHaveBeenCalled()
    expect(mockAudioCtx.close).toHaveBeenCalled()
  })

  it('resumes suspended AudioContext', async () => {
    mockAudioCtx.state = 'suspended'
    const { result } = renderHook(() => useAudioPipeline())
    const stream = createMockStream()

    await act(async () => {
      await result.current.start(stream)
    })

    expect(mockAudioCtx.resume).toHaveBeenCalled()
  })

  it('does not start twice if already running', async () => {
    const { result } = renderHook(() => useAudioPipeline())
    const stream = createMockStream()

    await act(async () => {
      await result.current.start(stream)
    })

    await act(async () => {
      await result.current.start(stream)
    })

    // Only one Worker should have been created
    expect(MockWorker.instances).toHaveLength(1)
  })

  it('accepts custom bufferSize', async () => {
    const { result } = renderHook(() => useAudioPipeline({ bufferSize: 4096 }))
    const stream = createMockStream()

    await act(async () => {
      await result.current.start(stream)
    })

    expect(mockAudioCtx.createScriptProcessor).toHaveBeenCalledWith(4096, 1, 1)

    const worker = MockWorker.instances[0]
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'INIT',
        bufferSize: 4096,
      }),
    )
  })

  it('updates audioContextState in the store', async () => {
    const { result } = renderHook(() => useAudioPipeline())
    const stream = createMockStream()

    await act(async () => {
      await result.current.start(stream)
    })

    const state = useAudioStore.getState()
    expect(state.audioContextState).toBe('running')
  })
})
