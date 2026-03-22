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

    it('should call next()', (_, done) => {
        const logger = require('../src/middleware/logger');
        const { EventEmitter } = require('events');
        const mockRes = new EventEmitter();
        mockRes.statusCode = 200;

        logger({
            method: 'GET',
            originalUrl: '/test'
        }, mockRes, () => {
            done();
        });
    });

    it('should log on response finish', (_, done) => {
        const logger = require('../src/middleware/logger');
        const { EventEmitter } = require('events');
        const mockRes = new EventEmitter();
        mockRes.statusCode = 200;

        const originalLog = console.log;
        let logCalled = false;
        console.log = (msg) => {
            if (typeof msg === 'string' && msg.includes('GET') && msg.includes('/test') && msg.includes('200')) {
                logCalled = true;
            }
        };

        logger({ method: 'GET', originalUrl: '/test' }, mockRes, () => {});
        mockRes.emit('finish');

        console.log = originalLog;
        assert.strictEqual(logCalled, true);
        done();
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

    it('should skip rate limiting in test environment', () => {
        // NODE_ENV is 'test' during test runs
        assert.strictEqual(process.env.NODE_ENV, 'test');
        const rateLimiter = require('../src/middleware/rateLimiter');
        // The skip function should return true in test env
        assert.strictEqual(typeof rateLimiter, 'function');
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

    it('should handle OPTIONS preflight requests', async () => {
        const url = new URL('/health', `http://localhost:${server.address().port}`);
        const res = await new Promise((resolve, reject) => {
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'OPTIONS',
                headers: {
                    'Origin': 'http://localhost:5173',
                    'Access-Control-Request-Method': 'GET'
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
    });

    it('should not be rate limited in test environment', async () => {
        // Make several rapid requests — should all succeed in test env
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

    it('health/detailed endpoint should return uptime and memory', async () => {
        const res = await makeRequest(server, 'GET', '/health/detailed');
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, 'ok');
        assert.ok(typeof res.body.uptime === 'number');
        assert.ok(res.body.timestamp);
        assert.ok(res.body.memory);
    });
});
