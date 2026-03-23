/**
 * Heat Map History Service - Stores and retrieves weekly practice heat maps
 * Integrates with SessionLogger for post-session data and TeacherService for student access
 */

class HeatMapHistoryService {
    constructor() {
        this.dbName = 'ConcertmasterHeatMaps';
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

                // Weekly heat maps object store
                if (!db.objectStoreNames.contains('weeklyHeatMaps')) {
                    const store = db.createObjectStore('weeklyHeatMaps', { keyPath: 'id' });
                    store.createIndex('studentId', 'studentId', { unique: false });
                    store.createIndex('weekStart', 'weekStart', { unique: false });
                    store.createIndex('scoreId', 'scoreId', { unique: false });
                    store.createIndex('studentWeek', 'studentId_weekStart', { unique: false });
                }

                // Practice sessions with measure-level data
                if (!db.objectStoreNames.contains('practiceSessions')) {
                    const store = db.createObjectStore('practiceSessions', { keyPath: 'id' });
                    store.createIndex('studentId', 'studentId', { unique: false });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('scoreId', 'scoreId', { unique: false });
                    store.createIndex('studentDate', 'studentId_date', { unique: false });
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
     * Get the start of a week (Monday at midnight)
     * @param {number|Date} date - Date to get week start for (defaults to now)
     * @returns {number} Unix timestamp for week start
     */
    _getWeekStart(date = new Date()) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(d.getFullYear(), d.getMonth(), diff);
        weekStart.setHours(0, 0, 0, 0);
        return weekStart.getTime();
    }

    /**
     * Save a practice session with full measure-level data
     * @param {string} studentId - Student ID
     * @param {Object} sessionData - Session data from SessionLogger
     */
    async savePracticeSession(studentId, sessionData) {
        if (!this.db) throw new Error('Database not initialized');

        // Validate inputs
        if (!studentId || typeof studentId !== 'string') {
            throw new Error('Invalid studentId: must be a non-empty string');
        }
        if (studentId.length > 100) {
            throw new Error('Invalid studentId: too long');
        }
        if (!sessionData || typeof sessionData !== 'object') {
            throw new Error('Invalid sessionData: must be an object');
        }

        const session = {
            id: typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            studentId,
            scoreId: sessionData.scoreId || sessionData.session_id || 'unknown',
            pieceName: sessionData.pieceName || '',
            date: Date.now(),
            weekStart: this._getWeekStart(),
            durationMs: sessionData.duration_ms || 0,
            totalDeviations: sessionData.total_deviations || 0,
            pitchDeviations: sessionData.pitch_deviations || 0,
            rhythmDeviations: sessionData.rhythm_deviations || 0,
            intonationDeviations: sessionData.intonation_deviations || 0,
            // Measure-level data for heat map
            measureData: this._extractMeasureData(sessionData),
            // Summary stats
            averagePitchDeviation: sessionData.average_pitch_deviation_cents || 0,
            averageRhythmDeviation: sessionData.average_rhythm_deviation_ms || 0,
            problemMeasures: sessionData.problem_measures || [],
            // Full deviations for detailed analysis (limited to last 100)
            deviations: (sessionData.deviations || []).slice(-100)
        };

        const transaction = this.db.transaction(['practiceSessions'], 'readwrite');
        const store = transaction.objectStore('practiceSessions');
        await this._promisifyRequest(store.add(session));

        // Update weekly heat map
        await this._updateWeeklyHeatMap(studentId, session.weekStart);

        this._notifyUpdate();
        return session;
    }

    /**
     * Extract measure-level data from session deviations
     */
    _extractMeasureData(sessionData) {
        const measures = {};
        const deviations = sessionData.deviations || [];

        for (const dev of deviations) {
            const measure = dev.measure || 1;
            if (!measures[measure]) {
                measures[measure] = {
                    measure,
                    pitchErrors: 0,
                    rhythmErrors: 0,
                    intonationErrors: 0,
                    totalNotes: 0
                };
            }

            if (dev.type === 'pitch') {
                measures[measure].pitchErrors++;
                measures[measure].totalNotes++;
            } else if (dev.type === 'rhythm') {
                measures[measure].rhythmErrors++;
                measures[measure].totalNotes++;
            } else if (dev.type === 'intonation') {
                // Intonation errors track transition quality, not note accuracy
                // They're tracked separately but don't affect note count
                measures[measure].intonationErrors++;
            }
        }

        // Calculate accuracy score per measure
        // Note: Intonation errors are tracked separately but not included in
        // totalErrors for accuracy calculation since they represent note
        // transitions, not individual note errors
        return Object.values(measures).map(m => ({
            measure: m.measure,
            pitchErrors: m.pitchErrors,
            rhythmErrors: m.rhythmErrors,
            intonationErrors: m.intonationErrors,
            // Total errors for accuracy = pitch + rhythm only (intonation is separate)
            totalErrors: m.pitchErrors + m.rhythmErrors,
            totalNotes: m.totalNotes,
            // Accuracy: 100 - (errors / notes * 100), min 0
            accuracy: m.totalNotes > 0
                ? Math.max(0, 100 - (m.totalErrors / m.totalNotes * 100))
                : 100
        }));
    }

    /**
     * Update or create weekly heat map
     */
    async _updateWeeklyHeatMap(studentId, weekStart) {
        if (!this.db) return;

        // Get all sessions for this student this week
        const sessions = await this.getSessionsForWeek(studentId, weekStart);

        if (sessions.length === 0) return;

        // Aggregate measure data across all sessions
        const measureAggregates = {};
        let totalPracticeTime = 0;
        let totalDeviations = 0;
        let sessionCount = sessions.length;
        const piecesPracticed = new Set();

        for (const session of sessions) {
            totalPracticeTime += session.durationMs || 0;
            totalDeviations += session.totalDeviations || 0;
            if (session.pieceName) piecesPracticed.add(session.pieceName);

            for (const m of session.measureData || []) {
                if (!measureAggregates[m.measure]) {
                    measureAggregates[m.measure] = {
                        measure: m.measure,
                        pitchErrors: 0,
                        rhythmErrors: 0,
                        intonationErrors: 0,
                        totalSessions: 0,
                        totalNotes: 0,
                        accuracySum: 0
                };
                }
                measureAggregates[m.measure].pitchErrors += m.pitchErrors;
                measureAggregates[m.measure].rhythmErrors += m.rhythmErrors;
                measureAggregates[m.measure].intonationErrors += m.intonationErrors;
                measureAggregates[m.measure].totalSessions++;
                measureAggregates[m.measure].totalNotes += m.totalNotes;
                measureAggregates[m.measure].accuracySum += m.accuracy;
            }
        }

        // Calculate average accuracy per measure
        const measureHeatMap = Object.values(measureAggregates).map(m => ({
            measure: m.measure,
            averageAccuracy: m.totalSessions > 0 ? Math.round(m.accuracySum / m.totalSessions) : 100,
            totalPitchErrors: m.pitchErrors,
            totalRhythmErrors: m.rhythmErrors,
            totalIntonationErrors: m.intonationErrors,
            totalErrors: m.pitchErrors + m.rhythmErrors + m.intonationErrors,
            practiceCount: m.totalSessions
        })).sort((a, b) => a.measure - b.measure);

        // Identify neglected sections (low practice count)
        const maxPracticeCount = Math.max(...measureHeatMap.map(m => m.practiceCount), 1);
        const neglectedSections = measureHeatMap.filter(m =>
            m.practiceCount < maxPracticeCount * 0.3 && m.practiceCount > 0
        ).map(m => m.measure);

        // Identify problem areas (low accuracy)
        const problemAreas = measureHeatMap
            .filter(m => m.averageAccuracy < 70)
            .sort((a, b) => a.averageAccuracy - b.averageAccuracy)
            .slice(0, 5)
            .map(m => ({ measure: m.measure, accuracy: m.averageAccuracy }));

        // Get unique scores practiced
        const scoresPracticed = [...new Set(sessions.map(s => s.scoreId))];

        const heatMap = {
            id: `${studentId}_${weekStart}`,
            studentId,
            weekStart,
            weekEnd: weekStart + 7 * 24 * 60 * 60 * 1000 - 1,
            sessionCount,
            totalPracticeTimeMs: totalPracticeTime,
            totalDeviations,
            piecesPracticed: Array.from(piecesPracticed),
            scoresPracticed,
            measureHeatMap,
            neglectedSections,
            problemAreas,
            averageAccuracy: measureHeatMap.length > 0
                ? Math.round(measureHeatMap.reduce((sum, m) => sum + m.averageAccuracy, 0) / measureHeatMap.length)
                : null,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        const transaction = this.db.transaction(['weeklyHeatMaps'], 'readwrite');
        const store = transaction.objectStore('weeklyHeatMaps');
        await this._promisifyRequest(store.put(heatMap));

        return heatMap;
    }

    /**
     * Get sessions for a specific student and week
     */
    async getSessionsForWeek(studentId, weekStart) {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['practiceSessions'], 'readonly');
        const store = transaction.objectStore('practiceSessions');
        const index = store.index('studentId');
        const allSessions = await this._promisifyRequest(index.getAll(studentId));

        return (allSessions || []).filter(s => s.weekStart === weekStart);
    }

    /**
     * Get weekly heat map for a student
     */
    async getWeeklyHeatMap(studentId, weekStart) {
        if (!this.db) throw new Error('Database not initialized');

        const id = `${studentId}_${weekStart}`;
        const transaction = this.db.transaction(['weeklyHeatMaps'], 'readonly');
        const store = transaction.objectStore('weeklyHeatMaps');
        return await this._promisifyRequest(store.get(id));
    }

    /**
     * Get heat maps for a date range
     */
    async getHeatMapsInRange(studentId, startDate, endDate) {
        if (!this.db) throw new Error('Database not initialized');

        const start = this._getWeekStart(new Date(startDate));
        const end = this._getWeekStart(new Date(endDate));

        const transaction = this.db.transaction(['weeklyHeatMaps'], 'readonly');
        const store = transaction.objectStore('weeklyHeatMaps');
        const index = store.index('studentId');
        const allHeatMaps = await this._promisifyRequest(index.getAll(studentId));

        return (allHeatMaps || []).filter(h =>
            h.weekStart >= start && h.weekStart <= end
        ).sort((a, b) => a.weekStart - b.weekStart);
    }

    /**
     * Get all weekly heat maps for a student
     */
    async getAllHeatMaps(studentId) {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['weeklyHeatMaps'], 'readonly');
        const store = transaction.objectStore('weeklyHeatMaps');
        const index = store.index('studentId');
        const result = await this._promisifyRequest(index.getAll(studentId));
        return (result || []).sort((a, b) => b.weekStart - a.weekStart);
    }

