/**
 * Teacher Report Component - UI for generating and sharing practice session reports
 * Features: date range selection, metric toggles, teacher notes, PDF export, email sharing
 */

class TeacherReport {
    constructor(pdfExportService) {
        this.pdfExportService = pdfExportService;
        this.container = null;
        this.options = {
            dateRange: { start: null, end: null },
            metrics: { pitch: true, rhythm: true, intonation: true },
            teacherNotes: '',
            studentName: '',
            scoreInfo: {}
        };
        this.visible = false;
    }

    /**
     * Initialize the teacher report component
     * @param {HTMLElement|string} container - Container element or selector
     */
    init(container) {
        if (typeof container === 'string') {
            this.container = document.querySelector(container);
        } else {
            this.container = container;
        }

        if (this.container) {
            this.render();
        }
    }

    /**
     * Show the report panel
     * @param {Object} sessionData - Current session data
     * @param {Object} scoreInfo - Score metadata
     */
    show(sessionData = {}, scoreInfo = {}) {
        this.sessionData = sessionData;
        this.options.scoreInfo = scoreInfo;
        this.visible = true;
        this.render();
    }

    /**
     * Hide the report panel
     */
    hide() {
        this.visible = false;
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    /**
     * Render the teacher report UI
     */
    render() {
        if (!this.container || !this.visible) return;

        this.container.innerHTML = '';
        this.container.className = 'teacher-report-panel';

        // Header
        const header = this._createElement('div', 'teacher-report-header');
        header.innerHTML = `
            <h2 style="color: var(--primary, #c9a227); margin: 0; font-family: 'Playfair Display', serif;">
                Practice Report
            </h2>
            <button class="teacher-report-close" aria-label="Close report panel">&times;</button>
        `;
        this.container.appendChild(header);

        const closeBtn = header.querySelector('.teacher-report-close');
        closeBtn.addEventListener('click', () => this.hide());

        // Form container
        const form = this._createElement('div', 'teacher-report-form');

        // Student name
        form.appendChild(this._createField('Student Name', 'text', 'studentName', this.options.studentName));

        // Date range
        const dateSection = this._createElement('div', 'teacher-report-date-range');
        dateSection.innerHTML = `
            <label style="color: var(--text-secondary, #a0a0b0); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                Date Range
            </label>
            <div style="display: flex; gap: 10px; margin-top: 5px;">
                <input type="date" class="report-date-start" value="${this.options.dateRange.start || ''}"
                    style="flex: 1; background: var(--bg-elevated, #1a1a28); color: var(--text-primary, #f5f5dc); border: 1px solid var(--primary, #c9a227); border-radius: 4px; padding: 8px;">
                <span style="color: var(--text-secondary, #a0a0b0); align-self: center;">to</span>
                <input type="date" class="report-date-end" value="${this.options.dateRange.end || ''}"
                    style="flex: 1; background: var(--bg-elevated, #1a1a28); color: var(--text-primary, #f5f5dc); border: 1px solid var(--primary, #c9a227); border-radius: 4px; padding: 8px;">
            </div>
        `;
        form.appendChild(dateSection);

        // Metric toggles
        const metricsSection = this._createElement('div', 'teacher-report-metrics');
        metricsSection.innerHTML = `
            <label style="color: var(--text-secondary, #a0a0b0); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                Include Metrics
            </label>
            <div style="display: flex; gap: 15px; margin-top: 8px;">
                ${this._createToggle('Pitch', 'pitch', this.options.metrics.pitch)}
                ${this._createToggle('Rhythm', 'rhythm', this.options.metrics.rhythm)}
                ${this._createToggle('Intonation', 'intonation', this.options.metrics.intonation)}
            </div>
        `;
        form.appendChild(metricsSection);

        // Teacher notes textarea
        const notesSection = this._createElement('div', 'teacher-report-notes');
        notesSection.innerHTML = `
            <label style="color: var(--text-secondary, #a0a0b0); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                Teacher Notes
            </label>
            <textarea class="report-teacher-notes" rows="4"
                placeholder="Add notes for the student..."
                style="width: 100%; margin-top: 5px; background: var(--bg-elevated, #1a1a28); color: var(--text-primary, #f5f5dc); border: 1px solid var(--primary, #c9a227); border-radius: 4px; padding: 8px; font-family: 'Source Sans 3', sans-serif; resize: vertical;"
            >${this.options.teacherNotes}</textarea>
        `;
        form.appendChild(notesSection);

        // Action buttons
        const actions = this._createElement('div', 'teacher-report-actions');
        actions.style.cssText = 'display: flex; gap: 10px; margin-top: 15px;';

        const generateBtn = this._createButton('Generate PDF', 'primary');
        generateBtn.addEventListener('click', () => this._handleGenerate());

        const shareBtn = this._createButton('Share via Email', 'secondary');
        shareBtn.addEventListener('click', () => this._handleShare());

        const linkBtn = this._createButton('Copy Link', 'secondary');
        linkBtn.addEventListener('click', () => this._handleCopyLink());

        actions.appendChild(generateBtn);
        actions.appendChild(shareBtn);
        actions.appendChild(linkBtn);
        form.appendChild(actions);

        // Status message area
        const status = this._createElement('div', 'teacher-report-status');
        status.style.cssText = 'margin-top: 10px; color: var(--text-secondary, #a0a0b0); font-size: 13px; min-height: 20px;';
        form.appendChild(status);

        this.container.appendChild(form);
        this._bindFormEvents(form);
    }

    /**
     * Collect current form values
     * @returns {Object} Current form options
     */
    getOptions() {
        if (!this.container) return this.options;

        const studentInput = this.container.querySelector('.report-student-name');
        const startInput = this.container.querySelector('.report-date-start');
        const endInput = this.container.querySelector('.report-date-end');
        const notesInput = this.container.querySelector('.report-teacher-notes');

        if (studentInput) this.options.studentName = studentInput.value;
        if (startInput) this.options.dateRange.start = startInput.value || null;
        if (endInput) this.options.dateRange.end = endInput.value || null;
        if (notesInput) this.options.teacherNotes = notesInput.value;

        // Collect metric toggle states
        const toggles = this.container.querySelectorAll('.metric-toggle input');
        toggles.forEach(toggle => {
            this.options.metrics[toggle.dataset.metric] = toggle.checked;
        });

        return this.options;
    }

    /**
     * Handle PDF generation
     * @private
     */
    _handleGenerate() {
        const options = this.getOptions();
        const result = this.pdfExportService.generateReport({
            sessionLog: this.sessionData?.sessionLog || {},
            summaryStats: this.sessionData?.summaryStats || {},
            scoreInfo: options.scoreInfo,
            dateRange: options.dateRange,
            metrics: options.metrics,
            teacherNotes: options.teacherNotes,
            studentName: options.studentName,
            heatMapData: this.sessionData?.heatMapData || []
        });

        this._setStatus(`PDF generated (${result.pageCount} pages)`, 'success');

        // Trigger download
        if (result.download) {
            const filename = `practice-report-${options.studentName || 'student'}-${new Date().toISOString().split('T')[0]}.pdf`;
            result.download(filename);
        }

        return result;
    }

    /**
     * Handle email sharing
     * @private
     */
    _handleShare() {
        const options = this.getOptions();
        const result = this.pdfExportService.generateReport({
            sessionLog: this.sessionData?.sessionLog || {},
            summaryStats: this.sessionData?.summaryStats || {},
            scoreInfo: options.scoreInfo,
            dateRange: options.dateRange,
            metrics: options.metrics,
            teacherNotes: options.teacherNotes,
            studentName: options.studentName,
            heatMapData: this.sessionData?.heatMapData || []
        });

        const email = prompt ? prompt('Enter recipient email:') : '';
        if (email) {
            this.pdfExportService.shareViaEmail(email, result, options.teacherNotes);
            this._setStatus(`Report shared to ${email}`, 'success');
        }
    }

    /**
     * Handle copy link
     * @private
     */
    _handleCopyLink() {
        const options = this.getOptions();
        const link = this.pdfExportService.generateShareLink({
            student: options.studentName,
            score: options.scoreInfo,
            generatedAt: new Date().toISOString(),
            statistics: this.sessionData?.summaryStats || {}
        });

        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(link).then(() => {
                this._setStatus('Link copied to clipboard', 'success');
            });
        } else {
            this._setStatus('Link generated', 'success');
        }

        return link;
    }

