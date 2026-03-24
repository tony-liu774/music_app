import { useState, useMemo } from 'react'
import PropTypes from 'prop-types'

/** Must match SheetMusic.jsx layout constants */
const MEASURE_WIDTH = 300
const SYSTEM_HEIGHT = 140
const FIRST_MEASURE_INDENT = 40
const MEASURES_PER_SYSTEM = 4
const STAVE_HEIGHT = SYSTEM_HEIGHT - 40 // Height of the actual stave area

/** Fallback values used only when CSS custom properties are unavailable (e.g. tests). */
/* eslint-disable no-hardcoded-hex/no-hardcoded-hex */
const FALLBACKS = {
  crimson: '#dc2626',
  surface: '#141420',
  borderLight: '#3a3a4a',
  ivory: '#f3f4f6',
  ivoryMuted: '#a0a0b0',
}
/* eslint-enable no-hardcoded-hex/no-hardcoded-hex */

/**
 * Read Midnight Conservatory color tokens from CSS custom properties at render
 * time so they stay in sync with the theme.
 */
function getThemeColors() {
  const root =
    typeof document !== 'undefined'
      ? getComputedStyle(document.documentElement)
      : null

  const get = (prop, fallback) =>
    root?.getPropertyValue(prop)?.trim() || fallback

  return {
    crimson: get('--color-crimson', FALLBACKS.crimson),
    surface: get('--color-surface', FALLBACKS.surface),
    borderLight: get('--color-border-light', FALLBACKS.borderLight),
    ivory: get('--color-ivory', FALLBACKS.ivory),
    ivoryMuted: get('--color-ivory-muted', FALLBACKS.ivoryMuted),
  }
}

/**
 * HeatMapOverlay — renders semi-transparent crimson rectangles over VexFlow
 * measures to highlight error-dense areas.
 *
 * Props:
 *   heatMapData   – array from useHeatMapData: [{ measureNumber, errorCount, avgDeviation, maxDeviation, worstNote, opacity }]
 *   totalMeasures – total number of measures in the score (to compute positions)
 *   visible       – whether the overlay is shown (triggers fade-in animation)
 */
export default function HeatMapOverlay({
  heatMapData = [],
  totalMeasures = 0,
  visible = false,
}) {
  const [hoveredMeasure, setHoveredMeasure] = useState(null)

  // Build a lookup from measureNumber → heat data
  const heatMap = useMemo(() => {
    const map = {}
    for (const d of heatMapData) {
      map[d.measureNumber] = d
    }
    return map
  }, [heatMapData])

  if (!visible || heatMapData.length === 0 || totalMeasures === 0) {
    return null
  }

  const systemCount = Math.ceil(totalMeasures / MEASURES_PER_SYSTEM)
  const totalWidth =
    MEASURES_PER_SYSTEM * MEASURE_WIDTH + FIRST_MEASURE_INDENT + 40
  const totalHeight = systemCount * SYSTEM_HEIGHT + 40

  const theme = getThemeColors()

  return (
    <svg
      data-testid="heat-map-overlay"
      className="absolute top-0 left-0 pointer-events-none max-w-full max-h-[70vh]"
      width={totalWidth}
      height={totalHeight}
    >
      {Array.from({ length: totalMeasures }, (_, mIdx) => {
        const measureNumber = mIdx + 1
        const data = heatMap[measureNumber]
        if (!data || data.opacity <= 0) return null

        const { x, y, width } = getMeasureRect(mIdx)

        // Sequential fade-in: each measure delays by (index * staggerMs)
        const staggerMs = Math.min(1000 / totalMeasures, 80)
        const delay = mIdx * staggerMs

        return (
          <g key={measureNumber}>
            <rect
              data-testid={`heat-rect-${measureNumber}`}
              x={x}
              y={y}
              width={width}
              height={STAVE_HEIGHT}
              fill={theme.crimson}
              opacity={0}
              /* eslint-disable-next-line no-restricted-syntax -- SVG requires inline styles for CSS animation + pointer-events */
              style={{
                pointerEvents: 'all',
                animation: `heat-fade-in 300ms ease-out ${delay}ms forwards`,
                '--target-opacity': data.opacity,
              }}
              onMouseEnter={() => setHoveredMeasure(measureNumber)}
              onMouseLeave={() => setHoveredMeasure(null)}
            />
            {hoveredMeasure === measureNumber && (
              <HeatMapTooltip
                x={x + width / 2}
                y={y}
                data={data}
                theme={theme}
              />
            )}
          </g>
        )
      })}
      <style>{`
        @keyframes heat-fade-in {
          from { opacity: 0; }
          to { opacity: var(--target-opacity, 0); }
        }
      `}</style>
    </svg>
  )
}

