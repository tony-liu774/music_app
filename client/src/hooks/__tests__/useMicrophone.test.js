import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useMicrophone } from '../useMicrophone'
import { useAudioStore } from '../../stores/useAudioStore'

// Helper to create a mock MediaStream
function createMockStream() {
  const track = { stop: vi.fn(), kind: 'audio' }
  return {
    getTracks: () => [track],
    _track: track,
  }
}

describe('useMicrophone', () => {
  let originalMediaDevices
  let originalPermissions
  let originalIsSecureContext

  beforeEach(() => {
    // Reset audio store
    useAudioStore.setState({ micPermission: 'prompt' })

    // Clear localStorage
    localStorage.clear()

    // Save originals
    originalMediaDevices = navigator.mediaDevices
    originalPermissions = navigator.permissions
    originalIsSecureContext = window.isSecureContext

    // Default: mock getUserMedia as supported
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn(),
      },
      writable: true,
      configurable: true,
    })

    // Default: mock permissions API
    Object.defineProperty(navigator, 'permissions', {
      value: {
        query: vi.fn().mockResolvedValue({ state: 'prompt' }),
      },
      writable: true,
      configurable: true,
    })

    // Default: secure context
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(navigator, 'permissions', {
      value: originalPermissions,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, 'isSecureContext', {
      value: originalIsSecureContext,
      writable: true,
      configurable: true,
    })
  })

  it('starts in idle state by default', () => {
    const { result } = renderHook(() => useMicrophone())
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
    expect(result.current.isActive).toBe(false)
    expect(result.current.isSupported).toBe(true)
    expect(result.current.isSecure).toBe(true)
  })

  it('returns unsupported when getUserMedia is not available', () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useMicrophone())
    expect(result.current.status).toBe('unsupported')
    expect(result.current.isSupported).toBe(false)
  })

  it('returns error status when not in secure context', () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useMicrophone())
    expect(result.current.status).toBe('error')
    expect(result.current.isSecure).toBe(false)
  })

  it('transitions to granted state on successful getUserMedia call', async () => {
    const mockStream = createMockStream()
    navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream)

    const { result } = renderHook(() => useMicrophone())

    let stream
    await act(async () => {
      stream = await result.current.requestAccess()
    })

    expect(stream).toBe(mockStream)
    expect(result.current.status).toBe('granted')
    expect(result.current.isActive).toBe(true)
    expect(useAudioStore.getState().micPermission).toBe('granted')
    expect(localStorage.getItem('mic_permission_state')).toBe('granted')
  })

  it('transitions to denied state when user denies permission', async () => {
    const deniedError = new DOMException('Permission denied', 'NotAllowedError')
    navigator.mediaDevices.getUserMedia.mockRejectedValue(deniedError)

    const { result } = renderHook(() => useMicrophone())

    let stream
    await act(async () => {
      stream = await result.current.requestAccess()
    })

    expect(stream).toBeNull()
    expect(result.current.status).toBe('denied')
    expect(result.current.error).toBe(deniedError)
    expect(useAudioStore.getState().micPermission).toBe('denied')
    expect(localStorage.getItem('mic_permission_state')).toBe('denied')
  })

  it('transitions to error state on non-permission errors', async () => {
    const otherError = new Error('Device not found')
    navigator.mediaDevices.getUserMedia.mockRejectedValue(otherError)

    const { result } = renderHook(() => useMicrophone())

    await act(async () => {
      await result.current.requestAccess()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe(otherError)
  })

  it('returns error when requesting access without getUserMedia support', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useMicrophone())

    let stream
    await act(async () => {
      stream = await result.current.requestAccess()
    })

    expect(stream).toBeNull()
    expect(result.current.status).toBe('unsupported')
    expect(result.current.error).not.toBeNull()
  })

  it('returns error when requesting access without secure context', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useMicrophone())

    let stream
    await act(async () => {
      stream = await result.current.requestAccess()
    })

    expect(stream).toBeNull()
    expect(result.current.status).toBe('error')
    expect(result.current.error.message).toContain('HTTPS')
  })

  it('stops stream tracks when stopStream is called', async () => {
    const mockStream = createMockStream()
    navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream)

    const { result } = renderHook(() => useMicrophone())

    await act(async () => {
      await result.current.requestAccess()
    })

    expect(result.current.isActive).toBe(true)

    act(() => {
      result.current.stopStream()
    })

    expect(result.current.isActive).toBe(false)
    expect(mockStream._track.stop).toHaveBeenCalled()
  })

  it('resets state and clears localStorage on reset', async () => {
    const mockStream = createMockStream()
    navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream)

    const { result } = renderHook(() => useMicrophone())

    await act(async () => {
      await result.current.requestAccess()
    })

    expect(result.current.status).toBe('granted')

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
    expect(result.current.isActive).toBe(false)
    expect(localStorage.getItem('mic_permission_state')).toBeNull()
    expect(useAudioStore.getState().micPermission).toBe('prompt')
  })

  it('restores granted state from localStorage', () => {
    localStorage.setItem('mic_permission_state', 'granted')

    const { result } = renderHook(() => useMicrophone())
    expect(result.current.status).toBe('granted')
  })

  it('restores denied state from localStorage', () => {
    localStorage.setItem('mic_permission_state', 'denied')

    const { result } = renderHook(() => useMicrophone())
    expect(result.current.status).toBe('denied')
  })

  it('detects previously denied permission via permissions API', async () => {
    navigator.permissions.query.mockResolvedValue({ state: 'denied' })

    const { result } = renderHook(() => useMicrophone())

    // Wait for the permissions query effect
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(result.current.status).toBe('denied')
    expect(useAudioStore.getState().micPermission).toBe('denied')
  })

  it('detects previously granted permission via permissions API', async () => {
    navigator.permissions.query.mockResolvedValue({ state: 'granted' })

    const { result } = renderHook(() => useMicrophone())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(result.current.status).toBe('granted')
    expect(useAudioStore.getState().micPermission).toBe('granted')
  })

  it('cleans up stream on unmount', async () => {
    const mockStream = createMockStream()
    navigator.mediaDevices.getUserMedia.mockResolvedValue(mockStream)

    const { result, unmount } = renderHook(() => useMicrophone())

    await act(async () => {
      await result.current.requestAccess()
    })

    unmount()

    expect(mockStream._track.stop).toHaveBeenCalled()
  })

  it('handles permissions API not available gracefully', async () => {
    Object.defineProperty(navigator, 'permissions', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useMicrophone())

    // Should not throw and should remain in idle state
    expect(result.current.status).toBe('idle')
  })

  it('handles permissions query rejection gracefully', async () => {
    navigator.permissions.query.mockRejectedValue(new Error('Not supported'))

    const { result } = renderHook(() => useMicrophone())

    // Wait for the effect
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    // Should remain in idle state (doesn't crash)
    expect(result.current.status).toBe('idle')
  })
})
