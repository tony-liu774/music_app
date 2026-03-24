import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OfflineIndicator from '../OfflineIndicator'

describe('OfflineIndicator', () => {
  it('renders nothing when online', () => {
    const { container } = render(<OfflineIndicator isOnline={true} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders "Offline" badge when offline', () => {
    render(<OfflineIndicator isOnline={false} />)
    expect(screen.getByTestId('offline-indicator')).toBeInTheDocument()
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('shows pending count when offline with queued items', () => {
    render(<OfflineIndicator isOnline={false} pendingCount={3} />)
    expect(screen.getByText('(3)')).toBeInTheDocument()
  })

  it('does not show pending count when zero', () => {
    render(<OfflineIndicator isOnline={false} pendingCount={0} />)
    expect(screen.queryByText('(0)')).not.toBeInTheDocument()
  })

  it('uses ivory-dim text color', () => {
    render(<OfflineIndicator isOnline={false} />)
    const badge = screen.getByTestId('offline-indicator')
    expect(badge.className).toContain('text-ivory-dim')
  })

  it('has a pulsing dot indicator', () => {
    render(<OfflineIndicator isOnline={false} />)
    const badge = screen.getByTestId('offline-indicator')
    const dot = badge.querySelector('.animate-pulse')
    expect(dot).toBeInTheDocument()
  })
})
