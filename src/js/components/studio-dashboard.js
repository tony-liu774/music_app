/**
 * Studio Dashboard - Teacher Portal Component
 * Provides a dedicated hub for teachers to track their entire roster of students
 */

class StudioDashboard {
    constructor(teacherService) {
        this.teacherService = teacherService;
        this.container = null;
        this.students = [];
        this.filteredStudents = [];
        this.searchQuery = '';
        this.sortBy = 'name';
        this.sortAscending = true;
        this.selectedStudentId = null;
        this._searchDebounceTimer = null;
    }

    /**
     * Initialize the dashboard
     */
    async init() {
        this.container = document.getElementById('studio-dashboard-view');
        if (!this.container) return;

        await this.teacherService.init();

        // Set up update listener
        this.teacherService.onUpdate = () => this.refresh();

        await this.refresh();
        this.bindEvents();
    }

    /**
     * Refresh the dashboard data and re-render
     */
    async refresh() {
        try {
            this.students = await this.teacherService.getAllStudents();
            this.applyFilters();
            this.render();
        } catch (err) {
            console.error('Failed to refresh studio dashboard:', err);
        }
    }

    /**
     * Apply search and sort filters
     */
    applyFilters() {
        this.filteredStudents = this.teacherService.searchStudents(this.students, this.searchQuery);
        this.filteredStudents = this.teacherService.sortStudents(this.filteredStudents, this.sortBy, this.sortAscending);
    }

    /**
     * Render the entire dashboard
     */
    render() {
        if (!this.container) return;

        const metrics = this.teacherService.getDashboardMetrics(this.students);
        const content = document.querySelector('.studio-content');
        if (!content) return;

        content.innerHTML = `
            ${this._renderMetricsCards(metrics)}
            ${this._renderToolbar()}
            ${this._renderStudentRoster()}
        `;

        this._bindDynamicEvents();

        // Restore search input focus and cursor position after re-render
        const searchInput = document.getElementById('student-search');
        if (searchInput && this.searchQuery) {
            searchInput.focus();
            searchInput.setSelectionRange(this.searchQuery.length, this.searchQuery.length);
        }
    }

