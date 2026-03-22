/**
 * Tests for AuthService - Client-side authentication
 * Imports the actual source file with global mocks for localStorage and fetch
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Mock localStorage (set up before requiring AuthService)
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();
global.localStorage = localStorageMock;

// Mock fetch - configurable per test
let fetchMockFn;
global.fetch = async (...args) => fetchMockFn(...args);

function setupFetch(response, ok = true, status = 200) {
    fetchMockFn = async () => ({
        ok,
        status,
        json: async () => response
    });
}

// Now import the actual AuthService from source
const AuthService = require('../src/js/services/auth-service');

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

    it('should get current user from storage', () => {
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

    it('should share refresh promise across concurrent getToken calls', async () => {
        // Set up an expired token and refresh token
        const expiredToken = createMockJWT({ id: 'user1' }, -100);
        localStorageMock.setItem('music_app_auth_token', expiredToken);
        localStorageMock.setItem('music_app_refresh_token', 'refresh-token-123');

        let fetchCallCount = 0;
        const newToken = createMockJWT({ id: 'user1' }, 3600);
        // Use a custom fetch setup that counts calls
        setupFetch({ token: newToken, refreshToken: 'new-refresh' });
        const originalFetchMock = fetchMockFn;
        fetchMockFn = async (...args) => {
            fetchCallCount++;
            return originalFetchMock(...args);
        };

        // Make concurrent getToken calls
        const [result1, result2] = await Promise.all([
            auth.getToken(),
            auth.getToken()
        ]);

        // Both should resolve to the same new token
        assert.strictEqual(result1, newToken);
        assert.strictEqual(result2, newToken);
        // Only one fetch call should have been made (shared promise)
        assert.strictEqual(fetchCallCount, 1);
    });

    it('should clear refresh promise on logout', async () => {
        const expiredToken = createMockJWT({ id: 'user1' }, -100);
        localStorageMock.setItem('music_app_auth_token', expiredToken);
        localStorageMock.setItem('music_app_refresh_token', 'refresh-token-123');

        auth.logout();
        assert.strictEqual(auth._refreshPromise, null);
    });

    it('should refresh token when expired', async () => {
        const expiredToken = createMockJWT({ id: 'user1' }, -100);
        const newToken = createMockJWT({ id: 'user1' }, 3600);
        localStorageMock.setItem('music_app_auth_token', expiredToken);
        localStorageMock.setItem('music_app_refresh_token', 'refresh-token-123');

        setupFetch({ token: newToken, refreshToken: 'new-refresh' });

        const token = await auth.getToken();
        assert.strictEqual(token, newToken);
    });

    it('should logout when refresh fails', async () => {
        const expiredToken = createMockJWT({ id: 'user1' }, -100);
        localStorageMock.setItem('music_app_auth_token', expiredToken);
        localStorageMock.setItem('music_app_refresh_token', 'refresh-token-123');

        setupFetch({ error: 'Invalid refresh token' }, false, 401);

        const token = await auth.getToken();
        assert.strictEqual(token, null);
        assert.strictEqual(auth.isAuthenticated(), false);
    });

    it('should keep existing token when refresh fails due to network error (offline)', async () => {
        const expiredToken = createMockJWT({ id: 'user1' }, -100);
        localStorageMock.setItem('music_app_auth_token', expiredToken);
        localStorageMock.setItem('music_app_refresh_token', 'refresh-token-123');

        // Simulate network error (TypeError from fetch when offline)
        fetchMockFn = async () => { throw new TypeError('Failed to fetch'); };

        const events = [];
        auth.onAuthStateChange((event) => events.push(event));

        const token = await auth.getToken();
        // Should return the existing token, not null
        assert.strictEqual(token, expiredToken);
        // Should NOT have logged out
        assert.strictEqual(auth.isAuthenticated(), true);
        // Should notify about offline refresh failure
        assert.ok(events.includes('refresh_failed_offline'));
    });

    it('should still logout on non-network errors during refresh', async () => {
        const expiredToken = createMockJWT({ id: 'user1' }, -100);
        localStorageMock.setItem('music_app_auth_token', expiredToken);
        localStorageMock.setItem('music_app_refresh_token', 'refresh-token-123');

        // Simulate a non-network error
        fetchMockFn = async () => { throw new Error('Some other error'); };

        const token = await auth.getToken();
        assert.strictEqual(token, null);
        assert.strictEqual(auth.isAuthenticated(), false);
    });
});

console.log('Running AuthService tests...');
