/**
 * Assignment Service Tests
 * Tests for the Smart Assignments & Routine Builder functionality
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock IndexedDB
const mockStores = {
    assignments: new Map(),
    studentLinks: new Map(),
    assignmentProgress: new Map()
};

let mockTransactionStore;

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
                objectStoreNames: {
                    contains: (name) => ['assignments', 'studentLinks', 'assignmentProgress'].includes(name)
                },
                createObjectStore: (storeName, options) => {
                    mockTransactionStore = {
                        createIndex: () => {},
                        add: (data) => {
                            const req = { onsuccess: null, onerror: null };
                            setTimeout(() => {
                                if (!data.id) {
                                    data.id = 'test-id-' + Math.random().toString(36).substr(2, 9);
                                }
                                mockStores[storeName].set(data.id, data);
                                if (req.onsuccess) req.onsuccess({ target: { result: data.id } });
                            }, 0);
                            return req;
                        },
                        put: (data) => {
                            const req = { onsuccess: null, onerror: null };
                            setTimeout(() => {
                                mockStores[storeName].set(data.id, data);
                                if (req.onsuccess) req.onsuccess({ target: { result: data.id } });
                            }, 0);
                            return req;
                        },
                        get: (id) => {
                            const req = { onsuccess: null, onerror: null };
                            setTimeout(() => {
                                const data = mockStores[storeName].get(id);
                                if (req.onsuccess) req.onsuccess({ target: { result: data } });
                            }, 0);
                            return req;
                        },
                        getAll: () => {
                            const req = { onsuccess: null, onerror: null };
                            setTimeout(() => {
                                if (req.onsuccess) req.onsuccess({ target: { result: Array.from(mockStores[storeName].values()) } });
                            }, 0);
                            return req;
                        },
                        delete: (id) => {
                            const req = { onsuccess: null, onerror: null };
                            setTimeout(() => {
                                mockStores[storeName].delete(id);
                                if (req.onsuccess) req.onsuccess({ target: {} });
                            }, 0);
                            return req;
                        },
                        index: (indexName) => ({
                            getAll: (key) => {
                                const req = { onsuccess: null, onerror: null };
                                setTimeout(() => {
                                    const results = Array.from(mockStores[storeName].values())
                                        .filter(item => item[indexName] === key);
                                    if (req.onsuccess) req.onsuccess({ target: { result: results } });
                                }, 0);
                                return req;
                            }
                        })
                    };
                    return mockTransactionStore;
                },
                transaction: (storeNames) => ({
                    objectStore: (storeName) => mockTransactionStore || {
                        createIndex: () => {},
                        add: () => ({ onsuccess: null, onerror: null }),
                        put: () => ({ onsuccess: null, onerror: null }),
                        get: () => ({ onsuccess: null, onerror: null }),
                        getAll: () => ({ onsuccess: null, onerror: null }),
                        delete: () => ({ onsuccess: null, onerror: null }),
                        index: () => ({
                            getAll: () => ({ onsuccess: null, onerror: null })
                        })
                    },
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
const AssignmentService = require('../src/js/services/assignment-service.js');

describe('AssignmentService', () => {
    let service;

    beforeEach(() => {
        // Reset mock stores
        mockStores.assignments.clear();
        mockStores.studentLinks.clear();
        mockStores.assignmentProgress.clear();

        service = new AssignmentService();
    });

    test('should initialize with correct database name', () => {
        assert.strictEqual(service.dbName, 'ConcertmasterAssignments');
        assert.strictEqual(service.dbVersion, 1);
        assert.strictEqual(service.db, null);
    });

    test('should have all required methods', () => {
        assert.strictEqual(typeof service.init, 'function');
        assert.strictEqual(typeof service.linkStudentToTeacher, 'function');
        assert.strictEqual(typeof service.getTeacherStudents, 'function');
        assert.strictEqual(typeof service.removeStudentLink, 'function');
        assert.strictEqual(typeof service.createAssignment, 'function');
        assert.strictEqual(typeof service.getTeacherAssignments, 'function');
        assert.strictEqual(typeof service.getStudentAssignments, 'function');
        assert.strictEqual(typeof service.getUpcomingAssignments, 'function');
        assert.strictEqual(typeof service.getNextAssignment, 'function');
        assert.strictEqual(typeof service.getAssignment, 'function');
        assert.strictEqual(typeof service.updateAssignment, 'function');
        assert.strictEqual(typeof service.updateStatus, 'function');
        assert.strictEqual(typeof service.deleteAssignment, 'function');
        assert.strictEqual(typeof service.recordProgress, 'function');
        assert.strictEqual(typeof service.getAssignmentProgress, 'function');
        assert.strictEqual(typeof service.getLatestProgress, 'function');
        assert.strictEqual(typeof service.getTeacherStats, 'function');
        assert.strictEqual(typeof service.getStudentStats, 'function');
        assert.strictEqual(typeof service.formatDueDate, 'function');
        assert.strictEqual(typeof service.getMeasureRange, 'function');
        assert.strictEqual(typeof service.getTargetSummary, 'function');
    });

    test('should have onUpdate callback support', () => {
        assert.strictEqual(service.onUpdate, null);
        let called = false;
        service.onUpdate = () => { called = true; };
        service._notifyUpdate();
        assert.strictEqual(called, true);
    });

    test('should initialize database', async () => {
        await service.init();
        assert.notStrictEqual(service.db, null);
    });

    test('should create an assignment', async () => {
        await service.init();

        const assignment = await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            pieceTitle: 'Test Piece',
            composer: 'Test Composer',
            title: 'Practice Assignment',
            description: 'Practice measures 1-10',
            measureStart: 1,
            measureEnd: 10,
            targetTempo: 80,
            targetIntonation: 90,
            dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000
        });

        assert.strictEqual(assignment.teacherId, 'teacher-1');
        assert.strictEqual(assignment.studentId, 'student-1');
        assert.strictEqual(assignment.pieceTitle, 'Test Piece');
        assert.strictEqual(assignment.title, 'Practice Assignment');
        assert.strictEqual(assignment.measureStart, 1);
        assert.strictEqual(assignment.measureEnd, 10);
        assert.strictEqual(assignment.targetTempo, 80);
        assert.strictEqual(assignment.targetIntonation, 90);
        assert.strictEqual(assignment.status, 'assigned');
        assert.strictEqual(assignment.priority, 'normal');
        assert.ok(assignment.id);
        assert.ok(assignment.createdAt);
    });

    test('should get teacher assignments', async () => {
        await service.init();

        await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Assignment 1'
        });

        await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-2',
            title: 'Assignment 2'
        });

        const assignments = await service.getTeacherAssignments('teacher-1');
        assert.strictEqual(assignments.length, 2);
    });

    test('should get student assignments', async () => {
        await service.init();

        await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Assignment for Student 1'
        });

        await service.createAssignment({
            teacherId: 'teacher-2',
            studentId: 'student-1',
            title: 'Another Assignment for Student 1'
        });

        const assignments = await service.getStudentAssignments('student-1');
        assert.strictEqual(assignments.length, 2);
    });

    test('should get next assignment for student', async () => {
        await service.init();

        // Create an overdue assignment
        await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Overdue Assignment',
            dueDate: Date.now() - 24 * 60 * 60 * 1000 // Yesterday
        });

        // Create a future assignment
        await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Future Assignment',
            dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000 // Next week
        });

        const next = await service.getNextAssignment('student-1');
        assert.strictEqual(next.title, 'Overdue Assignment');
    });

    test('should format due date correctly', () => {
        // No due date
        assert.strictEqual(service.formatDueDate(null), 'No due date');
        assert.strictEqual(service.formatDueDate(undefined), 'No due date');

        // Overdue
        const yesterday = Date.now() - 24 * 60 * 60 * 1000;
        assert.ok(service.formatDueDate(yesterday).includes('Overdue'));

        // Due today
        const today = Date.now();
        assert.strictEqual(service.formatDueDate(today), 'Due today');

        // Due tomorrow
        const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
        assert.strictEqual(service.formatDueDate(tomorrow), 'Due tomorrow');

        // Due in a few days
        const inThreeDays = Date.now() + 3 * 24 * 60 * 60 * 1000;
        assert.strictEqual(service.formatDueDate(inThreeDays), 'Due in 3 days');
    });

    test('should get measure range correctly', () => {
        const assignment1 = { measureStart: 1, measureEnd: 10 };
        const assignment2 = { measureStart: 14, measureEnd: 32 };
        const assignment3 = { measureStart: 5, measureEnd: null };

        assert.strictEqual(service.getMeasureRange(assignment1), 'Measures 1-10');
        assert.strictEqual(service.getMeasureRange(assignment2), 'Measures 14-32');
        assert.strictEqual(service.getMeasureRange(assignment3), 'Measure 5+');
    });

    test('should get target summary correctly', () => {
        const noTargets = {};
        const tempoOnly = { targetTempo: 80 };
        const allTargets = { targetTempo: 80, targetIntonation: 90, targetAccuracy: 85 };

        assert.strictEqual(service.getTargetSummary(noTargets), 'Practice targets not set');
        assert.strictEqual(service.getTargetSummary(tempoOnly), '80 BPM');
        assert.strictEqual(service.getTargetSummary(allTargets), '80 BPM + 90% Intonation + 85% Accuracy');
    });

    test('should link student to teacher', async () => {
        await service.init();

        const link = await service.linkStudentToTeacher('teacher-1', 'student-1', 'student@test.com', 'Test Student');

        assert.strictEqual(link.teacherId, 'teacher-1');
        assert.strictEqual(link.studentId, 'student-1');
        assert.strictEqual(link.studentEmail, 'student@test.com');
        assert.strictEqual(link.studentName, 'Test Student');
        assert.ok(link.linkedAt);
    });

    test('should get teacher students', async () => {
        await service.init();

        await service.linkStudentToTeacher('teacher-1', 'student-1');
        await service.linkStudentToTeacher('teacher-1', 'student-2');
        await service.linkStudentToTeacher('teacher-2', 'student-3');

        const students = await service.getTeacherStudents('teacher-1');
        assert.strictEqual(students.length, 2);
    });

    test('should update assignment status', async () => {
        await service.init();

        const assignment = await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Test Assignment'
        });

        const updated = await service.updateStatus(assignment.id, 'completed');
        assert.strictEqual(updated.status, 'completed');
        assert.ok(updated.completedAt);
    });

    test('should delete assignment', async () => {
        await service.init();

        const assignment = await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'To Be Deleted'
        });

        await service.deleteAssignment(assignment.id);

        const deleted = await service.getAssignment(assignment.id);
        assert.strictEqual(deleted, null);
    });

    test('should record progress', async () => {
        await service.init();

        const assignment = await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Test Assignment'
        });

        const progress = await service.recordProgress(assignment.id, 'student-1', {
            tempoAchieved: 85,
            intonationScore: 92,
            accuracyScore: 88,
            practiceDurationMs: 300000
        });

        assert.strictEqual(progress.assignmentId, assignment.id);
        assert.strictEqual(progress.studentId, 'student-1');
        assert.strictEqual(progress.tempoAchieved, 85);
        assert.strictEqual(progress.intonationScore, 92);
        assert.strictEqual(progress.accuracyScore, 88);
        assert.strictEqual(progress.practiceDurationMs, 300000);
    });

    test('should get assignment progress', async () => {
        await service.init();

        const assignment = await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Test Assignment'
        });

        await service.recordProgress(assignment.id, 'student-1', {
            tempoAchieved: 80,
            intonationScore: 85
        });

        await service.recordProgress(assignment.id, 'student-1', {
            tempoAchieved: 85,
            intonationScore: 90
        });

        const progressList = await service.getAssignmentProgress(assignment.id);
        assert.strictEqual(progressList.length, 2);
    });

    test('should get teacher stats', async () => {
        await service.init();

        // Create various assignments
        await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Assigned',
            status: 'assigned'
        });

        await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'In Progress',
            status: 'in_progress'
        });

        await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Completed',
            status: 'completed'
        });

        await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Overdue',
            status: 'assigned',
            dueDate: Date.now() - 24 * 60 * 60 * 1000
        });

        const stats = await service.getTeacherStats('teacher-1');
        assert.strictEqual(stats.total, 4);
        assert.strictEqual(stats.assigned, 2);
        assert.strictEqual(stats.inProgress, 1);
        assert.strictEqual(stats.completed, 1);
        assert.strictEqual(stats.overdue, 1);
    });

    test('should get student stats', async () => {
        await service.init();

        await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Assignment 1',
            status: 'assigned'
        });

        await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Assignment 2',
            status: 'completed'
        });

        const stats = await service.getStudentStats('student-1');
        assert.strictEqual(stats.total, 2);
        assert.strictEqual(stats.assigned, 1);
        assert.strictEqual(stats.completed, 1);
    });

    test('should auto-complete assignment when targets are met', async () => {
        await service.init();

        const assignment = await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Test Assignment',
            targetTempo: 80,
            targetIntonation: 90,
            status: 'in_progress'
        });

        // Record progress that meets targets
        await service.recordProgress(assignment.id, 'student-1', {
            tempoAchieved: 85,
            intonationScore: 95
        });

        const updated = await service.getAssignment(assignment.id);
        assert.strictEqual(updated.status, 'completed');
    });

    test('should not auto-complete assignment when targets are not met', async () => {
        await service.init();

        const assignment = await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Test Assignment',
            targetTempo: 100,
            targetIntonation: 90,
            status: 'in_progress'
        });

        // Record progress that does NOT meet targets
        await service.recordProgress(assignment.id, 'student-1', {
            tempoAchieved: 80, // Below target of 100
            intonationScore: 95
        });

        const updated = await service.getAssignment(assignment.id);
        assert.strictEqual(updated.status, 'in_progress');
    });

    test('should sort assignments correctly', async () => {
        await service.init();

        // Create assignments with different statuses and due dates
        await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Completed',
            status: 'completed'
        });

        await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Overdue',
            status: 'assigned',
            dueDate: Date.now() - 24 * 60 * 60 * 1000
        });

        await service.createAssignment({
            teacherId: 'teacher-1',
            studentId: 'student-1',
            title: 'Future Due',
            status: 'assigned',
            dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000
        });

        const assignments = await service.getStudentAssignments('student-1');

        // Completed should be last
        assert.strictEqual(assignments[assignments.length - 1].title, 'Completed');

        // Overdue should be before future due
        const overdueIndex = assignments.findIndex(a => a.title === 'Overdue');
        const futureIndex = assignments.findIndex(a => a.title === 'Future Due');
        assert.ok(overdueIndex < futureIndex);
    });
});

describe('AssignmentService Utility Methods', () => {
    let service;

    beforeEach(() => {
        service = new AssignmentService();
    });

    test('_generateId should create unique IDs', () => {
        const id1 = service._generateId('test');
        const id2 = service._generateId('test');

        assert.ok(id1);
        assert.ok(id2);
        assert.notStrictEqual(id1, id2);
    });

    test('_promisifyRequest should resolve with result', async () => {
        const mockRequest = {
            onsuccess: null,
            onerror: null
        };

        setTimeout(() => {
            mockRequest.onsuccess({ target: { result: 'test-value' } });
        }, 10);

        const result = await service._promisifyRequest(mockRequest);
        assert.strictEqual(result, 'test-value');
    });

    test('_promisifyRequest should reject on error', async () => {
        const mockRequest = {
            onsuccess: null,
            onerror: null
        };

        setTimeout(() => {
            mockRequest.onerror({ target: { error: 'test-error' } });
        }, 10);

        await assert.rejects(
            service._promisifyRequest(mockRequest),
            /test-error/
        );
    });
});
