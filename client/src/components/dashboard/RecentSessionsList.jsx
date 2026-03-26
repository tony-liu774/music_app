import Card from '../ui/Card'
import { useSessionStore } from '../../stores/useSessionStore'

function formatDate(timestamp) {
  const d = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatSessionDuration(minutes) {
  if (!minutes || minutes < 1) return '<1 min'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function RecentSessionsList() {
  const practiceHistory = useSessionStore((s) => s.practiceHistory)

  const recentSessions = [...practiceHistory]
    .sort((a, b) => {
      const ta = new Date(a.date || a.timestamp).getTime()
      const tb = new Date(b.date || b.timestamp).getTime()
      return tb - ta
    })
    .slice(0, 10)

  return (
    <Card data-testid="recent-sessions-list">
      <h2 className="font-heading text-lg text-amber mb-4">Recent Sessions</h2>
      {recentSessions.length === 0 ? (
        <p
          className="text-ivory-muted font-body text-sm"
          data-testid="empty-state"
        >
          No practice sessions yet. Start practicing to see your history here.
        </p>
      ) : (
        <ul className="space-y-3" data-testid="sessions-list">
          {recentSessions.map((session, index) => (
            <li
              key={session.id || index}
              className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
              data-testid="session-item"
            >
              <div className="flex-1 min-w-0">
                <p className="font-body text-ivory truncate">
                  {session.pieceName || session.scoreName || 'Practice Session'}
                </p>
                <p className="text-sm text-ivory-muted font-body">
                  {formatDate(session.date || session.timestamp)} &middot;{' '}
                  {formatSessionDuration(session.duration)}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-3">
                {session.accuracy != null && (
                  <span
                    className={`text-sm font-body font-semibold ${
                      session.accuracy >= 80
                        ? 'text-emerald'
                        : session.accuracy >= 60
                          ? 'text-amber'
                          : 'text-crimson'
                    }`}
                    data-testid="accuracy-score"
                  >
                    {Math.round(session.accuracy)}%
                  </span>
                )}
                {session.sessionId && (
                  <a
                    href={`#/practice?review=${session.sessionId}`}
                    className="text-sm text-amber hover:text-amber-light font-body transition-colors duration-200"
                    data-testid="review-link"
                  >
                    Review
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export { formatDate, formatSessionDuration }
