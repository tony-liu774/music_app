/**
 * Tests for Service Worker queue logic (queueFailedRequest, replayQueuedRequests)
 * Extracts and tests the core functions in isolation with mocked IndexedDB and fetch.
 *
 * The mock IDB uses a synchronous-resolve + deferred-setter pattern:
 * operations execute synchronously but onsuccess fires via the setter
 * when the caller assigns it after the method returns. This avoids
 * setTimeout-based timing issues with fire-and-forget write transactions.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// --- Mock IndexedDB for SW queue (synchronous with deferred setter) ---
let storeData = new Map();
let autoId = 1;

class MockIDBRequest {
    constructor() {
        this.result = undefined;
        this._onsuccess = null;
        this._onerror = null;
        this._resolved = false;
    }
    set onsuccess(fn) {
        this._onsuccess = fn;
        // If already resolved, fire immediately (deferred setter pattern)
        if (this._resolved && fn) fn({ target: this });
    }
    get onsuccess() { return this._onsuccess; }
    set onerror(fn) { this._onerror = fn; }
    get onerror() { return this._onerror; }
    _succeed(result) {
        this.result = result;
        this._resolved = true;
        if (this._onsuccess) this._onsuccess({ target: this });
    }
}

class MockIDBObjectStore {
    add(value) {
        const req = new MockIDBRequest();
        const id = autoId++;
        value.id = id;
        storeData.set(id, { ...value });
        req._succeed(id);
        return req;
    }
    getAll() {
        const req = new MockIDBRequest();
        req._succeed(Array.from(storeData.values()).map(v => ({ ...v })));
        return req;
    }
    get(id) {
        const req = new MockIDBRequest();
        const item = storeData.get(id);
        req._succeed(item ? { ...item } : undefined);
        return req;
    }
    put(value) {
        const req = new MockIDBRequest();
        storeData.set(value.id, { ...value });
        req._succeed(value.id);
        return req;
    }
    delete(id) {
        const req = new MockIDBRequest();
        storeData.delete(id);
        req._succeed(undefined);
        return req;
    }
}

class MockIDBTransaction {
    constructor() {
        this._oncomplete = null;
        this._onerror = null;
        this._completed = false;
    }
    set oncomplete(fn) {
        this._oncomplete = fn;
        if (this._completed && fn) fn();
    }
    get oncomplete() { return this._oncomplete; }
    set onerror(fn) { this._onerror = fn; }
    get onerror() { return this._onerror; }
    objectStore() { return new MockIDBObjectStore(); }
    _complete() {
        this._completed = true;
        if (this._oncomplete) this._oncomplete();
    }
}

class MockIDBDatabase {
    constructor() {
        this.objectStoreNames = { contains: () => true };
    }
    createObjectStore() { return new MockIDBObjectStore(); }
    transaction() {
        const tx = new MockIDBTransaction();
        // Complete via microtask so oncomplete fires after the caller sets it
        queueMicrotask(() => tx._complete());
        return tx;
    }
}

global.indexedDB = {
    open: () => {
        const req = new MockIDBRequest();
        const db = new MockIDBDatabase();
        req._succeed(db);
        return req;
    }
};

// Mock caches API (must be set before requiring sw.js)
global.caches = {
    open: async () => ({
        addAll: async () => {},
        put: async () => {},
        match: async () => undefined
    }),
    match: async () => undefined,
    keys: async () => [],
    delete: async () => true
};

// Mock Response (SW global)
global.Response = class Response {
    constructor(body, init = {}) {
        this.body = body;
        this.status = init.status || 200;
        this.headers = init.headers || {};
        this.ok = this.status >= 200 && this.status < 300;
        this.type = 'basic';
    }
    clone() { return new Response(this.body, { status: this.status, headers: this.headers }); }
};

// Mock self (SW global) — must include addEventListener for install/activate/fetch/sync/message handlers
const messagesSent = [];
const swEventListeners = {};

// Default matchAll implementation — responds with null token for requestFreshToken
function defaultMatchAll(opts) {
    if (opts && opts.type === 'window') {
        return [{
            postMessage: (msg, transfer) => {
                if (msg.type === 'REQUEST_AUTH_TOKEN' && transfer && transfer[0]) {
                    // Respond with null token via the MessageChannel port
                    transfer[0].postMessage({ token: null });
                }
            }
        }];
    }
    return [{
        postMessage: (msg, transfer) => messagesSent.push({ msg, transfer })
    }];
}

global.self = {
    addEventListener: (event, handler) => {
        if (!swEventListeners[event]) swEventListeners[event] = [];
        swEventListeners[event].push(handler);
    },
    skipWaiting: async () => {},
    clients: {
        matchAll: async (opts) => defaultMatchAll(opts),
        claim: async () => {}
    },
    registration: { sync: { register: async () => {} } }
};

// Mock MessageChannel - ports are connected so port2.postMessage triggers port1.onmessage
global.MessageChannel = class {
    constructor() {
        const channel = this;
        this.port1 = { onmessage: null };
        this.port2 = {
            postMessage: (data) => {
                // Trigger port1.onmessage synchronously (like deferred setter, works
                // because port1.onmessage is set before postMessage is called)
                if (channel.port1.onmessage) {
                    channel.port1.onmessage({ data });
                }
            },
            onmessage: null
        };
    }
};

// Mock fetch
let fetchMockFn;
global.fetch = async (...args) => {
    if (fetchMockFn) return fetchMockFn(...args);
    return { ok: true };
};

// Import the SW module
const sw = require('../sw.js');

describe('Service Worker Queue', () => {
    beforeEach(() => {
        storeData.clear();
        autoId = 1;
        messagesSent.length = 0;
        fetchMockFn = null;
        // Reset matchAll to default in case a test overrode it
        self.clients.matchAll = async (opts) => defaultMatchAll(opts);
    });

    describe('queueFailedRequest', () => {
        it('should strip Authorization header when queuing', async () => {
            const mockRequest = {
                url: 'http://localhost/api/sync',
                method: 'POST',
                headers: {
                    entries: () => [
                        ['content-type', 'application/json'],
                        ['authorization', 'Bearer secret-token-123']
                    ]
                }
            };

            const result = await sw.queueFailedRequest(mockRequest, '{"data":1}');
            assert.strictEqual(result, true);

            // Verify the queued item does NOT contain Authorization
            const items = Array.from(storeData.values());
            assert.strictEqual(items.length, 1);
            assert.strictEqual(items[0].headers['content-type'], 'application/json');
            assert.strictEqual(items[0].headers['authorization'], undefined);
            assert.strictEqual(items[0].headers['Authorization'], undefined);
            assert.strictEqual(items[0].body, '{"data":1}');
            assert.strictEqual(items[0].method, 'POST');
            assert.ok(items[0].timestamp);
            assert.strictEqual(items[0].retries, 0);
        });

        it('should store request url and method', async () => {
            const mockRequest = {
                url: 'http://localhost/api/sync/queue',
                method: 'PUT',
                headers: { entries: () => [] }
            };

            await sw.queueFailedRequest(mockRequest, null);

            const items = Array.from(storeData.values());
            assert.strictEqual(items[0].url, 'http://localhost/api/sync/queue');
            assert.strictEqual(items[0].method, 'PUT');
            assert.strictEqual(items[0].body, null);
        });
    });

    describe('replayQueuedRequests', () => {
        it('should replay queued items with fresh token', async () => {
            storeData.set(1, {
                id: 1,
                url: 'http://localhost/api/sync',
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: '{"data":1}',
                timestamp: Date.now(),
                retries: 0
            });

            // Override matchAll to return a fresh token
            self.clients.matchAll = async (opts) => {
                if (opts && opts.type === 'window') {
                    return [{
                        postMessage: (msg, transfer) => {
                            if (msg.type === 'REQUEST_AUTH_TOKEN' && transfer && transfer[0]) {
                                transfer[0].postMessage({ token: 'fresh-token-abc' });
                            }
                        }
                    }];
                }
                return [{ postMessage: (msg) => messagesSent.push({ msg }) }];
            };

            let capturedHeaders = null;
            fetchMockFn = async (url, opts) => {
                capturedHeaders = opts.headers;
                return { ok: true };
            };

            await sw.replayQueuedRequests();

            // The fresh token should have been attached
            assert.strictEqual(capturedHeaders['Authorization'], 'Bearer fresh-token-abc');

            // The item should be removed from the queue after success
            assert.strictEqual(storeData.size, 0);
        });

        it('should discard items older than MAX_QUEUE_AGE_MS', async () => {
            storeData.set(1, {
                id: 1,
                url: 'http://localhost/api/sync',
                method: 'POST',
                headers: {},
                body: null,
                timestamp: Date.now() - sw.MAX_QUEUE_AGE_MS - 1000,
                retries: 0
            });

            await sw.replayQueuedRequests();

            assert.strictEqual(storeData.size, 0);
        });

        it('should discard items exceeding MAX_QUEUE_RETRIES', async () => {
            storeData.set(1, {
                id: 1,
                url: 'http://localhost/api/sync',
                method: 'POST',
                headers: {},
                body: null,
                timestamp: Date.now(),
                retries: sw.MAX_QUEUE_RETRIES
            });

            await sw.replayQueuedRequests();

            assert.strictEqual(storeData.size, 0);
        });

        it('should increment retries on failed replay', async () => {
            storeData.set(1, {
                id: 1,
                url: 'http://localhost/api/sync',
                method: 'POST',
                headers: {},
                body: '{}',
                timestamp: Date.now(),
                retries: 0
            });

            fetchMockFn = async () => ({ ok: false, status: 500 });

            await sw.replayQueuedRequests();

            const item = storeData.get(1);
            assert.ok(item);
            assert.strictEqual(item.retries, 1);
        });

        it('should not send body for GET requests', async () => {
            storeData.set(1, {
                id: 1,
                url: 'http://localhost/api/data',
                method: 'GET',
                headers: {},
                body: 'should-not-be-sent',
                timestamp: Date.now(),
                retries: 0
            });

            let capturedBody = 'initial';
            fetchMockFn = async (url, opts) => {
                capturedBody = opts.body;
                return { ok: true };
            };

            await sw.replayQueuedRequests();

            assert.strictEqual(capturedBody, undefined);
        });

        it('should not send body for HEAD requests', async () => {
            storeData.set(1, {
                id: 1,
                url: 'http://localhost/api/data',
                method: 'HEAD',
                headers: {},
                body: 'should-not-be-sent',
                timestamp: Date.now(),
                retries: 0
            });

            let capturedBody = 'initial';
            fetchMockFn = async (url, opts) => {
                capturedBody = opts.body;
                return { ok: true };
            };

            await sw.replayQueuedRequests();

            assert.strictEqual(capturedBody, undefined);
        });

        it('should send body for POST requests', async () => {
            storeData.set(1, {
                id: 1,
                url: 'http://localhost/api/sync',
                method: 'POST',
                headers: {},
                body: '{"data":1}',
                timestamp: Date.now(),
                retries: 0
            });

            let capturedBody;
            fetchMockFn = async (url, opts) => {
                capturedBody = opts.body;
                return { ok: true };
            };

            await sw.replayQueuedRequests();

            assert.strictEqual(capturedBody, '{"data":1}');
        });

        it('should notify clients after replay', async () => {
            storeData.set(1, {
                id: 1,
                url: 'http://localhost/api/sync',
                method: 'POST',
                headers: {},
                body: '{}',
                timestamp: Date.now(),
                retries: 0
            });

            fetchMockFn = async () => ({ ok: true });

            await sw.replayQueuedRequests();

            assert.ok(messagesSent.some(m =>
                m.msg.type === 'SYNC_COMPLETE' && m.msg.replayed === 1
            ));
        });

        it('should handle fetch exceptions during replay', async () => {
            storeData.set(1, {
                id: 1,
                url: 'http://localhost/api/sync',
                method: 'POST',
                headers: {},
                body: '{}',
                timestamp: Date.now(),
                retries: 0
            });

            fetchMockFn = async () => { throw new TypeError('Failed to fetch'); };

            // Should not throw
            await sw.replayQueuedRequests();

            const item = storeData.get(1);
            assert.ok(item);
            assert.strictEqual(item.retries, 1);
        });
    });

    describe('Constants', () => {
        it('should export expected constants', () => {
            assert.strictEqual(sw.CACHE_NAME, 'concertmaster-v2');
            assert.strictEqual(sw.API_CACHE_NAME, 'concertmaster-api-v2');
            assert.strictEqual(sw.MAX_QUEUE_RETRIES, 10);
            assert.strictEqual(sw.MAX_QUEUE_AGE_MS, 7 * 24 * 60 * 60 * 1000);
            assert.strictEqual(sw.SYNC_TAG, 'concertmaster-sync');
        });
    });
});
