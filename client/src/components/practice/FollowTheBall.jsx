/**
 * FollowTheBall - React component for visual cursor tracking
 *
 * A moving cursor that tracks progress across sheet music during practice.
 * Features:
 * - Smooth animation following cursor position
 * - Speed control (0.5x to 2x)
 * - Practice mode (auto-advance without audio)
 * - Bounce animation on beat
 * - Ghost mode support
 */
import { useRef, useEffect, useState, useCallback } from 'react'
import { useAudioStore } from '../../stores/useAudioStore'

/* eslint-disable react/prop-types */

// Configuration
const CONFIG = {
  animationStep: 0.15, // Interpolation factor per frame
  bounceThreshold: 0.05, // Progress difference to trigger bounce
  maxSpeed: 2.0,
  minSpeed: 0.5,
  defaultSpeed: 1.0,
}

/**
 * FollowTheBall cursor component
 *
 * Displays a glowing ball cursor that smoothly follows the practice position
 * across the sheet music. Works in conjunction with the PredictiveCursor.
 */
export default function FollowTheBall({
  containerRef,
  visible = true,
  speed = CONFIG.defaultSpeed,
  practiceMode = false,
  onBounce,
}) {
  const cursorRef = useRef(null)
  const glowRef = useRef(null)
  const rafRef = useRef(null)
  const [isPaused, setIsPaused] = useState(false)

  // Current and target positions (0-1 progress)
  const positionRef = useRef(0)
  const targetRef = useRef(0)

  // Get current state from store
  const cursorPosition = useAudioStore((s) => s.cursorPosition)
  const isPracticing = useAudioStore((s) => s.isPracticing)

  // Calculate target position from cursor state
  useEffect(() => {
    if (cursorPosition && cursorPosition.progress !== undefined) {
      targetRef.current = cursorPosition.progress
    }
  }, [cursorPosition])

  // Animation loop
  useEffect(() => {
    const animate = () => {
      if (!isPaused && cursorRef.current) {
        const diff = targetRef.current - positionRef.current
        const step = diff * CONFIG.animationStep * speed

        if (Math.abs(diff) > 0.001) {
          positionRef.current += step
          updatePosition()

          // Trigger bounce when close to target
          if (Math.abs(diff) < CONFIG.bounceThreshold) {
            triggerBounce()
          }
        } else {
          positionRef.current = targetRef.current
          updatePosition()
        }
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [speed, isPaused])

  // Update cursor position based on progress
  const updatePosition = useCallback(() => {
    const cursor = cursorRef.current
    const glow = glowRef.current
    const container = containerRef?.current

    if (!cursor || !container) return

    const containerRect = container.getBoundingClientRect()
    const scrollLeft = container.scrollLeft || 0
    const scrollTop = container.scrollTop || 0

    // Calculate position based on progress (0-1)
    const x = scrollLeft + containerRect.width * positionRef.current
    const y = scrollTop + containerRect.height / 2

    cursor.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
    if (glow) {
      glow.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
    }
  }, [containerRef])

  // Trigger bounce animation
  const triggerBounce = useCallback(() => {
    if (cursorRef.current) {
      cursorRef.current.classList.add('animate-bounce')
      setTimeout(() => {
        cursorRef.current?.classList.remove('animate-bounce')
      }, 300)

      if (onBounce) {
        onBounce()
      }
    }
  }, [onBounce])

  // Jump to specific measure
  const jumpToMeasure = useCallback(
    (measureNumber, totalMeasures) => {
      const measureProgress = measureNumber / totalMeasures
      targetRef.current = Math.max(0, Math.min(1, measureProgress))
      positionRef.current = targetRef.current
      updatePosition()
    },
    [updatePosition],
  )

  // Toggle pause
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev)
  }, [])

  // Reset cursor
  const reset = useCallback(() => {
    positionRef.current = 0
    targetRef.current = 0
    setIsPaused(false)
    updatePosition()
  }, [updatePosition])

  // Handle note detection for bounce
  useEffect(() => {
    if (isPracticing && !isPaused) {
      triggerBounce()
    }
  }, [isPracticing, cursorPosition?.measure])

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className="follow-the-ball-wrapper pointer-events-none absolute inset-0 overflow-hidden"
      data-testid="follow-the-ball"
    >
      {/* Glow effect */}
      <div
        ref={glowRef}
        className="absolute w-16 h-16 rounded-full opacity-30 blur-xl transition-all duration-200"
        style={{
          background: 'radial-gradient(circle, var(--color-amber, #c9a227) 0%, transparent 70%)',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Ball cursor */}
      <div
        ref={cursorRef}
        className="absolute w-8 h-8 rounded-full pointer-events-none transition-all duration-100"
        style={{
          background: 'radial-gradient(circle at 30% 30%, var(--color-amber-light, #fcd34d) 0%, var(--color-amber, #c9a227) 50%, var(--color-amber-dark, #92400e) 100%)',
          boxShadow: '0 0 20px var(--color-amber, #c9a227), 0 0 40px rgba(201, 162, 39, 0.3)',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        aria-hidden="true"
      >
        {/* Inner highlight */}
        <div
          className="absolute w-3 h-3 rounded-full opacity-60"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)',
            top: '15%',
            left: '15%',
          }}
        />
      </div>

      {/* Speed indicator */}
      <div
        className="absolute bottom-2 right-2 text-xs font-mono text-ivory-dim opacity-50"
        data-testid="cursor-speed"
      >
        {speed.toFixed(1)}x
      </div>

      {/* Practice mode indicator */}
      {practiceMode && (
        <div
          className="absolute top-2 right-2 px-2 py-1 rounded bg-amber/20 text-amber text-xs font-mono"
          data-testid="practice-mode-indicator"
        >
          Practice
        </div>
      )}
    </div>
  )
}
