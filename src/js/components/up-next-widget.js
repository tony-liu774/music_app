/**
 * Up Next Widget - Student's pinned assignment view on home screen
 * Displays the next pending/in-progress assignment with progress tracking
 */

class UpNextWidget {
    constructor(container, options = {}) {
        this.container = container;
        this.assignmentService = options.assignmentService || null;
        this.onPractice = options.onPractice || null;
        this.onViewAll = options.onViewAll || null;
        this.onViewAssignment = options.onViewAssignment || null;

        this.assignments = [];
        this.upNext = null;
    }

    async init() {
        await this.refresh();
    }

    async refresh() {
        if (!this.assignmentService) {
            this.render();
            return;
        }

        const studentId = this.assignmentService.getCurrentUserId();
        if (!studentId) {
            this.render();
            return;
        }

        try {
            this.assignments = await this.assignmentService.getActiveAssignments(studentId);
            this.upNext = await this.assignmentService.getUpNextAssignment(studentId);
        } catch (e) {
            console.error('Failed to load assignments:', e);
            this.assignments = [];
            this.upNext = null;
        }

        this.render();
    }

    render() {
        if (!this.container) return;

        if (!this.upNext && this.assignments.length === 0) {
            this.container.innerHTML = this.renderEmptyState();
            return;
        }

        this.container.innerHTML = `
            <div class="up-next-widget">
                <div class="up-next-header">
                    <div class="up-next-title-row">
                        <svg class="up-next-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                            <path d="M2 17l10 5 10-5"/>
                            <path d="M2 12l10 5 10-5"/>
                        </svg>
                        <h3>Up Next</h3>
                        ${this.assignments.length > 1 ? `
                            <span class="up-next-count">${this.assignments.length} assignments</span>
                        ` : ''}
                    </div>
                    ${this.assignments.length > 0 ? `
                        <button class="btn btn-ghost btn-sm up-next-view-all" id="view-all-assignments">
                            View All
                        </button>
                    ` : ''}
                </div>

                ${this.upNext ? this.renderAssignmentCard(this.upNext) : ''}

                ${this.assignments.length > 1 ? this.renderQueuePreview() : ''}
            </div>
        `;

        this.attachEventListeners();
    }

    renderAssignmentCard(assignment) {
        const progress = this.assignmentService
            ? this.assignmentService.calculateProgress(assignment)
            : 0;
        const isOverdue = this.assignmentService
            ? this.assignmentService.isOverdue(assignment)
            : false;
        const dueText = this.formatDueDate(assignment.dueDate);

        return `
            <div class="up-next-card ${isOverdue ? 'overdue' : ''}" data-assignment-id="${assignment.id}">
                <div class="up-next-card-header">
                    <span class="assignment-status-badge status-${assignment.status}">
                        ${assignment.status === 'pending' ? 'New' : 'In Progress'}
                    </span>
                    ${dueText ? `
                        <span class="assignment-due ${isOverdue ? 'overdue' : ''}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                            ${dueText}
                        </span>
                    ` : ''}
                </div>

                <h4 class="up-next-card-title">${this.escapeHtml(assignment.title)}</h4>

                <div class="up-next-card-details">
                    <div class="assignment-detail">
                        <span class="detail-label">Measures</span>
                        <span class="detail-value">${assignment.measures.start}${assignment.measures.end ? ` - ${assignment.measures.end}` : '+'}</span>
                    </div>
                    <div class="assignment-detail">
                        <span class="detail-label">Target</span>
                        <span class="detail-value">${assignment.target.bpm} BPM / ${assignment.target.intonationThreshold}%</span>
                    </div>
                    ${assignment.progress.practiceCount > 0 ? `
                        <div class="assignment-detail">
                            <span class="detail-label">Sessions</span>
                            <span class="detail-value">${assignment.progress.practiceCount}</span>
                        </div>
                    ` : ''}
                </div>

                ${assignment.notes ? `
                    <div class="up-next-card-notes">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span>${this.escapeHtml(assignment.notes)}</span>
                    </div>
                ` : ''}

                <div class="up-next-progress">
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <span class="progress-text">${progress}%</span>
                </div>

                <div class="up-next-card-actions">
                    <button class="btn btn-primary btn-sm up-next-practice-btn" data-id="${assignment.id}">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        Practice Now
                    </button>
                    <button class="btn btn-ghost btn-sm up-next-details-btn" data-id="${assignment.id}">
                        Details
                    </button>
                </div>
            </div>
        `;
    }

    renderQueuePreview() {
        const queued = this.assignments.slice(1, 3); // Show next 2
        if (queued.length === 0) return '';

        return `
            <div class="up-next-queue">
                <span class="queue-label">Coming up:</span>
                ${queued.map(a => `
                    <div class="queue-item" data-assignment-id="${a.id}">
                        <span class="queue-item-title">${this.escapeHtml(a.title)}</span>
                        ${a.dueDate ? `
                            <span class="queue-item-due">${this.formatDueDate(a.dueDate)}</span>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderEmptyState() {
        return `
            <div class="up-next-widget up-next-empty">
                <div class="up-next-header">
                    <div class="up-next-title-row">
                        <svg class="up-next-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                            <path d="M2 17l10 5 10-5"/>
                            <path d="M2 12l10 5 10-5"/>
                        </svg>
                        <h3>Up Next</h3>
                    </div>
                </div>
                <div class="up-next-empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                        <path d="M9 12l2 2 4-4"/>
                        <circle cx="12" cy="12" r="10"/>
                    </svg>
                    <p>No assignments yet</p>
                    <span class="up-next-empty-hint">Assignments from your teacher will appear here</span>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        if (!this.container) return;

        // Practice button
        const practiceBtns = this.container.querySelectorAll('.up-next-practice-btn');
        practiceBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                if (this.onPractice) {
                    const assignment = this.assignments.find(a => a.id === id);
                    this.onPractice(assignment);
                }
            });
        });

        // Details button
        const detailsBtns = this.container.querySelectorAll('.up-next-details-btn');
        detailsBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                if (this.onViewAssignment) {
                    const assignment = this.assignments.find(a => a.id === id);
                    this.onViewAssignment(assignment);
                }
            });
        });

        // View all
        const viewAllBtn = this.container.querySelector('#view-all-assignments');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                if (this.onViewAll) this.onViewAll();
            });
        }

        // Queue items
        const queueItems = this.container.querySelectorAll('.queue-item');
        queueItems.forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.assignmentId;
                if (this.onViewAssignment) {
                    const assignment = this.assignments.find(a => a.id === id);
                    this.onViewAssignment(assignment);
                }
            });
        });
    }

    formatDueDate(dateStr) {
        if (!dateStr) return null;

        const due = new Date(dateStr);
        const now = new Date();
        const diffMs = due - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
        if (diffDays === 0) return 'Due today';
        if (diffDays === 1) return 'Due tomorrow';
        if (diffDays <= 7) return `Due in ${diffDays}d`;
        return `Due ${due.toLocaleDateString()}`;
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = typeof document !== 'undefined' ? document.createElement('div') : null;
        if (div) {
            div.textContent = str;
            return div.innerHTML;
        }
        return str.replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[c]);
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.UpNextWidget = UpNextWidget;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UpNextWidget;
}
