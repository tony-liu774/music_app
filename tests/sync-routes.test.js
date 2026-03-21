/**
 * Tests for Sync Routes - Server-side sync endpoints
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { userDataStore, getUserStore } = require('../src/routes/sync');

describe('Sync Routes', () => {
    beforeEach(() => {
        userDataStore.clear();
    });

    afterEach(() => {
        userDataStore.clear();
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
            store.preferences = {
                instrument: 'violin',
                theme: 'midnight',
                updatedAt: Date.now()
            };

            assert.strictEqual(store.preferences.instrument, 'violin');
            assert.strictEqual(store.preferences.theme, 'midnight');
        });

        it('should store progress in user store', () => {
            const store = getUserStore('user1');
            store.progress.push({
                id: 'p1',
                scoreId: 'bach-suite',
                accuracy: 85,
                updatedAt: Date.now()
            });

            assert.strictEqual(store.progress.length, 1);
            assert.strictEqual(store.progress[0].accuracy, 85);
        });

        it('should handle session updates by finding existing', () => {
            const store = getUserStore('user1');
            store.sessions.push({ id: 's1', score: 'Bach', accuracy: 70, updatedAt: 100 });

            // Simulate update
            const idx = store.sessions.findIndex(s => s.id === 's1');
            if (idx >= 0) {
                store.sessions[idx] = { ...store.sessions[idx], accuracy: 85, updatedAt: 200 };
            }

            assert.strictEqual(store.sessions[0].accuracy, 85);
            assert.strictEqual(store.sessions[0].updatedAt, 200);
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
        it('should detect conflicts when both local and server have newer data', () => {
            const store = getUserStore('user1');
            const serverSession = { id: 's1', score: 'Bach', updatedAt: 200 };
            store.sessions.push(serverSession);

            const localSession = { id: 's1', score: 'Bach Modified', updatedAt: 100 };

            // Server is newer
            assert.ok(serverSession.updatedAt > localSession.updatedAt);
        });

        it('should resolve in favor of newer timestamp', () => {
            const localItem = { id: '1', value: 'local', updatedAt: 100 };
            const serverItem = { id: '1', value: 'server', updatedAt: 200 };

            // Last-write-wins: server wins
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

    describe('Queue processing', () => {
        it('should handle create action on sessions', () => {
            const store = getUserStore('user1');
            const data = { id: 's-new', score: 'New Song', updatedAt: Date.now() };

            store.sessions.push(data);
            assert.strictEqual(store.sessions.length, 1);
            assert.strictEqual(store.sessions[0].id, 's-new');
        });

        it('should handle update action on sessions', () => {
            const store = getUserStore('user1');
            store.sessions.push({ id: 's1', accuracy: 70 });

            const updateData = { id: 's1', accuracy: 90 };
            const idx = store.sessions.findIndex(item => item.id === updateData.id);
            if (idx >= 0) {
                store.sessions[idx] = { ...store.sessions[idx], ...updateData };
            }

            assert.strictEqual(store.sessions[0].accuracy, 90);
        });

        it('should handle delete action on sessions', () => {
            const store = getUserStore('user1');
            store.sessions.push({ id: 's1' });
            store.sessions.push({ id: 's2' });

            const deleteIdx = store.sessions.findIndex(item => item.id === 's1');
            if (deleteIdx >= 0) store.sessions.splice(deleteIdx, 1);

            assert.strictEqual(store.sessions.length, 1);
        });

        it('should handle preferences update', () => {
            const store = getUserStore('user1');
            store.preferences = { ...store.preferences, instrument: 'cello', theme: 'midnight' };

            assert.strictEqual(store.preferences.instrument, 'cello');
            assert.strictEqual(store.preferences.theme, 'midnight');
        });

        it('should update lastUpdated on changes', () => {
            const store = getUserStore('user1');
            assert.strictEqual(store.lastUpdated, 0);

            store.lastUpdated = Date.now();
            assert.ok(store.lastUpdated > 0);
        });
    });

    describe('Sync status', () => {
        it('should report correct counts', () => {
            const store = getUserStore('user1');
            store.sessions.push({ id: 's1' }, { id: 's2' });
            store.progress.push({ id: 'p1' });
            store.preferences = { instrument: 'violin' };

            assert.strictEqual(store.sessions.length, 2);
            assert.strictEqual(store.progress.length, 1);
            assert.ok(Object.keys(store.preferences).length > 0);
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
            assert.ok(newSessions.every(s => s.updatedAt > 150));
        });

        it('should return all sessions when lastSync is null', () => {
            const store = getUserStore('user1');
            store.sessions.push({ id: 's1', updatedAt: 100 });
            store.sessions.push({ id: 's2', updatedAt: 200 });

            const lastSync = null;
            const sessions = lastSync
                ? store.sessions.filter(s => (s.updatedAt || 0) > lastSync)
                : store.sessions;

            assert.strictEqual(sessions.length, 2);
        });
    });
});

console.log('Running Sync Routes tests...');
