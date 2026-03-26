import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '../stores/useUIStore'
import { useAudioStore } from '../stores/useAudioStore'
import { useLibraryStore } from '../stores/useLibraryStore'
import { useSessionStore } from '../stores/useSessionStore'
import { useSessionLogger } from '../hooks/useSessionLogger'
import { useHeatMapData } from '../hooks/useHeatMapData'
import { useSmartLoop } from '../hooks/useSmartLoop'
import useMetronome from '../hooks/useMetronome'
import { Button } from '../components/ui'
import { useToast } from '../components/ui/Toast'
import PracticeView from '../components/practice/PracticeView'
import PracticeControls from '../components/practice/PracticeControls'
import AudioSuspensionOverlay from '../components/practice/AudioSuspensionOverlay'
import SheetMusic from '../components/practice/SheetMusic'
import CoachDebrief from '../components/practice/CoachDebrief'
import PredictiveCursor from '../components/practice/PredictiveCursor'
import IntonationNeedle from '../components/practice/IntonationNeedle'
import HeatMapOverlay from '../components/practice/HeatMapOverlay'
import SmartLoop from '../components/practice/SmartLoop'
import NoMicFallbackBanner from '../components/practice/NoMicFallbackBanner'
import useScore from '../hooks/useScore'
import usePredictiveCursor from '../hooks/usePredictiveCursor'

const CONTROLS_AUTO_HIDE_MS = 3000

