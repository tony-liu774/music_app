import { useMemo } from 'react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { useSessionStore } from '../../stores/useSessionStore'
import { useLibraryStore } from '../../stores/useLibraryStore'

function findWeakestScore(practiceHistory, scores) {
  if (!scores.length) return null

  const scoreAccuracies = new Map()
  for (const record of practiceHistory) {
    const id = record.scoreId
    if (!id) continue
    const existing = scoreAccuracies.get(id)
    if (existing) {
      existing.total += record.accuracy || 0
      existing.count++
      existing.lastDate = Math.max(
        existing.lastDate,
        new Date(record.date || record.timestamp).getTime(),
      )
    } else {
      scoreAccuracies.set(id, {
        total: record.accuracy || 0,
        count: 1,
        lastDate: new Date(record.date || record.timestamp).getTime(),
      })
    }
  }

  // Prefer unpracticed scores first (encourage breadth)
  const unpracticed = scores.filter((s) => !scoreAccuracies.has(s.id))
  if (unpracticed.length) {
    return { score: unpracticed[0], avgAccuracy: null, sessions: 0 }
  }

  // Otherwise suggest the weakest practiced score
  let weakest = null
  let weakestAvg = Infinity

  for (const score of scores) {
    const stats = scoreAccuracies.get(score.id)
    if (stats) {
      const avg = stats.total / stats.count
      if (avg < weakestAvg) {
        weakestAvg = avg
        weakest = { score, avgAccuracy: avg, sessions: stats.count }
      }
    }
  }

  return weakest
}

export default function UpNextWidget() {
  const practiceHistory = useSessionStore((s) => s.practiceHistory)
  const scores = useLibraryStore((s) => s.scores)

  const suggestion = useMemo(
    () => findWeakestScore(practiceHistory, scores),
    [practiceHistory, scores],
  )

  return (
    <Card data-testid="up-next-widget">
      <div className="flex items-center gap-2 mb-4">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5 max-w-5 max-h-5 text-amber"
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <h2 className="font-heading text-lg text-amber">Up Next</h2>
      </div>

      {!suggestion ? (
        <div data-testid="up-next-empty">
          <p className="text-ivory-muted font-body text-sm">
            Add scores to your library to get personalized practice suggestions.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => {
              window.location.hash = '#/library'
            }}
          >
            Browse Library
          </Button>
        </div>
      ) : (
        <div data-testid="up-next-suggestion">
          <h3 className="font-body text-ivory font-semibold truncate">
            {suggestion.score.title || 'Untitled Score'}
          </h3>
          <p className="text-sm text-ivory-muted font-body mt-1">
            {suggestion.score.composer || 'Unknown Composer'}
          </p>

          {suggestion.avgAccuracy != null && (
            <div className="flex items-center gap-3 mt-3">
              <span className="text-sm text-ivory-muted font-body">
                Avg accuracy:
              </span>
              <span
                className={`text-sm font-semibold font-body ${
                  suggestion.avgAccuracy >= 80
                    ? 'text-emerald'
                    : suggestion.avgAccuracy >= 60
                      ? 'text-amber'
                      : 'text-crimson'
                }`}
                data-testid="suggestion-accuracy"
              >
                {Math.round(suggestion.avgAccuracy)}%
              </span>
              <span className="text-sm text-ivory-dim font-body">
                ({suggestion.sessions}{' '}
                {suggestion.sessions === 1 ? 'session' : 'sessions'})
              </span>
            </div>
          )}

          {suggestion.sessions === 0 && (
            <p className="text-sm text-ivory-dim font-body mt-2">
              Not yet practiced
            </p>
          )}

          <Button
            size="sm"
            className="mt-4"
            onClick={() => {
              window.location.hash = '#/practice'
            }}
            data-testid="start-practice-btn"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4 max-w-4 max-h-4 mr-2"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Start Practice
          </Button>
        </div>
      )}
    </Card>
  )
}

export { findWeakestScore }
