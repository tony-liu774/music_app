/**
 * Tests for Auth Routes - Server-side authentication endpoints
 * Tests both module internals and actual HTTP route behavior
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = require('../src/config').jwt.secret;

// Import route internals for unit testing
const { users, generateTokens, refreshTokens, authMiddleware, EMAIL_REGEX } = require('../src/routes/auth');

// Import the Express app for HTTP testing
const app = require('../src/index');

function makeRequest(server, method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, `http://localhost:${server.address().port}`);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method,
            headers: { 'Content-Type': 'application/json' }
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

describe('Auth Routes - Unit Tests', () => {
    beforeEach(() => {
        users.clear();
        refreshTokens.clear();
    });

    afterEach(() => {
        users.clear();
        refreshTokens.clear();
    });

    describe('generateTokens', () => {
        it('should generate a valid JWT access token with type claim', () => {
            const user = { id: 'user1', email: 'test@test.com' };
            const tokens = generateTokens(user);

            const decoded = jwt.verify(tokens.token, JWT_SECRET);
            assert.strictEqual(decoded.email, 'test@test.com');
            assert.strictEqual(decoded.id, 'user1');
            assert.strictEqual(decoded.type, 'access');
        });

        it('should generate a refresh token with type claim', () => {
            const user = { id: 'user1', email: 'test@test.com' };
            const tokens = generateTokens(user);

            const decoded = jwt.verify(tokens.refreshToken, JWT_SECRET);
            assert.strictEqual(decoded.id, 'user1');
            assert.strictEqual(decoded.type, 'refresh');
        });

        it('should store refresh token in the set', () => {
            const user = { id: 'user1', email: 'test@test.com' };
            const tokens = generateTokens(user);
            assert.ok(refreshTokens.has(tokens.refreshToken));
        });

        it('should generate different tokens for different users', () => {
            const user1 = { id: 'user1', email: 'alice@test.com' };
            const user2 = { id: 'user2', email: 'bob@test.com' };
            const tokens1 = generateTokens(user1);
            const tokens2 = generateTokens(user2);

            assert.notStrictEqual(tokens1.token, tokens2.token);
            assert.notStrictEqual(tokens1.refreshToken, tokens2.refreshToken);
        });
    });

    describe('authMiddleware', () => {
        it('should reject requests without Authorization header', () => {
            const req = { headers: {} };
            let statusCode;
            let responseBody;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: (body) => { responseBody = body; }
            };
            const next = () => {};

            authMiddleware(req, res, next);
            assert.strictEqual(statusCode, 401);
            assert.strictEqual(responseBody.error, 'Authentication required');
        });

        it('should reject requests with invalid token', () => {
            const req = { headers: { authorization: 'Bearer invalid-token' } };
            let statusCode;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: () => {}
            };

            authMiddleware(req, res, () => {});
            assert.strictEqual(statusCode, 401);
        });

        it('should accept valid access tokens and set req.user', () => {
            const token = jwt.sign({ id: 'user1', email: 'test@test.com', type: 'access' }, JWT_SECRET, { expiresIn: '1h' });
            const req = { headers: { authorization: `Bearer ${token}` } };
            const res = {};
            let nextCalled = false;

            authMiddleware(req, res, () => { nextCalled = true; });
            assert.strictEqual(nextCalled, true);
            assert.strictEqual(req.user.id, 'user1');
        });

        it('should reject refresh tokens used as access tokens', () => {
            const token = jwt.sign({ id: 'user1', type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
            const req = { headers: { authorization: `Bearer ${token}` } };
            let statusCode;
            let responseBody;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: (body) => { responseBody = body; }
            };

            authMiddleware(req, res, () => {});
            assert.strictEqual(statusCode, 401);
            assert.strictEqual(responseBody.error, 'Invalid token type');
        });

        it('should reject expired tokens', () => {
            const token = jwt.sign({ id: 'user1', type: 'access' }, JWT_SECRET, { expiresIn: '-1s' });
            const req = { headers: { authorization: `Bearer ${token}` } };
            let statusCode;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: () => {}
            };

            authMiddleware(req, res, () => {});
            assert.strictEqual(statusCode, 401);
        });

        it('should reject tokens without Bearer prefix', () => {
            const token = jwt.sign({ id: 'user1', type: 'access' }, JWT_SECRET, { expiresIn: '1h' });
            const req = { headers: { authorization: token } };
            let statusCode;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: () => {}
            };

            authMiddleware(req, res, () => {});
            assert.strictEqual(statusCode, 401);
        });
    });

    describe('Email validation', () => {
        it('should accept valid email addresses', () => {
            assert.ok(EMAIL_REGEX.test('user@example.com'));
            assert.ok(EMAIL_REGEX.test('test.user@domain.co.uk'));
        });

        it('should reject invalid email addresses', () => {
            assert.ok(!EMAIL_REGEX.test('not-an-email'));
            assert.ok(!EMAIL_REGEX.test('missing@'));
            assert.ok(!EMAIL_REGEX.test('@no-local.com'));
            assert.ok(!EMAIL_REGEX.test('spaces in@email.com'));
        });
    });

    describe('Password hashing', () => {
        it('should hash passwords with bcrypt', async () => {
            const password = 'secure-password-123';
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);

            assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'));
            assert.ok(await bcrypt.compare(password, hash));
            assert.ok(!(await bcrypt.compare('wrong-password', hash)));
        });
    });

    describe('Token management', () => {
        it('should invalidate refresh token on logout', () => {
            const user = { id: 'user1', email: 'test@test.com' };
            const tokens = generateTokens(user);

            assert.ok(refreshTokens.has(tokens.refreshToken));
            refreshTokens.delete(tokens.refreshToken);
            assert.ok(!refreshTokens.has(tokens.refreshToken));
        });
    });
});

describe('Auth Routes - HTTP Endpoint Tests', () => {
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

    it('should register a new user via POST /api/auth/register', async () => {
        const res = await makeRequest(server, 'POST', '/api/auth/register', {
            email: 'alice@example.com',
            password: 'securepass123',
            displayName: 'Alice'
        });

        assert.strictEqual(res.status, 201);
        assert.ok(res.body.token);
        assert.ok(res.body.refreshToken);
        assert.strictEqual(res.body.user.email, 'alice@example.com');
        assert.strictEqual(res.body.user.displayName, 'Alice');
    });

    it('should reject registration with invalid email', async () => {
        const res = await makeRequest(server, 'POST', '/api/auth/register', {
            email: 'not-an-email',
            password: 'securepass123'
        });

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, 'Invalid email format');
    });

    it('should reject registration with short password', async () => {
        const res = await makeRequest(server, 'POST', '/api/auth/register', {
            email: 'test@example.com',
            password: 'short'
        });

        assert.strictEqual(res.status, 400);
    });

    it('should reject duplicate registration', async () => {
        await makeRequest(server, 'POST', '/api/auth/register', {
            email: 'alice@example.com',
            password: 'securepass123'
        });

        const res = await makeRequest(server, 'POST', '/api/auth/register', {
            email: 'alice@example.com',
            password: 'securepass123'
        });

        assert.strictEqual(res.status, 409);
        assert.strictEqual(res.body.error, 'User already exists');
    });

    it('should login with correct credentials via POST /api/auth/login', async () => {
        await makeRequest(server, 'POST', '/api/auth/register', {
            email: 'alice@example.com',
            password: 'securepass123'
        });

        const res = await makeRequest(server, 'POST', '/api/auth/login', {
            email: 'alice@example.com',
            password: 'securepass123'
        });

        assert.strictEqual(res.status, 200);
        assert.ok(res.body.token);
        assert.strictEqual(res.body.user.email, 'alice@example.com');
    });

    it('should reject login with wrong password', async () => {
        await makeRequest(server, 'POST', '/api/auth/register', {
            email: 'alice@example.com',
            password: 'securepass123'
        });

        const res = await makeRequest(server, 'POST', '/api/auth/login', {
            email: 'alice@example.com',
            password: 'wrongpassword'
        });

        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.error, 'Invalid credentials');
    });

    it('should reject registration with too-long displayName', async () => {
        const res = await makeRequest(server, 'POST', '/api/auth/register', {
            email: 'test@example.com',
            password: 'securepass123',
            displayName: 'A'.repeat(101)
        });

        assert.strictEqual(res.status, 400);
        assert.ok(res.body.error.includes('Display name'));
    });

    it('should reject registration with non-string displayName', async () => {
        const res = await makeRequest(server, 'POST', '/api/auth/register', {
            email: 'test@example.com',
            password: 'securepass123',
            displayName: 12345
        });

        assert.strictEqual(res.status, 400);
        assert.ok(res.body.error.includes('Display name'));
    });

    it('should reject login for non-existent user', async () => {
        const res = await makeRequest(server, 'POST', '/api/auth/login', {
            email: 'nobody@example.com',
            password: 'securepass123'
        });

        assert.strictEqual(res.status, 401);
    });
});

console.log('Running Auth Routes tests...');
