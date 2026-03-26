import { useState, useCallback } from 'react'
import { useMicrophone } from '../../hooks/useMicrophone'
import { useAudioStore } from '../../stores/useAudioStore'
import Button from '../ui/Button'
import InputLevelMeter from './InputLevelMeter'

/**
 * Microphone icon SVG.
 */
function MicIcon({ className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`max-w-8 max-h-8 w-8 h-8 ${className}`}
    >
      <rect x="9" y="1" width="6" height="12" rx="3" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="18" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

/**
 * MicrophoneSetup — full onboarding component for requesting microphone access.
 *
 * Features:
 * - Requests getUserMedia access
 * - Handles "Microphone Denied" edge case with friendly re-enable instructions
 * - Shows real-time input level meter to confirm the mic is working
 * - Stores permission state in useAudioStore
 *
 * @param {object} props
 * @param {function} [props.onComplete] — called when user confirms mic is working
 */
export default function MicrophoneSetup({ onComplete }) {
  const { status, error, requestAccess, stopStream, reset, isSupported } =
    useMicrophone()
  const micPermission = useAudioStore((s) => s.micPermission)
  const [stream, setStream] = useState(null)

  const handleRequestAccess = useCallback(async () => {
    const mediaStream = await requestAccess()
    if (mediaStream) {
      setStream(mediaStream)
    }
  }, [requestAccess])

  const handleContinue = useCallback(() => {
    if (stream) {
      stopStream()
      setStream(null)
    }
    if (onComplete) onComplete()
  }, [stream, stopStream, onComplete])

  const handleRetry = useCallback(() => {
    if (stream) {
      stopStream()
      setStream(null)
    }
    reset()
  }, [stream, stopStream, reset])

  // Unsupported browser
  if (!isSupported) {
    return (
      <div className="flex flex-col items-center justify-center p-8 max-w-md mx-auto space-y-6">
        <div className="w-20 h-20 rounded-full bg-crimson/10 flex items-center justify-center">
          <MicIcon className="text-crimson" />
        </div>
        <h2 className="font-heading text-xl text-ivory text-center">
          Browser Not Supported
        </h2>
        <p className="text-ivory-muted text-sm text-center leading-relaxed">
          Your browser does not support microphone access. Please use a modern
          browser like Chrome, Firefox, or Safari, and ensure you are on HTTPS.
        </p>
      </div>
    )
  }

  // Permission denied
  if (status === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center p-8 max-w-md mx-auto space-y-6">
        <div className="w-20 h-20 rounded-full bg-crimson/10 flex items-center justify-center">
          <MicIcon className="text-crimson" />
        </div>
        <h2 className="font-heading text-xl text-ivory text-center">
          Microphone Access Denied
        </h2>
        <p className="text-ivory-muted text-sm text-center leading-relaxed">
          The Virtual Concertmaster needs your microphone to listen to your
          playing and provide real-time intonation feedback. Your audio is
          processed entirely on your device and is never recorded or sent
          anywhere.
        </p>
        <div className="bg-surface rounded-lg p-4 space-y-2 w-full">
          <p className="text-ivory text-sm font-semibold">
            To re-enable your microphone:
          </p>
          <ol className="text-ivory-muted text-sm space-y-1 list-decimal list-inside">
            <li>
              Click the lock/settings icon in your browser&apos;s address bar
            </li>
            <li>Find &quot;Microphone&quot; in the permissions list</li>
            <li>Change it to &quot;Allow&quot;</li>
            <li>Refresh this page</li>
          </ol>
        </div>
        <Button variant="secondary" size="md" onClick={handleRetry}>
          Try Again
        </Button>
      </div>
    )
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center p-8 max-w-md mx-auto space-y-6">
        <div className="w-20 h-20 rounded-full bg-crimson/10 flex items-center justify-center">
          <MicIcon className="text-crimson" />
        </div>
        <h2 className="font-heading text-xl text-ivory text-center">
          Something Went Wrong
        </h2>
        <p className="text-ivory-muted text-sm text-center leading-relaxed">
          {error?.message?.includes('HTTPS')
            ? 'Microphone access requires a secure (HTTPS) connection.'
            : 'An unexpected error occurred while accessing your microphone. Please try again.'}
        </p>
        <Button variant="secondary" size="md" onClick={handleRetry}>
          Try Again
        </Button>
      </div>
    )
  }

  // Granted — show level meter confirmation
  if (status === 'granted' && stream) {
    return (
      <div className="flex flex-col items-center justify-center p-8 max-w-md mx-auto space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald/10 flex items-center justify-center animate-amber-pulse">
          <MicIcon className="text-emerald" />
        </div>
        <h2 className="font-heading text-xl text-emerald text-center">
          Microphone Connected
        </h2>
        <p className="text-ivory-muted text-sm text-center leading-relaxed">
          Play a note or speak to confirm your microphone is picking up sound.
        </p>
        <div className="w-full bg-elevated rounded-lg p-4">
          <p className="text-ivory-muted text-xs text-center mb-3">
            Input Level
          </p>
          <InputLevelMeter stream={stream} active={true} />
        </div>
        <Button variant="primary" size="lg" onClick={handleContinue}>
          Sounds Good — Start Practicing
        </Button>
      </div>
    )
  }

  // Granted but no active stream (returning user)
  if (status === 'granted' || micPermission === 'granted') {
    return (
      <div className="flex flex-col items-center justify-center p-8 max-w-md mx-auto space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald/10 flex items-center justify-center">
          <MicIcon className="text-emerald" />
        </div>
        <h2 className="font-heading text-xl text-emerald text-center">
          Microphone Ready
        </h2>
        <p className="text-ivory-muted text-sm text-center leading-relaxed">
          Your microphone permission is already granted.
        </p>
        <Button variant="primary" size="lg" onClick={handleContinue}>
          Continue
        </Button>
      </div>
    )
  }

  // Initial state — request permission
  return (
    <div className="flex flex-col items-center justify-center p-8 max-w-md mx-auto space-y-6">
      <div className="w-20 h-20 rounded-full bg-amber/10 flex items-center justify-center">
        <MicIcon className="text-amber" />
      </div>
      <h2 className="font-heading text-xl text-ivory text-center">
        Let&apos;s Tune In
      </h2>
      <p className="text-ivory-muted text-sm text-center leading-relaxed">
        The Virtual Concertmaster listens to your playing in real-time to
        provide pitch detection, intonation feedback, and personalized coaching.
        Your audio is processed locally and never recorded.
      </p>
      <Button
        variant="primary"
        size="lg"
        onClick={handleRequestAccess}
        disabled={status === 'prompting'}
      >
        {status === 'prompting'
          ? 'Waiting for Permission...'
          : 'Allow Microphone'}
      </Button>
    </div>
  )
}
