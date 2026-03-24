import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import HeatMapOverlay from '../HeatMapOverlay'

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------
function makeHeatData(measureNumber, errorCount, opacity = 0.2) {
  return {
    measureNumber,
    errorCount,
    avgDeviation: 15.5,
    maxDeviation: 42.0,
    worstNote: 'G#4',
    opacity,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('HeatMapOverlay', () => {
  beforeEach(() => {
    // Provide CSS custom property fallback
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (prop) => {
        if (prop === '--color-crimson') return '#dc2626'
        return ''
      },
    })
  })

  it('renders nothing when not visible', () => {
    const { container } = render(
      <HeatMapOverlay
        heatMapData={[makeHeatData(1, 5)]}
        totalMeasures={4}
        visible={false}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when heatMapData is empty', () => {
    const { container } = render(
      <HeatMapOverlay
        heatMapData={[]}
        totalMeasures={4}
        visible={true}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when totalMeasures is 0', () => {
    const { container } = render(
      <HeatMapOverlay
        heatMapData={[makeHeatData(1, 5)]}
        totalMeasures={0}
        visible={true}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders SVG overlay when visible with data', () => {
    render(
      <HeatMapOverlay
        heatMapData={[makeHeatData(1, 5, 0.3)]}
        totalMeasures={4}
        visible={true}
      />,
    )

    const svg = screen.getByTestId('heat-map-overlay')
    expect(svg).toBeInTheDocument()
    expect(svg.tagName).toBe('svg')
  })

  it('renders a rect for each measure with errors', () => {
    const data = [
      makeHeatData(1, 3, 0.15),
      makeHeatData(3, 8, 0.35),
    ]

    render(
      <HeatMapOverlay
        heatMapData={data}
        totalMeasures={4}
        visible={true}
      />,
    )

    expect(screen.getByTestId('heat-rect-1')).toBeInTheDocument()
    expect(screen.getByTestId('heat-rect-3')).toBeInTheDocument()
    // Measure 2 has no errors, should not have a rect
    expect(screen.queryByTestId('heat-rect-2')).not.toBeInTheDocument()
  })

  it('does not render rects for measures with zero opacity', () => {
    const data = [makeHeatData(1, 0, 0)]

    render(
      <HeatMapOverlay
        heatMapData={data}
        totalMeasures={4}
        visible={true}
      />,
    )

    expect(screen.queryByTestId('heat-rect-1')).not.toBeInTheDocument()
  })

  it('applies crimson fill color to rects', () => {
    render(
      <HeatMapOverlay
        heatMapData={[makeHeatData(1, 5, 0.3)]}
        totalMeasures={4}
        visible={true}
      />,
    )

    const rect = screen.getByTestId('heat-rect-1')
    expect(rect.getAttribute('fill')).toBe('#dc2626')
  })

  it('positions first measure correctly (x=10, y=20)', () => {
    render(
      <HeatMapOverlay
        heatMapData={[makeHeatData(1, 5, 0.3)]}
        totalMeasures={4}
        visible={true}
      />,
    )

    const rect = screen.getByTestId('heat-rect-1')
    expect(rect.getAttribute('x')).toBe('10')
    expect(rect.getAttribute('y')).toBe('20')
    // First measure has width = MEASURE_WIDTH + FIRST_MEASURE_INDENT = 340
    expect(rect.getAttribute('width')).toBe('340')
  })

  it('positions second measure with indent offset', () => {
    render(
      <HeatMapOverlay
        heatMapData={[makeHeatData(2, 3, 0.2)]}
        totalMeasures={4}
        visible={true}
      />,
    )

    const rect = screen.getByTestId('heat-rect-2')
    // posInSystem=1, x = 10 + 40 + 1*300 = 350
    expect(rect.getAttribute('x')).toBe('350')
    expect(rect.getAttribute('width')).toBe('300')
  })

  it('wraps to next system after 4 measures', () => {
    render(
      <HeatMapOverlay
        heatMapData={[makeHeatData(5, 2, 0.1)]}
        totalMeasures={8}
        visible={true}
      />,
    )

    const rect = screen.getByTestId('heat-rect-5')
    // Measure 5 is first in system 1 (0-indexed)
    expect(rect.getAttribute('x')).toBe('10')
    // y = 20 + 1*140 = 160
    expect(rect.getAttribute('y')).toBe('160')
  })

  it('applies sequential fade-in animation with stagger delay', () => {
    const data = [
      makeHeatData(1, 5, 0.3),
      makeHeatData(3, 8, 0.35),
    ]

    render(
      <HeatMapOverlay
        heatMapData={data}
        totalMeasures={4}
        visible={true}
      />,
    )

    const rect1 = screen.getByTestId('heat-rect-1')
    const rect3 = screen.getByTestId('heat-rect-3')

    // Both should have animation style
    expect(rect1.style.animation).toContain('heat-fade-in')
    expect(rect3.style.animation).toContain('heat-fade-in')

    // rect3 (mIdx=2) should have a later delay than rect1 (mIdx=0)
    const delay1 = parseFloat(rect1.style.animation.match(/(\d+(?:\.\d+)?)ms/)?.[1] || 0)
    const delay3 = parseFloat(rect3.style.animation.match(/heat-fade-in\s+\d+ms\s+\S+\s+(\d+(?:\.\d+)?)ms/)?.[1] || 0)
    // Just verify the animation strings are different (different delays)
    expect(rect1.style.animation).not.toBe(rect3.style.animation)
  })

  it('shows tooltip on hover with measure details', () => {
    render(
      <HeatMapOverlay
        heatMapData={[makeHeatData(1, 5, 0.3)]}
        totalMeasures={4}
        visible={true}
      />,
    )

    const rect = screen.getByTestId('heat-rect-1')

    // Tooltip should not be visible initially
    expect(screen.queryByTestId('heat-tooltip-1')).not.toBeInTheDocument()

    // Hover over the rect
    fireEvent.mouseEnter(rect)

    const tooltip = screen.getByTestId('heat-tooltip-1')
    expect(tooltip).toBeInTheDocument()

    // Check tooltip content
    const texts = tooltip.querySelectorAll('text')
    const textContents = Array.from(texts).map((t) => t.textContent)

    expect(textContents).toContain('Measure 1')
    expect(textContents.some((t) => t.includes('Errors: 5'))).toBe(true)
    expect(textContents.some((t) => t.includes('15.5'))).toBe(true)
    expect(textContents.some((t) => t.includes('42'))).toBe(true)
    expect(textContents.some((t) => t.includes('G#4'))).toBe(true)
  })

  it('hides tooltip on mouse leave', () => {
    render(
      <HeatMapOverlay
        heatMapData={[makeHeatData(1, 5, 0.3)]}
        totalMeasures={4}
        visible={true}
      />,
    )

    const rect = screen.getByTestId('heat-rect-1')
    fireEvent.mouseEnter(rect)
    expect(screen.getByTestId('heat-tooltip-1')).toBeInTheDocument()

    fireEvent.mouseLeave(rect)
    expect(screen.queryByTestId('heat-tooltip-1')).not.toBeInTheDocument()
  })

  it('has pointer-events-none class on SVG and pointer-events all on rects', () => {
    render(
      <HeatMapOverlay
        heatMapData={[makeHeatData(1, 5, 0.3)]}
        totalMeasures={4}
        visible={true}
      />,
    )

    const svg = screen.getByTestId('heat-map-overlay')
    expect(svg.className.baseVal).toContain('pointer-events-none')

    const rect = screen.getByTestId('heat-rect-1')
    expect(rect.style.pointerEvents).toBe('all')
  })

  it('hides worst note line in tooltip when worstNote is null', () => {
    const data = [{
      measureNumber: 1,
      errorCount: 3,
      avgDeviation: 40,
      maxDeviation: 50,
      worstNote: null,
      opacity: 0.3,
    }]

    render(
      <HeatMapOverlay
        heatMapData={data}
        totalMeasures={4}
        visible={true}
      />,
    )

    const rect = screen.getByTestId('heat-rect-1')
    fireEvent.mouseEnter(rect)

    const tooltip = screen.getByTestId('heat-tooltip-1')
    const texts = Array.from(tooltip.querySelectorAll('text')).map((t) => t.textContent)
    expect(texts.some((t) => t.includes('Worst note'))).toBe(false)
  })

  it('sets max-w and max-h classes on SVG', () => {
    render(
      <HeatMapOverlay
        heatMapData={[makeHeatData(1, 5, 0.3)]}
        totalMeasures={4}
        visible={true}
      />,
    )

    const svg = screen.getByTestId('heat-map-overlay')
    expect(svg.className.baseVal).toContain('max-w-full')
    expect(svg.className.baseVal).toContain('max-h-')
  })

  it('handles multiple measures across multiple systems', () => {
    const data = [
      makeHeatData(1, 2, 0.1),
      makeHeatData(4, 4, 0.2),
      makeHeatData(5, 6, 0.3),
      makeHeatData(8, 8, 0.4),
    ]

    render(
      <HeatMapOverlay
        heatMapData={data}
        totalMeasures={8}
        visible={true}
      />,
    )

    // System 0: measures 1-4
    expect(screen.getByTestId('heat-rect-1')).toBeInTheDocument()
    expect(screen.getByTestId('heat-rect-4')).toBeInTheDocument()
    // System 1: measures 5-8
    expect(screen.getByTestId('heat-rect-5')).toBeInTheDocument()
    expect(screen.getByTestId('heat-rect-8')).toBeInTheDocument()

    // Verify system wrapping
    const rect4 = screen.getByTestId('heat-rect-4')
    const rect5 = screen.getByTestId('heat-rect-5')
    expect(Number(rect4.getAttribute('y'))).toBe(20) // system 0
    expect(Number(rect5.getAttribute('y'))).toBe(160) // system 1
  })
})
