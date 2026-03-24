import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PracticeControls from '../PracticeControls'

describe('PracticeControls', () => {
  const defaultProps = {
    isPracticing: false,
    onPlayPause: vi.fn(),
    onStop: vi.fn(),
    visible: true,
  }

  it('renders all control elements', () => {
    render(<PracticeControls {...defaultProps} />)
    expect(screen.getByTestId('play-pause-button')).toBeInTheDocument()
    expect(screen.getByTestId('stop-button')).toBeInTheDocument()
    expect(screen.getByTestId('tempo-slider')).toBeInTheDocument()
    expect(screen.getByTestId('metronome-toggle')).toBeInTheDocument()
  })

  it('shows play icon when not practicing', () => {
    render(<PracticeControls {...defaultProps} isPracticing={false} />)
    expect(screen.getByLabelText('Play')).toBeInTheDocument()
  })

  it('shows pause icon when practicing', () => {
    render(<PracticeControls {...defaultProps} isPracticing={true} />)
    expect(screen.getByLabelText('Pause')).toBeInTheDocument()
  })

  it('calls onPlayPause when play/pause button is clicked', () => {
    const onPlayPause = vi.fn()
    render(<PracticeControls {...defaultProps} onPlayPause={onPlayPause} />)
    fireEvent.click(screen.getByTestId('play-pause-button'))
    expect(onPlayPause).toHaveBeenCalledTimes(1)
  })

  it('calls onStop when stop button is clicked', () => {
    const onStop = vi.fn()
    render(
      <PracticeControls
        {...defaultProps}
        isPracticing={true}
        onStop={onStop}
      />,
    )
    fireEvent.click(screen.getByTestId('stop-button'))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('disables stop button when not practicing', () => {
    render(<PracticeControls {...defaultProps} isPracticing={false} />)
    expect(screen.getByTestId('stop-button')).toBeDisabled()
  })

  it('enables stop button when practicing', () => {
    render(<PracticeControls {...defaultProps} isPracticing={true} />)
    expect(screen.getByTestId('stop-button')).not.toBeDisabled()
  })

  it('has tempo slider with correct range (50-200)', () => {
    render(<PracticeControls {...defaultProps} />)
    const slider = screen.getByTestId('tempo-slider')
    expect(slider).toHaveAttribute('min', '50')
    expect(slider).toHaveAttribute('max', '200')
    expect(slider).toHaveValue('120')
  })

  it('updates tempo display when slider changes', () => {
    render(<PracticeControls {...defaultProps} />)
    const slider = screen.getByTestId('tempo-slider')
    fireEvent.change(slider, { target: { value: '80' } })
    expect(screen.getByText('80 BPM')).toBeInTheDocument()
  })

  it('toggles metronome on and off', () => {
    render(<PracticeControls {...defaultProps} />)
    const toggle = screen.getByTestId('metronome-toggle')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('applies opacity-0 and pointer-events-none when not visible', () => {
    render(<PracticeControls {...defaultProps} visible={false} />)
    const controls = screen.getByTestId('practice-controls')
    expect(controls.className).toContain('opacity-0')
    expect(controls.className).toContain('pointer-events-none')
  })

  it('applies opacity-100 when visible', () => {
    render(<PracticeControls {...defaultProps} visible={true} />)
    const controls = screen.getByTestId('practice-controls')
    expect(controls.className).toContain('opacity-100')
    expect(controls.className).not.toContain('pointer-events-none')
  })
})
