import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '../stores/useLibraryStore'
import { Button } from '../components/ui'

export default function Practice() {
  const navigate = useNavigate()
  const selectedScore = useLibraryStore((s) => s.selectedScore)

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-3xl text-amber">Practice</h1>

      {selectedScore ? (
        <div className="space-y-4" data-testid="practice-score-info">
          <div className="bg-surface border border-border rounded-lg p-6">
            <h2 className="font-heading text-xl text-ivory">
              {selectedScore.title}
            </h2>
            <p className="font-body text-ivory-muted">
              {selectedScore.composer || 'Unknown Composer'}
            </p>
            {selectedScore.instrument && (
              <span className="inline-block font-body text-xs text-amber bg-amber/10 px-2 py-0.5 rounded-full mt-2">
                {selectedScore.instrument}
              </span>
            )}
          </div>
          <p className="font-body text-ivory-muted">
            Start a guided practice session with real-time feedback.
          </p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="practice-no-score">
          <p className="font-body text-ivory-muted">
            No score selected. Choose a piece from the library to start a guided
            practice session with real-time feedback.
          </p>
          <Button variant="secondary" onClick={() => navigate('/library')}>
            Browse Library
          </Button>
        </div>
      )}
    </div>
  )
}
