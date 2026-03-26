import { useRef, useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'

/**
 * PitchAccuracyChart — canvas-based line chart showing cents deviation over time.
 *
 * Renders a lightweight chart without external chart library dependencies.
 * Positive = sharp, negative = flat, zero line = perfect intonation.
 */

/** Fallback colors for when CSS custom properties are unavailable (tests). */
/* eslint-disable no-hardcoded-hex/no-hardcoded-hex */
const FALLBACKS = {
  amber: '#c9a227',
  emerald: '#10b981',
  crimson: '#dc2626',
  surface: '#141420',
  border: '#2a2a3a',
  ivory: '#f3f4f6',
  ivoryMuted: '#a0a0b0',
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
    crimson: get('--color-crimson', FALLBACKS.crimson),
    surface: get('--color-surface', FALLBACKS.surface),
    border: get('--color-border', FALLBACKS.border),
    ivory: get('--color-ivory', FALLBACKS.ivory),
    ivoryMuted: get('--color-ivory-muted', FALLBACKS.ivoryMuted),
  }
}

const CHART_HEIGHT = 220
const PADDING = { top: 30, right: 20, bottom: 30, left: 50 }
const MAX_CENTS = 50

export default function PitchAccuracyChart({ deviations = [] }) {
  const canvasRef = useRef(null)

  const pitchPoints = useMemo(() => {
    return deviations
      .filter((d) => d.type === 'pitch' && d.centsDeviation != null)
      .map((d, i) => ({
        index: i,
        cents: Math.max(-MAX_CENTS, Math.min(MAX_CENTS, d.centsDeviation)),
        rawCents: d.centsDeviation,
        note: d.detectedNote || d.expectedNote || '',
        measure: d.measureNumber,
      }))
  }, [deviations])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || pitchPoints.length === 0) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()

    canvas.width = rect.width * dpr
    canvas.height = CHART_HEIGHT * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = CHART_HEIGHT
    const colors = getThemeColors()

    const plotWidth = width - PADDING.left - PADDING.right
    const plotHeight = height - PADDING.top - PADDING.bottom

    // Clear
    ctx.clearRect(0, 0, width, height)

    // Background
    ctx.fillStyle = colors.surface
    ctx.fillRect(0, 0, width, height)

    // Draw grid lines
    ctx.strokeStyle = colors.border
    ctx.lineWidth = 0.5
    const gridLines = [-MAX_CENTS, -25, 0, 25, MAX_CENTS]
    for (const cents of gridLines) {
      const y = PADDING.top + ((MAX_CENTS - cents) / (2 * MAX_CENTS)) * plotHeight
      ctx.beginPath()
      ctx.moveTo(PADDING.left, y)
      ctx.lineTo(width - PADDING.right, y)
      ctx.stroke()

      // Labels
      ctx.fillStyle = colors.ivoryMuted
      ctx.font = '10px "Source Sans 3", sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(`${cents > 0 ? '+' : ''}${cents}¢`, PADDING.left - 6, y + 3)
    }

    // Zero line (emphasized)
    const zeroY = PADDING.top + plotHeight / 2
    ctx.strokeStyle = colors.emerald
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(PADDING.left, zeroY)
    ctx.lineTo(width - PADDING.right, zeroY)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw the line chart
    if (pitchPoints.length > 1) {
      const xStep = plotWidth / (pitchPoints.length - 1)

      ctx.beginPath()
      ctx.strokeStyle = colors.amber
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'

      for (let i = 0; i < pitchPoints.length; i++) {
        const x = PADDING.left + i * xStep
        const y =
          PADDING.top +
          ((MAX_CENTS - pitchPoints[i].cents) / (2 * MAX_CENTS)) * plotHeight

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()

      // Draw dots for significant deviations
      for (let i = 0; i < pitchPoints.length; i++) {
        const absCents = Math.abs(pitchPoints[i].cents)
        if (absCents < 15) continue

        const x = PADDING.left + i * xStep
        const y =
          PADDING.top +
          ((MAX_CENTS - pitchPoints[i].cents) / (2 * MAX_CENTS)) * plotHeight

        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fillStyle = absCents > 25 ? colors.crimson : colors.amber
        ctx.fill()
      }
    }

    // Axis labels
    ctx.fillStyle = colors.ivoryMuted
    ctx.font = '10px "Source Sans 3", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Sharp', PADDING.left + plotWidth / 2, PADDING.top - 10)
    ctx.fillText('Flat', PADDING.left + plotWidth / 2, height - 4)

    // Title
    ctx.fillStyle = colors.ivory
    ctx.font = '12px "Source Sans 3", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Cents Deviation Over Time', PADDING.left, 14)
  }, [pitchPoints])

  if (pitchPoints.length === 0) {
    return (
      <p
        className="font-body text-sm text-ivory-muted text-center py-8"
        data-testid="no-pitch-data"
      >
        No pitch data recorded in this session.
      </p>
    )
  }

  return (
    <div data-testid="pitch-accuracy-chart" className="bg-surface rounded-lg border border-border p-2">
      <canvas
        ref={canvasRef}
        className="w-full max-w-full max-h-[220px]"
        height={CHART_HEIGHT}
        data-testid="pitch-chart-canvas"
      />
      <div className="flex justify-between font-body text-xs text-ivory-muted mt-2 px-2">
        <span>Start</span>
        <span>{pitchPoints.length} readings</span>
        <span>End</span>
      </div>
    </div>
  )
}

PitchAccuracyChart.propTypes = {
  deviations: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.string,
      centsDeviation: PropTypes.number,
      detectedNote: PropTypes.string,
      expectedNote: PropTypes.string,
      measureNumber: PropTypes.number,
    }),
  ),
}
