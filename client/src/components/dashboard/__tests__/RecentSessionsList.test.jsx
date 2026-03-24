import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import RecentSessionsList, {
  formatDate,
  formatSessionDuration,
} from '../RecentSessionsList'
import { useSessionStore } from '../../../stores/useSessionStore'

describe('RecentSessionsList', () => {
  beforeEach(() => {
    useSessionStore.setState({ practiceHistory: [] })
  })

  it('renders empty state when no sessions', () => {
    render(<RecentSessionsList />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText(/no practice sessions/i)).toBeInTheDocument()
  })

  it('renders recent sessions heading', () => {
    render(<RecentSessionsList />)
    expect(screen.getByText('Recent Sessions')).toBeInTheDocument()
  })

  it('renders session items with piece name and duration', () => {
    useSessionStore.setState({
      practiceHistory: [
        {
          id: 's1',
          pieceName: 'Bach Partita No.2',
          date: new Date().toISOString(),
          duration: 35,
          accuracy: 87,
          sessionId: 'sess-1',
        },
      ],
    })

    render(<RecentSessionsList />)
    expect(screen.getByText('Bach Partita No.2')).toBeInTheDocument()
    expect(screen.getByTestId('accuracy-score')).toHaveTextContent('87%')
    expect(screen.getByTestId('review-link')).toBeInTheDocument()
  })

  it('renders review link pointing to heat map', () => {
    useSessionStore.setState({
      practiceHistory: [
        {
          id: 's1',
          pieceName: 'Test Piece',
          date: new Date().toISOString(),
          duration: 20,
          sessionId: 'sess-123',
        },
      ],
    })

    render(<RecentSessionsList />)
    const link = screen.getByTestId('review-link')
    expect(link).toHaveAttribute('href', '#/practice?review=sess-123')
  })

  it('sorts sessions by date descending', () => {
    const older = new Date(Date.now() - 2 * 86400000).toISOString()
    const newer = new Date().toISOString()

    useSessionStore.setState({
      practiceHistory: [
        { id: 's1', pieceName: 'Older Piece', date: older, duration: 20 },
        { id: 's2', pieceName: 'Newer Piece', date: newer, duration: 30 },
      ],
    })

    render(<RecentSessionsList />)
    const items = screen.getAllByTestId('session-item')
    expect(items[0]).toHaveTextContent('Newer Piece')
    expect(items[1]).toHaveTextContent('Older Piece')
  })

  it('limits to 10 sessions', () => {
    const sessions = Array.from({ length: 15 }, (_, i) => ({
      id: `s${i}`,
      pieceName: `Piece ${i}`,
      date: new Date(Date.now() - i * 86400000).toISOString(),
      duration: 20,
    }))

    useSessionStore.setState({ practiceHistory: sessions })
    render(<RecentSessionsList />)
    expect(screen.getAllByTestId('session-item')).toHaveLength(10)
  })

  it('color-codes accuracy: emerald for high, amber for medium, crimson for low', () => {
    useSessionStore.setState({
      practiceHistory: [
        { id: 's1', pieceName: 'High', date: new Date().toISOString(), duration: 20, accuracy: 90 },
        { id: 's2', pieceName: 'Med', date: new Date().toISOString(), duration: 20, accuracy: 70 },
        { id: 's3', pieceName: 'Low', date: new Date().toISOString(), duration: 20, accuracy: 50 },
      ],
    })

    render(<RecentSessionsList />)
    const scores = screen.getAllByTestId('accuracy-score')
    expect(scores[0].className).toContain('text-emerald')
    expect(scores[1].className).toContain('text-amber')
    expect(scores[2].className).toContain('text-crimson')
  })

  it('shows fallback name for sessions without pieceName', () => {
    useSessionStore.setState({
      practiceHistory: [
        { id: 's1', date: new Date().toISOString(), duration: 20 },
      ],
    })

    render(<RecentSessionsList />)
    expect(screen.getByText('Practice Session')).toBeInTheDocument()
  })
})

describe('formatDate', () => {
  it('returns "Today" for today', () => {
    expect(formatDate(new Date().toISOString())).toBe('Today')
  })

  it('returns "Yesterday" for yesterday', () => {
    expect(formatDate(new Date(Date.now() - 86400000).toISOString())).toBe('Yesterday')
  })

  it('returns "X days ago" for recent dates', () => {
    const threeDaysAgo = Date.now() - 3 * 86400000
    expect(formatDate(threeDaysAgo)).toBe('3 days ago')
  })
})

describe('formatSessionDuration', () => {
  it('returns "<1 min" for very short sessions', () => {
    expect(formatSessionDuration(0)).toBe('<1 min')
  })

  it('formats minutes', () => {
    expect(formatSessionDuration(25)).toBe('25 min')
  })

  it('formats hours and minutes', () => {
    expect(formatSessionDuration(95)).toBe('1h 35m')
  })
})
