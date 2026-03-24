/**
 * Service Worker for The Virtual Concertmaster (Vite/React build).
 *
 * Caching strategy:
 *  - Static assets (JS, CSS, fonts, images): cache-first
 *  - API GET requests: network-first with API cache fallback
 *  - API POST/PUT: network-first, queued in IndexedDB on failure
 *  - Navigation: network-first with index.html fallback (SPA)
 */

const CACHE_NAME = 'concertmaster-v4'
const API_CACHE_NAME = 'concertmaster-api-v3'
const OFFLINE_QUEUE_DB = 'ConcertmasterSWQueue'
const OFFLINE_QUEUE_STORE = 'requests'
const SYNC_TAG = 'concertmaster-sync'
const MAX_QUEUE_RETRIES = 10
const MAX_QUEUE_AGE_MS = 7 * 24 * 60 * 60 * 1000

// Vite build output uses hashed filenames — we precache the shell
// and let runtime caching handle the rest
const PRECACHE_URLS = ['/', '/index.html']

// ---------------------------------------------------------------------------
// IndexedDB queue for failed API mutations
// ---------------------------------------------------------------------------

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_QUEUE_DB, 1)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
        db.createObjectStore(OFFLINE_QUEUE_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        })
      }
    }
    request.onsuccess = (event) => resolve(event.target.result)
    request.onerror = (event) => reject(event.target.error)
  })
}

async function queueFailedRequest(request, body) {
  try {
    const db = await openQueueDB()
    const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite')
    const store = tx.objectStore(OFFLINE_QUEUE_STORE)

    const headers = {}
    for (const [key, value] of request.headers.entries()) {
      if (key.toLowerCase() !== 'authorization') {
        headers[key] = value
      }
    }

    store.add({
      url: request.url,
      method: request.method,
      headers,
      body: body || null,
      timestamp: Date.now(),
      retries: 0,
    })

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

async function requestFreshToken() {
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  if (clients.length === 0) return null

  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const timeout = setTimeout(() => resolve(null), 5000)

    channel.port1.onmessage = (event) => {
      clearTimeout(timeout)
      resolve(event.data && event.data.token ? event.data.token : null)
    }

    clients[0].postMessage({ type: 'REQUEST_AUTH_TOKEN' }, [channel.port2])
  })
}

async function replayQueuedRequests() {
  try {
    const db = await openQueueDB()
    const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readonly')
    const store = tx.objectStore(OFFLINE_QUEUE_STORE)

    const items = await new Promise((resolve) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => resolve([])
    })

    if (items.length === 0) return

    const freshToken = await requestFreshToken()
    const successIds = []
    const expiredIds = []
    const retryIds = []

    for (const item of items) {
      if (Date.now() - item.timestamp > MAX_QUEUE_AGE_MS) {
        expiredIds.push(item.id)
        continue
      }
      if ((item.retries || 0) >= MAX_QUEUE_RETRIES) {
        expiredIds.push(item.id)
        continue
      }

      try {
        const headers = { ...item.headers }
        if (freshToken) {
          headers['Authorization'] = `Bearer ${freshToken}`
        }

        const hasBody = item.method !== 'GET' && item.method !== 'HEAD'
        const response = await fetch(item.url, {
          method: item.method,
          headers,
          body: hasBody ? item.body : undefined,
        })

        if (response.ok) {
          successIds.push(item.id)
        } else {
          retryIds.push(item.id)
        }
      } catch {
        retryIds.push(item.id)
      }
    }

    const removeIds = [...successIds, ...expiredIds]
    if (removeIds.length > 0 || retryIds.length > 0) {
      await new Promise((resolve, reject) => {
        const writeTx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite')
        const writeStore = writeTx.objectStore(OFFLINE_QUEUE_STORE)

        for (const id of removeIds) {
          writeStore.delete(id)
        }
        for (const id of retryIds) {
          const getReq = writeStore.get(id)
          getReq.onsuccess = () => {
            const entry = getReq.result
            if (entry) {
              entry.retries = (entry.retries || 0) + 1
              writeStore.put(entry)
            }
          }
        }

        writeTx.oncomplete = () => resolve()
        writeTx.onerror = () => reject(writeTx.error)
      })
    }

    const clients = await self.clients.matchAll()
    for (const client of clients) {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        replayed: successIds.length,
        expired: expiredIds.length,
        remaining: retryIds.length,
      })
    }
  } catch {
    // Will retry on next sync
  }
}

// ---------------------------------------------------------------------------
// Lifecycle events
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (name) => name !== CACHE_NAME && name !== API_CACHE_NAME,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// ---------------------------------------------------------------------------
// Fetch handler
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API calls
  if (url.pathname.startsWith('/api/')) {
    if (
      event.request.method === 'POST' ||
      event.request.method === 'PUT'
    ) {
      event.respondWith(
        event.request
          .clone()
          .text()
          .then((body) =>
            fetch(event.request).catch(async () => {
              await queueFailedRequest(event.request, body)

              if (self.registration && self.registration.sync) {
                try {
                  await self.registration.sync.register(SYNC_TAG)
                } catch {
                  // Background sync not supported
                }
              }

              return new Response(
                JSON.stringify({
                  status: 'queued',
                  message: 'Request queued for sync',
                }),
                {
                  status: 202,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            }),
          ),
      )
      return
    }

    // GET — network first, cache fallback
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (
            response.ok &&
            !event.request.headers.has('Authorization')
          ) {
            const clone = response.clone()
            caches
              .open(API_CACHE_NAME)
              .then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => caches.match(event.request)),
    )
    return
  }

  // Static assets with hashed filenames (Vite) — cache first
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|png|jpg|svg|ico|webp)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone()
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(event.request, clone))
            }
            return response
          }),
      ),
    )
    return
  }

  // Navigation — network first, fall back to cached index.html (SPA)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html')),
    )
    return
  }

  // Everything else — network with cache fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  )
})

// ---------------------------------------------------------------------------
// Background Sync & Messages
// ---------------------------------------------------------------------------

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(replayQueuedRequests())
  }
})

self.addEventListener('message', (event) => {
  if (!event.data) return

  if (event.data.type === 'TRIGGER_SYNC') {
    event.waitUntil(replayQueuedRequests())
  } else if (event.data.type === 'CLEAR_API_CACHE') {
    event.waitUntil(caches.delete(API_CACHE_NAME))
  }
})
