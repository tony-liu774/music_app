import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock OfflineManager
vi.mock('../../services/OfflineManager', () => {
  const getSyncQueue = vi.fn().mockResolvedValue([])
  const addToSyncQueue = vi.fn().mockResolvedValue('q-id-1')
  const saveSession = vi.fn().mockResolvedValue('s-id-1')
  const processSyncQueue = vi.fn().mockResolvedValue({
    processed: 0,
    failed: 0,
    remaining: 0,
  })

  return {
    default: {
      getSyncQueue,
      addToSyncQueue,
      saveSession,
      processSyncQueue,
    },
  }
})

import { useOffline } from '../useOffline'
import offlineManager from '../../services/OfflineManager'

describe('useOffline', () => {
  let onlineGetter

  beforeEach(() => {
    vi.clearAllMocks()
    onlineGetter = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  })

  afterEach(() => {
    onlineGetter.mockRestore()
  })

  it('reports online when navigator.onLine is true', () => {
    const { result } = renderHook(() => useOffline())
    expect(result.current.isOnline).toBe(true)
  })

  it('reports offline when navigator.onLine is false', () => {
    onlineGetter.mockReturnValue(false)
    const { result } = renderHook(() => useOffline())
    expect(result.current.isOnline).toBe(false)
  })

  it('transitions to offline on offline event', async () => {
    const { result } = renderHook(() => useOffline())

    await act(async () => {
      onlineGetter.mockReturnValue(false)
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current.isOnline).toBe(false)
  })

  it('transitions to online on online event and triggers sync', async () => {
    onlineGetter.mockReturnValue(false)
    const { result } = renderHook(() => useOffline())

    offlineManager.processSyncQueue.mockResolvedValue({
      processed: 2,
      failed: 0,
      remaining: 0,
    })

    await act(async () => {
      onlineGetter.mockReturnValue(true)
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current.isOnline).toBe(true)
    expect(offlineManager.processSyncQueue).toHaveBeenCalled()
  })

  it('queueSessionData queues data and saves session', async () => {
    const { result } = renderHook(() => useOffline())

    await act(async () => {
      await result.current.queueSessionData({
        id: 's1',
        scoreId: 'score1',
      })
    })

    expect(offlineManager.addToSyncQueue).toHaveBeenCalledWith('session', {
      id: 's1',
      scoreId: 'score1',
    })
    expect(offlineManager.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1' }),
    )
    expect(result.current.pendingCount).toBe(1)
  })

  it('queueDebriefRequest queues debrief data', async () => {
    const { result } = renderHook(() => useOffline())

    await act(async () => {
      await result.current.queueDebriefRequest({ sessionId: 's1' })
    })

    expect(offlineManager.addToSyncQueue).toHaveBeenCalledWith('debrief', {
      sessionId: 's1',
    })
    expect(result.current.pendingCount).toBe(1)
  })

  it('processQueue calls processSyncQueue and refreshes count', async () => {
    offlineManager.processSyncQueue.mockResolvedValue({
      processed: 1,
      failed: 0,
      remaining: 0,
    })

    const { result } = renderHook(() => useOffline())

    let syncResult
    await act(async () => {
      syncResult = await result.current.processQueue()
    })

    expect(syncResult.processed).toBe(1)
    expect(offlineManager.getSyncQueue).toHaveBeenCalled()
  })

  it('uses custom onSync callback when provided', async () => {
    const customSync = vi.fn().mockResolvedValue(true)
    offlineManager.processSyncQueue.mockResolvedValue({
      processed: 1,
      failed: 0,
      remaining: 0,
    })

    const { result } = renderHook(() => useOffline({ onSync: customSync }))

    await act(async () => {
      await result.current.processQueue()
    })

    expect(offlineManager.processSyncQueue).toHaveBeenCalled()
    const uploadFn = offlineManager.processSyncQueue.mock.calls[0][0]
    expect(uploadFn).toBe(customSync)
  })

  it('shows toast on sync when toast is provided', async () => {
    const mockToast = { addToast: vi.fn() }
    offlineManager.processSyncQueue.mockResolvedValue({
      processed: 3,
      failed: 0,
      remaining: 0,
    })

    const { result } = renderHook(() => useOffline({ toast: mockToast }))

    await act(async () => {
      await result.current.processQueue()
    })

    expect(mockToast.addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'success',
        message: 'Synced 3 items',
      }),
    )
  })

  it('cleans up event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useOffline())

    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function))

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function))

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('isSyncing is true during processQueue', async () => {
    let resolveSync
    offlineManager.processSyncQueue.mockImplementation(
      () =>
        new Promise((r) => {
          resolveSync = r
        }),
    )

    const { result } = renderHook(() => useOffline())

    let promise
    act(() => {
      promise = result.current.processQueue()
    })

    expect(result.current.isSyncing).toBe(true)

    await act(async () => {
      resolveSync({ processed: 0, failed: 0, remaining: 0 })
      await promise
    })

    expect(result.current.isSyncing).toBe(false)
  })
})
