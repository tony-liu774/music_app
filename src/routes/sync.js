const express = require('express');
const { authMiddleware } = require('./auth');

const router = express.Router();

// Allowed data types for sync - whitelist to prevent prototype pollution
const ALLOWED_SYNC_TYPES = ['sessions', 'library', 'preferences', 'progress'];

// In-memory data store per user (in production, use a database)
const userDataStore = new Map();

/**
 * Get or initialize user data store
 */
function getUserStore(userId) {
    if (!userDataStore.has(userId)) {
        userDataStore.set(userId, {
            sessions: [],
            library: [],
            preferences: {},
            progress: [],
            lastUpdated: 0
        });
    }
    return userDataStore.get(userId);
}

/**
 * POST /api/sync
 * Full sync - push local changes and pull server changes
 * Uses last-write-wins conflict resolution
 */
router.post('/', authMiddleware, (req, res) => {
    try {
        const userId = req.user.id;
        const { lastSync, data } = req.body;
        const store = getUserStore(userId);

        const conflicts = [];
        let pushed = 0;
        let pulled = 0;

        // Merge sessions
        if (data && data.sessions) {
            for (const session of data.sessions) {
                const existing = store.sessions.find(s => s.id === session.id);
                if (existing) {
                    if ((session.updatedAt || 0) > (existing.updatedAt || 0)) {
                        // Client version is newer
                        Object.assign(existing, session);
                        pushed++;
                    } else if ((session.updatedAt || 0) < (existing.updatedAt || 0)) {
                        conflicts.push({ type: 'sessions', local: session, server: existing });
                    }
                } else {
                    store.sessions.push(session);
                    pushed++;
                }
            }
        }

        // Merge preferences
        if (data && data.preferences) {
            const localTime = data.preferences.updatedAt || 0;
            const serverTime = store.preferences.updatedAt || 0;

            if (localTime > serverTime) {
                store.preferences = { ...data.preferences };
                pushed++;
            } else if (localTime < serverTime && localTime > 0) {
                conflicts.push({
                    type: 'preferences',
                    local: data.preferences,
                    server: store.preferences
                });
            }
        }

        // Merge progress
        if (data && data.progress) {
            for (const progress of data.progress) {
                const existing = store.progress.find(p => p.id === progress.id);
                if (existing) {
                    if ((progress.updatedAt || 0) > (existing.updatedAt || 0)) {
                        Object.assign(existing, progress);
                        pushed++;
                    } else if ((progress.updatedAt || 0) < (existing.updatedAt || 0)) {
                        conflicts.push({ type: 'progress', local: progress, server: existing });
                    }
                } else {
                    store.progress.push(progress);
                    pushed++;
                }
            }
        }

        // Get server data updated since last sync
        const serverSessions = lastSync
            ? store.sessions.filter(s => (s.updatedAt || 0) > lastSync)
            : store.sessions;
        const serverProgress = lastSync
            ? store.progress.filter(p => (p.updatedAt || 0) > lastSync)
            : store.progress;

        pulled = serverSessions.length + serverProgress.length;

        store.lastUpdated = Date.now();

        res.json({
            pushed,
            pulled,
            conflicts,
            serverData: {
                sessions: serverSessions,
                library: store.library,
                preferences: store.preferences,
                progress: serverProgress
            },
            syncTimestamp: Date.now()
        });
    } catch (error) {
        res.status(500).json({ error: 'Sync failed' });
    }
});

/**
 * POST /api/sync/queue
 * Process a single queued offline change
 */
router.post('/queue', authMiddleware, (req, res) => {
    try {
        const userId = req.user.id;
        const { type, action, data } = req.body;
        const store = getUserStore(userId);

        if (!type || !action || !data) {
            return res.status(400).json({ error: 'type, action, and data are required' });
        }

        // Whitelist check to prevent prototype pollution
        if (!ALLOWED_SYNC_TYPES.includes(type)) {
            return res.status(400).json({ error: `Invalid data type: ${type}` });
        }

        const collection = store[type];

        switch (action) {
            case 'create':
                if (type === 'preferences') {
                    store.preferences = { ...store.preferences, ...data };
                } else if (Array.isArray(collection)) {
                    collection.push(data);
                }
                break;

            case 'update':
                if (type === 'preferences') {
                    store.preferences = { ...store.preferences, ...data };
                } else if (Array.isArray(collection)) {
                    const idx = collection.findIndex(item => item.id === data.id);
                    if (idx >= 0) {
                        collection[idx] = { ...collection[idx], ...data };
                    } else {
                        collection.push(data);
                    }
                }
                break;

            case 'delete':
                if (Array.isArray(collection)) {
                    const deleteIdx = collection.findIndex(item => item.id === data.id);
                    if (deleteIdx >= 0) {
                        collection.splice(deleteIdx, 1);
                    }
                }
                break;

            default:
                return res.status(400).json({ error: `Invalid action: ${action}` });
        }

        store.lastUpdated = Date.now();

        res.json({ status: 'ok', type, action });
    } catch (error) {
        res.status(500).json({ error: 'Queue processing failed' });
    }
});

/**
 * GET /api/sync/status
 * Get sync status for the authenticated user
 */
router.get('/status', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const store = getUserStore(userId);

    res.json({
        lastUpdated: store.lastUpdated,
        sessionCount: store.sessions.length,
        progressCount: store.progress.length,
        hasPreferences: Object.keys(store.preferences).length > 0
    });
});

module.exports = router;
module.exports.userDataStore = userDataStore;
module.exports.getUserStore = getUserStore;
module.exports.ALLOWED_SYNC_TYPES = ALLOWED_SYNC_TYPES;
