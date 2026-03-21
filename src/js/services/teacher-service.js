/**
 * Teacher Service - Student roster and practice data management
 * Uses IndexedDB for persistent storage of student records and practice logs.
 * This is the primary data layer (client-side). The server routes in
 * src/routes/teacher.js provide a REST API stub for future backend migration.
 */

class TeacherService {
    constructor() {
        this.dbName = 'ConcertmasterStudio';
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

                // Students object store
                if (!db.objectStoreNames.contains('students')) {
                    const studentsStore = db.createObjectStore('students', { keyPath: 'id' });
                    studentsStore.createIndex('name', 'name', { unique: false });
                    studentsStore.createIndex('instrument', 'instrument', { unique: false });
                    studentsStore.createIndex('addedAt', 'addedAt', { unique: false });
                }

                // Practice logs object store (per student)
                if (!db.objectStoreNames.contains('practiceLogs')) {
                    const logsStore = db.createObjectStore('practiceLogs', { keyPath: 'id' });
                    logsStore.createIndex('studentId', 'studentId', { unique: false });
                    logsStore.createIndex('date', 'date', { unique: false });
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
     * Add a new student to the roster
     */
    async addStudent(studentData) {
        if (!this.db) throw new Error('Database not initialized');

        const student = {
            id: typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : 'student-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            name: studentData.name,
            instrument: studentData.instrument || 'violin',
            level: studentData.level || 'beginner',
            assignedPiece: studentData.assignedPiece || '',
            email: studentData.email || '',
            notes: studentData.notes || '',
            addedAt: Date.now(),
            lastSessionAt: null,
            totalPracticeTimeMs: 0,
            averageIntonationScore: null,
            weeklyPracticeTimeMs: 0,
            weekStartTimestamp: this._getWeekStart()
        };

        const transaction = this.db.transaction(['students'], 'readwrite');
        const store = transaction.objectStore('students');
        await this._promisifyRequest(store.add(student));
        this._notifyUpdate();
        return student;
    }

    /**
     * Get all students
     */
    async getAllStudents() {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['students'], 'readonly');
        const store = transaction.objectStore('students');
        const result = await this._promisifyRequest(store.getAll());
        return result || [];
    }

    /**
     * Get a single student by ID
     */
    async getStudent(id) {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['students'], 'readonly');
        const store = transaction.objectStore('students');
        const result = await this._promisifyRequest(store.get(id));
        return result || null;
    }

    /**
     * Update student data
     */
    async updateStudent(id, updates) {
        if (!this.db) throw new Error('Database not initialized');

        const student = await this.getStudent(id);
        if (!student) throw new Error('Student not found');

        const updated = { ...student, ...updates, id: student.id };

        const transaction = this.db.transaction(['students'], 'readwrite');
        const store = transaction.objectStore('students');
        await this._promisifyRequest(store.put(updated));
        this._notifyUpdate();
        return updated;
    }

    /**
     * Remove a student and their practice logs from the roster
     */
    async removeStudent(id) {
        if (!this.db) throw new Error('Database not initialized');

        // Delete student record
        const studentTx = this.db.transaction(['students'], 'readwrite');
        const studentStore = studentTx.objectStore('students');
        await this._promisifyRequest(studentStore.delete(id));

        // Delete orphaned practice logs for this student
        try {
            const logsTx = this.db.transaction(['practiceLogs'], 'readwrite');
            const logsStore = logsTx.objectStore('practiceLogs');
            const index = logsStore.index('studentId');
            const logs = await this._promisifyRequest(index.getAll(id));
            if (logs && logs.length > 0) {
                const deleteTx = this.db.transaction(['practiceLogs'], 'readwrite');
                const deleteStore = deleteTx.objectStore('practiceLogs');
                for (const log of logs) {
                    deleteStore.delete(log.id);
                }
            }
        } catch (err) {
            console.warn('Failed to clean up practice logs for student:', err);
        }

        this._notifyUpdate();
    }

    /**
     * Log a practice session for a student
     */
    async logPracticeSession(studentId, sessionData) {
        if (!this.db) throw new Error('Database not initialized');

        const log = {
            id: typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            studentId,
            date: Date.now(),
            durationMs: sessionData.durationMs ?? 0,
            piece: sessionData.piece || '',
            intonationScore: sessionData.intonationScore ?? null,
            pitchScore: sessionData.pitchScore ?? null,
            rhythmScore: sessionData.rhythmScore ?? null,
            notes: sessionData.notes || ''
        };

        const transaction = this.db.transaction(['practiceLogs'], 'readwrite');
        const store = transaction.objectStore('practiceLogs');
        await this._promisifyRequest(store.add(log));

        // Update student aggregate data
        await this._updateStudentAggregates(studentId, log);
        return log;
    }

