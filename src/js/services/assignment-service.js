/**
 * Assignment Service - Smart Assignments & Routine Builder
 * Manages homework assignments between teachers and students via IndexedDB
 */

class AssignmentService {
    constructor() {
        this.dbName = 'ConcertmasterAssignments';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Assignments store
                if (!db.objectStoreNames.contains('assignments')) {
                    const store = db.createObjectStore('assignments', { keyPath: 'id' });
                    store.createIndex('teacherId', 'teacherId', { unique: false });
                    store.createIndex('studentId', 'studentId', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('dueDate', 'dueDate', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Teacher-Student relationships
                if (!db.objectStoreNames.contains('relationships')) {
                    const relStore = db.createObjectStore('relationships', { keyPath: 'id' });
                    relStore.createIndex('teacherId', 'teacherId', { unique: false });
                    relStore.createIndex('studentId', 'studentId', { unique: false });
                }

                // User profiles (teacher/student)
                if (!db.objectStoreNames.contains('users')) {
                    const userStore = db.createObjectStore('users', { keyPath: 'id' });
                    userStore.createIndex('role', 'role', { unique: false });
                }
            };
        });
    }

    /**
     * Create a new assignment
     * @param {Object} assignment - Assignment data
     * @param {string} assignment.teacherId - Teacher who created it
     * @param {string} assignment.studentId - Student assigned to
     * @param {string} assignment.scoreId - Score from Community Library
     * @param {string} assignment.title - Assignment title
     * @param {Object} assignment.measures - { start: number, end: number }
     * @param {Object} assignment.target - { bpm: number, intonationThreshold: number }
     * @param {string} assignment.dueDate - ISO date string
     * @param {string} [assignment.notes] - Teacher notes
     */
    async createAssignment(assignment) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            if (!assignment.teacherId || !assignment.studentId || !assignment.scoreId) {
                reject(new Error('teacherId, studentId, and scoreId are required'));
                return;
            }

