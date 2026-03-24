/**
 * Register the service worker for offline support.
 * The SW file lives in public/sw.js and is served at /sw.js by Vite.
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'activated' &&
              navigator.serviceWorker.controller
            ) {
              // New SW activated — could show update prompt
            }
          })
        }
      })
    } catch {
      // SW registration failed — app still works without it
    }
  })

  // Listen for token requests from the SW
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'REQUEST_AUTH_TOKEN') {
      // Respond with the current auth token if available
      const token =
        typeof window.__getAuthToken === 'function'
          ? window.__getAuthToken()
          : null
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ token })
      }
    }
  })
}
