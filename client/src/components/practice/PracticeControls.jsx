export default function PracticeControls({
  isPracticing,
  onPlayPause,
  onStop,
  visible,
  tempo = 120,
  onTempoChange,
  metronomeOn = false,
  onMetronomeToggle,
}) {
  return (
    <div
      data-testid="practice-controls"
      className={`absolute bottom-0 left-0 right-0 h-[20vh] bg-surface/90 backdrop-blur-sm border-t border-border transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex items-center justify-center gap-6 h-full max-w-2xl mx-auto px-4">
        {/* Stop button */}
        <button
          data-testid="stop-button"
          onClick={onStop}
          disabled={!isPracticing}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-elevated border border-border text-ivory-muted hover:text-ivory hover:bg-hover transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Stop"
        >
          <svg
            className="max-w-5 max-h-5 w-5 h-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>

        {/* Play/Pause button - large, centered, amber */}
        <button
          data-testid="play-pause-button"
          onClick={onPlayPause}
          className="flex items-center justify-center w-16 h-16 rounded-full bg-amber text-oxford-blue hover:bg-amber-light hover:shadow-amber-glow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-2 focus:ring-offset-oxford-blue"
          aria-label={isPracticing ? 'Pause' : 'Play'}
        >
          {isPracticing ? (
            <svg
              className="max-w-7 max-h-7 w-7 h-7"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg
              className="max-w-7 max-h-7 w-7 h-7 ml-1"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Tempo slider */}
        <div className="flex flex-col items-center gap-1">
          <label
            htmlFor="tempo-slider"
            className="text-xs font-body text-ivory-muted"
          >
            {tempo} BPM
          </label>
          <input
            id="tempo-slider"
            data-testid="tempo-slider"
            type="range"
            min="50"
            max="200"
            value={tempo}
            onChange={(e) => onTempoChange?.(Number(e.target.value))}
            className="w-24 accent-amber"
          />
        </div>

        {/* Metronome toggle */}
        <button
          data-testid="metronome-toggle"
          onClick={() => onMetronomeToggle?.(!metronomeOn)}
          className={`flex items-center justify-center w-10 h-10 rounded-full border transition-colors duration-200 ${
            metronomeOn
              ? 'bg-amber/20 border-amber text-amber'
              : 'bg-elevated border-border text-ivory-muted hover:text-ivory hover:bg-hover'
          }`}
          aria-label={metronomeOn ? 'Disable metronome' : 'Enable metronome'}
          aria-pressed={metronomeOn}
        >
          <svg
            className="max-w-5 max-h-5 w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L8 22h8L12 2z" />
            <path d="M12 8l4 4" />
          </svg>
        </button>
      </div>
    </div>
  )
}
