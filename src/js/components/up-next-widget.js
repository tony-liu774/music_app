/**
 * Up Next Widget - Pinned Student Assignment Widget
 * Shows the next upcoming assignment on the student's home screen
 */

class UpNextWidget {
    constructor(assignmentService) {
        this.assignmentService = assignmentService;
        this.container = null;
        this._studentId = null;
        this.refreshInterval = null;
        this.onStartPractice = null;
    }

    /**
     * Get the current student ID from localStorage
     */
    get studentId() {
        if (this._studentId) return this._studentId;
        this._studentId = localStorage.getItem('user_id') || 'student-' + Date.now();
        return this._studentId;
    }

    set studentId(id) {
        this._studentId = id;
        localStorage.setItem('user_id', id);
    }

    /**
     * Initialize the Up Next widget
     */
    async init() {
        // Find the widget container in the DOM
        this.container = document.getElementById('up-next-widget');
        if (!this.container) return;

        // Ensure we have a student ID
        if (!localStorage.getItem('user_id')) {
            this.studentId = 'student-' + Date.now();
        }

        await this.assignmentService.init();
        this.assignmentService.onUpdate = () => this.refresh();

        await this.refresh();
        this.bindEvents();

        // Auto-refresh every minute
        this.refreshInterval = setInterval(() => this.refresh(), 60000);
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    /**
     * Refresh the widget with latest data
     */
    async refresh() {
        if (!this.container) return;

        try {
            const nextAssignment = await this.assignmentService.getNextAssignment(this.studentId);
            const stats = await this.assignmentService.getStudentStats(this.studentId);

            this.render(nextAssignment, stats);
            this.bindEvents();
        } catch (err) {
            console.error('Failed to refresh Up Next widget:', err);
        }
    }

    /**
     * Render the widget
     */
    render(assignment, stats) {
        if (!this.container) return;

        if (!assignment) {
            this.container.innerHTML = this._renderEmptyState();
            return;
        }

        const dueDateStr = this.assignmentService.formatDueDate(assignment.dueDate);
        const measureRange = this.assignmentService.getMeasureRange(assignment);
        const now = Date.now();
        const isOverdue = assignment.dueDate && assignment.dueDate < now && assignment.status !== 'completed';

        this.container.innerHTML = `
            <div class="up-next-header">
                <div class="up-next-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="up-next-icon">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                    Up Next
                </div>
                ${isOverdue ? `<span class="overdue-badge">Overdue</span>` : ''}
            </div>
            <div class="up-next-content">
                <h3 class="up-next-title">${this._escapeHtml(assignment.title || 'Practice Assignment')}</h3>
                <p class="up-next-piece">${this._escapeHtml(assignment.pieceTitle || 'No piece selected')}</p>
                <div class="up-next-details">
                    <span class="detail-badge measure">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        ${measureRange}
                    </span>
                    <span class="detail-badge due ${isOverdue ? 'overdue' : ''}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        ${dueDateStr}
                    </span>
                </div>
                ${this._renderTargets(assignment)}
            </div>
            <div class="up-next-actions">
                <button class="btn btn-primary btn-start-practice" data-assignment-id="${this._escapeHtml(assignment.id)}">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    Start Practice
                </button>
                <button class="btn btn-ghost btn-view-all">
                    View All
                </button>
            </div>
            ${this._renderQuickStats(stats)}
        `;
    }

    /**
     * Render the targets section
     */
    _renderTargets(assignment) {
        const targets = [];

        if (assignment.targetTempo) {
            targets.push(`<span class="target-item tempo">${assignment.targetTempo} BPM</span>`);
        }
        if (assignment.targetIntonation) {
            targets.push(`<span class="target-item intonation">${assignment.targetIntonation}% Intonation</span>`);
        }
        if (assignment.targetAccuracy) {
            targets.push(`<span class="target-item accuracy">${assignment.targetAccuracy}% Accuracy</span>`);
        }

        if (targets.length === 0) return '';

        return `
            <div class="up-next-targets">
                <span class="targets-label">Targets:</span>
                ${targets.join('<span class="target-separator">+</span>')}
            </div>
        `;
    }

    /**
     * Render quick stats
     */
    _renderQuickStats(stats) {
        if (!stats || stats.total === 0) return '';

        return `
            <div class="up-next-quick-stats">
                <span class="quick-stat">
                    <span class="stat-num">${stats.inProgress}</span> in progress
                </span>
                <span class="quick-stat completed">
                    <span class="stat-num">${stats.completed}</span> completed
                </span>
            </div>
        `;
    }

    /**
     * Render empty state
     */
    _renderEmptyState() {
        return `
            <div class="up-next-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                </svg>
                <h3>No Assignments</h3>
                <p>You're all caught up! Check back later for new assignments from your teacher.</p>
            </div>
        `;
    }

    /**
     * Bind events
     */
    bindEvents() {
        if (!this.container) return;

        // Start practice button
        const startBtn = this.container.querySelector('.btn-start-practice');
        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                const assignmentId = e.currentTarget.dataset.assignmentId;
                this._handleStartPractice(assignmentId);
            });
        }

        // View all button
        const viewAllBtn = this.container.querySelector('.btn-view-all');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                this._handleViewAll();
            });
        }
    }

    /**
     * Handle start practice button click
     */
    async _handleStartPractice(assignmentId) {
        if (this.onStartPractice) {
            const assignment = await this.assignmentService.getAssignment(assignmentId);
            this.onStartPractice(assignment);
        }

        // Navigate to practice view with assignment
        if (window.App && window.App.navigateTo) {
            window.App.navigateTo('practice');

            // Load the assignment's piece if specified
            if (assignmentId) {
                const assignment = await this.assignmentService.getAssignment(assignmentId);
                if (assignment && assignment.pieceId && window.App.loadPiece) {
                    window.App.loadPiece(assignment.pieceId);
                }
            }
        }
    }

    /**
     * Handle view all button click
     */
    _handleViewAll() {
        // Navigate to assignments list
        if (window.App && window.App.navigateTo) {
            window.App.navigateTo('assignments');
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    _escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UpNextWidget;
} else if (typeof window !== 'undefined') {
    window.UpNextWidget = UpNextWidget;
}
