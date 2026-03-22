/**
 * OfflineSessionManager - IndexedDB-backed offline storage for DSP session logs
 * Ensures practice sessions are fully tracked even without internet connectivity.
 * Queues session data for upload when the connection is restored.
 */

class OfflineSessionManager {
    constructor(options = {}) {
        this.dbName = options.dbName || 'ConcertmasterOffline';
        this.dbVersion = options.dbVersion || 1;
        this.sessionStore = 'sessions';
        this.syncQueueStore = 'syncQueue';
        this.db = null;
        this.listeners = [];
        this._onlineHandler = null;
        this._offlineHandler = null;
        this._isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    }

    /**
     * Open (or create) the IndexedDB database
     * @returns {Promise<IDBDatabase>}
     */
    async open() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Session store: complete practice session records
                if (!db.objectStoreNames.contains(this.sessionStore)) {
                    const sessionOS = db.createObjectStore(this.sessionStore, { keyPath: 'id' });
                    sessionOS.createIndex('timestamp', 'timestamp', { unique: false });
                    sessionOS.createIndex('synced', 'synced', { unique: false });
                    sessionOS.createIndex('userId', 'userId', { unique: false });
                }

                // Sync queue: items waiting to be uploaded
                if (!db.objectStoreNames.contains(this.syncQueueStore)) {
                    const queueOS = db.createObjectStore(this.syncQueueStore, { keyPath: 'id' });
                    queueOS.createIndex('timestamp', 'timestamp', { unique: false });
                    queueOS.createIndex('retries', 'retries', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                reject(new Error(`IndexedDB open failed: ${event.target.error}`));
            };
        });
    }

    /**
     * Start listening for online/offline events and auto-sync on reconnect
     * @param {Function} syncCallback - Called when connection is restored
     */
    startNetworkListener(syncCallback) {
        if (typeof window === 'undefined') return;

        this._onlineHandler = async () => {
            this._isOnline = true;
            this._notifyListeners('online', null);
            if (syncCallback) {
                try {
                    await syncCallback();
                } catch (e) {
                    this._notifyListeners('sync_error', e.message);
                }
            }
        };

        this._offlineHandler = () => {
            this._isOnline = false;
            this._notifyListeners('offline', null);
        };

        window.addEventListener('online', this._onlineHandler);
        window.addEventListener('offline', this._offlineHandler);
    }

    /**
     * Stop listening for network events
     */
    stopNetworkListener() {
        if (typeof window === 'undefined') return;
        if (this._onlineHandler) {
            window.removeEventListener('online', this._onlineHandler);
        }
        if (this._offlineHandler) {
            window.removeEventListener('offline', this._offlineHandler);
        }
        this._onlineHandler = null;
        this._offlineHandler = null;
    }

    /**
     * Check if the device is currently online
     * @returns {boolean}
     */
    isOnline() {
        return this._isOnline;
    }

    /**
     * Save a practice session to IndexedDB
     * @param {Object} session - Session data (must have an id)
     * @returns {Promise<string>} Session ID
     */
    async saveSession(session) {
        if (!session || !session.id) {
            throw new Error('Session must have an id');
        }

        const db = await this.open();
        const record = {
            ...session,
            timestamp: session.timestamp || Date.now(),
            synced: false,
            updatedAt: Date.now()
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.sessionStore, 'readwrite');
            const store = tx.objectStore(this.sessionStore);
            const request = store.put(record);

            request.onsuccess = () => {
                this._notifyListeners('session_saved', record.id);
                resolve(record.id);
            };
            request.onerror = (event) => {
                reject(new Error(`Failed to save session: ${event.target.error}`));
            };
        });
    }

    /**
     * Get a session by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getSession(id) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.sessionStore, 'readonly');
            const store = tx.objectStore(this.sessionStore);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = (event) => reject(new Error(`Failed to get session: ${event.target.error}`));
        });
    }

    /**
     * Get all unsynced sessions, optionally filtered by userId.
     * When userId is provided, only returns sessions belonging to that user,
     * preventing cross-user data leakage on shared devices.
     * @param {string} [userId] - Optional user ID to filter by
     * @returns {Promise<Array>}
     */
    async getUnsyncedSessions(userId) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.sessionStore, 'readonly');
            const store = tx.objectStore(this.sessionStore);
            const index = store.index('synced');
            const request = index.getAll(false);

            request.onsuccess = () => {
                let results = request.result || [];
                if (userId) {
                    results = results.filter(s => s.userId === userId);
                }
                resolve(results);
            };
            request.onerror = (event) => reject(new Error(`Failed to get unsynced sessions: ${event.target.error}`));
        });
    }

    /**
     * Get all sessions, ordered by timestamp descending.
     * When userId is provided, only returns sessions belonging to that user,
     * preventing cross-user data leakage on shared devices.
     * @param {number} limit - Max sessions to return (0 = all)
     * @param {string} [userId] - Optional user ID to filter by
     * @returns {Promise<Array>}
     */
    async getAllSessions(limit = 0, userId) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.sessionStore, 'readonly');
            const store = tx.objectStore(this.sessionStore);
            const request = store.getAll();

            request.onsuccess = () => {
                let results = request.result || [];
                if (userId) {
                    results = results.filter(s => s.userId === userId);
                }
                results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                if (limit > 0) results = results.slice(0, limit);
                resolve(results);
            };
            request.onerror = (event) => reject(new Error(`Failed to get sessions: ${event.target.error}`));
        });
    }

    /**
     * Mark a session as synced using a single atomic readwrite transaction
     * to prevent lost updates from concurrent writes.
     * @param {string} id
     * @returns {Promise<void>}
     */
    async markSynced(id) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.sessionStore, 'readwrite');
            const store = tx.objectStore(this.sessionStore);
            const getReq = store.get(id);

            getReq.onsuccess = () => {
                const session = getReq.result;
                if (!session) return resolve();

                session.synced = true;
                session.syncedAt = Date.now();
                const putReq = store.put(session);
                putReq.onsuccess = () => resolve();
                putReq.onerror = (event) => reject(new Error(`Failed to mark synced: ${event.target.error}`));
            };
            getReq.onerror = (event) => reject(new Error(`Failed to get session for sync: ${event.target.error}`));
        });
    }

    /**
     * Add an item to the sync queue for later upload
     * @param {string} type - Data type (e.g., 'session', 'progress')
     * @param {Object} data - Payload
     * @returns {Promise<string>} Queue item ID
     */
    async addToSyncQueue(type, data) {
        if (!type || !data) {
            throw new Error('Type and data are required');
        }

        const db = await this.open();
        const item = {
            id: this._generateId(),
            type,
            data,
            timestamp: Date.now(),
            retries: 0
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.syncQueueStore, 'readwrite');
            const store = tx.objectStore(this.syncQueueStore);
            const request = store.put(item);

            request.onsuccess = () => resolve(item.id);
            request.onerror = (event) => reject(new Error(`Failed to queue: ${event.target.error}`));
        });
    }

    /**
     * Get all items in the sync queue
     * @returns {Promise<Array>}
     */
    async getSyncQueue() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.syncQueueStore, 'readonly');
            const store = tx.objectStore(this.syncQueueStore);
            const request = store.getAll();

            request.onsuccess = () => {
                const results = request.result || [];
                results.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                resolve(results);
            };
            request.onerror = (event) => reject(new Error(`Failed to get sync queue: ${event.target.error}`));
        });
    }

    /**
     * Remove an item from the sync queue (after successful upload)
     * @param {string} id
     * @returns {Promise<void>}
     */
    async removeFromSyncQueue(id) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.syncQueueStore, 'readwrite');
            const store = tx.objectStore(this.syncQueueStore);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(new Error(`Failed to remove from queue: ${event.target.error}`));
        });
    }

    /**
     * Increment retry count for a queue item
     * @param {string} id
     * @returns {Promise<void>}
     */
    async incrementRetry(id) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.syncQueueStore, 'readwrite');
            const store = tx.objectStore(this.syncQueueStore);
            const getReq = store.get(id);

            getReq.onsuccess = () => {
                const item = getReq.result;
                if (!item) return resolve();
                item.retries = (item.retries || 0) + 1;
                const putReq = store.put(item);
                putReq.onsuccess = () => resolve();
                putReq.onerror = (event) => reject(new Error(`Failed to increment retry: ${event.target.error}`));
            };
            getReq.onerror = (event) => reject(new Error(`Failed to get queue item: ${event.target.error}`));
        });
    }

    /**
     * Process the sync queue: attempt to upload each item
     * @param {Function} uploadFn - async function(item) that uploads; returns true on success
     * @param {number} maxRetries - Max retry attempts before discarding
     * @returns {Promise<Object>} { processed, failed, remaining }
     */
    async processSyncQueue(uploadFn, maxRetries = 5) {
        const queue = await this.getSyncQueue();
        let processed = 0;
        let failed = 0;

        for (const item of queue) {
            if (item.retries >= maxRetries) {
                await this.removeFromSyncQueue(item.id);
                failed++;
                continue;
            }

            try {
                const success = await uploadFn(item);
                if (success) {
                    await this.removeFromSyncQueue(item.id);
                    processed++;
                } else {
                    await this.incrementRetry(item.id);
                    failed++;
                }
            } catch {
                await this.incrementRetry(item.id);
                failed++;
            }
        }

        const remaining = await this.getSyncQueue();
        this._notifyListeners('queue_processed', { processed, failed, remaining: remaining.length });
        return { processed, failed, remaining: remaining.length };
    }

    /**
     * Delete a session by ID
     * @param {string} id
     * @returns {Promise<void>}
     */
    async deleteSession(id) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.sessionStore, 'readwrite');
            const store = tx.objectStore(this.sessionStore);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(new Error(`Failed to delete session: ${event.target.error}`));
        });
    }

    /**
     * Clear all data (for testing or account reset)
     * @returns {Promise<void>}
     */
    async clearAll() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([this.sessionStore, this.syncQueueStore], 'readwrite');
            tx.objectStore(this.sessionStore).clear();
            tx.objectStore(this.syncQueueStore).clear();

            tx.oncomplete = () => resolve();
            tx.onerror = (event) => reject(new Error(`Failed to clear: ${event.target.error}`));
        });
    }

    /**
     * Close the database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        this.stopNetworkListener();
    }

    /**
     * Subscribe to events
     * @param {Function} callback - Called with (event, data)
     * @returns {Function} Unsubscribe function
     */
    onEvent(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    /**
     * Generate a unique ID
     * @returns {string}
     * @private
     */
    _generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
    }

    /**
     * Notify listeners
     * @param {string} event
     * @param {*} data
     * @private
     */
    _notifyListeners(event, data) {
        this.listeners.forEach(cb => cb(event, data));
    }
}

if (typeof window !== 'undefined') {
    window.OfflineSessionManager = OfflineSessionManager;
}
if (typeof module !== 'undefined') {
    module.exports = OfflineSessionManager;
}
