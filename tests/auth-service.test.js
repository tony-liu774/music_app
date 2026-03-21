/**
 * Tests for AuthService - Client-side authentication
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

// Mock fetch
let fetchMock;
function setupFetch(response, ok = true, status = 200) {
    fetchMock = async () => ({
        ok,
        status,
        json: async () => response
    });
}

// Inline AuthService for testing (same pattern as session-logger.test.js)
class AuthService {
    constructor(apiBaseUrl = '') {
        this.apiBaseUrl = apiBaseUrl;
        this.tokenKey = 'music_app_auth_token';
        this.refreshTokenKey = 'music_app_refresh_token';
        this.userKey = 'music_app_user';
        this.listeners = [];
    }

    async register(email, password, displayName) {
        if (!email || !password) throw new Error('Email and password are required');
        if (password.length < 8) throw new Error('Password must be at least 8 characters');

        const response = await fetchMock(`${this.apiBaseUrl}/api/auth/register`, {
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

    async login(email, password) {
        if (!email || !password) throw new Error('Email and password are required');

        const response = await fetchMock(`${this.apiBaseUrl}/api/auth/login`, {
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

    logout() {
        localStorageMock.removeItem(this.tokenKey);
        localStorageMock.removeItem(this.refreshTokenKey);
        localStorageMock.removeItem(this.userKey);
        this._notifyListeners('logout', null);
    }

    async getToken() {
        const token = localStorageMock.getItem(this.tokenKey);
        if (!token) return null;
        if (this._isTokenExpired(token)) return this._refreshToken();
        return token;
    }

    getCurrentUser() {
        const userJson = localStorageMock.getItem(this.userKey);
        if (!userJson) return null;
        try { return JSON.parse(userJson); } catch { return null; }
    }

    isAuthenticated() {
        return !!localStorageMock.getItem(this.tokenKey);
    }

    onAuthStateChange(callback) {
        this.listeners.push(callback);
        return () => { this.listeners = this.listeners.filter(l => l !== callback); };
    }

    async getAuthHeaders() {
        const token = await this.getToken();
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
    }

    async _refreshToken() {
        const refreshToken = localStorageMock.getItem(this.refreshTokenKey);
        if (!refreshToken) { this.logout(); return null; }

        try {
            const response = await fetchMock(`${this.apiBaseUrl}/api/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            if (!response.ok) { this.logout(); return null; }

            const data = await response.json();
            localStorageMock.setItem(this.tokenKey, data.token);
            if (data.refreshToken) localStorageMock.setItem(this.refreshTokenKey, data.refreshToken);
            return data.token;
        } catch { this.logout(); return null; }
    }

    _isTokenExpired(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return true;
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            return payload.exp * 1000 < Date.now() + 60000;
        } catch { return true; }
    }

    _storeAuth(data) {
        localStorageMock.setItem(this.tokenKey, data.token);
        if (data.refreshToken) localStorageMock.setItem(this.refreshTokenKey, data.refreshToken);
        if (data.user) localStorageMock.setItem(this.userKey, JSON.stringify(data.user));
    }

    _notifyListeners(event, user) {
        this.listeners.forEach(cb => cb(event, user));
    }
}

// Helper to create a mock JWT
function createMockJWT(payload = {}, expInSeconds = 3600) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const body = Buffer.from(JSON.stringify({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + expInSeconds
    })).toString('base64');
    return `${header}.${body}.mock-signature`;
}

describe('AuthService', () => {
    let auth;

    beforeEach(() => {
        localStorageMock.clear();
        auth = new AuthService('http://localhost:3000');
    });

    afterEach(() => {
        auth = null;
        localStorageMock.clear();
    });

    it('should initialize in unauthenticated state', () => {
        assert.strictEqual(auth.isAuthenticated(), false);
        assert.strictEqual(auth.getCurrentUser(), null);
    });

    it('should validate email and password on register', async () => {
        await assert.rejects(
            () => auth.register('', 'password123'),
            { message: 'Email and password are required' }
        );
    });

    it('should validate password length on register', async () => {
        await assert.rejects(
            () => auth.register('test@test.com', 'short'),
            { message: 'Password must be at least 8 characters' }
        );
    });

    it('should register a user successfully', async () => {
        const mockToken = createMockJWT({ id: 'user1', email: 'test@test.com' });
        setupFetch({
            token: mockToken,
            refreshToken: 'refresh-token-123',
            user: { id: 'user1', email: 'test@test.com', displayName: 'Test' }
        });

        const user = await auth.register('test@test.com', 'password123', 'Test');
        assert.strictEqual(user.email, 'test@test.com');
        assert.strictEqual(user.displayName, 'Test');
        assert.strictEqual(auth.isAuthenticated(), true);
    });

    it('should login a user successfully', async () => {
        const mockToken = createMockJWT({ id: 'user1', email: 'test@test.com' });
        setupFetch({
            token: mockToken,
            refreshToken: 'refresh-token-123',
            user: { id: 'user1', email: 'test@test.com', displayName: 'Test' }
        });

        const user = await auth.login('test@test.com', 'password123');
        assert.strictEqual(user.email, 'test@test.com');
        assert.strictEqual(auth.isAuthenticated(), true);
    });

    it('should handle login failure', async () => {
        setupFetch({ error: 'Invalid credentials' }, false, 401);

        await assert.rejects(
            () => auth.login('test@test.com', 'wrong-password'),
            { message: 'Invalid credentials' }
        );
    });

    it('should logout and clear credentials', async () => {
        const mockToken = createMockJWT({ id: 'user1', email: 'test@test.com' });
        setupFetch({
            token: mockToken,
            refreshToken: 'refresh-token-123',
            user: { id: 'user1', email: 'test@test.com', displayName: 'Test' }
        });

        await auth.login('test@test.com', 'password123');
        assert.strictEqual(auth.isAuthenticated(), true);

        auth.logout();
        assert.strictEqual(auth.isAuthenticated(), false);
        assert.strictEqual(auth.getCurrentUser(), null);
    });

    it('should get current user from storage', async () => {
        localStorageMock.setItem('music_app_user', JSON.stringify({
            id: 'user1', email: 'test@test.com', displayName: 'Test'
        }));

        const user = auth.getCurrentUser();
        assert.strictEqual(user.email, 'test@test.com');
    });

    it('should return null for invalid user JSON', () => {
        localStorageMock.setItem('music_app_user', 'invalid-json');
        assert.strictEqual(auth.getCurrentUser(), null);
    });

    it('should get token when not expired', async () => {
        const mockToken = createMockJWT({ id: 'user1' }, 3600);
        localStorageMock.setItem('music_app_auth_token', mockToken);

        const token = await auth.getToken();
        assert.strictEqual(token, mockToken);
    });

    it('should detect expired tokens', () => {
        const expiredToken = createMockJWT({ id: 'user1' }, -100);
        assert.strictEqual(auth._isTokenExpired(expiredToken), true);
    });

    it('should detect valid tokens', () => {
        const validToken = createMockJWT({ id: 'user1' }, 3600);
        assert.strictEqual(auth._isTokenExpired(validToken), false);
    });

    it('should get auth headers when authenticated', async () => {
        const mockToken = createMockJWT({ id: 'user1' }, 3600);
        localStorageMock.setItem('music_app_auth_token', mockToken);

        const headers = await auth.getAuthHeaders();
        assert.strictEqual(headers.Authorization, `Bearer ${mockToken}`);
    });

    it('should return empty headers when not authenticated', async () => {
        const headers = await auth.getAuthHeaders();
        assert.deepStrictEqual(headers, {});
    });

    it('should notify listeners on login', async () => {
        const events = [];
        auth.onAuthStateChange((event, user) => events.push({ event, user }));

        const mockToken = createMockJWT({ id: 'user1', email: 'test@test.com' });
        setupFetch({
            token: mockToken,
            refreshToken: 'refresh-token-123',
            user: { id: 'user1', email: 'test@test.com', displayName: 'Test' }
        });

        await auth.login('test@test.com', 'password123');
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].event, 'login');
        assert.strictEqual(events[0].user.email, 'test@test.com');
    });

    it('should notify listeners on logout', () => {
        const events = [];
        auth.onAuthStateChange((event, user) => events.push({ event, user }));

        auth.logout();
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].event, 'logout');
        assert.strictEqual(events[0].user, null);
    });

    it('should unsubscribe from auth state changes', () => {
        const events = [];
        const unsubscribe = auth.onAuthStateChange((event) => events.push(event));

        auth.logout();
        assert.strictEqual(events.length, 1);

        unsubscribe();
        auth.logout();
        assert.strictEqual(events.length, 1); // Should not increment
    });

    it('should validate email on login', async () => {
        await assert.rejects(
            () => auth.login('', 'password123'),
            { message: 'Email and password are required' }
        );
    });
});

console.log('Running AuthService tests...');
