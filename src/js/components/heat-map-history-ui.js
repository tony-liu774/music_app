/**
 * Heat Map History UI - Teacher view for student practice heat maps
 * Allows teachers to view weekly heat maps, compare weeks, and identify problem areas
 */

class HeatMapHistoryUI {
    constructor(heatMapService, teacherService) {
        this.heatMapService = heatMapService;
        this.teacherService = teacherService;
        this.container = null;
        this.currentStudentId = null;
        this.selectedWeekStart = null;
        this.compareWeeks = [];
        this.dateRange = {
            start: null,
            end: null
        };
    }

    /**
     * Escape HTML entities to prevent XSS attacks
     * @param {string} str - String to escape
     * @returns {string} Escaped string safe for HTML insertion
     */
    _escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    /**
     * Initialize the component
     */
    async init() {
        this.container = document.getElementById('heat-map-history-view');
        if (!this.container) {
            // Create container if it doesn't exist
            this._createContainer();
        }

        try {
            await this.heatMapService.init();
        } catch (err) {
            console.error('Failed to initialize heat map service:', err);
        }

        this.bindEvents();
        return this;
    }

    /**
     * Create the container element in the DOM
     */
    _createContainer() {
        const main = document.querySelector('.main-content');
        if (!main) return;

        const view = document.createElement('section');
        view.id = 'heat-map-history-view';
        view.className = 'view';
        view.innerHTML = this._getEmptyState();
        main.appendChild(view);
        this.container = view;
    }

    /**
     * Get empty state HTML
     */
    _getEmptyState() {
        return `
            <div class="section-header">
                <h1>Practice Audits</h1>
                <p class="subtitle">Review student practice heat maps</p>
            </div>
            <div class="heatmap-empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <h3>Select a student</h3>
                <p>Choose a student from the Studio Dashboard to view their practice heat maps</p>
            </div>
        `;
    }

    /**
     * Load heat map data for a specific student
     */
    async loadStudentHeatMaps(studentId) {
        // Validate studentId
        if (!studentId || typeof studentId !== 'string' || studentId.length > 100) {
            console.warn('Invalid studentId:', studentId);
            return;
        }

        this.currentStudentId = studentId;
        this.compareWeeks = [];

        const student = await this.teacherService.getStudent(studentId);
        if (!student) return;

        const heatMaps = await this.heatMapService.getAllHeatMaps(studentId);
        const sessions = await this._getStudentSessions(studentId);

        this.render(student, heatMaps, sessions);
    }

    /**
     * Get all practice sessions for a student
     */
    async _getStudentSessions(studentId) {
        if (!this.heatMapService.db) return [];

        const transaction = this.heatMapService.db.transaction(['practiceSessions'], 'readonly');
        const store = transaction.objectStore('practiceSessions');
        const index = store.index('studentId');
        const result = await this.heatMapService._promisifyRequest(index.getAll(studentId));
        return result || [];
    }

    /**
     * Render the heat map history view
     */
    render(student, heatMaps, sessions) {
        if (!this.container) return;

        const content = `
            <div class="section-header">
                <h1>Practice Audits</h1>
                <p class="subtitle">${this._escapeHtml(student.name)} - ${this._escapeHtml(student.instrument)}</p>
            </div>

            ${this._renderControls(heatMaps)}
            ${this._renderWeekSelector(heatMaps)}
            ${this._renderMainContent(heatMaps, sessions)}
        `;

        this.container.innerHTML = content;
        this._bindDynamicEvents();
    }

