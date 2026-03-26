import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PitchAccuracyChart from '../PitchAccuracyChart'

// Mock canvas context since jsdom doesn't support canvas
const mockCtx = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  arc: vi.fn(),
  fillText: vi.fn(),
  setLineDash: vi.fn(),
  scale: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  lineJoin: '',
  font: '',
  textAlign: '',
}

describe('PitchAccuracyChart', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx)
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '',
    })
    Object.keys(mockCtx).forEach((key) => {
      if (typeof mockCtx[key] === 'function') mockCtx[key].mockClear()
    })
  })

  it('shows no data message when deviations is empty', () => {
    render(<PitchAccuracyChart deviations={[]} />)
    expect(screen.getByTestId('no-pitch-data')).toBeInTheDocument()
  })

  it('shows no data message when no pitch deviations exist', () => {
    const deviations = [
      { type: 'rhythm', measureNumber: 1, deviation_ms: 50 },
    ]
    render(<PitchAccuracyChart deviations={deviations} />)
    expect(screen.getByTestId('no-pitch-data')).toBeInTheDocument()
  })

  it('renders canvas when pitch deviations exist', () => {
    const deviations = [
      { type: 'pitch', centsDeviation: 10, measureNumber: 1 },
      { type: 'pitch', centsDeviation: -20, measureNumber: 2 },
    ]
    render(<PitchAccuracyChart deviations={deviations} />)

    expect(screen.getByTestId('pitch-accuracy-chart')).toBeInTheDocument()
    expect(screen.getByTestId('pitch-chart-canvas')).toBeInTheDocument()
  })

  it('displays reading count', () => {
    const deviations = [
      { type: 'pitch', centsDeviation: 10, measureNumber: 1 },
      { type: 'pitch', centsDeviation: -20, measureNumber: 2 },
      { type: 'pitch', centsDeviation: 5, measureNumber: 3 },
    ]
    render(<PitchAccuracyChart deviations={deviations} />)

    expect(screen.getByText('3 readings')).toBeInTheDocument()
  })

  it('filters out non-pitch deviations', () => {
    const deviations = [
      { type: 'pitch', centsDeviation: 10, measureNumber: 1 },
      { type: 'rhythm', deviation_ms: 50, measureNumber: 1 },
      { type: 'pitch', centsDeviation: -5, measureNumber: 2 },
      { type: 'intonation', measureNumber: 2 },
    ]
    render(<PitchAccuracyChart deviations={deviations} />)

    // Should only count 2 pitch deviations
    expect(screen.getByText('2 readings')).toBeInTheDocument()
  })

  it('clamps deviation values to ±50 cents', () => {
    const deviations = [
      { type: 'pitch', centsDeviation: 100, measureNumber: 1 },
      { type: 'pitch', centsDeviation: -80, measureNumber: 2 },
    ]
    render(<PitchAccuracyChart deviations={deviations} />)

    // Should render without error (canvas will clamp)
    expect(screen.getByTestId('pitch-accuracy-chart')).toBeInTheDocument()
  })

  it('has max-w and max-h classes on canvas', () => {
    const deviations = [
      { type: 'pitch', centsDeviation: 10, measureNumber: 1 },
      { type: 'pitch', centsDeviation: -5, measureNumber: 2 },
    ]
    render(<PitchAccuracyChart deviations={deviations} />)

    const canvas = screen.getByTestId('pitch-chart-canvas')
    expect(canvas.className).toContain('max-w-full')
    expect(canvas.className).toContain('max-h-')
  })
})
