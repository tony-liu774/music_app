const CACHE_NAME = 'concertmaster-v3';
const API_CACHE_NAME = 'concertmaster-api-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/public/styles.css',
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Playfair+Display:wght@600;700&family=Source+Sans+3:wght@400;500;600&display=swap'
];

// Offline API queue stored in IndexedDB via the service worker
const OFFLINE_QUEUE_DB = 'ConcertmasterSWQueue';
const OFFLINE_QUEUE_STORE = 'requests';
const SYNC_TAG = 'concertmaster-sync';
const MAX_QUEUE_RETRIES = 10;
const MAX_QUEUE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Open the service worker's IndexedDB queue for failed API requests
 */
function openQueueDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(OFFLINE_QUEUE_DB, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
                db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Queue a failed POST/PUT request for later replay.
 * Authorization headers are stripped — fresh tokens will be requested on replay.
 */
async function queueFailedRequest(request, body) {
    try {
        const db = await openQueueDB();
        const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(OFFLINE_QUEUE_STORE);

        // Collect headers but strip Authorization to avoid storing credentials
        const headers = {};
        for (const [key, value] of request.headers.entries()) {
            if (key.toLowerCase() !== 'authorization') {
                headers[key] = value;
            }
        }

        store.add({
            url: request.url,
            method: request.method,
            headers,
            body: body || null,
            timestamp: Date.now(),
            retries: 0
        });

        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch {
        return false;
    }
}

/**
 * Request a fresh auth token from the main thread via postMessage.
 * Returns the token string or null if unavailable.
 */
async function requestFreshToken() {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clients.length === 0) return null;

    return new Promise((resolve) => {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => resolve(null), 5000);

        channel.port1.onmessage = (event) => {
            clearTimeout(timeout);
            resolve(event.data && event.data.token ? event.data.token : null);
        };

        clients[0].postMessage({ type: 'REQUEST_AUTH_TOKEN' }, [channel.port2]);
    });
}

/**
 * Replay all queued requests with fresh auth tokens.
 * Entries exceeding MAX_QUEUE_RETRIES or MAX_QUEUE_AGE_MS are discarded.
 */
async function replayQueuedRequests() {
    try {
        const db = await openQueueDB();
        const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readonly');
        const store = tx.objectStore(OFFLINE_QUEUE_STORE);

        const items = await new Promise((resolve) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });

        if (items.length === 0) return;

        // Get a fresh token for authenticated requests
        const freshToken = await requestFreshToken();

        const successIds = [];
        const expiredIds = [];
        const retryIds = [];

        for (const item of items) {
            // Discard entries that are too old
            if (Date.now() - item.timestamp > MAX_QUEUE_AGE_MS) {
                expiredIds.push(item.id);
                continue;
            }

            // Discard entries that have exceeded max retries
            if ((item.retries || 0) >= MAX_QUEUE_RETRIES) {
                expiredIds.push(item.id);
                continue;
            }

            try {
                // Re-attach fresh Authorization header if we have a token
                const headers = { ...item.headers };
                if (freshToken) {
                    headers['Authorization'] = `Bearer ${freshToken}`;
                }

                // Don't send body for GET/HEAD requests
                const hasBody = item.method !== 'GET' && item.method !== 'HEAD';

                const response = await fetch(item.url, {
                    method: item.method,
                    headers,
                    body: hasBody ? item.body : undefined
                });

                if (response.ok) {
                    successIds.push(item.id);
                } else {
                    retryIds.push(item.id);
                }
            } catch {
                retryIds.push(item.id);
            }
        }

        // Remove successful and expired items, increment retries for failures
        const removeIds = [...successIds, ...expiredIds];
        if (removeIds.length > 0 || retryIds.length > 0) {
            await new Promise((resolve, reject) => {
                const writeTx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
                const writeStore = writeTx.objectStore(OFFLINE_QUEUE_STORE);

                for (const id of removeIds) {
                    writeStore.delete(id);
                }

                // Increment retry count for failed items
                for (const id of retryIds) {
                    const getReq = writeStore.get(id);
                    getReq.onsuccess = () => {
                        const entry = getReq.result;
                        if (entry) {
                            entry.retries = (entry.retries || 0) + 1;
                            writeStore.put(entry);
                        }
                    };
                }

                writeTx.oncomplete = () => resolve();
                writeTx.onerror = () => reject(writeTx.error);
            });
        }

        // Notify clients
        const clients = await self.clients.matchAll();
        for (const client of clients) {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                replayed: successIds.length,
                expired: expiredIds.length,
                remaining: retryIds.length
            });
        }
    } catch {
        // Queue replay failed - will retry on next sync
    }
}

// Install event - cache assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME && name !== API_CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - enhanced offline handling with API request queuing
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // API calls - network first, queue POST/PUT on failure
    if (url.pathname.startsWith('/api/')) {
        // For write requests, intercept and queue if offline
        if (event.request.method === 'POST' || event.request.method === 'PUT') {
            event.respondWith(
                event.request.clone().text().then(body => {
                    return fetch(event.request).catch(async () => {
                        // Queue the failed request for later replay
                        await queueFailedRequest(event.request, body);

                        // Register for background sync if available
                        if (self.registration && self.registration.sync) {
                            try {
                                await self.registration.sync.register(SYNC_TAG);
                            } catch {
                                // Background sync not supported
                            }
                        }

                        // Return a synthetic "queued" response
                        return new Response(
                            JSON.stringify({ status: 'queued', message: 'Request queued for sync' }),
                            { status: 202, headers: { 'Content-Type': 'application/json' } }
                        );
                    });
                })
            );
            return;
        }

        // GET requests - network first, cache in separate API cache (cleared on logout)
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Only cache successful non-authenticated GET responses
                    // Skip caching for authenticated API responses to avoid cross-user leakage
                    if (response.ok && !event.request.headers.has('Authorization')) {
                        const responseToCache = response.clone();
                        caches.open(API_CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Static assets - cache first
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(response => {
                    // Don't cache non-successful responses or cross-origin
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    // Clone and cache
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    return response;
                });
            })
            .catch(() => {
                // Return offline fallback
                return caches.match('/index.html');
            })
    );
});

// Background Sync - replay queued requests when connectivity returns
self.addEventListener('sync', event => {
    if (event.tag === SYNC_TAG) {
        event.waitUntil(replayQueuedRequests());
    }
});

// Message handler - allows the main thread to trigger sync or clear API cache on logout
self.addEventListener('message', event => {
    if (!event.data) return;

    if (event.data.type === 'TRIGGER_SYNC') {
        event.waitUntil(replayQueuedRequests());
    } else if (event.data.type === 'CLEAR_API_CACHE') {
        // Called on logout to prevent cross-user data leakage
        event.waitUntil(caches.delete(API_CACHE_NAME));
    }
});

// Export for testing
if (typeof module !== 'undefined') {
    module.exports = {
        queueFailedRequest,
        replayQueuedRequests,
        requestFreshToken,
        openQueueDB,
        CACHE_NAME,
        API_CACHE_NAME,
        MAX_QUEUE_RETRIES,
        MAX_QUEUE_AGE_MS,
        SYNC_TAG
    };
}