    /**
     * Render date range and comparison controls
     */
    _renderControls(heatMaps) {
        const weeks = heatMaps.map(h => ({
            weekStart: h.weekStart,
            label: this.heatMapService.formatWeekRange(h.weekStart)
        }));

        return `
            <div class="heatmap-controls">
                <div class="control-group">
                    <label>Date Range</label>
                    <div class="date-range-picker">
                        <input type="date" id="heatmap-start-date" class="date-input">
                        <span>to</span>
                        <input type="date" id="heatmap-end-date" class="date-input">
                        <button class="btn btn-secondary btn-small" id="apply-date-range">Apply</button>
                    </div>
                </div>
                <div class="control-group">
                    <label>Compare Weeks</label>
                    <div class="week-compare-controls">
                        <select id="week-compare-select" class="select-input">
                            <option value="">Select week to compare...</option>
                            ${weeks.map(w => `<option value="${w.weekStart}">${w.label}</option>`).join('')}
                        </select>
                        <button class="btn btn-secondary btn-small" id="add-compare-week" ${weeks.length < 2 ? 'disabled' : ''}>
                            Add Week
                        </button>
                    </div>
                </div>
                ${this.compareWeeks.length > 0 ? `
                    <div class="compare-tags">
                        ${this.compareWeeks.map((w, i) => `
                            <span class="compare-tag">
                                ${this.heatMapService.formatWeekRange(w)}
                                <button class="tag-remove" data-week="${w}">&times;</button>
                            </span>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render week selector
     */
    _renderWeekSelector(heatMaps) {
        if (heatMaps.length === 0) {
            return `
                <div class="heatmap-weeks-empty">
                    <p>No practice data available yet</p>
                </div>
            `;
        }

        return `
            <div class="heatmap-weeks">
                ${heatMaps.map(h => `
                    <button class="week-card ${this.selectedWeekStart === h.weekStart ? 'active' : ''}"
                            data-week="${h.weekStart}">
                        <span class="week-label">${this.heatMapService.formatWeekRange(h.weekStart)}</span>
                        <span class="week-stats">
                            <span class="stat">
                                <span class="stat-value">${h.sessionCount}</span>
                                <span class="stat-label">sessions</span>
                            </span>
                            <span class="stat">
                                <span class="stat-value">${this.heatMapService.formatPracticeTime(h.totalPracticeTimeMs)}</span>
                                <span class="stat-label">practice</span>
                            </span>
                            <span class="stat accuracy-${this._getAccuracyClass(h.averageAccuracy)}">
                                <span class="stat-value">${h.averageAccuracy ?? '--'}%</span>
                                <span class="stat-label">accuracy</span>
                            </span>
                        </span>
                    </button>
                `).join('')}
            </div>
        `;
    }

    /**
     * Get accuracy CSS class
     */
    _getAccuracyClass(accuracy) {
        if (accuracy === null || accuracy === undefined) return 'unknown';
        if (accuracy >= 90) return 'excellent';
        if (accuracy >= 75) return 'good';
        if (accuracy >= 60) return 'fair';
        return 'needs-work';
    }

    /**
     * Render main content area with heat map visualization
     */
    _renderMainContent(heatMaps, sessions) {
        const selectedHeatMap = heatMaps.find(h => h.weekStart === this.selectedWeekStart) || heatMaps[0];

        if (!selectedHeatMap) {
            return `
                <div class="heatmap-content-empty">
                    <p>Select a week to view detailed heat map</p>
                </div>
            `;
        }

        // If comparing weeks, show comparison view
        if (this.compareWeeks.length > 0) {
            return this._renderComparisonView(heatMaps, sessions);
        }

        return `
            <div class="heatmap-content">
                ${this._renderWeekOverview(selectedHeatMap)}
                ${this._renderHeatMapVisualization(selectedHeatMap)}
                ${this._renderNeglectedSections(selectedHeatMap)}
                ${this._renderProblemAreas(selectedHeatMap)}
                ${this._renderPracticeLog(sessions, selectedHeatMap.weekStart)}
            </div>
        `;
    }

    /**
     * Render week overview summary
     */
    _renderWeekOverview(heatMap) {
        return `
            <div class="week-overview">
                <div class="overview-card primary">
                    <h3>Week Overview</h3>
                    <div class="overview-stats">
                        <div class="stat-item">
                            <span class="stat-icon">📅</span>
                            <span class="stat-info">
                                <span class="stat-value">${this.heatMapService.formatWeekRange(heatMap.weekStart)}</span>
                                <span class="stat-label">Week Range</span>
                            </span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-icon">🎵</span>
                            <span class="stat-info">
                                <span class="stat-value">${heatMap.sessionCount}</span>
                                <span class="stat-label">Sessions</span>
                            </span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-icon">⏱️</span>
                            <span class="stat-info">
                                <span class="stat-value">${this.heatMapService.formatPracticeTime(heatMap.totalPracticeTimeMs)}</span>
                                <span class="stat-label">Total Practice</span>
                            </span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-icon">${this._getAccuracyIcon(heatMap.averageAccuracy)}</span>
                            <span class="stat-info">
                                <span class="stat-value accuracy-${this._getAccuracyClass(heatMap.averageAccuracy)}">${heatMap.averageAccuracy ?? '--'}%</span>
                                <span class="stat-label">Avg Accuracy</span>
                            </span>
                        </div>
                    </div>
                    ${heatMap.piecesPracticed.length > 0 ? `
                        <div class="pieces-practiced">
                            <span class="pieces-label">Pieces Practiced:</span>
                            ${heatMap.piecesPracticed.map(p => `<span class="piece-tag">${this._escapeHtml(p)}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Get accuracy icon
     */
    _getAccuracyIcon(accuracy) {
        if (accuracy === null || accuracy === undefined) return '❓';
        if (accuracy >= 90) return '⭐';
        if (accuracy >= 75) return '✓';
        if (accuracy >= 60) return '△';
        return '✗';
    }

    /**
     * Render the Crimson heat map visualization
     */
    _renderHeatMapVisualization(heatMap) {
        const measures = heatMap.measureHeatMap || [];
        if (measures.length === 0) {
            return `
                <div class="heatmap-visualization empty">
                    <p>No measure data available</p>
                </div>
            `;
        }

        // Group measures into rows of 8 for display
        const rows = [];
        for (let i = 0; i < measures.length; i += 8) {
            rows.push(measures.slice(i, i + 8));
        }

        return `
            <div class="heatmap-visualization">
                <h3>Crimson Heat Map</h3>
                <p class="heatmap-legend">
                    <span class="legend-item"><span class="legend-color excellent"></span>Excellent (90%+)</span>
                    <span class="legend-item"><span class="legend-color good"></span>Good (75-89%)</span>
                    <span class="legend-item"><span class="legend-color fair"></span>Fair (60-74%)</span>
                    <span class="legend-item"><span class="legend-color crimson"></span>Needs Work (&lt;60%)</span>
                </p>
                <div class="heatmap-grid">
                    ${rows.map(row => `
                        <div class="heatmap-row">
                            ${row.map(m => `
                                <div class="heatmap-cell ${this._getAccuracyClass(m.averageAccuracy)}"
                                     data-measure="${m.measure}"
                                     title="Measure ${m.measure}: ${m.averageAccuracy}% accuracy">
                                    <span class="measure-number">${m.measure}</span>
                                    <span class="measure-accuracy">${m.averageAccuracy}%</span>
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render neglected sections
     */
    _renderNeglectedSections(heatMap) {
        const neglected = heatMap.neglectedSections || [];
        if (neglected.length === 0) {
            return `
                <div class="neglected-sections empty">
                    <h3>Neglected Sections</h3>
                    <p class="success-message">All sections have been practiced evenly!</p>
                </div>
            `;
        }

        return `
            <div class="neglected-sections">
                <h3>Neglected Sections</h3>
                <p class="alert-message">These measures were practiced significantly less than others:</p>
                <div class="neglected-list">
                    ${neglected.map(m => `
                        <span class="neglected-tag">Measure ${m}</span>
                    `).join('')}
                </div>
                <p class="recommendation">
                    <strong>Recommendation:</strong> Spend extra time on these sections in the next lesson.
                    This could save ~15 minutes of lesson time by addressing gaps proactively.
                </p>
            </div>
        `;
    }

    /**
     * Render problem areas
     */
    _renderProblemAreas(heatMap) {
        const problems = heatMap.problemAreas || [];
        if (problems.length === 0) {
            return `
                <div class="problem-areas empty">
                    <h3>Problem Areas</h3>
                    <p class="success-message">No significant problem areas identified!</p>
                </div>
            `;
        }

        return `
            <div class="problem-areas">
                <h3>Problem Areas</h3>
                <p class="alert-message">Measures requiring the most attention:</p>
                <div class="problem-list">
                    ${problems.map(p => `
                        <div class="problem-item">
                            <span class="problem-measure">Measure ${p.measure}</span>
                            <span class="problem-accuracy crimson">${p.accuracy}% accuracy</span>
                            <div class="problem-bar">
                                <div class="problem-bar-fill" style="width: ${p.accuracy}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render practice log for the week
     */
    _renderPracticeLog(sessions, weekStart) {
        const weekSessions = sessions.filter(s => s.weekStart === weekStart);
        if (weekSessions.length === 0) {
            return '';
        }

        return `
            <div class="practice-log">
                <h3>Practice Sessions</h3>
                <div class="session-list">
                    ${weekSessions.map(s => {
                        const pieceName = this._escapeHtml(s.pieceName || s.scoreId);
                        return `
                        <div class="session-item">
                            <span class="session-date">${new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                            <span class="session-piece">${pieceName}</span>
                            <span class="session-duration">${this.heatMapService.formatPracticeTime(s.durationMs)}</span>
                            <span class="session-errors">${s.totalDeviations} errors</span>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render comparison view for multiple weeks
     */
    _renderComparisonView(allHeatMaps, sessions) {
        const selectedHeatMap = allHeatMaps.find(h => h.weekStart === this.selectedWeekStart) || allHeatMaps[0];
        const compareMaps = this.compareWeeks
            .map(ws => allHeatMaps.find(h => h.weekStart === ws))
            .filter(Boolean);

        const allMaps = [selectedHeatMap, ...compareMaps];

        return `
            <div class="heatmap-content">
                <div class="comparison-header">
                    <h3>Week Comparison</h3>
                    <p>Comparing ${allMaps.length} weeks of practice data</p>
                </div>

                ${this._renderComparisonTable(allMaps)}
                ${this._renderComparisonTrends(allMaps)}
            </div>
        `;
    }

    /**
     * Render comparison table
     */
    _renderComparisonTable(heatMaps) {
        return `
            <div class="comparison-table-wrapper">
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>Week</th>
                            <th>Sessions</th>
                            <th>Practice Time</th>
                            <th>Avg Accuracy</th>
                            <th>Problem Areas</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${heatMaps.map(h => `
                            <tr>
                                <td>${this.heatMapService.formatWeekRange(h.weekStart)}</td>
                                <td>${h.sessionCount}</td>
                                <td>${this.heatMapService.formatPracticeTime(h.totalPracticeTimeMs)}</td>
                                <td class="accuracy-${this._getAccuracyClass(h.averageAccuracy)}">${h.averageAccuracy ?? '--'}%</td>
                                <td>${h.problemAreas.map(p => `M${p.measure}`).join(', ') || 'None'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Render comparison trends
     */
    _renderComparisonTrends(heatMaps) {
        if (heatMaps.length < 2) return '';

        const accuracies = heatMaps.map(h => h.averageAccuracy).filter(a => a !== null);
        const practiceTimes = heatMaps.map(h => h.totalPracticeTimeMs);

        let trend = 'stable';
        if (accuracies.length >= 2) {
            const first = accuracies[0];
            const last = accuracies[accuracies.length - 1];
            if (last > first + 5) trend = 'improving';
            else if (last < first - 5) trend = 'declining';
        }

        const trendIcon = trend === 'improving' ? '📈' : trend === 'declining' ? '📉' : '➡️';
        const trendText = trend === 'improving' ? 'Improving' : trend === 'declining' ? 'Declining' : 'Stable';

        return `
            <div class="comparison-trends">
                <div class="trend-card ${trend}">
                    <span class="trend-icon">${trendIcon}</span>
                    <span class="trend-text">Performance is <strong>${trendText}</strong></span>
                </div>
                <div class="trend-details">
                    <p>Average practice time: <strong>${this.heatMapService.formatPracticeTime(
                        practiceTimes.reduce((a, b) => a + b, 0) / practiceTimes.length
                    )}</strong> per week</p>
                </div>
            </div>
        `;
    }

    /**
     * Bind component events
     */
    bindEvents() {
        // Week card clicks
        document.addEventListener('click', (e) => {
            const weekCard = e.target.closest('.week-card');
            if (weekCard) {
                this.selectedWeekStart = parseInt(weekCard.dataset.week);
                this._reload();
            }

            // Remove compare tag
            const tagRemove = e.target.closest('.tag-remove');
            if (tagRemove) {
                const week = parseInt(tagRemove.dataset.week);
                this.compareWeeks = this.compareWeeks.filter(w => w !== week);
                this._reload();
            }
        });

        // Add compare week button
        document.addEventListener('click', (e) => {
            if (e.target.id === 'add-compare-week') {
                const select = document.getElementById('week-compare-select');
                const weekStart = parseInt(select.value);
                if (weekStart && !this.compareWeeks.includes(weekStart)) {
                    this.compareWeeks.push(weekStart);
                    this._reload();
                }
            }

            // Apply date range
            if (e.target.id === 'apply-date-range') {
                const startDate = document.getElementById('heatmap-start-date').value;
                const endDate = document.getElementById('heatmap-end-date').value;
                if (startDate && endDate) {
                    this._loadDateRange(startDate, endDate);
                }
            }
        });
    }

    /**
     * Bind dynamic events after render
     */
    _bindDynamicEvents() {
        // Additional dynamic event binding if needed
    }

    /**
     * Reload the current view
     */
    async _reload() {
        if (this.currentStudentId) {
            await this.loadStudentHeatMaps(this.currentStudentId);
        }
    }

    /**
     * Load data for a specific date range
     */
    async _loadDateRange(startDate, endDate) {
        const heatMaps = await this.heatMapService.getHeatMapsInRange(
            this.currentStudentId,
            startDate,
            endDate
        );
        const sessions = await this.heatMapService.getSessionsInRange(
            this.currentStudentId,
            startDate,
            endDate
        );

        const student = await this.teacherService.getStudent(this.currentStudentId);
        this.selectedWeekStart = heatMaps.length > 0 ? heatMaps[0].weekStart : null;
        this.compareWeeks = [];

        this.render(student, heatMaps, sessions);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeatMapHistoryUI;
} else if (typeof window !== 'undefined') {
    window.HeatMapHistoryUI = HeatMapHistoryUI;
}
