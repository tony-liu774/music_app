/**
 * Up Next Widget Tests
 * Tests for the student's pinned assignment widget
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock DOM
function escapeHtmlHelper(str) {
    return str.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

class MockElement {
    constructor(tag) {
        this.tagName = tag;
        this._innerHTML = '';
        this._textContent = '';
        this.className = '';
        this.style = {};
        this.dataset = {};
        this.children = [];
        this._listeners = {};
    }

    get innerHTML() { return this._innerHTML; }
    set innerHTML(val) { this._innerHTML = val; }

    get textContent() { return this._textContent; }
    set textContent(val) {
        this._textContent = val;
        // Simulate browser behavior: setting textContent escapes HTML
        this._innerHTML = escapeHtmlHelper(val);
    }

    querySelector(selector) {
        if (selector.startsWith('#')) {
            const id = selector.slice(1);
            if (this._innerHTML.includes(`id="${id}"`)) {
                const el = new MockElement('div');
                el.id = id;
                return el;
            }
        }
        if (selector.startsWith('.')) {
            const cls = selector.slice(1);
            if (this._innerHTML.includes(`class="${cls}"`) || this._innerHTML.includes(cls)) {
                return new MockElement('div');
            }
        }
        return null;
    }

    querySelectorAll(selector) {
        return [];
    }

    addEventListener(event, fn) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(fn);
    }
}

global.document = {
    createElement: (tag) => new MockElement(tag)
};

global.window = {};

// Require component
require('../src/js/components/up-next-widget.js');
const UpNextWidget = window.UpNextWidget;

// Mock assignment service
function createMockAssignmentService(options = {}) {
    return {
        assignments: options.assignments || [],
        upNext: options.upNext || null,
        getCurrentUserId: () => options.userId || 'student-1',
        getActiveAssignments: async function(studentId) {
            return this.assignments.filter(a =>
                a.studentId === studentId &&
                (a.status === 'pending' || a.status === 'in_progress')
            );
        },
        getUpNextAssignment: async function(studentId) {
            return this.upNext;
        },
        calculateProgress: (assignment) => {
            if (!assignment || !assignment.target) return 0;
            const bpm = Math.min((assignment.progress.currentBpm / assignment.target.bpm) * 100, 100);
            const intonation = Math.min((assignment.progress.currentIntonation / assignment.target.intonationThreshold) * 100, 100);
            return Math.round((bpm + intonation) / 2);
        },
        isOverdue: (assignment) => {
            if (!assignment.dueDate || assignment.status === 'completed') return false;
            return new Date(assignment.dueDate) < new Date();
        }
    };
}

const sampleAssignment = {
    id: 'a1',
    studentId: 'student-1',
    teacherId: 'teacher-1',
    scoreId: 'score-1',
    title: 'Practice Etude No. 3',
    measures: { start: 14, end: 32 },
    target: { bpm: 80, intonationThreshold: 90 },
    dueDate: '2099-12-31T00:00:00.000Z',
    notes: 'Focus on bow control in measure 20',
    status: 'pending',
    progress: {
        currentBpm: 0,
        currentIntonation: 0,
        practiceCount: 0,
        totalPracticeMinutes: 0,
        lastPracticed: null
    },
    createdAt: new Date().toISOString()
};

describe('UpNextWidget', () => {
    let container;

    beforeEach(() => {
        container = new MockElement('div');
    });

    describe('constructor', () => {
        test('should initialize with container and options', () => {
            const widget = new UpNextWidget(container, {
                onPractice: () => {},
                onViewAll: () => {}
            });

            assert.strictEqual(widget.container, container);
            assert.ok(widget.onPractice);
            assert.ok(widget.onViewAll);
        });

        test('should start with empty state', () => {
            const widget = new UpNextWidget(container);
            assert.deepStrictEqual(widget.assignments, []);
            assert.strictEqual(widget.upNext, null);
        });
    });

    describe('render - empty state', () => {
        test('should show empty state when no assignments', async () => {
            const mockService = createMockAssignmentService({
                assignments: [],
                upNext: null
            });

            const widget = new UpNextWidget(container, {
                assignmentService: mockService
            });

            await widget.init();

            assert.ok(container.innerHTML.includes('No assignments yet'));
            assert.ok(container.innerHTML.includes('up-next-empty'));
        });
    });

    describe('render - with assignment', () => {
        test('should render assignment card', async () => {
            const mockService = createMockAssignmentService({
                assignments: [sampleAssignment],
                upNext: sampleAssignment,
                userId: 'student-1'
            });

            const widget = new UpNextWidget(container, {
                assignmentService: mockService
            });

            await widget.init();

            assert.ok(container.innerHTML.includes('Up Next'));
            assert.ok(container.innerHTML.includes('Practice Etude No. 3'));
            assert.ok(container.innerHTML.includes('14 - 32'));
            assert.ok(container.innerHTML.includes('80 BPM'));
            assert.ok(container.innerHTML.includes('90%'));
        });

        test('should show teacher notes', async () => {
            const mockService = createMockAssignmentService({
                assignments: [sampleAssignment],
                upNext: sampleAssignment,
                userId: 'student-1'
            });

            const widget = new UpNextWidget(container, {
                assignmentService: mockService
            });

            await widget.init();

            assert.ok(container.innerHTML.includes('Focus on bow control'));
        });

        test('should show practice count when > 0', async () => {
            const practiced = {
                ...sampleAssignment,
                status: 'in_progress',
                progress: { ...sampleAssignment.progress, practiceCount: 3 }
            };

            const mockService = createMockAssignmentService({
                assignments: [practiced],
                upNext: practiced,
                userId: 'student-1'
            });

            const widget = new UpNextWidget(container, {
                assignmentService: mockService
            });

            await widget.init();

            assert.ok(container.innerHTML.includes('Sessions'));
            assert.ok(container.innerHTML.includes('3'));
        });

        test('should show progress bar', async () => {
            const inProgress = {
                ...sampleAssignment,
                status: 'in_progress',
                progress: {
                    currentBpm: 40,
                    currentIntonation: 45,
                    practiceCount: 2,
                    totalPracticeMinutes: 20,
                    lastPracticed: new Date().toISOString()
                }
            };

            const mockService = createMockAssignmentService({
                assignments: [inProgress],
                upNext: inProgress,
                userId: 'student-1'
            });

            const widget = new UpNextWidget(container, {
                assignmentService: mockService
            });

            await widget.init();

            assert.ok(container.innerHTML.includes('progress-bar'));
            assert.ok(container.innerHTML.includes('%'));
        });

        test('should show overdue status', async () => {
            const overdue = {
                ...sampleAssignment,
                dueDate: '2020-01-01T00:00:00.000Z'
            };

            const mockService = createMockAssignmentService({
                assignments: [overdue],
                upNext: overdue,
                userId: 'student-1'
            });

            const widget = new UpNextWidget(container, {
                assignmentService: mockService
            });

            await widget.init();

            assert.ok(container.innerHTML.includes('overdue'));
        });
    });

    describe('render - multiple assignments', () => {
        test('should show assignment count', async () => {
            const a2 = { ...sampleAssignment, id: 'a2', title: 'Second Assignment' };

            const mockService = createMockAssignmentService({
                assignments: [sampleAssignment, a2],
                upNext: sampleAssignment,
                userId: 'student-1'
            });

            const widget = new UpNextWidget(container, {
                assignmentService: mockService
            });

            await widget.init();

            assert.ok(container.innerHTML.includes('2 assignments'));
        });

        test('should show queue preview for subsequent assignments', async () => {
            const a2 = { ...sampleAssignment, id: 'a2', title: 'Second Assignment' };
            const a3 = { ...sampleAssignment, id: 'a3', title: 'Third Assignment' };

            const mockService = createMockAssignmentService({
                assignments: [sampleAssignment, a2, a3],
                upNext: sampleAssignment,
                userId: 'student-1'
            });

            const widget = new UpNextWidget(container, {
                assignmentService: mockService
            });

            await widget.init();

            assert.ok(container.innerHTML.includes('Coming up'));
            assert.ok(container.innerHTML.includes('Second Assignment'));
        });

        test('should show View All button', async () => {
            const a2 = { ...sampleAssignment, id: 'a2' };

            const mockService = createMockAssignmentService({
                assignments: [sampleAssignment, a2],
                upNext: sampleAssignment,
                userId: 'student-1'
            });

            const widget = new UpNextWidget(container, {
                assignmentService: mockService
            });

            await widget.init();

            assert.ok(container.innerHTML.includes('View All'));
        });
    });

    describe('formatDueDate', () => {
        test('should return null for no date', () => {
            const widget = new UpNextWidget(container);
            assert.strictEqual(widget.formatDueDate(null), null);
        });

        test('should show overdue for past dates', () => {
            const widget = new UpNextWidget(container);
            const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
            const result = widget.formatDueDate(pastDate);
            assert.ok(result.includes('overdue'));
        });

        test('should show "Due today" for today', () => {
            const widget = new UpNextWidget(container);
            // Create a date that's today but slightly in the future
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            const result = widget.formatDueDate(today.toISOString());
            assert.ok(result === 'Due today' || result === 'Due tomorrow' || result.includes('Due in'));
        });

        test('should show days for near future', () => {
            const widget = new UpNextWidget(container);
            const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
            const result = widget.formatDueDate(future);
            assert.ok(result.includes('Due in'));
        });
    });

    describe('escapeHtml', () => {
        test('should escape HTML entities', () => {
            const widget = new UpNextWidget(container);
            const result = widget.escapeHtml('<script>alert("xss")</script>');
            assert.ok(!result.includes('<script>'));
            assert.ok(result.includes('&lt;'));
        });

        test('should handle empty string', () => {
            const widget = new UpNextWidget(container);
            assert.strictEqual(widget.escapeHtml(''), '');
        });

        test('should handle null', () => {
            const widget = new UpNextWidget(container);
            assert.strictEqual(widget.escapeHtml(null), '');
        });
    });

    describe('refresh', () => {
        test('should update assignments from service', async () => {
            const mockService = createMockAssignmentService({
                assignments: [sampleAssignment],
                upNext: sampleAssignment,
                userId: 'student-1'
            });

            const widget = new UpNextWidget(container, {
                assignmentService: mockService
            });

            await widget.init();
            assert.strictEqual(widget.assignments.length, 1);

            // Add another assignment
            const a2 = { ...sampleAssignment, id: 'a2', studentId: 'student-1' };
            mockService.assignments.push(a2);
            mockService.upNext = sampleAssignment;

            await widget.refresh();
            assert.strictEqual(widget.assignments.length, 2);
        });
    });

    describe('status badges', () => {
        test('should show "New" for pending', async () => {
            const mockService = createMockAssignmentService({
                assignments: [sampleAssignment],
                upNext: sampleAssignment,
                userId: 'student-1'
            });

            const widget = new UpNextWidget(container, {
                assignmentService: mockService
            });

            await widget.init();

            assert.ok(container.innerHTML.includes('New'));
            assert.ok(container.innerHTML.includes('status-pending'));
        });

        test('should show "In Progress" for in_progress', async () => {
            const inProgress = { ...sampleAssignment, status: 'in_progress' };

            const mockService = createMockAssignmentService({
                assignments: [inProgress],
                upNext: inProgress,
                userId: 'student-1'
            });

            const widget = new UpNextWidget(container, {
                assignmentService: mockService
            });

            await widget.init();

            assert.ok(container.innerHTML.includes('In Progress'));
            assert.ok(container.innerHTML.includes('status-in_progress'));
        });
    });
});
