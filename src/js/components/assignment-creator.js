/**
 * Assignment Creator Component
 * Teacher UI for creating and managing homework assignments
 */

class AssignmentCreator {
    constructor(container, options = {}) {
        this.container = container;
        this.assignmentService = options.assignmentService || null;
        this.libraryService = options.libraryService || null;
        this.onAssignmentCreated = options.onAssignmentCreated || null;
        this.onClose = options.onClose || null;

        this.selectedScore = null;
        this.selectedStudent = null;
        this.scores = [];
        this.students = [];
    }

    async init() {
        if (this.libraryService) {
            try {
                this.scores = await this.libraryService.getAllScores();
            } catch (e) {
                this.scores = [];
            }
        }

        if (this.assignmentService) {
            try {
                const teacherId = this.assignmentService.getCurrentUserId();
                if (teacherId) {
                    const rels = await this.assignmentService.getRelationships(teacherId);
                    this.students = rels;
                }
            } catch (e) {
                this.students = [];
            }
        }

        this.render();
        this.attachEventListeners();
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="assignment-creator">
                <div class="assignment-creator-header">
                    <h2>Create Assignment</h2>
                    <button class="btn btn-icon assignment-close-btn" aria-label="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <form class="assignment-form" id="assignment-form">
                    <!-- Student Selection -->
                    <div class="form-group">
                        <label for="assignment-student">Student</label>
                        <select id="assignment-student" class="form-select" required>
                            <option value="">Select a student...</option>
                            ${this.students.map(s => `
                                <option value="${s.studentId}">${s.studentId}</option>
                            `).join('')}
                        </select>
                        <button type="button" class="btn btn-ghost btn-sm" id="add-student-btn">
                            + Add Student
                        </button>
                    </div>

                    <!-- Piece Selection -->
                    <div class="form-group">
                        <label for="assignment-score">Piece from Library</label>
                        <select id="assignment-score" class="form-select" required>
                            <option value="">Select a piece...</option>
                            ${this.scores.map(s => `
                                <option value="${s.id}">${s.title} - ${s.composer || 'Unknown'}</option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Assignment Title -->
                    <div class="form-group">
                        <label for="assignment-title">Assignment Title</label>
                        <input type="text" id="assignment-title" class="form-input"
                               placeholder="e.g., Practice measures 14-32 at 80 BPM"
                               required>
                    </div>

                    <!-- Measure Range -->
                    <div class="form-group form-row">
                        <div class="form-col">
                            <label for="assignment-measure-start">Start Measure</label>
                            <input type="number" id="assignment-measure-start" class="form-input"
                                   min="1" value="1" required>
                        </div>
                        <div class="form-col">
                            <label for="assignment-measure-end">End Measure</label>
                            <input type="number" id="assignment-measure-end" class="form-input"
                                   min="1" placeholder="(end)">
                        </div>
                    </div>

                    <!-- Target BPM -->
                    <div class="form-group">
                        <label for="assignment-bpm">Target BPM</label>
                        <div class="form-range-display">
                            <input type="range" id="assignment-bpm" class="form-range"
                                   min="40" max="200" value="80">
                            <span class="range-value" id="bpm-value">80 BPM</span>
                        </div>
                    </div>

                    <!-- Intonation Threshold -->
                    <div class="form-group">
                        <label for="assignment-intonation">Intonation Target</label>
                        <div class="form-range-display">
                            <input type="range" id="assignment-intonation" class="form-range"
                                   min="50" max="100" value="90">
                            <span class="range-value" id="intonation-value">90%</span>
                        </div>
                    </div>

                    <!-- Due Date -->
                    <div class="form-group">
                        <label for="assignment-due-date">Due Date</label>
                        <input type="date" id="assignment-due-date" class="form-input">
                    </div>

                    <!-- Notes -->
                    <div class="form-group">
                        <label for="assignment-notes">Teacher Notes</label>
                        <textarea id="assignment-notes" class="form-textarea"
                                  placeholder="Additional instructions or tips..."
                                  rows="3"></textarea>
                    </div>

                    <!-- Target Summary -->
                    <div class="assignment-target-summary" id="target-summary">
                        <div class="target-summary-label">Target:</div>
                        <div class="target-summary-value" id="target-summary-text">
                            80 BPM until 90% Intonation
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="form-actions">
                        <button type="button" class="btn btn-ghost" id="assignment-cancel-btn">Cancel</button>
                        <button type="submit" class="btn btn-primary" id="assignment-submit-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="22" y1="2" x2="11" y2="13"/>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                            </svg>
                            Send Assignment
                        </button>
                    </div>
                </form>
            </div>

            <!-- Add Student Modal -->
            <div class="add-student-overlay" id="add-student-overlay" style="display: none;">
                <div class="add-student-modal">
                    <h3>Add Student</h3>
                    <div class="form-group">
                        <label for="new-student-id">Student ID</label>
                        <input type="text" id="new-student-id" class="form-input"
                               placeholder="Enter student ID">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-ghost" id="cancel-add-student">Cancel</button>
                        <button type="button" class="btn btn-primary" id="confirm-add-student">Add</button>
                    </div>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        if (!this.container) return;

        // Form submission
        const form = this.container.querySelector('#assignment-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Close button
        const closeBtn = this.container.querySelector('.assignment-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Cancel button
        const cancelBtn = this.container.querySelector('#assignment-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.close());
        }

        // BPM slider
        const bpmSlider = this.container.querySelector('#assignment-bpm');
        if (bpmSlider) {
            bpmSlider.addEventListener('input', (e) => {
                const display = this.container.querySelector('#bpm-value');
                if (display) display.textContent = `${e.target.value} BPM`;
                this.updateTargetSummary();
            });
        }

        // Intonation slider
        const intonationSlider = this.container.querySelector('#assignment-intonation');
        if (intonationSlider) {
            intonationSlider.addEventListener('input', (e) => {
                const display = this.container.querySelector('#intonation-value');
                if (display) display.textContent = `${e.target.value}%`;
                this.updateTargetSummary();
            });
        }

        // Add student
        const addStudentBtn = this.container.querySelector('#add-student-btn');
        if (addStudentBtn) {
            addStudentBtn.addEventListener('click', () => this.showAddStudent());
        }

        const cancelAddStudent = this.container.querySelector('#cancel-add-student');
        if (cancelAddStudent) {
            cancelAddStudent.addEventListener('click', () => this.hideAddStudent());
        }

        const confirmAddStudent = this.container.querySelector('#confirm-add-student');
        if (confirmAddStudent) {
            confirmAddStudent.addEventListener('click', () => this.addStudent());
        }

        // Score selection
        const scoreSelect = this.container.querySelector('#assignment-score');
        if (scoreSelect) {
            scoreSelect.addEventListener('change', (e) => {
                this.selectedScore = this.scores.find(s => s.id === e.target.value) || null;
            });
        }
    }

    updateTargetSummary() {
        const bpm = this.container.querySelector('#assignment-bpm')?.value || 80;
        const intonation = this.container.querySelector('#assignment-intonation')?.value || 90;
        const summaryText = this.container.querySelector('#target-summary-text');
        if (summaryText) {
            summaryText.textContent = `${bpm} BPM until ${intonation}% Intonation`;
        }
    }

    showAddStudent() {
        const overlay = this.container.querySelector('#add-student-overlay');
        if (overlay) overlay.style.display = 'flex';
    }

    hideAddStudent() {
        const overlay = this.container.querySelector('#add-student-overlay');
        if (overlay) overlay.style.display = 'none';
        const input = this.container.querySelector('#new-student-id');
        if (input) input.value = '';
    }

    async addStudent() {
        const input = this.container.querySelector('#new-student-id');
        const studentId = input?.value?.trim();
        if (!studentId) return;

        const teacherId = this.assignmentService?.getCurrentUserId();
        if (!teacherId || !this.assignmentService) return;

        try {
            await this.assignmentService.addRelationship(teacherId, studentId);
            this.students.push({ studentId, teacherId });

            // Update dropdown
            const select = this.container.querySelector('#assignment-student');
            if (select) {
                const option = document.createElement('option');
                option.value = studentId;
                option.textContent = studentId;
                select.appendChild(option);
                select.value = studentId;
            }

            this.hideAddStudent();
        } catch (e) {
            console.error('Failed to add student:', e);
        }
    }

    async handleSubmit(e) {
        e.preventDefault();

        const studentId = this.container.querySelector('#assignment-student')?.value;
        const scoreId = this.container.querySelector('#assignment-score')?.value;
        const title = this.container.querySelector('#assignment-title')?.value;
        const measureStart = parseInt(this.container.querySelector('#assignment-measure-start')?.value) || 1;
        const measureEnd = parseInt(this.container.querySelector('#assignment-measure-end')?.value) || null;
        const bpm = parseInt(this.container.querySelector('#assignment-bpm')?.value) || 80;
        const intonation = parseInt(this.container.querySelector('#assignment-intonation')?.value) || 90;
        const dueDate = this.container.querySelector('#assignment-due-date')?.value || null;
        const notes = this.container.querySelector('#assignment-notes')?.value || '';

        if (!studentId || !scoreId || !title) {
            return;
        }

        const teacherId = this.assignmentService?.getCurrentUserId();
        if (!teacherId || !this.assignmentService) return;

        try {
            const assignment = await this.assignmentService.createAssignment({
                teacherId,
                studentId,
                scoreId,
                title,
                measures: { start: measureStart, end: measureEnd },
                target: { bpm, intonationThreshold: intonation },
                dueDate: dueDate ? new Date(dueDate).toISOString() : null,
                notes
            });

            if (this.onAssignmentCreated) {
                this.onAssignmentCreated(assignment);
            }

            this.close();
        } catch (e) {
            console.error('Failed to create assignment:', e);
        }
    }

    close() {
        if (this.onClose) {
            this.onClose();
        }
    }

    /**
     * Get the form data as an object (for testing)
     */
    getFormData() {
        return {
            studentId: this.container?.querySelector('#assignment-student')?.value || '',
            scoreId: this.container?.querySelector('#assignment-score')?.value || '',
            title: this.container?.querySelector('#assignment-title')?.value || '',
            measureStart: parseInt(this.container?.querySelector('#assignment-measure-start')?.value) || 1,
            measureEnd: parseInt(this.container?.querySelector('#assignment-measure-end')?.value) || null,
            bpm: parseInt(this.container?.querySelector('#assignment-bpm')?.value) || 80,
            intonation: parseInt(this.container?.querySelector('#assignment-intonation')?.value) || 90,
            dueDate: this.container?.querySelector('#assignment-due-date')?.value || null,
            notes: this.container?.querySelector('#assignment-notes')?.value || ''
        };
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.AssignmentCreator = AssignmentCreator;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AssignmentCreator;
}
