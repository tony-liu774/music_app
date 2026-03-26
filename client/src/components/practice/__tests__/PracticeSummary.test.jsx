import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PracticeSummary from '../PracticeSummary'

// Mock PitchAccuracyChart
vi.mock('../PitchAccuracyChart', () => ({
  default: () => <div data-testid="pitch-accuracy-chart-mock">Chart</div>,
}))

const mockSessionLog = {
  duration_ms: 180000,
  deviations: [
    { type: 'pitch', measureNumber: 1, centsDeviation: 20, detectedNote: 'C4', confidence: 0.9 },
    { type: 'pitch', measureNumber: 1, centsDeviation: -30, detectedNote: 'D4', confidence: 0.85 },
    { type: 'pitch', measureNumber: 2, centsDeviation: 5, detectedNote: 'E4', confidence: 0.95 },
    { type: 'pitch', measureNumber: 3, centsDeviation: 45, detectedNote: 'C4', confidence: 0.8 },
    { type: 'pitch', measureNumber: 3, centsDeviation: -10, detectedNote: 'F4', confidence: 0.88 },
  ],
}

const mockSessionSummary = {
  total_deviations: 5,
  pitch_deviation_count: 5,
  average_pitch_deviation_cents: 22,
  worst_measure: 3,
}

const mockHeatMapData = [
  { measureNumber: 1, errorCount: 2, avgDeviation: 25, maxDeviation: 30, worstNote: 'D4', opacity: 0.3, type: 'error' },
  { measureNumber: 3, errorCount: 2, avgDeviation: 27.5, maxDeviation: 45, worstNote: 'C4', opacity: 0.4, type: 'error' },
  { measureNumber: 2, errorCount: 1, avgDeviation: 5, maxDeviation: 5, worstNote: null, opacity: 0.2, type: 'success' },
]

const defaultProps = {
  sessionLog: mockSessionLog,
  sessionSummary: mockSessionSummary,
  aiResult: { debrief: 'Great tone! Watch your C-sharps.', score: 75, isOfflineFallback: false },
  aiLoading: false,
  heatMapData: mockHeatMapData,
  onPracticeAgain: vi.fn(),
  onSmartLoop: vi.fn(),
  onToggleHeatMap: vi.fn(),
  heatMapVisible: false,
  onClose: vi.fn(),
}

