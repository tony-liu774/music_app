/**
 * Tests for TeacherReport - UI component for practice session reports
 * Uses a minimal DOM mock since this is a browser component
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Minimal DOM mock for testing
class MockElement {
    constructor(tag) {
        this.tagName = tag.toUpperCase();
        this.className = '';
        this.textContent = '';
        this.innerHTML = '';
        this.value = '';
        this.type = '';
        this.checked = false;
        this.rows = 0;
        this.placeholder = '';
        this.children = [];
        this.style = { cssText: '', color: '' };
        this.dataset = {};
        this._listeners = {};
        this._attributes = {};
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    setAttribute(name, value) {
        this._attributes[name] = value;
    }

    getAttribute(name) {
        return this._attributes[name] || null;
    }

    addEventListener(event, handler) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(handler);
    }

    querySelector(selector) {
        return this._findBySelector(selector);
    }

    querySelectorAll(selector) {
        const results = [];
        this._findAllBySelector(selector, results);
        return results;
    }

    _findBySelector(selector) {
        // Simple class-based selector
        if (selector.startsWith('.')) {
            const cls = selector.substring(1);
            if (this.className.includes(cls)) return this;
            for (const child of this.children) {
                const found = child._findBySelector(selector);
                if (found) return found;
            }
        }
        return null;
    }

    _findAllBySelector(selector, results) {
        if (selector.startsWith('.')) {
            const cls = selector.substring(1);
            if (this.className.includes(cls)) results.push(this);
        } else if (selector.includes(' ')) {
            // Handle compound selectors like ".metric-toggle input"
            const parts = selector.split(' ');
            if (parts.length === 2 && parts[1] === 'input' && this.tagName === 'INPUT') {
                results.push(this);
            }
        }
        for (const child of this.children) {
            child._findAllBySelector(selector, results);
        }
    }
}

// Set up global document mock before importing TeacherReport
global.document = {
    createElement(tag) {
        return new MockElement(tag);
    },
    createTextNode(text) {
        return { textContent: text, tagName: '#text', children: [], _findBySelector: () => null, _findAllBySelector: () => {} };
    },
    querySelector() { return null; }
};

const TeacherReport = require('../src/js/components/teacher-report');

// Mock PDFExportService
class MockPDFExportService {
    generateReport(options) {
        return {
            pages: [{ pageNumber: 1 }],
            pageCount: 1,
            dataUrl: 'data:application/json;base64,test',
            report: {
                student: options.studentName || 'Student',
                score: options.scoreInfo || {},
                teacherNotes: options.teacherNotes || ''
            },
            download: () => {}
        };
    }

    generateShareLink(data) {
        return `/report?data=test-link`;
    }

    shareViaEmail(email, result, message) {
        return { email, subject: `Practice Report - ${result.report.student}`, mailtoOpened: true };
    }
}

describe('TeacherReport', () => {
    let report;
    let container;
    let mockPdfService;

    beforeEach(() => {
        mockPdfService = new MockPDFExportService();
        report = new TeacherReport(mockPdfService);
        container = new MockElement('div');
    });

    afterEach(() => {
        report = null;
        container = null;
    });

    it('should initialize with default options', () => {
        assert.deepStrictEqual(report.options.metrics, { pitch: true, rhythm: true, intonation: true });
        assert.strictEqual(report.options.teacherNotes, '');
        assert.strictEqual(report.options.studentName, '');
        assert.strictEqual(report.visible, false);
    });

    it('should accept a PDFExportService instance', () => {
        assert.strictEqual(report.pdfExportService, mockPdfService);
    });

    it('should init with a container element', () => {
        report.init(container);
        assert.strictEqual(report.container, container);
    });

    it('should show and set visible to true', () => {
        report.init(container);
        report.show({ sessionLog: {} }, { title: 'Test Score' });
        assert.strictEqual(report.visible, true);
        assert.strictEqual(report.options.scoreInfo.title, 'Test Score');
    });

    it('should hide and clear container', () => {
        report.init(container);
        report.show();
        report.hide();
        assert.strictEqual(report.visible, false);
        assert.strictEqual(container.innerHTML, '');
    });

    it('should render UI elements when visible', () => {
        report.init(container);
        report.show();
        // Should have children (header + form)
        assert.ok(container.children.length >= 2);
    });

    it('should not render when not visible', () => {
        report.init(container);
        report.visible = false;
        report.render();
        assert.strictEqual(container.children.length, 0);
    });

    it('should convert camelCase to kebab-case', () => {
        assert.strictEqual(report._toKebab('studentName'), 'student-name');
        assert.strictEqual(report._toKebab('dateRange'), 'date-range');
        assert.strictEqual(report._toKebab('simple'), 'simple');
    });

    it('should return current options via getOptions', () => {
        const options = report.getOptions();
        assert.ok(options.metrics);
        assert.ok('teacherNotes' in options);
        assert.ok('studentName' in options);
    });

    it('should handle getOptions with no container', () => {
        // No init called, container is null
        const options = report.getOptions();
        assert.deepStrictEqual(options, report.options);
    });

    it('should handle _handleGenerate', () => {
        report.init(container);
        report.show({ sessionLog: {}, summaryStats: {} }, { title: 'Sonata' });
        const result = report._handleGenerate();
        assert.ok(result);
        assert.strictEqual(result.pageCount, 1);
    });

    it('should handle _handleCopyLink', () => {
        report.init(container);
        report.show({}, { title: 'Sonata' });
        const link = report._handleCopyLink();
        assert.ok(link.includes('/report?data='));
    });

    it('should create a button with primary variant', () => {
        const btn = report._createButton('Test', 'primary');
        assert.strictEqual(btn.textContent, 'Test');
        assert.ok(btn.className.includes('primary'));
    });

    it('should create a button with secondary variant', () => {
        const btn = report._createButton('Test', 'secondary');
        assert.ok(btn.className.includes('secondary'));
        assert.ok(btn.style.cssText.includes('transparent'));
    });

    it('should create a form field with label and input', () => {
        const field = report._createField('Student Name', 'text', 'studentName', 'Alice');
        assert.ok(field.children.length >= 2);
        // Label
        assert.strictEqual(field.children[0].textContent, 'Student Name');
        // Input
        assert.strictEqual(field.children[1].value, 'Alice');
        assert.strictEqual(field.children[1].type, 'text');
    });

    it('should create elements with className', () => {
        const el = report._createElement('div', 'test-class');
        assert.strictEqual(el.className, 'test-class');
        assert.strictEqual(el.tagName, 'DIV');
    });

    it('should set status message', () => {
        report.init(container);
        report.show();
        // Find the status element
        const status = container.querySelector('.teacher-report-status');
        if (status) {
            report._setStatus('Test message', 'success');
            assert.strictEqual(status.textContent, 'Test message');
        }
    });
});

console.log('Running TeacherReport tests...');
