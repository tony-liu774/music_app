import { useState, useCallback } from 'react'

/* eslint-disable react/prop-types */

/**
 * LoopSelector — lets the player pick a measure range (X to Y) for focused
 * practice. Displays inline within the transport controls bar.
 *
 * Props:
 * - totalMeasures: number — total measures in the loaded score
 * - loopStart: number|null — current loop start measure (1-based)
 * - loopEnd: number|null — current loop end measure (1-based)
 * - onLoopChange: (start: number|null, end: number|null) => void
 * - disabled: boolean — disable when no score is loaded
 */
export default function LoopSelector({
  totalMeasures = 0,
  loopStart = null,
  loopEnd = null,
  onLoopChange,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false)

  const isActive = loopStart !== null && loopEnd !== null

  const handleStartChange = useCallback(
    (e) => {
      const val = Number(e.target.value)
      const end = loopEnd ?? Math.min(val + 3, totalMeasures)
      onLoopChange?.(val, Math.max(val, end))
    },
    [loopEnd, totalMeasures, onLoopChange],
  )

  const handleEndChange = useCallback(
    (e) => {
      const val = Number(e.target.value)
      const start = loopStart ?? 1
      onLoopChange?.(Math.min(start, val), val)
    },
    [loopStart, onLoopChange],
  )

  const handleClearLoop = useCallback(() => {
    onLoopChange?.(null, null)
    setIsOpen(false)
  }, [onLoopChange])

  const handleToggle = useCallback(() => {
    if (isActive) {
      handleClearLoop()
    } else {
      setIsOpen((prev) => !prev)
      if (!isOpen && !isActive) {
        // Default: first 4 measures
        const defaultEnd = Math.min(4, totalMeasures)
        onLoopChange?.(1, defaultEnd)
      }
    }
  }, [isActive, isOpen, totalMeasures, onLoopChange, handleClearLoop])

  return (
    <div className="flex items-center gap-2" data-testid="loop-selector">
      {/* Loop toggle button */}
      <button
        data-testid="loop-toggle"
        onClick={handleToggle}
        disabled={disabled || totalMeasures === 0}
        className={`flex items-center justify-center w-10 h-10 rounded-full border transition-colors duration-200 ${
          isActive
            ? 'bg-amber/20 border-amber text-amber'
            : 'bg-elevated border-border text-ivory-muted hover:text-ivory hover:bg-hover'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
        aria-label={isActive ? 'Clear loop' : 'Set loop range'}
        aria-pressed={isActive}
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
          <path d="M17 2l4 4-4 4" />
          <path d="M3 11v-1a4 4 0 014-4h14" />
          <path d="M7 22l-4-4 4-4" />
          <path d="M21 13v1a4 4 0 01-4 4H3" />
        </svg>
      </button>

      {/* Measure range inputs — shown when loop is active */}
      {isActive && (
        <div className="flex items-center gap-1.5" data-testid="loop-range">
          <label className="text-xs font-body text-ivory-muted sr-only">
            Loop start
          </label>
          <input
            data-testid="loop-start-input"
            type="number"
            min={1}
            max={loopEnd || totalMeasures}
            value={loopStart}
            onChange={handleStartChange}
            className="w-12 h-7 text-center text-xs font-body text-ivory bg-elevated border border-border rounded px-1 focus:border-amber focus:outline-none"
            aria-label="Loop start measure"
          />
          <span className="text-xs font-body text-ivory-dim">–</span>
          <input
            data-testid="loop-end-input"
            type="number"
            min={loopStart || 1}
            max={totalMeasures}
            value={loopEnd}
            onChange={handleEndChange}
            className="w-12 h-7 text-center text-xs font-body text-ivory bg-elevated border border-border rounded px-1 focus:border-amber focus:outline-none"
            aria-label="Loop end measure"
          />
          <button
            data-testid="loop-clear"
            onClick={handleClearLoop}
            className="text-xs font-body text-ivory-dim hover:text-ivory transition-colors"
            aria-label="Clear loop"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
