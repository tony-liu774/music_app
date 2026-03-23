/**
 * Assignment Service - Smart Assignments & Routine Builder
 * Manages teacher-created assignments for students with due dates,
 * measure ranges, and practice targets. Uses IndexedDB for storage.
 */

class AssignmentService {
    constructor() {
        this.dbName = 'ConcertmasterAssignments';
        this.dbVersion = 1;
        this.db = null;
        this.onUpdate = null;
    }

    /**
     * Initialize the IndexedDB database
     */
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

                // Assignments object store
                if (!db.objectStoreNames.contains('assignments')) {
                    const assignmentsStore = db.createObjectStore('assignments', { keyPath: 'id' });
                    assignmentsStore.createIndex('teacherId', 'teacherId', { unique: false });
                    assignmentsStore.createIndex('studentId', 'studentId', { unique: false });
                    assignmentsStore.createIndex('dueDate', 'dueDate', { unique: false });
                    assignmentsStore.createIndex('createdAt', 'createdAt', { unique: false });
                    assignmentsStore.createIndex('status', 'status', { unique: false });
                }

                // Student link store (teacher -> student mappings)
                if (!db.objectStoreNames.contains('studentLinks')) {
                    const linksStore = db.createObjectStore('studentLinks', { keyPath: 'id' });
                    linksStore.createIndex('teacherId', 'teacherId', { unique: false });
                    linksStore.createIndex('studentId', 'studentId', { unique: false });
                }

