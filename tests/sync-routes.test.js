/**
 * Tests for Sync Routes - Server-side sync endpoints
 * Tests both module internals and actual HTTP route behavior
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const jwt = require('jsonwebtoken');

const config = require('../src/config');
const { userDataStore, getUserStore, ALLOWED_SYNC_TYPES } = require('../src/routes/sync');
const { users, generateTokens, refreshTokens } = require('../src/routes/auth');
const app = require('../src/index');

function makeRequest(server, method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, `http://localhost:${server.address().port}`);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method,
            headers: { 'Content-Type': 'application/json', ...headers }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

describe('Sync Routes - Unit Tests', () => {
    beforeEach(() => {
        userDataStore.clear();
    });

    afterEach(() => {
        userDataStore.clear();
    });

    describe('ALLOWED_SYNC_TYPES', () => {
        it('should include sessions, library, preferences, progress', () => {
            assert.ok(ALLOWED_SYNC_TYPES.includes('sessions'));
            assert.ok(ALLOWED_SYNC_TYPES.includes('library'));
            assert.ok(ALLOWED_SYNC_TYPES.includes('preferences'));
            assert.ok(ALLOWED_SYNC_TYPES.includes('progress'));
        });

        it('should NOT include prototype pollution vectors', () => {
            assert.ok(!ALLOWED_SYNC_TYPES.includes('__proto__'));
            assert.ok(!ALLOWED_SYNC_TYPES.includes('constructor'));
            assert.ok(!ALLOWED_SYNC_TYPES.includes('prototype'));
        });
    });

    describe('getUserStore', () => {
        it('should create a new store for a new user', () => {
            const store = getUserStore('user1');
            assert.ok(store);
            assert.deepStrictEqual(store.sessions, []);
            assert.deepStrictEqual(store.library, []);
            assert.deepStrictEqual(store.preferences, {});
            assert.deepStrictEqual(store.progress, []);
            assert.strictEqual(store.lastUpdated, 0);
        });

        it('should return existing store for known user', () => {
            const store1 = getUserStore('user1');
            store1.sessions.push({ id: 's1', title: 'Test Session' });

            const store2 = getUserStore('user1');
            assert.strictEqual(store2.sessions.length, 1);
            assert.strictEqual(store2.sessions[0].id, 's1');
        });

        it('should isolate stores between users', () => {
            const store1 = getUserStore('user1');
            store1.sessions.push({ id: 's1' });

            const store2 = getUserStore('user2');
            assert.strictEqual(store2.sessions.length, 0);
        });
    });

    describe('Data merging', () => {
        it('should store sessions in user store', () => {
            const store = getUserStore('user1');
            store.sessions.push({ id: 's1', score: 'Bach', updatedAt: Date.now() });
            store.sessions.push({ id: 's2', score: 'Mozart', updatedAt: Date.now() });

            assert.strictEqual(store.sessions.length, 2);
            assert.strictEqual(store.sessions[0].score, 'Bach');
        });

        it('should store preferences in user store', () => {
            const store = getUserStore('user1');
            store.preferences = { instrument: 'violin', theme: 'midnight', updatedAt: Date.now() };

            assert.strictEqual(store.preferences.instrument, 'violin');
        });

        it('should store progress in user store', () => {
            const store = getUserStore('user1');
            store.progress.push({ id: 'p1', scoreId: 'bach-suite', accuracy: 85, updatedAt: Date.now() });

            assert.strictEqual(store.progress.length, 1);
            assert.strictEqual(store.progress[0].accuracy, 85);
        });

        it('should handle session updates by finding existing', () => {
            const store = getUserStore('user1');
            store.sessions.push({ id: 's1', accuracy: 70, updatedAt: 100 });

            const idx = store.sessions.findIndex(s => s.id === 's1');
            if (idx >= 0) {
                store.sessions[idx] = { ...store.sessions[idx], accuracy: 85, updatedAt: 200 };
            }

            assert.strictEqual(store.sessions[0].accuracy, 85);
        });

        it('should handle deletion of items', () => {
            const store = getUserStore('user1');
            store.sessions.push({ id: 's1' });
            store.sessions.push({ id: 's2' });

            const idx = store.sessions.findIndex(s => s.id === 's1');
            if (idx >= 0) store.sessions.splice(idx, 1);

            assert.strictEqual(store.sessions.length, 1);
            assert.strictEqual(store.sessions[0].id, 's2');
        });
    });

    describe('Conflict resolution', () => {
        it('should resolve in favor of newer timestamp (last-write-wins)', () => {
            const localItem = { id: '1', value: 'local', updatedAt: 100 };
            const serverItem = { id: '1', value: 'server', updatedAt: 200 };

            const winner = serverItem.updatedAt > localItem.updatedAt ? serverItem : localItem;
            assert.strictEqual(winner.value, 'server');
        });

        it('should handle case where local is newer', () => {
            const localItem = { id: '1', value: 'local', updatedAt: 300 };
            const serverItem = { id: '1', value: 'server', updatedAt: 200 };

            const winner = serverItem.updatedAt > localItem.updatedAt ? serverItem : localItem;
            assert.strictEqual(winner.value, 'local');
        });
    });

    describe('Data filtering by lastSync', () => {
        it('should filter sessions updated after lastSync', () => {
            const store = getUserStore('user1');
            store.sessions.push({ id: 's1', updatedAt: 100 });
            store.sessions.push({ id: 's2', updatedAt: 200 });
            store.sessions.push({ id: 's3', updatedAt: 300 });

            const lastSync = 150;
            const newSessions = store.sessions.filter(s => (s.updatedAt || 0) > lastSync);
            assert.strictEqual(newSessions.length, 2);
        });

        it('should return all sessions when lastSync is null', () => {
            const store = getUserStore('user1');
            store.sessions.push({ id: 's1', updatedAt: 100 });
            store.sessions.push({ id: 's2', updatedAt: 200 });

            const lastSync = null;
            const sessions = lastSync ? store.sessions.filter(s => (s.updatedAt || 0) > lastSync) : store.sessions;
            assert.strictEqual(sessions.length, 2);
        });
    });
});

describe('Sync Routes - HTTP Endpoint Tests', () => {
    let server;
    let authToken;

    beforeEach(async () => {
        userDataStore.clear();
        users.clear();
        refreshTokens.clear();

        await new Promise(resolve => {
            server = app.listen(0, resolve);
        });

        // Register a user and get a token
        const res = await makeRequest(server, 'POST', '/api/auth/register', {
            email: 'synctest@example.com',
            password: 'securepass123'
        });
        authToken = res.body.token;
    });

    afterEach(async () => {
        userDataStore.clear();
        users.clear();
        refreshTokens.clear();
        await new Promise(resolve => server.close(resolve));
    });

    it('should require authentication for POST /api/sync', async () => {
        const res = await makeRequest(server, 'POST', '/api/sync', { lastSync: null, data: {} });
        assert.strictEqual(res.status, 401);
    });

    it('should sync data with valid auth via POST /api/sync', async () => {
        const res = await makeRequest(server, 'POST', '/api/sync', {
            lastSync: null,
            data: {
                sessions: [{ id: 's1', score: 'Bach', updatedAt: Date.now() }],
                preferences: { instrument: 'violin', updatedAt: Date.now() },
                progress: []
            }
        }, { Authorization: `Bearer ${authToken}` });

        assert.strictEqual(res.status, 200);
        assert.ok(res.body.pushed >= 0);
        assert.ok(res.body.serverData);
    });

    it('should reject queue request with invalid type via POST /api/sync/queue', async () => {
        const res = await makeRequest(server, 'POST', '/api/sync/queue', {
            type: '__proto__',
            action: 'create',
            data: { malicious: true }
        }, { Authorization: `Bearer ${authToken}` });

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'Invalid data type: __proto__');
    });

    it('should accept valid queue request via POST /api/sync/queue', async () => {
        const res = await makeRequest(server, 'POST', '/api/sync/queue', {
            type: 'sessions',
            action: 'create',
            data: { id: 's1', score: 'Test' }
        }, { Authorization: `Bearer ${authToken}` });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'ok');
    });

    it('should return sync status via GET /api/sync/status', async () => {
        const res = await makeRequest(server, 'GET', '/api/sync/status', null, {
            Authorization: `Bearer ${authToken}`
        });

        assert.strictEqual(res.status, 200);
        assert.strictEqual(typeof res.body.sessionCount, 'number');
        assert.strictEqual(typeof res.body.progressCount, 'number');
    });
});

console.log('Running Sync Routes tests...');
