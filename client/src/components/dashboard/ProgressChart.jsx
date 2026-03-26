import { useMemo } from 'react'
import Card from '../ui/Card'
import { useSessionStore } from '../../stores/useSessionStore'

function aggregateByDay(history) {
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 86400000

  const dayMap = new Map()
  for (const record of history) {
    const t = new Date(record.date || record.timestamp).getTime()
    if (t < thirtyDaysAgo || record.accuracy == null) continue
    const dayKey = new Date(t).toISOString().slice(0, 10)
    const existing = dayMap.get(dayKey)
    if (existing) {
      existing.total += record.accuracy
      existing.count++
    } else {
      dayMap.set(dayKey, { total: record.accuracy, count: 1, date: dayKey })
    }
  }

  return [...dayMap.values()]
    .map((d) => ({ date: d.date, accuracy: d.total / d.count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function buildPolyline(points, width, height, padding) {
  if (points.length === 0) return ''
  if (points.length === 1) return ''

  const minVal = Math.min(...points.map((p) => p.accuracy), 0)
  const maxVal = Math.max(...points.map((p) => p.accuracy), 100)
  const range = maxVal - minVal || 1

  const chartW = width - padding * 2
  const chartH = height - padding * 2

  return points
    .map((p, i) => {
      const x = padding + (i / (points.length - 1)) * chartW
      const y = padding + chartH - ((p.accuracy - minVal) / range) * chartH
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

const CHART_WIDTH = 400
const CHART_HEIGHT = 160
const PADDING = 24

export default function ProgressChart() {
  const practiceHistory = useSessionStore((s) => s.practiceHistory)

  const dataPoints = useMemo(
    () => aggregateByDay(practiceHistory),
    [practiceHistory],
  )
  const polyline = useMemo(
    () => buildPolyline(dataPoints, CHART_WIDTH, CHART_HEIGHT, PADDING),
    [dataPoints],
  )

  const hasData = dataPoints.length >= 2

  return (
    <Card data-testid="progress-chart">
      <h2 className="font-heading text-lg text-amber mb-4">Accuracy Trend</h2>
      {!hasData ? (
        <p
          className="text-ivory-muted font-body text-sm"
          data-testid="chart-empty-state"
        >
          Practice at least 2 days to see your accuracy trend.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full max-w-lg max-h-48"
          role="img"
          aria-label="Accuracy trend chart over the last 30 days"
          data-testid="chart-svg"
        >
          {/* Background */}
          <rect
            x="0"
            y="0"
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            rx="8"
            className="fill-oxford-blue"
          />

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const y =
              PADDING +
              (CHART_HEIGHT - PADDING * 2) -
              (pct / 100) * (CHART_HEIGHT - PADDING * 2)
            return (
              <g key={pct}>
                <line
                  x1={PADDING}
                  y1={y}
                  x2={CHART_WIDTH - PADDING}
                  y2={y}
                  className="stroke-border"
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={PADDING - 4}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-ivory-dim text-[9px] font-body"
                >
                  {pct}%
                </text>
              </g>
            )
          })}

          {/* Trend line */}
          <polyline
            points={polyline}
            fill="none"
            className="stroke-amber"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            data-testid="trend-line"
          />

          {/* Data points */}
          {dataPoints.map((p, i) => {
            const x =
              PADDING +
              (i / (dataPoints.length - 1)) * (CHART_WIDTH - PADDING * 2)
            const y =
              PADDING +
              (CHART_HEIGHT - PADDING * 2) -
              ((p.accuracy -
                Math.min(...dataPoints.map((d) => d.accuracy), 0)) /
                (Math.max(...dataPoints.map((d) => d.accuracy), 100) -
                  Math.min(...dataPoints.map((d) => d.accuracy), 0) || 1)) *
                (CHART_HEIGHT - PADDING * 2)
            return (
              <circle
                key={p.date}
                cx={x.toFixed(1)}
                cy={y.toFixed(1)}
                r="3"
                className="fill-amber"
                data-testid="data-point"
              >
                <title>
                  {p.date}: {Math.round(p.accuracy)}%
                </title>
              </circle>
            )
          })}
        </svg>
      )}
    </Card>
  )
}

export { aggregateByDay, buildPolyline }
