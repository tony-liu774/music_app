/**
 * Tests for SessionPersistenceService - JWT session persistence & offline resilience
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
global.localStorage = localStorageMock;

// Mock window for event listeners
const windowListeners = {};
global.window = {
    addEventListener: (event, handler) => {
        if (!windowListeners[event]) windowListeners[event] = [];
        windowListeners[event].push(handler);
    },
    removeEventListener: (event, handler) => {
        if (windowListeners[event]) {
            windowListeners[event] = windowListeners[event].filter(h => h !== handler);
        }
    }
};

// Mock navigator (Node.js has a getter-only navigator, so use defineProperty)
Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    writable: true,
    configurable: true
});

// Mock fetch
let fetchMockFn;
global.fetch = async (...args) => {
    if (fetchMockFn) return fetchMockFn(...args);
    return { ok: true, json: async () => ({}) };
};

const SessionPersistenceService = require('../src/js/services/session-persistence-service');

function triggerEvent(event) {
    if (windowListeners[event]) {
        windowListeners[event].forEach(h => h());
    }
}

// Mock AuthService
class MockAuthService {
    constructor() {
        this._authenticated = false;
        this._token = 'mock-token';
        this._user = null;
        this.listeners = [];
        this._loggedOut = false;
    }

    isAuthenticated() { return this._authenticated; }

    getCurrentUser() { return this._user; }

    async getToken() { return this._token; }

    async getAuthHeaders() {
        return this._authenticated ? { Authorization: `Bearer ${this._token}`, 'Content-Type': 'application/json' } : {};
    }

    logout() {
        this._authenticated = false;
        this._user = null;
        this._loggedOut = true;
    }

    onAuthStateChange(cb) {
        this.listeners.push(cb);
        return () => { this.listeners = this.listeners.filter(l => l !== cb); };
    }
}

// Mock OfflineSessionManager
class MockOfflineManager {
    constructor() {
        this._unsyncedSessions = [];
        this._syncQueueItems = [];
        this._markedSynced = [];
    }

    async getUnsyncedSessions() { return this._unsyncedSessions; }

    async markSynced(id) { this._markedSynced.push(id); }

    async processSyncQueue(uploadFn) {
        let processed = 0;
        let failed = 0;
        for (const item of this._syncQueueItems) {
            try {
                const result = await uploadFn(item);
                if (result) processed++;
                else failed++;
            } catch {
                failed++;
            }
        }
        return { processed, failed, remaining: failed };
    }

    async getSyncQueue() { return this._syncQueueItems; }
}

describe('SessionPersistenceService', () => {
    let authService;
    let offlineManager;
    let persistence;

    beforeEach(() => {
        localStorageMock.clear();
        // Clear window listeners
        for (const key in windowListeners) {
            windowListeners[key] = [];
        }
        authService = new MockAuthService();
        offlineManager = new MockOfflineManager();
        persistence = new SessionPersistenceService(authService, offlineManager, {
            heartbeatInterval: 100000 // Long interval to avoid test interference
        });
    });

    afterEach(() => {
        persistence.destroy();
        persistence = null;
        fetchMockFn = null;
    });

    it('should require AuthService', () => {
        assert.throws(
            () => new SessionPersistenceService(null),
            { message: 'AuthService is required' }
        );
    });

    it('should initialize with no session when unauthenticated', async () => {
        const user = await persistence.initialize();
        assert.strictEqual(user, null);
    });

    it('should restore session when authenticated with valid meta', async () => {
        authService._authenticated = true;
        authService._user = { id: 'user1', email: 'test@test.com' };
        localStorageMock.setItem('music_app_session_meta', JSON.stringify({
            userId: 'user1',
            lastSeen: Date.now()
        }));

        const user = await persistence.initialize();
        assert.ok(user);
        assert.strictEqual(user.id, 'user1');
    });

    it('should expire session after maxOfflineDuration', async () => {
        authService._authenticated = true;
        authService._user = { id: 'user1' };
        localStorageMock.setItem('music_app_session_meta', JSON.stringify({
            userId: 'user1',
            lastSeen: Date.now() - 8 * 24 * 60 * 60 * 1000 // 8 days ago
        }));

        const user = await persistence.initialize();
        assert.strictEqual(user, null);
        assert.strictEqual(authService._loggedOut, true);
    });

    it('should not expire session within maxOfflineDuration', async () => {
        authService._authenticated = true;
        authService._user = { id: 'user1' };
        localStorageMock.setItem('music_app_session_meta', JSON.stringify({
            userId: 'user1',
            lastSeen: Date.now() - 5 * 24 * 60 * 60 * 1000 // 5 days ago
        }));

        const user = await persistence.initialize();
        assert.ok(user);
    });

    it('should store session meta on login', () => {
        persistence.onLogin({ id: 'user1', email: 'test@test.com' });

        const meta = JSON.parse(localStorageMock.getItem('music_app_session_meta'));
        assert.strictEqual(meta.userId, 'user1');
        assert.ok(meta.loginAt);
        assert.ok(meta.lastSeen);
    });

    it('should clear session meta on logout', () => {
        persistence.onLogin({ id: 'user1' });
        persistence.onLogout();

        assert.strictEqual(localStorageMock.getItem('music_app_session_meta'), null);
    });

    it('should report session validity', () => {
        assert.strictEqual(persistence.isSessionValid(), false);

        authService._authenticated = true;
        localStorageMock.setItem('music_app_session_meta', JSON.stringify({
            lastSeen: Date.now()
        }));

        assert.strictEqual(persistence.isSessionValid(), true);
    });

    it('should report invalid session when expired', () => {
        authService._authenticated = true;
        localStorageMock.setItem('music_app_session_meta', JSON.stringify({
            lastSeen: Date.now() - 8 * 24 * 60 * 60 * 1000
        }));

        assert.strictEqual(persistence.isSessionValid(), false);
    });

    it('should return session info', () => {
        authService._authenticated = true;
        localStorageMock.setItem('music_app_session_meta', JSON.stringify({
            userId: 'user1',
            lastSeen: Date.now()
        }));

        const info = persistence.getSessionInfo();
        assert.ok(info);
        assert.strictEqual(info.userId, 'user1');
        assert.strictEqual(info.isOnline, true);
        assert.strictEqual(info.isAuthenticated, true);
    });

    it('should return null session info when no meta', () => {
        const info = persistence.getSessionInfo();
        assert.strictEqual(info, null);
    });

    it('should sync offline data - upload unsynced sessions', async () => {
        authService._authenticated = true;
        offlineManager._unsyncedSessions = [
            { id: 's1', score: 'Bach' },
            { id: 's2', score: 'Mozart' }
        ];

        fetchMockFn = async () => ({ ok: true, json: async () => ({ status: 'ok' }) });

        const result = await persistence.syncOfflineData();
        assert.strictEqual(result.status, 'success');
        assert.strictEqual(result.sessions.synced, 2);
        assert.strictEqual(offlineManager._markedSynced.length, 2);
    });

    it('should handle partial sync failures', async () => {
        authService._authenticated = true;
        offlineManager._unsyncedSessions = [
            { id: 's1' },
            { id: 's2' }
        ];

        let callCount = 0;
        fetchMockFn = async () => {
            callCount++;
            if (callCount === 1) return { ok: true, json: async () => ({}) };
            return { ok: false, status: 500 };
        };

        const result = await persistence.syncOfflineData();
        assert.strictEqual(result.sessions.synced, 1);
    });

    it('should return offline status when not connected', async () => {
        persistence._isOnline = false;
        const result = await persistence.syncOfflineData();
        assert.strictEqual(result.status, 'offline');
    });

    it('should return not_authenticated when logged out', async () => {
        authService._authenticated = false;
        const result = await persistence.syncOfflineData();
        assert.strictEqual(result.status, 'not_authenticated');
    });

    it('should prevent concurrent sync', async () => {
        authService._authenticated = true;
        persistence._syncInProgress = true;

        const result = await persistence.syncOfflineData();
        assert.strictEqual(result.status, 'already_syncing');
    });

    it('should trigger cloud sync if syncService is provided', async () => {
        authService._authenticated = true;
        let cloudSynced = false;

        const mockSyncService = {
            syncAll: async () => { cloudSynced = true; return { status: 'success' }; }
        };
        persistence.syncService = mockSyncService;

        fetchMockFn = async () => ({ ok: true, json: async () => ({}) });

        await persistence.syncOfflineData();
        assert.strictEqual(cloudSynced, true);
    });

    it('should notify listeners on session events', () => {
        const events = [];
        persistence.onEvent((event, data) => events.push({ event, data }));

        persistence.onLogin({ id: 'user1' });
        assert.ok(events.some(e => e.event === 'session_started'));

        persistence.onLogout();
        assert.ok(events.some(e => e.event === 'session_ended'));
    });

    it('should notify on restore', async () => {
        authService._authenticated = true;
        authService._user = { id: 'user1' };
        localStorageMock.setItem('music_app_session_meta', JSON.stringify({
            userId: 'user1',
            lastSeen: Date.now()
        }));

        const events = [];
        persistence.onEvent((event) => events.push(event));

        await persistence.initialize();
        assert.ok(events.includes('session_restored'));
    });

    it('should notify on session expired', async () => {
        authService._authenticated = true;
        authService._user = { id: 'user1' };
        localStorageMock.setItem('music_app_session_meta', JSON.stringify({
            userId: 'user1',
            lastSeen: Date.now() - 8 * 24 * 60 * 60 * 1000
        }));

        const events = [];
        persistence.onEvent((event) => events.push(event));

        await persistence.initialize();
        assert.ok(events.includes('session_expired'));
    });

    it('should unsubscribe from events', () => {
        const events = [];
        const unsub = persistence.onEvent((event) => events.push(event));

        persistence._notifyListeners('test1', null);
        assert.strictEqual(events.length, 1);

        unsub();
        persistence._notifyListeners('test2', null);
        assert.strictEqual(events.length, 1);
    });

    it('should auto-sync when online event fires', async () => {
        authService._authenticated = true;
        persistence._isOnline = false;

        const events = [];
        persistence.onEvent((event) => events.push(event));

        // Start network listener manually
        persistence._startNetworkListener();

        fetchMockFn = async () => ({ ok: true, json: async () => ({}) });

        // Simulate coming online
        triggerEvent('online');
        await new Promise(r => setTimeout(r, 50));

        assert.ok(events.includes('online'));
        assert.strictEqual(persistence._isOnline, true);
    });

    it('should set offline on offline event', () => {
        persistence._startNetworkListener();

        const events = [];
        persistence.onEvent((event) => events.push(event));

        triggerEvent('offline');

        assert.strictEqual(persistence._isOnline, false);
        assert.ok(events.includes('offline'));
    });

    it('should stop heartbeat and network listener on destroy', () => {
        persistence.onLogin({ id: 'user1' });
        assert.ok(persistence._heartbeatTimer);

        persistence.destroy();
        assert.strictEqual(persistence._heartbeatTimer, null);
        assert.strictEqual(persistence._onlineHandler, null);
        assert.strictEqual(persistence._offlineHandler, null);
    });

    it('should handle sync error gracefully', async () => {
        authService._authenticated = true;
        offlineManager._unsyncedSessions = [{ id: 's1' }];

        // Make getAuthHeaders throw
        authService.getAuthHeaders = async () => { throw new Error('Auth error'); };

        const result = await persistence.syncOfflineData();
        assert.strictEqual(result.status, 'error');
    });

    it('should handle localStorage errors in session meta', () => {
        // Ensure invalid JSON is handled
        localStorageMock.setItem('music_app_session_meta', 'invalid-json');
        const meta = persistence._getSessionMeta();
        assert.strictEqual(meta, null);
    });

    it('should process offline queue during sync', async () => {
        authService._authenticated = true;
        offlineManager._syncQueueItems = [
            { id: 'q1', type: 'session', data: { id: 's1' } }
        ];

        fetchMockFn = async () => ({ ok: true, json: async () => ({}) });

        const result = await persistence.syncOfflineData();
        assert.ok(result.queue);
        assert.strictEqual(result.queue.processed, 1);
    });

    it('should handle network errors in individual session sync', async () => {
        authService._authenticated = true;
        offlineManager._unsyncedSessions = [{ id: 's1' }];

        fetchMockFn = async () => { throw new TypeError('Failed to fetch'); };

        const result = await persistence.syncOfflineData();
        assert.strictEqual(result.sessions.synced, 0);
    });
});

console.log('Running SessionPersistenceService tests...');
