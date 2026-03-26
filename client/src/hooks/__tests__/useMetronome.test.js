import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useMetronome from '../useMetronome'

// Mock Web Audio API
const mockOscillator = {
  type: 'sine',
  frequency: { setValueAtTime: vi.fn() },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}

const mockGain = {
  gain: {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
}

const mockAudioContext = {
  state: 'running',
  currentTime: 0,
  destination: {},
  createOscillator: vi.fn(() => ({ ...mockOscillator })),
  createGain: vi.fn(() => ({
    ...mockGain,
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
  })),
  resume: vi.fn(),
  close: vi.fn(),
}

describe('useMetronome', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.AudioContext = vi.fn(() => ({ ...mockAudioContext }))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not start when not enabled', () => {
    renderHook(() =>
      useMetronome({ tempo: 120, beatsPerMeasure: 4, enabled: false }),
    )
    expect(window.AudioContext).not.toHaveBeenCalled()
  })

  it('creates AudioContext and plays clicks when enabled', () => {
    renderHook(() =>
      useMetronome({ tempo: 120, beatsPerMeasure: 4, enabled: true }),
    )
    expect(window.AudioContext).toHaveBeenCalled()
  })

  it('plays first click immediately on start (accent)', () => {
    const createOsc = vi.fn(() => ({ ...mockOscillator }))
    const createGain = vi.fn(() => ({
      ...mockGain,
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    }))
    window.AudioContext = vi.fn(() => ({
      ...mockAudioContext,
      createOscillator: createOsc,
      createGain: createGain,
    }))

    renderHook(() =>
      useMetronome({ tempo: 120, beatsPerMeasure: 4, enabled: true }),
    )

    // First click is played immediately
    expect(createOsc).toHaveBeenCalledTimes(1)
  })

  it('plays subsequent clicks at interval based on tempo', () => {
    const createOsc = vi.fn(() => ({ ...mockOscillator }))
    const createGain = vi.fn(() => ({
      ...mockGain,
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    }))
    window.AudioContext = vi.fn(() => ({
      ...mockAudioContext,
      createOscillator: createOsc,
      createGain: createGain,
    }))

    renderHook(() =>
      useMetronome({ tempo: 120, beatsPerMeasure: 4, enabled: true }),
    )

    // 120 BPM = 500ms per beat
    // First click immediate = 1 call
    expect(createOsc).toHaveBeenCalledTimes(1)

    // Advance 500ms → second click
    act(() => vi.advanceTimersByTime(500))
    expect(createOsc).toHaveBeenCalledTimes(2)

    // Advance another 500ms → third click
    act(() => vi.advanceTimersByTime(500))
    expect(createOsc).toHaveBeenCalledTimes(3)
  })

  it('stops playing clicks when disabled', () => {
    const createOsc = vi.fn(() => ({ ...mockOscillator }))
    const createGain = vi.fn(() => ({
      ...mockGain,
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    }))
    window.AudioContext = vi.fn(() => ({
      ...mockAudioContext,
      createOscillator: createOsc,
      createGain: createGain,
    }))

    const { rerender } = renderHook(
      ({ enabled }) =>
        useMetronome({ tempo: 120, beatsPerMeasure: 4, enabled }),
      { initialProps: { enabled: true } },
    )

    expect(createOsc).toHaveBeenCalledTimes(1)

    // Disable
    rerender({ enabled: false })
    const countAfterDisable = createOsc.mock.calls.length

    // Advance time — no more clicks should fire
    act(() => vi.advanceTimersByTime(2000))
    expect(createOsc).toHaveBeenCalledTimes(countAfterDisable)
  })

  it('restarts interval when tempo changes while enabled', () => {
    const createOsc = vi.fn(() => ({ ...mockOscillator }))
    const createGain = vi.fn(() => ({
      ...mockGain,
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    }))
    window.AudioContext = vi.fn(() => ({
      ...mockAudioContext,
      createOscillator: createOsc,
      createGain: createGain,
    }))

    const { rerender } = renderHook(
      ({ tempo }) => useMetronome({ tempo, beatsPerMeasure: 4, enabled: true }),
      { initialProps: { tempo: 120 } },
    )

    // First click at start
    const initialCount = createOsc.mock.calls.length

    // Change tempo to 60 BPM (1000ms per beat)
    rerender({ tempo: 60 })

    // New first click from restart
    const afterChange = createOsc.mock.calls.length
    expect(afterChange).toBeGreaterThan(initialCount)
  })

  it('cleans up AudioContext on unmount', () => {
    const closeFn = vi.fn()
    window.AudioContext = vi.fn(() => ({
      ...mockAudioContext,
      state: 'running',
      close: closeFn,
    }))

    const { unmount } = renderHook(() =>
      useMetronome({ tempo: 120, beatsPerMeasure: 4, enabled: true }),
    )

    unmount()
    expect(closeFn).toHaveBeenCalled()
  })

  it('returns audioContextRef', () => {
    const { result } = renderHook(() =>
      useMetronome({ tempo: 120, beatsPerMeasure: 4, enabled: false }),
    )
    expect(result.current).toHaveProperty('audioContextRef')
  })
})
