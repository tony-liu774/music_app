import { useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'

/** Must match SheetMusic.jsx / HeatMapOverlay.jsx layout constants */
const MEASURE_WIDTH = 300
const SYSTEM_HEIGHT = 140
const FIRST_MEASURE_INDENT = 40
const MEASURES_PER_SYSTEM = 4
const STAVE_HEIGHT = SYSTEM_HEIGHT - 40
const BRACKET_INSET = 4
const BRACKET_STROKE = 3

/** Fallback values for when CSS custom properties are unavailable (e.g. tests). */
/* eslint-disable no-hardcoded-hex/no-hardcoded-hex */
const FALLBACKS = {
  amber: '#c9a227',
  emerald: '#10b981',
  ivory: '#f3f4f6',
  surface: '#141420',
}
/* eslint-enable no-hardcoded-hex/no-hardcoded-hex */

function getThemeColors() {
  const root =
    typeof document !== 'undefined'
      ? getComputedStyle(document.documentElement)
      : null

  const get = (prop, fallback) =>
    root?.getPropertyValue(prop)?.trim() || fallback

  return {
    amber: get('--color-amber', FALLBACKS.amber),
    emerald: get('--color-emerald', FALLBACKS.emerald),
    ivory: get('--color-ivory', FALLBACKS.ivory),
    surface: get('--color-surface', FALLBACKS.surface),
  }
}

/**
 * Calculate the bounding rectangle for a measure at index mIdx,
 * matching SheetMusic.jsx layout logic exactly.
 */
function getMeasureRect(measureNumber) {
  const mIdx = measureNumber - 1
  const systemIndex = Math.floor(mIdx / MEASURES_PER_SYSTEM)
  const posInSystem = mIdx % MEASURES_PER_SYSTEM
  const isFirstInSystem = posInSystem === 0

  const x = isFirstInSystem
    ? 10
    : 10 + FIRST_MEASURE_INDENT + posInSystem * MEASURE_WIDTH
  const y = 20 + systemIndex * SYSTEM_HEIGHT
  const width = isFirstInSystem
    ? MEASURE_WIDTH + FIRST_MEASURE_INDENT
    : MEASURE_WIDTH

  return { x, y, width }
}

/**
 * SmartLoop — renders amber bracket overlays around the loop region
 * on the sheet music, plus a status bar with loop count and improvement badge.
 *
 * Props:
 *   loopMeasures   – array of { measureNumber, avgDeviation } from useSmartLoop
 *   loopCount      – current loop iteration number
 *   isImproving    – whether accuracy is improving (>10% from first loop)
 *   isActive       – whether smart loop is active
 *   loopTempo      – current loop tempo
 *   onExit         – callback for manual exit
 *   totalMeasures  – total measures in the score (for SVG sizing)
 */
export default function SmartLoop({
  loopMeasures = [],
  loopCount = 0,
  isImproving = false,
  isActive = false,
  loopTempo = null,
  onExit,
  totalMeasures = 0,
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const theme = useMemo(() => getThemeColors(), [])

  // Escape key to exit loop
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e) => {
      if (e.code === 'Escape' && onExit) {
        e.preventDefault()
        e.stopPropagation()
        onExit()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isActive, onExit])

  if (!isActive || loopMeasures.length === 0) {
    return null
  }

  const systemCount = Math.ceil(totalMeasures / MEASURES_PER_SYSTEM)
  const totalWidth =
    MEASURES_PER_SYSTEM * MEASURE_WIDTH + FIRST_MEASURE_INDENT + 40
  const totalHeight = systemCount * SYSTEM_HEIGHT + 40

  // Group consecutive measures by system for bracket rendering
  const bracketGroups = groupMeasuresBySystem(loopMeasures)

  return (
    <>
      {/* SVG overlay: amber brackets around loop measures */}
      <svg
        data-testid="smart-loop-overlay"
        className="absolute top-0 left-0 pointer-events-none max-w-full max-h-[70vh]"
        width={totalWidth}
        height={totalHeight}
      >
        {bracketGroups.map((group, gIdx) => {
          const firstRect = getMeasureRect(group[0].measureNumber)
          const lastRect = getMeasureRect(group[group.length - 1].measureNumber)

          const x = firstRect.x - BRACKET_INSET
          const y = firstRect.y - BRACKET_INSET
          const width =
            lastRect.x + lastRect.width - firstRect.x + BRACKET_INSET * 2
          const height = STAVE_HEIGHT + BRACKET_INSET * 2

          return (
            <g key={gIdx} data-testid={`smart-loop-bracket-${gIdx}`}>
              {/* Amber bracket rectangle */}
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx={4}
                fill="none"
                stroke={theme.amber}
                strokeWidth={BRACKET_STROKE}
                strokeDasharray="8 4"
                opacity={0.8}
              />
              {/* Loop indicator arrow at the end */}
              <LoopArrow
                x={x + width - 12}
                y={y + height + 4}
                color={theme.amber}
              />
            </g>
          )
        })}
        <style>{`
          @keyframes smart-loop-pulse {
            0%, 100% { opacity: 0.8; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </svg>

      {/* Status bar */}
      <div
        data-testid="smart-loop-status"
        className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-surface/90 border border-amber/30 rounded-lg px-4 py-2 shadow-lg"
      >
        {/* Loop icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="max-w-5 max-h-5 w-5 h-5 text-amber"
        >
          <path d="M17 2l4 4-4 4" />
          <path d="M3 11v-1a4 4 0 014-4h14" />
          <path d="M7 22l-4-4 4-4" />
          <path d="M21 13v1a4 4 0 01-4 4H3" />
        </svg>

        <span className="font-body text-sm text-ivory">Smart Loop</span>

        <span
          className="font-body text-xs text-ivory-muted"
          data-testid="loop-count"
        >
          Loop {loopCount}
        </span>

        {loopTempo && (
          <span
            className="font-body text-xs text-amber"
            data-testid="loop-tempo"
          >
            {loopTempo} BPM
          </span>
        )}

        {isImproving && (
          <span
            data-testid="improving-badge"
            className="font-body text-xs text-emerald bg-emerald/10 px-2 py-0.5 rounded-full"
          >
            Improving
          </span>
        )}

        <button
          data-testid="exit-loop-button"
          onClick={onExit}
          className="font-body text-xs text-ivory-muted hover:text-ivory bg-elevated/50 hover:bg-elevated px-2 py-1 rounded transition-colors"
        >
          Exit Loop
        </button>
      </div>
    </>
  )
}

SmartLoop.propTypes = {
  loopMeasures: PropTypes.arrayOf(
    PropTypes.shape({
      measureNumber: PropTypes.number.isRequired,
      avgDeviation: PropTypes.number,
    }),
  ),
  loopCount: PropTypes.number,
  isImproving: PropTypes.bool,
  isActive: PropTypes.bool,
  loopTempo: PropTypes.number,
  onExit: PropTypes.func,
  totalMeasures: PropTypes.number,
}

/**
 * Small loop arrow indicator rendered in SVG.
 */
function LoopArrow({ x, y, color }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path
        d="M0 0 L6 4 L0 8"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    </g>
  )
}

LoopArrow.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  color: PropTypes.string.isRequired,
}

/**
 * Group loop measures that share the same system row for contiguous bracket rendering.
 * @param {Array} measures - [{ measureNumber }]
 * @returns {Array<Array>} - groups of measures on the same system
 */
function groupMeasuresBySystem(measures) {
  if (measures.length === 0) return []

  const groups = []
  let currentGroup = [measures[0]]

  for (let i = 1; i < measures.length; i++) {
    const prevSystem = Math.floor(
      (measures[i - 1].measureNumber - 1) / MEASURES_PER_SYSTEM,
    )
    const currSystem = Math.floor(
      (measures[i].measureNumber - 1) / MEASURES_PER_SYSTEM,
    )

    if (currSystem === prevSystem) {
      currentGroup.push(measures[i])
    } else {
      groups.push(currentGroup)
      currentGroup = [measures[i]]
    }
  }

  groups.push(currentGroup)
  return groups
}
