/**
 * Studio Dashboard Tests
 * Tests for the Studio Dashboard (Teacher Portal) component
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// Minimal DOM mock with proper textContent/innerHTML for escaping
global.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => {
        let _textContent = '';
        return {
            get textContent() { return _textContent; },
            set textContent(val) {
                _textContent = val;
            },
            get innerHTML() {
                // Simulate HTML escaping that browsers do
                return _textContent
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
            },
            set innerHTML(val) { _textContent = val; }
        };
    }
};

// Mock IndexedDB
global.indexedDB = {
    open: (name, version) => {
        const request = {
            result: null,
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null
        };
        setTimeout(() => {
            request.result = {
                objectStoreNames: { contains: () => true },
                createObjectStore: () => ({
                    createIndex: () => {}
                }),
                transaction: () => ({
                    objectStore: () => ({
                        add: () => ({ onsuccess: null, onerror: null }),
                        put: () => ({ onsuccess: null, onerror: null }),
                        get: () => ({ onsuccess: null, onerror: null }),
                        getAll: () => ({ onsuccess: null, onerror: null }),
                        delete: () => ({ onsuccess: null, onerror: null }),
                        index: () => ({
                            getAll: () => ({ onsuccess: null, onerror: null })
                        })
                    }),
                    oncomplete: null,
                    onerror: null
                })
            };
            if (request.onsuccess) request.onsuccess({ target: request });
        }, 0);
        return request;
    }
};

global.crypto = {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
};

global.window = global;

// Load modules
const TeacherService = require('../src/js/services/teacher-service.js');
const StudioDashboard = require('../src/js/components/studio-dashboard.js');

describe('StudioDashboard - Constructor', () => {
    test('should initialize with default state', () => {
        const service = new TeacherService();
        const dashboard = new StudioDashboard(service);

        assert.strictEqual(dashboard.container, null);
        assert.deepStrictEqual(dashboard.students, []);
        assert.deepStrictEqual(dashboard.filteredStudents, []);
        assert.strictEqual(dashboard.searchQuery, '');
        assert.strictEqual(dashboard.sortBy, 'name');
        assert.strictEqual(dashboard.sortAscending, true);
        assert.strictEqual(dashboard.selectedStudentId, null);
    });

    test('should store teacherService reference', () => {
        const service = new TeacherService();
        const dashboard = new StudioDashboard(service);
        assert.strictEqual(dashboard.teacherService, service);
    });
});

describe('StudioDashboard - Filter Application', () => {
    let service;
    let dashboard;

    beforeEach(() => {
        service = new TeacherService();
        dashboard = new StudioDashboard(service);
    });

    test('should apply search and sort together', () => {
        dashboard.students = [
            { name: 'Alice', instrument: 'violin', assignedPiece: '', weeklyPracticeTimeMs: 1000 },
            { name: 'Bob', instrument: 'cello', assignedPiece: '', weeklyPracticeTimeMs: 2000 },
            { name: 'Amy', instrument: 'violin', assignedPiece: '', weeklyPracticeTimeMs: 3000 }
        ];

        dashboard.searchQuery = 'violin';
        dashboard.sortBy = 'name';
        dashboard.sortAscending = true;
        dashboard.applyFilters();

        assert.strictEqual(dashboard.filteredStudents.length, 2);
        assert.strictEqual(dashboard.filteredStudents[0].name, 'Alice');
        assert.strictEqual(dashboard.filteredStudents[1].name, 'Amy');
    });

    test('should apply sort by practice time descending', () => {
        dashboard.students = [
            { name: 'A', instrument: 'violin', assignedPiece: '', weeklyPracticeTimeMs: 1000 },
            { name: 'B', instrument: 'violin', assignedPiece: '', weeklyPracticeTimeMs: 5000 },
            { name: 'C', instrument: 'violin', assignedPiece: '', weeklyPracticeTimeMs: 3000 }
        ];

        dashboard.sortBy = 'practiceTime';
        dashboard.sortAscending = false;
        dashboard.applyFilters();

        assert.strictEqual(dashboard.filteredStudents[0].name, 'B');
        assert.strictEqual(dashboard.filteredStudents[1].name, 'C');
        assert.strictEqual(dashboard.filteredStudents[2].name, 'A');
    });

    test('should return empty when search matches nothing', () => {
        dashboard.students = [
            { name: 'Alice', instrument: 'violin', assignedPiece: '' }
        ];

        dashboard.searchQuery = 'xyz';
        dashboard.applyFilters();

        assert.strictEqual(dashboard.filteredStudents.length, 0);
    });
});

describe('StudioDashboard - HTML Escaping', () => {
    let dashboard;

    beforeEach(() => {
        const service = new TeacherService();
        dashboard = new StudioDashboard(service);
    });

    test('should escape HTML characters', () => {
        const escaped = dashboard._escapeHtml('<script>alert("xss")</script>');
        assert.ok(!escaped.includes('<script>'));
    });

    test('should handle empty string', () => {
        assert.strictEqual(dashboard._escapeHtml(''), '');
    });

    test('should handle null', () => {
        assert.strictEqual(dashboard._escapeHtml(null), '');
    });
});

describe('StudioDashboard - Capitalize', () => {
    let dashboard;

    beforeEach(() => {
        const service = new TeacherService();
        dashboard = new StudioDashboard(service);
    });

    test('should capitalize first letter', () => {
        assert.strictEqual(dashboard._capitalize('violin'), 'Violin');
    });

    test('should handle empty string', () => {
        assert.strictEqual(dashboard._capitalize(''), '');
    });

    test('should handle single character', () => {
        assert.strictEqual(dashboard._capitalize('a'), 'A');
    });
});

describe('StudioDashboard - Relative Time Formatting', () => {
    let dashboard;

    beforeEach(() => {
        const service = new TeacherService();
        dashboard = new StudioDashboard(service);
    });

    test('should format recent time as just now', () => {
        const result = dashboard._formatRelativeTime(Date.now() - 10000);
        assert.ok(result.includes('Just now') || result.includes('m ago'));
    });

    test('should format minutes ago', () => {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        const result = dashboard._formatRelativeTime(fiveMinutesAgo);
        assert.strictEqual(result, '5m ago');
    });

    test('should format hours ago', () => {
        const threeHoursAgo = Date.now() - 3 * 3600 * 1000;
        const result = dashboard._formatRelativeTime(threeHoursAgo);
        assert.strictEqual(result, '3h ago');
    });

    test('should format days ago', () => {
        const twoDaysAgo = Date.now() - 2 * 86400 * 1000;
        const result = dashboard._formatRelativeTime(twoDaysAgo);
        assert.strictEqual(result, '2d ago');
    });

    test('should format old dates as locale date string', () => {
        const twoWeeksAgo = Date.now() - 14 * 86400 * 1000;
        const result = dashboard._formatRelativeTime(twoWeeksAgo);
        // Should be a date string, not relative
        assert.ok(!result.includes('ago'));
    });
});

describe('StudioDashboard - Instrument Icons', () => {
    let dashboard;

    beforeEach(() => {
        const service = new TeacherService();
        dashboard = new StudioDashboard(service);
    });

    test('should return distinct abbreviation for violin', () => {
        assert.strictEqual(dashboard._getInstrumentIcon('violin'), 'Vn');
    });

    test('should return distinct abbreviation for cello', () => {
        assert.strictEqual(dashboard._getInstrumentIcon('cello'), 'Vc');
    });

    test('should return distinct abbreviation for viola', () => {
        assert.strictEqual(dashboard._getInstrumentIcon('viola'), 'Va');
    });

    test('should return distinct abbreviation for bass', () => {
        assert.strictEqual(dashboard._getInstrumentIcon('bass'), 'Cb');
    });

    test('should return fallback for unknown instrument', () => {
        assert.strictEqual(dashboard._getInstrumentIcon('banjo'), '?');
    });
});

describe('StudioDashboard - Score Classes', () => {
    let dashboard;

    beforeEach(() => {
        const service = new TeacherService();
        dashboard = new StudioDashboard(service);
    });

    test('should return excellent class for high scores', () => {
        assert.strictEqual(dashboard._getScoreClass(95), 'score-excellent');
    });

    test('should return good class for good scores', () => {
        assert.strictEqual(dashboard._getScoreClass(80), 'score-good');
    });

    test('should return fair class for fair scores', () => {
        assert.strictEqual(dashboard._getScoreClass(65), 'score-fair');
    });

    test('should return needs-work class for low scores', () => {
        assert.strictEqual(dashboard._getScoreClass(45), 'score-needs-work');
    });

    test('should return struggling class for very low scores', () => {
        assert.strictEqual(dashboard._getScoreClass(30), 'score-struggling');
    });

    test('should return none class for null score', () => {
        assert.strictEqual(dashboard._getScoreClass(null), 'score-none');
    });

    test('should return none class for undefined score', () => {
        assert.strictEqual(dashboard._getScoreClass(undefined), 'score-none');
    });
});

describe('StudioDashboard - Metrics Rendering', () => {
    let dashboard;
    let service;

    beforeEach(() => {
        service = new TeacherService();
        dashboard = new StudioDashboard(service);
    });

    test('should generate metrics HTML with correct data', () => {
        const metrics = {
            totalStudents: 5,
            totalWeeklyPracticeMs: 180 * 60000,
            averageIntonation: 82,
            studentsActiveThisWeek: 3
        };

        const html = dashboard._renderMetricsCards(metrics);
        assert.ok(html.includes('5'));
        assert.ok(html.includes('3h'));
        assert.ok(html.includes('82%'));
        assert.ok(html.includes('3/5'));
    });

    test('should handle zero students metrics', () => {
        const metrics = {
            totalStudents: 0,
            totalWeeklyPracticeMs: 0,
            averageIntonation: null,
            studentsActiveThisWeek: 0
        };

        const html = dashboard._renderMetricsCards(metrics);
        assert.ok(html.includes('0'));
        assert.ok(html.includes('0m'));
    });
});

describe('StudioDashboard - Student Roster Rendering', () => {
    let dashboard;

    beforeEach(() => {
        const service = new TeacherService();
        dashboard = new StudioDashboard(service);
    });

    test('should render empty state when no students', () => {
        dashboard.students = [];
        dashboard.filteredStudents = [];
        const html = dashboard._renderStudentRoster();
        assert.ok(html.includes('No students yet'));
    });

    test('should render no results message when search has no matches', () => {
        dashboard.students = [{ name: 'Alice' }];
        dashboard.filteredStudents = [];
        const html = dashboard._renderStudentRoster();
        assert.ok(html.includes('No matching students'));
    });

    test('should render student rows when students exist', () => {
        dashboard.filteredStudents = [
            {
                id: 'test-1',
                name: 'Alice Chen',
                instrument: 'violin',
                assignedPiece: 'Bach Partita',
                weeklyPracticeTimeMs: 1800000,
                averageIntonationScore: 85,
                lastSessionAt: Date.now()
            }
        ];
        const html = dashboard._renderStudentRoster();
        assert.ok(html.includes('Alice Chen'));
        assert.ok(html.includes('Bach Partita'));
        assert.ok(html.includes('Violin'));
        assert.ok(html.includes('student-roster'));
    });

    test('should render multiple student rows', () => {
        dashboard.filteredStudents = [
            { id: '1', name: 'Alice', instrument: 'violin', assignedPiece: '', weeklyPracticeTimeMs: 0, averageIntonationScore: null, lastSessionAt: null },
            { id: '2', name: 'Bob', instrument: 'cello', assignedPiece: '', weeklyPracticeTimeMs: 0, averageIntonationScore: null, lastSessionAt: null }
        ];
        const html = dashboard._renderStudentRoster();
        assert.ok(html.includes('Alice'));
        assert.ok(html.includes('Bob'));
    });
});

describe('StudioDashboard - Toolbar Rendering', () => {
    let dashboard;

    beforeEach(() => {
        const service = new TeacherService();
        dashboard = new StudioDashboard(service);
    });

    test('should render search input', () => {
        const html = dashboard._renderToolbar();
        assert.ok(html.includes('student-search'));
        assert.ok(html.includes('Search students'));
    });

    test('should render sort options', () => {
        const html = dashboard._renderToolbar();
        assert.ok(html.includes('student-sort'));
        assert.ok(html.includes('Name'));
        assert.ok(html.includes('Practice Time'));
        assert.ok(html.includes('Intonation Score'));
    });

    test('should render add student button', () => {
        const html = dashboard._renderToolbar();
        assert.ok(html.includes('add-student-btn'));
        assert.ok(html.includes('Add Student'));
    });

    test('should show current search query in input', () => {
        dashboard.searchQuery = 'alice';
        const html = dashboard._renderToolbar();
        assert.ok(html.includes('value="alice"'));
    });

    test('should mark current sort option as selected', () => {
        dashboard.sortBy = 'practiceTime';
        const html = dashboard._renderToolbar();
        assert.ok(html.includes('value="practiceTime" selected'));
    });
});
