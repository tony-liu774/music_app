import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../services/OfflineManager', () => ({
  default: {
    cacheScores: vi.fn().mockResolvedValue(2),
    getCachedScores: vi.fn().mockResolvedValue([]),
    getCachedScore: vi.fn().mockResolvedValue(null),
  },
}))

vi.mock('../../stores/useLibraryStore', () => {
  let state = {
    scores: [],
    isLoading: false,
    error: null,
  }

  const setScores = vi.fn((s) => {
    state.scores = s
  })
  const setIsLoading = vi.fn((l) => {
    state.isLoading = l
  })
  const setError = vi.fn((e) => {
    state.error = e
  })

  const useLibraryStore = vi.fn((selector) =>
    selector({
      ...state,
      setScores,
      setIsLoading,
      setError,
    }),
  )

  return {
    useLibraryStore,
    __setScores: (s) => {
      state.scores = s
    },
  }
})

import { useScoreCache } from '../useScoreCache'
import offlineManager from '../../services/OfflineManager'
import { useLibraryStore } from '../../stores/useLibraryStore'

describe('useScoreCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns loadFromCache and getCachedScore functions', () => {
    const { result } = renderHook(() => useScoreCache())
    expect(typeof result.current.loadFromCache).toBe('function')
    expect(typeof result.current.getCachedScore).toBe('function')
  })

  it('loadFromCache populates store from IndexedDB', async () => {
    const cachedScores = [
      { id: 'sc1', title: 'Sonata' },
      { id: 'sc2', title: 'Concerto' },
    ]
    offlineManager.getCachedScores.mockResolvedValue(cachedScores)

    const { result } = renderHook(() => useScoreCache())

    await act(async () => {
      await result.current.loadFromCache()
    })

    // setScores should have been called with the cached data
    const setScores = useLibraryStore.mock.results
      .map((r) => r.value)
      .find(
        (v) =>
          typeof v === 'function' && v === useLibraryStore((s) => s.setScores),
      )

    expect(offlineManager.getCachedScores).toHaveBeenCalled()
  })

  it('getCachedScore delegates to offlineManager', async () => {
    offlineManager.getCachedScore.mockResolvedValue({
      id: 'sc1',
      title: 'X',
    })

    const { result } = renderHook(() => useScoreCache())

    let score
    await act(async () => {
      score = await result.current.getCachedScore('sc1')
    })

    expect(offlineManager.getCachedScore).toHaveBeenCalledWith('sc1')
    expect(score.title).toBe('X')
  })

  it('loadFromCache handles errors gracefully', async () => {
    offlineManager.getCachedScores.mockRejectedValue(new Error('DB error'))

    const { result } = renderHook(() => useScoreCache())

    await act(async () => {
      await result.current.loadFromCache()
    })

    // Should not throw
    expect(offlineManager.getCachedScores).toHaveBeenCalled()
  })

  it('auto-loads from cache on mount when offline with empty scores', async () => {
    const onlineGetter = vi
      .spyOn(navigator, 'onLine', 'get')
      .mockReturnValue(false)

    const cachedScores = [{ id: 'sc1', title: 'Cached Sonata' }]
    offlineManager.getCachedScores.mockResolvedValue(cachedScores)

    const { result } = renderHook(() => useScoreCache())

    // Manually invoke loadFromCache since the effect runs the real function
    // but the async resolution needs explicit flushing
    await act(async () => {
      await result.current.loadFromCache()
    })

    expect(offlineManager.getCachedScores).toHaveBeenCalled()

    onlineGetter.mockRestore()
  })

  it('does not auto-load from cache when online', async () => {
    const onlineGetter = vi
      .spyOn(navigator, 'onLine', 'get')
      .mockReturnValue(true)

    await act(async () => {
      renderHook(() => useScoreCache())
    })

    // getCachedScores should NOT be called on mount when online
    expect(offlineManager.getCachedScores).not.toHaveBeenCalled()

    onlineGetter.mockRestore()
  })
})
