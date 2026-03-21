/**
 * Teacher API Routes Tests
 * Tests for the Express teacher routes
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// We test the route handlers by requiring the module and checking its structure
// Since we can't easily run Express in test, we test the shared logic and validation

// Load the teacher routes module to verify it exports a router
const teacherRouter = require('../src/routes/teacher.js');

describe('Teacher Routes - Module', () => {
    test('should export an Express router', () => {
        assert.ok(teacherRouter);
        assert.strictEqual(typeof teacherRouter, 'function');
    });

    test('should have route handlers registered', () => {
        // Express router has a stack of route layers
        assert.ok(teacherRouter.stack);
        assert.ok(teacherRouter.stack.length > 0);
    });
});

describe('Teacher Routes - Route Registration', () => {
    test('should have GET /students route', () => {
        const routes = teacherRouter.stack
            .filter(layer => layer.route)
            .map(layer => ({
                path: layer.route.path,
                methods: Object.keys(layer.route.methods)
            }));

        const studentsGet = routes.find(r => r.path === '/students' && r.methods.includes('get'));
        assert.ok(studentsGet, 'GET /students route should exist');
    });

    test('should have POST /students route', () => {
        const routes = teacherRouter.stack
            .filter(layer => layer.route)
            .map(layer => ({
                path: layer.route.path,
                methods: Object.keys(layer.route.methods)
            }));

        const studentsPost = routes.find(r => r.path === '/students' && r.methods.includes('post'));
        assert.ok(studentsPost, 'POST /students route should exist');
    });

    test('should have GET /students/:id route', () => {
        const routes = teacherRouter.stack
            .filter(layer => layer.route)
            .map(layer => ({
                path: layer.route.path,
                methods: Object.keys(layer.route.methods)
            }));

        const studentGet = routes.find(r => r.path === '/students/:id' && r.methods.includes('get'));
        assert.ok(studentGet, 'GET /students/:id route should exist');
    });

    test('should have DELETE /students/:id route', () => {
        const routes = teacherRouter.stack
            .filter(layer => layer.route)
            .map(layer => ({
                path: layer.route.path,
                methods: Object.keys(layer.route.methods)
            }));

        const studentDelete = routes.find(r => r.path === '/students/:id' && r.methods.includes('delete'));
        assert.ok(studentDelete, 'DELETE /students/:id route should exist');
    });

    test('should have POST /students/:id/sessions route', () => {
        const routes = teacherRouter.stack
            .filter(layer => layer.route)
            .map(layer => ({
                path: layer.route.path,
                methods: Object.keys(layer.route.methods)
            }));

        const sessionsPost = routes.find(r => r.path === '/students/:id/sessions' && r.methods.includes('post'));
        assert.ok(sessionsPost, 'POST /students/:id/sessions route should exist');
    });

    test('should have GET /metrics route', () => {
        const routes = teacherRouter.stack
            .filter(layer => layer.route)
            .map(layer => ({
                path: layer.route.path,
                methods: Object.keys(layer.route.methods)
            }));

        const metricsGet = routes.find(r => r.path === '/metrics' && r.methods.includes('get'));
        assert.ok(metricsGet, 'GET /metrics route should exist');
    });

    test('should have teacher mode middleware', () => {
        // The router should have middleware (non-route layers)
        const middleware = teacherRouter.stack.filter(layer => !layer.route);
        assert.ok(middleware.length > 0, 'Should have at least one middleware (requireTeacherMode)');
    });
});

describe('Teacher Routes - Auth Middleware Behavior', () => {
    test('should reject requests without X-Teacher-Mode header', () => {
        // Find the requireTeacherMode middleware
        const middlewareLayer = teacherRouter.stack.find(layer => !layer.route);
        assert.ok(middlewareLayer, 'Middleware layer should exist');

        let statusCode = null;
        let responseBody = null;
        const mockReq = { headers: {} };
        const mockRes = {
            status: (code) => {
                statusCode = code;
                return mockRes;
            },
            json: (body) => {
                responseBody = body;
                return mockRes;
            }
        };
        const mockNext = () => {};

        middlewareLayer.handle(mockReq, mockRes, mockNext);

        assert.strictEqual(statusCode, 403);
        assert.ok(responseBody.error.includes('Teacher mode'));
    });

    test('should allow requests with X-Teacher-Mode header', () => {
        const middlewareLayer = teacherRouter.stack.find(layer => !layer.route);
        assert.ok(middlewareLayer);

        let nextCalled = false;
        const mockReq = { headers: { 'x-teacher-mode': 'true' } };
        const mockRes = {
            status: () => mockRes,
            json: () => mockRes
        };
        const mockNext = () => { nextCalled = true; };

        middlewareLayer.handle(mockReq, mockRes, mockNext);

        assert.strictEqual(nextCalled, true);
    });
});

describe('TeacherService - Score of Zero Handling', () => {
    const TeacherService = require('../src/js/services/teacher-service.js');
    let service;

    beforeEach(() => {
        service = new TeacherService();
    });

    test('should correctly handle intonation score of 0 in getIntonationEmoji', () => {
        const result = service.getIntonationEmoji(0);
        // 0 is a valid score, should not be treated as null
        assert.strictEqual(result.label, 'Struggling');
        assert.notStrictEqual(result.icon, '—');
    });

    test('should correctly format zero practice time', () => {
        assert.strictEqual(service.formatPracticeTime(0), '0m');
    });

    test('should not use || for nullish checks in getDashboardMetrics', () => {
        // A student with score 0 should still be counted in averageIntonation
        const students = [
            { weeklyPracticeTimeMs: 0, averageIntonationScore: 0, lastSessionAt: Date.now() }
        ];
        const metrics = service.getDashboardMetrics(students);
        assert.strictEqual(metrics.averageIntonation, 0);
        assert.notStrictEqual(metrics.averageIntonation, null);
    });
});

describe('StudioDashboard - Instrument Escaping', () => {
    const StudioDashboard = require('../src/js/components/studio-dashboard.js');
    const TeacherService = require('../src/js/services/teacher-service.js');

    test('should escape instrument field in student row', () => {
        const service = new TeacherService();
        const dashboard = new StudioDashboard(service);

        dashboard.filteredStudents = [{
            id: 'test-1',
            name: 'Alice',
            instrument: '<script>alert(1)</script>',
            assignedPiece: '',
            weeklyPracticeTimeMs: 0,
            averageIntonationScore: null,
            lastSessionAt: null
        }];

        const html = dashboard._renderStudentRoster();
        assert.ok(!html.includes('<script>alert(1)</script>'));
        assert.ok(html.includes('&lt;script&gt;'));
    });
});

describe('StudioDashboard - Debounce Timer', () => {
    const StudioDashboard = require('../src/js/components/studio-dashboard.js');
    const TeacherService = require('../src/js/services/teacher-service.js');

    test('should initialize with null debounce timer', () => {
        const service = new TeacherService();
        const dashboard = new StudioDashboard(service);
        assert.strictEqual(dashboard._searchDebounceTimer, null);
    });
});
