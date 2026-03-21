/**
 * Tests for OAuth Routes - Server-side OAuth/SSO endpoints
 * Tests token verification, user creation, account linking, and HTTP endpoints.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = require('../src/config').jwt.secret;
const { users, generateTokens, refreshTokens } = require('../src/routes/auth');
const {
    verifyGoogleToken,
    verifyAppleToken,
    findOrCreateOAuthUser,
    SUPPORTED_PROVIDERS
} = require('../src/routes/oauth');
const app = require('../src/index');

// Helper to create a fake Google ID token JWT
function createGoogleIdToken(payload = {}, expired = false) {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({
        iss: 'accounts.google.com',
        sub: 'google-user-123',
        email: 'testuser@gmail.com',
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
        email_verified: true,
        exp: expired
            ? Math.floor(Date.now() / 1000) - 3600
            : Math.floor(Date.now() / 1000) + 3600,
        ...payload
    })).toString('base64url');
    const sig = Buffer.from('fake-signature').toString('base64url');
    return `${header}.${body}.${sig}`;
}

// Helper to create a fake Apple ID token JWT
function createAppleIdToken(payload = {}, expired = false) {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({
        iss: 'https://appleid.apple.com',
        sub: 'apple-user-456',
        email: 'testuser@icloud.com',
        email_verified: true,
        exp: expired
            ? Math.floor(Date.now() / 1000) - 3600
            : Math.floor(Date.now() / 1000) + 3600,
        ...payload
    })).toString('base64url');
    const sig = Buffer.from('fake-signature').toString('base64url');
    return `${header}.${body}.${sig}`;
}

function makeRequest(server, method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, `http://localhost:${server.address().port}`);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method,
            headers: { 'Content-Type': 'application/json', ...headers }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

describe('OAuth Routes - Unit Tests', () => {
    beforeEach(() => {
        users.clear();
        refreshTokens.clear();
    });

    afterEach(() => {
        users.clear();
        refreshTokens.clear();
    });

    describe('verifyGoogleToken', () => {
        it('should decode a valid Google ID token', () => {
            const token = createGoogleIdToken();
            const result = verifyGoogleToken(token);

            assert.strictEqual(result.sub, 'google-user-123');
            assert.strictEqual(result.email, 'testuser@gmail.com');
            assert.strictEqual(result.name, 'Test User');
            assert.strictEqual(result.picture, 'https://example.com/photo.jpg');
            assert.strictEqual(result.email_verified, true);
        });

        it('should reject null/empty token', () => {
            assert.throws(() => verifyGoogleToken(null), /Invalid token/);
            assert.throws(() => verifyGoogleToken(''), /Invalid token/);
        });

        it('should reject non-string token', () => {
            assert.throws(() => verifyGoogleToken(12345), /Invalid token/);
        });

        it('should reject token exceeding max length', () => {
            const longToken = 'a'.repeat(5000);
            assert.throws(() => verifyGoogleToken(longToken), /Token too long/);
        });

        it('should reject malformed token (wrong segment count)', () => {
            assert.throws(() => verifyGoogleToken('only.two'), /Malformed token/);
            assert.throws(() => verifyGoogleToken('single'), /Malformed token/);
        });

        it('should reject token with invalid payload', () => {
            const header = Buffer.from('{}').toString('base64url');
            const badPayload = Buffer.from('not-json').toString('base64url');
            const sig = Buffer.from('sig').toString('base64url');
            assert.throws(() => verifyGoogleToken(`${header}.${badPayload}.${sig}`), /Invalid token payload/);
        });

        it('should reject token missing required claims (sub)', () => {
            const token = createGoogleIdToken({ sub: undefined, email: 'test@test.com' });
            // Need to manually construct since helper always includes sub
            const header = Buffer.from('{}').toString('base64url');
            const body = Buffer.from(JSON.stringify({
                iss: 'accounts.google.com',
                email: 'test@test.com',
                exp: Math.floor(Date.now() / 1000) + 3600
            })).toString('base64url');
            const sig = Buffer.from('sig').toString('base64url');
            assert.throws(() => verifyGoogleToken(`${header}.${body}.${sig}`), /missing required claims/);
        });

        it('should reject token with invalid issuer', () => {
            const header = Buffer.from('{}').toString('base64url');
            const body = Buffer.from(JSON.stringify({
                iss: 'evil.com',
                sub: '123',
                email: 'test@test.com',
                exp: Math.floor(Date.now() / 1000) + 3600
            })).toString('base64url');
            const sig = Buffer.from('sig').toString('base64url');
            assert.throws(() => verifyGoogleToken(`${header}.${body}.${sig}`), /Invalid token issuer/);
        });

        it('should reject expired token', () => {
            const token = createGoogleIdToken({}, true);
            assert.throws(() => verifyGoogleToken(token), /Token expired/);
        });

        it('should accept token with https issuer', () => {
            const token = createGoogleIdToken({ iss: 'https://accounts.google.com' });
            const result = verifyGoogleToken(token);
            assert.strictEqual(result.sub, 'google-user-123');
        });
    });

    describe('verifyAppleToken', () => {
        it('should decode a valid Apple ID token', () => {
            const token = createAppleIdToken();
            const result = verifyAppleToken(token);

            assert.strictEqual(result.sub, 'apple-user-456');
            assert.strictEqual(result.email, 'testuser@icloud.com');
            assert.strictEqual(result.name, null); // Apple doesn't provide name in token
        });

        it('should reject null/empty token', () => {
            assert.throws(() => verifyAppleToken(null), /Invalid token/);
            assert.throws(() => verifyAppleToken(''), /Invalid token/);
        });

        it('should reject token exceeding max length', () => {
            assert.throws(() => verifyAppleToken('a'.repeat(5000)), /Token too long/);
        });

        it('should reject malformed token', () => {
            assert.throws(() => verifyAppleToken('only.two'), /Malformed token/);
        });

        it('should reject token with wrong issuer', () => {
            const header = Buffer.from('{}').toString('base64url');
            const body = Buffer.from(JSON.stringify({
                iss: 'https://wrong.apple.com',
                sub: '123',
                exp: Math.floor(Date.now() / 1000) + 3600
            })).toString('base64url');
            const sig = Buffer.from('sig').toString('base64url');
            assert.throws(() => verifyAppleToken(`${header}.${body}.${sig}`), /Invalid token issuer/);
        });

        it('should reject expired Apple token', () => {
            const token = createAppleIdToken({}, true);
            assert.throws(() => verifyAppleToken(token), /Token expired/);
        });

        it('should handle token without email', () => {
            const header = Buffer.from('{}').toString('base64url');
            const body = Buffer.from(JSON.stringify({
                iss: 'https://appleid.apple.com',
                sub: 'apple-no-email',
                exp: Math.floor(Date.now() / 1000) + 3600
            })).toString('base64url');
            const sig = Buffer.from('sig').toString('base64url');
            const result = verifyAppleToken(`${header}.${body}.${sig}`);
            assert.strictEqual(result.sub, 'apple-no-email');
            assert.strictEqual(result.email, null);
        });
    });

    describe('findOrCreateOAuthUser', () => {
        it('should create a new user from Google provider data', () => {
            const providerUser = {
                sub: 'google-123',
                email: 'new@gmail.com',
                name: 'New User',
                picture: 'https://example.com/photo.jpg'
            };

            const user = findOrCreateOAuthUser('google', providerUser);

            assert.ok(user.id);
            assert.strictEqual(user.email, 'new@gmail.com');
            assert.strictEqual(user.displayName, 'New User');
            assert.strictEqual(user.photoUrl, 'https://example.com/photo.jpg');
            assert.strictEqual(user.oauthProviders.google, 'google-123');
            assert.strictEqual(user.hashedPassword, null);
        });

        it('should return existing user when OAuth identity is already linked', () => {
            const providerUser = {
                sub: 'google-linked',
                email: 'linked@gmail.com',
                name: 'Linked User'
            };

            const user1 = findOrCreateOAuthUser('google', providerUser);
            const user2 = findOrCreateOAuthUser('google', providerUser);

            assert.strictEqual(user1.id, user2.id);
        });

        it('should link OAuth to existing email user (account linking)', () => {
            // Pre-create a user with email/password
            const existing = {
                id: 'existing-user-1',
                email: 'existing@gmail.com',
                displayName: 'Existing',
                hashedPassword: '$2b$10$hash',
                createdAt: Date.now()
            };
            users.set('existing@gmail.com', existing);

            const providerUser = {
                sub: 'google-new-link',
                email: 'existing@gmail.com',
                name: 'Google Name'
            };

            const linked = findOrCreateOAuthUser('google', providerUser);

            assert.strictEqual(linked.id, 'existing-user-1');
            assert.strictEqual(linked.oauthProviders.google, 'google-new-link');
        });

        it('should use extraProfile.displayName when provider name is missing', () => {
            const providerUser = {
                sub: 'apple-no-name',
                email: null,
                name: null
            };

            const user = findOrCreateOAuthUser('apple', providerUser, {
                displayName: 'Custom Name',
                email: 'custom@example.com'
            });

            assert.strictEqual(user.displayName, 'Custom Name');
            assert.strictEqual(user.email, 'custom@example.com');
        });

        it('should generate fallback displayName from email', () => {
            const providerUser = {
                sub: 'no-name-user',
                email: 'john.doe@example.com',
                name: null
            };

            const user = findOrCreateOAuthUser('google', providerUser);
            assert.strictEqual(user.displayName, 'john.doe');
        });

        it('should use fallback email for users without email', () => {
            const providerUser = {
                sub: 'no-email-user',
                email: null,
                name: null
            };

            const user = findOrCreateOAuthUser('apple', providerUser);
            assert.ok(user.email.includes('apple:no-email-user@oauth.local'));
        });

        it('should add photo from provider to existing user during linking', () => {
            const existing = {
                id: 'photo-test',
                email: 'photo@test.com',
                displayName: 'Photo Test',
                hashedPassword: null,
                createdAt: Date.now()
            };
            users.set('photo@test.com', existing);

            const providerUser = {
                sub: 'google-photo',
                email: 'photo@test.com',
                name: 'Photo Test',
                picture: 'https://example.com/avatar.jpg'
            };

            const linked = findOrCreateOAuthUser('google', providerUser);
            assert.strictEqual(linked.photoUrl, 'https://example.com/avatar.jpg');
        });
    });

    describe('SUPPORTED_PROVIDERS', () => {
        it('should include google and apple', () => {
            assert.ok(SUPPORTED_PROVIDERS.includes('google'));
            assert.ok(SUPPORTED_PROVIDERS.includes('apple'));
            assert.strictEqual(SUPPORTED_PROVIDERS.length, 2);
        });
    });
});

describe('OAuth Routes - HTTP Endpoint Tests', () => {
    let server;

    beforeEach(async () => {
        users.clear();
        refreshTokens.clear();
        await new Promise(resolve => {
            server = app.listen(0, resolve);
        });
    });

    afterEach(async () => {
        users.clear();
        refreshTokens.clear();
        await new Promise(resolve => server.close(resolve));
    });

    describe('POST /api/auth/oauth/google', () => {
        it('should authenticate with a valid Google ID token', async () => {
            const idToken = createGoogleIdToken();
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/google', { idToken });

            assert.strictEqual(res.status, 200);
            assert.ok(res.body.token);
            assert.ok(res.body.refreshToken);
            assert.strictEqual(res.body.user.email, 'testuser@gmail.com');
            assert.strictEqual(res.body.user.displayName, 'Test User');
            assert.strictEqual(res.body.user.provider, 'google');
        });

        it('should reject request without idToken', async () => {
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/google', {});
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.error, 'Google ID token is required');
        });

        it('should reject expired Google token', async () => {
            const idToken = createGoogleIdToken({}, true);
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/google', { idToken });
            assert.strictEqual(res.status, 401);
        });

        it('should return same user on repeat login', async () => {
            const idToken = createGoogleIdToken();
            const res1 = await makeRequest(server, 'POST', '/api/auth/oauth/google', { idToken });
            const res2 = await makeRequest(server, 'POST', '/api/auth/oauth/google', { idToken });

            assert.strictEqual(res1.body.user.id, res2.body.user.id);
        });
    });

    describe('POST /api/auth/oauth/apple', () => {
        it('should authenticate with a valid Apple ID token', async () => {
            const idToken = createAppleIdToken();
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/apple', {
                idToken,
                displayName: 'Apple User'
            });

            assert.strictEqual(res.status, 200);
            assert.ok(res.body.token);
            assert.ok(res.body.refreshToken);
            assert.strictEqual(res.body.user.provider, 'apple');
            assert.strictEqual(res.body.user.displayName, 'Apple User');
        });

        it('should reject request without idToken', async () => {
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/apple', {});
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.error, 'Apple ID token is required');
        });

        it('should reject expired Apple token', async () => {
            const idToken = createAppleIdToken({}, true);
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/apple', { idToken });
            assert.strictEqual(res.status, 401);
        });
    });

    describe('POST /api/auth/oauth/link', () => {
        it('should link Google account to an authenticated user', async () => {
            // First, create a user via Google OAuth
            const appleToken = createAppleIdToken();
            const authRes = await makeRequest(server, 'POST', '/api/auth/oauth/apple', {
                idToken: appleToken,
                displayName: 'Link Test'
            });

            const accessToken = authRes.body.token;
            const googleToken = createGoogleIdToken({ sub: 'link-google-123', email: 'link@test.com' });

            const res = await makeRequest(server, 'POST', '/api/auth/oauth/link', {
                provider: 'google',
                idToken: googleToken
            }, { Authorization: `Bearer ${accessToken}` });

            assert.strictEqual(res.status, 200);
            assert.ok(res.body.providers.includes('google'));
            assert.ok(res.body.providers.includes('apple'));
        });

        it('should reject link without authentication', async () => {
            const googleToken = createGoogleIdToken();
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/link', {
                provider: 'google',
                idToken: googleToken
            });

            assert.strictEqual(res.status, 401);
        });

        it('should reject unsupported provider', async () => {
            const appleToken = createAppleIdToken();
            const authRes = await makeRequest(server, 'POST', '/api/auth/oauth/apple', {
                idToken: appleToken
            });

            const accessToken = authRes.body.token;

            const res = await makeRequest(server, 'POST', '/api/auth/oauth/link', {
                provider: 'facebook',
                idToken: 'some-token'
            }, { Authorization: `Bearer ${accessToken}` });

            assert.strictEqual(res.status, 400);
            assert.ok(res.body.error.includes('Unsupported provider'));
        });

        it('should reject link without idToken', async () => {
            const appleToken = createAppleIdToken();
            const authRes = await makeRequest(server, 'POST', '/api/auth/oauth/apple', {
                idToken: appleToken
            });

            const res = await makeRequest(server, 'POST', '/api/auth/oauth/link', {
                provider: 'google'
            }, { Authorization: `Bearer ${authRes.body.token}` });

            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.error, 'ID token is required');
        });

        it('should reject linking an identity already linked to another user', async () => {
            // Create first user with Google
            const googleToken = createGoogleIdToken();
            await makeRequest(server, 'POST', '/api/auth/oauth/google', { idToken: googleToken });

            // Create second user with Apple
            const appleToken = createAppleIdToken();
            const authRes = await makeRequest(server, 'POST', '/api/auth/oauth/apple', {
                idToken: appleToken,
                displayName: 'Second User'
            });

            // Try to link the same Google identity to the second user
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/link', {
                provider: 'google',
                idToken: googleToken
            }, { Authorization: `Bearer ${authRes.body.token}` });

            assert.strictEqual(res.status, 409);
            assert.ok(res.body.error.includes('already linked'));
        });
    });
});

console.log('Running OAuth Routes tests...');
