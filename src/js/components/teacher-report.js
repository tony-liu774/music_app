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
     * Uses DOM API instead of innerHTML to prevent XSS
     */
    render() {
        if (!this.container || !this.visible) return;

        this.container.innerHTML = '';
        this.container.className = 'teacher-report-panel';

        // Header
        const header = this._createElement('div', 'teacher-report-header');
        const h2 = document.createElement('h2');
        h2.style.cssText = "color: var(--primary, #c9a227); margin: 0; font-family: 'Playfair Display', serif;";
        h2.textContent = 'Practice Report';
        header.appendChild(h2);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'teacher-report-close';
        closeBtn.setAttribute('aria-label', 'Close report panel');
        closeBtn.textContent = '\u00D7';
        closeBtn.addEventListener('click', () => this.hide());
        header.appendChild(closeBtn);
        this.container.appendChild(header);

        // Form container
        const form = this._createElement('div', 'teacher-report-form');

        // Student name
        form.appendChild(this._createField('Student Name', 'text', 'studentName', this.options.studentName));

        // Date range
        const dateSection = this._createElement('div', 'teacher-report-date-range');
        const dateLabel = document.createElement('label');
        dateLabel.style.cssText = 'color: var(--text-secondary, #a0a0b0); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;';
        dateLabel.textContent = 'Date Range';
        dateSection.appendChild(dateLabel);

        const dateRow = document.createElement('div');
        dateRow.style.cssText = 'display: flex; gap: 10px; margin-top: 5px;';

        const startInput = document.createElement('input');
        startInput.type = 'date';
        startInput.className = 'report-date-start';
        startInput.value = this.options.dateRange.start || '';
        startInput.style.cssText = 'flex: 1; background: var(--bg-elevated, #1a1a28); color: var(--text-primary, #f5f5dc); border: 1px solid var(--primary, #c9a227); border-radius: 4px; padding: 8px;';

        const toSpan = document.createElement('span');
        toSpan.style.cssText = 'color: var(--text-secondary, #a0a0b0); align-self: center;';
        toSpan.textContent = 'to';

        const endInput = document.createElement('input');
        endInput.type = 'date';
        endInput.className = 'report-date-end';
        endInput.value = this.options.dateRange.end || '';
        endInput.style.cssText = 'flex: 1; background: var(--bg-elevated, #1a1a28); color: var(--text-primary, #f5f5dc); border: 1px solid var(--primary, #c9a227); border-radius: 4px; padding: 8px;';

        dateRow.appendChild(startInput);
        dateRow.appendChild(toSpan);
        dateRow.appendChild(endInput);
        dateSection.appendChild(dateRow);
        form.appendChild(dateSection);

        // Metric toggles
        const metricsSection = this._createElement('div', 'teacher-report-metrics');
        const metricsLabel = document.createElement('label');
        metricsLabel.style.cssText = 'color: var(--text-secondary, #a0a0b0); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;';
        metricsLabel.textContent = 'Include Metrics';
        metricsSection.appendChild(metricsLabel);

        const metricsRow = document.createElement('div');
        metricsRow.style.cssText = 'display: flex; gap: 15px; margin-top: 8px;';

        for (const [metric, checked] of [['Pitch', this.options.metrics.pitch], ['Rhythm', this.options.metrics.rhythm], ['Intonation', this.options.metrics.intonation]]) {
            const toggleLabel = document.createElement('label');
            toggleLabel.className = 'metric-toggle';
            toggleLabel.style.cssText = "display: flex; align-items: center; gap: 5px; color: var(--text-primary, #f5f5dc); cursor: pointer;";

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.metric = metric.toLowerCase();
            checkbox.checked = checked;
            checkbox.style.cssText = 'accent-color: var(--primary, #c9a227);';

            toggleLabel.appendChild(checkbox);
            toggleLabel.appendChild(document.createTextNode(metric));
            metricsRow.appendChild(toggleLabel);
        }
        metricsSection.appendChild(metricsRow);
        form.appendChild(metricsSection);

        // Teacher notes textarea
        const notesSection = this._createElement('div', 'teacher-report-notes');
        const notesLabel = document.createElement('label');
        notesLabel.style.cssText = 'color: var(--text-secondary, #a0a0b0); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;';
        notesLabel.textContent = 'Teacher Notes';
        notesSection.appendChild(notesLabel);

        const textarea = document.createElement('textarea');
        textarea.className = 'report-teacher-notes';
        textarea.rows = 4;
        textarea.placeholder = 'Add notes for the student...';
        textarea.style.cssText = "width: 100%; margin-top: 5px; background: var(--bg-elevated, #1a1a28); color: var(--text-primary, #f5f5dc); border: 1px solid var(--primary, #c9a227); border-radius: 4px; padding: 8px; font-family: 'Source Sans 3', sans-serif; resize: vertical;";
        textarea.value = this.options.teacherNotes;
        notesSection.appendChild(textarea);
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

        // Use an inline input instead of prompt() for better compatibility
        const emailInput = this.container?.querySelector('.share-email-input');
        const email = emailInput ? emailInput.value : (typeof prompt !== 'undefined' ? prompt('Enter recipient email:') : '');
        if (email) {
            this.pdfExportService.shareViaEmail(email, result, options.teacherNotes);
            this._setStatus(`Email client opened for ${email}`, 'success');
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
     * Set status message (uses textContent to prevent XSS)
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
     * Create a form field using DOM API (XSS-safe)
     * @param {string} labelText
     * @param {string} type
     * @param {string} name
     * @param {string} value
     * @returns {HTMLElement}
     * @private
     */
    _createField(labelText, type, name, value = '') {
        const field = this._createElement('div', 'teacher-report-field');

        const label = document.createElement('label');
        label.style.cssText = 'color: var(--text-secondary, #a0a0b0); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;';
        label.textContent = labelText;
        field.appendChild(label);

        const input = document.createElement('input');
        input.type = type;
        input.className = `report-${this._toKebab(name)}`;
        input.value = value || '';
        input.style.cssText = 'width: 100%; margin-top: 5px; background: var(--bg-elevated, #1a1a28); color: var(--text-primary, #f5f5dc); border: 1px solid var(--primary, #c9a227); border-radius: 4px; padding: 8px;';
        field.appendChild(input);

        return field;
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
