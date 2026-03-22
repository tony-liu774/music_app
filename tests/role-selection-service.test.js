const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

// Mock fetch
let lastFetchUrl = null;
let lastFetchOptions = null;
let fetchResult = { ok: true, json: async () => ({}) };

global.localStorage = localStorageMock;
global.window = { location: { origin: 'https://app.concertmaster.com' } };
global.fetch = async (url, options) => {
    lastFetchUrl = url;
    lastFetchOptions = options;
    return fetchResult;
};

const RoleSelectionService = require('../src/js/services/role-selection-service');

describe('RoleSelectionService', () => {
    let service;
    let mockAuthService;

    beforeEach(() => {
        localStorageMock.clear();
        lastFetchUrl = null;
        lastFetchOptions = null;
        fetchResult = { ok: true, json: async () => ({}) };

        mockAuthService = {
            _authenticated: false,
            isAuthenticated() { return this._authenticated; },
            async getAuthHeaders() {
                return this._authenticated ? { Authorization: 'Bearer test-token' } : {};
            }
        };

        service = new RoleSelectionService(mockAuthService);
    });

    test('constructor sets default values', () => {
        assert.strictEqual(service.roleKey, 'music_app_user_role');
        assert.strictEqual(service.inviteLinkKey, 'music_app_studio_invite');
        assert.strictEqual(service.roleSelectedKey, 'music_app_role_selected');
    });

    test('constructor works without authService', () => {
        const svc = new RoleSelectionService(null);
        assert.strictEqual(svc.authService, null);
    });

    test('hasSelectedRole returns false initially', () => {
        assert.strictEqual(service.hasSelectedRole(), false);
    });

    test('hasSelectedRole returns true after role is set', async () => {
        await service.setRole('student');
        assert.strictEqual(service.hasSelectedRole(), true);
    });

    test('getRole returns null initially', () => {
        assert.strictEqual(service.getRole(), null);
    });

    test('setRole stores student role', async () => {
        await service.setRole('student');
        assert.strictEqual(service.getRole(), 'student');
    });

    test('setRole stores teacher role', async () => {
        await service.setRole('teacher');
        assert.strictEqual(service.getRole(), 'teacher');
    });

    test('setRole throws for invalid role', async () => {
        await assert.rejects(
            () => service.setRole('invalid'),
            { message: 'Role must be "student" or "teacher"' }
        );
    });

    test('setRole throws for empty string', async () => {
        await assert.rejects(
            () => service.setRole(''),
            { message: 'Role must be "student" or "teacher"' }
        );
    });

    test('isStudent returns true for student role', async () => {
        await service.setRole('student');
        assert.strictEqual(service.isStudent(), true);
        assert.strictEqual(service.isTeacher(), false);
    });

    test('isTeacher returns true for teacher role', async () => {
        await service.setRole('teacher');
        assert.strictEqual(service.isTeacher(), true);
        assert.strictEqual(service.isStudent(), false);
    });

    test('isStudent and isTeacher return false when no role set', () => {
        assert.strictEqual(service.isStudent(), false);
        assert.strictEqual(service.isTeacher(), false);
    });

    test('setRole generates invite link for teachers', async () => {
        await service.setRole('teacher');
        const link = service.getInviteLink();
        assert.ok(link);
        assert.ok(link.startsWith('https://app.concertmaster.com/invite/'));
        assert.strictEqual(link.split('/invite/')[1].length, 8);
    });

    test('setRole does not generate invite link for students', async () => {
        await service.setRole('student');
        assert.strictEqual(service.getInviteLink(), null);
    });

    test('setRole syncs to backend when authenticated', async () => {
        mockAuthService._authenticated = true;
        await service.setRole('student');

        assert.strictEqual(lastFetchUrl, '/api/auth/role');
        const body = JSON.parse(lastFetchOptions.body);
        assert.strictEqual(body.role, 'student');
        assert.strictEqual(lastFetchOptions.headers.Authorization, 'Bearer test-token');
    });

    test('setRole does not sync when not authenticated', async () => {
        mockAuthService._authenticated = false;
        await service.setRole('student');
        assert.strictEqual(lastFetchUrl, null);
    });

    test('setRole does not sync when authService is null', async () => {
        const svc = new RoleSelectionService(null);
        await svc.setRole('student');
        assert.strictEqual(lastFetchUrl, null);
    });

    test('setRole handles fetch failure gracefully and logs warning', async () => {
        mockAuthService._authenticated = true;
        global.fetch = async () => { throw new Error('Network error'); };

        const warnings = [];
        const origWarn = console.warn;
        console.warn = (...args) => warnings.push(args);

        // Should not throw
        await service.setRole('student');
        assert.strictEqual(service.getRole(), 'student');
        assert.ok(warnings.length > 0, 'should have logged a warning');
        assert.ok(warnings[0].some(a => typeof a === 'string' && a.includes('network error')),
            'warning should mention network error');

        console.warn = origWarn;

        // Restore fetch
        global.fetch = async (url, options) => {
            lastFetchUrl = url;
            lastFetchOptions = options;
            return fetchResult;
        };
    });

    test('setRole logs warning on non-ok HTTP response', async () => {
        mockAuthService._authenticated = true;
        fetchResult = { ok: false, status: 409, json: async () => ({ error: 'Role already set' }) };

        const warnings = [];
        const origWarn = console.warn;
        console.warn = (...args) => warnings.push(args);

        await service.setRole('student');
        assert.strictEqual(service.getRole(), 'student');
        assert.ok(warnings.length > 0, 'should have logged a warning');
        assert.ok(warnings[0][0].includes('409'), 'warning should mention status code');

        console.warn = origWarn;
    });

    test('clearRole removes all role data', async () => {
        await service.setRole('teacher');
        assert.strictEqual(service.getRole(), 'teacher');
        assert.strictEqual(service.hasSelectedRole(), true);
        assert.ok(service.getInviteLink());

        service.clearRole();
        assert.strictEqual(service.getRole(), null);
        assert.strictEqual(service.hasSelectedRole(), false);
        assert.strictEqual(service.getInviteLink(), null);
    });

    test('_generateInviteCode produces 8-character alphanumeric code', () => {
        const code = service._generateInviteCode();
        assert.strictEqual(code.length, 8);
        assert.ok(/^[A-Za-z0-9]+$/.test(code));
    });

    test('_generateInviteCode produces unique codes', () => {
        const codes = new Set();
        for (let i = 0; i < 50; i++) {
            codes.add(service._generateInviteCode());
        }
        // At least most should be unique
        assert.ok(codes.size > 40);
    });

    test('setRole with custom apiBaseUrl includes it in fetch URL', async () => {
        const svc = new RoleSelectionService(mockAuthService, 'https://api.example.com');
        mockAuthService._authenticated = true;
        await svc.setRole('teacher');

        assert.strictEqual(lastFetchUrl, 'https://api.example.com/api/auth/role');
    });

    test('getInviteLink returns null when no link stored', () => {
        assert.strictEqual(service.getInviteLink(), null);
    });
});
