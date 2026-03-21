/**
 * Teacher Service - Student roster and practice data management
 * Uses IndexedDB for persistent storage of student records and practice logs
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
     * Add a new student to the roster
     */
    async addStudent(studentData) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

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
            const request = store.add(student);

            request.onsuccess = () => {
                this._notifyUpdate();
                resolve(student);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all students
     */
    async getAllStudents() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['students'], 'readonly');
            const store = transaction.objectStore('students');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a single student by ID
     */
    async getStudent(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['students'], 'readonly');
            const store = transaction.objectStore('students');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update student data
     */
    async updateStudent(id, updates) {
        return new Promise(async (resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            try {
                const student = await this.getStudent(id);
                if (!student) {
                    reject(new Error('Student not found'));
                    return;
                }

                const updated = { ...student, ...updates, id: student.id };

                const transaction = this.db.transaction(['students'], 'readwrite');
                const store = transaction.objectStore('students');
                const request = store.put(updated);

                request.onsuccess = () => {
                    this._notifyUpdate();
                    resolve(updated);
                };
                request.onerror = () => reject(request.error);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Remove a student from the roster
     */
    async removeStudent(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['students'], 'readwrite');
            const store = transaction.objectStore('students');
            const request = store.delete(id);

            request.onsuccess = () => {
                this._notifyUpdate();
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Log a practice session for a student
     */
    async logPracticeSession(studentId, sessionData) {
        return new Promise(async (resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const log = {
                id: typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                studentId,
                date: Date.now(),
                durationMs: sessionData.durationMs || 0,
                piece: sessionData.piece || '',
                intonationScore: sessionData.intonationScore || null,
                pitchScore: sessionData.pitchScore || null,
                rhythmScore: sessionData.rhythmScore || null,
                notes: sessionData.notes || ''
            };

            try {
                const transaction = this.db.transaction(['practiceLogs'], 'readwrite');
                const store = transaction.objectStore('practiceLogs');
                const request = store.add(log);

                request.onsuccess = async () => {
                    // Update student aggregate data
                    await this._updateStudentAggregates(studentId, log);
                    resolve(log);
                };
                request.onerror = () => reject(request.error);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Get practice logs for a student
     */
    async getStudentLogs(studentId) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['practiceLogs'], 'readonly');
            const store = transaction.objectStore('practiceLogs');
            const index = store.index('studentId');
            const request = index.getAll(studentId);

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
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
                studentsWithSessions: 0,
                topPracticers: [],
                needsAttention: []
            };
        }

        const totalWeeklyPracticeMs = students.reduce((sum, s) => sum + (s.weeklyPracticeTimeMs || 0), 0);

        const studentsWithScores = students.filter(s => s.averageIntonationScore !== null);
        const averageIntonation = studentsWithScores.length > 0
            ? studentsWithScores.reduce((sum, s) => sum + s.averageIntonationScore, 0) / studentsWithScores.length
            : null;

        const studentsWithSessions = students.filter(s => s.lastSessionAt !== null).length;

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
            studentsWithSessions,
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
                totalPracticeTimeMs: (student.totalPracticeTimeMs || 0) + (log.durationMs || 0)
            };

            // Update weekly practice time
            const weekStart = this._getWeekStart();
            if (student.weekStartTimestamp !== weekStart) {
                // New week, reset weekly counter
                updates.weeklyPracticeTimeMs = log.durationMs || 0;
                updates.weekStartTimestamp = weekStart;
            } else {
                updates.weeklyPracticeTimeMs = (student.weeklyPracticeTimeMs || 0) + (log.durationMs || 0);
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
