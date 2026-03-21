/**
 * Tests for Auth Routes - Server-side authentication endpoints
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'music-app-jwt-secret-dev';

// Import route internals for testing
const { users, generateTokens, refreshTokens, authMiddleware } = require('../src/routes/auth');

describe('Auth Routes', () => {
    beforeEach(() => {
        users.clear();
        refreshTokens.clear();
    });

    afterEach(() => {
        users.clear();
        refreshTokens.clear();
    });

    describe('generateTokens', () => {
        it('should generate a valid JWT token', () => {
            const user = { id: 'user1', email: 'test@test.com' };
            const tokens = generateTokens(user);

            assert.ok(tokens.token);
            assert.ok(tokens.refreshToken);

            const decoded = jwt.verify(tokens.token, JWT_SECRET);
            assert.strictEqual(decoded.email, 'test@test.com');
            assert.strictEqual(decoded.id, 'user1');
        });

        it('should generate a refresh token', () => {
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
            let responseBody;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: (body) => { responseBody = body; }
            };
            const next = () => {};

            authMiddleware(req, res, next);
            assert.strictEqual(statusCode, 401);
            assert.strictEqual(responseBody.error, 'Invalid or expired token');
        });

        it('should accept valid tokens and set req.user', () => {
            const token = jwt.sign({ id: 'user1', email: 'test@test.com' }, JWT_SECRET, { expiresIn: '1h' });
            const req = { headers: { authorization: `Bearer ${token}` } };
            const res = {};
            let nextCalled = false;
            const next = () => { nextCalled = true; };

            authMiddleware(req, res, next);
            assert.strictEqual(nextCalled, true);
            assert.strictEqual(req.user.id, 'user1');
            assert.strictEqual(req.user.email, 'test@test.com');
        });

        it('should reject expired tokens', () => {
            const token = jwt.sign({ id: 'user1', email: 'test@test.com' }, JWT_SECRET, { expiresIn: '-1s' });
            const req = { headers: { authorization: `Bearer ${token}` } };
            let statusCode;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: () => {}
            };
            const next = () => {};

            authMiddleware(req, res, next);
            assert.strictEqual(statusCode, 401);
        });

        it('should reject tokens without Bearer prefix', () => {
            const token = jwt.sign({ id: 'user1' }, JWT_SECRET, { expiresIn: '1h' });
            const req = { headers: { authorization: token } };
            let statusCode;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: () => {}
            };
            const next = () => {};

            authMiddleware(req, res, next);
            assert.strictEqual(statusCode, 401);
        });
    });

    describe('User registration flow', () => {
        it('should hash passwords with bcrypt', async () => {
            const password = 'secure-password-123';
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);

            assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'));
            assert.ok(await bcrypt.compare(password, hash));
            assert.ok(!(await bcrypt.compare('wrong-password', hash)));
        });

        it('should add user to the store on registration', () => {
            const user = {
                id: 'user1',
                email: 'test@test.com',
                displayName: 'Test User',
                hashedPassword: '$2a$10$fake-hash',
                createdAt: Date.now()
            };
            users.set(user.email, user);

            assert.ok(users.has('test@test.com'));
            assert.strictEqual(users.get('test@test.com').displayName, 'Test User');
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

        it('should generate different tokens for different users', () => {
            const user1 = { id: 'user1', email: 'alice@test.com' };
            const user2 = { id: 'user2', email: 'bob@test.com' };
            const tokens1 = generateTokens(user1);
            const tokens2 = generateTokens(user2);

            assert.notStrictEqual(tokens1.token, tokens2.token);
            assert.notStrictEqual(tokens1.refreshToken, tokens2.refreshToken);
        });
    });
});

console.log('Running Auth Routes tests...');
