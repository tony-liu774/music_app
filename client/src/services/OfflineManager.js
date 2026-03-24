/**
 * OfflineManager - IndexedDB-backed offline storage for practice sessions,
 * score library caching, and API call queuing with sync-on-reconnect.
 *
 * Ported from src/js/services/offline-session-manager.js and extended for
 * score library caching, session queuing, and conflict resolution.
 */

const DB_NAME = 'ConcertmasterOffline'
const DB_VERSION = 2

const STORES = {
  sessions: 'sessions',
  syncQueue: 'syncQueue',
  scoreCache: 'scoreCache',
}

const MAX_RETRIES = 5

class OfflineManager {
  constructor(options = {}) {
    this.dbName = options.dbName || DB_NAME
    this.dbVersion = options.dbVersion || DB_VERSION
    this.db = null
    this.listeners = []
  }

  async open() {
    if (this.db) return this.db

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        if (!db.objectStoreNames.contains(STORES.sessions)) {
          const sessionOS = db.createObjectStore(STORES.sessions, {
            keyPath: 'id',
          })
          sessionOS.createIndex('timestamp', 'timestamp', { unique: false })
          sessionOS.createIndex('synced', 'synced', { unique: false })
          sessionOS.createIndex('userId', 'userId', { unique: false })
        }

        if (!db.objectStoreNames.contains(STORES.syncQueue)) {
          const queueOS = db.createObjectStore(STORES.syncQueue, {
            keyPath: 'id',
          })
          queueOS.createIndex('timestamp', 'timestamp', { unique: false })
          queueOS.createIndex('retries', 'retries', { unique: false })
        }

        if (!db.objectStoreNames.contains(STORES.scoreCache)) {
          const cacheOS = db.createObjectStore(STORES.scoreCache, {
            keyPath: 'id',
          })
          cacheOS.createIndex('cachedAt', 'cachedAt', { unique: false })
        }
      }

      request.onsuccess = (event) => {
        this.db = event.target.result
        resolve(this.db)
      }

