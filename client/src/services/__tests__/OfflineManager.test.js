import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OfflineManager } from '../OfflineManager'

// fake-indexeddb ships with jsdom via vitest, but we need a clean instance
// per test via the constructor option for isolation.

let manager

function makeManager() {
  return new OfflineManager({
    dbName: 'TestOffline_' + Math.random().toString(36).slice(2),
    dbVersion: 2,
  })
}

beforeEach(() => {
  manager = makeManager()
})

// ---------------------------------------------------------------------------
// Database init
// ---------------------------------------------------------------------------

describe('OfflineManager - database', () => {
  it('opens the database successfully', async () => {
    const db = await manager.open()
    expect(db).toBeTruthy()
    expect(db.objectStoreNames).toContain('sessions')
    expect(db.objectStoreNames).toContain('syncQueue')
    expect(db.objectStoreNames).toContain('scoreCache')
  })

  it('returns same db on repeated open()', async () => {
    const db1 = await manager.open()
    const db2 = await manager.open()
    expect(db1).toBe(db2)
  })

  it('close() nullifies the db reference', async () => {
    await manager.open()
    manager.close()
    expect(manager.db).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Session storage
// ---------------------------------------------------------------------------

describe('OfflineManager - sessions', () => {
  it('saves and retrieves a session', async () => {
    await manager.saveSession({ id: 's1', scoreId: 'score1', userId: 'u1' })
    const session = await manager.getSession('s1')
    expect(session.id).toBe('s1')
    expect(session.synced).toBe(false)
    expect(session.timestamp).toBeGreaterThan(0)
  })

  it('throws when saving session without id', async () => {
    await expect(manager.saveSession({})).rejects.toThrow('must have an id')
    await expect(manager.saveSession(null)).rejects.toThrow('must have an id')
  })

  it('returns null for missing session', async () => {
    const result = await manager.getSession('nonexistent')
    expect(result).toBeNull()
  })

  it('getAllSessions returns sessions sorted by timestamp desc', async () => {
    await manager.saveSession({ id: 's1', timestamp: 100, userId: 'u1' })
    await manager.saveSession({ id: 's2', timestamp: 300, userId: 'u1' })
    await manager.saveSession({ id: 's3', timestamp: 200, userId: 'u1' })

    const all = await manager.getAllSessions()
    expect(all.map((s) => s.id)).toEqual(['s2', 's3', 's1'])
  })

  it('getAllSessions respects limit', async () => {
    await manager.saveSession({ id: 's1', timestamp: 100 })
    await manager.saveSession({ id: 's2', timestamp: 200 })
    await manager.saveSession({ id: 's3', timestamp: 300 })

    const result = await manager.getAllSessions(2)
    expect(result).toHaveLength(2)
  })

  it('getAllSessions filters by userId', async () => {
    await manager.saveSession({ id: 's1', userId: 'u1' })
    await manager.saveSession({ id: 's2', userId: 'u2' })

    const result = await manager.getAllSessions(0, 'u1')
    expect(result).toHaveLength(1)
    expect(result[0].userId).toBe('u1')
  })

  it('getUnsyncedSessions returns only unsynced', async () => {
    await manager.saveSession({ id: 's1', userId: 'u1' })
    await manager.saveSession({ id: 's2', userId: 'u1' })
    await manager.markSynced('s1')

    const unsynced = await manager.getUnsyncedSessions('u1')
    expect(unsynced).toHaveLength(1)
    expect(unsynced[0].id).toBe('s2')
  })

  it('getUnsyncedSessions filters by userId', async () => {
    await manager.saveSession({ id: 's1', userId: 'u1' })
    await manager.saveSession({ id: 's2', userId: 'u2' })

    const result = await manager.getUnsyncedSessions('u1')
    expect(result).toHaveLength(1)
    expect(result[0].userId).toBe('u1')
  })

  it('markSynced sets synced flag and syncedAt', async () => {
    await manager.saveSession({ id: 's1' })
    await manager.markSynced('s1')

    const session = await manager.getSession('s1')
    expect(session.synced).toBe(true)
    expect(session.syncedAt).toBeGreaterThan(0)
  })

  it('markSynced on nonexistent id resolves without error', async () => {
    await expect(manager.markSynced('nope')).resolves.toBeUndefined()
  })

  it('deleteSession removes the session', async () => {
    await manager.saveSession({ id: 's1' })
    await manager.deleteSession('s1')
    const result = await manager.getSession('s1')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Sync queue
// ---------------------------------------------------------------------------

describe('OfflineManager - sync queue', () => {
  it('adds and retrieves queue items', async () => {
    const id1 = await manager.addToSyncQueue('session', { foo: 1 })
    const id2 = await manager.addToSyncQueue('debrief', { bar: 2 })

    expect(id1).toBeTruthy()
    expect(id2).toBeTruthy()

    const queue = await manager.getSyncQueue()
    expect(queue).toHaveLength(2)
    const types = queue.map((q) => q.type).sort()
    expect(types).toEqual(['debrief', 'session'])
  })

  it('throws when type or data is missing', async () => {
    await expect(manager.addToSyncQueue(null, {})).rejects.toThrow(
      'Type and data are required',
    )
    await expect(manager.addToSyncQueue('session', null)).rejects.toThrow(
      'Type and data are required',
    )
  })

  it('removeFromSyncQueue removes an item', async () => {
    const id = await manager.addToSyncQueue('session', { x: 1 })
    await manager.removeFromSyncQueue(id)

    const queue = await manager.getSyncQueue()
    expect(queue).toHaveLength(0)
  })

  it('incrementRetry bumps the retry count', async () => {
    const id = await manager.addToSyncQueue('session', { x: 1 })
    await manager.incrementRetry(id)
    await manager.incrementRetry(id)

    const queue = await manager.getSyncQueue()
    expect(queue[0].retries).toBe(2)
  })

  it('processSyncQueue uploads items and removes successes', async () => {
    await manager.addToSyncQueue('session', { x: 1 })
    await manager.addToSyncQueue('session', { x: 2 })

    const uploadFn = vi.fn().mockResolvedValue(true)
    const result = await manager.processSyncQueue(uploadFn)

    expect(result.processed).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.remaining).toBe(0)
    expect(uploadFn).toHaveBeenCalledTimes(2)
  })

  it('processSyncQueue increments retry on failure', async () => {
    await manager.addToSyncQueue('session', { x: 1 })

    const uploadFn = vi.fn().mockResolvedValue(false)
    const result = await manager.processSyncQueue(uploadFn)

    expect(result.processed).toBe(0)
    expect(result.failed).toBe(1)
    expect(result.remaining).toBe(1)
  })

  it('processSyncQueue discards items exceeding maxRetries', async () => {
    const id = await manager.addToSyncQueue('session', { x: 1 })
    // Manually set retries to max
    for (let i = 0; i < 5; i++) {
      await manager.incrementRetry(id)
    }

    const uploadFn = vi.fn()
    const result = await manager.processSyncQueue(uploadFn)

    expect(result.failed).toBe(1)
    expect(result.remaining).toBe(0)
    expect(uploadFn).not.toHaveBeenCalled()
  })

  it('processSyncQueue handles thrown errors gracefully', async () => {
    await manager.addToSyncQueue('session', { x: 1 })

    const uploadFn = vi.fn().mockRejectedValue(new Error('Network error'))
    const result = await manager.processSyncQueue(uploadFn)

    expect(result.failed).toBe(1)
    expect(result.remaining).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Score caching
// ---------------------------------------------------------------------------

describe('OfflineManager - score cache', () => {
  it('caches and retrieves a single score', async () => {
    await manager.cacheScore({ id: 'sc1', title: 'Sonata' })
    const result = await manager.getCachedScore('sc1')
    expect(result.title).toBe('Sonata')
    expect(result.cachedAt).toBeGreaterThan(0)
  })

  it('throws when caching score without id', async () => {
    await expect(manager.cacheScore({})).rejects.toThrow('must have an id')
    await expect(manager.cacheScore(null)).rejects.toThrow('must have an id')
  })

  it('cacheScores batch-caches multiple scores', async () => {
    await manager.cacheScores([
      { id: 'sc1', title: 'A' },
      { id: 'sc2', title: 'B' },
    ])

    const all = await manager.getCachedScores()
    expect(all).toHaveLength(2)
  })

  it('cacheScores throws for non-array', async () => {
    await expect(manager.cacheScores('bad')).rejects.toThrow('must be an array')
  })

  it('cacheScores skips entries without id', async () => {
    await manager.cacheScores([{ id: 'sc1', title: 'A' }, { title: 'No ID' }])
    const all = await manager.getCachedScores()
    expect(all).toHaveLength(1)
  })

  it('getCachedScore returns null for missing id', async () => {
    const result = await manager.getCachedScore('nope')
    expect(result).toBeNull()
  })

  it('removeCachedScore removes a score', async () => {
    await manager.cacheScore({ id: 'sc1', title: 'A' })
    await manager.removeCachedScore('sc1')
    const result = await manager.getCachedScore('sc1')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Conflict resolution
// ---------------------------------------------------------------------------

describe('OfflineManager - conflict resolution', () => {
  it('remote wins when its updatedAt is later', async () => {
    const local = { id: 's1', updatedAt: 100, data: 'local' }
    const remote = { id: 's1', updatedAt: 200, data: 'remote' }

    const winner = await manager.resolveConflict(local, remote)
    expect(winner.data).toBe('remote')
  })

  it('local wins when its updatedAt is later', async () => {
    const local = { id: 's1', updatedAt: 300, data: 'local' }
    const remote = { id: 's1', updatedAt: 200, data: 'remote' }

    const winner = await manager.resolveConflict(local, remote)
    expect(winner.data).toBe('local')
  })

  it('local wins on equal timestamps', async () => {
    const local = { id: 's1', updatedAt: 200, data: 'local' }
    const remote = { id: 's1', updatedAt: 200, data: 'remote' }

    const winner = await manager.resolveConflict(local, remote)
    expect(winner.data).toBe('local')
  })

  it('falls back to timestamp when updatedAt is missing', async () => {
    const local = { id: 's1', timestamp: 100 }
    const remote = { id: 's1', timestamp: 200 }

    const winner = await manager.resolveConflict(local, remote)
    expect(winner.timestamp).toBe(200)
  })

  it('returns the non-null session if one is null', async () => {
    const session = { id: 's1', data: 'x' }
    expect(await manager.resolveConflict(session, null)).toBe(session)
    expect(await manager.resolveConflict(null, session)).toBe(session)
  })
})

// ---------------------------------------------------------------------------
// clearAll
// ---------------------------------------------------------------------------

describe('OfflineManager - clearAll', () => {
  it('clears all stores', async () => {
    await manager.saveSession({ id: 's1' })
    await manager.addToSyncQueue('session', { x: 1 })
    await manager.cacheScore({ id: 'sc1', title: 'X' })

    await manager.clearAll()

    expect(await manager.getAllSessions()).toHaveLength(0)
    expect(await manager.getSyncQueue()).toHaveLength(0)
    expect(await manager.getCachedScores()).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

describe('OfflineManager - events', () => {
  it('onEvent notifies listeners on session_saved', async () => {
    const listener = vi.fn()
    manager.onEvent(listener)

    await manager.saveSession({ id: 's1' })
    expect(listener).toHaveBeenCalledWith('session_saved', 's1')
  })

  it('unsubscribe removes the listener', async () => {
    const listener = vi.fn()
    const unsub = manager.onEvent(listener)
    unsub()

    await manager.saveSession({ id: 's1' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('onEvent notifies on queue_processed', async () => {
    const listener = vi.fn()
    manager.onEvent(listener)

    await manager.addToSyncQueue('session', { x: 1 })
    await manager.processSyncQueue(() => true)

    expect(listener).toHaveBeenCalledWith(
      'queue_processed',
      expect.objectContaining({ processed: 1, failed: 0, remaining: 0 }),
    )
  })

  it('onEvent notifies on scores_cached', async () => {
    const listener = vi.fn()
    manager.onEvent(listener)

    await manager.cacheScores([{ id: 'sc1', title: 'A' }])
    expect(listener).toHaveBeenCalledWith('scores_cached', 1)
  })
})
