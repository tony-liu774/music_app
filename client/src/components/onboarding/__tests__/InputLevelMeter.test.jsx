import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import InputLevelMeter from '../InputLevelMeter'

// Mock AudioContext
function createMockAudioContext() {
  const analyser = {
    fftSize: 0,
    frequencyBinCount: 128,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteTimeDomainData: vi.fn((buffer) => {
      for (let i = 0; i < buffer.length; i++) buffer[i] = 128
    }),
  }
  const source = { connect: vi.fn(), disconnect: vi.fn() }

  return {
    createMediaStreamSource: vi.fn().mockReturnValue(source),
    createAnalyser: vi.fn().mockReturnValue(analyser),
    close: vi.fn(),
    analyser,
    source,
  }
}

describe('InputLevelMeter', () => {
  let originalAudioContext
  let mockCtx

  beforeEach(() => {
    originalAudioContext = window.AudioContext

    mockCtx = createMockAudioContext()
    vi.stubGlobal('AudioContext', vi.fn().mockReturnValue(mockCtx))
    // Do NOT call rAF callback synchronously — causes infinite recursion.
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    window.AudioContext = originalAudioContext
    vi.restoreAllMocks()
  })

  it('renders a meter element', () => {
    render(<InputLevelMeter stream={null} active={false} />)
    expect(screen.getByRole('meter')).toBeInTheDocument()
  })

  it('renders 20 bars', () => {
    const { container } = render(
      <InputLevelMeter stream={null} active={false} />,
    )
    const bars = container.querySelectorAll('[role="meter"] > div')
    expect(bars).toHaveLength(20)
  })

  it('has aria attributes', () => {
    render(<InputLevelMeter stream={null} active={false} />)
    const meter = screen.getByRole('meter')
    expect(meter).toHaveAttribute('aria-valuemin', '0')
    expect(meter).toHaveAttribute('aria-valuemax', '100')
    expect(meter).toHaveAttribute('aria-label', 'Microphone input level')
  })

  it('creates AudioContext from stream when no analyserNode is provided', () => {
    const stream = { getTracks: () => [] }
    render(<InputLevelMeter stream={stream} active={true} />)
    expect(mockCtx.createMediaStreamSource).toHaveBeenCalledWith(stream)
    expect(mockCtx.createAnalyser).toHaveBeenCalled()
  })

  it('does not create AudioContext when not active', () => {
    const stream = { getTracks: () => [] }
    render(<InputLevelMeter stream={stream} active={false} />)
    expect(mockCtx.createMediaStreamSource).not.toHaveBeenCalled()
  })

  it('does not create AudioContext when no stream', () => {
    render(<InputLevelMeter stream={null} active={true} />)
    expect(mockCtx.createMediaStreamSource).not.toHaveBeenCalled()
  })

  it('uses external analyserNode when provided (no new AudioContext)', () => {
    const externalAnalyser = {
      frequencyBinCount: 128,
      getByteTimeDomainData: vi.fn((buffer) => {
        for (let i = 0; i < buffer.length; i++) buffer[i] = 128
      }),
    }

    render(
      <InputLevelMeter analyserNode={externalAnalyser} active={true} />,
    )

    // Should NOT create a new AudioContext when external analyser is provided
    expect(mockCtx.createAnalyser).not.toHaveBeenCalled()
    expect(mockCtx.createMediaStreamSource).not.toHaveBeenCalled()
    // Should start rAF loop
    expect(requestAnimationFrame).toHaveBeenCalled()
  })

  it('skips stream-based AudioContext when analyserNode is provided', () => {
    const externalAnalyser = {
      frequencyBinCount: 128,
      getByteTimeDomainData: vi.fn(),
    }
    const stream = { getTracks: () => [] }

    render(
      <InputLevelMeter
        analyserNode={externalAnalyser}
        stream={stream}
        active={true}
      />,
    )

    // External analyser takes priority — no AudioContext created
    expect(mockCtx.createMediaStreamSource).not.toHaveBeenCalled()
  })
})
