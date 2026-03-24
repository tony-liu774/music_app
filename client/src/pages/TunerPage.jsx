import { useState, useCallback, useRef, useEffect } from 'react'
import { TunerGauge, TunerDisplay } from '../components/tuner'
import { useAudioPipeline } from '../hooks/useAudioPipeline'
import { useMicrophone } from '../hooks/useMicrophone'
import { useAudioStore } from '../stores/useAudioStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import Button from '../components/ui/Button'

/**
 * TunerPage — full-screen standalone tuner view.
 * Reuses the same audio pipeline (Web Worker) as practice mode.
 */
export default function TunerPage() {
  const { requestAccess, stopStream, status: micStatus } = useMicrophone()
  const { start, stop, isRunning, error: pipelineError } = useAudioPipeline()

  const pitchData = useAudioStore((s) => s.pitchData)
  const needleSensitivity = useSettingsStore((s) => s.needleSensitivity)

  // Smoothed cents for gauge animation
  const smoothedCentsRef = useRef(0)
  const [smoothedCents, setSmoothedCents] = useState(0)
  const animFrameRef = useRef(null)

  // Smoothing loop: blend raw cents toward smoothed value
  const updateSmoothing = useCallback(() => {
    const rawCents = pitchData.cents ?? 0
    // Sensitivity controls how quickly the needle responds (0.1 = sluggish, 1.0 = instant)
    const alpha = 0.2 + needleSensitivity * 0.6
    smoothedCentsRef.current =
      smoothedCentsRef.current * (1 - alpha) + rawCents * alpha
    setSmoothedCents(smoothedCentsRef.current)
    animFrameRef.current = requestAnimationFrame(updateSmoothing)
  }, [pitchData.cents, needleSensitivity])

  useEffect(() => {
    if (isRunning) {
      animFrameRef.current = requestAnimationFrame(updateSmoothing)
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
      smoothedCentsRef.current = 0
      setSmoothedCents(0)
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [isRunning, updateSmoothing])

  const handleToggle = useCallback(async () => {
    if (isRunning) {
      stop()
      stopStream()
      return
    }

    const stream = await requestAccess()
    if (stream) {
      await start(stream)
    }
  }, [isRunning, stop, stopStream, requestAccess, start])

  const showError = pipelineError || (micStatus === 'denied')

  return (
    <div
      className="flex flex-col items-center gap-6 px-4 py-6"
      data-testid="tuner-page"
    >
      {/* Header */}
      <div className="text-center">
        <h1 className="font-heading text-3xl text-amber">Precision Tuner</h1>
        <p className="font-body text-sm text-ivory-muted mt-1">
          Fine-tune your instrument with real-time pitch detection
        </p>
      </div>

      {/* Gauge */}
      <TunerGauge cents={smoothedCents} isActive={isRunning} />

      {/* Note + frequency display */}
      <TunerDisplay
        note={isRunning ? pitchData.note : null}
        frequency={isRunning ? pitchData.frequency : null}
        cents={isRunning ? pitchData.cents : null}
        isActive={isRunning}
      />

      {/* Start / Stop button */}
      <div className="mt-2">
        <Button
          variant={isRunning ? 'secondary' : 'primary'}
          onClick={handleToggle}
          data-testid="tuner-toggle"
        >
          {isRunning ? (
            <span className="flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="max-w-5 max-h-5 w-5 h-5"
                aria-hidden="true"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
              Stop Tuner
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="max-w-5 max-h-5 w-5 h-5"
                aria-hidden="true"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Start Tuner
            </span>
          )}
        </Button>
      </div>

      {/* Error state */}
      {showError && (
        <p className="font-body text-sm text-crimson text-center" data-testid="tuner-error">
          {micStatus === 'denied'
            ? 'Microphone access was denied. Please allow microphone access in your browser settings.'
            : pipelineError?.message || 'An error occurred with the audio pipeline.'}
        </p>
      )}

      {/* Status indicator */}
      <div className="flex items-center gap-2 mt-2" data-testid="tuner-status">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isRunning ? 'bg-emerald animate-pulse' : 'bg-ivory-dim'
          }`}
        />
        <span className="font-body text-xs text-ivory-dim">
          {isRunning ? 'Listening...' : 'Tap Start to begin'}
        </span>
      </div>
    </div>
  )
}
