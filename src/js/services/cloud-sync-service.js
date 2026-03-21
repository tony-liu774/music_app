/**
 * Cloud Sync Service - Cross-device synchronization with conflict resolution
 * Syncs practice sessions, library, preferences, and progress data
 * Supports offline queue with automatic retry
 */

class CloudSyncService {
    constructor(authService, apiBaseUrl = '') {
        this.authService = authService;
        this.apiBaseUrl = apiBaseUrl;
        this.syncQueueKey = 'music_app_sync_queue';
        this.lastSyncKey = 'music_app_last_sync';
        this.syncInProgress = false;
        this.listeners = [];
        this.retryDelay = 5000;
        this.maxRetries = 3;
    }

    /**
     * Sync all data types with the server
     * @returns {Promise<Object>} Sync result with counts
     */
    async syncAll() {
        if (this.syncInProgress) {
            return { status: 'already_syncing' };
        }

        if (!this.authService.isAuthenticated()) {
            return { status: 'not_authenticated' };
        }

        this.syncInProgress = true;
        this._notifyListeners('sync_start', null);

        try {
            // Process offline queue first
            await this.processOfflineQueue();

            const headers = await this.authService.getAuthHeaders();
            headers['Content-Type'] = 'application/json';

            const lastSync = this.getLastSyncTimestamp();
            const localData = this._collectLocalData();

            const response = await fetch(`${this.apiBaseUrl}/api/sync`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    lastSync,
                    data: localData
                })
            });

            if (!response.ok) {
                throw new Error(`Sync failed: ${response.status}`);
            }

            const result = await response.json();

            // Apply server changes locally with conflict resolution
            const resolved = this._resolveConflicts(localData, result.serverData, result.conflicts);
            this._applyResolvedData(resolved);

            // Update last sync timestamp
            this._setLastSyncTimestamp(Date.now());

            this._notifyListeners('sync_complete', {
                pushed: result.pushed || 0,
                pulled: result.pulled || 0,
                conflicts: (result.conflicts || []).length
            });

            return {
                status: 'success',
                pushed: result.pushed || 0,
                pulled: result.pulled || 0,
                conflicts: (result.conflicts || []).length
            };
        } catch (error) {
            this._notifyListeners('sync_error', error.message);
            return { status: 'error', error: error.message };
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Add an item to the offline sync queue
     * @param {string} type - Data type (sessions, library, preferences, progress)
     * @param {string} action - Action (create, update, delete)
     * @param {Object} data - Data to sync
     */
    queueOfflineChange(type, action, data) {
        const queue = this.getOfflineQueue();
        queue.push({
            id: this._generateId(),
            type,
            action,
            data,
            timestamp: Date.now(),
            retries: 0
        });
        localStorage.setItem(this.syncQueueKey, JSON.stringify(queue));
    }

    /**
     * Process all items in the offline queue
     * Requires authentication - skips processing if not authenticated
     * @returns {Promise<Object>} Processing results
     */
    async processOfflineQueue() {
        if (!this.authService.isAuthenticated()) {
            return { processed: 0, failed: 0, skipped: true };
        }

        const queue = this.getOfflineQueue();
        if (queue.length === 0) return { processed: 0, failed: 0 };

        const headers = await this.authService.getAuthHeaders();
        headers['Content-Type'] = 'application/json';

        let processed = 0;
        let failed = 0;
        const remaining = [];

        for (const item of queue) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/api/sync/queue`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(item)
                });

                if (response.ok) {
                    processed++;
                } else if (item.retries < this.maxRetries) {
                    item.retries++;
                    remaining.push(item);
                    failed++;
                } else {
                    failed++;
                }
            } catch {
                if (item.retries < this.maxRetries) {
                    item.retries++;
                    remaining.push(item);
                }
                failed++;
            }
        }

        localStorage.setItem(this.syncQueueKey, JSON.stringify(remaining));
        return { processed, failed, remaining: remaining.length };
    }

    /**
     * Get the offline sync queue
     * @returns {Array} Queue items
     */
    getOfflineQueue() {
        try {
            return JSON.parse(localStorage.getItem(this.syncQueueKey) || '[]');
        } catch {
            return [];
        }
    }

    /**
     * Get the last sync timestamp
     * @returns {number|null} Timestamp or null
     */
    getLastSyncTimestamp() {
        const ts = localStorage.getItem(this.lastSyncKey);
        return ts ? parseInt(ts, 10) : null;
    }

    /**
     * Subscribe to sync events
     * @param {Function} callback - Called with (event, data)
     * @returns {Function} Unsubscribe function
     */
    onSyncEvent(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    /**
     * Resolve conflicts between local and server data using last-write-wins.
     * Starts from serverData, then replaces with local items when local is newer.
     * @param {Object} localData - Local data
     * @param {Object} serverData - Server data
     * @param {Array} conflicts - Conflict list from server
     * @returns {Object} Resolved data to apply locally
     * @private
     */
    _resolveConflicts(localData, serverData, conflicts = []) {
        const resolved = {
            sessions: [...(serverData?.sessions || [])],
            library: [...(serverData?.library || [])],
            preferences: { ...(serverData?.preferences || {}) },
            progress: [...(serverData?.progress || [])]
        };

        // For each conflict, replace server version with local version when local wins
        for (const conflict of conflicts) {
            const localItem = conflict.local;
            const serverItem = conflict.server;
            const localTime = localItem?.updatedAt || 0;
            const serverTime = serverItem?.updatedAt || 0;

            if (localTime > serverTime) {
                // Local wins - replace the server item in resolved data
                const type = conflict.type;
                if (type === 'preferences') {
                    resolved.preferences = { ...localItem };
                } else if (resolved[type] && Array.isArray(resolved[type])) {
                    const idx = resolved[type].findIndex(item => item.id === serverItem.id);
                    if (idx >= 0) {
                        resolved[type][idx] = localItem;
                    } else {
                        resolved[type].push(localItem);
                    }
                }
            }
            // Server wins - already in resolved data from serverData
        }

        return resolved;
    }

    /**
     * Collect local data for sync
     * @returns {Object} Local data organized by type
     * @private
     */
    _collectLocalData() {
        const data = {
            sessions: [],
            library: [],
            preferences: {},
            progress: []
        };

        // Collect practice session history
        try {
            const sessions = JSON.parse(localStorage.getItem('music_app_sessions') || '[]');
            data.sessions = sessions;
        } catch { /* empty */ }

        // Collect library data
        try {
            const library = JSON.parse(localStorage.getItem('music_app_library') || '[]');
            data.library = library;
        } catch { /* empty */ }

        // Collect user preferences
        try {
            data.preferences = {
                instrument: localStorage.getItem('music_app_instrument'),
                theme: localStorage.getItem('music_app_theme'),
                metronomeVolume: localStorage.getItem('music_app_metronome_volume'),
                cursorSpeed: localStorage.getItem('music_app_cursor_speed'),
                updatedAt: parseInt(localStorage.getItem('music_app_prefs_updated') || '0', 10)
            };
        } catch { /* empty */ }

        // Collect progress data
        try {
            const progress = JSON.parse(localStorage.getItem('music_app_progress') || '[]');
            data.progress = progress;
        } catch { /* empty */ }

        return data;
    }

    /**
     * Apply resolved data to local storage
     * @param {Object} resolved - Resolved data from sync
     * @private
     */
    _applyResolvedData(resolved) {
        if (resolved.sessions && resolved.sessions.length > 0) {
            const existing = JSON.parse(localStorage.getItem('music_app_sessions') || '[]');
            const merged = this._mergeArrayById(existing, resolved.sessions);
            localStorage.setItem('music_app_sessions', JSON.stringify(merged));
        }

        if (resolved.library && resolved.library.length > 0) {
            const existing = JSON.parse(localStorage.getItem('music_app_library') || '[]');
            const merged = this._mergeArrayById(existing, resolved.library);
            localStorage.setItem('music_app_library', JSON.stringify(merged));
        }

        if (resolved.preferences && Object.keys(resolved.preferences).length > 0) {
            const prefs = resolved.preferences;
            if (prefs.instrument) localStorage.setItem('music_app_instrument', prefs.instrument);
            if (prefs.theme) localStorage.setItem('music_app_theme', prefs.theme);
            if (prefs.metronomeVolume) localStorage.setItem('music_app_metronome_volume', prefs.metronomeVolume);
            if (prefs.cursorSpeed) localStorage.setItem('music_app_cursor_speed', prefs.cursorSpeed);
        }

        if (resolved.progress && resolved.progress.length > 0) {
            const existing = JSON.parse(localStorage.getItem('music_app_progress') || '[]');
            const merged = this._mergeArrayById(existing, resolved.progress);
            localStorage.setItem('music_app_progress', JSON.stringify(merged));
        }
    }

    /**
     * Merge two arrays by ID, preferring newer items
     * @param {Array} existing - Existing items
     * @param {Array} incoming - Incoming items
     * @returns {Array} Merged array
     * @private
     */
    _mergeArrayById(existing, incoming) {
        const map = new Map();
        for (const item of existing) {
            if (item.id) map.set(item.id, item);
        }
        for (const item of incoming) {
            if (item.id) {
                const existingItem = map.get(item.id);
                if (!existingItem || (item.updatedAt || 0) >= (existingItem.updatedAt || 0)) {
                    map.set(item.id, item);
                }
            }
        }
        return Array.from(map.values());
    }

    /**
     * Set the last sync timestamp
     * @param {number} timestamp
     * @private
     */
    _setLastSyncTimestamp(timestamp) {
        localStorage.setItem(this.lastSyncKey, String(timestamp));
    }

    /**
     * Generate a unique ID using crypto when available, fallback to timestamp+random
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
     * Notify listeners of sync events
     * @param {string} event - Event type
     * @param {*} data - Event data
     * @private
     */
    _notifyListeners(event, data) {
        this.listeners.forEach(cb => cb(event, data));
    }
}

if (typeof window !== 'undefined') {
    window.CloudSyncService = CloudSyncService;
}
if (typeof module !== 'undefined') {
    module.exports = CloudSyncService;
}
