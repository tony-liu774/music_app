import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import IntonationNeedle, {
  computeOpacity,
  isDrifting,
} from '../IntonationNeedle'
import { useAudioStore } from '../../../stores/useAudioStore'

// Mock useSettingsStore
vi.mock('../../../stores/useSettingsStore', () => ({
  useSettingsStore: vi.fn((selector) => selector({ needleSensitivity: 1.0 })),
}))

// Track RAF callbacks for manual flushing
let rafCallbacks = []
let rafId = 0

function flushRAF() {
  const callbacks = [...rafCallbacks]
  rafCallbacks = []
  callbacks.forEach((cb) => cb())
}

describe('computeOpacity', () => {
  it('returns 0 for 0 cents deviation', () => {
    expect(computeOpacity(0)).toBe(0)
  })

  it('returns 0 for exactly 10 cents deviation', () => {
    expect(computeOpacity(10)).toBe(0)
  })

  it('returns 0 for values below 10 cents', () => {
    expect(computeOpacity(5)).toBe(0)
    expect(computeOpacity(9.9)).toBe(0)
  })

  it('returns values between 0 and 1 for 10-25 cents', () => {
    const opacity = computeOpacity(17.5)
    expect(opacity).toBe(0.5)
  })

  it('returns 1 for exactly 25 cents', () => {
    expect(computeOpacity(25)).toBe(1)
  })

  it('returns 1 for values above 25 cents', () => {
    expect(computeOpacity(30)).toBe(1)
    expect(computeOpacity(50)).toBe(1)
  })

  it('scales linearly between 10 and 25 cents', () => {
    expect(computeOpacity(15)).toBeCloseTo(1 / 3)
    expect(computeOpacity(20)).toBeCloseTo(2 / 3)
  })
})

describe('isDrifting', () => {
  it('returns true when previous cents is null', () => {
    expect(isDrifting(15, null)).toBe(true)
  })

  it('returns true when moving away from center', () => {
    expect(isDrifting(20, 15)).toBe(true)
    expect(isDrifting(-20, -15)).toBe(true)
  })

  it('returns false when moving toward center', () => {
    expect(isDrifting(10, 15)).toBe(false)
    expect(isDrifting(-10, -15)).toBe(false)
  })

  it('returns true when staying the same distance', () => {
    expect(isDrifting(15, 15)).toBe(true)
    expect(isDrifting(-15, -15)).toBe(true)
  })

  it('returns false when correcting from sharp to less sharp', () => {
    expect(isDrifting(5, 20)).toBe(false)
  })

  it('returns false when correcting from flat to less flat', () => {
    expect(isDrifting(-5, -20)).toBe(false)
  })
})

