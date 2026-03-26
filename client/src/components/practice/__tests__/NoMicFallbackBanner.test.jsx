import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NoMicFallbackBanner from '../NoMicFallbackBanner'

describe('NoMicFallbackBanner', () => {
  it('renders banner with data-testid', () => {
    render(<NoMicFallbackBanner reason="denied" />)
    expect(screen.getByTestId('no-mic-fallback-banner')).toBeInTheDocument()
  })

  it('shows denied message', () => {
    render(<NoMicFallbackBanner reason="denied" />)
    expect(screen.getByText(/microphone access denied/i)).toBeInTheDocument()
  })

  it('shows unsupported message', () => {
    render(<NoMicFallbackBanner reason="unsupported" />)
    expect(screen.getByText(/microphone not available/i)).toBeInTheDocument()
  })

  it('shows error message for unknown reason', () => {
    render(<NoMicFallbackBanner reason="error" />)
    expect(screen.getByText(/microphone error/i)).toBeInTheDocument()
  })

  it('mentions score and metronome in all messages', () => {
    const { rerender } = render(<NoMicFallbackBanner reason="denied" />)
    expect(screen.getByText(/score and metronome only/i)).toBeInTheDocument()

    rerender(<NoMicFallbackBanner reason="unsupported" />)
    expect(screen.getByText(/score and metronome only/i)).toBeInTheDocument()

    rerender(<NoMicFallbackBanner reason="error" />)
    expect(screen.getByText(/score and metronome only/i)).toBeInTheDocument()
  })
})
