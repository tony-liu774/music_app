/**
 * Tests for CloudSyncService - Cross-device synchronization
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

// Global localStorage replacement for the service
const localStorage = localStorageMock;

// Mock fetch
let fetchResponses = [];
let fetchCallCount = 0;

function setupFetchSequence(responses) {
    fetchResponses = responses;
    fetchCallCount = 0;
}

async function mockFetch() {
    const idx = Math.min(fetchCallCount, fetchResponses.length - 1);
    fetchCallCount++;
    const resp = fetchResponses[idx];
    return {
        ok: resp.ok !== false,
        status: resp.status || 200,
        json: async () => resp.data
    };
}

// Mock AuthService
class MockAuthService {
    constructor() {
        this._authenticated = true;
    }

    isAuthenticated() { return this._authenticated; }
    async getAuthHeaders() {
        return this._authenticated ? { Authorization: 'Bearer mock-token' } : {};
    }
}

// Inline CloudSyncService for testing
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

    async syncAll() {
        if (this.syncInProgress) return { status: 'already_syncing' };
        if (!this.authService.isAuthenticated()) return { status: 'not_authenticated' };

        this.syncInProgress = true;
        this._notifyListeners('sync_start', null);

        try {
            await this.processOfflineQueue();

            const headers = await this.authService.getAuthHeaders();
            headers['Content-Type'] = 'application/json';

            const lastSync = this.getLastSyncTimestamp();
            const localData = this._collectLocalData();

            const response = await mockFetch(`${this.apiBaseUrl}/api/sync`, {
                method: 'POST', headers,
                body: JSON.stringify({ lastSync, data: localData })
            });

            if (!response.ok) throw new Error(`Sync failed: ${response.status}`);

            const result = await response.json();
            const resolved = this._resolveConflicts(localData, result.serverData, result.conflicts);
            this._applyResolvedData(resolved);
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

    queueOfflineChange(type, action, data) {
        const queue = this.getOfflineQueue();
        queue.push({
            id: this._generateId(),
            type, action, data,
            timestamp: Date.now(),
            retries: 0
        });
        localStorage.setItem(this.syncQueueKey, JSON.stringify(queue));
    }

    async processOfflineQueue() {
        const queue = this.getOfflineQueue();
        if (queue.length === 0) return { processed: 0, failed: 0 };

        let processed = 0;
        let failed = 0;
        const remaining = [];

        for (const item of queue) {
            try {
                const response = await mockFetch(`${this.apiBaseUrl}/api/sync/queue`, {
                    method: 'POST',
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

    getOfflineQueue() {
        try { return JSON.parse(localStorage.getItem(this.syncQueueKey) || '[]'); }
        catch { return []; }
    }

    getLastSyncTimestamp() {
        const ts = localStorage.getItem(this.lastSyncKey);
        return ts ? parseInt(ts, 10) : null;
    }

    onSyncEvent(callback) {
        this.listeners.push(callback);
        return () => { this.listeners = this.listeners.filter(l => l !== callback); };
    }

    _resolveConflicts(localData, serverData, conflicts = []) {
        return {
            sessions: serverData?.sessions || [],
            library: serverData?.library || [],
            preferences: serverData?.preferences || {},
            progress: serverData?.progress || []
        };
    }

    _collectLocalData() {
        const data = { sessions: [], library: [], preferences: {}, progress: [] };
        try { data.sessions = JSON.parse(localStorage.getItem('music_app_sessions') || '[]'); } catch {}
        try {
            data.preferences = {
                instrument: localStorage.getItem('music_app_instrument'),
                theme: localStorage.getItem('music_app_theme'),
                updatedAt: parseInt(localStorage.getItem('music_app_prefs_updated') || '0', 10)
            };
        } catch {}
        try { data.progress = JSON.parse(localStorage.getItem('music_app_progress') || '[]'); } catch {}
        return data;
    }

    _applyResolvedData(resolved) {
        if (resolved.sessions && resolved.sessions.length > 0) {
            const existing = JSON.parse(localStorage.getItem('music_app_sessions') || '[]');
            const merged = this._mergeArrayById(existing, resolved.sessions);
            localStorage.setItem('music_app_sessions', JSON.stringify(merged));
        }
        if (resolved.preferences && Object.keys(resolved.preferences).length > 0) {
            const prefs = resolved.preferences;
            if (prefs.instrument) localStorage.setItem('music_app_instrument', prefs.instrument);
            if (prefs.theme) localStorage.setItem('music_app_theme', prefs.theme);
        }
        if (resolved.progress && resolved.progress.length > 0) {
            const existing = JSON.parse(localStorage.getItem('music_app_progress') || '[]');
            const merged = this._mergeArrayById(existing, resolved.progress);
            localStorage.setItem('music_app_progress', JSON.stringify(merged));
        }
    }

    _mergeArrayById(existing, incoming) {
        const map = new Map();
        for (const item of existing) { if (item.id) map.set(item.id, item); }
        for (const item of incoming) {
            if (item.id) {
                const ex = map.get(item.id);
                if (!ex || (item.updatedAt || 0) >= (ex.updatedAt || 0)) map.set(item.id, item);
            }
        }
        return Array.from(map.values());
    }

    _setLastSyncTimestamp(timestamp) {
        localStorage.setItem(this.lastSyncKey, String(timestamp));
    }

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    }

    _notifyListeners(event, data) {
        this.listeners.forEach(cb => cb(event, data));
    }
}

describe('CloudSyncService', () => {
    let syncService;
    let authService;

    beforeEach(() => {
        localStorageMock.clear();
        authService = new MockAuthService();
        syncService = new CloudSyncService(authService, 'http://localhost:3000');
    });

    afterEach(() => {
        syncService = null;
        localStorageMock.clear();
    });

    it('should initialize with empty state', () => {
        assert.strictEqual(syncService.syncInProgress, false);
        assert.strictEqual(syncService.getLastSyncTimestamp(), null);
        assert.deepStrictEqual(syncService.getOfflineQueue(), []);
    });

    it('should return not_authenticated when user is not logged in', async () => {
        authService._authenticated = false;
        const result = await syncService.syncAll();
        assert.strictEqual(result.status, 'not_authenticated');
    });

    it('should return already_syncing when sync is in progress', async () => {
        syncService.syncInProgress = true;
        const result = await syncService.syncAll();
        assert.strictEqual(result.status, 'already_syncing');
    });

    it('should queue offline changes', () => {
        syncService.queueOfflineChange('sessions', 'create', { id: 's1', score: 'test' });
        const queue = syncService.getOfflineQueue();
        assert.strictEqual(queue.length, 1);
        assert.strictEqual(queue[0].type, 'sessions');
        assert.strictEqual(queue[0].action, 'create');
        assert.strictEqual(queue[0].data.id, 's1');
    });

    it('should queue multiple offline changes', () => {
        syncService.queueOfflineChange('sessions', 'create', { id: 's1' });
        syncService.queueOfflineChange('preferences', 'update', { theme: 'dark' });
        syncService.queueOfflineChange('progress', 'create', { id: 'p1' });

        const queue = syncService.getOfflineQueue();
        assert.strictEqual(queue.length, 3);
    });

    it('should process offline queue successfully', async () => {
        syncService.queueOfflineChange('sessions', 'create', { id: 's1' });
        syncService.queueOfflineChange('sessions', 'create', { id: 's2' });

        setupFetchSequence([
            { data: { status: 'ok' } },
            { data: { status: 'ok' } }
        ]);

        const result = await syncService.processOfflineQueue();
        assert.strictEqual(result.processed, 2);
        assert.strictEqual(result.failed, 0);
    });

    it('should retry failed queue items', async () => {
        syncService.queueOfflineChange('sessions', 'create', { id: 's1' });

        setupFetchSequence([
            { ok: false, data: { error: 'Server error' }, status: 500 }
        ]);

        const result = await syncService.processOfflineQueue();
        assert.strictEqual(result.failed, 1);

        const queue = syncService.getOfflineQueue();
        assert.strictEqual(queue.length, 1);
        assert.strictEqual(queue[0].retries, 1);
    });

    it('should sync successfully with server', async () => {
        setupFetchSequence([
            // processOfflineQueue returns empty since no queue items
            // Then syncAll fetch:
            {
                data: {
                    pushed: 2,
                    pulled: 1,
                    conflicts: [],
                    serverData: {
                        sessions: [{ id: 'server-s1', updatedAt: Date.now() }],
                        library: [],
                        preferences: {},
                        progress: []
                    },
                    syncTimestamp: Date.now()
                }
            }
        ]);

        const result = await syncService.syncAll();
        assert.strictEqual(result.status, 'success');
        assert.strictEqual(result.pushed, 2);
        assert.strictEqual(result.pulled, 1);
        assert.strictEqual(result.conflicts, 0);
    });

    it('should update last sync timestamp after successful sync', async () => {
        setupFetchSequence([{
            data: {
                pushed: 0, pulled: 0, conflicts: [],
                serverData: { sessions: [], library: [], preferences: {}, progress: [] },
                syncTimestamp: Date.now()
            }
        }]);

        assert.strictEqual(syncService.getLastSyncTimestamp(), null);
        await syncService.syncAll();
        assert.notStrictEqual(syncService.getLastSyncTimestamp(), null);
    });

    it('should handle sync failure gracefully', async () => {
        setupFetchSequence([{
            ok: false, status: 500, data: { error: 'Server error' }
        }]);

        const result = await syncService.syncAll();
        assert.strictEqual(result.status, 'error');
    });

    it('should notify listeners on sync start and complete', async () => {
        const events = [];
        syncService.onSyncEvent((event, data) => events.push({ event, data }));

        setupFetchSequence([{
            data: {
                pushed: 0, pulled: 0, conflicts: [],
                serverData: { sessions: [], library: [], preferences: {}, progress: [] },
                syncTimestamp: Date.now()
            }
        }]);

        await syncService.syncAll();

        assert.ok(events.some(e => e.event === 'sync_start'));
        assert.ok(events.some(e => e.event === 'sync_complete'));
    });

    it('should notify listeners on sync error', async () => {
        const events = [];
        syncService.onSyncEvent((event, data) => events.push({ event, data }));

        setupFetchSequence([{
            ok: false, status: 500, data: { error: 'Server error' }
        }]);

        await syncService.syncAll();
        assert.ok(events.some(e => e.event === 'sync_error'));
    });

    it('should unsubscribe from sync events', () => {
        const events = [];
        const unsubscribe = syncService.onSyncEvent((event) => events.push(event));

        syncService._notifyListeners('test', null);
        assert.strictEqual(events.length, 1);

        unsubscribe();
        syncService._notifyListeners('test', null);
        assert.strictEqual(events.length, 1);
    });

    it('should collect local data from localStorage', () => {
        localStorage.setItem('music_app_sessions', JSON.stringify([{ id: 's1' }]));
        localStorage.setItem('music_app_instrument', 'violin');
        localStorage.setItem('music_app_theme', 'midnight');
        localStorage.setItem('music_app_progress', JSON.stringify([{ id: 'p1' }]));

        const data = syncService._collectLocalData();
        assert.strictEqual(data.sessions.length, 1);
        assert.strictEqual(data.preferences.instrument, 'violin');
        assert.strictEqual(data.preferences.theme, 'midnight');
        assert.strictEqual(data.progress.length, 1);
    });

    it('should merge arrays by ID preferring newer items', () => {
        const existing = [
            { id: '1', name: 'old', updatedAt: 100 },
            { id: '2', name: 'keep', updatedAt: 200 }
        ];
        const incoming = [
            { id: '1', name: 'new', updatedAt: 300 },
            { id: '3', name: 'added', updatedAt: 100 }
        ];

        const merged = syncService._mergeArrayById(existing, incoming);
        assert.strictEqual(merged.length, 3);
        assert.strictEqual(merged.find(i => i.id === '1').name, 'new');
        assert.strictEqual(merged.find(i => i.id === '2').name, 'keep');
        assert.strictEqual(merged.find(i => i.id === '3').name, 'added');
    });

    it('should apply resolved server data to localStorage', () => {
        const resolved = {
            sessions: [{ id: 's1', score: 'Bach Suite' }],
            library: [],
            preferences: { instrument: 'cello', theme: 'midnight' },
            progress: [{ id: 'p1', score: 'Bach Suite', accuracy: 85 }]
        };

        syncService._applyResolvedData(resolved);

        const sessions = JSON.parse(localStorage.getItem('music_app_sessions'));
        assert.strictEqual(sessions.length, 1);
        assert.strictEqual(sessions[0].score, 'Bach Suite');

        assert.strictEqual(localStorage.getItem('music_app_instrument'), 'cello');
        assert.strictEqual(localStorage.getItem('music_app_theme'), 'midnight');

        const progress = JSON.parse(localStorage.getItem('music_app_progress'));
        assert.strictEqual(progress.length, 1);
    });

    it('should handle empty offline queue processing', async () => {
        const result = await syncService.processOfflineQueue();
        assert.strictEqual(result.processed, 0);
        assert.strictEqual(result.failed, 0);
    });

    it('should generate unique IDs', () => {
        const id1 = syncService._generateId();
        const id2 = syncService._generateId();
        assert.notStrictEqual(id1, id2);
    });
});

console.log('Running CloudSyncService tests...');
