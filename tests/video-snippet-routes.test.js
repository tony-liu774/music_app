/**
 * Video Snippet API Routes Tests
 * Tests for the Express video snippet routes in teacher.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

// Load the teacher routes module to verify it exports a router
const teacherRouter = require('../src/routes/teacher.js');

describe('Video Snippet Routes - Module', () => {
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

describe('Video Snippet Routes - Route Registration', () => {
    // Get all registered routes
    const routes = teacherRouter.stack
        .filter(layer => layer.route)
        .map(layer => ({
            path: layer.route.path,
            methods: Object.keys(layer.route.methods)
        }));

    test('should have POST /snippets route for submitting videos', () => {
        const snippetsPost = routes.find(r => r.path === '/snippets' && r.methods.includes('post'));
        assert.ok(snippetsPost, 'POST /snippets route should exist');
    });

    test('should have GET /snippets route for listing all snippets', () => {
        const snippetsGet = routes.find(r => r.path === '/snippets' && r.methods.includes('get'));
        assert.ok(snippetsGet, 'GET /snippets route should exist');
    });

    test('should have GET /snippets/:studentId route for student inbox', () => {
        const studentSnippets = routes.find(r => r.path === '/snippets/:studentId' && r.methods.includes('get'));
        assert.ok(studentSnippets, 'GET /snippets/:studentId route should exist');
    });

    test('should have POST /snippets/:id/reply route for teacher replies', () => {
        const replyRoute = routes.find(r => r.path === '/snippets/:id/reply' && r.methods.includes('post'));
        assert.ok(replyRoute, 'POST /snippets/:id/reply route should exist');
    });

    test('should have DELETE /snippets/:id route for deleting snippets', () => {
        const deleteRoute = routes.find(r => r.path === '/snippets/:id' && r.methods.includes('delete'));
        assert.ok(deleteRoute, 'DELETE /snippets/:id route should exist');
    });

    test('should have POST /snippets/cleanup route for auto-delete', () => {
        const cleanupRoute = routes.find(r => r.path === '/snippets/cleanup' && r.methods.includes('post'));
        assert.ok(cleanupRoute, 'POST /snippets/cleanup route should exist');
    });

    test('should have GET /snippet/:id route for getting single snippet', () => {
        const snippetGet = routes.find(r => r.path === '/snippet/:id' && r.methods.includes('get'));
        assert.ok(snippetGet, 'GET /snippet/:id route should exist');
    });
});

describe('Video Snippet Feature - Route Count', () => {
    test('should have at least 7 video snippet routes', () => {
        const snippetRoutes = teacherRouter.stack
            .filter(layer => layer.route)
            .filter(layer => {
                const path = layer.route.path;
                return path.includes('snippet') || path.includes('Snippet');
            });

        // At minimum, we should have:
        // POST /snippets
        // GET /snippets
        // GET /snippets/:studentId
        // POST /snippets/:id/reply
        // DELETE /snippets/:id
        // POST /snippets/cleanup
        // GET /snippet/:id
        assert.ok(snippetRoutes.length >= 7, `Expected at least 7 snippet routes, found ${snippetRoutes.length}`);
    });
});