                // Assignment progress store
                if (!db.objectStoreNames.contains('assignmentProgress')) {
                    const progressStore = db.createObjectStore('assignmentProgress', { keyPath: 'id' });
                    progressStore.createIndex('assignmentId', 'assignmentId', { unique: false });
                    progressStore.createIndex('studentId', 'studentId', { unique: false });
                }
            };
        });
    }

    /**
     * Helper: wrap an IndexedDB request in a promise
     */
    _promisifyRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Generate a unique ID
     */
    _generateId(prefix) {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Link a student to a teacher
     */
    async linkStudentToTeacher(teacherId, studentId, studentEmail = '', studentName = '') {
        if (!this.db) throw new Error('Database not initialized');

        const link = {
            id: this._generateId('link'),
            teacherId,
            studentId,
            studentEmail,
            studentName,
            linkedAt: Date.now()
        };

        const transaction = this.db.transaction(['studentLinks'], 'readwrite');
        const store = transaction.objectStore('studentLinks');
        await this._promisifyRequest(store.add(link));
        this._notifyUpdate();
        return link;
    }

    /**
     * Get all students linked to a teacher
     */
    async getTeacherStudents(teacherId) {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['studentLinks'], 'readonly');
        const store = transaction.objectStore('studentLinks');
        const index = store.index('teacherId');
        const result = await this._promisifyRequest(index.getAll(teacherId));
        return result || [];
    }

    /**
     * Remove a student link
     */
    async removeStudentLink(linkId) {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['studentLinks'], 'readwrite');
        const store = transaction.objectStore('studentLinks');
        await this._promisifyRequest(store.delete(linkId));
        this._notifyUpdate();
    }

    /**
     * Create a new assignment
     */
    async createAssignment(assignmentData) {
        if (!this.db) throw new Error('Database not initialized');

        const assignment = {
            id: this._generateId('asgn'),
            teacherId: assignmentData.teacherId,
            studentId: assignmentData.studentId,
            pieceId: assignmentData.pieceId || '',
            pieceTitle: assignmentData.pieceTitle || 'Untitled Piece',
            composer: assignmentData.composer || '',
            // Measure range (e.g., "14-32")
            measureStart: assignmentData.measureStart || 1,
            measureEnd: assignmentData.measureEnd || null,
            // Practice targets
            targetTempo: assignmentData.targetTempo || null, // e.g., 80 BPM
            targetIntonation: assignmentData.targetIntonation || null, // e.g., 90%
            targetAccuracy: assignmentData.targetAccuracy || null, // e.g., 85%
            // Assignment details
            title: assignmentData.title || '',
            description: assignmentData.description || '',
            // Due date
            dueDate: assignmentData.dueDate || null, // timestamp or null
            // Status tracking
            status: 'assigned', // assigned, in_progress, completed, overdue
            priority: assignmentData.priority || 'normal', // low, normal, high
            // Timestamps
            createdAt: Date.now(),
            updatedAt: Date.now(),
            assignedAt: Date.now(),
            completedAt: null
        };

        const transaction = this.db.transaction(['assignments'], 'readwrite');
        const store = transaction.objectStore('assignments');
        await this._promisifyRequest(store.add(assignment));
        this._notifyUpdate();
        return assignment;
    }

    /**
     * Get all assignments for a teacher
     */
    async getTeacherAssignments(teacherId) {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['assignments'], 'readonly');
        const store = transaction.objectStore('assignments');
        const index = store.index('teacherId');
        const result = await this._promisifyRequest(index.getAll(teacherId));
        return this._sortAssignments(result || []);
    }

    /**
     * Get all assignments for a student
     */
    async getStudentAssignments(studentId) {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['assignments'], 'readonly');
        const store = transaction.objectStore('assignments');
        const index = store.index('studentId');
        const result = await this._promisifyRequest(index.getAll(studentId));
        return this._sortAssignments(result || []);
    }

    /**
     * Get assignments due soon (within days)
     */
    async getUpcomingAssignments(studentId, days = 7) {
        const assignments = await this.getStudentAssignments(studentId);
        const now = Date.now();
        const futureDate = now + (days * 24 * 60 * 60 * 1000);

        return assignments.filter(a => {
            if (a.status === 'completed') return false;
            if (!a.dueDate) return true; // No due date = always available
            return a.dueDate >= now && a.dueDate <= futureDate;
        });
    }

    /**
     * Get the next assignment for a student (Up Next)
     */
    async getNextAssignment(studentId) {
        const assignments = await this.getStudentAssignments(studentId);
        const now = Date.now();

        // Priority order: overdue first, then by due date, then by created date
        const active = assignments.filter(a => a.status !== 'completed');

        if (active.length === 0) return null;

        // Sort: overdue first, then by due date, then by priority
        active.sort((a, b) => {
            const aOverdue = a.dueDate && a.dueDate < now && a.status !== 'completed';
            const bOverdue = b.dueDate && b.dueDate < now && b.status !== 'completed';

            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;

            if (a.dueDate && b.dueDate) {
                return a.dueDate - b.dueDate;
            }
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;

            // Sort by priority
            const priorityOrder = { high: 0, normal: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        return active[0];
    }

    /**
     * Get a single assignment by ID
     */
    async getAssignment(id) {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['assignments'], 'readonly');
        const store = transaction.objectStore('assignments');
        const result = await this._promisifyRequest(store.get(id));
        return result || null;
    }

    /**
     * Update an assignment
     */
    async updateAssignment(id, updates) {
        if (!this.db) throw new Error('Database not initialized');

        const assignment = await this.getAssignment(id);
        if (!assignment) throw new Error('Assignment not found');

        const allowedFields = [
            'title', 'description', 'measureStart', 'measureEnd',
            'targetTempo', 'targetIntonation', 'targetAccuracy',
            'dueDate', 'status', 'priority', 'pieceId', 'pieceTitle'
        ];

        const sanitized = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                sanitized[field] = updates[field];
            }
        }

        const updated = {
            ...assignment,
            ...sanitized,
            id: assignment.id,
            updatedAt: Date.now()
        };

        if (updates.status === 'completed' && !assignment.completedAt) {
            updated.completedAt = Date.now();
        }

        const transaction = this.db.transaction(['assignments'], 'readwrite');
        const store = transaction.objectStore('assignments');
        await this._promisifyRequest(store.put(updated));
        this._notifyUpdate();
        return updated;
    }

    /**
     * Update assignment status
     */
    async updateStatus(id, status) {
        return this.updateAssignment(id, { status });
    }

    /**
     * Delete an assignment
     */
    async deleteAssignment(id) {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['assignments', 'assignmentProgress'], 'readwrite');

        // Delete assignment
        const assignmentStore = transaction.objectStore('assignments');
        await this._promisifyRequest(assignmentStore.delete(id));

        // Delete related progress records
        const progressStore = transaction.objectStore('assignmentProgress');
        const progressIndex = progressStore.index('assignmentId');
        const progressRecords = await this._promisifyRequest(progressIndex.getAll(id));
        for (const record of progressRecords) {
            progressStore.delete(record.id);
        }

        this._notifyUpdate();
    }

    /**
     * Record progress for an assignment
     */
    async recordProgress(assignmentId, studentId, progressData) {
        if (!this.db) throw new Error('Database not initialized');

        const progress = {
            id: this._generateId('prog'),
            assignmentId,
            studentId,
            recordedAt: Date.now(),
            // Practice metrics at time of recording
            tempoAchieved: progressData.tempoAchieved || null,
            intonationScore: progressData.intonationScore || null,
            accuracyScore: progressData.accuracyScore || null,
            practiceDurationMs: progressData.practiceDurationMs || 0,
            notes: progressData.notes || ''
        };

        const transaction = this.db.transaction(['assignmentProgress'], 'readwrite');
        const store = transaction.objectStore('assignmentProgress');
        await this._promisifyRequest(store.add(progress));

        // Check if targets are met and update status
        await this._checkTargetCompletion(assignmentId, progressData);

        this._notifyUpdate();
        return progress;
    }

    /**
     * Get progress history for an assignment
     */
    async getAssignmentProgress(assignmentId) {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['assignmentProgress'], 'readonly');
        const store = transaction.objectStore('assignmentProgress');
        const index = store.index('assignmentId');
        const result = await this._promisifyRequest(index.getAll(assignmentId));
        return result || [];
    }

    /**
     * Get the latest progress for an assignment
     */
    async getLatestProgress(assignmentId) {
        const progressList = await this.getAssignmentProgress(assignmentId);
        if (progressList.length === 0) return null;

        return progressList.reduce((latest, p) =>
            p.recordedAt > latest.recordedAt ? p : latest
        );
    }

    /**
     * Check if assignment targets are met
     */
    async _checkTargetCompletion(assignmentId, progressData) {
        const assignment = await this.getAssignment(assignmentId);
        if (!assignment) return;

        let allTargetsMet = true;

        if (assignment.targetTempo && progressData.tempoAchieved) {
            if (progressData.tempoAchieved < assignment.targetTempo) {
                allTargetsMet = false;
            }
        }

        if (assignment.targetIntonation && progressData.intonationScore !== null) {
            if (progressData.intonationScore < assignment.targetIntonation) {
                allTargetsMet = false;
            }
        }

        if (assignment.targetAccuracy && progressData.accuracyScore !== null) {
            if (progressData.accuracyScore < assignment.targetAccuracy) {
                allTargetsMet = false;
            }
        }

        if (allTargetsMet && (assignment.status === 'assigned' || assignment.status === 'in_progress')) {
            await this.updateAssignment(assignmentId, { status: 'completed' });
        }
    }

    /**
     * Sort assignments by due date and status
     */
    _sortAssignments(assignments) {
        const now = Date.now();

        return [...assignments].sort((a, b) => {
            // Completed always last
            if (a.status === 'completed' && b.status !== 'completed') return 1;
            if (a.status !== 'completed' && b.status === 'completed') return -1;

            // Overdue before non-overdue
            const aOverdue = a.dueDate && a.dueDate < now && a.status !== 'completed';
            const bOverdue = b.dueDate && b.dueDate < now && b.status !== 'completed';
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;

            // Then by due date
            if (a.dueDate && b.dueDate) {
                return a.dueDate - b.dueDate;
            }
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;

            // Then by created date
            return b.createdAt - a.createdAt;
        });
    }

    /**
     * Get assignment statistics for a teacher
     */
    async getTeacherStats(teacherId) {
        const assignments = await this.getTeacherAssignments(teacherId);
        const now = Date.now();

        const stats = {
            total: assignments.length,
            assigned: assignments.filter(a => a.status === 'assigned').length,
            inProgress: assignments.filter(a => a.status === 'in_progress').length,
            completed: assignments.filter(a => a.status === 'completed').length,
            overdue: assignments.filter(a =>
                a.dueDate && a.dueDate < now && a.status !== 'completed'
            ).length,
            dueSoon: assignments.filter(a => {
                if (!a.dueDate || a.status === 'completed') return false;
                const threeDays = 3 * 24 * 60 * 60 * 1000;
                return a.dueDate >= now && a.dueDate <= now + threeDays;
            }).length
        };

        return stats;
    }

    /**
     * Get assignment statistics for a student
     */
    async getStudentStats(studentId) {
        const assignments = await this.getStudentAssignments(studentId);
        const now = Date.now();

        const stats = {
            total: assignments.length,
            assigned: assignments.filter(a => a.status === 'assigned').length,
            inProgress: assignments.filter(a => a.status === 'in_progress').length,
            completed: assignments.filter(a => a.status === 'completed').length,
            overdue: assignments.filter(a =>
                a.dueDate && a.dueDate < now && a.status !== 'completed'
            ).length
        };

        return stats;
    }

    /**
     * Format due date for display
     */
    formatDueDate(timestamp) {
        if (!timestamp) return 'No due date';

        const now = Date.now();
        const diff = timestamp - now;
        const days = Math.ceil(diff / (24 * 60 * 60 * 1000));

        if (days < 0) {
            const overdueDays = Math.abs(days);
            if (overdueDays === 1) return 'Overdue by 1 day';
            return `Overdue by ${overdueDays} days`;
        }

        if (days === 0) return 'Due today';
        if (days === 1) return 'Due tomorrow';
        if (days <= 7) return `Due in ${days} days`;

        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    /**
     * Get measure range string
     */
    getMeasureRange(assignment) {
        if (assignment.measureEnd) {
            return `Measures ${assignment.measureStart}-${assignment.measureEnd}`;
        }
        return `Measure ${assignment.measureStart}+`;
    }

    /**
     * Get target summary string
     */
    getTargetSummary(assignment) {
        const targets = [];

        if (assignment.targetTempo) {
            targets.push(`${assignment.targetTempo} BPM`);
        }

        if (assignment.targetIntonation) {
            targets.push(`${assignment.targetIntonation}% Intonation`);
        }

        if (assignment.targetAccuracy) {
            targets.push(`${assignment.targetAccuracy}% Accuracy`);
        }

        if (targets.length === 0) return 'Practice targets not set';
        return targets.join(' + ');
    }

    _notifyUpdate() {
        if (typeof this.onUpdate === 'function') {
            this.onUpdate();
        }
    }
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AssignmentService;
} else if (typeof window !== 'undefined') {
    window.AssignmentService = AssignmentService;
}
