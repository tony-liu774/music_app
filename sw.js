const CACHE_NAME = 'concertmaster-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/src/css/themes/midnight-conservatory.css',
    '/src/css/styles.css',
    '/src/js/services/offline-session-manager.js',
    '/src/js/services/session-persistence-service.js',
    '/src/js/services/auth-service.js',
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Playfair+Display:wght@600;700&family=Source+Sans+3:wght@400;500;600&display=swap'
];

// Offline API queue stored in IndexedDB via the service worker
const OFFLINE_QUEUE_DB = 'ConcertmasterSWQueue';
const OFFLINE_QUEUE_STORE = 'requests';
const SYNC_TAG = 'concertmaster-sync';

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
 * Queue a failed POST/PUT request for later replay
 */
async function queueFailedRequest(request, body) {
    try {
        const db = await openQueueDB();
        const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(OFFLINE_QUEUE_STORE);

        const headers = {};
        for (const [key, value] of request.headers.entries()) {
            headers[key] = value;
        }

        store.add({
            url: request.url,
            method: request.method,
            headers,
            body: body || null,
            timestamp: Date.now()
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
 * Replay all queued requests
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

        const successIds = [];
        for (const item of items) {
            try {
                const response = await fetch(item.url, {
                    method: item.method,
                    headers: item.headers,
                    body: item.body
                });
                if (response.ok) {
                    successIds.push(item.id);
                }
            } catch {
                // Still offline or server error - leave in queue
            }
        }

        // Remove successfully replayed items
        if (successIds.length > 0) {
            const deleteTx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
            const deleteStore = deleteTx.objectStore(OFFLINE_QUEUE_STORE);
            for (const id of successIds) {
                deleteStore.delete(id);
            }
        }

        // Notify clients
        const clients = await self.clients.matchAll();
        for (const client of clients) {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                replayed: successIds.length,
                remaining: items.length - successIds.length
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
                console.log('Concertmaster: Caching app assets');
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
                    .filter(name => name !== CACHE_NAME)
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
        // For sync and session endpoints, intercept and queue if offline
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

        // GET requests - network first with cache fallback
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache successful GET API responses for offline access
                    if (response.ok) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
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

// Message handler - allows the main thread to trigger sync
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'TRIGGER_SYNC') {
        replayQueuedRequests();
    }
});
