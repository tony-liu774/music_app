/**
 * Teacher Service Tests
 * Tests for the Studio Dashboard teacher portal functionality
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock IndexedDB
global.indexedDB = {
    open: (name, version) => {
        const request = {
            result: null,
            error: null,
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null,
            readyState: 'pending'
        };

        setTimeout(() => {
            request.result = {
                objectStoreNames: { contains: () => true },
                createObjectStore: () => ({
                    createIndex: () => {},
                    add: () => ({ onsuccess: null, onerror: null }),
                    put: () => ({ onsuccess: null, onerror: null }),
                    get: () => ({ onsuccess: null, onerror: null }),
                    getAll: () => ({ onsuccess: null, onerror: null }),
                    delete: () => ({ onsuccess: null, onerror: null })
                }),
                transaction: () => ({
                    objectStore: () => ({
                        add: () => ({ onsuccess: null, onerror: null }),
                        put: () => ({ onsuccess: null, onerror: null }),
                        get: () => ({ onsuccess: null, onerror: null }),
                        getAll: () => ({ onsuccess: null, onerror: null }),
                        delete: () => ({ onsuccess: null, onerror: null }),
                        index: () => ({
                            getAll: () => ({ onsuccess: null, onerror: null })
                        })
                    }),
                    oncomplete: null,
                    onerror: null
                })
            };
            if (request.onsuccess) {
                request.onsuccess({ target: request });
            }
        }, 0);

        return request;
    }
};

global.crypto = {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
};

// Load the module
const TeacherService = require('../src/js/services/teacher-service.js');

describe('TeacherService', () => {
    let service;

    beforeEach(() => {
        service = new TeacherService();
    });

    test('should initialize with correct database name', () => {
        assert.strictEqual(service.dbName, 'ConcertmasterStudio');
        assert.strictEqual(service.dbVersion, 1);
        assert.strictEqual(service.db, null);
    });

    test('should have all required methods', () => {
        assert.strictEqual(typeof service.init, 'function');
        assert.strictEqual(typeof service.addStudent, 'function');
        assert.strictEqual(typeof service.getAllStudents, 'function');
        assert.strictEqual(typeof service.getStudent, 'function');
        assert.strictEqual(typeof service.updateStudent, 'function');
        assert.strictEqual(typeof service.removeStudent, 'function');
        assert.strictEqual(typeof service.logPracticeSession, 'function');
        assert.strictEqual(typeof service.getStudentLogs, 'function');
        assert.strictEqual(typeof service.searchStudents, 'function');
        assert.strictEqual(typeof service.sortStudents, 'function');
        assert.strictEqual(typeof service.getDashboardMetrics, 'function');
        assert.strictEqual(typeof service.getIntonationEmoji, 'function');
        assert.strictEqual(typeof service.formatPracticeTime, 'function');
    });

    test('should have onUpdate callback support', () => {
        assert.strictEqual(service.onUpdate, null);
        let called = false;
        service.onUpdate = () => { called = true; };
        service._notifyUpdate();
        assert.strictEqual(called, true);
    });
});

describe('TeacherService - Search', () => {
    let service;

    beforeEach(() => {
        service = new TeacherService();
    });

    test('should return all students when no query provided', () => {
        const students = [
            { name: 'Alice', instrument: 'violin', assignedPiece: '' },
            { name: 'Bob', instrument: 'cello', assignedPiece: '' }
        ];
        const result = service.searchStudents(students, '');
        assert.strictEqual(result.length, 2);
    });

    test('should return all students when query is null', () => {
        const students = [
            { name: 'Alice', instrument: 'violin', assignedPiece: '' }
        ];
        const result = service.searchStudents(students, null);
        assert.strictEqual(result.length, 1);
    });

    test('should filter students by name', () => {
        const students = [
            { name: 'Alice Chen', instrument: 'violin', assignedPiece: '' },
            { name: 'Bob Smith', instrument: 'cello', assignedPiece: '' },
            { name: 'Alice Wang', instrument: 'viola', assignedPiece: '' }
        ];
        const result = service.searchStudents(students, 'alice');
        assert.strictEqual(result.length, 2);
    });

    test('should filter students by instrument', () => {
        const students = [
            { name: 'Alice', instrument: 'violin', assignedPiece: '' },
            { name: 'Bob', instrument: 'cello', assignedPiece: '' },
            { name: 'Carol', instrument: 'violin', assignedPiece: '' }
        ];
        const result = service.searchStudents(students, 'violin');
        assert.strictEqual(result.length, 2);
    });

    test('should filter students by assigned piece', () => {
        const students = [
            { name: 'Alice', instrument: 'violin', assignedPiece: 'Bach Partita' },
            { name: 'Bob', instrument: 'cello', assignedPiece: 'Dvorak Concerto' },
            { name: 'Carol', instrument: 'viola', assignedPiece: 'Bach Suite' }
        ];
        const result = service.searchStudents(students, 'bach');
        assert.strictEqual(result.length, 2);
    });

    test('should be case-insensitive', () => {
        const students = [
            { name: 'Alice', instrument: 'Violin', assignedPiece: '' }
        ];
        const result = service.searchStudents(students, 'ALICE');
        assert.strictEqual(result.length, 1);
    });

    test('should handle students with null assignedPiece', () => {
        const students = [
            { name: 'Alice', instrument: 'violin', assignedPiece: null }
        ];
        const result = service.searchStudents(students, 'alice');
        assert.strictEqual(result.length, 1);
    });
});

describe('TeacherService - Sort', () => {
    let service;

    beforeEach(() => {
        service = new TeacherService();
    });

    test('should sort by name ascending', () => {
        const students = [
            { name: 'Charlie', instrument: 'cello' },
            { name: 'Alice', instrument: 'violin' },
            { name: 'Bob', instrument: 'viola' }
        ];
        const result = service.sortStudents(students, 'name', true);
        assert.strictEqual(result[0].name, 'Alice');
        assert.strictEqual(result[1].name, 'Bob');
        assert.strictEqual(result[2].name, 'Charlie');
    });

    test('should sort by name descending', () => {
        const students = [
            { name: 'Alice', instrument: 'violin' },
            { name: 'Charlie', instrument: 'cello' },
            { name: 'Bob', instrument: 'viola' }
        ];
        const result = service.sortStudents(students, 'name', false);
        assert.strictEqual(result[0].name, 'Charlie');
        assert.strictEqual(result[2].name, 'Alice');
    });

    test('should sort by practice time ascending', () => {
        const students = [
            { name: 'A', weeklyPracticeTimeMs: 30000 },
            { name: 'B', weeklyPracticeTimeMs: 10000 },
            { name: 'C', weeklyPracticeTimeMs: 50000 }
        ];
        const result = service.sortStudents(students, 'practiceTime', true);
        assert.strictEqual(result[0].name, 'B');
        assert.strictEqual(result[1].name, 'A');
        assert.strictEqual(result[2].name, 'C');
    });

    test('should sort by intonation score', () => {
        const students = [
            { name: 'A', averageIntonationScore: 85 },
            { name: 'B', averageIntonationScore: null },
            { name: 'C', averageIntonationScore: 92 }
        ];
        const result = service.sortStudents(students, 'intonation', false);
        assert.strictEqual(result[0].name, 'C');
        assert.strictEqual(result[1].name, 'A');
        assert.strictEqual(result[2].name, 'B');
    });

    test('should sort by last session', () => {
        const students = [
            { name: 'A', lastSessionAt: 1000 },
            { name: 'B', lastSessionAt: 3000 },
            { name: 'C', lastSessionAt: 2000 }
        ];
        const result = service.sortStudents(students, 'lastSession', true);
        assert.strictEqual(result[0].name, 'A');
        assert.strictEqual(result[2].name, 'B');
    });

    test('should sort by instrument', () => {
        const students = [
            { name: 'A', instrument: 'violin' },
            { name: 'B', instrument: 'bass' },
            { name: 'C', instrument: 'cello' }
        ];
        const result = service.sortStudents(students, 'instrument', true);
        assert.strictEqual(result[0].instrument, 'bass');
        assert.strictEqual(result[1].instrument, 'cello');
        assert.strictEqual(result[2].instrument, 'violin');
    });

    test('should handle missing values gracefully', () => {
        const students = [
            { name: 'A', weeklyPracticeTimeMs: 0 },
            { name: 'B' },
            { name: 'C', weeklyPracticeTimeMs: 500 }
        ];
        const result = service.sortStudents(students, 'practiceTime', true);
        assert.strictEqual(result[0].name, 'A');
        assert.strictEqual(result[2].name, 'C');
    });

    test('should not mutate original array', () => {
        const students = [
            { name: 'B' },
            { name: 'A' }
        ];
        const result = service.sortStudents(students, 'name', true);
        assert.strictEqual(students[0].name, 'B');
        assert.strictEqual(result[0].name, 'A');
        assert.notStrictEqual(result, students);
    });
});

describe('TeacherService - Dashboard Metrics', () => {
    let service;

    beforeEach(() => {
        service = new TeacherService();
    });

    test('should return zero metrics for empty roster', () => {
        const metrics = service.getDashboardMetrics([]);
        assert.strictEqual(metrics.totalStudents, 0);
        assert.strictEqual(metrics.totalWeeklyPracticeMs, 0);
        assert.strictEqual(metrics.averageIntonation, null);
        assert.strictEqual(metrics.studentsActiveThisWeek, 0);
        assert.deepStrictEqual(metrics.topPracticers, []);
        assert.deepStrictEqual(metrics.needsAttention, []);
    });

    test('should return zero metrics for null input', () => {
        const metrics = service.getDashboardMetrics(null);
        assert.strictEqual(metrics.totalStudents, 0);
    });

    test('should calculate total weekly practice time', () => {
        const students = [
            { weeklyPracticeTimeMs: 60000, averageIntonationScore: null, lastSessionAt: null },
            { weeklyPracticeTimeMs: 120000, averageIntonationScore: null, lastSessionAt: null }
        ];
        const metrics = service.getDashboardMetrics(students);
        assert.strictEqual(metrics.totalWeeklyPracticeMs, 180000);
    });

    test('should calculate average intonation score', () => {
        const students = [
            { weeklyPracticeTimeMs: 0, averageIntonationScore: 80, lastSessionAt: Date.now() },
            { weeklyPracticeTimeMs: 0, averageIntonationScore: 90, lastSessionAt: Date.now() },
            { weeklyPracticeTimeMs: 0, averageIntonationScore: null, lastSessionAt: null }
        ];
        const metrics = service.getDashboardMetrics(students);
        assert.strictEqual(metrics.averageIntonation, 85);
    });

    test('should count students active this week', () => {
        const now = Date.now();
        const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
        const students = [
            { weeklyPracticeTimeMs: 0, averageIntonationScore: null, lastSessionAt: now },
            { weeklyPracticeTimeMs: 0, averageIntonationScore: null, lastSessionAt: null },
            { weeklyPracticeTimeMs: 0, averageIntonationScore: null, lastSessionAt: twoWeeksAgo }
        ];
        const metrics = service.getDashboardMetrics(students);
        // Only the student with lastSessionAt=now should be active this week
        assert.strictEqual(metrics.studentsActiveThisWeek, 1);
    });

    test('should identify top 3 practicers', () => {
        const students = [
            { name: 'A', weeklyPracticeTimeMs: 100, averageIntonationScore: null, lastSessionAt: null },
            { name: 'B', weeklyPracticeTimeMs: 500, averageIntonationScore: null, lastSessionAt: null },
            { name: 'C', weeklyPracticeTimeMs: 300, averageIntonationScore: null, lastSessionAt: null },
            { name: 'D', weeklyPracticeTimeMs: 400, averageIntonationScore: null, lastSessionAt: null }
        ];
        const metrics = service.getDashboardMetrics(students);
        assert.strictEqual(metrics.topPracticers.length, 3);
        assert.strictEqual(metrics.topPracticers[0].name, 'B');
        assert.strictEqual(metrics.topPracticers[1].name, 'D');
        assert.strictEqual(metrics.topPracticers[2].name, 'C');
    });

    test('should identify students needing attention', () => {
        const now = Date.now();
        const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
        const students = [
            { name: 'Active', weeklyPracticeTimeMs: 0, averageIntonationScore: null, lastSessionAt: now },
            { name: 'Inactive', weeklyPracticeTimeMs: 0, averageIntonationScore: null, lastSessionAt: eightDaysAgo },
            { name: 'Never', weeklyPracticeTimeMs: 0, averageIntonationScore: null, lastSessionAt: null }
        ];
        const metrics = service.getDashboardMetrics(students);
        assert.strictEqual(metrics.needsAttention.length, 2);
    });
});

describe('TeacherService - Intonation Emoji', () => {
    let service;

    beforeEach(() => {
        service = new TeacherService();
    });

    test('should return correct emoji for excellent score', () => {
        const result = service.getIntonationEmoji(95);
        assert.strictEqual(result.icon, '★');
        assert.strictEqual(result.label, 'Excellent');
    });

    test('should return correct emoji for good score', () => {
        const result = service.getIntonationEmoji(80);
        assert.strictEqual(result.icon, '◆');
        assert.strictEqual(result.label, 'Good');
    });

    test('should return correct emoji for fair score', () => {
        const result = service.getIntonationEmoji(65);
        assert.strictEqual(result.icon, '●');
        assert.strictEqual(result.label, 'Fair');
    });

    test('should return correct emoji for needs work', () => {
        const result = service.getIntonationEmoji(45);
        assert.strictEqual(result.icon, '▲');
        assert.strictEqual(result.label, 'Needs work');
    });

    test('should return correct emoji for struggling', () => {
        const result = service.getIntonationEmoji(30);
        assert.strictEqual(result.icon, '▼');
        assert.strictEqual(result.label, 'Struggling');
    });

    test('should handle null score', () => {
        const result = service.getIntonationEmoji(null);
        assert.strictEqual(result.icon, '—');
        assert.strictEqual(result.label, 'No data');
    });

    test('should handle undefined score', () => {
        const result = service.getIntonationEmoji(undefined);
        assert.strictEqual(result.icon, '—');
        assert.strictEqual(result.label, 'No data');
    });

    test('should handle boundary values', () => {
        assert.strictEqual(service.getIntonationEmoji(90).label, 'Excellent');
        assert.strictEqual(service.getIntonationEmoji(89).label, 'Good');
        assert.strictEqual(service.getIntonationEmoji(75).label, 'Good');
        assert.strictEqual(service.getIntonationEmoji(74).label, 'Fair');
        assert.strictEqual(service.getIntonationEmoji(60).label, 'Fair');
        assert.strictEqual(service.getIntonationEmoji(59).label, 'Needs work');
        assert.strictEqual(service.getIntonationEmoji(40).label, 'Needs work');
        assert.strictEqual(service.getIntonationEmoji(39).label, 'Struggling');
    });
});

describe('TeacherService - Format Practice Time', () => {
    let service;

    beforeEach(() => {
        service = new TeacherService();
    });

    test('should format zero time', () => {
        assert.strictEqual(service.formatPracticeTime(0), '0m');
    });

    test('should format null time', () => {
        assert.strictEqual(service.formatPracticeTime(null), '0m');
    });

    test('should format negative time', () => {
        assert.strictEqual(service.formatPracticeTime(-1000), '0m');
    });

    test('should format minutes only', () => {
        assert.strictEqual(service.formatPracticeTime(30 * 60000), '30m');
    });

    test('should format hours and minutes', () => {
        assert.strictEqual(service.formatPracticeTime(90 * 60000), '1h 30m');
    });

    test('should format exact hours', () => {
        assert.strictEqual(service.formatPracticeTime(120 * 60000), '2h');
    });

    test('should format less than a minute', () => {
        assert.strictEqual(service.formatPracticeTime(30000), '0m');
    });
});

describe('TeacherService - Week Start Calculation', () => {
    let service;

    beforeEach(() => {
        service = new TeacherService();
    });

    test('should return a timestamp', () => {
        const weekStart = service._getWeekStart();
        assert.strictEqual(typeof weekStart, 'number');
        assert.ok(weekStart > 0);
    });

    test('should return start of current week (Monday)', () => {
        const weekStart = service._getWeekStart();
        const date = new Date(weekStart);
        // Should be a Monday (day 1) or if today is Sunday, previous Monday
        const day = date.getDay();
        assert.strictEqual(day, 1); // Monday
        assert.strictEqual(date.getHours(), 0);
        assert.strictEqual(date.getMinutes(), 0);
    });

    test('should be in the past or now', () => {
        const weekStart = service._getWeekStart();
        assert.ok(weekStart <= Date.now());
    });
});
