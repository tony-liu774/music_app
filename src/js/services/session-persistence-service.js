/**
 * SessionPersistenceService - Keeps users logged in across restarts and bad Wi-Fi
 *
 * Enhances the basic AuthService with:
 * - Offline-resilient token refresh (doesn't logout when offline)
 * - Session heartbeat to detect stale sessions
 * - Auto-sync trigger when connectivity returns
 * - Coordinates with OfflineSessionManager for queued uploads
 */

class SessionPersistenceService {
    constructor(authService, offlineSessionManager, options = {}) {
        if (!authService) throw new Error('AuthService is required');

        this.authService = authService;
        this.offlineManager = offlineSessionManager || null;
        this.syncService = options.syncService || null;

        // Config
        this.heartbeatInterval = options.heartbeatInterval || 60000; // 1 minute
        this.maxOfflineDuration = options.maxOfflineDuration || 7 * 24 * 60 * 60 * 1000; // 7 days
        this.sessionKey = 'music_app_session_meta';

        // State
        this._heartbeatTimer = null;
        this._onlineHandler = null;
        this._offlineHandler = null;
        this._isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        this._syncInProgress = false;
        this.listeners = [];
    }

    /**
     * Initialize the persistence service - call on app startup
     * Restores session, starts heartbeat, listens for network changes
     * @returns {Promise<Object|null>} Current user or null if session expired
     */
    async initialize() {
        const session = this._getSessionMeta();
        const user = this.authService.getCurrentUser();

        if (!user || !session) {
            return null;
        }

        // Check if the session has been offline too long
        if (session.lastSeen && (Date.now() - session.lastSeen > this.maxOfflineDuration)) {
            this.authService.logout();
            this._clearSessionMeta();
            this._notifyListeners('session_expired', null);
            return null;
        }

        // Update last seen
        this._updateSessionMeta({ lastSeen: Date.now() });

        // Start heartbeat
        this._startHeartbeat();

        // Listen for network changes
        this._startNetworkListener();

        // If we're online, try to refresh the token silently
        if (this._isOnline) {
            await this._silentRefresh();
        }

        this._notifyListeners('session_restored', user);
        return user;
    }

    /**
     * Called after a successful login - sets up session tracking
     * @param {Object} user
     */
    onLogin(user) {
        this._updateSessionMeta({
            userId: user.id || user.email,
            loginAt: Date.now(),
            lastSeen: Date.now(),
            lastRefresh: Date.now()
        });

        this._startHeartbeat();
        this._startNetworkListener();
        this._notifyListeners('session_started', user);
    }

    /**
     * Called on logout - cleans up session tracking
     */
    onLogout() {
        this._clearSessionMeta();
        this._stopHeartbeat();
        this._stopNetworkListener();
        this._notifyListeners('session_ended', null);
    }

    /**
     * Check if the current session is valid (user is authenticated and session not expired)
     * @returns {boolean}
     */
    isSessionValid() {
        if (!this.authService.isAuthenticated()) return false;

        const session = this._getSessionMeta();
        if (!session) return false;

        if (session.lastSeen && (Date.now() - session.lastSeen > this.maxOfflineDuration)) {
            return false;
        }

        return true;
    }

    /**
     * Get session metadata
     * @returns {Object|null}
     */
    getSessionInfo() {
        const session = this._getSessionMeta();
        if (!session) return null;

        return {
            ...session,
            isOnline: this._isOnline,
            isAuthenticated: this.authService.isAuthenticated()
        };
    }

