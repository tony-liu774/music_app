/**
 * Notification Service Tests
 * Tests for the push notification system
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock browser APIs
let notificationPermission = 'default';
let lastNotification = null;
let notificationRequestResult = 'granted';

global.Notification = class MockNotification {
    static get permission() { return notificationPermission; }
    static async requestPermission() {
        notificationPermission = notificationRequestResult;
        return notificationPermission;
    }

    constructor(title, options) {
        lastNotification = { title, ...options };
        this.onclick = null;
        this.close = () => {};
    }
};

global.EventSource = class MockEventSource {
    constructor(url) {
        this.url = url;
        this.onmessage = null;
        this.onerror = null;
        this.readyState = 1; // OPEN
    }
    close() {
        this.readyState = 2; // CLOSED
    }
};

global.fetch = async (url) => ({
    ok: true,
    json: async () => []
});

global.window = {
    focus: () => {}
};

// Require the service
require('../src/js/services/notification-service.js');
const NotificationService = window.NotificationService;

describe('NotificationService', () => {
    let service;

    beforeEach(() => {
        notificationPermission = 'default';
        lastNotification = null;
        notificationRequestResult = 'granted';
        service = new NotificationService();
    });

    describe('init', () => {
        test('should initialize with userId', async () => {
            await service.init('user-1');
            assert.strictEqual(service.userId, 'user-1');
        });

        test('should request notification permission', async () => {
            notificationPermission = 'default';
            await service.init('user-1');
            assert.strictEqual(service.permission, 'granted');
        });

        test('should connect to SSE stream', async () => {
            await service.init('user-1');
            assert.ok(service.eventSource);
            assert.ok(service.eventSource.url.includes('user-1'));
        });
    });

    describe('connect', () => {
        test('should create EventSource with correct URL', () => {
            service.userId = 'user-1';
            service.baseUrl = '';
            service.connect();

            assert.ok(service.eventSource);
            assert.ok(service.eventSource.url.includes('/api/assignments/notifications/stream'));
        });

        test('should not connect without userId', () => {
            service.userId = null;
            service.connect();
            assert.strictEqual(service.eventSource, null);
        });
    });

    describe('disconnect', () => {
        test('should close EventSource', () => {
            service.userId = 'user-1';
            service.connect();
            assert.ok(service.eventSource);

            service.disconnect();
            assert.strictEqual(service.eventSource, null);
        });
    });

    describe('handleNotification', () => {
        test('should show browser notification when permitted', () => {
            service.permission = 'granted';
            service.handleNotification({
                title: 'New Assignment',
                message: 'Practice scales',
                assignmentId: 'a1'
            });

            assert.ok(lastNotification);
            assert.strictEqual(lastNotification.title, 'New Assignment');
            assert.strictEqual(lastNotification.body, 'Practice scales');
        });

        test('should not show browser notification when denied', () => {
            lastNotification = null;
            service.permission = 'denied';
            service.handleNotification({
                title: 'Test',
                message: 'Should not show'
            });

            assert.strictEqual(lastNotification, null);
        });

        test('should notify all listeners', () => {
            const received = [];
            service.onNotification((data) => received.push(data));
            service.onNotification((data) => received.push(data));

            service.handleNotification({ type: 'test', title: 'Hello' });

            assert.strictEqual(received.length, 2);
            assert.strictEqual(received[0].type, 'test');
        });
    });

    describe('onNotification', () => {
        test('should add a listener', () => {
            const listener = () => {};
            service.onNotification(listener);
            assert.strictEqual(service.listeners.length, 1);
        });

        test('should return unsubscribe function', () => {
            const listener = () => {};
            const unsubscribe = service.onNotification(listener);

            assert.strictEqual(service.listeners.length, 1);
            unsubscribe();
            assert.strictEqual(service.listeners.length, 0);
        });
    });

    describe('isSupported', () => {
        test('should return true when Notification API exists', () => {
            assert.strictEqual(service.isSupported(), true);
        });
    });

    describe('getPermission', () => {
        test('should return current permission', () => {
            service.permission = 'granted';
            assert.strictEqual(service.getPermission(), 'granted');
        });
    });

    describe('requestPermission', () => {
        test('should request and return permission', async () => {
            notificationRequestResult = 'granted';
            const result = await service.requestPermission();
            assert.strictEqual(result, 'granted');
            assert.strictEqual(service.permission, 'granted');
        });
    });

    describe('destroy', () => {
        test('should clean up resources', async () => {
            await service.init('user-1');
            service.onNotification(() => {});

            service.destroy();

            assert.strictEqual(service.eventSource, null);
            assert.strictEqual(service.listeners.length, 0);
            assert.strictEqual(service.userId, null);
        });
    });

    describe('SSE message handling', () => {
        test('should parse and forward SSE messages', async () => {
            const received = [];
            service.onNotification((data) => received.push(data));

            service.userId = 'user-1';
            service.permission = 'denied'; // Prevent browser notification
            service.connect();

            // Simulate SSE message
            service.eventSource.onmessage({
                data: JSON.stringify({
                    type: 'new_assignment',
                    title: 'Practice',
                    assignmentId: 'a1'
                })
            });

            assert.strictEqual(received.length, 1);
            assert.strictEqual(received[0].type, 'new_assignment');
        });

        test('should ignore connection events', async () => {
            const received = [];
            service.onNotification((data) => received.push(data));

            service.userId = 'user-1';
            service.connect();

            // Simulate connection event
            service.eventSource.onmessage({
                data: JSON.stringify({ type: 'connected', userId: 'user-1' })
            });

            assert.strictEqual(received.length, 0);
        });
    });
});
