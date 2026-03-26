import { useEffect, useCallback } from 'react'
import { useUIStore } from '../../stores/useUIStore'

/* eslint-disable react/prop-types */

/**
 * PracticeView — immersive practice wrapper that manages the distraction-free
 * view transition. When `isPlaying` is true, all UI chrome (menus, nav) fades
 * to opacity-0 over 500ms (handled via Zustand ghostMode → AppShell nav fade).
 *
 * Tap/click anywhere or press Escape calls `onRequestStop` to bring UI back.
 *
 * Props:
 * - isPlaying: boolean — whether a practice session is active
 * - onRequestStop: () => void — called when user taps or presses Escape
 * - children: ReactNode — the practice content (sheet music, cursor, needle)
 */
export default function PracticeView({ isPlaying, onRequestStop, children }) {
  const ghostMode = useUIStore((s) => s.ghostMode)

  // Escape to exit immersive mode
  const handleKeyDown = useCallback(
    (e) => {
      if (e.code === 'Escape' && isPlaying) {
        e.preventDefault()
        onRequestStop?.()
      }
    },
    [isPlaying, onRequestStop],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      data-testid="practice-view"
      className={`relative transition-all duration-500 ${
        ghostMode ? 'fixed inset-0 z-40 bg-oxford-blue' : 'h-[calc(100vh-5rem)]'
      }`}
    >
      {children}
    </div>
  )
}
