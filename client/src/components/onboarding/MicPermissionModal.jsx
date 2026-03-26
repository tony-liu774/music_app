import { useCallback } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { useMicrophone } from '../../hooks/useMicrophone'

/**
 * Microphone icon SVG with optional amber pulse animation when active.
 */
function MicIcon({ isActive }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center ${isActive ? 'animate-amber-pulse' : ''}`}
    >
      <div className="w-16 h-16 rounded-full bg-amber/10 flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="max-w-8 max-h-8 w-8 h-8 text-amber"
        >
          <rect x="9" y="1" width="6" height="12" rx="3" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
          <line x1="12" y1="18" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </div>
    </div>
  )
}

/**
 * Content shown when microphone permission is denied.
 */
function DeniedContent({ onRetry }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-crimson/10 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="max-w-8 max-h-8 w-8 h-8 text-crimson"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .67-.1 1.32-.27 1.93" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>
      </div>

      <h3 className="font-heading text-lg text-ivory text-center">
        Microphone Access Denied
      </h3>

      <p className="text-ivory-muted text-sm text-center leading-relaxed">
        The Virtual Concertmaster needs microphone access to listen to your
        playing and provide real-time feedback.
      </p>

      <div className="bg-surface rounded-lg p-4 space-y-2">
        <p className="text-ivory text-sm font-semibold">
          To enable your microphone:
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

      <div className="flex gap-3 justify-center pt-2">
        <Button variant="secondary" size="md" onClick={onRetry}>
          Try Again
        </Button>
      </div>
    </div>
  )
}

/**
 * Content shown when getUserMedia is not supported.
 */
function UnsupportedContent() {
  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-crimson/10 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="max-w-8 max-h-8 w-8 h-8 text-crimson"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
      </div>

      <h3 className="font-heading text-lg text-ivory text-center">
        Browser Not Supported
      </h3>

      <p className="text-ivory-muted text-sm text-center leading-relaxed">
        Your browser does not support microphone access. Please use a modern
        browser like Chrome, Firefox, or Safari.
      </p>

      <div className="bg-surface rounded-lg p-4">
        <p className="text-ivory-muted text-sm text-center">
          Make sure you&apos;re accessing this page over HTTPS.
        </p>
      </div>
    </div>
  )
}

/**
 * Content shown when there's an error (non-denied).
 */
function ErrorContent({ error, onRetry }) {
  const isHttpsError = error?.message?.includes('HTTPS')

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-crimson/10 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="max-w-8 max-h-8 w-8 h-8 text-crimson"
          >
            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
      </div>

      <h3 className="font-heading text-lg text-ivory text-center">
        {isHttpsError ? 'Secure Connection Required' : 'Something Went Wrong'}
      </h3>

      <p className="text-ivory-muted text-sm text-center leading-relaxed">
        {isHttpsError
          ? 'Microphone access requires a secure (HTTPS) connection. Please access this page over HTTPS.'
          : 'An unexpected error occurred while trying to access the microphone. Please try again.'}
      </p>

      {!isHttpsError && (
        <div className="flex gap-3 justify-center pt-2">
          <Button variant="secondary" size="md" onClick={onRetry}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Main prompt content asking users to allow microphone access.
 */
function PromptContent({ onAllow, isPrompting }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <MicIcon isActive={false} />
      </div>

      <h3 className="font-heading text-lg text-ivory text-center">
        Let&apos;s Tune In
      </h3>

      <p className="text-ivory-muted text-sm text-center leading-relaxed">
        The Virtual Concertmaster listens to your playing in real-time to
        provide pitch detection, intonation feedback, and personalized coaching.
        Your audio is processed locally and never recorded.
      </p>

      <div className="flex justify-center pt-2">
        <Button
          variant="primary"
          size="lg"
          onClick={onAllow}
          disabled={isPrompting}
        >
          {isPrompting ? 'Waiting for Permission...' : 'Allow Microphone'}
        </Button>
      </div>
    </div>
  )
}

/**
 * Content shown when microphone is granted and active.
 */
function GrantedContent({ onContinue }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <MicIcon isActive={true} />
      </div>

      <h3 className="font-heading text-lg text-emerald text-center">
        Microphone Connected
      </h3>

      <p className="text-ivory-muted text-sm text-center leading-relaxed">
        Your microphone is ready. The Virtual Concertmaster can now listen to
        your playing and provide real-time feedback.
      </p>

      <div className="flex justify-center pt-2">
        <Button variant="primary" size="lg" onClick={onContinue}>
          Start Practicing
        </Button>
      </div>
    </div>
  )
}

/**
 * Microphone permission onboarding modal.
 * Shows different content based on the current permission state.
 */
function MicPermissionModal({ isOpen, onClose, onComplete }) {
  const { status, error, requestAccess, stopStream, reset } = useMicrophone()

  const handleAllow = useCallback(async () => {
    const stream = await requestAccess()
    if (stream) {
      // Stop the stream via hook — we just needed to confirm permission
      stopStream()
    }
  }, [requestAccess, stopStream])

  const handleRetry = useCallback(() => {
    reset()
  }, [reset])

  const handleContinue = useCallback(() => {
    if (onComplete) onComplete()
    onClose()
  }, [onComplete, onClose])

  const renderContent = () => {
    switch (status) {
      case 'unsupported':
        return <UnsupportedContent />
      case 'error':
        return <ErrorContent error={error} onRetry={handleRetry} />
      case 'denied':
        return <DeniedContent onRetry={handleRetry} />
      case 'granted':
        return <GrantedContent onContinue={handleContinue} />
      case 'prompting':
      case 'idle':
      default:
        return (
          <PromptContent
            onAllow={handleAllow}
            isPrompting={status === 'prompting'}
          />
        )
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Microphone Setup">
      {renderContent()}
    </Modal>
  )
}

export default MicPermissionModal
