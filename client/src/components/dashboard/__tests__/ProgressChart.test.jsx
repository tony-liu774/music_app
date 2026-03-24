import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import ProgressChart, { aggregateByDay, buildPolyline } from '../ProgressChart'
import { useSessionStore } from '../../../stores/useSessionStore'

describe('ProgressChart', () => {
  beforeEach(() => {
    useSessionStore.setState({ practiceHistory: [] })
  })

  it('renders chart heading', () => {
    render(<ProgressChart />)
    expect(screen.getByText('Accuracy Trend')).toBeInTheDocument()
  })

  it('shows empty state when less than 2 data points', () => {
    render(<ProgressChart />)
    expect(screen.getByTestId('chart-empty-state')).toBeInTheDocument()
  })

  it('shows empty state with only 1 day of data', () => {
    useSessionStore.setState({
      practiceHistory: [
        { date: new Date().toISOString(), duration: 20, accuracy: 80 },
      ],
    })
    render(<ProgressChart />)
    expect(screen.getByTestId('chart-empty-state')).toBeInTheDocument()
  })

  it('renders SVG chart when 2+ days of data exist', () => {
    const day1 = new Date(Date.now() - 2 * 86400000).toISOString()
    const day2 = new Date(Date.now() - 86400000).toISOString()

    useSessionStore.setState({
      practiceHistory: [
        { date: day1, duration: 20, accuracy: 70 },
        { date: day2, duration: 30, accuracy: 85 },
      ],
    })

    render(<ProgressChart />)
    expect(screen.getByTestId('chart-svg')).toBeInTheDocument()
    expect(screen.getByTestId('trend-line')).toBeInTheDocument()
  })

  it('renders data points for each day', () => {
    const day1 = new Date(Date.now() - 2 * 86400000).toISOString()
    const day2 = new Date(Date.now() - 86400000).toISOString()

    useSessionStore.setState({
      practiceHistory: [
        { date: day1, duration: 20, accuracy: 70 },
        { date: day2, duration: 30, accuracy: 85 },
      ],
    })

    render(<ProgressChart />)
    expect(screen.getAllByTestId('data-point')).toHaveLength(2)
  })

  it('has bounded SVG dimensions', () => {
    const day1 = new Date(Date.now() - 2 * 86400000).toISOString()
    const day2 = new Date(Date.now() - 86400000).toISOString()

    useSessionStore.setState({
      practiceHistory: [
        { date: day1, duration: 20, accuracy: 70 },
        { date: day2, duration: 30, accuracy: 85 },
      ],
    })

    render(<ProgressChart />)
    const svg = screen.getByTestId('chart-svg')
    const classStr =
      typeof svg.className === 'string'
        ? svg.className
        : svg.getAttribute('class') || ''
    expect(classStr).toContain('max-w')
    expect(classStr).toContain('max-h')
  })

  it('uses Midnight Conservatory colors (no hardcoded hex)', () => {
    const day1 = new Date(Date.now() - 2 * 86400000).toISOString()
    const day2 = new Date(Date.now() - 86400000).toISOString()

    useSessionStore.setState({
      practiceHistory: [
        { date: day1, duration: 20, accuracy: 70 },
        { date: day2, duration: 30, accuracy: 85 },
      ],
    })

    render(<ProgressChart />)
    const trendLine = screen.getByTestId('trend-line')
    expect(trendLine.getAttribute('class')).toContain('stroke-amber')
  })
})

describe('aggregateByDay', () => {
  it('returns empty for empty history', () => {
    expect(aggregateByDay([])).toEqual([])
  })

  it('averages accuracy for same-day sessions', () => {
    const day = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const result = aggregateByDay([
      { date: `${day}T10:00:00Z`, accuracy: 80 },
      { date: `${day}T14:00:00Z`, accuracy: 90 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].accuracy).toBe(85)
  })

  it('excludes sessions older than 30 days', () => {
    const old = new Date(Date.now() - 35 * 86400000).toISOString()
    expect(aggregateByDay([{ date: old, accuracy: 80 }])).toEqual([])
  })

  it('excludes sessions without accuracy', () => {
    const today = new Date().toISOString()
    expect(aggregateByDay([{ date: today }])).toEqual([])
  })

  it('sorts by date ascending', () => {
    const day1 = new Date(Date.now() - 3 * 86400000).toISOString()
    const day2 = new Date(Date.now() - 86400000).toISOString()
    const result = aggregateByDay([
      { date: day2, accuracy: 90 },
      { date: day1, accuracy: 70 },
    ])
    expect(result[0].accuracy).toBe(70)
    expect(result[1].accuracy).toBe(90)
  })
})

describe('buildPolyline', () => {
  it('returns empty string for empty points', () => {
    expect(buildPolyline([], 400, 160, 24)).toBe('')
  })

  it('returns empty string for single point', () => {
    expect(buildPolyline([{ accuracy: 80 }], 400, 160, 24)).toBe('')
  })

  it('returns valid polyline string for 2+ points', () => {
    const points = [
      { accuracy: 60, date: '2026-01-01' },
      { accuracy: 80, date: '2026-01-02' },
    ]
    const result = buildPolyline(points, 400, 160, 24)
    expect(result).toMatch(/\d+\.\d+,\d+\.\d+ \d+\.\d+,\d+\.\d+/)
  })
})
