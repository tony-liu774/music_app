import { useAudioStore } from '../../stores/useAudioStore'

/**
 * Overlay shown when the AudioContext is suspended by the browser (e.g. tab
 * backgrounded, phone call, OS audio focus loss). Prompts the user to tap
 * to resume audio processing.
 *
 * Also shown on initial start when the AudioContext requires a user gesture
 * to begin (autoplay policy).
 *
 * @param {object} props
 * @param {() => Promise<boolean>} props.onResume — called when the user taps to resume
 * @param {boolean} [props.isInitialSuspension=false] — true when AudioContext
 *   started in suspended state and needs a first user gesture
 */
export default function AudioSuspensionOverlay({
  onResume,
  isInitialSuspension = false,
}) {
  const isSuspendedBySystem = useAudioStore((s) => s.isSuspendedBySystem)
  const resumeFailCount = useAudioStore((s) => s.resumeFailCount)

  const visible = isSuspendedBySystem || isInitialSuspension
  if (!visible) return null

  const hasExhaustedRetries = resumeFailCount >= 3
  const heading = isInitialSuspension
    ? 'Tap to Enable Audio'
    : 'Audio Interrupted'
  const message = hasExhaustedRetries
    ? 'Auto-resume failed. Tap to try again.'
    : isInitialSuspension
      ? 'Your browser requires a gesture to start audio.'
      : 'Audio was paused by your browser. Tap to resume.'

  return (
    <div
      data-testid="audio-suspension-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-oxford-blue/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={heading}
    >
      <button
        data-testid="audio-resume-button"
        type="button"
        onClick={onResume}
        className="flex flex-col items-center gap-4 p-8 rounded-lg bg-elevated border border-border shadow-lg transition-all duration-200 hover:border-amber hover:shadow-amber-glow focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-2 focus:ring-offset-oxford-blue"
      >
        {/* Play/speaker icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-12 h-12 text-amber"
          aria-hidden="true"
        >
          {isInitialSuspension ? (
            <path d="M11.5 3.5a.5.5 0 0 1 .5.5v16a.5.5 0 0 1-.78.42L5.63 16H2.5A1.5 1.5 0 0 1 1 14.5v-5A1.5 1.5 0 0 1 2.5 8h3.13l5.59-4.42a.5.5 0 0 1 .28-.08Zm3.74 3.26a.75.75 0 0 1 1.06 0 7 7 0 0 1 0 9.9.75.75 0 1 1-1.06-1.06 5.5 5.5 0 0 0 0-7.78.75.75 0 0 1 0-1.06Zm2.83-2.83a.75.75 0 0 1 1.06 0c4.3 4.3 4.3 11.27 0 15.56a.75.75 0 1 1-1.06-1.06 9.5 9.5 0 0 0 0-13.44.75.75 0 0 1 0-1.06Z" />
          ) : (
            <path
              fillRule="evenodd"
              d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
              clipRule="evenodd"
            />
          )}
        </svg>

        <span className="font-heading text-xl text-ivory">{heading}</span>
        <span className="font-body text-sm text-ivory-muted max-w-xs text-center">
          {message}
        </span>
      </button>
    </div>
  )
}
