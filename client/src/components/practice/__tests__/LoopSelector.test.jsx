import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LoopSelector from '../LoopSelector'

describe('LoopSelector', () => {
  const defaultProps = {
    totalMeasures: 16,
    loopStart: null,
    loopEnd: null,
    onLoopChange: vi.fn(),
    disabled: false,
  }

  it('renders the loop toggle button', () => {
    render(<LoopSelector {...defaultProps} />)
    expect(screen.getByTestId('loop-toggle')).toBeInTheDocument()
  })

  it('does not show range inputs when loop is inactive', () => {
    render(<LoopSelector {...defaultProps} />)
    expect(screen.queryByTestId('loop-range')).not.toBeInTheDocument()
  })

  it('shows range inputs when loop is active', () => {
    render(<LoopSelector {...defaultProps} loopStart={1} loopEnd={4} />)
    expect(screen.getByTestId('loop-range')).toBeInTheDocument()
    expect(screen.getByTestId('loop-start-input')).toHaveValue(1)
    expect(screen.getByTestId('loop-end-input')).toHaveValue(4)
  })

  it('calls onLoopChange with defaults when toggle is clicked and no loop is set', () => {
    const onLoopChange = vi.fn()
    render(<LoopSelector {...defaultProps} onLoopChange={onLoopChange} />)

    fireEvent.click(screen.getByTestId('loop-toggle'))
    expect(onLoopChange).toHaveBeenCalledWith(1, 4)
  })

  it('clears loop when toggle is clicked while loop is active', () => {
    const onLoopChange = vi.fn()
    render(
      <LoopSelector
        {...defaultProps}
        loopStart={1}
        loopEnd={4}
        onLoopChange={onLoopChange}
      />,
    )

    fireEvent.click(screen.getByTestId('loop-toggle'))
    expect(onLoopChange).toHaveBeenCalledWith(null, null)
  })

  it('calls onLoopChange when start input changes', () => {
    const onLoopChange = vi.fn()
    render(
      <LoopSelector
        {...defaultProps}
        loopStart={1}
        loopEnd={8}
        onLoopChange={onLoopChange}
      />,
    )

    fireEvent.change(screen.getByTestId('loop-start-input'), {
      target: { value: '3' },
    })
    expect(onLoopChange).toHaveBeenCalledWith(3, 8)
  })

  it('calls onLoopChange when end input changes', () => {
    const onLoopChange = vi.fn()
    render(
      <LoopSelector
        {...defaultProps}
        loopStart={1}
        loopEnd={8}
        onLoopChange={onLoopChange}
      />,
    )

    fireEvent.change(screen.getByTestId('loop-end-input'), {
      target: { value: '12' },
    })
    expect(onLoopChange).toHaveBeenCalledWith(1, 12)
  })

  it('ensures start does not exceed end when start changes', () => {
    const onLoopChange = vi.fn()
    render(
      <LoopSelector
        {...defaultProps}
        loopStart={1}
        loopEnd={4}
        onLoopChange={onLoopChange}
      />,
    )

    fireEvent.change(screen.getByTestId('loop-start-input'), {
      target: { value: '6' },
    })
    // Start of 6 should push end to at least 6
    expect(onLoopChange).toHaveBeenCalledWith(6, 6)
  })

  it('ensures end does not go below start when end changes', () => {
    const onLoopChange = vi.fn()
    render(
      <LoopSelector
        {...defaultProps}
        loopStart={5}
        loopEnd={8}
        onLoopChange={onLoopChange}
      />,
    )

    fireEvent.change(screen.getByTestId('loop-end-input'), {
      target: { value: '3' },
    })
    // End of 3 should pull start down to 3
    expect(onLoopChange).toHaveBeenCalledWith(3, 3)
  })

  it('clears loop when clear button is clicked', () => {
    const onLoopChange = vi.fn()
    render(
      <LoopSelector
        {...defaultProps}
        loopStart={1}
        loopEnd={4}
        onLoopChange={onLoopChange}
      />,
    )

    fireEvent.click(screen.getByTestId('loop-clear'))
    expect(onLoopChange).toHaveBeenCalledWith(null, null)
  })

  it('disables toggle when disabled prop is true', () => {
    render(<LoopSelector {...defaultProps} disabled={true} />)
    expect(screen.getByTestId('loop-toggle')).toBeDisabled()
  })

  it('disables toggle when totalMeasures is 0', () => {
    render(<LoopSelector {...defaultProps} totalMeasures={0} />)
    expect(screen.getByTestId('loop-toggle')).toBeDisabled()
  })

  it('has amber styling when loop is active', () => {
    render(<LoopSelector {...defaultProps} loopStart={1} loopEnd={4} />)
    const toggle = screen.getByTestId('loop-toggle')
    expect(toggle.className).toContain('border-amber')
    expect(toggle.className).toContain('text-amber')
  })

  it('has correct aria attributes', () => {
    const { rerender } = render(<LoopSelector {...defaultProps} />)
    const toggle = screen.getByTestId('loop-toggle')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle).toHaveAttribute('aria-label', 'Set loop range')

    rerender(<LoopSelector {...defaultProps} loopStart={1} loopEnd={4} />)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle).toHaveAttribute('aria-label', 'Clear loop')
  })

  it('limits default end to totalMeasures when score is short', () => {
    const onLoopChange = vi.fn()
    render(
      <LoopSelector
        {...defaultProps}
        totalMeasures={2}
        onLoopChange={onLoopChange}
      />,
    )

    fireEvent.click(screen.getByTestId('loop-toggle'))
    expect(onLoopChange).toHaveBeenCalledWith(1, 2)
  })
})