export default function PracticePage() {
  const navigate = useNavigate()
  const ghostMode = useUIStore((s) => s.ghostMode)
  const enterGhostMode = useUIStore((s) => s.enterGhostMode)
  const exitGhostMode = useUIStore((s) => s.exitGhostMode)

  const isPracticing = useAudioStore((s) => s.isPracticing)
  const setIsPracticing = useAudioStore((s) => s.setIsPracticing)

  const selectedScore = useLibraryStore((s) => s.selectedScore)
  const {
    score,
    isLoading: scoreLoading,
    error: scoreError,
  } = useScore(selectedScore?.xmlUrl || null)
  const sessionSummary = useSessionStore((s) => s.sessionSummary)
  const sessionLog = useSessionStore((s) => s.sessionLog)

  const {
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    getWorstMeasures,
    isPaused: sessionPaused,
  } = useSessionLogger()

  const selectedInstrument = useAudioStore((s) => s.selectedInstrument)
  const [debriefOpen, setDebriefOpen] = useState(false)
  const debriefDataRef = useRef(null)

  const heatMapData = useHeatMapData(sessionLog)
  const [heatMapVisible, setHeatMapVisible] = useState(false)

  const micPermission = useAudioStore((s) => s.micPermission)
  const resumeAudioContext = useAudioStore((s) => s.resumeAudioContext)
  const audioContextState = useAudioStore((s) => s.audioContextState)

  const { addToast } = useToast()

  const handleSmartLoopAutoExit = useCallback(() => {
    addToast({
      variant: 'success',
      message:
        'Great work! Your accuracy has reached a consistent level. Keep it up!',
      duration: 5000,
    })
  }, [addToast])

  const [controlsVisible, setControlsVisible] = useState(true)
  const [tempo, setTempo] = useState(120)
  const [metronomeOn, setMetronomeOn] = useState(true)
  const [loopStart, setLoopStart] = useState(null)
  const [loopEnd, setLoopEnd] = useState(null)
  const hideTimerRef = useRef(null)
  const isPracticingRef = useRef(isPracticing)
  isPracticingRef.current = isPracticing

  const scrollRef = useRef(null)
  const sheetMusicAreaRef = useRef(null)

  // Derive time signature for metronome
  const part = score?.parts?.[0]
  const timeSignature = part?.measures?.[0]?.timeSignature || '4/4'
  const beatsPerMeasure = parseInt(timeSignature.split('/')[0], 10) || 4

  // Web Audio API metronome click
  useMetronome({
    tempo,
    beatsPerMeasure,
    enabled: isPracticing && metronomeOn,
  })

  const {
    cursorRef,
    currentMeasure,
    isBouncing,
    reset: resetCursor,
    seekToMeasure,
  } = usePredictiveCursor({
    score,
    partIndex: 0,
    isPracticing,
    tempo,
    metronomeMode: metronomeOn,
    scrollRef,
  })

  // Derive cursor position from the cursorRef for IntonationNeedle
  const cursorPosition = useAudioStore((s) => s.cursorPosition)

  const smartLoop = useSmartLoop({
    heatMapData,
    currentTempo: tempo,
    cursorPosition,
    onTempoChange: setTempo,
    onSeekToMeasure: seekToMeasure,
    onAutoExit: handleSmartLoopAutoExit,
  })

  const totalMeasures = part?.measures?.length || 0

  const handleLoopChange = useCallback((start, end) => {
    setLoopStart(start)
    setLoopEnd(end)
  }, [])

  // When cursor reaches loop end, seek back to loop start
  useEffect(() => {
    if (
      loopStart !== null &&
      loopEnd !== null &&
      isPracticing &&
      currentMeasure > loopEnd
    ) {
      seekToMeasure(loopStart)
    }
  }, [currentMeasure, loopStart, loopEnd, isPracticing, seekToMeasure])

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
      // Pause — pause session logging, exit ghost mode so nav reappears
      setIsPracticing(false)
      pauseSession()
      exitGhostMode()
      setControlsVisible(true)
      clearTimeout(hideTimerRef.current)
    } else {
      // Play / Resume — enter ghost mode
      setIsPracticing(true)
      if (sessionPaused) {
        // Resume an existing paused session
        resumeSession()
      } else {
        // Start a brand-new session
        startSession(selectedScore?.id)
      }
      enterGhostMode()
      setControlsVisible(true)
      startAutoHideTimer()
    }
  }, [
    isPracticing,
    setIsPracticing,
    enterGhostMode,
    exitGhostMode,
    startAutoHideTimer,
    startSession,
    pauseSession,
    resumeSession,
    sessionPaused,
    selectedScore,
  ])

  // Stop handler — exit ghost mode, end session logging, show debrief
  const handleStop = useCallback(() => {
    // Capture worst measures before endSession resets the logger
    const worst = getWorstMeasures(5)
    setIsPracticing(false)
    endSession()
    exitGhostMode()
    setControlsVisible(true)
    clearTimeout(hideTimerRef.current)
    resetCursor()

    debriefDataRef.current = { worstMeasures: worst }
    setDebriefOpen(true)
  }, [
    setIsPracticing,
    exitGhostMode,
    endSession,
    getWorstMeasures,
    resetCursor,
  ])

  // Start smart loop: extract worst measures and begin loop practice
  const handleStartSmartLoop = useCallback(() => {
    const started = smartLoop.startLoop()
    if (started && !isPracticing) {
      handlePlayPause()
    }
  }, [smartLoop, isPracticing, handlePlayPause])

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

  // Show heat map after practice ends and session data is available
  useEffect(() => {
    if (!isPracticing && sessionLog && heatMapData.length > 0) {
      setHeatMapVisible(true)
    }
    if (isPracticing) {
      setHeatMapVisible(false)
    }
  }, [isPracticing, sessionLog, heatMapData.length])

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
    <PracticeView>
      <div data-testid="practice-page" className="relative h-full">
        {/* Sheet music area */}
        <div
          ref={sheetMusicAreaRef}
          data-testid="sheet-music-area"
          className={`${ghostMode ? 'h-full' : 'h-[80%]'} relative flex flex-col items-center justify-center`}
        >
          {!isPracticing && !ghostMode && (
            <div className="text-center mb-4">
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
                !score && (
                  <div className="mb-8" data-testid="practice-no-score">
                    <p className="font-body text-ivory-muted mb-4">
                      No score selected. Choose a piece from the library to
                      start.
                    </p>
                    <Button
                      variant="secondary"
                      onClick={() => navigate('/library')}
                    >
                      Browse Library
                    </Button>
                  </div>
                )
              )}
            </div>
          )}

          {scoreLoading && (
            <p
              data-testid="score-loading"
              className="font-body text-ivory-muted text-sm"
            >
              Loading score...
            </p>
          )}

          {scoreError && (
            <p
              data-testid="score-error"
              className="font-body text-crimson text-sm"
            >
              {scoreError}
            </p>
          )}

          <div className="relative w-full max-w-6xl mx-auto">
            <SheetMusic
              score={score}
              currentMeasure={currentMeasure}
              className="w-full"
              scrollRef={scrollRef}
            />
            <PredictiveCursor
              ref={cursorRef}
              visible={isPracticing && !!score}
              isBouncing={isBouncing}
            />
            <HeatMapOverlay
              heatMapData={heatMapData}
              totalMeasures={totalMeasures}
              visible={heatMapVisible}
            />
            <SmartLoop
              loopMeasures={smartLoop.loopMeasures}
              loopCount={smartLoop.loopCount}
              isImproving={smartLoop.isImproving}
              isActive={smartLoop.isActive}
              loopTempo={smartLoop.loopTempo}
              onExit={smartLoop.exitLoop}
              totalMeasures={totalMeasures}
            />
          </div>

          {/* Breath Intonation Needle — fixed on right edge of screen */}
          {isPracticing && <IntonationNeedle />}
        </div>

        {/* Session summary — shown after practice ends */}
        {!isPracticing &&
          !ghostMode &&
          sessionSummary &&
          sessionSummary.total_deviations > 0 && (
            <div
              data-testid="session-summary"
              className="absolute top-4 right-4 w-72 bg-surface border border-border rounded-lg p-4 shadow-lg z-20"
            >
              <h3 className="font-heading text-sm text-ivory mb-2">
                Session Summary
              </h3>
              <div className="space-y-1 font-body text-xs text-ivory-muted">
                <p>Deviations logged: {sessionSummary.total_deviations}</p>
                {sessionSummary.pitch_deviation_count > 0 && (
                  <p>
                    Pitch: {sessionSummary.pitch_deviation_count} (avg{' '}
                    {sessionSummary.average_pitch_deviation_cents}c)
                  </p>
                )}
                {sessionSummary.intonation_deviation_count > 0 && (
                  <p>Intonation: {sessionSummary.intonation_deviation_count}</p>
                )}
                {sessionSummary.worst_measure && (
                  <p className="text-amber">
                    Needs work: m.{sessionSummary.worst_measure}
                  </p>
                )}
              </div>
              {heatMapData.length > 0 && (
                <button
                  data-testid="start-smart-loop-button"
                  onClick={handleStartSmartLoop}
                  className="mt-3 w-full font-body text-xs text-amber border border-amber/30 hover:bg-amber/10 rounded px-3 py-1.5 transition-colors"
                >
                  Smart Loop Weak Measures
                </button>
              )}
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

        {/* No-mic fallback banner */}
        {(micPermission === 'denied' || micPermission === 'unsupported') && (
          <div className="absolute top-4 left-4 z-20">
            <NoMicFallbackBanner
              reason={micPermission === 'denied' ? 'denied' : 'unsupported'}
            />
          </div>
        )}

        {/* Practice controls bar */}
        <PracticeControls
          isPracticing={isPracticing}
          onPlayPause={handlePlayPause}
          onStop={handleStop}
          visible={controlsVisible}
          tempo={tempo}
          onTempoChange={setTempo}
          metronomeOn={metronomeOn}
          onMetronomeToggle={setMetronomeOn}
          totalMeasures={totalMeasures}
          loopStart={loopStart}
          loopEnd={loopEnd}
          onLoopChange={handleLoopChange}
        />

        {/* Audio suspension overlay — shown when browser suspends AudioContext */}
        {isPracticing && (
          <AudioSuspensionOverlay
            onResume={resumeAudioContext}
            isInitialSuspension={
              isPracticing && audioContextState === 'suspended'
            }
          />
        )}

        {/* AI Coach Debrief modal */}
        <CoachDebrief
          isOpen={debriefOpen}
          onClose={() => setDebriefOpen(false)}
          sessionLog={sessionLog}
          sessionSummary={sessionSummary}
          worstMeasures={debriefDataRef.current?.worstMeasures || []}
          instrument={selectedInstrument || 'violin'}
          onPracticeAgain={() => {
            setDebriefOpen(false)
            handlePlayPause()
          }}
        />
      </div>
    </PracticeView>
  )
}
