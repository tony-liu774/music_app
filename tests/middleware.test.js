/**
 * Tests for middleware modules: logger, cors, rateLimiter
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const app = require('../src/index');

function makeRequest(server, method, path, headers = {}) {
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
                    resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, headers: res.headers, body: data });
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// --- Logger middleware unit tests ---

describe('Logger Middleware', () => {
    it('should be a function', () => {
        const logger = require('../src/middleware/logger');
        assert.strictEqual(typeof logger, 'function');
    });

    it('should call next() immediately in test environment', (_, done) => {
        const logger = require('../src/middleware/logger');

        logger({
            method: 'GET',
            originalUrl: '/test'
        }, {}, () => {
            done();
        });
    });

    it('should skip logging in test environment', () => {
        const logger = require('../src/middleware/logger');
        const { EventEmitter } = require('events');
        const mockRes = new EventEmitter();
        mockRes.statusCode = 200;

        let nextCalled = false;
        let listenerAdded = false;
        const originalOn = mockRes.on.bind(mockRes);
        mockRes.on = (event, ...args) => {
            if (event === 'finish') listenerAdded = true;
            return originalOn(event, ...args);
        };

        logger({ method: 'GET', originalUrl: '/test' }, mockRes, () => {
            nextCalled = true;
        });

        assert.strictEqual(nextCalled, true);
        assert.strictEqual(listenerAdded, false);
    });

    it('should log on response finish in non-test environment', () => {
        const logger = require('../src/middleware/logger');
        const { EventEmitter } = require('events');
        const mockRes = new EventEmitter();
        mockRes.statusCode = 200;

        const originalEnv = process.env.NODE_ENV;
        const originalLog = console.log;
        let logCalled = false;

        try {
            process.env.NODE_ENV = 'development';
            console.log = (msg) => {
                if (typeof msg === 'string' && msg.includes('GET') && msg.includes('/test') && msg.includes('200')) {
                    logCalled = true;
                }
            };

            logger({ method: 'GET', originalUrl: '/test' }, mockRes, () => {});
            mockRes.emit('finish');

            assert.strictEqual(logCalled, true);
        } finally {
            console.log = originalLog;
            process.env.NODE_ENV = originalEnv;
        }
    });
});

// --- CORS middleware unit tests ---

describe('CORS Middleware', () => {
    it('should be a function', () => {
        const cors = require('../src/middleware/cors');
        assert.strictEqual(typeof cors, 'function');
    });

    it('should call next()', (_, done) => {
        const cors = require('../src/middleware/cors');
        cors(
            { method: 'GET', headers: { origin: 'http://localhost:5173' } },
            {
                setHeader: () => {},
                getHeader: () => undefined,
                end: () => {}
            },
            () => { done(); }
        );
    });
});

// --- Rate Limiter middleware unit tests ---

describe('Rate Limiter Middleware', () => {
    it('should be a function', () => {
        const rateLimiter = require('../src/middleware/rateLimiter');
        assert.strictEqual(typeof rateLimiter, 'function');
    });

    it('should have skip function that returns true in test environment', () => {
        const rateLimiter = require('../src/middleware/rateLimiter');
        assert.strictEqual(typeof rateLimiter._skipInTest, 'function');
        assert.strictEqual(rateLimiter._skipInTest(), true);
    });

    it('should have skip function that returns false in non-test environment', () => {
        const rateLimiter = require('../src/middleware/rateLimiter');
        const originalEnv = process.env.NODE_ENV;
        try {
            process.env.NODE_ENV = 'development';
            assert.strictEqual(rateLimiter._skipInTest(), false);
        } finally {
            process.env.NODE_ENV = originalEnv;
        }
    });

    it('should return 429 with error and retryAfter when rate limit exceeded', async () => {
        const express = require('express');
        const rateLimit = require('express-rate-limit');
        const config = require('../src/config');

        const testApp = express();
        testApp.use(rateLimit({
            windowMs: 60000,
            max: 2,
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                const resetTime = req.rateLimit?.resetTime;
                const retryAfter = resetTime
                    ? Math.ceil((resetTime.getTime() - Date.now()) / 1000)
                    : Math.ceil(60000 / 1000);
                res.status(429).json({
                    error: 'Too many requests from this IP, please try again later.',
                    retryAfter,
                });
            },
        }));
        testApp.get('/test', (req, res) => res.json({ ok: true }));

        const testServer = await new Promise((resolve) => {
            const s = testApp.listen(0, () => resolve(s));
        });

        try {
            // First 2 requests should succeed
            const res1 = await makeRequest(testServer, 'GET', '/test');
            assert.strictEqual(res1.status, 200);
            const res2 = await makeRequest(testServer, 'GET', '/test');
            assert.strictEqual(res2.status, 200);

            // Third request should be rate limited
            const res3 = await makeRequest(testServer, 'GET', '/test');
            assert.strictEqual(res3.status, 429);
            assert.strictEqual(res3.body.error, 'Too many requests from this IP, please try again later.');
            assert.ok(typeof res3.body.retryAfter === 'number');
            assert.ok(res3.body.retryAfter > 0);
            assert.ok(res3.body.retryAfter <= 60);
        } finally {
            await new Promise((resolve) => testServer.close(resolve));
        }
    });
});

// --- Integration tests via HTTP ---

describe('Middleware Integration Tests', () => {
    let server;

    beforeEach((_, done) => {
        server = app.listen(0, () => done());
    });

    afterEach((_, done) => {
        server.close(() => done());
    });

    it('should respond with CORS headers for allowed origin', async () => {
        const res = await makeRequest(server, 'GET', '/health', {
            'Origin': 'http://localhost:5173'
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:5173');
    });

    it('should include Access-Control-Allow-Credentials header', async () => {
        const res = await makeRequest(server, 'GET', '/health', {
            'Origin': 'http://localhost:5173'
        });
        assert.strictEqual(res.headers['access-control-allow-credentials'], 'true');
    });

    it('should handle OPTIONS preflight with allowed headers and methods', async () => {
        const url = new URL('/health', `http://localhost:${server.address().port}`);
        const res = await new Promise((resolve, reject) => {
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'OPTIONS',
                headers: {
                    'Origin': 'http://localhost:5173',
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'Authorization'
                }
            };
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
            });
            req.on('error', reject);
            req.end();
        });
        assert.ok(res.status === 204 || res.status === 200);
        const allowedHeaders = res.headers['access-control-allow-headers'];
        assert.ok(allowedHeaders && allowedHeaders.includes('Authorization'),
            'Should allow Authorization header');
    });

    it('should not be rate limited in test environment', async () => {
        for (let i = 0; i < 5; i++) {
            const res = await makeRequest(server, 'GET', '/health');
            assert.strictEqual(res.status, 200);
        }
    });

    it('health endpoint should return ok', async () => {
        const res = await makeRequest(server, 'GET', '/health');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'ok');
    });

    it('health/detailed should return timestamp but hide memory in production-like guard', async () => {
        const res = await makeRequest(server, 'GET', '/health/detailed');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'ok');
        assert.ok(res.body.timestamp);
        // In test (non-production) env, uptime and memory should be present
        assert.ok(typeof res.body.uptime === 'number');
        assert.ok(res.body.memory);
    });
});