    /**
     * Re-render only the roster section (used by debounced search)
     */
    _renderRosterOnly() {
        if (!this.container) return;
        const rosterContainer = this.container.querySelector('.student-roster') ||
                                this.container.querySelector('.studio-empty');
        if (!rosterContainer) {
            // Fall back to full render if roster container not found
            this.render();
            return;
        }

        // Replace roster section
        const parent = rosterContainer.parentNode;
        const temp = document.createElement('div');
        temp.innerHTML = this._renderStudentRoster();
        parent.replaceChild(temp.firstElementChild || temp, rosterContainer);

        // Re-bind roster-specific events
        this.container?.querySelectorAll('.student-log-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectedStudentId = btn.dataset.studentId;
                this._openLogSessionModal(btn.dataset.studentId);
            });
        });
        this.container?.querySelectorAll('.student-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._handleRemoveStudent(btn.dataset.studentId);
            });
        });
    }

    /**
     * Render the metrics overview cards
     */
    _renderMetricsCards(metrics) {
        const avgIntonation = metrics.averageIntonation !== null
            ? Math.round(metrics.averageIntonation)
            : null;
        const intonationInfo = this.teacherService.getIntonationEmoji(avgIntonation);
        const totalPractice = this.teacherService.formatPracticeTime(metrics.totalWeeklyPracticeMs);
        const activeCount = metrics.studentsActiveThisWeek;

        return `
            <div class="studio-metrics" role="region" aria-label="Studio overview metrics">
                <div class="metric-card" data-metric="students">
                    <div class="metric-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                    </div>
                    <div class="metric-value">${metrics.totalStudents}</div>
                    <div class="metric-label">Total Students</div>
                </div>
                <div class="metric-card" data-metric="practice">
                    <div class="metric-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                    </div>
                    <div class="metric-value">${totalPractice}</div>
                    <div class="metric-label">Total Practice This Week</div>
                </div>
                <div class="metric-card" data-metric="intonation">
                    <div class="metric-icon intonation-icon">${intonationInfo.icon}</div>
                    <div class="metric-value">${avgIntonation !== null ? avgIntonation + '%' : '—'}</div>
                    <div class="metric-label">Avg Intonation (${intonationInfo.label})</div>
                </div>
                <div class="metric-card" data-metric="active">
                    <div class="metric-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                    </div>
                    <div class="metric-value">${activeCount}/${metrics.totalStudents}</div>
                    <div class="metric-label">Active This Week</div>
                </div>
            </div>
        `;
    }

    /**
     * Render search and sort toolbar
     */
    _renderToolbar() {
        return `
            <div class="studio-toolbar">
                <div class="studio-search">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input type="text" id="student-search" placeholder="Search students..."
                           value="${this._escapeHtml(this.searchQuery)}" aria-label="Search students">
                </div>
                <div class="studio-sort">
                    <label for="student-sort">Sort by:</label>
                    <select id="student-sort" aria-label="Sort students">
                        <option value="name" ${this.sortBy === 'name' ? 'selected' : ''}>Name</option>
                        <option value="practiceTime" ${this.sortBy === 'practiceTime' ? 'selected' : ''}>Practice Time</option>
                        <option value="intonation" ${this.sortBy === 'intonation' ? 'selected' : ''}>Intonation Score</option>
                        <option value="lastSession" ${this.sortBy === 'lastSession' ? 'selected' : ''}>Last Session</option>
                        <option value="instrument" ${this.sortBy === 'instrument' ? 'selected' : ''}>Instrument</option>
                    </select>
                    <button class="btn btn-icon studio-sort-dir" aria-label="Toggle sort direction" title="${this.sortAscending ? 'Ascending' : 'Descending'}">
                        ${this.sortAscending ? '↑' : '↓'}
                    </button>
                </div>
                <button class="btn btn-primary" id="add-student-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Add Student
                </button>
            </div>
        `;
    }

    /**
     * Render student roster list
     */
    _renderStudentRoster() {
        if (this.filteredStudents.length === 0) {
            if (this.students.length === 0) {
                return `
                    <div class="studio-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <line x1="19" y1="8" x2="19" y2="14"/>
                            <line x1="16" y1="11" x2="22" y2="11"/>
                        </svg>
                        <h3>No students yet</h3>
                        <p>Add students to your roster to start tracking their progress</p>
                    </div>
                `;
            }
            return `
                <div class="studio-empty">
                    <h3>No matching students</h3>
                    <p>Try adjusting your search criteria</p>
                </div>
            `;
        }

        const rows = this.filteredStudents.map(student => this._renderStudentRow(student)).join('');
        return `
            <div class="student-roster" role="table" aria-label="Student roster">
                <div class="roster-header" role="row">
                    <span class="roster-cell roster-name" role="columnheader">Student</span>
                    <span class="roster-cell roster-instrument" role="columnheader">Instrument</span>
                    <span class="roster-cell roster-piece" role="columnheader">Assigned Piece</span>
                    <span class="roster-cell roster-practice" role="columnheader">Practice (Week)</span>
                    <span class="roster-cell roster-score" role="columnheader">Intonation</span>
                    <span class="roster-cell roster-actions" role="columnheader">Actions</span>
                </div>
                ${rows}
            </div>
        `;
    }

    /**
     * Render a single student row
     */
    _renderStudentRow(student) {
        const practiceTime = this.teacherService.formatPracticeTime(student.weeklyPracticeTimeMs);
        const intonation = this.teacherService.getIntonationEmoji(student.averageIntonationScore);
        const scoreDisplay = student.averageIntonationScore !== null
            ? `${Math.round(student.averageIntonationScore)}%`
            : '—';
        const lastSession = student.lastSessionAt
            ? this._formatRelativeTime(student.lastSessionAt)
            : 'Never';
        const instrumentIcon = this._getInstrumentIcon(student.instrument);
        const escapedInstrument = this._escapeHtml(this._capitalize(student.instrument));

        return `
            <div class="roster-row" role="row" data-student-id="${student.id}" tabindex="0">
                <div class="roster-cell roster-name" role="cell">
                    <span class="student-name">${this._escapeHtml(student.name)}</span>
                    <span class="student-meta">Last: ${lastSession}</span>
                </div>
                <div class="roster-cell roster-instrument" role="cell">
                    <span class="instrument-badge">${instrumentIcon} ${escapedInstrument}</span>
                </div>
                <div class="roster-cell roster-piece" role="cell">
                    ${student.assignedPiece ? this._escapeHtml(student.assignedPiece) : '<em>None assigned</em>'}
                </div>
                <div class="roster-cell roster-practice" role="cell">
                    <span class="practice-value">${practiceTime}</span>
                </div>
                <div class="roster-cell roster-score" role="cell">
                    <span class="intonation-badge ${this._getScoreClass(student.averageIntonationScore)}"
                          title="${intonation.label}">
                        ${intonation.icon} ${scoreDisplay}
                    </span>
                </div>
                <div class="roster-cell roster-actions" role="cell">
                    <button class="btn btn-icon btn-small student-log-btn" data-student-id="${student.id}"
                            aria-label="Log session for ${this._escapeHtml(student.name)}" title="Log Session">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                    </button>
                    <button class="btn btn-icon btn-small student-remove-btn" data-student-id="${student.id}"
                            aria-label="Remove ${this._escapeHtml(student.name)}" title="Remove Student">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Bind static event listeners
     */
    bindEvents() {
        // These events are for the add-student modal (outside of dynamic content)
        const addModal = document.getElementById('add-student-modal');
        if (addModal) {
            const form = addModal.querySelector('#add-student-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this._handleAddStudent();
                });
            }

            // Close modal handlers
            const closeBtn = addModal.querySelector('.modal-close');
            const backdrop = addModal.querySelector('.modal-backdrop');
            if (closeBtn) closeBtn.addEventListener('click', () => this._closeModal('add-student-modal'));
            if (backdrop) backdrop.addEventListener('click', () => this._closeModal('add-student-modal'));
        }

        const logModal = document.getElementById('log-session-modal');
        if (logModal) {
            const form = logModal.querySelector('#log-session-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this._handleLogSession();
                });
            }

            const closeBtn = logModal.querySelector('.modal-close');
            const backdrop = logModal.querySelector('.modal-backdrop');
            if (closeBtn) closeBtn.addEventListener('click', () => this._closeModal('log-session-modal'));
            if (backdrop) backdrop.addEventListener('click', () => this._closeModal('log-session-modal'));
        }
    }

    /**
     * Bind events for dynamically rendered content
     */
    _bindDynamicEvents() {
        // Debounced search - only re-renders roster, not the whole page
        const searchInput = document.getElementById('student-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                if (this._searchDebounceTimer) clearTimeout(this._searchDebounceTimer);
                this._searchDebounceTimer = setTimeout(() => {
                    this.applyFilters();
                    this._renderRosterOnly();
                }, 200);
            });
        }

        // Sort select
        const sortSelect = document.getElementById('student-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.applyFilters();
                this._renderRosterOnly();
            });
        }

        // Sort direction toggle
        const sortDirBtn = this.container?.querySelector('.studio-sort-dir');
        if (sortDirBtn) {
            sortDirBtn.addEventListener('click', () => {
                this.sortAscending = !this.sortAscending;
                sortDirBtn.textContent = this.sortAscending ? '↑' : '↓';
                sortDirBtn.title = this.sortAscending ? 'Ascending' : 'Descending';
                this.applyFilters();
                this._renderRosterOnly();
            });
        }

        // Add student button
        const addBtn = document.getElementById('add-student-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this._openModal('add-student-modal'));
        }

        // Log session buttons
        this.container?.querySelectorAll('.student-log-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const studentId = btn.dataset.studentId;
                this.selectedStudentId = studentId;
                this._openLogSessionModal(studentId);
            });
        });

        // Remove student buttons
        this.container?.querySelectorAll('.student-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const studentId = btn.dataset.studentId;
                this._handleRemoveStudent(studentId);
            });
        });
    }

    /**
     * Handle adding a new student
     */
    async _handleAddStudent() {
        const nameInput = document.getElementById('new-student-name');
        const instrumentSelect = document.getElementById('new-student-instrument');
        const pieceInput = document.getElementById('new-student-piece');
        const emailInput = document.getElementById('new-student-email');

        if (!nameInput || !nameInput.value.trim()) return;

        try {
            await this.teacherService.addStudent({
                name: nameInput.value.trim(),
                instrument: instrumentSelect?.value || 'violin',
                assignedPiece: pieceInput?.value?.trim() || '',
                email: emailInput?.value?.trim() || ''
            });

            this._closeModal('add-student-modal');
            // Reset form
            nameInput.value = '';
            if (pieceInput) pieceInput.value = '';
            if (emailInput) emailInput.value = '';
        } catch (err) {
            console.error('Failed to add student:', err);
        }
    }

    /**
     * Handle removing a student
     */
    async _handleRemoveStudent(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (!student) return;

        // Use simple confirm for now
        if (typeof window !== 'undefined' && window.confirm) {
            if (!window.confirm(`Remove ${student.name} from your roster?`)) return;
        }

        try {
            await this.teacherService.removeStudent(studentId);
        } catch (err) {
            console.error('Failed to remove student:', err);
        }
    }

    /**
     * Open the log session modal for a student
     */
    _openLogSessionModal(studentId) {
        const student = this.students.find(s => s.id === studentId);
        if (!student) return;

        const nameDisplay = document.getElementById('log-session-student-name');
        if (nameDisplay) nameDisplay.textContent = student.name;

        this._openModal('log-session-modal');
    }

    /**
     * Handle logging a practice session
     */
    async _handleLogSession() {
        if (!this.selectedStudentId) return;

        const durationInput = document.getElementById('log-session-duration');
        const pieceInput = document.getElementById('log-session-piece');
        const intonationInput = document.getElementById('log-session-intonation');
        const notesInput = document.getElementById('log-session-notes');

        const durationMinutes = parseInt(durationInput?.value || '0', 10);
        const intonationScore = intonationInput?.value ? parseInt(intonationInput.value, 10) : null;

        try {
            await this.teacherService.logPracticeSession(this.selectedStudentId, {
                durationMs: durationMinutes * 60000,
                piece: pieceInput?.value?.trim() || '',
                intonationScore: intonationScore,
                notes: notesInput?.value?.trim() || ''
            });

            this._closeModal('log-session-modal');
            // Reset form
            if (durationInput) durationInput.value = '';
            if (pieceInput) pieceInput.value = '';
            if (intonationInput) intonationInput.value = '';
            if (notesInput) notesInput.value = '';
            this.selectedStudentId = null;
        } catch (err) {
            console.error('Failed to log session:', err);
        }
    }

    _openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    }

    _closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    }

    /**
     * Escape HTML using regex for consistent behavior across browser and Node.js
     */
    _escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    _capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    _formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    _getInstrumentIcon(instrument) {
        const icons = {
            violin: 'Vn',
            viola: 'Va',
            cello: 'Vc',
            bass: 'Cb'
        };
        return icons[instrument] || '?';
    }

    _getScoreClass(score) {
        if (score === null || score === undefined) return 'score-none';
        if (score >= 90) return 'score-excellent';
        if (score >= 75) return 'score-good';
        if (score >= 60) return 'score-fair';
        if (score >= 40) return 'score-needs-work';
        return 'score-struggling';
    }
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StudioDashboard;
} else if (typeof window !== 'undefined') {
    window.StudioDashboard = StudioDashboard;
}
