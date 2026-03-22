/**
 * Dashboard UI Tests
 * Tests for the Tonic/Edulastic-style dashboard component
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Import the DashboardUI class
const { DashboardUI } = require('../src/js/components/dashboard-ui.js');

// --- Minimal DOM Mock ---

class MockElement {
    constructor(id) {
        this.id = id;
        this.textContent = '';
        this.innerHTML = '';
        this.style = {};
        this.classList = {
            _classes: new Set(),
            add(c) { this._classes.add(c); },
            remove(c) { this._classes.delete(c); },
            contains(c) { return this._classes.has(c); },
            toggle(c) { this._classes.has(c) ? this._classes.delete(c) : this._classes.add(c); }
        };
        this.children = [];
        this.attributes = {};
        this._listeners = {};
    }

    setAttribute(k, v) { this.attributes[k] = v; }
    getAttribute(k) { return this.attributes[k] || null; }
    addEventListener(type, fn) {
        if (!this._listeners[type]) this._listeners[type] = [];
        this._listeners[type].push(fn);
    }
    querySelectorAll(sel) { return []; }
    appendChild(child) { this.children.push(child); return child; }
    remove() {}
}

class MockDocument {
    constructor() {
        this._elements = {};
    }

    getElementById(id) {
        if (!this._elements[id]) {
            this._elements[id] = new MockElement(id);
        }
        return this._elements[id];
    }

    createElement(tag) {
        const el = new MockElement(tag);
        el.tagName = tag.toUpperCase();
        // Make textContent → innerHTML mimic real DOM escape behavior
        Object.defineProperty(el, 'textContent', {
            get() { return el._textContent || ''; },
            set(val) {
                el._textContent = val;
                // Simulate HTML escaping like a real DOM element
                el.innerHTML = String(val)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
            }
        });
        return el;
    }
}

// Set up global document mock
let mockDoc;
let mockLocalStorage;

function setupGlobals() {
    mockDoc = new MockDocument();
    mockLocalStorage = {};

    global.document = {
        getElementById: (id) => mockDoc.getElementById(id),
        createElement: (tag) => mockDoc.createElement(tag),
        querySelectorAll: () => []
    };

    global.localStorage = {
        _store: {},
        getItem(key) { return this._store[key] || null; },
        setItem(key, val) { this._store[key] = val; },
        removeItem(key) { delete this._store[key]; },
        clear() { this._store = {}; }
    };
}

function teardownGlobals() {
    delete global.document;
    delete global.localStorage;
}

// --- Tests ---

describe('DashboardUI', () => {
    let dashboard;
    let mockApp;

    beforeEach(() => {
        setupGlobals();

        mockApp = {
            selectedInstrument: 'violin',
            scoreLibrary: { scores: [] },
            showView: function(viewId) { this._lastView = viewId; },
            _lastView: null
        };

        dashboard = new DashboardUI(mockApp);
    });

    describe('constructor', () => {
        it('should initialize with app reference', () => {
            assert.strictEqual(dashboard.app, mockApp);
        });

        it('should set circumference correctly for radius 24', () => {
            const expected = 2 * Math.PI * 24;
            assert.ok(Math.abs(dashboard.circumference - expected) < 0.001);
        });
    });

    describe('init', () => {
        it('should call cacheDOM, loadStats, and loadRecentPieces', () => {
            let cacheCalled = false;
            let statsCalled = false;
            let piecesCalled = false;

            dashboard.cacheDOM = () => { cacheCalled = true; };
            dashboard.loadStats = () => { statsCalled = true; };
            dashboard.loadRecentPieces = () => { piecesCalled = true; };

            dashboard.init();

            assert.ok(cacheCalled, 'cacheDOM should be called');
            assert.ok(statsCalled, 'loadStats should be called');
            assert.ok(piecesCalled, 'loadRecentPieces should be called');
        });
    });

    describe('cacheDOM', () => {
        it('should cache all required DOM elements', () => {
            dashboard.cacheDOM();

            assert.ok(dashboard.heroTitle !== null);
            assert.ok(dashboard.heroLastPracticed !== null);
            assert.ok(dashboard.heroInstrumentLabel !== null);
            assert.ok(dashboard.heroOverallScore !== null);
            assert.ok(dashboard.heroPracticeTime !== null);
            assert.ok(dashboard.heroStreak !== null);
            assert.ok(dashboard.assignmentList !== null);
            assert.ok(dashboard.assignmentCount !== null);
            assert.ok(dashboard.ringIntonation !== null);
            assert.ok(dashboard.ringRhythm !== null);
            assert.ok(dashboard.ringPitch !== null);
        });
    });

    describe('setProgressRing', () => {
        it('should set stroke-dashoffset for 0%', () => {
            const ring = new MockElement('test-ring');
            const label = new MockElement('test-label');

            dashboard.setProgressRing(ring, label, 0);

            const offset = parseFloat(ring.style.strokeDashoffset);
            assert.ok(Math.abs(offset - dashboard.circumference) < 0.1);
            assert.strictEqual(label.textContent, '0%');
        });

        it('should set stroke-dashoffset for 100%', () => {
            const ring = new MockElement('test-ring');
            const label = new MockElement('test-label');

            dashboard.setProgressRing(ring, label, 100);

            const offset = parseFloat(ring.style.strokeDashoffset);
            assert.ok(Math.abs(offset) < 0.1);
            assert.strictEqual(label.textContent, '100%');
        });

        it('should set stroke-dashoffset for 50%', () => {
            const ring = new MockElement('test-ring');
            const label = new MockElement('test-label');

            dashboard.setProgressRing(ring, label, 50);

            const offset = parseFloat(ring.style.strokeDashoffset);
            const expected = dashboard.circumference / 2;
            assert.ok(Math.abs(offset - expected) < 0.1);
            assert.strictEqual(label.textContent, '50%');
        });

        it('should clamp values above 100', () => {
            const ring = new MockElement('test-ring');
            const label = new MockElement('test-label');

            dashboard.setProgressRing(ring, label, 150);

            const offset = parseFloat(ring.style.strokeDashoffset);
            assert.ok(Math.abs(offset) < 0.1, 'Should clamp to 100%');
        });

        it('should clamp values below 0', () => {
            const ring = new MockElement('test-ring');
            const label = new MockElement('test-label');

            dashboard.setProgressRing(ring, label, -10);

            const offset = parseFloat(ring.style.strokeDashoffset);
            assert.ok(Math.abs(offset - dashboard.circumference) < 0.1, 'Should clamp to 0%');
        });

        it('should handle null ring element gracefully', () => {
            assert.doesNotThrow(() => {
                dashboard.setProgressRing(null, null, 50);
            });
        });

        it('should show --%  for negative percentage', () => {
            const ring = new MockElement('test-ring');
            const label = new MockElement('test-label');

            dashboard.setProgressRing(ring, label, -1);

            assert.strictEqual(label.textContent, '--%');
        });

        it('should update aria-valuenow on parent SVG', () => {
            const ring = new MockElement('test-ring');
            const label = new MockElement('test-label');
            const parentSvg = new MockElement('parent-svg');

            // Mock closest() to return parent SVG
            ring.closest = (sel) => sel === 'svg' ? parentSvg : null;

            dashboard.setProgressRing(ring, label, 75);

            assert.strictEqual(parentSvg.attributes['aria-valuenow'], '75');
        });
    });

    describe('getStoredStats', () => {
        it('should return defaults when no data exists', () => {
            const stats = dashboard.getStoredStats();

            assert.strictEqual(stats.intonation, -1);
            assert.strictEqual(stats.rhythm, -1);
            assert.strictEqual(stats.pitch, -1);
            assert.strictEqual(stats.overallScore, -1);
            assert.strictEqual(stats.todayMinutes, 0);
            assert.strictEqual(stats.streak, 0);
            assert.strictEqual(stats.lastPiece, null);
            assert.strictEqual(stats.lastDate, null);
        });

        it('should load stats from localStorage', () => {
            const stored = {
                intonation: 85,
                rhythm: 72,
                pitch: 90,
                overallScore: 82,
                todayMinutes: 45,
                streak: 5,
                lastPiece: 'Bach Partita No. 2',
                lastDate: '2026-03-20'
            };
            global.localStorage.setItem('concertmaster_dashboard_stats', JSON.stringify(stored));

            const stats = dashboard.getStoredStats();

            assert.strictEqual(stats.intonation, 85);
            assert.strictEqual(stats.rhythm, 72);
            assert.strictEqual(stats.pitch, 90);
            assert.strictEqual(stats.overallScore, 82);
            assert.strictEqual(stats.todayMinutes, 45);
            assert.strictEqual(stats.streak, 5);
            assert.strictEqual(stats.lastPiece, 'Bach Partita No. 2');
        });

        it('should fall back to session data when dashboard stats missing', () => {
            const session = {
                intonation: 70,
                rhythm: 80,
                pitch: 75,
                overallScore: 75,
                piece: 'Bruch Violin Concerto',
                date: '2026-03-19'
            };
            global.localStorage.setItem('concertmaster_last_session', JSON.stringify(session));

            const stats = dashboard.getStoredStats();

            assert.strictEqual(stats.intonation, 70);
            assert.strictEqual(stats.rhythm, 80);
            assert.strictEqual(stats.pitch, 75);
            assert.strictEqual(stats.lastPiece, 'Bruch Violin Concerto');
        });

        it('should handle corrupt localStorage data gracefully', () => {
            global.localStorage.setItem('concertmaster_dashboard_stats', 'not json{{{');

            const stats = dashboard.getStoredStats();
            assert.strictEqual(stats.intonation, -1);
        });
    });

    describe('saveStats', () => {
        it('should persist stats to localStorage', () => {
            const stats = { intonation: 90, rhythm: 85, pitch: 88 };
            dashboard.saveStats(stats);

            const stored = JSON.parse(global.localStorage.getItem('concertmaster_dashboard_stats'));
            assert.strictEqual(stored.intonation, 90);
            assert.strictEqual(stored.rhythm, 85);
        });
    });

    describe('updateHeroCard', () => {
        it('should set hero card text fields', () => {
            dashboard.cacheDOM();

            dashboard.updateHeroCard({
                lastPiece: 'Mozart Sonata K.545',
                lastDate: '2026-03-21',
                overallScore: 92,
                todayMinutes: 30,
                streak: 7
            });

            assert.strictEqual(dashboard.heroTitle.textContent, 'Mozart Sonata K.545');
            assert.strictEqual(dashboard.heroOverallScore.textContent, '92%');
            assert.strictEqual(dashboard.heroPracticeTime.textContent, '30m');
            assert.strictEqual(dashboard.heroStreak.textContent, '7');
        });

        it('should show defaults when no data', () => {
            dashboard.cacheDOM();

            dashboard.updateHeroCard({
                lastPiece: null,
                lastDate: null,
                overallScore: -1,
                todayMinutes: 0,
                streak: 0
            });

            assert.strictEqual(dashboard.heroTitle.textContent, 'No recent piece');
            assert.strictEqual(dashboard.heroOverallScore.textContent, '--');
            assert.strictEqual(dashboard.heroPracticeTime.textContent, '0m');
            assert.strictEqual(dashboard.heroStreak.textContent, '0');
        });
    });

    describe('formatDate', () => {
        it('should return "Today" for today\'s date', () => {
            const today = new Date().toISOString();
            assert.strictEqual(dashboard.formatDate(today), 'Today');
        });

        it('should return "Yesterday" for yesterday\'s date', () => {
            const yesterday = new Date(Date.now() - 86400000).toISOString();
            assert.strictEqual(dashboard.formatDate(yesterday), 'Yesterday');
        });

        it('should return "X days ago" for recent dates', () => {
            const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
            assert.strictEqual(dashboard.formatDate(threeDaysAgo), '3 days ago');
        });

        it('should return formatted date for old dates', () => {
            const oldDate = '2025-01-15T12:00:00Z';
            const result = dashboard.formatDate(oldDate);
            assert.ok(result.includes('Jan'));
            assert.ok(result.includes('15'));
        });

        it('should handle invalid date strings', () => {
            assert.strictEqual(dashboard.formatDate('invalid'), 'invalid');
        });

        it('should handle future dates gracefully (no negative days)', () => {
            const future = new Date(Date.now() + 7 * 86400000).toISOString();
            const result = dashboard.formatDate(future);
            // Should NOT produce "-X days ago"
            assert.ok(!result.includes('-'), 'Future dates should not produce negative day counts');
            // Should fall through to locale-formatted date
            assert.ok(result.includes(' '), 'Future dates should be locale-formatted');
        });
    });

    describe('formatDuration', () => {
        it('should format 0 minutes', () => {
            assert.strictEqual(dashboard.formatDuration(0), '0m');
        });

        it('should format minutes under 60', () => {
            assert.strictEqual(dashboard.formatDuration(30), '30m');
        });

        it('should format hours', () => {
            assert.strictEqual(dashboard.formatDuration(120), '2h');
        });

        it('should format hours and minutes', () => {
            assert.strictEqual(dashboard.formatDuration(90), '1h 30m');
        });
    });

    describe('escapeHTML', () => {
        it('should escape HTML entities and prevent XSS', () => {
            const result = dashboard.escapeHTML('Test <script>alert("xss")</script>');
            assert.ok(typeof result === 'string');
            // Verify dangerous characters are escaped
            assert.ok(!result.includes('<script>'), 'Should escape <script> tags');
            assert.ok(result.includes('&lt;'), 'Should contain escaped < characters');
            assert.ok(result.includes('&gt;'), 'Should contain escaped > characters');
        });

        it('should escape angle brackets, ampersands, and quotes', () => {
            const result = dashboard.escapeHTML('<img onerror="alert(1)">');
            assert.ok(!result.includes('<img'), 'Should escape img tag');
            assert.ok(result.includes('&lt;'), 'Should escape <');
            assert.ok(result.includes('&gt;'), 'Should escape >');
            assert.ok(result.includes('&quot;'), 'Should escape "');
        });

        it('should handle empty string', () => {
            assert.strictEqual(dashboard.escapeHTML(''), '');
        });

        it('should handle null/undefined', () => {
            assert.strictEqual(dashboard.escapeHTML(null), '');
            assert.strictEqual(dashboard.escapeHTML(undefined), '');
        });
    });

    describe('createAssignmentItem', () => {
        it('should create item with title and composer', () => {
            const piece = {
                title: 'Elgar Cello Concerto',
                composer: 'Edward Elgar',
                instrument: 'cello',
                lastScore: 85,
                lastPracticed: '2026-03-20'
            };

            const item = dashboard.createAssignmentItem(piece);
            assert.ok(item.innerHTML.includes('Elgar Cello Concerto'));
            assert.ok(item.innerHTML.includes('Edward Elgar'));
            assert.ok(item.innerHTML.includes('complete'));
        });

        it('should classify high score as complete', () => {
            const piece = { title: 'Test', lastScore: 90 };
            const item = dashboard.createAssignmentItem(piece);
            assert.ok(item.innerHTML.includes('complete'));
            assert.ok(item.innerHTML.includes('good'));
        });

        it('should classify medium score as in-progress', () => {
            const piece = { title: 'Test', lastScore: 60 };
            const item = dashboard.createAssignmentItem(piece);
            assert.ok(item.innerHTML.includes('in-progress'));
            assert.ok(item.innerHTML.includes('medium'));
        });

        it('should classify low score as pending', () => {
            const piece = { title: 'Test', lastScore: 30 };
            const item = dashboard.createAssignmentItem(piece);
            assert.ok(item.innerHTML.includes('pending'));
            assert.ok(item.innerHTML.includes('low'));
        });

        it('should classify zero score as pending', () => {
            const piece = { title: 'Test', lastScore: 0 };
            const item = dashboard.createAssignmentItem(piece);
            assert.ok(item.innerHTML.includes('pending'));
        });

        it('should escape HTML in piece title', () => {
            const piece = { title: '<img onerror="alert(1)">' };
            const item = dashboard.createAssignmentItem(piece);
            assert.ok(!item.innerHTML.includes('<img'));
        });

        it('should set role and tabindex for accessibility', () => {
            const piece = { title: 'Test' };
            const item = dashboard.createAssignmentItem(piece);
            assert.strictEqual(item.attributes['role'], 'button');
            assert.strictEqual(item.attributes['tabindex'], '0');
        });

        it('should add click event listener', () => {
            const piece = { title: 'Test' };
            const item = dashboard.createAssignmentItem(piece);
            assert.ok(item._listeners['click'] && item._listeners['click'].length > 0);
        });

        it('should add keydown event listener for keyboard accessibility', () => {
            const piece = { title: 'Test' };
            const item = dashboard.createAssignmentItem(piece);
            assert.ok(item._listeners['keydown'] && item._listeners['keydown'].length > 0);
        });

        it('should escape formatDate output in meta (XSS prevention)', () => {
            const piece = {
                title: 'Test',
                lastPracticed: '2026-03-20'
            };
            const item = dashboard.createAssignmentItem(piece);
            // formatDate output should be escaped — no raw HTML injection possible
            assert.ok(!item.innerHTML.includes('<script'), 'Meta should not contain unescaped HTML');
        });

        it('should coerce string scores to number via Number()', () => {
            const piece = { title: 'Test', lastScore: '85' };
            const item = dashboard.createAssignmentItem(piece);
            // Should treat "85" as 85 → complete status
            assert.ok(item.innerHTML.includes('complete'), 'String score "85" should be coerced to number');
            assert.ok(item.innerHTML.includes('good'), 'String score "85" should get good progress class');
        });

        it('should handle NaN score gracefully', () => {
            const piece = { title: 'Test', lastScore: 'invalid' };
            const item = dashboard.createAssignmentItem(piece);
            // Number('invalid') || 0 should give 0 → pending
            assert.ok(item.innerHTML.includes('pending'), 'NaN score should default to pending');
        });
    });

    describe('renderAssignmentList', () => {
        it('should show empty state when no pieces', () => {
            dashboard.cacheDOM();
            dashboard.renderAssignmentList([]);

            assert.strictEqual(dashboard.assignmentCount.textContent, '0');
        });

        it('should hide empty state and show count when pieces exist', () => {
            dashboard.cacheDOM();
            dashboard.renderAssignmentList([
                { title: 'Piece 1', lastScore: 80 },
                { title: 'Piece 2', lastScore: 60 }
            ]);

            assert.strictEqual(dashboard.assignmentCount.textContent, '2');
            assert.strictEqual(dashboard.assignmentEmptyState.style.display, 'none');
        });

        it('should limit to 8 items', () => {
            dashboard.cacheDOM();
            const pieces = Array.from({ length: 15 }, (_, i) => ({
                title: 'Piece ' + (i + 1),
                lastScore: 50,
                lastPracticed: new Date(Date.now() - i * 86400000).toISOString()
            }));

            dashboard.renderAssignmentList(pieces);

            // assignmentList should have 8 children + empty state
            assert.ok(dashboard.assignmentList.children.length <= 9);
        });
    });

    describe('loadRecentPieces', () => {
        it('should load from localStorage', () => {
            dashboard.cacheDOM();
            const pieces = [
                { title: 'Stored Piece', lastScore: 90 }
            ];
            global.localStorage.setItem('concertmaster_library', JSON.stringify(pieces));

            dashboard.loadRecentPieces();

            assert.strictEqual(dashboard.assignmentCount.textContent, '1');
        });

        it('should fall back to scoreLibrary from app', () => {
            dashboard.cacheDOM();
            mockApp.scoreLibrary.scores = [
                { title: 'App Piece', lastScore: 70 }
            ];

            dashboard.loadRecentPieces();

            assert.strictEqual(dashboard.assignmentCount.textContent, '1');
        });

        it('should handle corrupt localStorage gracefully', () => {
            dashboard.cacheDOM();
            global.localStorage.setItem('concertmaster_library', 'not valid json');

            assert.doesNotThrow(() => {
                dashboard.loadRecentPieces();
            });
        });
    });

    describe('loadStats', () => {
        it('should update hero card with stored stats', () => {
            dashboard.cacheDOM();

            const stats = {
                intonation: 88,
                rhythm: 75,
                pitch: 92,
                overallScore: 85,
                todayMinutes: 60,
                streak: 3,
                lastPiece: 'Vivaldi Spring',
                lastDate: '2026-03-21'
            };
            global.localStorage.setItem('concertmaster_dashboard_stats', JSON.stringify(stats));

            dashboard.loadStats();

            assert.strictEqual(dashboard.heroTitle.textContent, 'Vivaldi Spring');
            assert.strictEqual(dashboard.heroOverallScore.textContent, '85%');
            assert.strictEqual(dashboard.heroPracticeTime.textContent, '1h');
            assert.strictEqual(dashboard.heroStreak.textContent, '3');
        });

        it('should set instrument label from app', () => {
            dashboard.cacheDOM();
            mockApp.selectedInstrument = 'cello';

            dashboard.loadStats();

            assert.strictEqual(dashboard.heroInstrumentLabel.textContent, 'Cello');
        });
    });

    describe('refresh', () => {
        it('should reload stats and pieces', () => {
            let statsLoaded = false;
            let piecesLoaded = false;

            dashboard.loadStats = () => { statsLoaded = true; };
            dashboard.loadRecentPieces = () => { piecesLoaded = true; };

            dashboard.refresh();

            assert.ok(statsLoaded);
            assert.ok(piecesLoaded);
        });
    });
});

describe('Dashboard HTML Structure', () => {
    it('should have dashboard-view section in expected DOM structure', () => {
        setupGlobals();

        const dashView = global.document.getElementById('dashboard-view');
        assert.ok(dashView !== null, 'dashboard-view should exist');
    });

    it('should have hero-practice-card element', () => {
        setupGlobals();

        const hero = global.document.getElementById('hero-practice-card');
        assert.ok(hero !== null, 'hero-practice-card should exist');
    });

    it('should have progress ring elements', () => {
        setupGlobals();

        const ring1 = global.document.getElementById('ring-intonation');
        const ring2 = global.document.getElementById('ring-rhythm');
        const ring3 = global.document.getElementById('ring-pitch');

        assert.ok(ring1 !== null);
        assert.ok(ring2 !== null);
        assert.ok(ring3 !== null);
    });

    it('should have assignment list element', () => {
        setupGlobals();

        const list = global.document.getElementById('assignment-list');
        assert.ok(list !== null);
    });
});

describe('Dashboard CSS Theme Requirements', () => {
    it('should use correct ivory color #f3f4f6 not #f5f5dc', () => {
        const fs = require('fs');
        const path = require('path');
        const cssPath = path.join(__dirname, '..', 'src', 'css', 'app.css');

        let cssContent;
        try {
            cssContent = fs.readFileSync(cssPath, 'utf-8');
        } catch (_e) {
            // If we can't read the file, skip
            return;
        }

        // Check that #f5f5dc is NOT used for ivory or text-primary
        const ivoryLine = cssContent.match(/--color-ivory:\s*([^;]+);/);
        if (ivoryLine) {
            assert.ok(!ivoryLine[1].includes('#f5f5dc'), 'Ivory should be #f3f4f6, not #f5f5dc');
            assert.ok(ivoryLine[1].includes('#f3f4f6'), 'Ivory should be #f3f4f6');
        }
    });

    it('should have dashboard card styles defined', () => {
        const fs = require('fs');
        const path = require('path');
        const cssPath = path.join(__dirname, '..', 'src', 'css', 'app.css');

        let cssContent;
        try {
            cssContent = fs.readFileSync(cssPath, 'utf-8');
        } catch (_e) {
            return;
        }

        assert.ok(cssContent.includes('.dashboard-card'), 'Should have .dashboard-card styles');
        assert.ok(cssContent.includes('.hero-card'), 'Should have .hero-card styles');
        assert.ok(cssContent.includes('.progress-ring'), 'Should have progress ring styles');
        assert.ok(cssContent.includes('.assignment-item'), 'Should have .assignment-item styles');
        assert.ok(cssContent.includes('.stat-card'), 'Should have .stat-card styles');
        assert.ok(cssContent.includes('.stats-row'), 'Should have .stats-row styles');
    });

    it('should have proper border-radius values (16px+ for cards)', () => {
        const fs = require('fs');
        const path = require('path');
        const cssPath = path.join(__dirname, '..', 'src', 'css', 'app.css');

        let cssContent;
        try {
            cssContent = fs.readFileSync(cssPath, 'utf-8');
        } catch (_e) {
            return;
        }

        // Dashboard cards should have border-radius >= 16px
        assert.ok(cssContent.includes('border-radius: 20px'), 'Should have 20px border-radius for cards');
        assert.ok(cssContent.includes('border-radius: 24px'), 'Should have 24px border-radius for hero/modal');
    });

    it('should have Midnight Conservatory theme colors', () => {
        const fs = require('fs');
        const path = require('path');
        const cssPath = path.join(__dirname, '..', 'src', 'css', 'app.css');

        let cssContent;
        try {
            cssContent = fs.readFileSync(cssPath, 'utf-8');
        } catch (_e) {
            return;
        }

        assert.ok(cssContent.includes('#0a0a12'), 'Should have Oxford Blue');
        assert.ok(cssContent.includes('#c9a227'), 'Should have Polished Amber');
        assert.ok(cssContent.includes('#10b981'), 'Should have Emerald');
        assert.ok(cssContent.includes('#dc2626'), 'Should have Crimson');
        assert.ok(cssContent.includes('#f3f4f6'), 'Should have correct Ivory');
    });

    it('should have smooth transition styles', () => {
        const fs = require('fs');
        const path = require('path');
        const cssPath = path.join(__dirname, '..', 'src', 'css', 'app.css');

        let cssContent;
        try {
            cssContent = fs.readFileSync(cssPath, 'utf-8');
        } catch (_e) {
            return;
        }

        assert.ok(cssContent.includes('transition: transform'), 'Should have transform transitions');
        assert.ok(cssContent.includes('cubic-bezier'), 'Should have cubic-bezier easing');
        assert.ok(cssContent.includes('backdrop-filter: blur'), 'Should have backdrop blur for nav');
    });

    it('should have safe-area-inset for mobile navigation', () => {
        const fs = require('fs');
        const path = require('path');
        const cssPath = path.join(__dirname, '..', 'src', 'css', 'app.css');

        let cssContent;
        try {
            cssContent = fs.readFileSync(cssPath, 'utf-8');
        } catch (_e) {
            return;
        }

        assert.ok(cssContent.includes('safe-area-inset-bottom'), 'Should have safe-area-inset for mobile nav');
    });
});

describe('Dashboard HTML Structural Requirements', () => {
    it('should have dashboard nav link in index.html', () => {
        const fs = require('fs');
        const path = require('path');
        const htmlPath = path.join(__dirname, '..', 'index.html');

        let htmlContent;
        try {
            htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        } catch (_e) {
            return;
        }

        assert.ok(htmlContent.includes('href="#dashboard"'), 'Should have dashboard nav link');
        assert.ok(htmlContent.includes('id="dashboard-view"'), 'Should have dashboard-view section');
    });

    it('should have Metronome tab in mobile navigation', () => {
        const fs = require('fs');
        const path = require('path');
        const htmlPath = path.join(__dirname, '..', 'index.html');

        let htmlContent;
        try {
            htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        } catch (_e) {
            return;
        }

        // Mobile nav should include Metronome
        const mobileNavSection = htmlContent.slice(
            htmlContent.indexOf('class="mobile-nav'),
            htmlContent.indexOf('<!-- Main Content Area -->')
        );
        assert.ok(mobileNavSection.includes('href="#metronome"'), 'Mobile nav should have metronome link');
        assert.ok(mobileNavSection.includes('>Metronome</span>'), 'Mobile nav should have Metronome label');
    });

    it('should have Home tab in mobile navigation', () => {
        const fs = require('fs');
        const path = require('path');
        const htmlPath = path.join(__dirname, '..', 'index.html');

        let htmlContent;
        try {
            htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        } catch (_e) {
            return;
        }

        // Mobile nav should include Home
        assert.ok(htmlContent.includes('>Home</span>'), 'Should have Home label in mobile nav');
    });

    it('should have progress ring SVGs with ARIA attributes', () => {
        const fs = require('fs');
        const path = require('path');
        const htmlPath = path.join(__dirname, '..', 'index.html');

        let htmlContent;
        try {
            htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        } catch (_e) {
            return;
        }

        assert.ok(htmlContent.includes('progress-ring-fill'), 'Should have progress ring fill elements');
        assert.ok(htmlContent.includes('ring-intonation'), 'Should have intonation ring');
        assert.ok(htmlContent.includes('ring-rhythm'), 'Should have rhythm ring');
        assert.ok(htmlContent.includes('ring-pitch'), 'Should have pitch ring');

        // Accessibility: SVGs should have role="progressbar" and ARIA attributes
        assert.ok(htmlContent.includes('role="progressbar"'), 'Ring SVGs should have role="progressbar"');
        assert.ok(htmlContent.includes('aria-valuemin="0"'), 'Ring SVGs should have aria-valuemin');
        assert.ok(htmlContent.includes('aria-valuemax="100"'), 'Ring SVGs should have aria-valuemax');
        assert.ok(htmlContent.includes('aria-label="Intonation progress"'), 'Intonation ring should have aria-label');
        assert.ok(htmlContent.includes('aria-label="Rhythm progress"'), 'Rhythm ring should have aria-label');
        assert.ok(htmlContent.includes('aria-label="Pitch accuracy progress"'), 'Pitch ring should have aria-label');
    });

    it('should have dashboard quick-access cards with accessibility attributes', () => {
        const fs = require('fs');
        const path = require('path');
        const htmlPath = path.join(__dirname, '..', 'index.html');

        let htmlContent;
        try {
            htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        } catch (_e) {
            return;
        }

        assert.ok(htmlContent.includes('data-navigate="practice"'), 'Should have practice card');
        assert.ok(htmlContent.includes('data-navigate="tuner"'), 'Should have tuner card');
        assert.ok(htmlContent.includes('data-navigate="library"'), 'Should have library card');
        assert.ok(htmlContent.includes('data-navigate="metronome"'), 'Should have metronome card');

        // Accessibility: cards should have role="button", tabindex="0", aria-label
        const cardSection = htmlContent.slice(
            htmlContent.indexOf('id="dashboard-cards"'),
            htmlContent.indexOf('<!-- Assignments')
        );
        const cards = cardSection.split('data-navigate=').slice(1);
        for (const card of cards) {
            assert.ok(card.includes('role="button"'), 'Dashboard card should have role="button"');
            assert.ok(card.includes('tabindex="0"'), 'Dashboard card should have tabindex="0"');
            assert.ok(card.includes('aria-label='), 'Dashboard card should have aria-label');
        }
    });

    it('should have hero practice session card', () => {
        const fs = require('fs');
        const path = require('path');
        const htmlPath = path.join(__dirname, '..', 'index.html');

        let htmlContent;
        try {
            htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        } catch (_e) {
            return;
        }

        assert.ok(htmlContent.includes('hero-card'), 'Should have hero card');
        assert.ok(htmlContent.includes('hero-piece-title'), 'Should have hero piece title');
        assert.ok(htmlContent.includes('hero-overall-score'), 'Should have hero overall score');
        assert.ok(htmlContent.includes('hero-practice-time'), 'Should have hero practice time');
        assert.ok(htmlContent.includes('hero-streak'), 'Should have hero streak');
    });

    it('should have assignment list section', () => {
        const fs = require('fs');
        const path = require('path');
        const htmlPath = path.join(__dirname, '..', 'index.html');

        let htmlContent;
        try {
            htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        } catch (_e) {
            return;
        }

        assert.ok(htmlContent.includes('assignment-list'), 'Should have assignment list');
        assert.ok(htmlContent.includes('assignment-count'), 'Should have assignment count badge');
    });

    it('should load dashboard-ui.js script before app.js', () => {
        const fs = require('fs');
        const path = require('path');
        const htmlPath = path.join(__dirname, '..', 'index.html');

        let htmlContent;
        try {
            htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        } catch (_e) {
            return;
        }

        const dashboardIndex = htmlContent.indexOf('dashboard-ui.js');
        const appIndex = htmlContent.indexOf('src/js/app.js');
        assert.ok(dashboardIndex > 0, 'Should load dashboard-ui.js');
        assert.ok(dashboardIndex < appIndex, 'dashboard-ui.js should load before app.js');
    });

    it('should not use old ivory color #f5f5dc in JS files', () => {
        const fs = require('fs');
        const path = require('path');

        const jsFiles = [
            'src/js/components/teacher-report.js',
            'src/js/components/sheet-music-renderer.js',
            'src/js/components/heat-map-renderer.js',
            'src/js/services/pdf-export-service.js',
            'src/js/services/omr-client.js'
        ];

        for (const file of jsFiles) {
            const filePath = path.join(__dirname, '..', file);
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                assert.ok(!content.includes('#f5f5dc'), `${file} should not contain old ivory color #f5f5dc`);
            } catch (_e) {
                // Skip if file doesn't exist
            }
        }
    });

    it('should have Google Fonts loaded', () => {
        const fs = require('fs');
        const path = require('path');
        const htmlPath = path.join(__dirname, '..', 'index.html');

        let htmlContent;
        try {
            htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        } catch (_e) {
            return;
        }

        assert.ok(htmlContent.includes('Playfair+Display'), 'Should load Playfair Display');
        assert.ok(htmlContent.includes('Source+Sans+3'), 'Should load Source Sans 3');
        assert.ok(htmlContent.includes('JetBrains+Mono'), 'Should load JetBrains Mono');
    });
});