HeatMapOverlay.propTypes = {
  heatMapData: PropTypes.arrayOf(
    PropTypes.shape({
      measureNumber: PropTypes.number.isRequired,
      errorCount: PropTypes.number.isRequired,
      avgDeviation: PropTypes.number.isRequired,
      maxDeviation: PropTypes.number.isRequired,
      worstNote: PropTypes.string.isRequired,
      opacity: PropTypes.number.isRequired,
    }),
  ),
  totalMeasures: PropTypes.number,
  visible: PropTypes.bool,
}

/**
 * Tooltip showing measure error details on hover.
 */
function HeatMapTooltip({ x, y, data, theme }) {
  const tooltipWidth = 160
  const tooltipHeight = 72
  const padding = 8
  // Clamp x so tooltip doesn't overflow left
  const tx = Math.max(tooltipWidth / 2 + 4, x)
  const ty = y - tooltipHeight - 4

  return (
    // eslint-disable-next-line no-restricted-syntax -- SVG requires inline style for pointer-events
    <g data-testid={`heat-tooltip-${data.measureNumber}`} style={{ pointerEvents: 'none' }}>
      <rect
        x={tx - tooltipWidth / 2}
        y={ty}
        width={tooltipWidth}
        height={tooltipHeight}
        rx={6}
        fill={theme.surface}
        stroke={theme.borderLight}
        strokeWidth={1}
        opacity={0.95}
      />
      <text
        x={tx - tooltipWidth / 2 + padding}
        y={ty + 16}
        fill={theme.ivory}
        fontSize={11}
        fontFamily="'Source Sans 3', sans-serif"
        fontWeight="600"
      >
        Measure {data.measureNumber}
      </text>
      <text
        x={tx - tooltipWidth / 2 + padding}
        y={ty + 32}
        fill={theme.ivoryMuted}
        fontSize={10}
        fontFamily="'Source Sans 3', sans-serif"
      >
        Errors: {data.errorCount} · Avg: {data.avgDeviation}¢
      </text>
      <text
        x={tx - tooltipWidth / 2 + padding}
        y={ty + 48}
        fill={theme.ivoryMuted}
        fontSize={10}
        fontFamily="'Source Sans 3', sans-serif"
      >
        Max deviation: {data.maxDeviation}¢
      </text>
      <text
        x={tx - tooltipWidth / 2 + padding}
        y={ty + 64}
        fill={theme.crimson}
        fontSize={10}
        fontFamily="'Source Sans 3', sans-serif"
      >
        Worst note: {data.worstNote}
      </text>
    </g>
  )
}

HeatMapTooltip.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  data: PropTypes.shape({
    measureNumber: PropTypes.number.isRequired,
    errorCount: PropTypes.number.isRequired,
    avgDeviation: PropTypes.number.isRequired,
    maxDeviation: PropTypes.number.isRequired,
    worstNote: PropTypes.string.isRequired,
  }).isRequired,
  theme: PropTypes.shape({
    crimson: PropTypes.string.isRequired,
    surface: PropTypes.string.isRequired,
    borderLight: PropTypes.string.isRequired,
    ivory: PropTypes.string.isRequired,
    ivoryMuted: PropTypes.string.isRequired,
  }).isRequired,
}

/**
 * Calculate the bounding rectangle for a measure at index mIdx,
 * matching SheetMusic.jsx layout logic exactly.
 */
function getMeasureRect(mIdx) {
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
