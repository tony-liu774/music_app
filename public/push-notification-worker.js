/**
 * Push Notification Service Worker
 * Handles push notifications for the Music App
 */

const CACHE_NAME = 'music-app-v1';

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker installing.');
    self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating.');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Push event - handle incoming push notification
self.addEventListener('push', (event) => {
    console.log('Push event received:', event);

    let data = {
        title: 'Music App',
        body: 'You have a new notification',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: 'default',
        data: {}
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            console.error('Error parsing push data:', e);
        }
    }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        tag: data.tag,
        data: data.data,
        vibrate: [200, 100, 200],
        actions: [
            { action: 'open', title: 'Open' },
            { action: 'dismiss', title: 'Dismiss' }
        ],
        requireInteraction: false
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    const urlToOpen = '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Check if there's already a window open
                for (const client of windowClients) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open a new window if none exists
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Background sync for offline support
self.addEventListener('sync', (event) => {
    console.log('Background sync:', event.tag);

    if (event.tag === 'sync-snippets') {
        event.waitUntil(syncSnippets());
    }
});

async function syncSnippets() {
    // Sync any pending snippets when back online
    console.log('Syncing pending snippets...');
}

// Handle messages from the main app
self.addEventListener('message', (event) => {
    console.log('Service Worker received message:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
