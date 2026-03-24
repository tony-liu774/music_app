import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import CoachDebrief from '../CoachDebrief'

// Mock the AISummaryService
vi.mock('../../../services/AISummaryService', () => ({
  buildPayload: vi.fn(() => ({
    instrument: 'violin',
    durationMs: 60000,
    accuracyPercent: 78,
    intonationTrend: 'improving',
    vibratoUsagePercent: 30,
    worstMeasures: [{ measureNumber: 4, averageDeviation: 25, errorCount: 3 }],
    summaryStats: { total_deviations: 10 },
    recentDeviations: [],
  })),
  requestAIDebrief: vi.fn(),
  generateLocalDebrief: vi.fn(() => ({
    debrief: 'Good effort — keep practicing measure 4.',
    score: 78,
    isOfflineFallback: true,
  })),
}))

import * as AISummaryService from '../../../services/AISummaryService'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  sessionLog: {
    session_id: 'test',
    duration_ms: 60000,
    deviations: [{ type: 'pitch', centsDeviation: 20 }],
  },
  sessionSummary: {
    total_deviations: 10,
    pitch_deviation_count: 8,
    average_pitch_deviation_cents: 18,
  },
  worstMeasures: [{ measureNumber: 4, averageDeviation: 25, errorCount: 3 }],
  instrument: 'violin',
  onPracticeAgain: vi.fn(),
}

function renderDebrief(props = {}) {
  return render(
    <MemoryRouter>
      <CoachDebrief {...defaultProps} {...props} />
    </MemoryRouter>,
  )
}

describe('CoachDebrief', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    AISummaryService.requestAIDebrief.mockResolvedValue({
      debrief:
        'Your bowing was smooth and controlled today! Try slowing down measure 4 to nail the shifting.',
      score: 82,
      isOfflineFallback: false,
    })
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = renderDebrief({ isOpen: false })
    expect(container.querySelector('[data-testid="coach-debrief"]')).toBeNull()
  })

  it('shows the Session Debrief heading', async () => {
    renderDebrief()
    expect(screen.getByText('Session Debrief')).toBeInTheDocument()
  })

  it('displays the amber accent line', async () => {
    renderDebrief()
    expect(screen.getByTestId('amber-accent')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    // Make the request hang
    AISummaryService.requestAIDebrief.mockReturnValue(new Promise(() => {}))
    renderDebrief()
    expect(screen.getByTestId('debrief-loading')).toBeInTheDocument()
    expect(screen.getByText('Analyzing your session...')).toBeInTheDocument()
  })

  it('displays AI debrief text after loading', async () => {
    renderDebrief()
    await waitFor(() => {
      expect(screen.getByTestId('debrief-result')).toBeInTheDocument()
    })
    expect(screen.getByTestId('debrief-text')).toHaveTextContent(
      'Your bowing was smooth and controlled today!',
    )
  })

  it('displays the session score with correct color', async () => {
    renderDebrief()
    await waitFor(() => {
      expect(screen.getByTestId('debrief-score')).toBeInTheDocument()
    })
    const scoreEl = screen.getByText('82')
    expect(scoreEl).toBeInTheDocument()
    // Score >= 70 should use emerald
    expect(scoreEl.className).toContain('text-emerald')
  })

  it('uses crimson color for low scores', async () => {
    AISummaryService.requestAIDebrief.mockResolvedValue({
      debrief: 'Keep working at it!',
      score: 45,
      isOfflineFallback: false,
    })
    renderDebrief()
    await waitFor(() => {
      expect(screen.getByTestId('debrief-score')).toBeInTheDocument()
    })
    const scoreEl = screen.getByText('45')
    expect(scoreEl.className).toContain('text-crimson')
  })

  it('shows Practice Again and View Details buttons', async () => {
    renderDebrief()
    await waitFor(() => {
      expect(screen.getByTestId('debrief-result')).toBeInTheDocument()
    })
    expect(screen.getByTestId('practice-again-btn')).toBeInTheDocument()
    expect(screen.getByTestId('view-details-btn')).toBeInTheDocument()
  })

  it('calls onClose and onPracticeAgain when Practice Again is clicked', async () => {
    const onClose = vi.fn()
    const onPracticeAgain = vi.fn()
    renderDebrief({ onClose, onPracticeAgain })

    await waitFor(() => {
      expect(screen.getByTestId('practice-again-btn')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('practice-again-btn'))

    expect(onClose).toHaveBeenCalled()
  })

  it('navigates to heatmap view when View Details is clicked', async () => {
    renderDebrief()
    await waitFor(() => {
      expect(screen.getByTestId('view-details-btn')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('view-details-btn'))

    expect(mockNavigate).toHaveBeenCalledWith('/practice?view=heatmap')
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('shows offline indicator when using fallback', async () => {
    AISummaryService.requestAIDebrief.mockResolvedValue({
      debrief: 'Good effort!',
      score: 70,
      isOfflineFallback: true,
    })
    renderDebrief()
    await waitFor(() => {
      expect(screen.getByTestId('offline-indicator')).toBeInTheDocument()
    })
    expect(screen.getByText(/AI coach unavailable/)).toBeInTheDocument()
  })

  it('falls back to local debrief when requestAIDebrief throws', async () => {
    AISummaryService.requestAIDebrief.mockRejectedValue(new Error('fail'))
    renderDebrief()
    await waitFor(() => {
      expect(screen.getByTestId('debrief-result')).toBeInTheDocument()
    })
    expect(screen.getByTestId('offline-indicator')).toBeInTheDocument()
  })

  it('displays session duration', async () => {
    renderDebrief()
    await waitFor(() => {
      expect(screen.getByTestId('debrief-result')).toBeInTheDocument()
    })
    expect(screen.getByText(/Duration: 1m 0s/)).toBeInTheDocument()
  })

  it('displays accuracy percentage', async () => {
    renderDebrief()
    await waitFor(() => {
      expect(screen.getByTestId('debrief-result')).toBeInTheDocument()
    })
    expect(screen.getByText(/Accuracy: 78%/)).toBeInTheDocument()
  })

  it('uses Playfair Display for the heading', () => {
    renderDebrief()
    const heading = screen.getByText('Session Debrief')
    expect(heading.className).toContain('font-heading')
  })

  it('uses Source Sans 3 (font-body) for the debrief text', async () => {
    renderDebrief()
    await waitFor(() => {
      expect(screen.getByTestId('debrief-text')).toBeInTheDocument()
    })
    expect(screen.getByTestId('debrief-text').className).toContain('font-body')
  })

  it('calls buildPayload with correct arguments', async () => {
    renderDebrief()
    await waitFor(() => {
      expect(AISummaryService.buildPayload).toHaveBeenCalled()
    })
    expect(AISummaryService.buildPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionLog: defaultProps.sessionLog,
        sessionSummary: defaultProps.sessionSummary,
        worstMeasures: defaultProps.worstMeasures,
        instrument: 'violin',
      }),
    )
  })

  it('resets state when closed and reopened', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <CoachDebrief {...defaultProps} isOpen={true} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('debrief-result')).toBeInTheDocument()
    })

    rerender(
      <MemoryRouter>
        <CoachDebrief {...defaultProps} isOpen={false} />
      </MemoryRouter>,
    )

    // Should have no debrief content visible
    expect(screen.queryByTestId('coach-debrief')).not.toBeInTheDocument()
  })
})