      request.onerror = (event) => {
        reject(new Error(`IndexedDB open failed: ${event.target.error}`))
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Session storage
  // ---------------------------------------------------------------------------

  async saveSession(session) {
    if (!session || !session.id) {
      throw new Error('Session must have an id')
    }

    const db = await this.open()
    const record = {
      ...session,
      timestamp: session.timestamp || Date.now(),
      synced: false,
      updatedAt: Date.now(),
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.sessions, 'readwrite')
      const store = tx.objectStore(STORES.sessions)
      const request = store.put(record)

      request.onsuccess = () => {
        this._notify('session_saved', record.id)
        resolve(record.id)
      }
      request.onerror = (event) => {
        reject(new Error(`Failed to save session: ${event.target.error}`))
      }
    })
  }

  async getSession(id) {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.sessions, 'readonly')
      const store = tx.objectStore(STORES.sessions)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = (event) =>
        reject(new Error(`Failed to get session: ${event.target.error}`))
    })
  }

  async getUnsyncedSessions(userId) {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.sessions, 'readonly')
      const store = tx.objectStore(STORES.sessions)
      const request = store.getAll()

      request.onsuccess = () => {
        let results = (request.result || []).filter((s) => s.synced === false)
        if (userId) {
          results = results.filter((s) => s.userId === userId)
        }
        resolve(results)
      }
      request.onerror = (event) =>
        reject(
          new Error(`Failed to get unsynced sessions: ${event.target.error}`),
        )
    })
  }

  async getAllSessions(limit = 0, userId) {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.sessions, 'readonly')
      const store = tx.objectStore(STORES.sessions)
      const request = store.getAll()

      request.onsuccess = () => {
        let results = request.result || []
        if (userId) {
          results = results.filter((s) => s.userId === userId)
        }
        results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        if (limit > 0) results = results.slice(0, limit)
        resolve(results)
      }
      request.onerror = (event) =>
        reject(new Error(`Failed to get sessions: ${event.target.error}`))
    })
  }

  async markSynced(id) {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.sessions, 'readwrite')
      const store = tx.objectStore(STORES.sessions)
      const getReq = store.get(id)

      getReq.onsuccess = () => {
        const session = getReq.result
        if (!session) return resolve()

        session.synced = true
        session.syncedAt = Date.now()
        const putReq = store.put(session)
        putReq.onsuccess = () => resolve()
        putReq.onerror = (event) =>
          reject(new Error(`Failed to mark synced: ${event.target.error}`))
      }
      getReq.onerror = (event) =>
        reject(
          new Error(`Failed to get session for sync: ${event.target.error}`),
        )
    })
  }

  async deleteSession(id) {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.sessions, 'readwrite')
      const store = tx.objectStore(STORES.sessions)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = (event) =>
        reject(new Error(`Failed to delete session: ${event.target.error}`))
    })
  }

  // ---------------------------------------------------------------------------
  // Sync queue
  // ---------------------------------------------------------------------------

  async addToSyncQueue(type, data) {
    if (!type || !data) {
      throw new Error('Type and data are required')
    }

    const db = await this.open()
    const item = {
      id: this._generateId(),
      type,
      data,
      timestamp: Date.now(),
      retries: 0,
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.syncQueue, 'readwrite')
      const store = tx.objectStore(STORES.syncQueue)
      const request = store.put(item)

      request.onsuccess = () => resolve(item.id)
      request.onerror = (event) =>
        reject(new Error(`Failed to queue: ${event.target.error}`))
    })
  }

  async getSyncQueue() {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.syncQueue, 'readonly')
      const store = tx.objectStore(STORES.syncQueue)
      const request = store.getAll()

      request.onsuccess = () => {
        const results = request.result || []
        results.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        resolve(results)
      }
      request.onerror = (event) =>
        reject(new Error(`Failed to get sync queue: ${event.target.error}`))
    })
  }

  async removeFromSyncQueue(id) {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.syncQueue, 'readwrite')
      const store = tx.objectStore(STORES.syncQueue)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = (event) =>
        reject(new Error(`Failed to remove from queue: ${event.target.error}`))
    })
  }

  async incrementRetry(id) {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.syncQueue, 'readwrite')
      const store = tx.objectStore(STORES.syncQueue)
      const getReq = store.get(id)

      getReq.onsuccess = () => {
        const item = getReq.result
        if (!item) return resolve()
        item.retries = (item.retries || 0) + 1
        const putReq = store.put(item)
        putReq.onsuccess = () => resolve()
        putReq.onerror = (event) =>
          reject(new Error(`Failed to increment retry: ${event.target.error}`))
      }
      getReq.onerror = (event) =>
        reject(new Error(`Failed to get queue item: ${event.target.error}`))
    })
  }

  async processSyncQueue(uploadFn, maxRetries = MAX_RETRIES) {
    const queue = await this.getSyncQueue()
    let processed = 0
    let failed = 0

    for (const item of queue) {
      if (item.retries >= maxRetries) {
        await this.removeFromSyncQueue(item.id)
        failed++
        continue
      }

      try {
        const success = await uploadFn(item)
        if (success) {
          await this.removeFromSyncQueue(item.id)
          processed++
        } else {
          await this.incrementRetry(item.id)
          failed++
        }
      } catch {
        await this.incrementRetry(item.id)
        failed++
      }
    }

    const remaining = await this.getSyncQueue()
    this._notify('queue_processed', {
      processed,
      failed,
      remaining: remaining.length,
    })
    return { processed, failed, remaining: remaining.length }
  }

  // ---------------------------------------------------------------------------
  // Score library caching
  // ---------------------------------------------------------------------------

  async cacheScore(score) {
    if (!score || !score.id) {
      throw new Error('Score must have an id')
    }

    const db = await this.open()
    const record = {
      ...score,
      cachedAt: Date.now(),
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.scoreCache, 'readwrite')
      const store = tx.objectStore(STORES.scoreCache)
      const request = store.put(record)

      request.onsuccess = () => resolve(record.id)
      request.onerror = (event) =>
        reject(new Error(`Failed to cache score: ${event.target.error}`))
    })
  }

  async cacheScores(scores) {
    if (!Array.isArray(scores)) {
      throw new Error('Scores must be an array')
    }

    const db = await this.open()
    const now = Date.now()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.scoreCache, 'readwrite')
      const store = tx.objectStore(STORES.scoreCache)

      for (const score of scores) {
        if (score && score.id) {
          store.put({ ...score, cachedAt: now })
        }
      }

      tx.oncomplete = () => {
        this._notify('scores_cached', scores.length)
        resolve(scores.length)
      }
      tx.onerror = (event) =>
        reject(new Error(`Failed to cache scores: ${event.target.error}`))
    })
  }

  async getCachedScore(id) {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.scoreCache, 'readonly')
      const store = tx.objectStore(STORES.scoreCache)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = (event) =>
        reject(new Error(`Failed to get cached score: ${event.target.error}`))
    })
  }

  async getCachedScores() {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.scoreCache, 'readonly')
      const store = tx.objectStore(STORES.scoreCache)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = (event) =>
        reject(new Error(`Failed to get cached scores: ${event.target.error}`))
    })
  }

  async removeCachedScore(id) {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.scoreCache, 'readwrite')
      const store = tx.objectStore(STORES.scoreCache)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = (event) =>
        reject(
          new Error(`Failed to remove cached score: ${event.target.error}`),
        )
    })
  }

  // ---------------------------------------------------------------------------
  // Conflict resolution — timestamp-based last-write-wins
  // ---------------------------------------------------------------------------

  async resolveConflict(localSession, remoteSession) {
    if (!localSession || !remoteSession) return localSession || remoteSession

    const localTime = localSession.updatedAt || localSession.timestamp || 0
    const remoteTime = remoteSession.updatedAt || remoteSession.timestamp || 0

    // Last-write-wins: the session with the later timestamp takes precedence
    if (remoteTime > localTime) {
      // Remote wins — update local copy
      await this.saveSession({ ...remoteSession, synced: true })
      return remoteSession
    }
    // Local wins or equal — keep local, mark for sync
    return localSession
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  async clearAll() {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const storeNames = Object.values(STORES)
      const tx = db.transaction(storeNames, 'readwrite')
      for (const name of storeNames) {
        tx.objectStore(name).clear()
      }
      tx.oncomplete = () => resolve()
      tx.onerror = (event) =>
        reject(new Error(`Failed to clear: ${event.target.error}`))
    })
  }

  close() {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  onEvent(callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback)
    }
  }

  _generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 10)
  }

  _notify(event, data) {
    this.listeners.forEach((cb) => cb(event, data))
  }
}

const offlineManager = new OfflineManager()
export { OfflineManager }
export default offlineManager
