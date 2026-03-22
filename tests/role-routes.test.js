const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { users, generateTokens, refreshTokens } = require('../src/routes/auth');

// Helper to create test user and tokens
function createTestUser(overrides = {}) {
    const user = {
        id: 'test-user-' + Date.now().toString(36),
        email: `test-${Date.now()}@example.com`,
        displayName: 'Test User',
        hashedPassword: null,
        createdAt: Date.now(),
        ...overrides
    };
    users.set(user.email, user);
    return { user, ...generateTokens(user) };
}

// Mini HTTP test helper - makes a request to the auth router
const express = require('express');
const authRouter = require('../src/routes/auth');

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    return app;
}

async function request(app, method, path, body, headers = {}) {
    return new Promise((resolve) => {
        const server = app.listen(0, async () => {
            const port = server.address().port;
            const url = `http://127.0.0.1:${port}${path}`;
            const options = {
                method,
                headers: { 'Content-Type': 'application/json', ...headers }
            };
            if (body) {
                options.body = JSON.stringify(body);
            }
            try {
                const res = await fetch(url, options);
                const data = await res.json();
                resolve({ status: res.status, data });
            } finally {
                server.close();
            }
        });
    });
}

describe('Role Routes', () => {
    beforeEach(() => {
        users.clear();
        refreshTokens.clear();
    });

    describe('POST /api/auth/role', () => {
        test('sets user role to student', async () => {
            const { user, token } = createTestUser();
            const app = createApp();
            const res = await request(app, 'POST', '/api/auth/role',
                { role: 'student' },
                { Authorization: `Bearer ${token}` }
            );
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.role, 'student');
            assert.strictEqual(res.data.message, 'Role updated successfully');
            assert.strictEqual(user.role, 'student');
        });

        test('sets user role to teacher', async () => {
            const { user, token } = createTestUser();
            const app = createApp();
            const res = await request(app, 'POST', '/api/auth/role',
                { role: 'teacher' },
                { Authorization: `Bearer ${token}` }
            );
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.role, 'teacher');
            assert.strictEqual(user.role, 'teacher');
        });

        test('rejects invalid role', async () => {
            const { token } = createTestUser();
            const app = createApp();
            const res = await request(app, 'POST', '/api/auth/role',
                { role: 'admin' },
                { Authorization: `Bearer ${token}` }
            );
            assert.strictEqual(res.status, 400);
            assert.ok(res.data.error.includes('Role must be'));
        });

        test('rejects missing role', async () => {
            const { token } = createTestUser();
            const app = createApp();
            const res = await request(app, 'POST', '/api/auth/role',
                {},
                { Authorization: `Bearer ${token}` }
            );
            assert.strictEqual(res.status, 400);
        });

        test('rejects empty role', async () => {
            const { token } = createTestUser();
            const app = createApp();
            const res = await request(app, 'POST', '/api/auth/role',
                { role: '' },
                { Authorization: `Bearer ${token}` }
            );
            assert.strictEqual(res.status, 400);
        });

        test('requires authentication', async () => {
            const app = createApp();
            const res = await request(app, 'POST', '/api/auth/role',
                { role: 'student' }
            );
            assert.strictEqual(res.status, 401);
        });

        test('rejects invalid token', async () => {
            const app = createApp();
            const res = await request(app, 'POST', '/api/auth/role',
                { role: 'student' },
                { Authorization: 'Bearer invalid-token' }
            );
            assert.strictEqual(res.status, 401);
        });

        test('rejects refresh token used as access token', async () => {
            const { refreshToken } = createTestUser();
            const app = createApp();
            const res = await request(app, 'POST', '/api/auth/role',
                { role: 'student' },
                { Authorization: `Bearer ${refreshToken}` }
            );
            assert.strictEqual(res.status, 401);
            assert.strictEqual(res.data.error, 'Invalid token type');
        });

        test('returns 404 for deleted user', async () => {
            const { user, token } = createTestUser();
            // Remove the user from the store
            users.delete(user.email);
            const app = createApp();
            const res = await request(app, 'POST', '/api/auth/role',
                { role: 'student' },
                { Authorization: `Bearer ${token}` }
            );
            assert.strictEqual(res.status, 404);
        });

        test('updates role from student to teacher', async () => {
            const { user, token } = createTestUser();
            const app = createApp();

            await request(app, 'POST', '/api/auth/role',
                { role: 'student' },
                { Authorization: `Bearer ${token}` }
            );
            assert.strictEqual(user.role, 'student');

            const res = await request(app, 'POST', '/api/auth/role',
                { role: 'teacher' },
                { Authorization: `Bearer ${token}` }
            );
            assert.strictEqual(res.status, 200);
            assert.strictEqual(user.role, 'teacher');
        });
    });

    describe('GET /api/auth/role', () => {
        test('returns null for user without role', async () => {
            const { token } = createTestUser();
            const app = createApp();
            const res = await request(app, 'GET', '/api/auth/role', null,
                { Authorization: `Bearer ${token}` }
            );
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.role, null);
        });

        test('returns student role', async () => {
            const { user, token } = createTestUser();
            user.role = 'student';
            const app = createApp();
            const res = await request(app, 'GET', '/api/auth/role', null,
                { Authorization: `Bearer ${token}` }
            );
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.role, 'student');
        });

        test('returns teacher role', async () => {
            const { user, token } = createTestUser();
            user.role = 'teacher';
            const app = createApp();
            const res = await request(app, 'GET', '/api/auth/role', null,
                { Authorization: `Bearer ${token}` }
            );
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.role, 'teacher');
        });

        test('requires authentication', async () => {
            const app = createApp();
            const res = await request(app, 'GET', '/api/auth/role', null);
            assert.strictEqual(res.status, 401);
        });

        test('rejects refresh token', async () => {
            const { refreshToken } = createTestUser();
            const app = createApp();
            const res = await request(app, 'GET', '/api/auth/role', null,
                { Authorization: `Bearer ${refreshToken}` }
            );
            assert.strictEqual(res.status, 401);
        });

        test('returns 404 for deleted user', async () => {
            const { user, token } = createTestUser();
            users.delete(user.email);
            const app = createApp();
            const res = await request(app, 'GET', '/api/auth/role', null,
                { Authorization: `Bearer ${token}` }
            );
            assert.strictEqual(res.status, 404);
        });
    });
});
