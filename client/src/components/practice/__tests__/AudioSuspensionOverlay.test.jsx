import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AudioSuspensionOverlay from '../AudioSuspensionOverlay'
import { useAudioStore } from '../../../stores/useAudioStore'

describe('AudioSuspensionOverlay', () => {
  beforeEach(() => {
    useAudioStore.setState({
      isSuspendedBySystem: false,
      resumeFailCount: 0,
    })
  })

  it('renders nothing when not suspended and not initial suspension', () => {
    const { container } = render(<AudioSuspensionOverlay onResume={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders overlay when isSuspendedBySystem is true', () => {
    useAudioStore.setState({ isSuspendedBySystem: true })

    render(<AudioSuspensionOverlay onResume={vi.fn()} />)

    expect(screen.getByTestId('audio-suspension-overlay')).toBeInTheDocument()
    expect(screen.getByText('Audio Interrupted')).toBeInTheDocument()
    expect(
      screen.getByText('Audio was paused by your browser. Tap to resume.'),
    ).toBeInTheDocument()
  })

  it('renders overlay when isInitialSuspension is true', () => {
    render(<AudioSuspensionOverlay onResume={vi.fn()} isInitialSuspension />)

    expect(screen.getByTestId('audio-suspension-overlay')).toBeInTheDocument()
    expect(screen.getByText('Tap to Enable Audio')).toBeInTheDocument()
    expect(
      screen.getByText('Your browser requires a gesture to start audio.'),
    ).toBeInTheDocument()
  })

  it('calls onResume when the button is clicked', () => {
    useAudioStore.setState({ isSuspendedBySystem: true })
    const onResume = vi.fn()

    render(<AudioSuspensionOverlay onResume={onResume} />)

    fireEvent.click(screen.getByTestId('audio-resume-button'))
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it('shows exhausted retries message when resumeFailCount >= 3', () => {
    useAudioStore.setState({
      isSuspendedBySystem: true,
      resumeFailCount: 3,
    })

    render(<AudioSuspensionOverlay onResume={vi.fn()} />)

    expect(
      screen.getByText('Auto-resume failed. Tap to try again.'),
    ).toBeInTheDocument()
  })

  it('has correct accessibility attributes', () => {
    useAudioStore.setState({ isSuspendedBySystem: true })

    render(<AudioSuspensionOverlay onResume={vi.fn()} />)

    const overlay = screen.getByTestId('audio-suspension-overlay')
    expect(overlay).toHaveAttribute('role', 'dialog')
    expect(overlay).toHaveAttribute('aria-modal', 'true')
    expect(overlay).toHaveAttribute('aria-label', 'Audio Interrupted')
  })

  it('uses initial suspension aria-label when isInitialSuspension', () => {
    render(<AudioSuspensionOverlay onResume={vi.fn()} isInitialSuspension />)

    const overlay = screen.getByTestId('audio-suspension-overlay')
    expect(overlay).toHaveAttribute('aria-label', 'Tap to Enable Audio')
  })
})
