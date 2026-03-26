/**
 * NoMicFallbackBanner — subtle banner shown when microphone is unavailable.
 * Informs the user that practice mode is running without pitch tracking
 * (metronome + score only).
 *
 * @param {object} props
 * @param {'denied' | 'unsupported' | 'error'} props.reason — why mic is unavailable
 */
// eslint-disable-next-line react/prop-types
export default function NoMicFallbackBanner({ reason }) {
  const messages = {
    denied:
      'Microphone access denied — practicing with score and metronome only.',
    unsupported:
      'Microphone not available — practicing with score and metronome only.',
    error: 'Microphone error — practicing with score and metronome only.',
  }

  return (
    <div
      data-testid="no-mic-fallback-banner"
      className="flex items-center gap-2 px-4 py-2 bg-elevated border border-border rounded-md"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-5 h-5 max-w-5 max-h-5 text-ivory-dim shrink-0"
        aria-hidden="true"
      >
        <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
        <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
        <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18Z" />
      </svg>
      <span className="font-body text-xs text-ivory-dim">
        {messages[reason] || messages.error}
      </span>
    </div>
  )
}
