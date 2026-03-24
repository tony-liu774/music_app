import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal, Button } from '../ui'
import {
  buildPayload,
  requestAIDebrief,
  generateLocalDebrief,
} from '../../services/AISummaryService'

/**
 * CoachDebrief — modal shown after practice stops.
 * Displays a loading spinner while the AI generates a two-sentence
 * debrief, then renders the response with styled score and text.
 */
export default function CoachDebrief({
  isOpen,
  onClose,
  sessionLog,
  sessionSummary,
  worstMeasures,
  instrument = 'violin',
  onPracticeAgain,
}) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const fetchDebrief = useCallback(async () => {
    if (!sessionLog && !sessionSummary) return

    setLoading(true)
    setResult(null)

    const payload = buildPayload({
      sessionLog,
      sessionSummary,
      worstMeasures,
      durationMs: sessionLog?.duration_ms || 0,
      instrument,
    })

    try {
      const debrief = await requestAIDebrief(payload)
      setResult(debrief)
    } catch {
      setResult(generateLocalDebrief(payload))
    } finally {
      setLoading(false)
    }
  }, [sessionLog, sessionSummary, worstMeasures, instrument])

  useEffect(() => {
    if (isOpen) {
      fetchDebrief()
    } else {
      setResult(null)
      setLoading(false)
    }
  }, [isOpen, fetchDebrief])

  const handleViewDetails = () => {
    onClose()
    navigate('/practice?view=heatmap')
  }

  const handlePracticeAgain = () => {
    onClose()
    if (onPracticeAgain) onPracticeAgain()
  }

  const scoreColor =
    result?.score != null
      ? result.score >= 70
        ? 'text-emerald'
        : 'text-crimson'
      : 'text-ivory-muted'

  const durationSec = sessionLog?.duration_ms
    ? Math.round(sessionLog.duration_ms / 1000)
    : 0
  const durationDisplay =
    durationSec >= 60
      ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`
      : `${durationSec}s`

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <div data-testid="coach-debrief">
        {/* Header */}
        <h2 className="font-heading text-2xl text-ivory mb-1">
          Session Debrief
        </h2>
        <div className="w-16 h-0.5 bg-amber mb-6" data-testid="amber-accent" />

        {/* Loading state */}
        {loading && (
          <div
            className="flex flex-col items-center justify-center py-8"
            data-testid="debrief-loading"
          >
            <div className="animate-amber-spin w-8 h-8 border-2 border-amber/30 border-t-amber rounded-full mb-4" />
            <p className="font-body text-sm text-ivory-muted">
              Analyzing your session...
            </p>
          </div>
        )}

        {/* Result */}
        {!loading && result && (
          <div data-testid="debrief-result">
            {/* Score */}
            {result.score != null && (
              <div className="text-center mb-6" data-testid="debrief-score">
                <p className={`font-heading text-5xl ${scoreColor}`}>
                  {result.score}
                </p>
                <p className="font-body text-xs text-ivory-muted mt-1">
                  Session Score
                </p>
              </div>
            )}

            {/* AI text */}
            <p
              className="font-body text-base text-ivory leading-relaxed mb-4"
              data-testid="debrief-text"
            >
              {result.debrief}
            </p>

            {/* Session stats row */}
            <div className="flex justify-between font-body text-xs text-ivory-muted border-t border-border pt-3 mb-6">
              <span>Duration: {durationDisplay}</span>
              <span>
                Accuracy:{' '}
                {
                  buildPayload({
                    sessionLog,
                    sessionSummary,
                    worstMeasures,
                    instrument,
                  }).accuracyPercent
                }
                %
              </span>
            </div>

            {result.isOfflineFallback && (
              <p
                className="font-body text-xs text-ivory-dim mb-4 italic"
                data-testid="offline-indicator"
              >
                AI coach unavailable — showing local summary
              </p>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                onClick={handlePracticeAgain}
                data-testid="practice-again-btn"
              >
                Practice Again
              </Button>
              <Button
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={handleViewDetails}
                data-testid="view-details-btn"
              >
                View Details
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
