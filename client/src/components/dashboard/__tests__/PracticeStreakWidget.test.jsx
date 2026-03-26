import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import PracticeStreakWidget, {
  getStreakDays,
  getWeekStats,
  formatDuration,
} from '../PracticeStreakWidget'
import { useSessionStore } from '../../../stores/useSessionStore'

describe('PracticeStreakWidget', () => {
  beforeEach(() => {
    useSessionStore.setState({ practiceHistory: [] })
  })

  it('renders with zero streak when no history', () => {
    render(<PracticeStreakWidget />)
    expect(screen.getByTestId('streak-days')).toHaveTextContent('0')
    expect(screen.getByTestId('week-sessions')).toHaveTextContent('0')
  })

  it('renders practice streak widget with Card', () => {
    render(<PracticeStreakWidget />)
    expect(screen.getByTestId('practice-streak-widget')).toBeInTheDocument()
    expect(screen.getByText('Practice Streak')).toBeInTheDocument()
  })

  it('shows correct streak for consecutive days', () => {
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000)
      .toISOString()
      .slice(0, 10)

    useSessionStore.setState({
      practiceHistory: [
        { date: today, duration: 30 },
        { date: yesterday, duration: 20 },
        { date: twoDaysAgo, duration: 25 },
      ],
    })

    render(<PracticeStreakWidget />)
    expect(screen.getByTestId('streak-days')).toHaveTextContent('3')
  })

  it('shows week stats correctly', () => {
    const today = new Date().toISOString().slice(0, 10)
    useSessionStore.setState({
      practiceHistory: [
        { date: today, duration: 45 },
        { date: today, duration: 30 },
      ],
    })

    render(<PracticeStreakWidget />)
    expect(screen.getByTestId('week-time')).toHaveTextContent('1h 15m')
    expect(screen.getByTestId('week-sessions')).toHaveTextContent('2')
  })

  it('shows singular "day" for streak of 1', () => {
    const today = new Date().toISOString().slice(0, 10)
    useSessionStore.setState({
      practiceHistory: [{ date: today, duration: 20 }],
    })

    render(<PracticeStreakWidget />)
    expect(screen.getByText('day')).toBeInTheDocument()
  })

  it('shows singular "session" for 1 session', () => {
    const today = new Date().toISOString().slice(0, 10)
    useSessionStore.setState({
      practiceHistory: [{ date: today, duration: 20 }],
    })

    render(<PracticeStreakWidget />)
    expect(screen.getByText('session')).toBeInTheDocument()
  })
})

describe('getStreakDays', () => {
  it('returns 0 for empty history', () => {
    expect(getStreakDays([])).toBe(0)
  })

  it('returns 0 if last practice was more than 1 day ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()
    expect(getStreakDays([{ date: threeDaysAgo }])).toBe(0)
  })

  it('counts consecutive days correctly', () => {
    const days = [0, 1, 2, 3].map((d) => ({
      date: new Date(Date.now() - d * 86400000).toISOString(),
    }))
    expect(getStreakDays(days)).toBe(4)
  })

  it('breaks streak on gap', () => {
    const today = new Date().toISOString()
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()
    expect(getStreakDays([{ date: today }, { date: threeDaysAgo }])).toBe(1)
  })
})

describe('getWeekStats', () => {
  it('returns zero for empty history', () => {
    const result = getWeekStats([])
    expect(result.sessions).toBe(0)
    expect(result.totalMinutes).toBe(0)
  })

  it('excludes sessions older than 7 days', () => {
    const oldDate = new Date(Date.now() - 10 * 86400000).toISOString()
    const result = getWeekStats([{ date: oldDate, duration: 30 }])
    expect(result.sessions).toBe(0)
  })

  it('sums duration for recent sessions', () => {
    const today = new Date().toISOString()
    const result = getWeekStats([
      { date: today, duration: 30 },
      { date: today, duration: 45 },
    ])
    expect(result.sessions).toBe(2)
    expect(result.totalMinutes).toBe(75)
  })
})

describe('formatDuration', () => {
  it('formats minutes under 60', () => {
    expect(formatDuration(45)).toBe('45m')
  })

  it('formats hours and minutes', () => {
    expect(formatDuration(90)).toBe('1h 30m')
  })

  it('formats exact hours', () => {
    expect(formatDuration(120)).toBe('2h')
  })
})