    /**
     * Set status message
     * @param {string} message
     * @param {string} type - 'success', 'error', 'info'
     * @private
     */
    _setStatus(message, type = 'info') {
        const status = this.container?.querySelector('.teacher-report-status');
        if (status) {
            const colors = {
                success: 'var(--success, #2d5a4a)',
                error: 'var(--error, #8b2942)',
                info: 'var(--text-secondary, #a0a0b0)'
            };
            status.style.color = colors[type] || colors.info;
            status.textContent = message;
        }
    }

    /**
     * Bind form input events
     * @param {HTMLElement} form
     * @private
     */
    _bindFormEvents(form) {
        const inputs = form.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('change', () => this.getOptions());
        });
    }

    /**
     * Create a form field
     * @param {string} label
     * @param {string} type
     * @param {string} name
     * @param {string} value
     * @returns {HTMLElement}
     * @private
     */
    _createField(label, type, name, value = '') {
        const field = this._createElement('div', 'teacher-report-field');
        field.innerHTML = `
            <label style="color: var(--text-secondary, #a0a0b0); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                ${label}
            </label>
            <input type="${type}" class="report-${this._toKebab(name)}" value="${value || ''}"
                style="width: 100%; margin-top: 5px; background: var(--bg-elevated, #1a1a28); color: var(--text-primary, #f5f5dc); border: 1px solid var(--primary, #c9a227); border-radius: 4px; padding: 8px;">
        `;
        return field;
    }

    /**
     * Create a toggle switch HTML
     * @param {string} label
     * @param {string} metric
     * @param {boolean} checked
     * @returns {string} HTML string
     * @private
     */
    _createToggle(label, metric, checked) {
        return `
            <label class="metric-toggle" style="display: flex; align-items: center; gap: 5px; color: var(--text-primary, #f5f5dc); cursor: pointer;">
                <input type="checkbox" data-metric="${metric}" ${checked ? 'checked' : ''}
                    style="accent-color: var(--primary, #c9a227);">
                ${label}
            </label>
        `;
    }

    /**
     * Create a styled button
     * @param {string} text
     * @param {string} variant - 'primary' or 'secondary'
     * @returns {HTMLElement}
     * @private
     */
    _createButton(text, variant = 'primary') {
        const btn = this._createElement('button', `teacher-report-btn ${variant}`);
        btn.textContent = text;

        const styles = variant === 'primary'
            ? 'background: var(--primary, #c9a227); color: var(--bg-deep, #0a0a12); border: none;'
            : 'background: transparent; color: var(--primary, #c9a227); border: 1px solid var(--primary, #c9a227);';

        btn.style.cssText = `${styles} padding: 10px 16px; border-radius: 4px; cursor: pointer; font-family: 'Source Sans 3', sans-serif; font-weight: 600;`;
        return btn;
    }

    /**
     * Helper to create an element with a class
     * @param {string} tag
     * @param {string} className
     * @returns {HTMLElement}
     * @private
     */
    _createElement(tag, className) {
        const el = document.createElement(tag);
        el.className = className;
        return el;
    }

    /**
     * Convert camelCase to kebab-case
     * @param {string} str
     * @returns {string}
     * @private
     */
    _toKebab(str) {
        return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    }
}

if (typeof window !== 'undefined') {
    window.TeacherReport = TeacherReport;
}
if (typeof module !== 'undefined') {
    module.exports = TeacherReport;
}
