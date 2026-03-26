import { useRef, useEffect, useCallback } from 'react'
import { useAudioStore } from '../../stores/useAudioStore'
import { useSettingsStore } from '../../stores/useSettingsStore'

/* eslint-disable react/prop-types */

/**
 * "Breath" Intonation Needle — a subtle visual indicator fixed to the right
 * edge of the screen. Invisible when the player is in tune (within 10 cents)
 * and smoothly appears with color feedback when intonation drifts.
 *
 * Props:
 * - className: string — additional CSS classes
 */

// Thresholds in cents
const INVISIBLE_THRESHOLD = 10
const FULLY_VISIBLE_THRESHOLD = 25

/**
 * Compute opacity from absolute cents deviation.
 * 0-10 cents → 0, 10-25 cents → linear 0→1, 25+ cents → 1
 */
export function computeOpacity(absCents) {
  if (absCents <= INVISIBLE_THRESHOLD) return 0
  if (absCents >= FULLY_VISIBLE_THRESHOLD) return 1
  return (
    (absCents - INVISIBLE_THRESHOLD) /
    (FULLY_VISIBLE_THRESHOLD - INVISIBLE_THRESHOLD)
  )
}

/**
 * Determine whether the player is correcting (moving toward center)
 * or drifting (moving away from center).
 */
export function isDrifting(currentCents, previousCents) {
  if (previousCents === null) return true
  return Math.abs(currentCents) >= Math.abs(previousCents)
}

export default function IntonationNeedle({ className = '' }) {
  const needleRef = useRef(null)
  const prevCentsRef = useRef(null)
  const rafRef = useRef(null)
  const stateRef = useRef({ opacity: 0, drifting: true, cents: 0 })

  const needleSensitivity = useSettingsStore((s) => s.needleSensitivity)

  // Use a RAF loop to read store values and update styles directly,
  // avoiding React re-renders for smooth 60fps animation.
  const updateNeedle = useCallback(() => {
    const needle = needleRef.current
    if (!needle) return

    const { pitchData, isPracticing } = useAudioStore.getState()

    const cents = pitchData.cents

    // If not practicing or no pitch data, hide immediately
    if (!isPracticing || cents === null || pitchData.confidence < 0.3) {
      stateRef.current.opacity = 0
      needle.style.opacity = '0'
      prevCentsRef.current = null
      rafRef.current = requestAnimationFrame(updateNeedle)
      return
    }

    // Apply sensitivity scaling
    const scaledCents = cents * needleSensitivity

    const absCents = Math.abs(scaledCents)
    const opacity = computeOpacity(absCents)
    const drifting = isDrifting(scaledCents, prevCentsRef.current)

    prevCentsRef.current = scaledCents
    stateRef.current = { opacity, drifting, cents: scaledCents }

    // Update styles directly on the DOM node (no re-render)
    needle.style.opacity = String(opacity)

    // Vertical offset: needle shifts up/down based on deviation direction
    // Positive cents (sharp) → needle shifts up, Negative (flat) → down
    // Max deflection at ±50 cents, proportional to cents deviation
    const maxShift = 40
    const clampedCents = Math.max(-50, Math.min(50, scaledCents))
    const shift = (clampedCents / 50) * maxShift
    needle.style.transform = `translate3d(0, ${-shift}px, 0)`

    // Color: crimson when drifting, emerald when correcting
    if (opacity > 0) {
      if (drifting) {
        needle.dataset.state = 'drifting'
      } else {
        needle.dataset.state = 'correcting'
      }
    } else {
      needle.dataset.state = 'hidden'
    }

    rafRef.current = requestAnimationFrame(updateNeedle)
  }, [needleSensitivity])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(updateNeedle)
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [updateNeedle])

  return (
    <div
      ref={needleRef}
      data-testid="intonation-needle"
      data-state="hidden"
      className={`
        fixed right-4 top-1/2 pointer-events-none z-30
        w-1.5 h-24 rounded-full
        transition-colors duration-300
        data-[state=drifting]:bg-feedback-error
        data-[state=correcting]:bg-feedback-success
        data-[state=hidden]:bg-transparent
        data-[state=drifting]:shadow-crimson-glow
        data-[state=correcting]:shadow-emerald-glow
        data-[state=drifting]:animate-breath
        data-[state=correcting]:animate-breath
        ${className}
      `.trim()}
      // eslint-disable-next-line no-restricted-syntax -- GPU-composited opacity/transform require inline style
      style={{
        opacity: 0,
        willChange: 'opacity, transform',
      }}
      aria-hidden="true"
    />
  )
}
