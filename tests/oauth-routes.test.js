/**
 * Tests for OAuth Routes - Server-side OAuth/SSO endpoints
 * Tests token verification, user creation, account linking, and HTTP endpoints.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const crypto = require('node:crypto');
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
    sanitizeDisplayName,
    _setGoogleJwksCache,
    _setAppleJwksCache
} = require('../src/routes/oauth');
const app = require('../src/index');

// Generate RSA key pair for JWKS signature verification tests
const { privateKey: rsaPrivateKey, publicKey: rsaPublicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
const rsaPublicJwk = crypto.createPublicKey(rsaPublicKey).export({ format: 'jwk' });
rsaPublicJwk.kid = 'test-key-1';
rsaPublicJwk.use = 'sig';
rsaPublicJwk.alg = 'RS256';

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

        it('should reject token without exp claim', async () => {
            const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
            const body = Buffer.from(JSON.stringify({
                iss: 'accounts.google.com',
                sub: 'google-no-exp',
                email: 'noexp@gmail.com',
                email_verified: true
            })).toString('base64url');
            const sig = Buffer.from('sig').toString('base64url');
            await assert.rejects(() => verifyGoogleToken(`${header}.${body}.${sig}`), /Token expired or missing expiration/);
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

        it('should reject Apple token without exp claim', async () => {
            const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
            const body = Buffer.from(JSON.stringify({
                iss: 'https://appleid.apple.com',
                sub: 'apple-no-exp'
            })).toString('base64url');
            const sig = Buffer.from('sig').toString('base64url');
            await assert.rejects(() => verifyAppleToken(`${header}.${body}.${sig}`), /Token expired or missing expiration/);
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

describe('JWKS Signature Verification', () => {
    const TEST_GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com';
    const TEST_APPLE_CLIENT_ID = 'com.test.musicapp';

    beforeEach(() => {
        users.clear();
        refreshTokens.clear();
    });

    afterEach(() => {
        users.clear();
        refreshTokens.clear();
        delete process.env.GOOGLE_CLIENT_ID;
        delete process.env.APPLE_CLIENT_ID;
        _setGoogleJwksCache(null, 0);
        _setAppleJwksCache(null, 0);
    });

    describe('Google JWKS verification', () => {
        it('should accept a correctly-signed token with matching kid', async () => {
            process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
            _setGoogleJwksCache([rsaPublicJwk], Date.now() + 3600000);

            const token = jwt.sign({
                iss: 'accounts.google.com',
                sub: 'google-jwks-user',
                email: 'jwks@gmail.com',
                email_verified: true,
                aud: TEST_GOOGLE_CLIENT_ID,
                exp: Math.floor(Date.now() / 1000) + 3600
            }, rsaPrivateKey, { algorithm: 'RS256', header: { kid: 'test-key-1' } });

            const result = await verifyGoogleToken(token);
            assert.strictEqual(result.sub, 'google-jwks-user');
            assert.strictEqual(result.email, 'jwks@gmail.com');
        });

        it('should reject a token with mismatched kid', async () => {
            process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
            _setGoogleJwksCache([rsaPublicJwk], Date.now() + 3600000);

            const token = jwt.sign({
                iss: 'accounts.google.com',
                sub: 'google-bad-kid',
                email: 'badkid@gmail.com',
                email_verified: true,
                aud: TEST_GOOGLE_CLIENT_ID,
                exp: Math.floor(Date.now() / 1000) + 3600
            }, rsaPrivateKey, { algorithm: 'RS256', header: { kid: 'wrong-key-id' } });

            await assert.rejects(() => verifyGoogleToken(token), /Token signing key not found/);
        });

        it('should reject a token with tampered payload', async () => {
            process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
            _setGoogleJwksCache([rsaPublicJwk], Date.now() + 3600000);

            const token = jwt.sign({
                iss: 'accounts.google.com',
                sub: 'original-user',
                email: 'original@gmail.com',
                email_verified: true,
                aud: TEST_GOOGLE_CLIENT_ID,
                exp: Math.floor(Date.now() / 1000) + 3600
            }, rsaPrivateKey, { algorithm: 'RS256', header: { kid: 'test-key-1' } });

            // Tamper with the payload
            const parts = token.split('.');
            const tamperedPayload = Buffer.from(JSON.stringify({
                iss: 'accounts.google.com',
                sub: 'attacker',
                email: 'attacker@gmail.com',
                email_verified: true,
                aud: TEST_GOOGLE_CLIENT_ID,
                exp: Math.floor(Date.now() / 1000) + 3600
            })).toString('base64url');
            const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

            await assert.rejects(() => verifyGoogleToken(tamperedToken), /Token signature verification failed/);
        });

        it('should reject a token with wrong audience', async () => {
            process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
            _setGoogleJwksCache([rsaPublicJwk], Date.now() + 3600000);

            const token = jwt.sign({
                iss: 'accounts.google.com',
                sub: 'google-wrong-aud',
                email: 'wrongaud@gmail.com',
                email_verified: true,
                aud: 'different-client-id.apps.googleusercontent.com',
                exp: Math.floor(Date.now() / 1000) + 3600
            }, rsaPrivateKey, { algorithm: 'RS256', header: { kid: 'test-key-1' } });

            await assert.rejects(() => verifyGoogleToken(token), /Invalid token audience/);
        });

        it('should reject a token signed with a different key', async () => {
            process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
            _setGoogleJwksCache([rsaPublicJwk], Date.now() + 3600000);

            // Generate a different key pair
            const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: 2048,
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
            });

            const token = jwt.sign({
                iss: 'accounts.google.com',
                sub: 'google-wrong-key',
                email: 'wrongkey@gmail.com',
                email_verified: true,
                aud: TEST_GOOGLE_CLIENT_ID,
                exp: Math.floor(Date.now() / 1000) + 3600
            }, otherKey, { algorithm: 'RS256', header: { kid: 'test-key-1' } });

            await assert.rejects(() => verifyGoogleToken(token), /Token signature verification failed/);
        });
    });

    describe('Apple JWKS verification', () => {
        it('should accept a correctly-signed Apple token', async () => {
            process.env.APPLE_CLIENT_ID = TEST_APPLE_CLIENT_ID;
            _setAppleJwksCache([rsaPublicJwk], Date.now() + 3600000);

            const token = jwt.sign({
                iss: 'https://appleid.apple.com',
                sub: 'apple-jwks-user',
                email: 'jwks@icloud.com',
                email_verified: true,
                aud: TEST_APPLE_CLIENT_ID,
                exp: Math.floor(Date.now() / 1000) + 3600
            }, rsaPrivateKey, { algorithm: 'RS256', header: { kid: 'test-key-1' } });

            const result = await verifyAppleToken(token);
            assert.strictEqual(result.sub, 'apple-jwks-user');
            assert.strictEqual(result.email, 'jwks@icloud.com');
        });

        it('should reject an Apple token with tampered payload', async () => {
            process.env.APPLE_CLIENT_ID = TEST_APPLE_CLIENT_ID;
            _setAppleJwksCache([rsaPublicJwk], Date.now() + 3600000);

            const token = jwt.sign({
                iss: 'https://appleid.apple.com',
                sub: 'apple-original',
                email: 'original@icloud.com',
                email_verified: true,
                aud: TEST_APPLE_CLIENT_ID,
                exp: Math.floor(Date.now() / 1000) + 3600
            }, rsaPrivateKey, { algorithm: 'RS256', header: { kid: 'test-key-1' } });

            const parts = token.split('.');
            const tamperedPayload = Buffer.from(JSON.stringify({
                iss: 'https://appleid.apple.com',
                sub: 'apple-attacker',
                aud: TEST_APPLE_CLIENT_ID,
                exp: Math.floor(Date.now() / 1000) + 3600
            })).toString('base64url');
            const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

            await assert.rejects(() => verifyAppleToken(tamperedToken), /Token signature verification failed/);
        });

        it('should reject Apple token with mismatched kid', async () => {
            process.env.APPLE_CLIENT_ID = TEST_APPLE_CLIENT_ID;
            _setAppleJwksCache([rsaPublicJwk], Date.now() + 3600000);

            const token = jwt.sign({
                iss: 'https://appleid.apple.com',
                sub: 'apple-bad-kid',
                aud: TEST_APPLE_CLIENT_ID,
                exp: Math.floor(Date.now() / 1000) + 3600
            }, rsaPrivateKey, { algorithm: 'RS256', header: { kid: 'nonexistent-key' } });

            await assert.rejects(() => verifyAppleToken(token), /Token signing key not found/);
        });

        it('should reject Apple token with wrong audience', async () => {
            process.env.APPLE_CLIENT_ID = TEST_APPLE_CLIENT_ID;
            _setAppleJwksCache([rsaPublicJwk], Date.now() + 3600000);

            const token = jwt.sign({
                iss: 'https://appleid.apple.com',
                sub: 'apple-wrong-aud',
                aud: 'com.other.app',
                exp: Math.floor(Date.now() / 1000) + 3600
            }, rsaPrivateKey, { algorithm: 'RS256', header: { kid: 'test-key-1' } });

            await assert.rejects(() => verifyAppleToken(token), /Invalid token audience/);
        });
    });

    describe('Signature verification always runs when client ID is set', () => {
        it('should verify signature in any environment when GOOGLE_CLIENT_ID is set (no escape hatch)', async () => {
            // Even with SKIP_OAUTH_SIG_VERIFY=true, signature verification should still run
            // because the escape hatch has been removed
            const origSkip = process.env.SKIP_OAUTH_SIG_VERIFY;
            process.env.SKIP_OAUTH_SIG_VERIFY = 'true';
            process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
            _setGoogleJwksCache([rsaPublicJwk], Date.now() + 3600000);

            // A fake-signature token should be REJECTED because sig verification runs
            const fakeToken = createGoogleIdToken({ aud: TEST_GOOGLE_CLIENT_ID });
            await assert.rejects(
                () => verifyGoogleToken(fakeToken),
                /Token signing key not found|Token signature verification failed/
            );

            // Clean up
            if (origSkip === undefined) delete process.env.SKIP_OAUTH_SIG_VERIFY;
            else process.env.SKIP_OAUTH_SIG_VERIFY = origSkip;
        });

        it('should verify signature in any environment when APPLE_CLIENT_ID is set (no escape hatch)', async () => {
            const origSkip = process.env.SKIP_OAUTH_SIG_VERIFY;
            process.env.SKIP_OAUTH_SIG_VERIFY = 'true';
            process.env.APPLE_CLIENT_ID = TEST_APPLE_CLIENT_ID;
            _setAppleJwksCache([rsaPublicJwk], Date.now() + 3600000);

            const fakeToken = createAppleIdToken({ aud: TEST_APPLE_CLIENT_ID });
            await assert.rejects(
                () => verifyAppleToken(fakeToken),
                /Token signing key not found|Token signature verification failed/
            );

            if (origSkip === undefined) delete process.env.SKIP_OAUTH_SIG_VERIFY;
            else process.env.SKIP_OAUTH_SIG_VERIFY = origSkip;
        });
    });

    describe('JWKS cache', () => {
        it('should use cached JWKS when not expired', async () => {
            process.env.GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
            _setGoogleJwksCache([rsaPublicJwk], Date.now() + 3600000);

            const token = jwt.sign({
                iss: 'accounts.google.com',
                sub: 'cache-test',
                email: 'cache@gmail.com',
                email_verified: true,
                aud: TEST_GOOGLE_CLIENT_ID,
                exp: Math.floor(Date.now() / 1000) + 3600
            }, rsaPrivateKey, { algorithm: 'RS256', header: { kid: 'test-key-1' } });

            // Should succeed using cached JWKS (not fetching from network)
            const result = await verifyGoogleToken(token);
            assert.strictEqual(result.sub, 'cache-test');
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
