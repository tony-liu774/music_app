/**
 * Tests for OAuthService - Client-side OAuth/SSO integration
 * Tests token exchange, provider initialization, and account linking.
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
global.localStorage = localStorageMock;

// Mock fetch
let fetchMockFn;
global.fetch = async (...args) => fetchMockFn(...args);

function setupFetch(response, ok = true, status = 200) {
    fetchMockFn = async () => ({
        ok,
        status,
        json: async () => response
    });
}

// Mock document for script loading tests
global.document = {
    querySelector: () => null,
    createElement: (tag) => ({
        src: '',
        async: false,
        defer: false,
        onload: null,
        onerror: null
    }),
    head: {
        appendChild: (el) => { if (el.onload) el.onload(); }
    }
};

// Helper to create a mock JWT
function createMockJWT(payload = {}, expInSeconds = 3600) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64');
    const body = Buffer.from(JSON.stringify({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + expInSeconds
    })).toString('base64');
    return `${header}.${body}.mock-signature`;
}

const AuthService = require('../src/js/services/auth-service');
const OAuthService = require('../src/js/services/oauth-service');

describe('OAuthService', () => {
    let authService;
    let oauthService;

    beforeEach(() => {
        localStorageMock.clear();
        authService = new AuthService('http://localhost:3000');
        oauthService = new OAuthService(authService);
    });

    afterEach(() => {
        localStorageMock.clear();
    });

    describe('constructor', () => {
        it('should require an AuthService instance', () => {
            assert.throws(() => new OAuthService(null), /AuthService is required/);
            assert.throws(() => new OAuthService(undefined), /AuthService is required/);
        });

        it('should initialize with empty client IDs', () => {
            assert.strictEqual(oauthService.googleClientId, '');
            assert.strictEqual(oauthService.appleClientId, '');
        });

        it('should accept custom apiBaseUrl', () => {
            const custom = new OAuthService(authService, 'https://api.example.com');
            assert.strictEqual(custom.apiBaseUrl, 'https://api.example.com');
        });
    });

    describe('configure', () => {
        it('should set Google client ID', () => {
            oauthService.configure({ googleClientId: 'google-id-123' });
            assert.strictEqual(oauthService.googleClientId, 'google-id-123');
        });

        it('should set Apple client ID', () => {
            oauthService.configure({ appleClientId: 'com.example.app' });
            assert.strictEqual(oauthService.appleClientId, 'com.example.app');
        });

        it('should set both at once', () => {
            oauthService.configure({
                googleClientId: 'google-id',
                appleClientId: 'apple-id'
            });
            assert.strictEqual(oauthService.googleClientId, 'google-id');
            assert.strictEqual(oauthService.appleClientId, 'apple-id');
        });

        it('should handle empty config gracefully', () => {
            oauthService.configure({});
            assert.strictEqual(oauthService.googleClientId, '');
        });
    });

    describe('initGoogle', () => {
        it('should return false when no clientId is configured', async () => {
            const result = await oauthService.initGoogle();
            assert.strictEqual(result, false);
        });

        it('should return true when already initialized', async () => {
            oauthService.configure({ googleClientId: 'test-id' });
            oauthService._googleInitialized = true;
            const result = await oauthService.initGoogle();
            assert.strictEqual(result, true);
        });

        it('should return true when google.accounts.id is available', async () => {
            oauthService.configure({ googleClientId: 'test-id' });
            global.google = { accounts: { id: { initialize: () => {}, prompt: () => {} } } };
            const result = await oauthService.initGoogle();
            assert.strictEqual(result, true);
            assert.strictEqual(oauthService._googleInitialized, true);
            delete global.google;
        });
    });

    describe('initApple', () => {
        it('should return false when no clientId is configured', async () => {
            const result = await oauthService.initApple();
            assert.strictEqual(result, false);
        });

        it('should return true when already initialized', async () => {
            oauthService.configure({ appleClientId: 'com.test.app' });
            oauthService._appleInitialized = true;
            const result = await oauthService.initApple();
            assert.strictEqual(result, true);
        });

        it('should return true when AppleID.auth is available', async () => {
            oauthService.configure({ appleClientId: 'com.test.app' });
            global.AppleID = { auth: { init: () => {}, signIn: async () => ({}) } };
            const result = await oauthService.initApple();
            assert.strictEqual(result, true);
            assert.strictEqual(oauthService._appleInitialized, true);
            delete global.AppleID;
        });
    });

    describe('_exchangeGoogleToken', () => {
        it('should exchange Google token and store auth data', async () => {
            const mockToken = createMockJWT({ id: 'user1', email: 'test@gmail.com' });
            setupFetch({
                token: mockToken,
                refreshToken: 'refresh-123',
                user: { id: 'user1', email: 'test@gmail.com', displayName: 'Test', provider: 'google' }
            });

            const user = await oauthService._exchangeGoogleToken('fake-google-id-token');

            assert.strictEqual(user.email, 'test@gmail.com');
            assert.strictEqual(user.provider, 'google');
            assert.strictEqual(authService.isAuthenticated(), true);
            assert.strictEqual(oauthService.getProvider(), 'google');
        });

        it('should throw on failed exchange', async () => {
            setupFetch({ error: 'Invalid token' }, false, 401);

            await assert.rejects(
                () => oauthService._exchangeGoogleToken('bad-token'),
                /Invalid token/
            );
        });
    });

    describe('_exchangeAppleToken', () => {
        it('should exchange Apple token and store auth data', async () => {
            const mockToken = createMockJWT({ id: 'user2' });
            setupFetch({
                token: mockToken,
                refreshToken: 'refresh-456',
                user: { id: 'user2', email: 'test@icloud.com', displayName: 'Apple User', provider: 'apple' }
            });

            const user = await oauthService._exchangeAppleToken('fake-apple-id-token', 'Apple User', 'test@icloud.com');

            assert.strictEqual(user.email, 'test@icloud.com');
            assert.strictEqual(user.provider, 'apple');
            assert.strictEqual(oauthService.getProvider(), 'apple');
        });

        it('should throw on failed exchange', async () => {
            setupFetch({ error: 'Authentication failed' }, false, 401);

            await assert.rejects(
                () => oauthService._exchangeAppleToken('bad-token'),
                /Authentication failed/
            );
        });
    });

    describe('linkProvider', () => {
        it('should call the link endpoint with auth headers', async () => {
            // Set up authenticated state
            const mockToken = createMockJWT({ id: 'user1' }, 3600);
            localStorageMock.setItem('music_app_auth_token', mockToken);

            let capturedUrl, capturedBody;
            fetchMockFn = async (url, opts) => {
                capturedUrl = url;
                capturedBody = JSON.parse(opts.body);
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ message: 'Linked', providers: ['google', 'apple'] })
                };
            };

            const result = await oauthService.linkProvider('google', 'google-id-token');

            assert.ok(capturedUrl.includes('/api/auth/oauth/link'));
            assert.strictEqual(capturedBody.provider, 'google');
            assert.strictEqual(capturedBody.idToken, 'google-id-token');
            assert.deepStrictEqual(result.providers, ['google', 'apple']);
        });

        it('should throw when not authenticated', async () => {
            await assert.rejects(
                () => oauthService.linkProvider('google', 'token'),
                /Must be authenticated/
            );
        });
    });

    describe('provider storage', () => {
        it('should store and retrieve provider', () => {
            oauthService._storeProvider('google');
            assert.strictEqual(oauthService.getProvider(), 'google');
        });

        it('should clear provider', () => {
            oauthService._storeProvider('apple');
            oauthService.clearProvider();
            assert.strictEqual(oauthService.getProvider(), null);
        });

        it('should return null when no provider stored', () => {
            assert.strictEqual(oauthService.getProvider(), null);
        });
    });

    describe('signInWithGoogle error handling', () => {
        it('should throw when Google SDK is not available and no clientId', async () => {
            await assert.rejects(
                () => oauthService.signInWithGoogle(),
                /Google Sign-In SDK not available/
            );
        });
    });

    describe('signInWithApple error handling', () => {
        it('should throw when Apple SDK is not available and no clientId', async () => {
            await assert.rejects(
                () => oauthService.signInWithApple(),
                /Apple Sign-In SDK not available/
            );
        });
    });
});

console.log('Running OAuthService tests...');
