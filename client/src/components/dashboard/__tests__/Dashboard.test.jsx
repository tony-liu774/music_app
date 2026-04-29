import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import Dashboard from '../../../pages/Dashboard'
import { useSessionStore } from '../../../stores/useSessionStore'
import { useLibraryStore } from '../../../stores/useLibraryStore'

describe('Dashboard Page', () => {
  beforeEach(() => {
    useSessionStore.setState({ practiceHistory: [] })
    useLibraryStore.setState({ scores: [] })
  })

  it('renders the dashboard page container', () => {
    render(<Dashboard />)
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
  })

  it('renders the Dashboard heading', () => {
    render(<Dashboard />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders all three widgets', () => {
    render(<Dashboard />)
    expect(screen.getByTestId('practice-streak-widget')).toBeInTheDocument()
    expect(screen.getByTestId('progress-chart')).toBeInTheDocument()
    expect(screen.getByTestId('recent-sessions-list')).toBeInTheDocument()
  })

  it('has responsive grid layout classes', () => {
    render(<Dashboard />)
    const page = screen.getByTestId('dashboard-page')
    expect(page.className).toContain('space-y-6')

    // The grid container wrapping streak
    const grid = page.querySelector('.grid')
    expect(grid).not.toBeNull()
    expect(grid.className).toContain('grid-cols-1')
    expect(grid.className).toContain('md:grid-cols-2')
  })

  it('shows meaningful data with practice history', () => {
    const today = new Date().toISOString()

    useSessionStore.setState({
      practiceHistory: [
        {
          id: 's1',
          pieceName: 'Vivaldi Summer',
          date: today,
          duration: 45,
          accuracy: 82,
          sessionId: 'sess-1',
        },
      ],
    })

    render(<Dashboard />)
    expect(screen.getByText('Vivaldi Summer')).toBeInTheDocument()
    expect(screen.getByTestId('streak-days')).toHaveTextContent('1')
    expect(screen.getByTestId('week-sessions')).toHaveTextContent('1')
  })

  it('uses Midnight Conservatory theme (no hardcoded hex)', () => {
    render(<Dashboard />)
    const heading = screen.getByText('Dashboard')
    expect(heading.className).toContain('text-amber')
    expect(heading.className).toContain('font-heading')
    expect(heading.className).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })
})
