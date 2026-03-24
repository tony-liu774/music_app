import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAudioContextSuspension } from '../useAudioContextSuspension'
import { useAudioStore } from '../../stores/useAudioStore'

function createMockAudioContext(initialState = 'running') {
  const listeners = {}
  const ctx = {
    state: initialState,
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((event, handler) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(handler)
    }),
    removeEventListener: vi.fn((event, handler) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler)
      }
    }),
    _listeners: listeners,
    _fireStateChange() {
      if (listeners.statechange) {
        listeners.statechange.forEach((h) => h())
      }
    },
  }
  return ctx
}

describe('useAudioContextSuspension', () => {
  beforeEach(() => {
    useAudioStore.setState({
      audioContextState: 'suspended',
      isSuspendedBySystem: false,
      resumeFailCount: 0,
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns a resume function', () => {
    const { result } = renderHook(() => useAudioContextSuspension(null))
    expect(result.current.resume).toBeInstanceOf(Function)
  })

  it('sets audioContextState to running on mount with running context', () => {
    const ctx = createMockAudioContext('running')
    renderHook(() => useAudioContextSuspension(ctx))

    expect(useAudioStore.getState().audioContextState).toBe('running')
  })

  it('registers statechange and visibilitychange listeners', () => {
    const ctx = createMockAudioContext('running')
    const addSpy = vi.spyOn(document, 'addEventListener')

    renderHook(() => useAudioContextSuspension(ctx))

    expect(ctx.addEventListener).toHaveBeenCalledWith(
      'statechange',
      expect.any(Function),
    )
    expect(addSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    )

    addSpy.mockRestore()
  })

  it('removes listeners on unmount', () => {
    const ctx = createMockAudioContext('running')
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = renderHook(() => useAudioContextSuspension(ctx))
    unmount()

    expect(ctx.removeEventListener).toHaveBeenCalledWith(
      'statechange',
      expect.any(Function),
    )
    expect(removeSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    )

    removeSpy.mockRestore()
  })

  it('does not attach listeners when enabled is false', () => {
    const ctx = createMockAudioContext('running')
    renderHook(() => useAudioContextSuspension(ctx, { enabled: false }))

    expect(ctx.addEventListener).not.toHaveBeenCalled()
  })

  it('does not attach listeners when audioContext is null', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    renderHook(() => useAudioContextSuspension(null))

    expect(addSpy).not.toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    )

    addSpy.mockRestore()
  })

  it('auto-resumes when context is suspended mid-session via statechange', async () => {
    const ctx = createMockAudioContext('running')
    // Make resume fail so isSuspendedBySystem stays true
    ctx.resume.mockRejectedValue(new Error('resume failed'))

    renderHook(() => useAudioContextSuspension(ctx))

    // Simulate browser suspending the context
    ctx.state = 'suspended'
    await act(async () => {
      ctx._fireStateChange()
    })

    expect(ctx.resume).toHaveBeenCalled()
    expect(useAudioStore.getState().isSuspendedBySystem).toBe(true)
  })

  it('auto-resumes successfully and clears suspension flag', async () => {
    const ctx = createMockAudioContext('running')
    ctx.resume.mockImplementation(async () => {
      ctx.state = 'running'
    })

    renderHook(() => useAudioContextSuspension(ctx))

    // Simulate browser suspending the context
    ctx.state = 'suspended'
    await act(async () => {
      ctx._fireStateChange()
    })

    expect(ctx.resume).toHaveBeenCalled()
    // After successful resume, flag is cleared
    expect(useAudioStore.getState().isSuspendedBySystem).toBe(false)
  })

  it('clears isSuspendedBySystem after successful resume', async () => {
    const ctx = createMockAudioContext('running')
    ctx.resume.mockImplementation(async () => {
      ctx.state = 'running'
    })

    renderHook(() => useAudioContextSuspension(ctx))

    // Suspend
    ctx.state = 'suspended'
    await act(async () => {
      ctx._fireStateChange()
    })

    expect(useAudioStore.getState().isSuspendedBySystem).toBe(false)
    expect(useAudioStore.getState().resumeFailCount).toBe(0)
  })

  it('retries with exponential backoff on resume failure', async () => {
    const ctx = createMockAudioContext('running')
    let callCount = 0
    ctx.resume.mockImplementation(async () => {
      callCount++
      if (callCount < 3) {
        throw new Error('resume failed')
      }
      ctx.state = 'running'
    })

    renderHook(() => useAudioContextSuspension(ctx))

    // Suspend
    ctx.state = 'suspended'
    await act(async () => {
      ctx._fireStateChange()
    })

    // First retry after 200ms
    expect(useAudioStore.getState().resumeFailCount).toBe(1)

    await act(async () => {
      vi.advanceTimersByTime(200)
    })

    // Second retry after 400ms
    expect(useAudioStore.getState().resumeFailCount).toBe(2)

    await act(async () => {
      vi.advanceTimersByTime(400)
    })

    // Should succeed on third attempt
    expect(callCount).toBe(3)
    expect(useAudioStore.getState().resumeFailCount).toBe(0)
    expect(useAudioStore.getState().isSuspendedBySystem).toBe(false)
  })

  it('stops retrying after MAX_RESUME_RETRIES', async () => {
    const ctx = createMockAudioContext('running')
    ctx.resume.mockRejectedValue(new Error('resume failed'))

    renderHook(() => useAudioContextSuspension(ctx))

    // Suspend
    ctx.state = 'suspended'
    await act(async () => {
      ctx._fireStateChange()
    })

    // Advance through all retries
    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    await act(async () => {
      vi.advanceTimersByTime(400)
    })

    // After 3 failures, should stop retrying
    expect(useAudioStore.getState().resumeFailCount).toBe(3)
    expect(ctx.resume).toHaveBeenCalledTimes(3)
  })

  it('resumes on visibilitychange from hidden to visible', async () => {
    const ctx = createMockAudioContext('running')

    renderHook(() => useAudioContextSuspension(ctx))

    // Simulate context becoming suspended while tab was hidden
    ctx.state = 'suspended'

    // Simulate tab becoming visible
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    })

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(ctx.resume).toHaveBeenCalled()
  })

  it('does not resume on visibilitychange if context was never running', async () => {
    const ctx = createMockAudioContext('suspended')

    renderHook(() => useAudioContextSuspension(ctx))

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    })

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // wasRunningRef is false, so no resume attempt
    expect(ctx.resume).not.toHaveBeenCalled()
  })

  it('manual resume resets retry count and attempts resume', async () => {
    const ctx = createMockAudioContext('suspended')
    ctx.resume.mockImplementation(async () => {
      ctx.state = 'running'
    })

    // Set initial state as if it had been running
    useAudioStore.setState({ resumeFailCount: 2 })

    const { result } = renderHook(() => useAudioContextSuspension(ctx))

    let success
    await act(async () => {
      success = await result.current.resume()
    })

    expect(success).toBe(true)
    expect(ctx.resume).toHaveBeenCalled()
    expect(useAudioStore.getState().resumeFailCount).toBe(0)
  })

  it('manual resume returns true if context is not suspended', async () => {
    const ctx = createMockAudioContext('running')

    const { result } = renderHook(() => useAudioContextSuspension(ctx))

    let success
    await act(async () => {
      success = await result.current.resume()
    })

    expect(success).toBe(true)
    expect(ctx.resume).not.toHaveBeenCalled()
  })

  it('manual resume returns true when audioContext is null', async () => {
    const { result } = renderHook(() => useAudioContextSuspension(null))

    let success
    await act(async () => {
      success = await result.current.resume()
    })

    expect(success).toBe(true)
  })

  it('updates audioContextState when context transitions to closed', async () => {
    const ctx = createMockAudioContext('running')

    renderHook(() => useAudioContextSuspension(ctx))

    ctx.state = 'closed'
    await act(async () => {
      ctx._fireStateChange()
    })

    expect(useAudioStore.getState().audioContextState).toBe('closed')
    expect(useAudioStore.getState().isSuspendedBySystem).toBe(false)
  })

  it('resets isSuspendedBySystem when context resumes to running', async () => {
    const ctx = createMockAudioContext('running')

    renderHook(() => useAudioContextSuspension(ctx))

    // Suspend, then resume
    useAudioStore.setState({ isSuspendedBySystem: true })

    ctx.state = 'running'
    await act(async () => {
      ctx._fireStateChange()
    })

    expect(useAudioStore.getState().isSuspendedBySystem).toBe(false)
    expect(useAudioStore.getState().resumeFailCount).toBe(0)
  })
})
