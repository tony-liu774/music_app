import { useState, useEffect } from 'react'

/**
 * Checks browser support for key APIs the app depends on.
 * Returns an object with support flags and any missing features.
 */
function checkBrowserCompat() {
  const issues = []

  if (!window.AudioContext && !window.webkitAudioContext) {
    issues.push('Web Audio API')
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    issues.push('Microphone access (getUserMedia)')
  }

  if (!window.Worker) {
    issues.push('Web Workers')
  }

  if (!window.indexedDB) {
    issues.push('IndexedDB (offline storage)')
  }

  if (!window.isSecureContext) {
    issues.push('Secure context (HTTPS)')
  }

  return { supported: issues.length === 0, issues }
}

/**
 * BrowserCompatCheck — renders a full-screen warning if the browser is missing
 * required APIs. Otherwise renders children transparently.
 */
// eslint-disable-next-line react/prop-types
export default function BrowserCompatCheck({ children }) {
  const [compat, setCompat] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setCompat(checkBrowserCompat())
  }, [])

  if (!compat || compat.supported || dismissed) {
    return children
  }

  return (
    <div
      data-testid="browser-compat-warning"
      className="min-h-screen bg-oxford-blue flex items-center justify-center px-4"
    >
      <div className="w-full max-w-md bg-surface border border-border rounded-lg p-8 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-12 h-12 max-w-12 max-h-12 text-amber mx-auto mb-4"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.499-2.599 4.499H4.645c-2.309 0-3.752-2.5-2.598-4.499L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
            clipRule="evenodd"
          />
        </svg>

        <h1 className="font-heading text-2xl text-ivory mb-2">
          Browser Not Supported
        </h1>
        <p className="font-body text-ivory-muted text-sm mb-4">
          The Virtual Concertmaster requires modern browser features that are
          not available in your current browser.
        </p>

        <div className="bg-elevated rounded-md p-4 mb-6 text-left">
          <p className="font-body text-xs text-ivory-dim mb-2">
            Missing features:
          </p>
          <ul className="space-y-1">
            {compat.issues.map((issue) => (
              <li
                key={issue}
                className="font-body text-sm text-crimson-light flex items-center gap-2"
              >
                <span aria-hidden="true">×</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>

        <p className="font-body text-xs text-ivory-dim mb-4">
          Please use a recent version of Chrome, Firefox, Safari, or Edge.
        </p>

        <button
          onClick={() => setDismissed(true)}
          className="font-body text-xs text-ivory-dim underline hover:text-ivory transition-colors"
          data-testid="compat-dismiss-button"
        >
          Continue anyway
        </button>
      </div>
    </div>
  )
}

export { checkBrowserCompat }
