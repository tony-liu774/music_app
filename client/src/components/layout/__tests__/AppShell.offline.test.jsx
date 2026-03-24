import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mock the hooks
vi.mock('../../../hooks/useOffline', () => ({
  useOffline: vi.fn(() => ({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    queueSessionData: vi.fn(),
    queueDebriefRequest: vi.fn(),
    processQueue: vi.fn(),
    refreshPendingCount: vi.fn(),
  })),
}))

vi.mock('../../../hooks/useScoreCache', () => ({
  useScoreCache: vi.fn(() => ({
    loadFromCache: vi.fn(),
    getCachedScore: vi.fn(),
  })),
}))

vi.mock('../../../stores/useUIStore', () => ({
  useUIStore: vi.fn((selector) => selector({ navVisible: true })),
}))

import AppShell from '../AppShell'
import { useOffline } from '../../../hooks/useOffline'

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('AppShell - offline integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not show offline indicator when online', () => {
    renderWithRouter(<AppShell />)
    expect(screen.queryByTestId('offline-indicator')).not.toBeInTheDocument()
  })

  it('shows offline indicator when offline', () => {
    useOffline.mockReturnValue({
      isOnline: false,
      isSyncing: false,
      pendingCount: 2,
      queueSessionData: vi.fn(),
      queueDebriefRequest: vi.fn(),
      processQueue: vi.fn(),
      refreshPendingCount: vi.fn(),
    })

    renderWithRouter(<AppShell />)
    expect(screen.getAllByTestId('offline-indicator').length).toBeGreaterThan(0)
  })

  it('passes pendingCount to nav components', () => {
    useOffline.mockReturnValue({
      isOnline: false,
      isSyncing: false,
      pendingCount: 5,
      queueSessionData: vi.fn(),
      queueDebriefRequest: vi.fn(),
      processQueue: vi.fn(),
      refreshPendingCount: vi.fn(),
    })

    renderWithRouter(<AppShell />)
    expect(screen.getAllByText('(5)').length).toBeGreaterThan(0)
  })
})
