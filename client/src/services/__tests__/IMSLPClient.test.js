import { describe, it, expect, beforeEach, vi } from 'vitest'

// We test the class, not the singleton, to avoid shared state
describe('IMSLPClient', () => {
  let client

  beforeEach(async () => {
    vi.resetModules()
    global.fetch = vi.fn()
    // Re-import to get a fresh module
    const mod = await import('../IMSLPClient')
    client = mod.default
  })

  describe('search', () => {
    it('sends POST request with query and instrument', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: '1', title: 'Test' }]),
      })

      const results = await client.search('Bach', 'violin')

      expect(global.fetch).toHaveBeenCalledWith('/api/imslp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Bach', instrument: 'violin' }),
      })
      expect(results).toEqual([{ id: '1', title: 'Test' }])
    })

    it('sends null instrument when not provided', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })

      await client.search('Mozart')

      expect(global.fetch).toHaveBeenCalledWith('/api/imslp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Mozart', instrument: null }),
      })
    })

    it('throws on non-ok response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Rate limited' }),
      })

      await expect(client.search('test')).rejects.toThrow('Rate limited')
    })

    it('throws default message when response has no message', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new Error('parse error')),
      })

      await expect(client.search('test')).rejects.toThrow('IMSLP search failed')
    })
  })

  describe('download', () => {
    it('fetches blob for a given score ID', async () => {
      const mockBlob = new Blob(['pdf content'])
      global.fetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      })

      const result = await client.download('abc123')

      expect(global.fetch).toHaveBeenCalledWith('/api/imslp/download/abc123')
      expect(result).toEqual(mockBlob)
    })

    it('throws on non-ok download response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Not found' }),
      })

      await expect(client.download('bad-id')).rejects.toThrow('Not found')
    })
  })
})
