import { useMemo } from 'react'
import Card from '../ui/Card'
import { useSessionStore } from '../../stores/useSessionStore'

function getStreakDays(history) {
  if (!history.length) return 0

  const daySet = new Set()
  for (const record of history) {
    const d = new Date(record.date || record.timestamp)
    daySet.add(d.toISOString().slice(0, 10))
  }

  const sortedDays = [...daySet].sort().reverse()
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  if (sortedDays[0] !== today && sortedDays[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1])
    const curr = new Date(sortedDays[i])
    const diffMs = prev - curr
    if (diffMs <= 86400000 * 1.5 && diffMs > 0) {
      streak++
    } else {
      break
    }
  }
  return streak
}

function getWeekStats(history) {
  const now = Date.now()
  const weekAgo = now - 7 * 86400000
  const weekRecords = history.filter((r) => {
    const t = r.date || r.timestamp
    return t && new Date(t).getTime() >= weekAgo
  })

  const totalMinutes = weekRecords.reduce((sum, r) => sum + (r.duration || 0), 0)
  return { sessions: weekRecords.length, totalMinutes }
}

function formatDuration(minutes) {
  if (minutes < 60) return `${Math.round(minutes)}m`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function PracticeStreakWidget() {
  const practiceHistory = useSessionStore((s) => s.practiceHistory)

  const streak = useMemo(() => getStreakDays(practiceHistory), [practiceHistory])
  const { sessions, totalMinutes } = useMemo(
    () => getWeekStats(practiceHistory),
    [practiceHistory],
  )

  return (
    <Card data-testid="practice-streak-widget">
      <h2 className="font-heading text-lg text-amber mb-4">Practice Streak</h2>
      <div className="flex items-end gap-6">
        <div className="text-center">
          <span
            className="block font-heading text-4xl text-ivory"
            data-testid="streak-days"
          >
            {streak}
          </span>
          <span className="text-sm text-ivory-muted font-body">
            {streak === 1 ? 'day' : 'days'}
          </span>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-4">
          <div>
            <span
              className="block text-xl font-heading text-ivory"
              data-testid="week-time"
            >
              {formatDuration(totalMinutes)}
            </span>
            <span className="text-sm text-ivory-muted font-body">this week</span>
          </div>
          <div>
            <span
              className="block text-xl font-heading text-ivory"
              data-testid="week-sessions"
            >
              {sessions}
            </span>
            <span className="text-sm text-ivory-muted font-body">
              {sessions === 1 ? 'session' : 'sessions'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export { getStreakDays, getWeekStats, formatDuration }
