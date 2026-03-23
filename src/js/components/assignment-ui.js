/**
 * Assignment UI - Smart Assignments & Routine Builder
 * UI component for teachers to create and manage assignments
 */

class AssignmentUI {
    constructor(assignmentService, teacherService, libraryService) {
        this.assignmentService = assignmentService;
        this.teacherService = teacherService;
        this.libraryService = libraryService;
        this.container = null;
        this.students = [];
        this.assignments = [];
        this.selectedStudent = null;
        this.onAssignmentCreated = null;
        this._teacherId = null;
    }

    /**
     * Get the current teacher ID from localStorage
     */
    get teacherId() {
        if (this._teacherId) return this._teacherId;
        this._teacherId = localStorage.getItem('teacher_id') || 'teacher-' + Date.now();
        return this._teacherId;
    }

    set teacherId(id) {
        this._teacherId = id;
        localStorage.setItem('teacher_id', id);
    }

    /**
     * Initialize the assignment UI
     */
    async init() {
        this.container = document.getElementById('assignments-section');
        if (!this.container) return;

        await this.assignmentService.init();
        await this.teacherService.init();
        await this.libraryService.init();

        this.assignmentService.onUpdate = () => this.refresh();
        this.teacherService.onUpdate = () => this.refresh();

        await this.refresh();
        this.bindEvents();
    }

    /**
     * Refresh data and re-render
     */
    async refresh() {
        try {
            // Ensure we have a teacher ID
            if (!localStorage.getItem('teacher_id')) {
                this.teacherId = 'teacher-' + Date.now();
            }

            this.students = await this.teacherService.getAllStudents();
            this.assignments = await this.assignmentService.getTeacherAssignments(this.teacherId);
            this.render();
        } catch (err) {
            console.error('Failed to refresh assignments:', err);
        }
    }

    /**
     * Render the assignments UI
     */
    render() {
        if (!this.container) return;

        const content = this.container.querySelector('.assignments-content');
        if (!content) return;

        content.innerHTML = `
            ${this._renderAssignmentStats()}
            ${this._renderCreateAssignmentForm()}
            ${this._renderAssignmentsList()}
        `;

        this._bindDynamicEvents();
    }

    /**
     * Render assignment statistics
     */
    _renderAssignmentStats() {
        // Calculate stats from current assignments
        const now = Date.now();
        const computedStats = {
            total: this.assignments.length,
            assigned: this.assignments.filter(a => a.status === 'assigned').length,
            inProgress: this.assignments.filter(a => a.status === 'in_progress').length,
            completed: this.assignments.filter(a => a.status === 'completed').length,
            overdue: this.assignments.filter(a =>
                a.dueDate && a.dueDate < now && a.status !== 'completed'
            ).length
        };

        return `
            <div class="assignment-stats" role="region" aria-label="Assignment statistics">
                <div class="stat-card">
                    <div class="stat-value">${computedStats.total}</div>
                    <div class="stat-label">Total</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${computedStats.assigned}</div>
                    <div class="stat-label">Assigned</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${computedStats.inProgress}</div>
                    <div class="stat-label">In Progress</div>
                </div>
                <div class="stat-card completed">
                    <div class="stat-value">${computedStats.completed}</div>
                    <div class="stat-label">Completed</div>
                </div>
                <div class="stat-card overdue">
                    <div class="stat-value">${computedStats.overdue}</div>
                    <div class="stat-label">Overdue</div>
                </div>
            </div>
        `;
    }