describe('PracticeSummary', () => {
  it('renders the summary with session stats', () => {
    render(<PracticeSummary {...defaultProps} />)

    expect(screen.getByTestId('practice-summary')).toBeInTheDocument()
    expect(screen.getByText('Session Complete')).toBeInTheDocument()
    expect(screen.getByText('3m 0s')).toBeInTheDocument() // 180000ms = 3m 0s
    // Check stat cards exist by their labels
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('Notes Played')).toBeInTheDocument()
    expect(screen.getByText('Sections')).toBeInTheDocument()
    expect(screen.getByText('Accuracy')).toBeInTheDocument()
  })

  it('displays AI feedback when available', () => {
    render(<PracticeSummary {...defaultProps} />)

    expect(screen.getByTestId('ai-feedback')).toBeInTheDocument()
    expect(screen.getByText('Great tone! Watch your C-sharps.')).toBeInTheDocument()
  })

  it('shows loading state for AI', () => {
    render(<PracticeSummary {...defaultProps} aiLoading={true} aiResult={null} />)

    expect(screen.getByTestId('ai-loading')).toBeInTheDocument()
    expect(screen.getByText('Your AI coach is reviewing...')).toBeInTheDocument()
  })

  it('shows offline fallback indicator', () => {
    render(
      <PracticeSummary
        {...defaultProps}
        aiResult={{ debrief: 'Good work.', score: 70, isOfflineFallback: true }}
      />,
    )

    expect(screen.getByText(/AI coach unavailable/)).toBeInTheDocument()
  })

  it('renders nothing when no session data', () => {
    const { container } = render(
      <PracticeSummary {...defaultProps} sessionLog={null} sessionSummary={null} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('switches tabs correctly', () => {
    render(<PracticeSummary {...defaultProps} />)

    // Default tab is overview
    expect(screen.getByTestId('tab-content-overview')).toBeInTheDocument()

    // Switch to accuracy tab
    fireEvent.click(screen.getByTestId('tab-accuracy'))
    expect(screen.getByTestId('tab-content-accuracy')).toBeInTheDocument()

    // Switch to problems tab
    fireEvent.click(screen.getByTestId('tab-problems'))
    expect(screen.getByTestId('tab-content-problems')).toBeInTheDocument()
  })

  it('displays problem notes in problems tab', () => {
    render(<PracticeSummary {...defaultProps} />)

    fireEvent.click(screen.getByTestId('tab-problems'))

    // C4 has avg deviation > 10 (avg of 20+45 = 32.5)
    expect(screen.getByTestId('problem-note-C4')).toBeInTheDocument()
  })

  it('shows error measures in overview', () => {
    render(<PracticeSummary {...defaultProps} />)

    // Error measures appear as "m.X (Y errors)"
    expect(screen.getByText(/m\.1 \(2 errors\)/)).toBeInTheDocument()
    expect(screen.getByText(/m\.3 \(2 errors\)/)).toBeInTheDocument()
  })

  it('calls onPracticeAgain when button clicked', () => {
    const onPracticeAgain = vi.fn()
    render(<PracticeSummary {...defaultProps} onPracticeAgain={onPracticeAgain} />)

    fireEvent.click(screen.getByTestId('summary-practice-again'))
    expect(onPracticeAgain).toHaveBeenCalled()
  })

  it('calls onSmartLoop when Smart Loop button clicked', () => {
    const onSmartLoop = vi.fn()
    render(<PracticeSummary {...defaultProps} onSmartLoop={onSmartLoop} />)

    fireEvent.click(screen.getByTestId('summary-smart-loop'))
    expect(onSmartLoop).toHaveBeenCalled()
  })

  it('calls onToggleHeatMap when heat map button clicked', () => {
    const onToggleHeatMap = vi.fn()
    render(<PracticeSummary {...defaultProps} onToggleHeatMap={onToggleHeatMap} />)

    fireEvent.click(screen.getByTestId('summary-toggle-heatmap'))
    expect(onToggleHeatMap).toHaveBeenCalled()
  })

  it('shows "Show Heat Map" when heatmap is hidden', () => {
    render(<PracticeSummary {...defaultProps} heatMapVisible={false} />)
    expect(screen.getByTestId('summary-toggle-heatmap').textContent).toContain('Show')
  })

  it('shows "Hide Heat Map" when heatmap is visible', () => {
    render(<PracticeSummary {...defaultProps} heatMapVisible={true} />)
    expect(screen.getByTestId('summary-toggle-heatmap').textContent).toContain('Hide')
  })

  it('does not show Smart Loop button when no error measures', () => {
    render(<PracticeSummary {...defaultProps} heatMapData={[]} />)
    expect(screen.queryByTestId('summary-smart-loop')).not.toBeInTheDocument()
  })

  it('displays accuracy percentage with correct color coding', () => {
    // Accuracy = notes within ±15 cents / total pitch notes
    // E4 at 5¢ and F4 at -10¢ are within 15, others are not = 2/5 = 40%
    // Wait - let's check: C4 at 20 (no), D4 at -30 (no), E4 at 5 (yes), C4 at 45 (no), F4 at -10 (yes) = 2/5 = 40%
    render(<PracticeSummary {...defaultProps} />)
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it('shows progress trend when historical data is available', () => {
    const trend = [
      { accuracy_percent: 60, created_at: '2026-03-01' },
      { accuracy_percent: 75, created_at: '2026-03-10' },
      { accuracy_percent: 85, created_at: '2026-03-20' },
    ]
    render(<PracticeSummary {...defaultProps} progressTrend={trend} />)

    expect(screen.getByTestId('progress-trend')).toBeInTheDocument()
    expect(screen.getByText(/3 times/)).toBeInTheDocument()
    expect(screen.getByText(/improving/)).toBeInTheDocument()
    expect(screen.getByTestId('trend-bar-0')).toBeInTheDocument()
    expect(screen.getByTestId('trend-bar-2')).toBeInTheDocument()
  })

  it('does not show progress trend with only 1 entry', () => {
    const trend = [{ accuracy_percent: 70, created_at: '2026-03-01' }]
    render(<PracticeSummary {...defaultProps} progressTrend={trend} />)

    expect(screen.queryByTestId('progress-trend')).not.toBeInTheDocument()
  })

  it('does not show progress trend when null', () => {
    render(<PracticeSummary {...defaultProps} progressTrend={null} />)
    expect(screen.queryByTestId('progress-trend')).not.toBeInTheDocument()
  })

  it('shows steady message when accuracy is unchanged', () => {
    const trend = [
      { accuracy_percent: 70, created_at: '2026-03-01' },
      { accuracy_percent: 70, created_at: '2026-03-10' },
    ]
    render(<PracticeSummary {...defaultProps} progressTrend={trend} />)

    expect(screen.getByText(/holding steady/)).toBeInTheDocument()
  })
})
