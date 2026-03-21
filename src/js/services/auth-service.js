/**
 * Auth Service - Client-side authentication for cloud sync
 * Handles user registration, login, token management, and session persistence
 */

class AuthService {
    constructor(apiBaseUrl = '') {
        this.apiBaseUrl = apiBaseUrl;
        this.tokenKey = 'music_app_auth_token';
        this.refreshTokenKey = 'music_app_refresh_token';
        this.userKey = 'music_app_user';
        this.listeners = [];
        this._refreshPromise = null;
    }

    /**
     * Register a new user
     * @param {string} email
     * @param {string} password
     * @param {string} displayName
     * @returns {Promise<Object>} User object with tokens
     */
    async register(email, password, displayName) {
        if (!email || !password) {
            throw new Error('Email and password are required');
        }
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters');
        }

        const response = await fetch(`${this.apiBaseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, displayName })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Registration failed');
        }

        const data = await response.json();
        this._storeAuth(data);
        this._notifyListeners('login', data.user);
        return data.user;
    }

    /**
     * Login with email and password
     * @param {string} email
     * @param {string} password
     * @returns {Promise<Object>} User object with tokens
     */
    async login(email, password) {
        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        const response = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }

        const data = await response.json();
        this._storeAuth(data);
        this._notifyListeners('login', data.user);
        return data.user;
    }

    /**
     * Logout and clear stored credentials
     */
    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.refreshTokenKey);
        localStorage.removeItem(this.userKey);
        this._refreshPromise = null;
        this._notifyListeners('logout', null);
    }

    /**
     * Get the current auth token, refreshing if expired.
     * Concurrent calls share the same refresh promise to prevent race conditions.
     * @returns {Promise<string|null>} Valid auth token or null
     */
    async getToken() {
        const token = localStorage.getItem(this.tokenKey);
        if (!token) return null;

        if (this._isTokenExpired(token)) {
            // Cache the refresh promise so concurrent callers share one request
            if (!this._refreshPromise) {
                this._refreshPromise = this._refreshToken().finally(() => {
                    this._refreshPromise = null;
                });
            }
            return this._refreshPromise;
        }

        return token;
    }

    /**
     * Get the currently authenticated user
     * @returns {Object|null} User object or null
     */
    getCurrentUser() {
        const userJson = localStorage.getItem(this.userKey);
        if (!userJson) return null;
        try {
            return JSON.parse(userJson);
        } catch {
            return null;
        }
    }

    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return !!localStorage.getItem(this.tokenKey);
    }

    /**
     * Subscribe to auth state changes
     * @param {Function} callback - Called with (event, user)
     * @returns {Function} Unsubscribe function
     */
    onAuthStateChange(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    /**
     * Get authorization headers for API requests
     * @returns {Promise<Object>} Headers object with Authorization
     */
    async getAuthHeaders() {
        const token = await this.getToken();
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
    }

    /**
     * Refresh the auth token using the refresh token
     * @returns {Promise<string|null>} New token or null
     * @private
     */
    async _refreshToken() {
        const refreshToken = localStorage.getItem(this.refreshTokenKey);
        if (!refreshToken) {
            this.logout();
            return null;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            if (!response.ok) {
                this.logout();
                return null;
            }

            const data = await response.json();
            localStorage.setItem(this.tokenKey, data.token);
            if (data.refreshToken) {
                localStorage.setItem(this.refreshTokenKey, data.refreshToken);
            }
            return data.token;
        } catch {
            this.logout();
            return null;
        }
    }

    /**
     * Check if a JWT token is expired
     * Adds a 60-second buffer so we refresh before actual expiry
     * @param {string} token - JWT token
     * @returns {boolean}
     * @private
     */
    _isTokenExpired(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp * 1000 < Date.now() + 60000;
        } catch {
            return true;
        }
    }

    /**
     * Store auth data in localStorage
     * @param {Object} data - Auth response with token, refreshToken, user
     * @private
     */
    _storeAuth(data) {
        localStorage.setItem(this.tokenKey, data.token);
        if (data.refreshToken) {
            localStorage.setItem(this.refreshTokenKey, data.refreshToken);
        }
        if (data.user) {
            localStorage.setItem(this.userKey, JSON.stringify(data.user));
        }
    }

    /**
     * Notify listeners of auth state changes
     * @param {string} event - Event type
     * @param {Object|null} user - User object
     * @private
     */
    _notifyListeners(event, user) {
        this.listeners.forEach(cb => cb(event, user));
    }
}

if (typeof window !== 'undefined') {
    window.AuthService = AuthService;
}
if (typeof module !== 'undefined') {
    module.exports = AuthService;
}
