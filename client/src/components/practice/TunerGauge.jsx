/**
 * TunerGauge - React component for intonation visualization
 *
 * Displays a needle-style tuner with:
 * - Real-time cents deviation display
 * - Note name and octave
 * - Frequency in Hz
 * - Color-coded status (IN TUNE, FLAT, SHARP)
 */
import { useRef, useEffect, useCallback, useState } from 'react'
import { useAudioStore } from '../../stores/useAudioStore'

/* eslint-disable react/prop-types */

// Tuner gauge configuration
const CONFIG = {
  minCents: -50,
  maxCents: 50,
  size: 300,
  // Color thresholds
  inTuneThreshold: 10, // cents
  warningThreshold: 25, // cents
}

/**
 * Map cents deviation to rotation angle
 * -50 to +50 cents maps to -90 to +90 degrees
 */
function centsToAngle(cents) {
  return (cents / 50) * 90
}

/**
 * Get status color based on cents deviation
 */
function getStatusColor(cents, opacity = 1) {
  const abs = Math.abs(cents)
  if (abs <= CONFIG.inTuneThreshold) {
    return `rgba(16, 185, 129, ${opacity})` // emerald
  }
  if (cents < 0) {
    return `rgba(239, 68, 68, ${opacity})` // crimson (flat)
  }
  return `rgba(239, 68, 68, ${opacity})` // crimson (sharp)
}

/**
 * TunerGauge component - displays real-time intonation feedback
 */
