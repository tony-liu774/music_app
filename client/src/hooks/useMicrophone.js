import { useState, useRef, useCallback, useEffect } from 'react'
import { useAudioStore } from '../stores/useAudioStore'

const STORAGE_KEY = 'mic_permission_state'

/**
 * Check if getUserMedia is supported by the browser.
 */
function isGetUserMediaSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
}

/**
 * Check if the page is served over a secure context (HTTPS or localhost).
 */
function isSecureContext() {
  return window.isSecureContext !== false
}

/**
 * Load persisted permission state from localStorage.
 */
function loadPersistedState() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Save permission state to localStorage.
 */
function persistState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, state)
  } catch {
    // Silently ignore storage errors
  }
}

/**
 * Custom hook wrapping navigator.mediaDevices.getUserMedia.
 * Tracks permission state and stores the MediaStream reference.
 *
 * States: idle | prompting | granted | denied | error | unsupported
 */
export function useMicrophone() {
  const streamRef = useRef(null)
  const setMicPermission = useAudioStore((s) => s.setMicPermission)

  // Determine initial state from persisted value or defaults
  const getInitialStatus = () => {
    if (!isGetUserMediaSupported()) return 'unsupported'
    if (!isSecureContext()) return 'error'
    const persisted = loadPersistedState()
    if (persisted === 'granted' || persisted === 'denied') return persisted
    return 'idle'
  }

  const getInitialError = () => {
    if (!isGetUserMediaSupported())
      return new Error('getUserMedia is not supported in this browser')
    if (!isSecureContext())
      return new Error('Microphone access requires HTTPS')
    return null
  }

  const [status, setStatus] = useState(getInitialStatus)
  const [error, setError] = useState(getInitialError)
  const [isActive, setIsActive] = useState(false)

  // Query the browser permission API on mount to detect previously-denied state
  useEffect(() => {
    if (!isGetUserMediaSupported() || !navigator.permissions) return

    let cancelled = false
    navigator.permissions
      .query({ name: 'microphone' })
      .then((result) => {
        if (cancelled) return
        if (result.state === 'denied') {
          setStatus('denied')
          persistState('denied')
          setMicPermission('denied')
        } else if (result.state === 'granted') {
          setStatus('granted')
          persistState('granted')
          setMicPermission('granted')
        }
      })
      .catch(() => {
        // permissions.query not supported for microphone (e.g. Safari)
      })

    return () => {
      cancelled = true
    }
  }, [setMicPermission])

  /**
   * Request microphone access. Returns the MediaStream on success.
   */
  const requestAccess = useCallback(async () => {
    if (!isGetUserMediaSupported()) {
      setStatus('unsupported')
      setError(new Error('getUserMedia is not supported in this browser'))
      return null
    }

    if (!isSecureContext()) {
      setStatus('error')
      setError(new Error('Microphone access requires HTTPS'))
      return null
    }

    setStatus('prompting')
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setStatus('granted')
      setIsActive(true)
      persistState('granted')
      setMicPermission('granted')
      return stream
    } catch (err) {
      const isDenied =
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
      const newStatus = isDenied ? 'denied' : 'error'
      setStatus(newStatus)
      setError(err)
      persistState(isDenied ? 'denied' : null)
      setMicPermission(isDenied ? 'denied' : 'prompt')
      return null
    }
  }, [setMicPermission])

  /**
   * Stop all tracks on the current MediaStream and release the reference.
   */
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsActive(false)
  }, [])

  /**
   * Reset permission state to allow re-prompting.
   */
  const reset = useCallback(() => {
    stopStream()
    setStatus('idle')
    setError(null)
    setMicPermission('prompt')
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [stopStream, setMicPermission])

  // Cleanup on unmount — stop all tracks
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  return {
    status,
    error,
    isActive,
    requestAccess,
    stopStream,
    reset,
    isSupported: isGetUserMediaSupported(),
    isSecure: isSecureContext(),
  }
}
