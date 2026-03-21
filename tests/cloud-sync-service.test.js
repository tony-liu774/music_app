/**
 * Tests for CloudSyncService - Cross-device synchronization
 * Imports the actual source file with global mocks for localStorage and fetch
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Mock localStorage (set up before requiring CloudSyncService)
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();
global.localStorage = localStorageMock;

// Mock fetch - configurable per test
let fetchResponses = [];
let fetchCallCount = 0;

function setupFetchSequence(responses) {
    fetchResponses = responses;
    fetchCallCount = 0;
}

global.fetch = async () => {
    const idx = Math.min(fetchCallCount, fetchResponses.length - 1);
    fetchCallCount++;
    const resp = fetchResponses[idx];
    return {
        ok: resp.ok !== false,
        status: resp.status || 200,
        json: async () => resp.data
    };
};

// Now import the actual CloudSyncService from source
const CloudSyncService = require('../src/js/services/cloud-sync-service');

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

describe('CloudSyncService', () => {
    let syncService;
    let authService;

    beforeEach(() => {
        localStorageMock.clear();
        fetchResponses = [];
        fetchCallCount = 0;
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
        localStorageMock.setItem('music_app_sessions', JSON.stringify([{ id: 's1' }]));
        localStorageMock.setItem('music_app_instrument', 'violin');
        localStorageMock.setItem('music_app_theme', 'midnight');
        localStorageMock.setItem('music_app_progress', JSON.stringify([{ id: 'p1' }]));

        const data = syncService._collectLocalData();
        assert.strictEqual(data.sessions.length, 1);
        assert.strictEqual(data.preferences.instrument, 'violin');
        assert.strictEqual(data.preferences.theme, 'midnight');
        assert.strictEqual(data.progress.length, 1);
    });

    it('should collect library data from localStorage', () => {
        localStorageMock.setItem('music_app_library', JSON.stringify([
            { id: 'lib1', title: 'Bach Suite No. 1' },
            { id: 'lib2', title: 'Sonata in G' }
        ]));

        const data = syncService._collectLocalData();
        assert.strictEqual(data.library.length, 2);
        assert.strictEqual(data.library[0].title, 'Bach Suite No. 1');
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

        const sessions = JSON.parse(localStorageMock.getItem('music_app_sessions'));
        assert.strictEqual(sessions.length, 1);
        assert.strictEqual(sessions[0].score, 'Bach Suite');

        assert.strictEqual(localStorageMock.getItem('music_app_instrument'), 'cello');
        assert.strictEqual(localStorageMock.getItem('music_app_theme'), 'midnight');

        const progress = JSON.parse(localStorageMock.getItem('music_app_progress'));
        assert.strictEqual(progress.length, 1);
    });

    it('should apply library data to localStorage', () => {
        const resolved = {
            sessions: [],
            library: [{ id: 'lib1', title: 'Sonata' }],
            preferences: {},
            progress: []
        };

        syncService._applyResolvedData(resolved);

        const library = JSON.parse(localStorageMock.getItem('music_app_library'));
        assert.strictEqual(library.length, 1);
        assert.strictEqual(library[0].title, 'Sonata');
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

    it('should skip processOfflineQueue when not authenticated', async () => {
        syncService.queueOfflineChange('sessions', 'create', { id: 's1' });
        authService._authenticated = false;

        const result = await syncService.processOfflineQueue();
        assert.strictEqual(result.skipped, true);
        assert.strictEqual(result.processed, 0);

        // Queue should remain untouched
        const queue = syncService.getOfflineQueue();
        assert.strictEqual(queue.length, 1);
    });

    it('should resolve conflicts with local wins when local is newer', () => {
        const localData = {
            sessions: [{ id: 's1', name: 'local-session', updatedAt: 200 }],
            library: [],
            preferences: {},
            progress: []
        };
        const serverData = {
            sessions: [{ id: 's1', name: 'server-session', updatedAt: 100 }],
            library: [],
            preferences: {},
            progress: []
        };
        const conflicts = [{
            type: 'sessions',
            local: { id: 's1', name: 'local-session', updatedAt: 200 },
            server: { id: 's1', name: 'server-session', updatedAt: 100 }
        }];

        const resolved = syncService._resolveConflicts(localData, serverData, conflicts);
        assert.strictEqual(resolved.sessions[0].name, 'local-session');
    });

    it('should resolve conflicts with server wins when server is newer', () => {
        const localData = {
            sessions: [{ id: 's1', name: 'local-session', updatedAt: 100 }]
        };
        const serverData = {
            sessions: [{ id: 's1', name: 'server-session', updatedAt: 200 }],
            library: [],
            preferences: {},
            progress: []
        };
        const conflicts = [{
            type: 'sessions',
            local: { id: 's1', name: 'local-session', updatedAt: 100 },
            server: { id: 's1', name: 'server-session', updatedAt: 200 }
        }];

        const resolved = syncService._resolveConflicts(localData, serverData, conflicts);
        assert.strictEqual(resolved.sessions[0].name, 'server-session');
    });

    it('should resolve preferences conflicts with local wins', () => {
        const localData = { preferences: { theme: 'dark', updatedAt: 200 } };
        const serverData = {
            sessions: [],
            library: [],
            preferences: { theme: 'light', updatedAt: 100 },
            progress: []
        };
        const conflicts = [{
            type: 'preferences',
            local: { theme: 'dark', updatedAt: 200 },
            server: { theme: 'light', updatedAt: 100 }
        }];

        const resolved = syncService._resolveConflicts(localData, serverData, conflicts);
        assert.strictEqual(resolved.preferences.theme, 'dark');
    });
});

console.log('Running CloudSyncService tests...');
