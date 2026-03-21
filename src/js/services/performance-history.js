/**
 * Performance History - Tracks and stores practice sessions
 */

class PerformanceHistory {
    constructor() {
        this.db = null;
        this.sessions = [];
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ConcertmasterHistory', 1);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                this.db = request.result;
                this.loadSessions();
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('sessions')) {
                    db.createObjectStore('sessions', { keyPath: 'id' });
                }
            };
        });
    }

    async loadSessions() {
        if (!this.db) return [];

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readonly');
            const store = transaction.objectStore('sessions');
            const request = store.getAll();

            request.onsuccess = () => {
                this.sessions = request.result || [];
                resolve(this.sessions);
            };

            request.onerror = () => reject(request.error);
        });
    }

    async saveSession(session) {
        if (!this.db) return;

        session.id = session.id || crypto.randomUUID();
        session.completedAt = session.completedAt || new Date().toISOString();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');
            const request = store.add(session);

            request.onsuccess = () => {
                this.sessions.push(session);
                resolve(session);
            };

            request.onerror = () => reject(request.error);
        });
    }

    getSessionsForScore(scoreId) {
        return this.sessions.filter(s => s.scoreId === scoreId);
    }

    getRecentSessions(limit = 10) {
        return this.sessions
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
            .slice(0, limit);
    }
}

window.PerformanceHistory = PerformanceHistory;