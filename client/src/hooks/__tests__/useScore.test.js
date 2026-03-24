import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import useScore, { clearScoreCache } from '../useScore'

// Mock the parser
vi.mock('../../services/MusicXMLParser', () => ({
  parseMusicXML: vi.fn((xml) => {
    if (xml.includes('bad')) throw new Error('Parse error')
    return { title: 'Parsed', composer: 'Test', parts: [] }
  }),
}))

const MOCK_XML = '<?xml version="1.0"?><score-partwise><part></part></score-partwise>'

describe('useScore', () => {
  beforeEach(() => {
    clearScoreCache()
    vi.restoreAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null score when source is null', () => {
    const { result } = renderHook(() => useScore(null))
    expect(result.current.score).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('parses raw XML when isRaw is true', async () => {
    const { result } = renderHook(() =>
      useScore(MOCK_XML, { isRaw: true }),
    )

    await waitFor(() => {
      expect(result.current.score).not.toBeNull()
    })
    expect(result.current.score.title).toBe('Parsed')
    expect(result.current.isLoading).toBe(false)
  })

  it('fetches and parses URL when isRaw is false', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(MOCK_XML),
    })

    const { result } = renderHook(() =>
      useScore('https://example.com/score.xml'),
    )

    await waitFor(() => {
      expect(result.current.score).not.toBeNull()
    })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/score.xml',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(result.current.score.title).toBe('Parsed')
  })

  it('sets error on fetch failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })

    const { result } = renderHook(() =>
      useScore('https://example.com/missing.xml'),
    )

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })
    expect(result.current.error).toContain('404')
    expect(result.current.score).toBeNull()
  })

  it('sets error on parse failure', async () => {
    const { result } = renderHook(() =>
      useScore('bad-xml-content', { isRaw: true }),
    )

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })
    expect(result.current.error).toContain('Parse error')
  })

  it('uses cache on second load of same URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(MOCK_XML),
    })

    const { result, rerender } = renderHook(
      ({ url }) => useScore(url),
      { initialProps: { url: 'https://example.com/cached.xml' } },
    )

    await waitFor(() => {
      expect(result.current.score).not.toBeNull()
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)

    // Re-render with same URL — should use cache
    rerender({ url: 'https://example.com/cached.xml' })
    expect(global.fetch).toHaveBeenCalledTimes(1) // no additional fetch
    expect(result.current.score.title).toBe('Parsed')
  })

  it('refetch clears cache and re-loads', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(MOCK_XML),
    })

    const { result } = renderHook(() =>
      useScore('https://example.com/refetch.xml'),
    )

    await waitFor(() => {
      expect(result.current.score).not.toBeNull()
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  it('clears score when source changes to null', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(MOCK_XML),
    })

    const { result, rerender } = renderHook(
      ({ url }) => useScore(url),
      { initialProps: { url: 'https://example.com/score.xml' } },
    )

    await waitFor(() => {
      expect(result.current.score).not.toBeNull()
    })

    rerender({ url: null })
    expect(result.current.score).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('aborts previous fetch when source changes', async () => {
    const abortSpy = vi.fn()
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      opts?.signal?.addEventListener('abort', abortSpy)
      return new Promise((resolve) =>
        setTimeout(
          () => resolve({ ok: true, text: () => Promise.resolve(MOCK_XML) }),
          100,
        ),
      )
    })

    const { rerender } = renderHook(
      ({ url }) => useScore(url),
      { initialProps: { url: 'https://example.com/first.xml' } },
    )

    // Quickly change URL before first fetch completes
    rerender({ url: 'https://example.com/second.xml' })

    await waitFor(() => {
      expect(abortSpy).toHaveBeenCalled()
    })
  })
})
