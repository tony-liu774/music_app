/**
 * Library Service - IndexedDB-based score library management
 * Ported from src/js/services/library-service.js for React/Zustand integration
 */

class LibraryService {
  constructor() {
    this.dbName = 'ConcertmasterLibrary'
    this.dbVersion = 2
    this.db = null
  }

  async init() {
    if (this.db) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => reject(request.error)

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        if (!db.objectStoreNames.contains('scores')) {
          const scoresStore = db.createObjectStore('scores', { keyPath: 'id' })
          scoresStore.createIndex('title', 'title', { unique: false })
          scoresStore.createIndex('composer', 'composer', { unique: false })
          scoresStore.createIndex('instrument', 'instrument', { unique: false })
          scoresStore.createIndex('addedAt', 'addedAt', { unique: false })
        }

        if (!db.objectStoreNames.contains('thumbnails')) {
          db.createObjectStore('thumbnails', { keyPath: 'scoreId' })
        }
      }
    })
  }

  async getAllScores() {
    await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['scores'], 'readonly')
      const store = transaction.objectStore('scores')
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  async getScore(id) {
    await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['scores'], 'readonly')
      const store = transaction.objectStore('scores')
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async addScore(score) {
    await this.init()
    return new Promise((resolve, reject) => {
      const newScore = {
        ...score,
        id: score.id || crypto.randomUUID(),
        addedAt: score.addedAt || new Date().toISOString(),
        lastPracticed: score.lastPracticed || null,
        practiceCount: score.practiceCount || 0,
        difficulty: score.difficulty || 3,
      }

      const transaction = this.db.transaction(['scores'], 'readwrite')
      const store = transaction.objectStore('scores')
      const request = store.add(newScore)

      request.onsuccess = () => resolve(newScore)
      request.onerror = () => reject(request.error)
    })
  }

  async updateScore(id, updates) {
    await this.init()
    const existing = await this.getScore(id)
    if (!existing) throw new Error('Score not found')

    const updated = { ...existing, ...updates }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['scores'], 'readwrite')
      const store = transaction.objectStore('scores')
      const request = store.put(updated)

      request.onsuccess = () => resolve(updated)
      request.onerror = () => reject(request.error)
    })
  }

  async deleteScore(id) {
    await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        ['scores', 'thumbnails'],
        'readwrite',
      )
      transaction.objectStore('scores').delete(id)
      transaction.objectStore('thumbnails').delete(id)

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async recordPractice(id) {
    const score = await this.getScore(id)
    if (!score) throw new Error('Score not found')

    return this.updateScore(id, {
      lastPracticed: new Date().toISOString(),
      practiceCount: (score.practiceCount || 0) + 1,
    })
  }

  async saveThumbnail(scoreId, thumbnailData) {
    await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['thumbnails'], 'readwrite')
      const store = transaction.objectStore('thumbnails')
      const request = store.put({ scoreId, data: thumbnailData })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getThumbnail(scoreId) {
    await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['thumbnails'], 'readonly')
      const store = transaction.objectStore('thumbnails')
      const request = store.get(scoreId)

      request.onsuccess = () => resolve(request.result?.data || null)
      request.onerror = () => reject(request.error)
    })
  }
}

const libraryService = new LibraryService()
export default libraryService
