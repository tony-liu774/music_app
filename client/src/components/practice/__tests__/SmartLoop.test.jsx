import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SmartLoop from '../SmartLoop'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function makeLoopMeasure(measureNumber, avgDeviation = 30) {
  return { measureNumber, avgDeviation }
}

const defaultProps = {
  loopMeasures: [makeLoopMeasure(2), makeLoopMeasure(3)],
  loopCount: 1,
  isImproving: false,
  isActive: true,
  loopTempo: 102,
  onExit: vi.fn(),
  totalMeasures: 8,
}

describe('SmartLoop', () => {
  beforeEach(() => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (prop) => {
        const map = {
          '--color-amber': '#c9a227',
          '--color-emerald': '#10b981',
          '--color-ivory': '#f3f4f6',
          '--color-surface': '#141420',
        }
        return map[prop] || ''
      },
    })
  })

  it('renders nothing when not active', () => {
    const { container } = render(
      <SmartLoop {...defaultProps} isActive={false} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when loopMeasures is empty', () => {
    const { container } = render(
      <SmartLoop {...defaultProps} loopMeasures={[]} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders the SVG overlay when active', () => {
    render(<SmartLoop {...defaultProps} />)
    expect(screen.getByTestId('smart-loop-overlay')).toBeInTheDocument()
  })

  it('renders bracket groups for loop measures', () => {
    render(<SmartLoop {...defaultProps} />)
    // Measures 2 and 3 are on the same system (system 0), so one bracket group
    expect(screen.getByTestId('smart-loop-bracket-0')).toBeInTheDocument()
  })

  it('renders multiple bracket groups for measures on different systems', () => {
    const measures = [makeLoopMeasure(1), makeLoopMeasure(5)] // System 0 and System 1
    render(<SmartLoop {...defaultProps} loopMeasures={measures} />)
    expect(screen.getByTestId('smart-loop-bracket-0')).toBeInTheDocument()
    expect(screen.getByTestId('smart-loop-bracket-1')).toBeInTheDocument()
  })

  it('renders the status bar with loop count', () => {
    render(<SmartLoop {...defaultProps} />)
    expect(screen.getByTestId('smart-loop-status')).toBeInTheDocument()
    expect(screen.getByTestId('loop-count')).toHaveTextContent('Loop 1')
  })

  it('displays the loop tempo', () => {
    render(<SmartLoop {...defaultProps} loopTempo={85} />)
    expect(screen.getByTestId('loop-tempo')).toHaveTextContent('85 BPM')
  })

  it('does not show improving badge when not improving', () => {
    render(<SmartLoop {...defaultProps} isImproving={false} />)
    expect(screen.queryByTestId('improving-badge')).not.toBeInTheDocument()
  })

  it('shows emerald Improving badge when improving', () => {
    render(<SmartLoop {...defaultProps} isImproving={true} />)
    const badge = screen.getByTestId('improving-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('Improving')
    expect(badge.className).toContain('text-emerald')
  })

  it('renders Exit Loop button', () => {
    render(<SmartLoop {...defaultProps} />)
    expect(screen.getByTestId('exit-loop-button')).toBeInTheDocument()
  })

  it('calls onExit when Exit Loop button is clicked', () => {
    const onExit = vi.fn()
    render(<SmartLoop {...defaultProps} onExit={onExit} />)
    fireEvent.click(screen.getByTestId('exit-loop-button'))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('calls onExit when Escape key is pressed', () => {
    const onExit = vi.fn()
    render(<SmartLoop {...defaultProps} onExit={onExit} />)
    fireEvent.keyDown(window, { code: 'Escape' })
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('does not call onExit on Escape when not active', () => {
    const onExit = vi.fn()
    render(<SmartLoop {...defaultProps} isActive={false} onExit={onExit} />)
    fireEvent.keyDown(window, { code: 'Escape' })
    expect(onExit).not.toHaveBeenCalled()
  })

  it('renders "Smart Loop" text in the status bar', () => {
    render(<SmartLoop {...defaultProps} />)
    expect(screen.getByText('Smart Loop')).toBeInTheDocument()
  })

  it('updates loop count display', () => {
    const { rerender } = render(<SmartLoop {...defaultProps} loopCount={1} />)
    expect(screen.getByTestId('loop-count')).toHaveTextContent('Loop 1')

    rerender(<SmartLoop {...defaultProps} loopCount={5} />)
    expect(screen.getByTestId('loop-count')).toHaveTextContent('Loop 5')
  })

  it('does not show tempo when loopTempo is null', () => {
    render(<SmartLoop {...defaultProps} loopTempo={null} />)
    expect(screen.queryByTestId('loop-tempo')).not.toBeInTheDocument()
  })

  it('bracket SVG rects use amber stroke', () => {
    render(<SmartLoop {...defaultProps} />)
    const bracket = screen.getByTestId('smart-loop-bracket-0')
    const rect = bracket.querySelector('rect')
    expect(rect.getAttribute('stroke')).toBe('#c9a227')
    expect(rect.getAttribute('fill')).toBe('none')
  })
})
