/**
 * Tests for OfflineSessionManager - IndexedDB-backed offline storage
 * Uses fake-indexeddb for Node.js testing
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// --- IndexedDB mock for Node.js ---
const databases = new Map();

class MockIDBRequest {
    constructor() {
        this.result = undefined;
        this.error = null;
        this.onsuccess = null;
        this.onerror = null;
    }
    _succeed(result) {
        this.result = result;
        if (this.onsuccess) this.onsuccess({ target: this });
    }
    _fail(error) {
        this.error = error;
        if (this.onerror) this.onerror({ target: this });
    }
}

class MockIDBIndex {
    constructor(store, keyPath) {
        this.store = store;
        this.keyPath = keyPath;
    }
    getAll(value) {
        const request = new MockIDBRequest();
        setTimeout(() => {
            const results = [];
            for (const item of this.store._data.values()) {
                if (item[this.keyPath] === value) {
                    results.push({ ...item });
                }
            }
            request._succeed(results);
        }, 0);
        return request;
    }
}

class MockIDBObjectStore {
    constructor(name, options) {
        this.name = name;
        this.keyPath = options.keyPath;
        this.autoIncrement = options.autoIncrement || false;
        this._data = new Map();
        this._indexes = new Map();
        this._autoId = 1;
    }
    createIndex(name, keyPath, options) {
        this._indexes.set(name, new MockIDBIndex(this, keyPath));
        return this._indexes.get(name);
    }
    index(name) {
        return this._indexes.get(name);
    }
    put(value) {
        const request = new MockIDBRequest();
        setTimeout(() => {
            const key = value[this.keyPath];
            this._data.set(key, { ...value });
            request._succeed(key);
        }, 0);
        return request;
    }
    add(value) {
        const request = new MockIDBRequest();
        setTimeout(() => {
            let key;
            if (this.autoIncrement) {
                key = this._autoId++;
                value.id = key;
            } else {
                key = value[this.keyPath];
            }
            this._data.set(key, { ...value });
            request._succeed(key);
        }, 0);
        return request;
    }
    get(key) {
        const request = new MockIDBRequest();
        setTimeout(() => {
            const item = this._data.get(key);
            request._succeed(item ? { ...item } : undefined);
        }, 0);
        return request;
    }
    getAll() {
        const request = new MockIDBRequest();
        setTimeout(() => {
            request._succeed(Array.from(this._data.values()).map(v => ({ ...v })));
        }, 0);
        return request;
    }
    delete(key) {
        const request = new MockIDBRequest();
        setTimeout(() => {
            this._data.delete(key);
            request._succeed(undefined);
        }, 0);
        return request;
    }
    clear() {
        this._data.clear();
    }
}

class MockIDBTransaction {
    constructor(db, storeNames, mode) {
        this.db = db;
        this.storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];
        this.mode = mode;
        this.oncomplete = null;
        this.onerror = null;
        this._completionScheduled = false;
    }
    objectStore(name) {
        const store = this.db._stores.get(name);
        // Schedule oncomplete after microtasks finish
        if (!this._completionScheduled) {
            this._completionScheduled = true;
            setTimeout(() => {
                if (this.oncomplete) this.oncomplete();
            }, 10);
        }
        return store;
    }
}

class MockIDBDatabase {
    constructor(name) {
        this.name = name;
        this._stores = new Map();
        this.objectStoreNames = {
            contains: (name) => this._stores.has(name)
        };
    }
    createObjectStore(name, options) {
        const store = new MockIDBObjectStore(name, options || {});
        this._stores.set(name, store);
        return store;
    }
    transaction(storeNames, mode) {
        return new MockIDBTransaction(this, storeNames, mode || 'readonly');
    }
    close() {}
}

// Mock indexedDB global
global.indexedDB = {
    open: (name, version) => {
        const request = new MockIDBRequest();
        setTimeout(() => {
            let db = databases.get(name);
            const isNew = !db;
            if (isNew) {
                db = new MockIDBDatabase(name);
                databases.set(name, db);
            }
            if (isNew && request.onupgradeneeded) {
                request.onupgradeneeded({ target: { result: db } });
            }
            request._succeed(db);
        }, 0);
        return request;
    }
};

// Mock navigator (Node.js has a getter-only navigator, so use defineProperty)
Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    writable: true,
    configurable: true
});

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

// Mock crypto
global.crypto = {
    randomUUID: () => `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
};

// Now import the module
const OfflineSessionManager = require('../src/js/services/offline-session-manager');

function triggerEvent(event) {
    if (windowListeners[event]) {
        windowListeners[event].forEach(h => h());
    }
}

describe('OfflineSessionManager', () => {
    let manager;

    beforeEach(() => {
        databases.clear();
        manager = new OfflineSessionManager({ dbName: 'TestOfflineDB' });
    });

    afterEach(() => {
        manager.close();
        manager = null;
    });

    it('should open the database', async () => {
        const db = await manager.open();
        assert.ok(db);
        assert.strictEqual(db.name, 'TestOfflineDB');
    });

    it('should create object stores on first open', async () => {
        const db = await manager.open();
        assert.ok(db.objectStoreNames.contains('sessions'));
        assert.ok(db.objectStoreNames.contains('syncQueue'));
    });

    it('should save a session', async () => {
        const id = await manager.saveSession({ id: 'sess-1', score: 'Bach', notes: [1, 2, 3] });
        assert.strictEqual(id, 'sess-1');
    });

    it('should reject session without id', async () => {
        await assert.rejects(
            () => manager.saveSession({ score: 'Bach' }),
            { message: 'Session must have an id' }
        );
    });

    it('should reject null session', async () => {
        await assert.rejects(
            () => manager.saveSession(null),
            { message: 'Session must have an id' }
        );
    });

    it('should get a saved session by id', async () => {
        await manager.saveSession({ id: 'sess-2', score: 'Mozart', accuracy: 85 });
        const session = await manager.getSession('sess-2');
        assert.ok(session);
        assert.strictEqual(session.score, 'Mozart');
        assert.strictEqual(session.accuracy, 85);
        assert.strictEqual(session.synced, false);
    });

    it('should return null for non-existent session', async () => {
        await manager.open();
        const session = await manager.getSession('non-existent');
        assert.strictEqual(session, null);
    });

    it('should get all sessions sorted by timestamp', async () => {
        await manager.saveSession({ id: 's1', timestamp: 100 });
        await manager.saveSession({ id: 's2', timestamp: 300 });
        await manager.saveSession({ id: 's3', timestamp: 200 });

        const all = await manager.getAllSessions();
        assert.strictEqual(all.length, 3);
        assert.strictEqual(all[0].id, 's2'); // newest first
        assert.strictEqual(all[2].id, 's1'); // oldest last
    });

    it('should limit getAllSessions results', async () => {
        await manager.saveSession({ id: 's1', timestamp: 100 });
        await manager.saveSession({ id: 's2', timestamp: 200 });
        await manager.saveSession({ id: 's3', timestamp: 300 });

        const limited = await manager.getAllSessions(2);
        assert.strictEqual(limited.length, 2);
    });

    it('should get unsynced sessions', async () => {
        await manager.saveSession({ id: 's1' });
        await manager.saveSession({ id: 's2' });

        const unsynced = await manager.getUnsyncedSessions();
        assert.strictEqual(unsynced.length, 2);
        assert.ok(unsynced.every(s => s.synced === false));
    });

    it('should mark a session as synced', async () => {
        await manager.saveSession({ id: 's1' });
        await manager.markSynced('s1');

        const session = await manager.getSession('s1');
        assert.strictEqual(session.synced, true);
        assert.ok(session.syncedAt);
    });

    it('should handle marking non-existent session as synced', async () => {
        await manager.open();
        // Should not throw
        await manager.markSynced('non-existent');
    });

    it('should delete a session', async () => {
        await manager.saveSession({ id: 's-del' });
        await manager.deleteSession('s-del');

        const session = await manager.getSession('s-del');
        assert.strictEqual(session, null);
    });

    it('should add to sync queue', async () => {
        const id = await manager.addToSyncQueue('session', { sessionId: 's1', data: {} });
        assert.ok(id);
    });

    it('should reject addToSyncQueue without type', async () => {
        await assert.rejects(
            () => manager.addToSyncQueue(null, { data: 1 }),
            { message: 'Type and data are required' }
        );
    });

    it('should reject addToSyncQueue without data', async () => {
        await assert.rejects(
            () => manager.addToSyncQueue('session', null),
            { message: 'Type and data are required' }
        );
    });

    it('should get sync queue sorted by timestamp', async () => {
        await manager.addToSyncQueue('a', { id: 1 });
        await manager.addToSyncQueue('b', { id: 2 });

        const queue = await manager.getSyncQueue();
        assert.strictEqual(queue.length, 2);
        assert.ok(queue[0].timestamp <= queue[1].timestamp);
    });

    it('should remove from sync queue', async () => {
        const id = await manager.addToSyncQueue('session', { id: 1 });
        await manager.removeFromSyncQueue(id);

        const queue = await manager.getSyncQueue();
        assert.strictEqual(queue.length, 0);
    });

    it('should increment retry count', async () => {
        const id = await manager.addToSyncQueue('session', { id: 1 });
        await manager.incrementRetry(id);

        const queue = await manager.getSyncQueue();
        const item = queue.find(q => q.id === id);
        assert.strictEqual(item.retries, 1);
    });

    it('should process sync queue with successful uploads', async () => {
        await manager.addToSyncQueue('session', { id: 1 });
        await manager.addToSyncQueue('session', { id: 2 });

        const result = await manager.processSyncQueue(async () => true);
        assert.strictEqual(result.processed, 2);
        assert.strictEqual(result.failed, 0);
        assert.strictEqual(result.remaining, 0);
    });

    it('should handle failed uploads in sync queue', async () => {
        await manager.addToSyncQueue('session', { id: 1 });

        const result = await manager.processSyncQueue(async () => false);
        assert.strictEqual(result.processed, 0);
        assert.strictEqual(result.failed, 1);
        assert.strictEqual(result.remaining, 1);
    });

    it('should discard items that exceed max retries', async () => {
        await manager.addToSyncQueue('session', { id: 1 });
        // Manually set retries to maxRetries
        const queue = await manager.getSyncQueue();
        const item = queue[0];
        const db = await manager.open();
        await new Promise((resolve) => {
            const tx = db.transaction('syncQueue', 'readwrite');
            const store = tx.objectStore('syncQueue');
            item.retries = 5;
            const req = store.put(item);
            req.onsuccess = () => resolve();
        });

        const result = await manager.processSyncQueue(async () => false, 5);
        assert.strictEqual(result.failed, 1);
        assert.strictEqual(result.remaining, 0); // Discarded
    });

    it('should handle upload exception in sync queue', async () => {
        await manager.addToSyncQueue('session', { id: 1 });

        const result = await manager.processSyncQueue(async () => {
            throw new Error('Network error');
        });
        assert.strictEqual(result.failed, 1);
        assert.strictEqual(result.remaining, 1);
    });

    it('should clear all data', async () => {
        await manager.saveSession({ id: 's1' });
        await manager.addToSyncQueue('session', { id: 1 });

        await manager.clearAll();

        const sessions = await manager.getAllSessions();
        const queue = await manager.getSyncQueue();
        assert.strictEqual(sessions.length, 0);
        assert.strictEqual(queue.length, 0);
    });

    it('should report online status', () => {
        assert.strictEqual(manager.isOnline(), true);
    });

    it('should start and stop network listener', () => {
        let syncCalled = false;
        manager.startNetworkListener(async () => { syncCalled = true; });
        assert.ok(manager._onlineHandler);

        manager.stopNetworkListener();
        assert.strictEqual(manager._onlineHandler, null);
    });

    it('should notify on online event', async () => {
        const events = [];
        manager.onEvent((event, data) => events.push(event));

        let syncCalled = false;
        manager.startNetworkListener(async () => { syncCalled = true; });

        // Trigger online
        triggerEvent('online');
        await new Promise(r => setTimeout(r, 10));

        assert.ok(events.includes('online'));
        assert.strictEqual(syncCalled, true);
    });

    it('should notify on offline event', () => {
        const events = [];
        manager.onEvent((event) => events.push(event));

        manager.startNetworkListener();
        triggerEvent('offline');

        assert.ok(events.includes('offline'));
        assert.strictEqual(manager.isOnline(), false);
    });

    it('should subscribe and unsubscribe from events', () => {
        const events = [];
        const unsub = manager.onEvent((event) => events.push(event));

        manager._notifyListeners('test', null);
        assert.strictEqual(events.length, 1);

        unsub();
        manager._notifyListeners('test', null);
        assert.strictEqual(events.length, 1);
    });

    it('should generate unique IDs', () => {
        const id1 = manager._generateId();
        const id2 = manager._generateId();
        assert.notStrictEqual(id1, id2);
    });

    it('should set session timestamp if not provided', async () => {
        await manager.saveSession({ id: 'ts-test' });
        const session = await manager.getSession('ts-test');
        assert.ok(session.timestamp);
        assert.ok(session.updatedAt);
    });

    it('should preserve session timestamp if provided', async () => {
        await manager.saveSession({ id: 'ts-test2', timestamp: 12345 });
        const session = await manager.getSession('ts-test2');
        assert.strictEqual(session.timestamp, 12345);
    });

    it('should close the database', async () => {
        await manager.open();
        manager.close();
        assert.strictEqual(manager.db, null);
    });

    it('should handle sync_error in network listener', async () => {
        const events = [];
        manager.onEvent((event, data) => events.push({ event, data }));

        manager.startNetworkListener(async () => {
            throw new Error('Sync failed');
        });

        triggerEvent('online');
        await new Promise(r => setTimeout(r, 10));

        assert.ok(events.some(e => e.event === 'sync_error'));
    });

    it('should notify session_saved event', async () => {
        const events = [];
        manager.onEvent((event, data) => events.push({ event, data }));

        await manager.saveSession({ id: 'notify-test' });
        assert.ok(events.some(e => e.event === 'session_saved' && e.data === 'notify-test'));
    });

    it('should notify queue_processed event', async () => {
        const events = [];
        manager.onEvent((event, data) => events.push({ event, data }));

        await manager.addToSyncQueue('session', { id: 1 });
        await manager.processSyncQueue(async () => true);

        assert.ok(events.some(e => e.event === 'queue_processed'));
    });
});

console.log('Running OfflineSessionManager tests...');
