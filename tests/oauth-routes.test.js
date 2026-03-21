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
    OAuthVerificationError,
    SUPPORTED_PROVIDERS,
    isValidPhotoUrl,
    sanitizeDisplayName
} = require('../src/routes/oauth');
const app = require('../src/index');

// Helper to create a fake Google ID token JWT (base64url encoded)
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

// Helper to create a fake Apple ID token JWT (base64url encoded)
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
        it('should decode a valid Google ID token', async () => {
            const token = createGoogleIdToken();
            const result = await verifyGoogleToken(token);

            assert.strictEqual(result.sub, 'google-user-123');
            assert.strictEqual(result.email, 'testuser@gmail.com');
            assert.strictEqual(result.name, 'Test User');
            assert.strictEqual(result.picture, 'https://example.com/photo.jpg');
            assert.strictEqual(result.email_verified, true);
        });

        it('should reject null/empty token', async () => {
            await assert.rejects(() => verifyGoogleToken(null), /Invalid token/);
            await assert.rejects(() => verifyGoogleToken(''), /Invalid token/);
        });

        it('should reject non-string token', async () => {
            await assert.rejects(() => verifyGoogleToken(12345), /Invalid token/);
        });

        it('should reject token exceeding max length', async () => {
            await assert.rejects(() => verifyGoogleToken('a'.repeat(5000)), /Token too long/);
        });

        it('should reject malformed token (wrong segment count)', async () => {
            await assert.rejects(() => verifyGoogleToken('only.two'), /Malformed token/);
            await assert.rejects(() => verifyGoogleToken('single'), /Malformed token/);
        });

        it('should reject token with invalid payload', async () => {
            const header = Buffer.from('{}').toString('base64url');
            const badPayload = Buffer.from('not-json').toString('base64url');
            const sig = Buffer.from('sig').toString('base64url');
            await assert.rejects(() => verifyGoogleToken(`${header}.${badPayload}.${sig}`), /Invalid token payload/);
        });

        it('should reject token missing required claims (sub)', async () => {
            const header = Buffer.from('{}').toString('base64url');
            const body = Buffer.from(JSON.stringify({
                iss: 'accounts.google.com',
                email: 'test@test.com',
                exp: Math.floor(Date.now() / 1000) + 3600
            })).toString('base64url');
            const sig = Buffer.from('sig').toString('base64url');
            await assert.rejects(() => verifyGoogleToken(`${header}.${body}.${sig}`), /missing required claims/);
        });

        it('should reject token with invalid issuer', async () => {
            const header = Buffer.from('{}').toString('base64url');
            const body = Buffer.from(JSON.stringify({
                iss: 'evil.com',
                sub: '123',
                email: 'test@test.com',
                exp: Math.floor(Date.now() / 1000) + 3600
            })).toString('base64url');
            const sig = Buffer.from('sig').toString('base64url');
            await assert.rejects(() => verifyGoogleToken(`${header}.${body}.${sig}`), /Invalid token issuer/);
        });

        it('should reject expired token', async () => {
            const token = createGoogleIdToken({}, true);
            await assert.rejects(() => verifyGoogleToken(token), /Token expired/);
        });

        it('should accept token with https issuer', async () => {
            const token = createGoogleIdToken({ iss: 'https://accounts.google.com' });
            const result = await verifyGoogleToken(token);
            assert.strictEqual(result.sub, 'google-user-123');
        });

        it('should throw OAuthVerificationError for validation failures', async () => {
            try {
                await verifyGoogleToken(null);
                assert.fail('Should have thrown');
            } catch (err) {
                assert.ok(err instanceof OAuthVerificationError);
            }
        });
    });

    describe('verifyAppleToken', () => {
        it('should decode a valid Apple ID token', async () => {
            const token = createAppleIdToken();
            const result = await verifyAppleToken(token);

            assert.strictEqual(result.sub, 'apple-user-456');
            assert.strictEqual(result.email, 'testuser@icloud.com');
            assert.strictEqual(result.name, null);
        });

        it('should reject null/empty token', async () => {
            await assert.rejects(() => verifyAppleToken(null), /Invalid token/);
            await assert.rejects(() => verifyAppleToken(''), /Invalid token/);
        });

        it('should reject token exceeding max length', async () => {
            await assert.rejects(() => verifyAppleToken('a'.repeat(5000)), /Token too long/);
        });

        it('should reject malformed token', async () => {
            await assert.rejects(() => verifyAppleToken('only.two'), /Malformed token/);
        });

        it('should reject token with wrong issuer', async () => {
            const header = Buffer.from('{}').toString('base64url');
            const body = Buffer.from(JSON.stringify({
                iss: 'https://wrong.apple.com',
                sub: '123',
                exp: Math.floor(Date.now() / 1000) + 3600
            })).toString('base64url');
            const sig = Buffer.from('sig').toString('base64url');
            await assert.rejects(() => verifyAppleToken(`${header}.${body}.${sig}`), /Invalid token issuer/);
        });

        it('should reject expired Apple token', async () => {
            const token = createAppleIdToken({}, true);
            await assert.rejects(() => verifyAppleToken(token), /Token expired/);
        });

        it('should handle token without email', async () => {
            const header = Buffer.from('{}').toString('base64url');
            const body = Buffer.from(JSON.stringify({
                iss: 'https://appleid.apple.com',
                sub: 'apple-no-email',
                exp: Math.floor(Date.now() / 1000) + 3600
            })).toString('base64url');
            const sig = Buffer.from('sig').toString('base64url');
            const result = await verifyAppleToken(`${header}.${body}.${sig}`);
            assert.strictEqual(result.sub, 'apple-no-email');
            assert.strictEqual(result.email, null);
        });

        it('should handle Apple private relay email addresses', async () => {
            const token = createAppleIdToken({ email: 'user@privaterelay.appleid.com', email_verified: true });
            const result = await verifyAppleToken(token);
            assert.strictEqual(result.email, 'user@privaterelay.appleid.com');
        });
    });

    describe('findOrCreateOAuthUser', () => {
        it('should create a new user with UUID id', () => {
            const providerUser = {
                sub: 'google-123',
                email: 'new@gmail.com',
                name: 'New User',
                picture: 'https://example.com/photo.jpg',
                email_verified: true
            };

            const user = findOrCreateOAuthUser('google', providerUser);
            assert.ok(user.id);
            assert.match(user.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
            assert.strictEqual(user.email, 'new@gmail.com');
            assert.strictEqual(user.displayName, 'New User');
            assert.strictEqual(user.photoUrl, 'https://example.com/photo.jpg');
            assert.strictEqual(user.oauthProviders.google, 'google-123');
            assert.strictEqual(user.hashedPassword, null);
        });

        it('should return existing user when OAuth identity is already linked', () => {
            const providerUser = { sub: 'google-linked', email: 'linked@gmail.com', name: 'Linked', email_verified: true };
            const user1 = findOrCreateOAuthUser('google', providerUser);
            const user2 = findOrCreateOAuthUser('google', providerUser);
            assert.strictEqual(user1.id, user2.id);
        });

        it('should link OAuth to existing email user ONLY when email is verified', () => {
            users.set('existing@gmail.com', {
                id: 'existing-user-1', email: 'existing@gmail.com', displayName: 'Existing',
                hashedPassword: '$2b$10$hash', createdAt: Date.now()
            });

            const linked = findOrCreateOAuthUser('google', {
                sub: 'google-new-link', email: 'existing@gmail.com', name: 'Google Name', email_verified: true
            });
            assert.strictEqual(linked.id, 'existing-user-1');
        });

        it('should NOT link when email is not verified (creates new user)', () => {
            users.set('victim@gmail.com', {
                id: 'victim-1', email: 'victim@gmail.com', displayName: 'Victim',
                hashedPassword: '$2b$10$hash', createdAt: Date.now()
            });

            const result = findOrCreateOAuthUser('google', {
                sub: 'attacker', email: 'victim@gmail.com', name: 'Attacker', email_verified: false
            });
            assert.notStrictEqual(result.id, 'victim-1');
        });

        it('should ignore client-supplied email for account linking', () => {
            users.set('target@example.com', {
                id: 'target', email: 'target@example.com', displayName: 'Target',
                hashedPassword: '$2b$10$hash', createdAt: Date.now()
            });

            const result = findOrCreateOAuthUser('apple', {
                sub: 'attacker', email: null, name: null, email_verified: false
            }, { email: 'target@example.com' });
            assert.notStrictEqual(result.id, 'target');
        });

        it('should validate photo URL (reject non-HTTPS)', () => {
            const user = findOrCreateOAuthUser('google', {
                sub: 'bad-photo', email: 'photo@test.com', name: 'Test',
                picture: 'http://insecure.com/photo.jpg', email_verified: true
            });
            assert.strictEqual(user.photoUrl, null);
        });

        it('should accept valid HTTPS photo URLs', () => {
            const user = findOrCreateOAuthUser('google', {
                sub: 'good-photo', email: 'goodphoto@test.com', name: 'Test',
                picture: 'https://lh3.googleusercontent.com/avatar.jpg', email_verified: true
            });
            assert.strictEqual(user.photoUrl, 'https://lh3.googleusercontent.com/avatar.jpg');
        });

        it('should use fallback email for users without email', () => {
            const user = findOrCreateOAuthUser('apple', {
                sub: 'no-email', email: null, name: null, email_verified: false
            });
            assert.ok(user.email.includes('apple:no-email@oauth.local'));
        });
    });

    describe('isValidPhotoUrl', () => {
        it('should accept valid HTTPS URLs', () => { assert.ok(isValidPhotoUrl('https://example.com/photo.jpg')); });
        it('should reject HTTP URLs', () => { assert.ok(!isValidPhotoUrl('http://example.com/photo.jpg')); });
        it('should reject javascript: URIs', () => { assert.ok(!isValidPhotoUrl('javascript:alert(1)')); });
        it('should reject null/empty', () => { assert.ok(!isValidPhotoUrl(null)); assert.ok(!isValidPhotoUrl('')); });
        it('should reject very long URLs', () => { assert.ok(!isValidPhotoUrl('https://x.com/' + 'a'.repeat(3000))); });
    });

    describe('sanitizeDisplayName', () => {
        it('should trim and cap at max length', () => {
            assert.strictEqual(sanitizeDisplayName('  Hello  '), 'Hello');
            assert.strictEqual(sanitizeDisplayName('A'.repeat(200)).length, 100);
        });
        it('should return undefined for non-strings', () => {
            assert.strictEqual(sanitizeDisplayName(12345), undefined);
            assert.strictEqual(sanitizeDisplayName(null), undefined);
        });
        it('should return undefined for empty strings', () => {
            assert.strictEqual(sanitizeDisplayName(''), undefined);
            assert.strictEqual(sanitizeDisplayName('   '), undefined);
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
        await new Promise(resolve => { server = app.listen(0, resolve); });
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
            assert.strictEqual(res.body.user.provider, 'google');
        });

        it('should reject request without idToken', async () => {
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/google', {});
            assert.strictEqual(res.status, 400);
        });

        it('should reject expired Google token', async () => {
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/google', { idToken: createGoogleIdToken({}, true) });
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
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/apple', { idToken, displayName: 'Apple User' });
            assert.strictEqual(res.status, 200);
            assert.ok(res.body.token);
            assert.strictEqual(res.body.user.provider, 'apple');
        });

        it('should reject request without idToken', async () => {
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/apple', {});
            assert.strictEqual(res.status, 400);
        });

        it('should reject expired Apple token', async () => {
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/apple', { idToken: createAppleIdToken({}, true) });
            assert.strictEqual(res.status, 401);
        });

        it('should NOT use client-supplied email for account linking', async () => {
            await makeRequest(server, 'POST', '/api/auth/register', { email: 'victim@example.com', password: 'securepass123' });
            const idToken = createAppleIdToken({ email: null, sub: 'attacker-sub' });
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/apple', { idToken, email: 'victim@example.com' });
            assert.strictEqual(res.status, 200);
            assert.notStrictEqual(res.body.user.email, 'victim@example.com');
        });
    });

    describe('POST /api/auth/oauth/link', () => {
        it('should link Google account to an authenticated user', async () => {
            const authRes = await makeRequest(server, 'POST', '/api/auth/oauth/apple', { idToken: createAppleIdToken(), displayName: 'Link Test' });
            const googleToken = createGoogleIdToken({ sub: 'link-google-123', email: 'link@test.com' });
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/link', { provider: 'google', idToken: googleToken }, { Authorization: `Bearer ${authRes.body.token}` });
            assert.strictEqual(res.status, 200);
            assert.ok(res.body.providers.includes('google'));
            assert.ok(res.body.providers.includes('apple'));
        });

        it('should reject link without authentication', async () => {
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/link', { provider: 'google', idToken: createGoogleIdToken() });
            assert.strictEqual(res.status, 401);
        });

        it('should reject unsupported provider', async () => {
            const authRes = await makeRequest(server, 'POST', '/api/auth/oauth/apple', { idToken: createAppleIdToken() });
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/link', { provider: 'facebook', idToken: 'x' }, { Authorization: `Bearer ${authRes.body.token}` });
            assert.strictEqual(res.status, 400);
        });

        it('should reject link without idToken', async () => {
            const authRes = await makeRequest(server, 'POST', '/api/auth/oauth/apple', { idToken: createAppleIdToken() });
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/link', { provider: 'google' }, { Authorization: `Bearer ${authRes.body.token}` });
            assert.strictEqual(res.status, 400);
        });

        it('should reject linking identity already linked to another user', async () => {
            const googleToken = createGoogleIdToken();
            await makeRequest(server, 'POST', '/api/auth/oauth/google', { idToken: googleToken });
            const authRes = await makeRequest(server, 'POST', '/api/auth/oauth/apple', { idToken: createAppleIdToken(), displayName: 'Second' });
            const res = await makeRequest(server, 'POST', '/api/auth/oauth/link', { provider: 'google', idToken: googleToken }, { Authorization: `Bearer ${authRes.body.token}` });
            assert.strictEqual(res.status, 409);
        });
    });

    describe('GET /api/auth/oauth/config', () => {
        it('should return public OAuth client IDs', async () => {
            const res = await makeRequest(server, 'GET', '/api/auth/oauth/config');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(typeof res.body.googleClientId, 'string');
            assert.strictEqual(typeof res.body.appleClientId, 'string');
        });
    });
});