    /**
     * Render the create assignment form
     */
    _renderCreateAssignmentForm() {
        return `
            <div class="create-assignment-section">
                <h3 class="section-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="title-icon">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Create New Assignment
                </h3>

                <form id="create-assignment-form" class="assignment-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="assignment-student">Student</label>
                            <select id="assignment-student" required>
                                <option value="">Select a student...</option>
                                ${this.students.map(s =>
                                    `<option value="${this._escapeHtml(s.id)}">${this._escapeHtml(s.name)}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="assignment-title">Assignment Title</label>
                            <input type="text" id="assignment-title" placeholder="e.g., Scales Practice" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="assignment-piece">Piece</label>
                            <select id="assignment-piece">
                                <option value="">Select a piece (optional)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="assignment-due-date">Due Date</label>
                            <input type="date" id="assignment-due-date">
                        </div>
                    </div>

                    <div class="form-section">
                        <h4>Measure Range</h4>
                        <div class="form-row measure-range">
                            <div class="form-group">
                                <label for="measure-start">Start Measure</label>
                                <input type="number" id="measure-start" min="1" value="1">
                            </div>
                            <span class="range-separator">to</span>
                            <div class="form-group">
                                <label for="measure-end">End Measure</label>
                                <input type="number" id="measure-end" min="1" placeholder="End">
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h4>Practice Targets</h4>
                        <div class="form-row targets">
                            <div class="form-group">
                                <label for="target-tempo">Target Tempo (BPM)</label>
                                <input type="number" id="target-tempo" min="20" max="300" placeholder="e.g., 80">
                            </div>
                            <div class="form-group">
                                <label for="target-intonation">Target Intonation (%)</label>
                                <input type="number" id="target-intonation" min="0" max="100" placeholder="e.g., 90">
                            </div>
                            <div class="form-group">
                                <label for="target-accuracy">Target Accuracy (%)</label>
                                <input type="number" id="target-accuracy" min="0" max="100" placeholder="e.g., 85">
                            </div>
                        </div>
                    </div>

                    <div class="form-group full-width">
                        <label for="assignment-description">Description / Notes</label>
                        <textarea id="assignment-description" rows="3" placeholder="Additional instructions for the student..."></textarea>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="assignment-priority">Priority</label>
                            <select id="assignment-priority">
                                <option value="low">Low</option>
                                <option value="normal" selected>Normal</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary btn-create-assignment">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                        </svg>
                        Send Assignment
                    </button>
                </form>
            </div>
        `;
    }

    /**
     * Render the assignments list
     */
    _renderAssignmentsList() {
        if (this.assignments.length === 0) {
            return `
                <div class="assignments-list-section">
                    <h3 class="section-title">Recent Assignments</h3>
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                        </svg>
                        <h3>No assignments yet</h3>
                        <p>Create an assignment to send practice tasks to your students</p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="assignments-list-section">
                <h3 class="section-title">Recent Assignments</h3>
                <div class="assignments-list">
                    ${this.assignments.map(a => this._renderAssignmentCard(a)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render a single assignment card
     */
    _renderAssignmentCard(assignment) {
        const student = this.students.find(s => s.id === assignment.studentId);
        const studentName = student ? student.name : 'Unknown Student';
        const dueDateStr = this.assignmentService.formatDueDate(assignment.dueDate);
        const measureRange = this.assignmentService.getMeasureRange(assignment);
        const targets = this.assignmentService.getTargetSummary(assignment);
        const now = Date.now();
        const isOverdue = assignment.dueDate && assignment.dueDate < now && assignment.status !== 'completed';

        const statusClass = assignment.status === 'completed' ? 'completed' :
                           isOverdue ? 'overdue' :
                           assignment.status === 'in_progress' ? 'in-progress' : 'assigned';

        return `
            <div class="assignment-card" data-assignment-id="${this._escapeHtml(assignment.id)}">
                <div class="assignment-header">
                    <div class="assignment-info">
                        <h4 class="assignment-title">${this._escapeHtml(assignment.title || 'Untitled Assignment')}</h4>
                        <span class="assignment-student">${this._escapeHtml(studentName)}</span>
                    </div>
                    <span class="assignment-status ${statusClass}">${this._escapeHtml(assignment.status)}</span>
                </div>
                <div class="assignment-details">
                    <div class="detail-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 18V5l12-2v13"/>
                            <circle cx="6" cy="18" r="3"/>
                            <circle cx="18" cy="16" r="3"/>
                        </svg>
                        <span>${this._escapeHtml(assignment.pieceTitle || 'No piece selected')}</span>
                    </div>
                    <div class="detail-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                        <span>${measureRange}</span>
                    </div>
                    <div class="detail-item ${isOverdue ? 'overdue-text' : ''}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span>${dueDateStr}</span>
                    </div>
                    <div class="detail-item targets">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <circle cx="12" cy="12" r="6"/>
                            <circle cx="12" cy="12" r="2"/>
                        </svg>
                        <span>${targets}</span>
                    </div>
                </div>
                <div class="assignment-actions">
                    <button class="btn btn-ghost btn-sm view-progress-btn" data-assignment-id="${this._escapeHtml(assignment.id)}">
                        View Progress
                    </button>
                    <button class="btn btn-ghost btn-sm edit-btn" data-assignment-id="${this._escapeHtml(assignment.id)}">
                        Edit
                    </button>
                    <button class="btn btn-ghost btn-sm delete-btn" data-assignment-id="${this._escapeHtml(assignment.id)}">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Bind events
     */
    bindEvents() {
        if (!this.container) return;

        // Form submission
        const form = this.container.querySelector('#create-assignment-form');
        if (form) {
            form.addEventListener('submit', (e) => this._handleCreateAssignment(e));
        }
    }

    /**
     * Bind dynamic events (called after re-render)
     */
    _bindDynamicEvents() {
        if (!this.container) return;

        // View progress buttons
        this.container.querySelectorAll('.view-progress-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const assignmentId = e.currentTarget.dataset.assignmentId;
                this._showProgressModal(assignmentId);
            });
        });

        // Edit buttons
        this.container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const assignmentId = e.currentTarget.dataset.assignmentId;
                this._editAssignment(assignmentId);
            });
        });

        // Delete buttons
        this.container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const assignmentId = e.currentTarget.dataset.assignmentId;
                this._deleteAssignment(assignmentId);
            });
        });
    }

    /**
     * Handle create assignment form submission
     */
    async _handleCreateAssignment(e) {
        e.preventDefault();

        const studentId = document.getElementById('assignment-student')?.value;
        const title = document.getElementById('assignment-title')?.value;
        const pieceId = document.getElementById('assignment-piece')?.value;
        const pieceTitle = document.getElementById('assignment-piece')?.selectedOptions?.[0]?.text || '';
        const dueDateStr = document.getElementById('assignment-due-date')?.value;
        const measureStart = parseInt(document.getElementById('measure-start')?.value) || 1;
        const measureEnd = parseInt(document.getElementById('measure-end')?.value) || null;
        const targetTempo = parseInt(document.getElementById('target-tempo')?.value) || null;
        const targetIntonation = parseInt(document.getElementById('target-intonation')?.value) || null;
        const targetAccuracy = parseInt(document.getElementById('target-accuracy')?.value) || null;
        const description = document.getElementById('assignment-description')?.value || '';
        const priority = document.getElementById('assignment-priority')?.value || 'normal';

        if (!studentId || !title) {
            this._showToast('Please fill in all required fields', 'error');
            return;
        }

        // Convert date string to timestamp
        let dueDate = null;
        if (dueDateStr) {
            dueDate = new Date(dueDateStr).getTime();
        }

        try {
            await this.assignmentService.createAssignment({
                teacherId: this.teacherId,
                studentId,
                pieceId,
                pieceTitle: pieceTitle !== 'Select a piece (optional)' ? pieceTitle : '',
                title,
                description,
                measureStart,
                measureEnd,
                targetTempo,
                targetIntonation,
                targetAccuracy,
                dueDate,
                priority
            });

            this._showToast('Assignment sent successfully!', 'success');

            // Reset form
            e.target.reset();
            document.getElementById('measure-start').value = '1';

            if (this.onAssignmentCreated) {
                this.onAssignmentCreated();
            }
        } catch (err) {
            console.error('Failed to create assignment:', err);
            this._showToast('Failed to create assignment', 'error');
        }
    }

    /**
     * Show progress modal for an assignment
     */
    async _showProgressModal(assignmentId) {
        const assignment = await this.assignmentService.getAssignment(assignmentId);
        if (!assignment) return;

        const progress = await this.assignmentService.getAssignmentProgress(assignmentId);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal assignment-progress-modal">
                <div class="modal-header">
                    <h3>Assignment Progress</h3>
                    <button class="modal-close" aria-label="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="progress-assignment-info">
                        <h4>${this._escapeHtml(assignment.title)}</h4>
                        <p>${this._escapeHtml(assignment.pieceTitle || 'No piece')}</p>
                        <p>Measures: ${assignment.measureStart}${assignment.measureEnd ? `-${assignment.measureEnd}` : '+'}</p>
                    </div>
                    ${progress.length === 0 ? `
                        <div class="empty-progress">
                            <p>No practice sessions recorded yet</p>
                        </div>
                    ` : `
                        <div class="progress-list">
                            ${progress.map(p => `
                                <div class="progress-item">
                                    <div class="progress-date">${new Date(p.recordedAt).toLocaleDateString()}</div>
                                    <div class="progress-metrics">
                                        ${p.tempoAchieved ? `<span>Tempo: ${p.tempoAchieved} BPM</span>` : ''}
                                        ${p.intonationScore !== null ? `<span>Intonation: ${p.intonationScore}%</span>` : ''}
                                        ${p.accuracyScore !== null ? `<span>Accuracy: ${p.accuracyScore}%</span>` : ''}
                                    </div>
                                    ${p.notes ? `<div class="progress-notes">${this._escapeHtml(p.notes)}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Bind modal events
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            // Close if clicking on the overlay backdrop (not on the modal content)
            const modalContent = modal.querySelector('.modal');
            if (e.target === modal || (modalContent && !modalContent.contains(e.target))) {
                modal.remove();
            }
        });
    }

    /**
     * Edit an assignment (opens form with pre-filled values)
     */
    _editAssignment(assignmentId) {
        // TODO: Implement edit functionality
        this._showToast('Edit functionality coming soon', 'info');
    }

    /**
     * Delete an assignment
     */
    async _deleteAssignment(assignmentId) {
        if (!confirm('Are you sure you want to delete this assignment?')) return;

        try {
            await this.assignmentService.deleteAssignment(assignmentId);
            this._showToast('Assignment deleted', 'success');
        } catch (err) {
            console.error('Failed to delete assignment:', err);
            this._showToast('Failed to delete assignment', 'error');
        }
    }

    /**
     * Show a toast notification
     */
    _showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 3000);
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
    module.exports = AssignmentUI;
} else if (typeof window !== 'undefined') {
    window.AssignmentUI = AssignmentUI;
}
