import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../../hooks/useOffline', () => ({
  useOffline: () => ({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    queueSessionData: vi.fn(),
    queueDebriefRequest: vi.fn(),
    processQueue: vi.fn(),
    refreshPendingCount: vi.fn(),
  }),
}))

vi.mock('../../../hooks/useScoreCache', () => ({
  useScoreCache: () => ({
    loadFromCache: vi.fn(),
    getCachedScore: vi.fn(),
  }),
}))

vi.mock('../../ui/Toast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}))

import AppShell from '../AppShell'
import { useUIStore } from '../../../stores/useUIStore'

function renderAppShell() {
  return render(
    <MemoryRouter>
      <AppShell />
    </MemoryRouter>,
  )
}

describe('AppShell ghost mode', () => {
  beforeEach(() => {
    useUIStore.setState({
      navVisible: true,
      ghostMode: false,
    })
  })

  it('shows nav elements with full opacity by default', () => {
    renderAppShell()
    const navWrapper = screen.getByTestId('nav-wrapper')
    const mobileNavWrapper = screen.getByTestId('mobile-nav-wrapper')

    expect(navWrapper.className).toContain('opacity-100')
    expect(mobileNavWrapper.className).toContain('opacity-100')
    expect(navWrapper.className).not.toContain('pointer-events-none')
  })

  it('fades nav when navVisible is false (ghost mode)', () => {
    useUIStore.setState({ navVisible: false, ghostMode: true })
    renderAppShell()

    const navWrapper = screen.getByTestId('nav-wrapper')
    const mobileNavWrapper = screen.getByTestId('mobile-nav-wrapper')

    expect(navWrapper.className).toContain('opacity-0')
    expect(navWrapper.className).toContain('pointer-events-none')
    expect(mobileNavWrapper.className).toContain('opacity-0')
    expect(mobileNavWrapper.className).toContain('pointer-events-none')
  })

  it('has transition-opacity duration-500 on nav wrappers', () => {
    renderAppShell()
    const navWrapper = screen.getByTestId('nav-wrapper')
    expect(navWrapper.className).toContain('transition-opacity')
    expect(navWrapper.className).toContain('duration-500')
  })

  it('restores nav when navVisible becomes true again', () => {
    useUIStore.setState({ navVisible: false, ghostMode: true })
    const { rerender } = renderAppShell()

    expect(screen.getByTestId('nav-wrapper').className).toContain('opacity-0')

    useUIStore.setState({ navVisible: true, ghostMode: false })
    rerender(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('nav-wrapper').className).toContain('opacity-100')
  })
})