describe('IntonationNeedle', () => {
  beforeEach(() => {
    rafCallbacks = []
    rafId = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return ++rafId
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

    // Reset audio store to defaults
    useAudioStore.setState({
      pitchData: { frequency: null, note: null, cents: null, confidence: 0 },
      vibratoData: {
        isVibrato: false,
        vibratoRate: null,
        vibratoWidth: null,
        centerFrequency: null,
      },
      isPracticing: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders with data-testid', () => {
    render(<IntonationNeedle />)
    expect(screen.getByTestId('intonation-needle')).toBeInTheDocument()
  })

  it('is hidden by default (aria-hidden)', () => {
    render(<IntonationNeedle />)
    const needle = screen.getByTestId('intonation-needle')
    expect(needle).toHaveAttribute('aria-hidden', 'true')
  })

  it('starts with opacity 0', () => {
    render(<IntonationNeedle />)
    const needle = screen.getByTestId('intonation-needle')
    expect(needle.style.opacity).toBe('0')
  })

  it('uses fixed positioning on the right edge of the screen', () => {
    render(<IntonationNeedle />)
    const needle = screen.getByTestId('intonation-needle')
    expect(needle.className).toContain('fixed')
    expect(needle.className).toContain('right-4')
    expect(needle.className).toContain('top-1/2')
  })

  it('is pointer-events-none to avoid blocking interaction', () => {
    render(<IntonationNeedle />)
    const needle = screen.getByTestId('intonation-needle')
    expect(needle.className).toContain('pointer-events-none')
  })

  it('uses will-change for GPU compositing', () => {
    render(<IntonationNeedle />)
    const needle = screen.getByTestId('intonation-needle')
    expect(needle.style.willChange).toBe('opacity, transform')
  })

  it('remains invisible when not practicing', () => {
    useAudioStore.setState({
      isPracticing: false,
      pitchData: { frequency: 440, note: 'A4', cents: 30, confidence: 0.9 },
    })
    render(<IntonationNeedle />)

    act(() => flushRAF())

    const needle = screen.getByTestId('intonation-needle')
    expect(needle.style.opacity).toBe('0')
  })

  it('remains invisible when within 10 cents during practice', () => {
    useAudioStore.setState({
      isPracticing: true,
      pitchData: { frequency: 440, note: 'A4', cents: 5, confidence: 0.9 },
    })
    render(<IntonationNeedle />)

    act(() => flushRAF())

    const needle = screen.getByTestId('intonation-needle')
    expect(needle.style.opacity).toBe('0')
  })

  it('becomes visible when deviation exceeds 10 cents during practice', () => {
    useAudioStore.setState({
      isPracticing: true,
      pitchData: { frequency: 440, note: 'A4', cents: 20, confidence: 0.9 },
    })
    render(<IntonationNeedle />)

    act(() => flushRAF())

    const needle = screen.getByTestId('intonation-needle')
    const opacity = parseFloat(needle.style.opacity)
    expect(opacity).toBeGreaterThan(0)
    expect(opacity).toBeLessThan(1)
  })

  it('is fully visible at 25+ cents deviation', () => {
    useAudioStore.setState({
      isPracticing: true,
      pitchData: { frequency: 440, note: 'A4', cents: 30, confidence: 0.9 },
    })
    render(<IntonationNeedle />)

    act(() => flushRAF())

    const needle = screen.getByTestId('intonation-needle')
    expect(needle.style.opacity).toBe('1')
  })

  it('sets drifting state when moving away from center', () => {
    useAudioStore.setState({
      isPracticing: true,
      pitchData: { frequency: 440, note: 'A4', cents: 20, confidence: 0.9 },
    })
    render(<IntonationNeedle />)

    // First frame — no previous, so drifting
    act(() => flushRAF())

    const needle = screen.getByTestId('intonation-needle')
    expect(needle.dataset.state).toBe('drifting')
  })

  it('sets correcting state when moving toward center', () => {
    useAudioStore.setState({
      isPracticing: true,
      pitchData: { frequency: 440, note: 'A4', cents: 30, confidence: 0.9 },
    })
    render(<IntonationNeedle />)

    // First frame: establishes baseline at 30 cents
    act(() => flushRAF())

    // Move toward center
    useAudioStore.setState({
      pitchData: { frequency: 440, note: 'A4', cents: 15, confidence: 0.9 },
    })

    act(() => flushRAF())

    const needle = screen.getByTestId('intonation-needle')
    expect(needle.dataset.state).toBe('correcting')
  })

  it('hides when confidence is too low', () => {
    useAudioStore.setState({
      isPracticing: true,
      pitchData: { frequency: 440, note: 'A4', cents: 30, confidence: 0.1 },
    })
    render(<IntonationNeedle />)

    act(() => flushRAF())

    const needle = screen.getByTestId('intonation-needle')
    expect(needle.style.opacity).toBe('0')
  })

  it('hides when pitch data has null cents', () => {
    useAudioStore.setState({
      isPracticing: true,
      pitchData: { frequency: null, note: null, cents: null, confidence: 0 },
    })
    render(<IntonationNeedle />)

    act(() => flushRAF())

    const needle = screen.getByTestId('intonation-needle')
    expect(needle.style.opacity).toBe('0')
  })

  it('applies transform for vertical offset based on deviation', () => {
    useAudioStore.setState({
      isPracticing: true,
      pitchData: { frequency: 440, note: 'A4', cents: 25, confidence: 0.9 },
    })
    render(<IntonationNeedle />)

    act(() => flushRAF())

    const needle = screen.getByTestId('intonation-needle')
    // 25/50 * 40 = 20px shift
    expect(needle.style.transform).toBe('translate3d(0, -20px, 0)')
  })

  it('shifts opposite direction for flat deviation', () => {
    useAudioStore.setState({
      isPracticing: true,
      pitchData: { frequency: 440, note: 'A4', cents: -25, confidence: 0.9 },
    })
    render(<IntonationNeedle />)

    act(() => flushRAF())

    const needle = screen.getByTestId('intonation-needle')
    expect(needle.style.transform).toBe('translate3d(0, 20px, 0)')
  })

  it('clamps deflection at ±50 cents max', () => {
    useAudioStore.setState({
      isPracticing: true,
      pitchData: { frequency: 440, note: 'A4', cents: 100, confidence: 0.9 },
    })
    render(<IntonationNeedle />)

    act(() => flushRAF())

    const needle = screen.getByTestId('intonation-needle')
    // 100 cents is clamped to 50, so shift = 50/50 * 40 = 40px
    expect(needle.style.transform).toBe('translate3d(0, -40px, 0)')
  })

  it('has smooth color transition classes', () => {
    render(<IntonationNeedle />)
    const needle = screen.getByTestId('intonation-needle')
    expect(needle.className).toContain('transition-colors')
    expect(needle.className).toContain('duration-300')
  })

  it('uses feedback-error color for drifting state', () => {
    render(<IntonationNeedle />)
    const needle = screen.getByTestId('intonation-needle')
    expect(needle.className).toContain(
      'data-[state=drifting]:bg-feedback-error',
    )
  })

  it('uses feedback-success color for correcting state', () => {
    render(<IntonationNeedle />)
    const needle = screen.getByTestId('intonation-needle')
    expect(needle.className).toContain(
      'data-[state=correcting]:bg-feedback-success',
    )
  })

  it('includes crimson glow class for drifting state', () => {
    render(<IntonationNeedle />)
    const needle = screen.getByTestId('intonation-needle')
    expect(needle.className).toContain(
      'data-[state=drifting]:shadow-crimson-glow',
    )
  })

  it('includes emerald glow class for correcting state', () => {
    render(<IntonationNeedle />)
    const needle = screen.getByTestId('intonation-needle')
    expect(needle.className).toContain(
      'data-[state=correcting]:shadow-emerald-glow',
    )
  })

  it('uses breath animation for drifting state', () => {
    render(<IntonationNeedle />)
    const needle = screen.getByTestId('intonation-needle')
    expect(needle.className).toContain('data-[state=drifting]:animate-breath')
  })

  it('uses breath animation for correcting state', () => {
    render(<IntonationNeedle />)
    const needle = screen.getByTestId('intonation-needle')
    expect(needle.className).toContain('data-[state=correcting]:animate-breath')
  })

  it('cancels animation frame on unmount', () => {
    const { unmount } = render(<IntonationNeedle />)
    unmount()
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
  })

  it('starts RAF loop on mount', () => {
    render(<IntonationNeedle />)
    expect(window.requestAnimationFrame).toHaveBeenCalled()
  })

  it('applies additional className when provided', () => {
    render(<IntonationNeedle className="custom-class" />)
    const needle = screen.getByTestId('intonation-needle')
    expect(needle.className).toContain('custom-class')
  })
})