    /**
     * Get practice logs for a student
     */
    async getStudentLogs(studentId) {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['practiceLogs'], 'readonly');
        const store = transaction.objectStore('practiceLogs');
        const index = store.index('studentId');
        const result = await this._promisifyRequest(index.getAll(studentId));
        return result || [];
    }

    /**
     * Search students by name
     */
    searchStudents(students, query) {
        if (!query || query.trim() === '') return students;
        const lower = query.toLowerCase().trim();
        return students.filter(s =>
            s.name.toLowerCase().includes(lower) ||
            s.instrument.toLowerCase().includes(lower) ||
            (s.assignedPiece && s.assignedPiece.toLowerCase().includes(lower))
        );
    }

    /**
     * Sort students by a given field
     */
    sortStudents(students, sortBy, ascending = true) {
        const sorted = [...students];
        sorted.sort((a, b) => {
            let valA, valB;
            switch (sortBy) {
                case 'name':
                    valA = (a.name || '').toLowerCase();
                    valB = (b.name || '').toLowerCase();
                    return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'practiceTime':
                    valA = a.weeklyPracticeTimeMs || 0;
                    valB = b.weeklyPracticeTimeMs || 0;
                    break;
                case 'intonation':
                    valA = a.averageIntonationScore ?? -1;
                    valB = b.averageIntonationScore ?? -1;
                    break;
                case 'lastSession':
                    valA = a.lastSessionAt || 0;
                    valB = b.lastSessionAt || 0;
                    break;
                case 'instrument':
                    valA = (a.instrument || '').toLowerCase();
                    valB = (b.instrument || '').toLowerCase();
                    return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
                default:
                    valA = a.addedAt || 0;
                    valB = b.addedAt || 0;
            }
            return ascending ? valA - valB : valB - valA;
        });
        return sorted;
    }

    /**
     * Get dashboard metrics across all students
     */
    getDashboardMetrics(students) {
        if (!students || students.length === 0) {
            return {
                totalStudents: 0,
                totalWeeklyPracticeMs: 0,
                averageIntonation: null,
                studentsActiveThisWeek: 0,
                topPracticers: [],
                needsAttention: []
            };
        }

        const totalWeeklyPracticeMs = students.reduce((sum, s) => sum + (s.weeklyPracticeTimeMs || 0), 0);

        const studentsWithScores = students.filter(s => s.averageIntonationScore !== null);
        const averageIntonation = studentsWithScores.length > 0
            ? studentsWithScores.reduce((sum, s) => sum + s.averageIntonationScore, 0) / studentsWithScores.length
            : null;

        // Count students who have actually practiced this week
        const weekStart = this._getWeekStart();
        const studentsActiveThisWeek = students.filter(s =>
            s.lastSessionAt !== null && s.lastSessionAt >= weekStart
        ).length;

        // Top 3 practicers this week
        const topPracticers = [...students]
            .sort((a, b) => (b.weeklyPracticeTimeMs || 0) - (a.weeklyPracticeTimeMs || 0))
            .slice(0, 3);

        // Students who haven't practiced in 7 days
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const needsAttention = students.filter(s =>
            !s.lastSessionAt || s.lastSessionAt < oneWeekAgo
        );

        return {
            totalStudents: students.length,
            totalWeeklyPracticeMs,
            averageIntonation,
            studentsActiveThisWeek,
            topPracticers,
            needsAttention
        };
    }

    /**
     * Get intonation emoji based on score
     */
    getIntonationEmoji(score) {
        if (score === null || score === undefined) return { icon: '—', label: 'No data' };
        if (score >= 90) return { icon: '★', label: 'Excellent' };
        if (score >= 75) return { icon: '◆', label: 'Good' };
        if (score >= 60) return { icon: '●', label: 'Fair' };
        if (score >= 40) return { icon: '▲', label: 'Needs work' };
        return { icon: '▼', label: 'Struggling' };
    }

    /**
     * Format practice time for display
     */
    formatPracticeTime(ms) {
        if (!ms || ms <= 0) return '0m';
        const totalMinutes = Math.floor(ms / 60000);
        if (totalMinutes < 60) return `${totalMinutes}m`;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }

    /**
     * Update aggregated student data after a practice log
     */
    async _updateStudentAggregates(studentId, log) {
        try {
            const student = await this.getStudent(studentId);
            if (!student) return;

            const updates = {
                lastSessionAt: log.date,
                totalPracticeTimeMs: (student.totalPracticeTimeMs || 0) + (log.durationMs ?? 0)
            };

            // Update weekly practice time
            const weekStart = this._getWeekStart();
            if (student.weekStartTimestamp !== weekStart) {
                // New week, reset weekly counter
                updates.weeklyPracticeTimeMs = log.durationMs ?? 0;
                updates.weekStartTimestamp = weekStart;
            } else {
                updates.weeklyPracticeTimeMs = (student.weeklyPracticeTimeMs || 0) + (log.durationMs ?? 0);
            }

            // Update rolling average intonation score
            if (log.intonationScore !== null && log.intonationScore !== undefined) {
                if (student.averageIntonationScore === null) {
                    updates.averageIntonationScore = log.intonationScore;
                } else {
                    // Exponential moving average (weight recent sessions more)
                    updates.averageIntonationScore = Math.round(
                        student.averageIntonationScore * 0.7 + log.intonationScore * 0.3
                    );
                }
            }

            await this.updateStudent(studentId, updates);
        } catch (err) {
            console.warn('Failed to update student aggregates:', err);
        }
    }

    /**
     * Get the start of the current week (Monday at midnight)
     */
    _getWeekStart() {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(now.getFullYear(), now.getMonth(), diff);
        weekStart.setHours(0, 0, 0, 0);
        return weekStart.getTime();
    }

    _notifyUpdate() {
        if (typeof this.onUpdate === 'function') {
            this.onUpdate();
        }
    }
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TeacherService;
} else if (typeof window !== 'undefined') {
    window.TeacherService = TeacherService;
}
