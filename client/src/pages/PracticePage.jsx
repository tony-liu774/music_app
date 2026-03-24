import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '../stores/useUIStore'
import { useAudioStore } from '../stores/useAudioStore'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useSessionStore } from '../stores/useSessionStore'
import { useSessionLogger } from '../hooks/useSessionLogger'
import { Button } from '../components/ui'
import PracticeControls from '../components/practice/PracticeControls'

const CONTROLS_AUTO_HIDE_MS = 3000

export default function PracticePage() {
  const navigate = useNavigate()
  const ghostMode = useUIStore((s) => s.ghostMode)
  const enterGhostMode = useUIStore((s) => s.enterGhostMode)
  const exitGhostMode = useUIStore((s) => s.exitGhostMode)

  const isPracticing = useAudioStore((s) => s.isPracticing)
  const setIsPracticing = useAudioStore((s) => s.setIsPracticing)

  const selectedScore = useLibraryStore((s) => s.selectedScore)
  const sessionSummary = useSessionStore((s) => s.sessionSummary)

  const { startSession, endSession } = useSessionLogger()

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
      // Play / Resume — enter ghost mode and start session logging
      setIsPracticing(true)
      startSession(selectedScore?.id)
      enterGhostMode()
      setControlsVisible(true)
      startAutoHideTimer()
    }
  }, [isPracticing, setIsPracticing, enterGhostMode, exitGhostMode, startAutoHideTimer, startSession, selectedScore])

  // Stop handler — exit ghost mode and end session logging
  const handleStop = useCallback(() => {
    setIsPracticing(false)
    endSession()
    exitGhostMode()
    setControlsVisible(true)
    clearTimeout(hideTimerRef.current)
  }, [setIsPracticing, exitGhostMode, endSession])

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
              {selectedScore ? (
                <div className="mb-8" data-testid="practice-score-info">
                  <h2 className="font-heading text-xl text-ivory">
                    {selectedScore.title}
                  </h2>
                  <p className="font-body text-ivory-muted">
                    {selectedScore.composer || 'Unknown Composer'}
                  </p>
                  {selectedScore.instrument && (
                    <span className="inline-block font-body text-xs text-amber bg-amber/10 px-2 py-0.5 rounded-full mt-2">
                      {selectedScore.instrument}
                    </span>
                  )}
                </div>
              ) : (
                <div className="mb-8" data-testid="practice-no-score">
                  <p className="font-body text-ivory-muted mb-4">
                    No score selected. Choose a piece from the library to start.
                  </p>
                  <Button variant="secondary" onClick={() => navigate('/library')}>
                    Browse Library
                  </Button>
                </div>
              )}
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

      {/* Session summary — shown after practice ends */}
      {!isPracticing && !ghostMode && sessionSummary && sessionSummary.total_notes_played > 0 && (
        <div
          data-testid="session-summary"
          className="absolute top-4 right-4 w-72 bg-surface border border-border rounded-lg p-4 shadow-lg z-20"
        >
          <h3 className="font-heading text-sm text-ivory mb-2">Session Summary</h3>
          <div className="space-y-1 font-body text-xs text-ivory-muted">
            <p>Deviations logged: {sessionSummary.total_notes_played}</p>
            {sessionSummary.pitch_deviation_count > 0 && (
              <p>Pitch: {sessionSummary.pitch_deviation_count} (avg {sessionSummary.average_pitch_deviation_cents}c)</p>
            )}
            {sessionSummary.intonation_deviation_count > 0 && (
              <p>Intonation: {sessionSummary.intonation_deviation_count}</p>
            )}
            {sessionSummary.worst_measure && (
              <p className="text-amber">Needs work: m.{sessionSummary.worst_measure}</p>
            )}
          </div>
        </div>
      )}

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
