import { useState, useMemo } from 'react'
import PropTypes from 'prop-types'
import { Button } from '../ui'
import PitchAccuracyChart from './PitchAccuracyChart'

/**
 * PracticeSummary — full-screen post-practice analytics dashboard.
 *
 * Displays session stats (duration, notes played, accuracy, sections),
 * AI coach feedback, pitch accuracy chart, problem notes list,
 * and a Smart Loop trigger button.
 */
export default function PracticeSummary({
  sessionLog,
  sessionSummary,
  aiResult,
  aiLoading,
  heatMapData,
  onPracticeAgain,
  onSmartLoop,
  onToggleHeatMap,
  heatMapVisible,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('overview')

  const stats = useMemo(() => {
    if (!sessionLog && !sessionSummary) return null

    const deviations = sessionLog?.deviations || []
    const pitchDevs = deviations.filter((d) => d.type === 'pitch')

    // Duration
    const durationMs = sessionLog?.duration_ms || 0
    const durationSec = Math.round(durationMs / 1000)
    const durationDisplay =
      durationSec >= 60
        ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`
        : `${durationSec}s`

    // Notes played (unique pitch readings)
    const notesPlayed = pitchDevs.length

    // Accuracy: readings within ±15 cents
    const accurateCount = pitchDevs.filter(
      (d) => Math.abs(d.centsDeviation || 0) <= 15,
    ).length
    const accuracyPercent =
      pitchDevs.length > 0
        ? Math.round((accurateCount / pitchDevs.length) * 100)
        : 100

    // Sections practiced (unique measures)
    const measuresSet = new Set(deviations.map((d) => d.measureNumber).filter(Boolean))
    const sectionsPracticed = measuresSet.size

    // Average deviation
    const avgDeviation =
      pitchDevs.length > 0
        ? Math.round(
            (pitchDevs.reduce((s, d) => s + Math.abs(d.centsDeviation || 0), 0) /
              pitchDevs.length) *
              10,
          ) / 10
        : 0

    return {
      durationDisplay,
      notesPlayed,
      accuracyPercent,
      sectionsPracticed,
      avgDeviation,
    }
  }, [sessionLog, sessionSummary])

  const problemNotes = useMemo(() => {
    if (!sessionLog?.deviations) return []

    const pitchDevs = sessionLog.deviations.filter((d) => d.type === 'pitch')
    const noteMap = {}

    for (const d of pitchDevs) {
      const note = d.detectedNote || d.expectedNote
      if (!note) continue
      if (!noteMap[note]) {
        noteMap[note] = { note, totalDeviation: 0, count: 0 }
      }
      noteMap[note].totalDeviation += Math.abs(d.centsDeviation || 0)
      noteMap[note].count++
    }

    return Object.values(noteMap)
      .map((n) => ({
        ...n,
        avgDeviation: Math.round((n.totalDeviation / n.count) * 10) / 10,
      }))
      .filter((n) => n.avgDeviation > 10)
      .sort((a, b) => b.avgDeviation - a.avgDeviation)
      .slice(0, 8)
  }, [sessionLog])

  const errorMeasures = useMemo(() => {
    if (!heatMapData) return []
    return heatMapData
      .filter((d) => d.type === 'error' && d.errorCount > 0)
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 5)
  }, [heatMapData])

  if (!stats) return null

  const scoreColor =
    stats.accuracyPercent >= 80
      ? 'text-emerald'
      : stats.accuracyPercent >= 60
        ? 'text-amber'
        : 'text-crimson'

  return (
    <div
      data-testid="practice-summary"
      className="animate-fade-in w-full max-w-4xl mx-auto px-4 py-6"
    >
      {/* Header with AI feedback */}
      <div className="text-center mb-8">
        <h2 className="font-heading text-3xl text-ivory mb-2">
          Session Complete
        </h2>
        <div className="w-20 h-0.5 bg-amber mx-auto mb-6" />

        {/* AI Coach feedback */}
        {aiLoading && (
          <div
            className="flex items-center justify-center gap-3 py-4"
            data-testid="ai-loading"
          >
            <div className="animate-amber-spin w-5 h-5 border-2 border-amber/30 border-t-amber rounded-full" />
            <p className="font-body text-sm text-ivory-muted">
              Your AI coach is reviewing...
            </p>
          </div>
        )}

        {!aiLoading && aiResult && (
          <div data-testid="ai-feedback" className="mb-4">
            <p className="font-heading text-lg text-ivory leading-relaxed max-w-2xl mx-auto">
              {aiResult.debrief}
            </p>
            {aiResult.isOfflineFallback && (
              <p className="font-body text-xs text-ivory-dim mt-2 italic">
                AI coach unavailable — showing local summary
              </p>
            )}
          </div>
        )}
      </div>

      {/* Score + Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Accuracy"
          value={`${stats.accuracyPercent}%`}
          valueClass={scoreColor}
        />
        <StatCard label="Duration" value={stats.durationDisplay} />
        <StatCard label="Notes Played" value={stats.notesPlayed} />
        <StatCard label="Sections" value={stats.sectionsPracticed} />
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-border mb-6">
        {['overview', 'accuracy', 'problems'].map((tab) => (
          <button
            key={tab}
            data-testid={`tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`font-body text-sm px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-amber text-amber'
                : 'border-transparent text-ivory-muted hover:text-ivory'
            }`}
          >
            {tab === 'overview'
              ? 'Overview'
              : tab === 'accuracy'
                ? 'Pitch Accuracy'
                : 'Problem Areas'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[200px]">
        {activeTab === 'overview' && (
          <div data-testid="tab-content-overview" className="space-y-4">
            <div className="bg-surface rounded-lg border border-border p-4">
              <h3 className="font-heading text-sm text-ivory mb-3">
                Session Statistics
              </h3>
              <div className="space-y-2 font-body text-sm text-ivory-muted">
                <p>
                  Average pitch deviation:{' '}
                  <span className="text-ivory">{stats.avgDeviation}¢</span>
                </p>
                <p>
                  Total deviations logged:{' '}
                  <span className="text-ivory">
                    {sessionSummary?.total_deviations || 0}
                  </span>
                </p>
                {sessionSummary?.worst_measure && (
                  <p>
                    Weakest measure:{' '}
                    <span className="text-crimson">
                      m.{sessionSummary.worst_measure}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Error measures */}
            {errorMeasures.length > 0 && (
              <div className="bg-surface rounded-lg border border-border p-4">
                <h3 className="font-heading text-sm text-ivory mb-3">
                  Measures Needing Work
                </h3>
                <div className="flex flex-wrap gap-2">
                  {errorMeasures.map((m) => (
                    <span
                      key={m.measureNumber}
                      className="font-body text-xs bg-crimson/10 text-crimson border border-crimson/20 px-2 py-1 rounded"
                    >
                      m.{m.measureNumber} ({m.errorCount} errors)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'accuracy' && (
          <div data-testid="tab-content-accuracy">
            <PitchAccuracyChart deviations={sessionLog?.deviations || []} />
          </div>
        )}

        {activeTab === 'problems' && (
          <div data-testid="tab-content-problems">
            {problemNotes.length === 0 ? (
              <p className="font-body text-sm text-ivory-muted text-center py-8">
                No significant problem notes detected. Great work!
              </p>
            ) : (
              <div className="bg-surface rounded-lg border border-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="font-body text-xs text-ivory-muted text-left px-4 py-2">
                        Note
                      </th>
                      <th className="font-body text-xs text-ivory-muted text-left px-4 py-2">
                        Occurrences
                      </th>
                      <th className="font-body text-xs text-ivory-muted text-left px-4 py-2">
                        Avg Deviation
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {problemNotes.map((n) => (
                      <tr
                        key={n.note}
                        className="border-b border-border/50"
                        data-testid={`problem-note-${n.note}`}
                      >
                        <td className="font-body text-sm text-ivory px-4 py-2">
                          {n.note}
                        </td>
                        <td className="font-body text-sm text-ivory-muted px-4 py-2">
                          {n.count}
                        </td>
                        <td className="font-body text-sm px-4 py-2">
                          <span
                            className={
                              n.avgDeviation > 25
                                ? 'text-crimson'
                                : 'text-amber'
                            }
                          >
                            {n.avgDeviation}¢
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mt-8 justify-center">
        <Button
          variant="primary"
          size="md"
          onClick={onPracticeAgain}
          data-testid="summary-practice-again"
        >
          Practice Again
        </Button>

        {errorMeasures.length > 0 && (
          <Button
            variant="secondary"
            size="md"
            onClick={onSmartLoop}
            data-testid="summary-smart-loop"
          >
            Smart Loop Weak Measures
          </Button>
        )}

        <Button
          variant="secondary"
          size="md"
          onClick={onToggleHeatMap}
          data-testid="summary-toggle-heatmap"
        >
          {heatMapVisible ? 'Hide' : 'Show'} Heat Map
        </Button>

        <Button
          variant="secondary"
          size="md"
          onClick={onClose}
          data-testid="summary-close"
        >
          Close
        </Button>
      </div>
    </div>
  )
}

PracticeSummary.propTypes = {
  sessionLog: PropTypes.object,
  sessionSummary: PropTypes.object,
  aiResult: PropTypes.shape({
    debrief: PropTypes.string,
    score: PropTypes.number,
    isOfflineFallback: PropTypes.bool,
  }),
  aiLoading: PropTypes.bool,
  heatMapData: PropTypes.array,
  onPracticeAgain: PropTypes.func,
  onSmartLoop: PropTypes.func,
  onToggleHeatMap: PropTypes.func,
  heatMapVisible: PropTypes.bool,
  onClose: PropTypes.func,
}

/**
 * StatCard — single stat display in the summary grid.
 */
function StatCard({ label, value, valueClass = 'text-ivory' }) {
  return (
    <div className="bg-surface rounded-lg border border-border p-4 text-center">
      <p className={`font-heading text-2xl ${valueClass}`}>{value}</p>
      <p className="font-body text-xs text-ivory-muted mt-1">{label}</p>
    </div>
  )
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  valueClass: PropTypes.string,
}
