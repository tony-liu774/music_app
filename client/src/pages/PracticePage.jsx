import { useState, useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '../stores/useUIStore'
import { useAudioStore } from '../stores/useAudioStore'
import PracticeControls from '../components/practice/PracticeControls'

const CONTROLS_AUTO_HIDE_MS = 3000

export default function PracticePage() {
  const ghostMode = useUIStore((s) => s.ghostMode)
  const enterGhostMode = useUIStore((s) => s.enterGhostMode)
  const exitGhostMode = useUIStore((s) => s.exitGhostMode)

  const isPracticing = useAudioStore((s) => s.isPracticing)
  const setIsPracticing = useAudioStore((s) => s.setIsPracticing)

  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimerRef = useRef(null)
  const isPracticingRef = useRef(isPracticing)
  isPracticingRef.current = isPracticing

  const startAutoHideTimer = useCallback(() => {
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      if (isPracticingRef.current) {
        setControlsVisible(false)
      }
    }, CONTROLS_AUTO_HIDE_MS)
  }, [])

  // Show controls and reset auto-hide timer
  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (isPracticingRef.current) {
      startAutoHideTimer()
    }
  }, [startAutoHideTimer])

  // Play/Pause handler
  const handlePlayPause = useCallback(() => {
    if (isPracticing) {
      // Pause — exit ghost mode so nav reappears
      setIsPracticing(false)
      exitGhostMode()
      setControlsVisible(true)
      clearTimeout(hideTimerRef.current)
    } else {
      // Play / Resume — enter ghost mode
      setIsPracticing(true)
      enterGhostMode()
      setControlsVisible(true)
      startAutoHideTimer()
    }
  }, [isPracticing, setIsPracticing, enterGhostMode, exitGhostMode, startAutoHideTimer])

  // Stop handler — exit ghost mode entirely
  const handleStop = useCallback(() => {
    setIsPracticing(false)
    exitGhostMode()
    setControlsVisible(true)
    clearTimeout(hideTimerRef.current)
  }, [setIsPracticing, exitGhostMode])

  // When practice stops externally, show controls
  useEffect(() => {
    if (!isPracticing) {
      setControlsVisible(true)
      clearTimeout(hideTimerRef.current)
    }
  }, [isPracticing])

  // Mouse/touch movement shows controls during ghost mode
  useEffect(() => {
    if (!ghostMode) return

    const handleMovement = () => showControls()

    window.addEventListener('mousemove', handleMovement)
    window.addEventListener('touchstart', handleMovement)

    return () => {
      window.removeEventListener('mousemove', handleMovement)
      window.removeEventListener('touchstart', handleMovement)
      clearTimeout(hideTimerRef.current)
    }
  }, [ghostMode, showControls])

  // Keyboard shortcuts — Space (play/pause), Escape (stop)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
        return

      if (e.code === 'Space') {
        e.preventDefault()
        handlePlayPause()
      } else if (e.code === 'Escape') {
        e.preventDefault()
        handleStop()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePlayPause, handleStop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(hideTimerRef.current)
      const uiState = useUIStore.getState()
      if (uiState.ghostMode) {
        uiState.exitGhostMode()
      }
      const audioState = useAudioStore.getState()
      if (audioState.isPracticing) {
        audioState.setIsPracticing(false)
      }
    }
  }, [])

  return (
    <div
      data-testid="practice-page"
      className={`relative ${ghostMode ? 'fixed inset-0 z-40 bg-oxford-blue' : 'h-[calc(100vh-5rem)]'}`}
    >
      {/* Sheet music area */}
      <div
        data-testid="sheet-music-area"
        className={`${ghostMode ? 'h-full' : 'h-[80%]'} flex items-center justify-center`}
      >
        <div className="text-center">
          {!isPracticing && !ghostMode && (
            <>
              <h1 className="font-heading text-3xl text-ivory mb-4">
                Practice
              </h1>
              <p className="font-body text-ivory-muted mb-8">
                Press play to start your practice session
              </p>
            </>
          )}
          <div
            data-testid="sheet-music-placeholder"
            className="w-full max-w-4xl mx-auto px-4"
          >
            <div className="border border-border-light rounded-lg p-8 min-h-48 flex items-center justify-center">
              <p className="font-body text-ivory-dim text-sm">
                {isPracticing
                  ? 'Sheet music will render here'
                  : 'Select a piece from your library to begin'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tap overlay hint — shows briefly when controls are hidden */}
      {ghostMode && !controlsVisible && (
        <div
          data-testid="tap-overlay"
          className="absolute inset-0 z-10 flex items-end justify-center pb-32 pointer-events-none"
        >
          <p className="font-body text-ivory-dim text-xs animate-pulse">
            Move mouse or tap to show controls
          </p>
        </div>
      )}

      {/* Practice controls bar */}
      <PracticeControls
        isPracticing={isPracticing}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        visible={controlsVisible}
      />
    </div>
  )
}
