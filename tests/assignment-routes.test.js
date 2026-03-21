/**
 * Assignment Routes Tests
 * Tests for the Smart Assignments API endpoints
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// Require the router module
const router = require('../src/routes/assignments');

// Access internal state for testing
const { _assignments: assignments, _relationships: relationships, _notifications: notifications, _sseClients: sseClients } = router;

// Helper: create mock Express req/res
function createMockReq(options = {}) {
    return {
        body: options.body || {},
        params: options.params || {},
        query: options.query || {},
        method: options.method || 'GET',
        on: () => {}
    };
}

function createMockRes() {
    const res = {
        statusCode: 200,
        headers: {},
        body: null,
        _written: [],
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            this.body = data;
            return this;
        },
        writeHead: function(code, headers) {
            this.statusCode = code;
            this.headers = headers;
        },
        write: function(data) {
            this._written.push(data);
        }
    };
    return res;
}

// Helper: find and execute a route handler
function findHandler(method, path) {
    // router.stack contains the registered routes
    for (const layer of router.stack) {
        if (layer.route) {
            const routePath = layer.route.path;
            const routeMethod = Object.keys(layer.route.methods)[0];

            if (routeMethod === method && matchPath(routePath, path)) {
                return layer.route.stack[0].handle;
            }
        }
    }
    return null;
}

function matchPath(pattern, path) {
    // Simple path matching with params
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) return false;

    for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) continue;
        if (patternParts[i] !== pathParts[i]) return false;
    }
    return true;
}

function extractParams(pattern, path) {
    const params = {};
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
            params[patternParts[i].slice(1)] = pathParts[i];
        }
    }
    return params;
}

describe('Assignment Routes', () => {
    beforeEach(() => {
        // Clear all data
        assignments.clear();
        relationships.clear();
        notifications.clear();
        sseClients.clear();
    });

    describe('POST / (Create Assignment)', () => {
        test('should create an assignment with valid data', () => {
            const handler = findHandler('post', '/');
            const req = createMockReq({
                body: {
                    teacherId: 'teacher-1',
                    studentId: 'student-1',
                    scoreId: 'score-1',
                    title: 'Practice Scales',
                    measures: { start: 14, end: 32 },
                    target: { bpm: 80, intonationThreshold: 90 }
                }
            });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.statusCode, 201);
            assert.ok(res.body.id);
            assert.strictEqual(res.body.title, 'Practice Scales');
            assert.strictEqual(res.body.teacherId, 'teacher-1');
            assert.strictEqual(res.body.studentId, 'student-1');
            assert.strictEqual(res.body.status, 'pending');
            assert.strictEqual(res.body.measures.start, 14);
            assert.strictEqual(res.body.measures.end, 32);
            assert.strictEqual(res.body.target.bpm, 80);
        });

        test('should reject missing required fields', () => {
            const handler = findHandler('post', '/');
            const req = createMockReq({
                body: { teacherId: 'teacher-1' }
            });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.statusCode, 400);
            assert.ok(res.body.error);
        });

        test('should set default target values', () => {
            const handler = findHandler('post', '/');
            const req = createMockReq({
                body: {
                    teacherId: 'teacher-1',
                    studentId: 'student-1',
                    scoreId: 'score-1'
                }
            });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.body.target.bpm, 80);
            assert.strictEqual(res.body.target.intonationThreshold, 90);
        });

        test('should queue notification for student', () => {
            const handler = findHandler('post', '/');
            const req = createMockReq({
                body: {
                    teacherId: 'teacher-1',
                    studentId: 'student-1',
                    scoreId: 'score-1',
                    title: 'New Task'
                }
            });
            const res = createMockRes();

            handler(req, res);

            const pending = notifications.get('student-1');
            assert.ok(pending);
            assert.strictEqual(pending.length, 1);
            assert.strictEqual(pending[0].type, 'new_assignment');
        });
    });

    describe('GET / (List Assignments)', () => {
        test('should return all assignments', () => {
            // Add some assignments
            assignments.set('a1', {
                id: 'a1', teacherId: 'teacher-1', studentId: 'student-1',
                status: 'pending', createdAt: new Date().toISOString()
            });
            assignments.set('a2', {
                id: 'a2', teacherId: 'teacher-1', studentId: 'student-2',
                status: 'completed', createdAt: new Date().toISOString()
            });

            const handler = findHandler('get', '/');
            const req = createMockReq({ query: {} });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.body.length, 2);
        });

        test('should filter by studentId', () => {
            assignments.set('a1', {
                id: 'a1', teacherId: 'teacher-1', studentId: 'student-1',
                status: 'pending', createdAt: new Date().toISOString()
            });
            assignments.set('a2', {
                id: 'a2', teacherId: 'teacher-1', studentId: 'student-2',
                status: 'pending', createdAt: new Date().toISOString()
            });

            const handler = findHandler('get', '/');
            const req = createMockReq({ query: { studentId: 'student-1' } });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.body.length, 1);
            assert.strictEqual(res.body[0].studentId, 'student-1');
        });

        test('should filter by status', () => {
            assignments.set('a1', {
                id: 'a1', teacherId: 't', studentId: 's',
                status: 'pending', createdAt: new Date().toISOString()
            });
            assignments.set('a2', {
                id: 'a2', teacherId: 't', studentId: 's',
                status: 'completed', createdAt: new Date().toISOString()
            });

            const handler = findHandler('get', '/');
            const req = createMockReq({ query: { status: 'completed' } });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.body.length, 1);
            assert.strictEqual(res.body[0].status, 'completed');
        });
    });

    describe('GET /:id (Get Assignment)', () => {
        test('should return an assignment by ID', () => {
            assignments.set('a1', { id: 'a1', title: 'Test' });

            const handler = findHandler('get', '/:id');
            const req = createMockReq({ params: { id: 'a1' } });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.body.title, 'Test');
        });

        test('should return 404 for non-existent', () => {
            const handler = findHandler('get', '/:id');
            const req = createMockReq({ params: { id: 'nonexistent' } });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.statusCode, 404);
        });
    });

    describe('PUT /:id (Update Assignment)', () => {
        test('should update assignment fields', () => {
            assignments.set('a1', { id: 'a1', title: 'Old', status: 'pending' });

            const handler = findHandler('put', '/:id');
            const req = createMockReq({
                params: { id: 'a1' },
                body: { title: 'New Title' }
            });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.body.title, 'New Title');
            assert.ok(res.body.updatedAt);
        });

        test('should preserve ID on update', () => {
            assignments.set('a1', { id: 'a1', title: 'Test' });

            const handler = findHandler('put', '/:id');
            const req = createMockReq({
                params: { id: 'a1' },
                body: { id: 'hacked', title: 'Updated' }
            });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.body.id, 'a1');
        });
    });

    describe('PUT /:id/progress (Update Progress)', () => {
        test('should update progress data', () => {
            assignments.set('a1', {
                id: 'a1',
                teacherId: 'teacher-1',
                title: 'Test',
                status: 'pending',
                target: { bpm: 120, intonationThreshold: 90 },
                progress: {
                    currentBpm: 0,
                    currentIntonation: 0,
                    practiceCount: 0,
                    totalPracticeMinutes: 0,
                    lastPracticed: null
                }
            });

            const handler = findHandler('put', '/:id/progress');
            const req = createMockReq({
                params: { id: 'a1' },
                body: { bpm: 60, intonation: 70, durationMinutes: 15 }
            });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.body.progress.currentBpm, 60);
            assert.strictEqual(res.body.progress.currentIntonation, 70);
            assert.strictEqual(res.body.progress.practiceCount, 1);
            assert.strictEqual(res.body.status, 'in_progress');
        });

        test('should auto-complete when target met', () => {
            assignments.set('a1', {
                id: 'a1',
                teacherId: 'teacher-1',
                title: 'Test',
                status: 'in_progress',
                target: { bpm: 80, intonationThreshold: 90 },
                progress: {
                    currentBpm: 70,
                    currentIntonation: 85,
                    practiceCount: 3,
                    totalPracticeMinutes: 30,
                    lastPracticed: null
                },
                completedAt: null
            });

            const handler = findHandler('put', '/:id/progress');
            const req = createMockReq({
                params: { id: 'a1' },
                body: { bpm: 85, intonation: 92, durationMinutes: 10 }
            });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.body.status, 'completed');
            assert.ok(res.body.completedAt);
        });

        test('should notify teacher of progress', () => {
            assignments.set('a1', {
                id: 'a1',
                teacherId: 'teacher-1',
                title: 'Test',
                status: 'pending',
                target: { bpm: 120, intonationThreshold: 90 },
                progress: {
                    currentBpm: 0, currentIntonation: 0,
                    practiceCount: 0, totalPracticeMinutes: 0, lastPracticed: null
                }
            });

            const handler = findHandler('put', '/:id/progress');
            const req = createMockReq({
                params: { id: 'a1' },
                body: { bpm: 60, intonation: 70, durationMinutes: 10 }
            });
            const res = createMockRes();

            handler(req, res);

            const teacherNotifs = notifications.get('teacher-1');
            assert.ok(teacherNotifs);
            assert.strictEqual(teacherNotifs[0].type, 'progress_update');
        });
    });

    describe('PUT /:id/complete', () => {
        test('should mark assignment as completed', () => {
            assignments.set('a1', {
                id: 'a1',
                teacherId: 'teacher-1',
                title: 'Test',
                status: 'in_progress'
            });

            const handler = findHandler('put', '/:id/complete');
            const req = createMockReq({ params: { id: 'a1' } });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.body.status, 'completed');
            assert.ok(res.body.completedAt);
        });

        test('should notify teacher', () => {
            assignments.set('a1', {
                id: 'a1',
                teacherId: 'teacher-1',
                title: 'Practice',
                status: 'in_progress'
            });

            const handler = findHandler('put', '/:id/complete');
            const req = createMockReq({ params: { id: 'a1' } });
            const res = createMockRes();

            handler(req, res);

            const teacherNotifs = notifications.get('teacher-1');
            assert.ok(teacherNotifs);
            assert.strictEqual(teacherNotifs[0].type, 'assignment_completed');
        });
    });

    describe('DELETE /:id', () => {
        test('should delete an assignment', () => {
            assignments.set('a1', { id: 'a1' });

            const handler = findHandler('delete', '/:id');
            const req = createMockReq({ params: { id: 'a1' } });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.body.success, true);
            assert.strictEqual(assignments.has('a1'), false);
        });

        test('should return 404 for non-existent', () => {
            const handler = findHandler('delete', '/:id');
            const req = createMockReq({ params: { id: 'nonexistent' } });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.statusCode, 404);
        });
    });

    describe('POST /relationships', () => {
        test('should create a teacher-student relationship', () => {
            const handler = findHandler('post', '/relationships');
            const req = createMockReq({
                body: { teacherId: 'teacher-1', studentId: 'student-1' }
            });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.statusCode, 201);
            assert.ok(res.body.id);
            assert.strictEqual(res.body.teacherId, 'teacher-1');
        });

        test('should not duplicate relationships', () => {
            relationships.set('r1', {
                id: 'r1',
                teacherId: 'teacher-1',
                studentId: 'student-1'
            });

            const handler = findHandler('post', '/relationships');
            const req = createMockReq({
                body: { teacherId: 'teacher-1', studentId: 'student-1' }
            });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.body.id, 'r1'); // Returns existing
        });

        test('should reject missing fields', () => {
            const handler = findHandler('post', '/relationships');
            const req = createMockReq({
                body: { teacherId: 'teacher-1' }
            });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.statusCode, 400);
        });
    });

    describe('Notifications', () => {
        test('should queue notifications when no SSE client', () => {
            // Create an assignment to trigger a notification
            const createHandler = findHandler('post', '/');
            const req = createMockReq({
                body: {
                    teacherId: 'teacher-1',
                    studentId: 'student-1',
                    scoreId: 'score-1'
                }
            });
            const res = createMockRes();

            createHandler(req, res);

            // Check notification was queued
            const pending = notifications.get('student-1');
            assert.ok(pending);
            assert.strictEqual(pending.length, 1);
            assert.strictEqual(pending[0].type, 'new_assignment');
        });

        test('GET /notifications/:userId should return and clear pending', () => {
            // Queue a notification
            notifications.set('student-1', [
                { type: 'new_assignment', title: 'Test' }
            ]);

            const handler = findHandler('get', '/notifications/:userId');
            const req = createMockReq({ params: { userId: 'student-1' } });
            const res = createMockRes();

            handler(req, res);

            assert.strictEqual(res.body.length, 1);
            assert.strictEqual(res.body[0].type, 'new_assignment');

            // Should be cleared
            assert.strictEqual(notifications.has('student-1'), false);
        });
    });
});
