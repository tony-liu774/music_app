/**
 * Assignment Service Tests
 * Tests for the Smart Assignments & Routine Builder client-side service
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock IndexedDB
function createMockDB() {
    const stores = {
        assignments: new Map(),
        relationships: new Map(),
        users: new Map()
    };

    return {
        objectStoreNames: {
            contains: (name) => stores.hasOwnProperty(name)
        },
        createObjectStore: (name) => ({
            createIndex: () => {}
        }),
        transaction: (storeNames, mode) => {
            const txn = {
                objectStore: (name) => ({
                    add: (item) => {
                        const req = { onsuccess: null, onerror: null };
                        setTimeout(() => {
                            stores[name].set(item.id, { ...item });
                            if (req.onsuccess) req.onsuccess();
                        }, 0);
                        return req;
                    },
                    put: (item) => {
                        const req = { onsuccess: null, onerror: null };
                        setTimeout(() => {
                            stores[name].set(item.id, { ...item });
                            if (req.onsuccess) req.onsuccess();
                        }, 0);
                        return req;
                    },
                    get: (id) => {
                        const req = { onsuccess: null, onerror: null, result: null };
                        setTimeout(() => {
                            req.result = stores[name].get(id) || null;
                            if (req.onsuccess) req.onsuccess();
                        }, 0);
                        return req;
                    },
                    getAll: () => {
                        const req = { onsuccess: null, onerror: null, result: null };
                        setTimeout(() => {
                            req.result = Array.from(stores[name].values());
                            if (req.onsuccess) req.onsuccess();
                        }, 0);
                        return req;
                    },
                    delete: (id) => {
                        const req = { onsuccess: null, onerror: null };
                        setTimeout(() => {
                            stores[name].delete(id);
                            if (req.onsuccess) req.onsuccess();
                        }, 0);
                        return req;
                    }
                }),
                oncomplete: null,
                onerror: null
            };
            return txn;
        },
        _stores: stores
    };
}

// Setup globals
global.window = {};
global.localStorage = {
    _data: {},
    getItem: function(key) { return this._data[key] || null; },
    setItem: function(key, value) { this._data[key] = value; },
    removeItem: function(key) { delete this._data[key]; },
    clear: function() { this._data = {}; }
};

let uuidCounter = 0;
global.crypto = {
    randomUUID: () => `test-uuid-${++uuidCounter}`
};

global.indexedDB = {
    open: (name, version) => {
        const mockDB = createMockDB();
        const request = {
            result: mockDB,
            error: null,
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null
        };

        setTimeout(() => {
            // Trigger upgrade if needed
            if (request.onupgradeneeded) {
                request.onupgradeneeded({ target: { result: mockDB } });
            }
            if (request.onsuccess) {
                request.onsuccess({ target: request });
            }
        }, 0);

        return request;
    }
};

// Require the service
require('../src/js/services/assignment-service.js');
const AssignmentService = window.AssignmentService;

describe('AssignmentService', () => {
    let service;

    beforeEach(async () => {
        uuidCounter = 0;
        localStorage.clear();
        localStorage.setItem('user_id', 'teacher-1');
        localStorage.setItem('user_role', 'teacher');
        service = new AssignmentService();
        await service.init();
    });

    describe('init', () => {
        test('should initialize successfully', async () => {
            const svc = new AssignmentService();
            await svc.init();
            assert.ok(svc.db, 'Database should be initialized');
        });

        test('should have correct database name', () => {
            assert.strictEqual(service.dbName, 'ConcertmasterAssignments');
        });
    });

    describe('createAssignment', () => {
        test('should create an assignment with required fields', async () => {
            const assignment = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1',
                title: 'Practice Etude'
            });

            assert.ok(assignment.id, 'Should have an ID');
            assert.strictEqual(assignment.teacherId, 'teacher-1');
            assert.strictEqual(assignment.studentId, 'student-1');
            assert.strictEqual(assignment.scoreId, 'score-1');
            assert.strictEqual(assignment.title, 'Practice Etude');
            assert.strictEqual(assignment.status, 'pending');
        });

        test('should set default target values', async () => {
            const assignment = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1'
            });

            assert.strictEqual(assignment.target.bpm, 80);
            assert.strictEqual(assignment.target.intonationThreshold, 90);
        });

        test('should set custom target values', async () => {
            const assignment = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1',
                target: { bpm: 120, intonationThreshold: 95 }
            });

            assert.strictEqual(assignment.target.bpm, 120);
            assert.strictEqual(assignment.target.intonationThreshold, 95);
        });

        test('should set measure range', async () => {
            const assignment = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1',
                measures: { start: 14, end: 32 }
            });

            assert.strictEqual(assignment.measures.start, 14);
            assert.strictEqual(assignment.measures.end, 32);
        });

        test('should reject missing required fields', async () => {
            await assert.rejects(
                () => service.createAssignment({ teacherId: 'teacher-1' }),
                /teacherId, studentId, and scoreId are required/
            );
        });

        test('should initialize progress to zeros', async () => {
            const assignment = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1'
            });

            assert.strictEqual(assignment.progress.currentBpm, 0);
            assert.strictEqual(assignment.progress.currentIntonation, 0);
            assert.strictEqual(assignment.progress.practiceCount, 0);
            assert.strictEqual(assignment.progress.totalPracticeMinutes, 0);
            assert.strictEqual(assignment.progress.lastPracticed, null);
        });

        test('should set createdAt timestamp', async () => {
            const before = new Date().toISOString();
            const assignment = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1'
            });
            const after = new Date().toISOString();

            assert.ok(assignment.createdAt >= before);
            assert.ok(assignment.createdAt <= after);
        });

        test('should set due date when provided', async () => {
            const dueDate = '2026-04-01T00:00:00.000Z';
            const assignment = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1',
                dueDate
            });

            assert.strictEqual(assignment.dueDate, dueDate);
        });
    });

    describe('getAssignment', () => {
        test('should retrieve an assignment by ID', async () => {
            const created = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1',
                title: 'Test Assignment'
            });

            const retrieved = await service.getAssignment(created.id);
            assert.strictEqual(retrieved.title, 'Test Assignment');
        });

        test('should return null for non-existent ID', async () => {
            const result = await service.getAssignment('non-existent');
            assert.strictEqual(result, null);
        });
    });

    describe('getAllAssignments', () => {
        test('should return all assignments', async () => {
            await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1'
            });
            await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-2',
                scoreId: 'score-2'
            });

            const all = await service.getAllAssignments();
            assert.strictEqual(all.length, 2);
        });
    });

    describe('getStudentAssignments', () => {
        test('should filter by student ID', async () => {
            await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1'
            });
            await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-2',
                scoreId: 'score-2'
            });

            const student1 = await service.getStudentAssignments('student-1');
            assert.strictEqual(student1.length, 1);
        });
    });

    describe('getTeacherAssignments', () => {
        test('should filter by teacher ID', async () => {
            await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1'
            });
            await service.createAssignment({
                teacherId: 'teacher-2',
                studentId: 'student-1',
                scoreId: 'score-2'
            });

            const teacher1 = await service.getTeacherAssignments('teacher-1');
            assert.strictEqual(teacher1.length, 1);
        });
    });

    describe('getUpNextAssignment', () => {
        test('should return first pending assignment', async () => {
            await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1',
                title: 'First'
            });
            await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-2',
                title: 'Second'
            });

            const upNext = await service.getUpNextAssignment('student-1');
            assert.ok(upNext, 'Should return an assignment');
            assert.strictEqual(upNext.status, 'pending');
        });

        test('should return null if no active assignments', async () => {
            const upNext = await service.getUpNextAssignment('student-1');
            assert.strictEqual(upNext, null);
        });
    });

    describe('updateAssignment', () => {
        test('should update assignment fields', async () => {
            const created = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1',
                title: 'Original'
            });

            const updated = await service.updateAssignment(created.id, {
                title: 'Updated Title'
            });

            assert.strictEqual(updated.title, 'Updated Title');
            assert.strictEqual(updated.id, created.id);
        });

        test('should reject update for non-existent assignment', async () => {
            await assert.rejects(
                () => service.updateAssignment('non-existent', { title: 'x' }),
                /Assignment not found/
            );
        });
    });

    describe('updateProgress', () => {
        test('should update progress data', async () => {
            const created = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1'
            });

            const updated = await service.updateProgress(created.id, {
                bpm: 60,
                intonation: 70,
                durationMinutes: 15
            });

            assert.strictEqual(updated.progress.currentBpm, 60);
            assert.strictEqual(updated.progress.currentIntonation, 70);
            assert.strictEqual(updated.progress.practiceCount, 1);
            assert.strictEqual(updated.progress.totalPracticeMinutes, 15);
            assert.ok(updated.progress.lastPracticed);
        });

        test('should transition from pending to in_progress', async () => {
            const created = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1'
            });

            const updated = await service.updateProgress(created.id, {
                bpm: 60,
                intonation: 70,
                durationMinutes: 10
            });

            assert.strictEqual(updated.status, 'in_progress');
        });

        test('should auto-complete when target met', async () => {
            const created = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1',
                target: { bpm: 80, intonationThreshold: 90 }
            });

            const updated = await service.updateProgress(created.id, {
                bpm: 85,
                intonation: 95,
                durationMinutes: 20
            });

            assert.strictEqual(updated.status, 'completed');
            assert.ok(updated.completedAt);
        });

        test('should not auto-complete when target not fully met', async () => {
            const created = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1',
                target: { bpm: 80, intonationThreshold: 90 }
            });

            const updated = await service.updateProgress(created.id, {
                bpm: 85,
                intonation: 80, // Below threshold
                durationMinutes: 20
            });

            assert.notStrictEqual(updated.status, 'completed');
        });

        test('should accumulate practice count', async () => {
            const created = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1',
                target: { bpm: 200, intonationThreshold: 99 }
            });

            await service.updateProgress(created.id, { bpm: 40, intonation: 50, durationMinutes: 5 });
            const updated = await service.updateProgress(created.id, { bpm: 50, intonation: 60, durationMinutes: 10 });

            assert.strictEqual(updated.progress.practiceCount, 2);
            assert.strictEqual(updated.progress.totalPracticeMinutes, 15);
        });
    });

    describe('completeAssignment', () => {
        test('should mark as completed', async () => {
            const created = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1'
            });

            const completed = await service.completeAssignment(created.id);
            assert.strictEqual(completed.status, 'completed');
            assert.ok(completed.completedAt);
        });
    });

    describe('deleteAssignment', () => {
        test('should delete an assignment', async () => {
            const created = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1'
            });

            await service.deleteAssignment(created.id);
            const result = await service.getAssignment(created.id);
            assert.strictEqual(result, null);
        });
    });

    describe('relationships', () => {
        test('should add a teacher-student relationship', async () => {
            const rel = await service.addRelationship('teacher-1', 'student-1');
            assert.ok(rel.id);
            assert.strictEqual(rel.teacherId, 'teacher-1');
            assert.strictEqual(rel.studentId, 'student-1');
        });

        test('should not duplicate relationships', async () => {
            await service.addRelationship('teacher-1', 'student-1');
            const dup = await service.addRelationship('teacher-1', 'student-1');
            assert.ok(dup); // Should return existing

            const rels = await service.getRelationships('teacher-1');
            assert.strictEqual(rels.length, 1);
        });

        test('should get relationships for a teacher', async () => {
            await service.addRelationship('teacher-1', 'student-1');
            await service.addRelationship('teacher-1', 'student-2');

            const rels = await service.getRelationships('teacher-1');
            assert.strictEqual(rels.length, 2);
        });

        test('should remove a relationship', async () => {
            const rel = await service.addRelationship('teacher-1', 'student-1');
            await service.removeRelationship(rel.id);

            const rels = await service.getRelationships('teacher-1');
            assert.strictEqual(rels.length, 0);
        });
    });

    describe('user profiles', () => {
        test('should save a user profile', async () => {
            const user = await service.saveUser({
                id: 'teacher-1',
                name: 'Prof. Smith',
                role: 'teacher',
                instrument: 'violin'
            });

            assert.strictEqual(user.name, 'Prof. Smith');
            assert.strictEqual(user.role, 'teacher');
        });

        test('should retrieve a user profile', async () => {
            await service.saveUser({
                id: 'student-1',
                name: 'Jane Doe',
                role: 'student'
            });

            const user = await service.getUser('student-1');
            assert.strictEqual(user.name, 'Jane Doe');
        });
    });

    describe('calculateProgress', () => {
        test('should calculate 0% for new assignment', () => {
            const assignment = {
                target: { bpm: 80, intonationThreshold: 90 },
                progress: { currentBpm: 0, currentIntonation: 0 }
            };

            assert.strictEqual(service.calculateProgress(assignment), 0);
        });

        test('should calculate 50% when halfway there', () => {
            const assignment = {
                target: { bpm: 80, intonationThreshold: 100 },
                progress: { currentBpm: 40, currentIntonation: 50 }
            };

            assert.strictEqual(service.calculateProgress(assignment), 50);
        });

        test('should cap at 100%', () => {
            const assignment = {
                target: { bpm: 80, intonationThreshold: 90 },
                progress: { currentBpm: 120, currentIntonation: 100 }
            };

            assert.strictEqual(service.calculateProgress(assignment), 100);
        });

        test('should return 0 for null assignment', () => {
            assert.strictEqual(service.calculateProgress(null), 0);
        });
    });

    describe('isOverdue', () => {
        test('should return true for past due date', () => {
            const assignment = {
                dueDate: '2020-01-01T00:00:00.000Z',
                status: 'pending'
            };
            assert.strictEqual(service.isOverdue(assignment), true);
        });

        test('should return false for future due date', () => {
            const assignment = {
                dueDate: '2099-12-31T00:00:00.000Z',
                status: 'pending'
            };
            assert.strictEqual(service.isOverdue(assignment), false);
        });

        test('should return false for completed assignments', () => {
            const assignment = {
                dueDate: '2020-01-01T00:00:00.000Z',
                status: 'completed'
            };
            assert.strictEqual(service.isOverdue(assignment), false);
        });

        test('should return false if no due date', () => {
            const assignment = {
                dueDate: null,
                status: 'pending'
            };
            assert.strictEqual(service.isOverdue(assignment), false);
        });
    });

    describe('getCurrentUserId', () => {
        test('should return user ID from localStorage', () => {
            localStorage.setItem('user_id', 'test-user');
            assert.strictEqual(service.getCurrentUserId(), 'test-user');
        });

        test('should return null if not set', () => {
            localStorage.removeItem('user_id');
            assert.strictEqual(service.getCurrentUserId(), null);
        });
    });

    describe('getCurrentUserRole', () => {
        test('should return role from localStorage', () => {
            localStorage.setItem('user_role', 'teacher');
            assert.strictEqual(service.getCurrentUserRole(), 'teacher');
        });

        test('should default to student', () => {
            localStorage.removeItem('user_role');
            assert.strictEqual(service.getCurrentUserRole(), 'student');
        });
    });

    describe('getTeacherStats', () => {
        test('should calculate correct stats', async () => {
            // Create assignments with various states
            const a1 = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1',
                target: { bpm: 80, intonationThreshold: 90 }
            });

            // Complete one
            await service.completeAssignment(a1.id);

            // Create another pending one
            await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-2',
                scoreId: 'score-2',
                dueDate: '2020-01-01T00:00:00.000Z' // Overdue
            });

            const stats = await service.getTeacherStats('teacher-1');
            assert.strictEqual(stats.total, 2);
            assert.strictEqual(stats.completed, 1);
            assert.strictEqual(stats.overdue, 1);
            assert.strictEqual(stats.completionRate, 50);
        });
    });

    describe('getActiveAssignments', () => {
        test('should return only active assignments', async () => {
            const a1 = await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-1'
            });

            await service.createAssignment({
                teacherId: 'teacher-1',
                studentId: 'student-1',
                scoreId: 'score-2'
            });

            // Complete the first one
            await service.completeAssignment(a1.id);

            const active = await service.getActiveAssignments('student-1');
            assert.strictEqual(active.length, 1);
        });
    });
});