            const newAssignment = {
                id: assignment.id || crypto.randomUUID(),
                teacherId: assignment.teacherId,
                studentId: assignment.studentId,
                scoreId: assignment.scoreId,
                title: assignment.title || 'Practice Assignment',
                measures: assignment.measures || { start: 1, end: null },
                target: {
                    bpm: assignment.target?.bpm || 80,
                    intonationThreshold: assignment.target?.intonationThreshold || 90
                },
                dueDate: assignment.dueDate || null,
                notes: assignment.notes || '',
                status: 'pending',
                progress: {
                    currentBpm: 0,
                    currentIntonation: 0,
                    practiceCount: 0,
                    totalPracticeMinutes: 0,
                    lastPracticed: null
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                completedAt: null
            };

            const transaction = this.db.transaction(['assignments'], 'readwrite');
            const store = transaction.objectStore('assignments');
            const request = store.add(newAssignment);

            request.onsuccess = () => resolve(newAssignment);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a single assignment by ID
     */
    async getAssignment(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['assignments'], 'readonly');
            const store = transaction.objectStore('assignments');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all assignments
     */
    async getAllAssignments() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['assignments'], 'readonly');
            const store = transaction.objectStore('assignments');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get assignments for a specific student
     */
    async getStudentAssignments(studentId) {
        const all = await this.getAllAssignments();
        return all
            .filter(a => a.studentId === studentId)
            .sort((a, b) => {
                // Pending first, then by due date
                if (a.status !== b.status) {
                    const order = { pending: 0, in_progress: 1, completed: 2 };
                    return (order[a.status] || 3) - (order[b.status] || 3);
                }
                if (a.dueDate && b.dueDate) {
                    return new Date(a.dueDate) - new Date(b.dueDate);
                }
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
    }

    /**
     * Get assignments created by a teacher
     */
    async getTeacherAssignments(teacherId) {
        const all = await this.getAllAssignments();
        return all
            .filter(a => a.teacherId === teacherId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * Get the next pending/in-progress assignment for a student ("Up Next")
     */
    async getUpNextAssignment(studentId) {
        const assignments = await this.getStudentAssignments(studentId);
        return assignments.find(a => a.status === 'pending' || a.status === 'in_progress') || null;
    }

    /**
     * Get all pending/in-progress assignments for a student
     */
    async getActiveAssignments(studentId) {
        const assignments = await this.getStudentAssignments(studentId);
        return assignments.filter(a => a.status === 'pending' || a.status === 'in_progress');
    }

    /**
     * Update an assignment
     */
    async updateAssignment(id, updates) {
        return new Promise(async (resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const existing = await this.getAssignment(id);
            if (!existing) {
                reject(new Error('Assignment not found'));
                return;
            }

            const updated = {
                ...existing,
                ...updates,
                id: existing.id, // Preserve ID
                updatedAt: new Date().toISOString()
            };

            const transaction = this.db.transaction(['assignments'], 'readwrite');
            const store = transaction.objectStore('assignments');
            const request = store.put(updated);

            request.onsuccess = () => resolve(updated);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update assignment progress after a practice session
     */
    async updateProgress(id, sessionData) {
        const assignment = await this.getAssignment(id);
        if (!assignment) {
            throw new Error('Assignment not found');
        }

        const progress = {
            ...assignment.progress,
            currentBpm: sessionData.bpm || assignment.progress.currentBpm,
            currentIntonation: sessionData.intonation || assignment.progress.currentIntonation,
            practiceCount: assignment.progress.practiceCount + 1,
            totalPracticeMinutes: assignment.progress.totalPracticeMinutes + (sessionData.durationMinutes || 0),
            lastPracticed: new Date().toISOString()
        };

        // Auto-detect status changes
        let status = assignment.status;
        if (status === 'pending') {
            status = 'in_progress';
        }

        // Check if target is met
        const targetMet = progress.currentBpm >= assignment.target.bpm &&
            progress.currentIntonation >= assignment.target.intonationThreshold;

        if (targetMet) {
            status = 'completed';
        }

        return this.updateAssignment(id, {
            progress,
            status,
            completedAt: status === 'completed' ? new Date().toISOString() : null
        });
    }

    /**
     * Mark an assignment as completed manually
     */
    async completeAssignment(id) {
        return this.updateAssignment(id, {
            status: 'completed',
            completedAt: new Date().toISOString()
        });
    }

    /**
     * Delete an assignment
     */
    async deleteAssignment(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['assignments'], 'readwrite');
            const store = transaction.objectStore('assignments');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Link a teacher to a student
     */
    async addRelationship(teacherId, studentId) {
        return new Promise(async (resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            // Check for existing relationship
            const existing = await this.getRelationships(teacherId);
            if (existing.some(r => r.studentId === studentId)) {
                resolve(existing.find(r => r.studentId === studentId));
                return;
            }

            const relationship = {
                id: crypto.randomUUID(),
                teacherId,
                studentId,
                createdAt: new Date().toISOString()
            };

            const transaction = this.db.transaction(['relationships'], 'readwrite');
            const store = transaction.objectStore('relationships');
            const request = store.add(relationship);

            request.onsuccess = () => resolve(relationship);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all relationships for a teacher
     */
    async getRelationships(teacherId) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['relationships'], 'readonly');
            const store = transaction.objectStore('relationships');
            const request = store.getAll();

            request.onsuccess = () => {
                const results = (request.result || []).filter(r => r.teacherId === teacherId);
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Remove a teacher-student relationship
     */
    async removeRelationship(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['relationships'], 'readwrite');
            const store = transaction.objectStore('relationships');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Save or update a user profile
     */
    async saveUser(user) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const userData = {
                id: user.id || crypto.randomUUID(),
                name: user.name || 'Unknown',
                role: user.role || 'student',
                instrument: user.instrument || 'violin',
                createdAt: user.createdAt || new Date().toISOString()
            };

            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            const request = store.put(userData);

            request.onsuccess = () => resolve(userData);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a user profile
     */
    async getUser(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get the current user ID from localStorage
     */
    getCurrentUserId() {
        return localStorage.getItem('user_id') || null;
    }

    /**
     * Get the current user role
     */
    getCurrentUserRole() {
        return localStorage.getItem('user_role') || 'student';
    }

    /**
     * Calculate progress percentage for an assignment
     */
    calculateProgress(assignment) {
        if (!assignment || !assignment.target) return 0;

        const bpmProgress = Math.min(
            (assignment.progress.currentBpm / assignment.target.bpm) * 100,
            100
        );
        const intonationProgress = Math.min(
            (assignment.progress.currentIntonation / assignment.target.intonationThreshold) * 100,
            100
        );

        return Math.round((bpmProgress + intonationProgress) / 2);
    }

    /**
     * Check if an assignment is overdue
     */
    isOverdue(assignment) {
        if (!assignment.dueDate || assignment.status === 'completed') return false;
        return new Date(assignment.dueDate) < new Date();
    }

    /**
     * Get completion statistics for a teacher's assignments
     */
    async getTeacherStats(teacherId) {
        const assignments = await this.getTeacherAssignments(teacherId);
        const total = assignments.length;
        const completed = assignments.filter(a => a.status === 'completed').length;
        const overdue = assignments.filter(a => this.isOverdue(a)).length;
        const inProgress = assignments.filter(a => a.status === 'in_progress').length;

        return {
            total,
            completed,
            overdue,
            inProgress,
            pending: total - completed - inProgress,
            completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.AssignmentService = AssignmentService;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AssignmentService;
}
