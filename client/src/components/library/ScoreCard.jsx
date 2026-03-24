import { Button } from '../ui'

const instrumentIcons = {
  violin: 'Vln',
  viola: 'Vla',
  cello: 'Vcl',
  'double-bass': 'Cb',
}

function DifficultyDots({ level = 3 }) {
  return (
    <div className="flex gap-1" aria-label={`Difficulty ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`inline-block w-2 h-2 max-w-2 max-h-2 rounded-full ${
            i <= level ? 'bg-amber' : 'bg-border'
          }`}
        />
      ))}
    </div>
  )
}

function ScoreCard({ score, onSelect, onPractice, isSelected = false }) {
  const { title, composer, instrument, difficulty, lastPracticed } = score

  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      onClick={() => onSelect(score)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(score)
        }
      }}
      className={`bg-surface border rounded-lg p-4 transition-all duration-200 cursor-pointer hover:shadow-amber-glow hover:border-border-light focus:outline-none focus:ring-2 focus:ring-amber ${
        isSelected ? 'border-amber shadow-amber-glow' : 'border-border'
      }`}
      data-testid="score-card"
    >
      {/* Thumbnail placeholder */}
      <div className="w-full h-32 max-h-32 bg-elevated rounded-md mb-3 flex items-center justify-center overflow-hidden">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="w-10 h-10 max-w-10 max-h-10 text-ivory-dim"
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>

      {/* Title */}
      <h3 className="font-heading text-lg text-ivory truncate" title={title}>
        {title || 'Untitled'}
      </h3>

      {/* Composer */}
      <p className="font-body text-sm text-ivory-muted truncate">
        {composer || 'Unknown Composer'}
      </p>

      {/* Meta row */}
      <div className="flex items-center justify-between mt-2">
        {instrument && (
          <span className="font-body text-xs text-amber bg-amber/10 px-2 py-0.5 rounded-full">
            {instrumentIcons[instrument] || instrument}
          </span>
        )}
        <DifficultyDots level={difficulty || 3} />
      </div>

      {/* Last practiced */}
      {lastPracticed && (
        <p className="font-body text-xs text-ivory-dim mt-2">
          Last practiced: {new Date(lastPracticed).toLocaleDateString()}
        </p>
      )}

      {/* Practice button */}
      {isSelected && (
        <Button
          size="sm"
          className="w-full mt-3"
          onClick={(e) => {
            e.stopPropagation()
            onPractice(score)
          }}
          data-testid="start-practice-btn"
        >
          Start Practice
        </Button>
      )}
    </div>
  )
}

export default ScoreCard