export default function TunerGauge({ className = '' }) {
  const containerRef = useRef(null)
  const needleRef = useRef(null)
  const rafRef = useRef(null)
  const [displayData, setDisplayData] = useState({
    note: '--',
    octave: '',
    frequency: '--',
    cents: 0,
    status: 'waiting',
  })

  // Subscribe to audio store
  useEffect(() => {
    const updateDisplay = useCallback(() => {
      const { pitchData, isPracticing } = useAudioStore.getState()

      if (!isPracticing || !pitchData.frequency) {
        setDisplayData({
          note: '--',
          octave: '',
          frequency: '--',
          cents: 0,
          status: 'waiting',
        })
        return
      }

      const { note, cents, frequency } = pitchData
      const absCents = Math.abs(cents || 0)

      let status = 'in_tune'
      if (absCents > CONFIG.warningThreshold) {
        status = cents < 0 ? 'flat' : 'sharp'
      } else if (absCents > CONFIG.inTuneThreshold) {
        status = cents < 0 ? 'slightly_flat' : 'slightly_sharp'
      }

      // Parse note string (e.g., "A#4" -> note: "A#", octave: "4")
      const noteMatch = note?.match(/^([A-G][#b]?)([0-9])$/)
      const notePart = noteMatch ? noteMatch[1] : (note || '--')
      const octavePart = noteMatch ? noteMatch[2] : ''

      setDisplayData({
        note: notePart,
        octave: octavePart,
        frequency: frequency ? `${frequency.toFixed(1)}` : '--',
        cents: cents || 0,
        status,
      })

      // Update needle rotation
      if (needleRef.current) {
        const angle = centsToAngle(Math.max(-50, Math.min(50, cents || 0)))
        const centerX = CONFIG.size / 2
        const centerY = CONFIG.size * 0.85
        needleRef.current.setAttribute(
          'transform',
          `rotate(${angle}, ${centerX}, ${centerY})`,
        )

        // Update needle color
        const color = getStatusColor(cents || 0)
        const needleShape = needleRef.current.querySelector('.needle-shape')
        if (needleShape) {
          needleShape.setAttribute('fill', color)
        }
      }
    }, [])

    // Use RAF for smooth updates
    const animate = () => {
      updateDisplay()
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`tuner-gauge-container ${className}`}
      data-testid="tuner-gauge"
    >
      <svg
        viewBox={`0 0 ${CONFIG.size} ${CONFIG.size}`}
        className="w-full h-full"
        aria-label="Intonation tuner"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id="tunerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--feedback-error, #dc2626)" stopOpacity="0.6" />
            <stop offset="35%" stopColor="var(--feedback-warning, #f59e0b)" stopOpacity="0.4" />
            <stop offset="50%" stopColor="var(--feedback-success, #10b981)" stopOpacity="0.6" />
            <stop offset="65%" stopColor="var(--feedback-warning, #f59e0b)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--feedback-error, #dc2626)" stopOpacity="0.6" />
          </linearGradient>
          <filter id="gaugeGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background arc */}
        <path
          d="M 40 240 A 110 110 0 0 1 260 240"
          fill="none"
          stroke="url(#tunerGradient)"
          strokeWidth="8"
          strokeLinecap="round"
          opacity="0.4"
        />

        {/* Tick marks */}
        {[-50, -25, 0, 25, 50].map((tick) => {
          const angle = centsToAngle(tick)
          const rad = ((180 - angle - 90) * Math.PI) / 180
          const innerR = 100
          const outerR = 110
          const cx = CONFIG.size / 2
          const cy = CONFIG.size * 0.85
          const x1 = cx + innerR * Math.cos(rad)
          const y1 = cy - innerR * Math.sin(rad)
          const x2 = cx + outerR * Math.cos(rad)
          const y2 = cy - outerR * Math.sin(rad)

          return (
            <line
              key={tick}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={tick === 0 ? 'var(--feedback-success, #10b981)' : 'var(--border, #6b7280)'}
              strokeWidth={tick === 0 ? 3 : 2}
            />
          )
        })}

        {/* Center indicator line */}
        <line
          x1={CONFIG.size / 2}
          y1={CONFIG.size * 0.65}
          x2={CONFIG.size / 2}
          y2={CONFIG.size * 0.2}
          stroke="var(--feedback-success, #10b981)"
          strokeWidth="3"
          filter="url(#gaugeGlow)"
          opacity="0.8"
        />

        {/* Needle */}
        <g ref={needleRef} filter="url(#gaugeGlow)">
          <polygon
            className="needle-shape"
            points={`${CONFIG.size / 2},${CONFIG.size * 0.7} ${CONFIG.size / 2 - 6},${CONFIG.size * 0.85} ${CONFIG.size / 2 + 6},${CONFIG.size * 0.85}`}
            fill={getStatusColor(0)}
          />
          <circle
            cx={CONFIG.size / 2}
            cy={CONFIG.size * 0.85}
            r="10"
            fill="var(--bg-elevated, #1f2937)"
            stroke={getStatusColor(displayData.cents)}
            strokeWidth="2"
          />
          <circle
            cx={CONFIG.size / 2}
            cy={CONFIG.size * 0.85}
            r="5"
            fill={getStatusColor(displayData.cents)}
          />
        </g>

        {/* Note display */}
        <text
          x={CONFIG.size / 2}
          y={CONFIG.size * 0.45}
          textAnchor="middle"
          fill="var(--text-primary, #f3f4f6)"
          fontSize="48"
          fontFamily="var(--font-heading)"
        >
          {displayData.note}
        </text>
        <text
          x={CONFIG.size / 2}
          y={CONFIG.size * 0.55}
          textAnchor="middle"
          fill="var(--text-secondary, #9ca3af)"
          fontSize="20"
          fontFamily="var(--font-mono)"
        >
          {displayData.octave}
        </text>

        {/* Frequency display */}
        <text
          x={CONFIG.size / 2}
          y={CONFIG.size * 0.62}
          textAnchor="middle"
          fill="var(--text-muted, #6b7280)"
          fontSize="14"
          fontFamily="var(--font-mono)"
        >
          {displayData.frequency} Hz
        </text>

        {/* Cents display */}
        <text
          x={CONFIG.size / 2}
          y={CONFIG.size * 0.75}
          textAnchor="middle"
          fill={getStatusColor(displayData.cents)}
          fontSize="22"
          fontFamily="var(--font-mono)"
          fontWeight="bold"
        >
          {displayData.cents > 0 ? '+' : ''}
          {displayData.cents}¢
        </text>

        {/* Status indicator */}
        <g transform={`translate(${CONFIG.size / 2}, ${CONFIG.size * 0.12})`}>
          <circle
            cx="0"
            cy="0"
            r="22"
            fill="var(--bg-elevated, #1f2937)"
            stroke="var(--border, #6b7280)"
            strokeWidth="2"
          />
          <text
            x="0"
            y="5"
            textAnchor="middle"
            fill={
              displayData.status === 'in_tune'
                ? 'var(--feedback-success, #10b981)'
                : 'var(--feedback-error, #dc2626)'
            }
            fontSize="11"
            fontFamily="var(--font-body)"
            fontWeight="bold"
          >
            {displayData.status === 'in_tune'
              ? 'IN TUNE'
              : displayData.status === 'flat'
                ? 'FLAT'
                : displayData.status === 'sharp'
                  ? 'SHARP'
                  : displayData.status === 'slightly_flat'
                    ? 'FLAT'
                    : displayData.status === 'slightly_sharp'
                      ? 'SHARP'
                      : '---'}
          </text>
        </g>
      </svg>
    </div>
  )
}

export { TunerGauge }
