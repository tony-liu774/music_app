import { useMemo } from 'react'

/* eslint-disable react/prop-types */

/**
 * SVG-based tuner gauge with needle visualization.
 * Ported from src/js/components/tuner-gauge.js into React.
 *
 * Props:
 * - cents: number (-50 to +50) — current cents deviation
 * - isActive: boolean — whether the tuner is listening
 */
export default function TunerGauge({ cents = 0, isActive = false }) {
  const size = 300
  const centerX = size / 2
  const centerY = size * 0.75
  const radius = size * 0.55

  // Clamp cents to display range
  const clampedCents = Math.max(-50, Math.min(50, cents))

  // Map -50..+50 to -90..+90 degrees
  const needleAngle = (clampedCents / 50) * 90

  // Determine color state based on cents deviation
  const absCents = Math.abs(clampedCents)
  const { needleColor, statusText, statusColor } = useMemo(() => {
    if (!isActive) {
      return {
        needleColor: 'var(--color-primary)',
        statusText: '--',
        statusColor: 'var(--color-text-secondary)',
      }
    }
    if (absCents <= 5) {
      return {
        needleColor: 'var(--color-success)',
        statusText: 'IN TUNE',
        statusColor: 'var(--color-success)',
      }
    }
    if (clampedCents < 0) {
      return {
        needleColor: 'var(--color-error)',
        statusText: 'FLAT',
        statusColor: 'var(--color-error)',
      }
    }
    return {
      needleColor: 'var(--color-error)',
      statusText: 'SHARP',
      statusColor: 'var(--color-error)',
    }
  }, [absCents, clampedCents, isActive])

  // Generate tick marks: every 10 cents from -50 to +50
  const tickMarks = useMemo(() => {
    const marks = []
    const startAngle = Math.PI // 180° (left)
    const endAngle = 0 // 0° (right)

    for (let i = 0; i <= 10; i++) {
      const angle = startAngle + (i / 10) * (endAngle - startAngle)
      const isMajor = i % 5 === 0
      const innerRadius = isMajor ? radius * 0.82 : radius * 0.88
      const outerRadius = radius * 0.98

      const x1 = centerX + Math.cos(angle) * innerRadius
      const y1 = centerY + Math.sin(angle) * innerRadius
      const x2 = centerX + Math.cos(angle) * outerRadius
      const y2 = centerY + Math.sin(angle) * outerRadius

      marks.push(
        <line
          key={`tick-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={isMajor ? 'var(--color-border-light)' : 'var(--color-border)'}
          strokeWidth={isMajor ? 2.5 : 1}
        />,
      )
    }
    return marks
  }, [centerX, centerY, radius])

  // Arc path for the colored zones
  const arcPath = useMemo(() => {
    const segments = []
    const startAngle = Math.PI
    const endAngle = 0
    const arcRadius = radius * 0.98

    // Helper to build arc segment
    const buildArc = (fromFrac, toFrac) => {
      const a1 = startAngle + fromFrac * (endAngle - startAngle)
      const a2 = startAngle + toFrac * (endAngle - startAngle)
      const x1 = centerX + Math.cos(a1) * arcRadius
      const y1 = centerY + Math.sin(a1) * arcRadius
      const x2 = centerX + Math.cos(a2) * arcRadius
      const y2 = centerY + Math.sin(a2) * arcRadius
      return { x1, y1, x2, y2, a1, a2 }
    }

    // Crimson flat zone: -50 to -5 cents (0% to 45%)
    const flat = buildArc(0, 0.45)
    // Emerald in-tune zone: -5 to +5 cents (45% to 55%)
    const inTune = buildArc(0.45, 0.55)
    // Crimson sharp zone: +5 to +50 cents (55% to 100%)
    const sharp = buildArc(0.55, 1)

    segments.push(
      <path
        key="arc-flat"
        d={`M ${flat.x1} ${flat.y1} A ${arcRadius} ${arcRadius} 0 0 1 ${flat.x2} ${flat.y2}`}
        fill="none"
        stroke="var(--color-error)"
        strokeWidth={4}
        opacity={0.5}
      />,
      <path
        key="arc-intune"
        d={`M ${inTune.x1} ${inTune.y1} A ${arcRadius} ${arcRadius} 0 0 1 ${inTune.x2} ${inTune.y2}`}
        fill="none"
        stroke="var(--color-success)"
        strokeWidth={6}
        opacity={0.8}
      />,
      <path
        key="arc-sharp"
        d={`M ${sharp.x1} ${sharp.y1} A ${arcRadius} ${arcRadius} 0 0 1 ${sharp.x2} ${sharp.y2}`}
        fill="none"
        stroke="var(--color-error)"
        strokeWidth={4}
        opacity={0.5}
      />,
    )

    return segments
  }, [centerX, centerY, radius])

  // Needle length
  const needleLength = radius * 0.85

  return (
    <div className="flex items-center justify-center" data-testid="tuner-gauge">
      <svg
        viewBox={`0 0 ${size} ${size * 0.85}`}
        className="max-w-md max-h-64"
        aria-label="Tuner gauge"
        role="img"
      >
        <defs>
          <filter id="needleGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Colored arc zones */}
        <g data-testid="gauge-arcs">{arcPath}</g>

        {/* Tick marks */}
        <g data-testid="gauge-ticks">{tickMarks}</g>

        {/* Scale labels */}
        <text
          x={centerX - radius - 5}
          y={centerY - 8}
          textAnchor="end"
          fill="var(--color-text-muted)"
          fontFamily="var(--font-mono)"
          fontSize="12"
        >
          -50
        </text>
        <text
          x={centerX + radius + 5}
          y={centerY - 8}
          textAnchor="start"
          fill="var(--color-text-muted)"
          fontFamily="var(--font-mono)"
          fontSize="12"
        >
          +50
        </text>
        <text
          x={centerX}
          y={centerY - radius - 8}
          textAnchor="middle"
          fill="var(--color-text-secondary)"
          fontFamily="var(--font-mono)"
          fontSize="14"
        >
          0
        </text>

        {/* Center reference line */}
        <line
          x1={centerX}
          y1={centerY - radius * 0.85}
          x2={centerX}
          y2={centerY - radius * 0.95}
          stroke="var(--color-success)"
          strokeWidth={3}
          opacity={0.6}
        />

        {/* Needle */}
        <g
          data-testid="gauge-needle"
          transform={`rotate(${needleAngle}, ${centerX}, ${centerY})`}
          filter="url(#needleGlow)"
          className="transition-transform duration-75 ease-out"
        >
          <line
            x1={centerX}
            y1={centerY}
            x2={centerX}
            y2={centerY - needleLength}
            stroke={needleColor}
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* Needle tip */}
          <circle
            cx={centerX}
            cy={centerY - needleLength}
            r={4}
            fill={needleColor}
          />
        </g>

        {/* Pivot circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r={10}
          fill="var(--color-bg-elevated)"
          stroke={needleColor}
          strokeWidth={2}
        />
        <circle cx={centerX} cy={centerY} r={5} fill={needleColor} />

        {/* Status text */}
        <text
          data-testid="gauge-status"
          x={centerX}
          y={centerY + 30}
          textAnchor="middle"
          fill={statusColor}
          fontFamily="var(--font-body)"
          fontSize="14"
          fontWeight="600"
          letterSpacing="0.1em"
        >
          {statusText}
        </text>
      </svg>
    </div>
  )
}