    /**
     * Trigger sync of all offline data when back online
     * @returns {Promise<Object>} Sync results
     */
    async syncOfflineData() {
        if (this._syncInProgress) {
            return { status: 'already_syncing' };
        }

        if (!this._isOnline) {
            return { status: 'offline' };
        }

        if (!this.authService.isAuthenticated()) {
            return { status: 'not_authenticated' };
        }

        this._syncInProgress = true;
        this._notifyListeners('sync_start', null);

        const results = { sessions: null, queue: null, cloudSync: null };

        try {
            // 1. Upload unsynced sessions from IndexedDB (user-scoped)
            if (this.offlineManager) {
                const session = this._getSessionMeta();
                const currentUserId = session && session.userId;
                const unsyncedSessions = await this.offlineManager.getUnsyncedSessions(currentUserId);

                if (unsyncedSessions.length > 0) {
                    const headers = await this.authService.getAuthHeaders();
                    headers['Content-Type'] = 'application/json';

                    let synced = 0;
                    for (const session of unsyncedSessions) {
                        try {
                            const response = await fetch('/api/sync/queue', {
                                method: 'POST',
                                headers,
                                body: JSON.stringify({
                                    type: 'sessions',
                                    action: 'create',
                                    data: session
                                })
                            });

                            if (response.ok) {
                                await this.offlineManager.markSynced(session.id);
                                synced++;
                            }
                        } catch {
                            // Network error during individual session sync - continue with others
                        }
                    }

                    results.sessions = { total: unsyncedSessions.length, synced };
                }

                // 2. Process the IndexedDB sync queue
                results.queue = await this.offlineManager.processSyncQueue(async (item) => {
                    const headers = await this.authService.getAuthHeaders();
                    headers['Content-Type'] = 'application/json';

                    const response = await fetch('/api/sync/queue', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(item.data || item)
                    });

                    return response.ok;
                });
            }

            // 3. Trigger full cloud sync if available
            if (this.syncService && typeof this.syncService.syncAll === 'function') {
                results.cloudSync = await this.syncService.syncAll();
            }

            this._notifyListeners('sync_complete', results);
            return { status: 'success', ...results };
        } catch (error) {
            this._notifyListeners('sync_error', error.message);
            return { status: 'error', error: error.message };
        } finally {
            this._syncInProgress = false;
        }
    }

    /**
     * Subscribe to session events
     * @param {Function} callback - Called with (event, data)
     * @returns {Function} Unsubscribe function
     */
    onEvent(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    /**
     * Tear down - call on app shutdown
     */
    destroy() {
        this._stopHeartbeat();
        this._stopNetworkListener();
        this.listeners = [];
    }

    // --- Private methods ---

    /**
     * Attempt to refresh the token silently.
     * Does not logout if offline — the stored token may still be valid for local use.
     * When online and an error occurs, notifies listeners so the issue is observable.
     * @private
     */
    async _silentRefresh() {
        try {
            const token = await this.authService.getToken();
            if (token) {
                this._updateSessionMeta({ lastRefresh: Date.now() });
                return true;
            }
        } catch (error) {
            if (!this._isOnline) return false;
            // Online but refresh failed — notify so the issue is observable
            this._notifyListeners('refresh_error', error && error.message);
        }
        return false;
    }

    /**
     * Heartbeat: periodically verify session state
     * @private
     */
    _startHeartbeat() {
        this._stopHeartbeat();
        this._heartbeatTimer = setInterval(() => {
            this._updateSessionMeta({ lastSeen: Date.now() });

            // Try silent refresh if online; catch to prevent unhandled rejection
            if (this._isOnline) {
                this._silentRefresh().catch(() => {});
            }
        }, this.heartbeatInterval);

        // Allow Node.js to exit even if timer is running (for tests)
        if (this._heartbeatTimer && typeof this._heartbeatTimer.unref === 'function') {
            this._heartbeatTimer.unref();
        }
    }

    /**
     * @private
     */
    _stopHeartbeat() {
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
    }

    /**
     * @private
     */
    _startNetworkListener() {
        if (typeof window === 'undefined') return;

        this._stopNetworkListener();

        this._onlineHandler = async () => {
            this._isOnline = true;
            this._notifyListeners('online', null);
            // Auto-sync when connectivity returns
            await this.syncOfflineData();
        };

        this._offlineHandler = () => {
            this._isOnline = false;
            this._notifyListeners('offline', null);
        };

        window.addEventListener('online', this._onlineHandler);
        window.addEventListener('offline', this._offlineHandler);
    }

    /**
     * @private
     */
    _stopNetworkListener() {
        if (typeof window === 'undefined') return;
        if (this._onlineHandler) {
            window.removeEventListener('online', this._onlineHandler);
        }
        if (this._offlineHandler) {
            window.removeEventListener('offline', this._offlineHandler);
        }
        this._onlineHandler = null;
        this._offlineHandler = null;
    }

    /**
     * @private
     */
    _getSessionMeta() {
        try {
            const raw = localStorage.getItem(this.sessionKey);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    /**
     * @private
     */
    _updateSessionMeta(updates) {
        const current = this._getSessionMeta() || {};
        const merged = { ...current, ...updates };
        try {
            localStorage.setItem(this.sessionKey, JSON.stringify(merged));
        } catch {
            // localStorage quota exceeded - non-critical
        }
    }

    /**
     * @private
     */
    _clearSessionMeta() {
        localStorage.removeItem(this.sessionKey);
    }

    /**
     * @private
     */
    _notifyListeners(event, data) {
        this.listeners.forEach(cb => cb(event, data));
    }
}

if (typeof window !== 'undefined') {
    window.SessionPersistenceService = SessionPersistenceService;
}
if (typeof module !== 'undefined') {
    module.exports = SessionPersistenceService;
}
