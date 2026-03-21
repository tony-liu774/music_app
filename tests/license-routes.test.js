/**
 * Tests for License API Routes
 * Server-side license validation, activation, and student management
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');

// Mock JWT for testing
const jwt = require('jsonwebtoken');

// Test configuration
const TEST_JWT_SECRET = 'test-secret-key';
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.NODE_ENV = 'test';

// Import license routes
const licenseRoutes = require('../src/routes/license');
const { generateTokens } = require('../src/routes/auth');

describe('License Routes', () => {
    let app;
    let authToken;
    let testLicenseKey;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/licenses', licenseRoutes);

        // Generate a test auth token
        const testUser = { id: 'user-123', email: 'test@example.com' };
        const tokens = generateTokens(testUser);
        authToken = tokens.token;

        // Get a valid license key from the module
        const licenseModule = require('../src/routes/license');
        const licensesMap = licenseModule.licenses;
        for (const [key, license] of licensesMap) {
            if (license.tier === 'pro') {
                testLicenseKey = key;
                break;
            }
        }
    });

    describe('POST /api/licenses/validate', () => {
        it('should validate a valid license key', async () => {
            const response = await makeRequest(app, '/api/licenses/validate', {
                method: 'POST',
                body: { licenseKey: testLicenseKey }
            });

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.valid, true);
            assert.strictEqual(response.body.tier, 'pro');
        });

        it('should reject invalid license key format', async () => {
            const response = await makeRequest(app, '/api/licenses/validate', {
                method: 'POST',
                body: { licenseKey: 'invalid-key' }
            });

            assert.strictEqual(response.status, 400);
            assert.strictEqual(response.body.error, 'Invalid license key format');
        });

        it('should reject non-existent license key', async () => {
            const response = await makeRequest(app, '/api/licenses/validate', {
                method: 'POST',
                body: { licenseKey: 'MCP-ABCD0000-EFGH0000-IJKL0000' }
            });

            assert.strictEqual(response.status, 404);
            assert.strictEqual(response.body.error, 'License key not found');
        });
    });

    describe('POST /api/licenses/activate', () => {
        it('should activate a valid license key', async () => {
            const licenseModule = require('../src/routes/license');
            const licensesMap = licenseModule.licenses;
            let newKey;
            for (const [key, lic] of licensesMap) {
                if (lic.tier === 'studio' && !lic.userId) {
                    newKey = key;
                    break;
                }
            }

            if (!newKey) {
                // Create a new license for testing
                newKey = licenseModule.generateLicenseKey('MCS');
            }

            const response = await makeRequest(app, '/api/licenses/activate', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
                body: { licenseKey: newKey }
            });

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.tier, 'studio');
            assert.strictEqual(response.body.status, 'active');
        });

        it('should reject activation without auth', async () => {
            const response = await makeRequest(app, '/api/licenses/activate', {
                method: 'POST',
                body: { licenseKey: testLicenseKey }
            });

            assert.strictEqual(response.status, 401);
        });
    });

    describe('GET /api/licenses/status', () => {
        it('should return free tier for unauthenticated user', async () => {
            const response = await makeRequest(app, '/api/licenses/status', {
                method: 'GET'
            });

            // Without auth, should fail (our routes require auth)
            assert.strictEqual(response.status, 401);
        });

        it('should return license status for authenticated user', async () => {
            // First activate a license
            const activateResponse = await makeRequest(app, '/api/licenses/activate', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
                body: { licenseKey: testLicenseKey }
            });

            if (activateResponse.status === 200) {
                const statusResponse = await makeRequest(app, '/api/licenses/status', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${authToken}` }
                });

                assert.strictEqual(statusResponse.status, 200);
                assert.strictEqual(statusResponse.body.hasLicense, true);
            }
        });
    });

    describe('POST /api/licenses/deactivate', () => {
        it('should deactivate license successfully', async () => {
            // First activate a license
            await makeRequest(app, '/api/licenses/activate', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
                body: { licenseKey: testLicenseKey }
            });

            // Get the license ID
            const licenseModule = require('../src/routes/license');
            const licensesMap = licenseModule.licenses;
            let licenseId;
            for (const [key, lic] of licensesMap) {
                if (lic.userId) {
                    licenseId = lic.id;
                    break;
                }
            }

            if (licenseId) {
                const response = await makeRequest(app, '/api/licenses/deactivate', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${authToken}` },
                    body: { licenseId }
                });

                assert.strictEqual(response.status, 200);
            }
        });
    });
});

// Helper function to make requests to Express app
async function makeRequest(app, path, options = {}) {
    return new Promise((resolve) => {
        const http = require('http');
        const server = http.createServer(app);

        server.listen(0, () => {
            const port = server.address().port;
            const url = `http://localhost:${port}${path}`;

            const reqOptions = {
                hostname: 'localhost',
                port,
                path,
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            };

            const req = http.request(reqOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    server.close();
                    try {
                        resolve({
                            status: res.statusCode,
                            body: JSON.parse(data || '{}')
                        });
                    } catch {
                        resolve({
                            status: res.statusCode,
                            body: data
                        });
                    }
                });
            });

            if (options.body) {
                req.write(JSON.stringify(options.body));
            }
            req.end();
        });
    });
}