    /**
     * Get practice sessions for a student in a date range
     */
    async getSessionsInRange(studentId, startDate, endDate) {
        if (!this.db) throw new Error('Database not initialized');

        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();

        const transaction = this.db.transaction(['practiceSessions'], 'readonly');
        const store = transaction.objectStore('practiceSessions');
        const index = store.index('studentId');
        const allSessions = await this._promisifyRequest(index.getAll(studentId));

        return (allSessions || []).filter(s =>
            s.date >= start && s.date <= end
        ).sort((a, b) => a.date - b.date);
    }

    /**
     * Compare heat maps across multiple weeks
     */
    async compareWeeks(studentId, weekStarts) {
        const heatMaps = [];
        for (const weekStart of weekStarts) {
            const hm = await this.getWeeklyHeatMap(studentId, weekStart);
            if (hm) heatMaps.push(hm);
        }
        return heatMaps;
    }

    /**
     * Get week-over-week improvement data
     */
    async getImprovementTrend(studentId, weeks = 4) {
        const allHeatMaps = await this.getAllHeatMaps(studentId);
        return allHeatMaps
            .slice(0, weeks)
            .reverse()
            .map(h => ({
                weekStart: h.weekStart,
                averageAccuracy: h.averageAccuracy,
                totalPracticeTimeMs: h.totalPracticeTimeMs,
                sessionCount: h.sessionCount,
                problemAreas: h.problemAreas
            }));
    }

    /**
     * Format week range for display
     */
    formatWeekRange(weekStart) {
        const start = new Date(weekStart);
        const end = new Date(weekStart + 6 * 24 * 60 * 60 * 1000);

        const options = { month: 'short', day: 'numeric' };
        return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
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

    _notifyUpdate() {
        if (typeof this.onUpdate === 'function') {
            this.onUpdate();
        }
    }
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeatMapHistoryService;
} else if (typeof window !== 'undefined') {
    window.HeatMapHistoryService = HeatMapHistoryService;
}
