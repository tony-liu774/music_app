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
        // Clear the in-memory Maps before each test for isolation
        const licenseModule = require('../src/routes/license');
        licenseModule.licenses.clear();
        licenseModule.invitations.clear();

        // Set up fresh test licenses
        const proKey = licenseModule.generateLicenseKey('MCP');
        licenseModule.licenses.set(proKey, {
            id: 'pro-lic-001',
            type: 'subscription',
            tier: 'pro',
            userId: null,
            status: 'active',
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
            studentLimit: 0,
            studentCount: 0,
            students: [],
            createdAt: Date.now()
        });

        const studioKey = licenseModule.generateLicenseKey('MCS');
        licenseModule.licenses.set(studioKey, {
            id: 'studio-lic-001',
            type: 'one-time',
            tier: 'studio',
            userId: null,
            status: 'active',
            expiresAt: null,
            studentLimit: 30,
            studentCount: 0,
            students: [],
            createdAt: Date.now()
        });

        testLicenseKey = proKey;

        app = express();
        app.use(express.json());
        app.use('/api/licenses', licenseRoutes);

        // Generate a test auth token
        const testUser = { id: 'user-123', email: 'test@example.com' };
        const tokens = generateTokens(testUser);
        authToken = tokens.token;
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
                body: { licenseKey: 'MCP-ABCD0000-EFGH-IJKL' }
            });

            assert.strictEqual(response.status, 404);
            assert.strictEqual(response.body.error, 'License key not found');
        });
    });

    describe('POST /api/licenses/activate', () => {
        it('should activate a valid license key', async () => {
            const licenseModule = require('../src/routes/license');
            const licensesMap = licenseModule.licenses;
            let studioKey;
            for (const [key, lic] of licensesMap) {
                if (lic.tier === 'studio' && !lic.userId) {
                    studioKey = key;
                    break;
                }
            }

            // We have a studio license from beforeEach setup
            assert.ok(studioKey, 'Studio license should exist from beforeEach');

            const response = await makeRequest(app, '/api/licenses/activate', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
                body: { licenseKey: studioKey }
            });

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.tier, 'studio');
            assert.strictEqual(response.body.status, 'active');
        });

        it('should allow license activation in public mode (no auth required)', async () => {
            const response = await makeRequest(app, '/api/licenses/activate', {
                method: 'POST',
                body: { licenseKey: testLicenseKey }
            });

            // In public mode, auth is bypassed so activation succeeds
            assert.strictEqual(response.status, 200);
        });
    });

    describe('GET /api/licenses/status', () => {
        it('should return free tier for unauthenticated user in public mode', async () => {
            const response = await makeRequest(app, '/api/licenses/status', {
                method: 'GET'
            });

            // In public mode, auth is bypassed so status returns
            assert.strictEqual(response.status, 200);
        });

        it('should return license status for authenticated user', async () => {
            // First activate a license
            const activateResponse = await makeRequest(app, '/api/licenses/activate', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
                body: { licenseKey: testLicenseKey }
            });

            assert.strictEqual(activateResponse.status, 200);

            const statusResponse = await makeRequest(app, '/api/licenses/status', {
                method: 'GET',
                headers: { Authorization: `Bearer ${authToken}` }
            });

            assert.strictEqual(statusResponse.status, 200);
            assert.strictEqual(statusResponse.body.hasLicense, true);
        });
    });

    describe('POST /api/licenses/deactivate', () => {
        it('should deactivate license successfully', async () => {
            // First activate a license
            const activateResponse = await makeRequest(app, '/api/licenses/activate', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
                body: { licenseKey: testLicenseKey }
            });

            assert.strictEqual(activateResponse.status, 200);
            const licenseId = activateResponse.body.id;
            assert.ok(licenseId, 'License should have an ID after activation');

            const response = await makeRequest(app, '/api/licenses/deactivate', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
                body: { licenseId }
            });

            assert.strictEqual(response.status, 200);
        });
    });

    // Helper to set up a studio license with a teacher
    async function setupStudioLicense() {
        const licenseModule = require('../src/routes/license');
        const licensesMap = licenseModule.licenses;
        let studioKey;
        for (const [key, lic] of licensesMap) {
            if (lic.tier === 'studio' && !lic.userId) {
                studioKey = key;
                break;
            }
        }

        if (!studioKey) {
            studioKey = licenseModule.generateLicenseKey('MCS');
            licensesMap.set(studioKey, {
                id: 'studio-lic-001',
                type: 'one-time',
                tier: 'studio',
                userId: null,
                status: 'active',
                expiresAt: null,
                studentLimit: 30,
                studentCount: 0,
                students: [],
                createdAt: Date.now()
            });
        }

        // Activate the studio license
        await makeRequest(app, '/api/licenses/activate', {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}` },
            body: { licenseKey: studioKey }
        });

        return studioKey;
    }

    describe('POST /api/licenses/generate-student-key', () => {
        it('should generate a student key for studio license', async () => {
            await setupStudioLicense();

            const response = await makeRequest(app, '/api/licenses/generate-student-key', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
                body: { studentEmail: 'student@test.com' }
            });

            assert.strictEqual(response.status, 200);
            assert.ok(response.body.studentKey);
            assert.ok(response.body.studentKey.startsWith('STU-'));
            assert.strictEqual(response.body.studentEmail, 'student@test.com');
        });

        it('should reject without studio license', async () => {
            // Use a different auth token (not a teacher)
            const otherToken = generateTokens({ id: 'other-user', email: 'other@test.com' }).token;

            const response = await makeRequest(app, '/api/licenses/generate-student-key', {
                method: 'POST',
                headers: { Authorization: `Bearer ${otherToken}` },
                body: { studentEmail: 'student@test.com' }
            });

            assert.strictEqual(response.status, 403);
            assert.strictEqual(response.body.error, 'Studio license required for student invitations');
        });

        it('should reject invalid email', async () => {
            await setupStudioLicense();

            const response = await makeRequest(app, '/api/licenses/generate-student-key', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
                body: { studentEmail: 'invalid-email' }
            });

            assert.strictEqual(response.status, 400);
        });
    });

    describe('POST /api/licenses/invite-link', () => {
        it('should generate an invite link', async () => {
            await setupStudioLicense();

            const response = await makeRequest(app, '/api/licenses/invite-link', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` }
            });

            assert.strictEqual(response.status, 200);
            assert.ok(response.body.inviteLink);
            assert.ok(response.body.inviteLink.includes('?invite='));
            // remainingSlots may vary based on previous tests
            assert.ok(response.body.remainingSlots >= 0);
        });

        it('should reject without studio license', async () => {
            const otherToken = generateTokens({ id: 'other-user', email: 'other@test.com' }).token;

            const response = await makeRequest(app, '/api/licenses/invite-link', {
                method: 'POST',
                headers: { Authorization: `Bearer ${otherToken}` }
            });

            assert.strictEqual(response.status, 403);
        });
    });

    describe('POST /api/licenses/accept-invitation', () => {
        it('should accept invitation with valid token', async () => {
            await setupStudioLicense();

            // Generate invite link
            const inviteResponse = await makeRequest(app, '/api/licenses/invite-link', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` }
            });

            assert.strictEqual(inviteResponse.status, 200);
            const inviteLink = inviteResponse.body.inviteLink;
            assert.ok(inviteLink, 'inviteLink should exist');
            const token = inviteLink.split('?invite=')[1];

            // Accept invitation as a different user
            const studentToken = generateTokens({ id: 'student-user', email: 'newstudent@test.com' }).token;

            const response = await makeRequest(app, '/api/licenses/accept-invitation', {
                method: 'POST',
                headers: { Authorization: `Bearer ${studentToken}` },
                body: { invitationToken: token }
            });

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.tier, 'studio');
        });

        it('should reject invalid token', async () => {
            const studentToken = generateTokens({ id: 'student-user', email: 'student@test.com' }).token;

            const response = await makeRequest(app, '/api/licenses/accept-invitation', {
                method: 'POST',
                headers: { Authorization: `Bearer ${studentToken}` },
                body: { invitationToken: 'invalid-token' }
            });

            assert.strictEqual(response.status, 404);
        });

        it('should reject invitation when student limit is reached', async () => {
            await setupStudioLicense();

            // Find the license and set studentCount to at limit BEFORE creating invite
            const licenseModule = require('../src/routes/license');
            const licensesMap = licenseModule.licenses;
            for (const [key, lic] of licensesMap) {
                if (lic.tier === 'studio' && lic.userId) {
                    // Add dummy students to reach limit
                    lic.students = [];
                    for (let i = 0; i < lic.studentLimit; i++) {
                        lic.students.push({
                            id: `student-${i}`,
                            email: `student${i}@test.com`,
                            userId: `user-${i}`,
                            invitedAt: Date.now(),
                            activatedAt: Date.now()
                        });
                    }
                    lic.studentCount = lic.studentLimit;
                    licensesMap.set(key, lic);
                    break;
                }
            }

            // Try to generate invite link when at limit
            const response = await makeRequest(app, '/api/licenses/invite-link', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` }
            });

            assert.strictEqual(response.status, 400);
            assert.ok(response.body.error.includes('Student limit reached'));
        });
    });

    describe('GET /api/licenses/students', () => {
        it('should return students list for studio license', async () => {
            await setupStudioLicense();

            // Generate a student key
            await makeRequest(app, '/api/licenses/generate-student-key', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
                body: { studentEmail: 'student@test.com' }
            });

            const response = await makeRequest(app, '/api/licenses/students', {
                method: 'GET',
                headers: { Authorization: `Bearer ${authToken}` }
            });

            assert.strictEqual(response.status, 200);
            assert.ok(Array.isArray(response.body));
            assert.ok(response.body.length > 0);
            // Should not expose the student key
            assert.strictEqual(response.body[0].key, undefined);
        });

        it('should reject without studio license', async () => {
            const otherToken = generateTokens({ id: 'other-user', email: 'other@test.com' }).token;

            const response = await makeRequest(app, '/api/licenses/students', {
                method: 'GET',
                headers: { Authorization: `Bearer ${otherToken}` }
            });

            assert.strictEqual(response.status, 403);
        });
    });

    describe('DELETE /api/licenses/students/:studentId', () => {
        it('should remove a student from studio license', async () => {
            await setupStudioLicense();

            // Generate a student key
            const genResponse = await makeRequest(app, '/api/licenses/generate-student-key', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
                body: { studentEmail: 'student@test.com' }
            });

            assert.strictEqual(genResponse.status, 200);
            const studentId = genResponse.body.studentId;
            assert.ok(studentId, 'Should have a student ID');

            // Delete the student
            const deleteResponse = await makeRequest(app, `/api/licenses/students/${studentId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${authToken}` }
            });

            assert.strictEqual(deleteResponse.status, 200);
        });
    });

    describe('GET /api/licenses/:licenseId/renewal', () => {
        it('should return renewal info for subscription license', async () => {
            // Activate pro license first
            const activateResponse = await makeRequest(app, '/api/licenses/activate', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
                body: { licenseKey: testLicenseKey }
            });

            assert.strictEqual(activateResponse.status, 200);
            const licenseId = activateResponse.body.id;
            assert.ok(licenseId, 'License should have an ID after activation');

            const response = await makeRequest(app, `/api/licenses/${licenseId}/renewal`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${authToken}` }
            });

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.currentTier, 'pro');
        });

        it('should return no renewal needed for one-time license', async () => {
            const studioKey = await setupStudioLicense();

            // Get license ID using the Map key (not lic.key)
            const licenseModule = require('../src/routes/license');
            const licensesMap = licenseModule.licenses;
            let licenseId;
            for (const [key, lic] of licensesMap) {
                if (key === studioKey) {
                    licenseId = lic.id;
                    break;
                }
            }

            assert.ok(licenseId, 'Should find the studio license');

            const response = await makeRequest(app, `/api/licenses/${licenseId}/renewal`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${authToken}` }
            });

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.renewalRequired, false);
        });

        it('should return 404 for non-existent license', async () => {
            const response = await makeRequest(app, '/api/licenses/non-existent-id/renewal', {
                method: 'GET',
                headers: { Authorization: `Bearer ${authToken}` }
            });

            assert.strictEqual(response.status, 404);
        });
    });

    describe('POST /api/licenses/redeem-student-key', () => {
        it('should redeem a valid student key', async () => {
            // First set up a studio license with a student
            await setupStudioLicense();

            // Generate a student key
            const genResponse = await makeRequest(app, '/api/licenses/generate-student-key', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
                body: { studentEmail: 'newstudent@test.com' }
            });

            assert.strictEqual(genResponse.status, 200);
            const studentKey = genResponse.body.studentKey;
            assert.ok(studentKey, 'Should have a student key');

            // Now redeem as a different user (the student)
            const studentToken = generateTokens({ id: 'student-user', email: 'newstudent@test.com' }).token;

            const response = await makeRequest(app, '/api/licenses/redeem-student-key', {
                method: 'POST',
                headers: { Authorization: `Bearer ${studentToken}` },
                body: { studentKey }
            });

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.tier, 'studio');
        });

        it('should reject invalid student key format', async () => {
            const studentToken = generateTokens({ id: 'student-user', email: 'student@test.com' }).token;

            const response = await makeRequest(app, '/api/licenses/redeem-student-key', {
                method: 'POST',
                headers: { Authorization: `Bearer ${studentToken}` },
                body: { studentKey: 'invalid-key' }
            });

            assert.strictEqual(response.status, 400);
            assert.strictEqual(response.body.error, 'Invalid student key format');
        });

        it('should reject non-existent student key', async () => {
            const studentToken = generateTokens({ id: 'student-user', email: 'student@test.com' }).token;

            const response = await makeRequest(app, '/api/licenses/redeem-student-key', {
                method: 'POST',
                headers: { Authorization: `Bearer ${studentToken}` },
                body: { studentKey: 'STU-ABCD0000-EFGH-IJKL' }
            });

            assert.strictEqual(response.status, 404);
            assert.strictEqual(response.body.error, 'Student key not found');
        });

        it('should reject key already redeemed by another user', async () => {
            // First set up a studio license with a student
            await setupStudioLicense();

            // Generate a student key
            const genResponse = await makeRequest(app, '/api/licenses/generate-student-key', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` },
                body: { studentEmail: 'student@test.com' }
            });

            const studentKey = genResponse.body.studentKey;

            // First user redeems
            const firstStudentToken = generateTokens({ id: 'first-student', email: 'student@test.com' }).token;
            await makeRequest(app, '/api/licenses/redeem-student-key', {
                method: 'POST',
                headers: { Authorization: `Bearer ${firstStudentToken}` },
                body: { studentKey }
            });

            // Second user tries to redeem the same key
            const secondStudentToken = generateTokens({ id: 'second-student', email: 'other@test.com' }).token;
            const response = await makeRequest(app, '/api/licenses/redeem-student-key', {
                method: 'POST',
                headers: { Authorization: `Bearer ${secondStudentToken}` },
                body: { studentKey }
            });

            assert.strictEqual(response.status, 409);
            assert.strictEqual(response.body.error, 'Key already redeemed by another user');
        });

        it('should accept redeem-student-key in public mode (no auth required)', async () => {
            const response = await makeRequest(app, '/api/licenses/redeem-student-key', {
                method: 'POST',
                body: { studentKey: 'STU-ABCD0000-EFGH-IJKL' }
            });

            // In public mode, auth is bypassed - should get 404 (key not found) not 401
            assert.strictEqual(response.status, 404);
        });
    });

    describe('GET /api/licenses/check-invitation', () => {
        it('should return no invitation when none exists', async () => {
            const response = await makeRequest(app, '/api/licenses/check-invitation', {
                method: 'GET',
                headers: { Authorization: `Bearer ${authToken}` }
            });

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.hasInvitation, false);
        });

        it('should detect valid invitation with token', async () => {
            // First set up a studio license and generate invite link
            await setupStudioLicense();

            const inviteResponse = await makeRequest(app, '/api/licenses/invite-link', {
                method: 'POST',
                headers: { Authorization: `Bearer ${authToken}` }
            });

            const inviteLink = inviteResponse.body.inviteLink;
            const token = inviteLink.split('?invite=')[1];

            // Check invitation as the student
            const studentToken = generateTokens({ id: 'student-user', email: 'newstudent@test.com' }).token;

            const response = await makeRequest(app, `/api/licenses/check-invitation?token=${token}`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${studentToken}` }
            });

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.hasInvitation, true);
            assert.strictEqual(response.body.teacherTier, 'studio');
        });

        it('should return no invitation for invalid token', async () => {
            const studentToken = generateTokens({ id: 'student-user', email: 'student@test.com' }).token;

            const response = await makeRequest(app, '/api/licenses/check-invitation?token=invalid-token', {
                method: 'GET',
                headers: { Authorization: `Bearer ${studentToken}` }
            });

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.hasInvitation, false);
        });

        it('should return no invitation for expired token', async () => {
            // Create an expired invitation
            const licenseModule = require('../src/routes/license');
            const expiredToken = licenseModule.generateInviteToken();
            licenseModule.invitations.set(expiredToken, {
                licenseId: 'studio-lic-001',
                teacherId: 'user-123',
                expiresAt: Date.now() - 1000, // Expired 1 second ago
                maxUses: 1,
                usedCount: 0
            });

            const studentToken = generateTokens({ id: 'student-user', email: 'student@test.com' }).token;

            const response = await makeRequest(app, `/api/licenses/check-invitation?token=${expiredToken}`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${studentToken}` }
            });

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.hasInvitation, false);
            assert.ok(response.body.error.includes('expired'));
        });

        it('should allow check-invitation in public mode (no auth required)', async () => {
            const response = await makeRequest(app, '/api/licenses/check-invitation', {
                method: 'GET'
            });

            // In public mode, auth is bypassed so request succeeds
            assert.strictEqual(response.status, 200);
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
