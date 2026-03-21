/**
 * Tests for PDFExportService - PDF report generation
 * Imports the actual source file (tests fallback mode since jsPDF is not in browser context)
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const PDFExportService = require('../src/js/services/pdf-export-service');

describe('PDFExportService', () => {
    let pdfService;

    beforeEach(() => {
        pdfService = new PDFExportService();
    });

    afterEach(() => {
        pdfService = null;
    });

    it('should initialize with Midnight Conservatory theme colors', () => {
        assert.deepStrictEqual(pdfService.colors.deepBg, [10, 10, 18]);
        assert.deepStrictEqual(pdfService.colors.primary, [201, 162, 39]);
        assert.deepStrictEqual(pdfService.colors.success, [45, 90, 74]);
        assert.deepStrictEqual(pdfService.colors.error, [139, 41, 66]);
    });

    it('should generate a basic report with defaults', () => {
        const result = pdfService.generateReport();
        assert.ok(result.pages);
        assert.ok(result.pageCount >= 2);
        assert.ok(result.dataUrl);
        assert.ok(result.report);
    });

    it('should include student name in report', () => {
        const result = pdfService.generateReport({ studentName: 'Alice Chen' });
        assert.strictEqual(result.report.student, 'Alice Chen');
    });

    it('should default student name to "Student"', () => {
        const result = pdfService.generateReport({});
        assert.strictEqual(result.report.student, 'Student');
    });

    it('should include score information', () => {
        const result = pdfService.generateReport({
            scoreInfo: { title: 'Bach Cello Suite No. 1', composer: 'J.S. Bach', instrument: 'Cello' }
        });
        assert.strictEqual(result.report.score.title, 'Bach Cello Suite No. 1');
        assert.strictEqual(result.report.score.composer, 'J.S. Bach');
    });

    it('should format date range correctly', () => {
        const dateRange = { start: '2024-01-01', end: '2024-01-31' };
        const formatted = pdfService._formatDateRange(dateRange);
        assert.ok(formatted.includes('Jan'));
        assert.ok(formatted.includes('2024'));
        assert.ok(formatted.includes(' - '));
    });

    it('should handle start-only date range', () => {
        const formatted = pdfService._formatDateRange({ start: '2024-01-01', end: null });
        assert.ok(formatted.startsWith('From'));
    });

    it('should handle end-only date range', () => {
        const formatted = pdfService._formatDateRange({ start: null, end: '2024-01-31' });
        assert.ok(formatted.startsWith('Until'));
    });

    it('should return null for empty date range', () => {
        assert.strictEqual(pdfService._formatDateRange({}), null);
        assert.strictEqual(pdfService._formatDateRange(null), null);
    });

    it('should build session summary from session log', () => {
        const sessionLog = {
            duration_ms: 125000, total_deviations: 15,
            pitch_deviations: 8, rhythm_deviations: 5, intonation_deviations: 2
        };

        const summary = pdfService._buildSessionSummary(sessionLog);
        assert.ok(summary.some(l => l.includes('2m 5s')));
        assert.ok(summary.some(l => l.includes('15')));
    });

    it('should handle empty session log', () => {
        const summary = pdfService._buildSessionSummary({});
        assert.ok(summary.some(l => l.includes('0m 0s')));
        assert.ok(summary.some(l => l.includes('Total Deviations: 0')));
    });

    it('should build statistics with metric filtering', () => {
        const stats = {
            average_pitch_deviation_cents: 25, pitch_deviation_count: 10,
            average_rhythm_deviation_ms: 15, rhythm_deviation_count: 5,
            intonation_deviation_count: 3, worst_measure: 7
        };

        const allStats = pdfService._buildStatistics(stats, { pitch: true, rhythm: true, intonation: true });
        assert.ok(allStats.length >= 5);

        const pitchOnly = pdfService._buildStatistics(stats, { pitch: true, rhythm: false, intonation: false });
        assert.ok(pitchOnly.some(s => s.label === 'Average Pitch Deviation'));
        assert.ok(!pitchOnly.some(s => s.label === 'Average Rhythm Deviation'));
    });

    it('should color-code statistics based on thresholds', () => {
        const goodStats = { average_pitch_deviation_cents: 10, average_rhythm_deviation_ms: 15 };
        const badStats = { average_pitch_deviation_cents: 30, average_rhythm_deviation_ms: 50 };

        const goodResult = pdfService._buildStatistics(goodStats, { pitch: true, rhythm: true, intonation: false });
        const badResult = pdfService._buildStatistics(badStats, { pitch: true, rhythm: true, intonation: false });

        assert.strictEqual(goodResult[0].color, 'success');
        assert.strictEqual(badResult[0].color, 'error');
    });

    it('should build error log grouped by measure', () => {
        const sessionLog = {
            deviations: [
                { type: 'pitch', measure: 1, deviation_cents: -15 },
                { type: 'pitch', measure: 1, deviation_cents: -20 },
                { type: 'rhythm', measure: 1, deviation_ms: 25 },
                { type: 'pitch', measure: 3, deviation_cents: 10 },
                { type: 'rhythm', measure: 5, deviation_ms: -30 }
            ]
        };

        const errorLog = pdfService._buildErrorLog(sessionLog, { pitch: true, rhythm: true, intonation: true });
        assert.ok(errorLog.some(l => l.includes('Measure 1')));
        assert.ok(errorLog.some(l => l.includes('5 total errors')));
    });

    it('should detect sharp/flat pitch tendency', () => {
        const sharpLog = { deviations: [
            { type: 'pitch', measure: 1, deviation_cents: 20 },
            { type: 'pitch', measure: 2, deviation_cents: 15 }
        ]};
        const flatLog = { deviations: [
            { type: 'pitch', measure: 1, deviation_cents: -20 },
            { type: 'pitch', measure: 2, deviation_cents: -15 }
        ]};

        assert.ok(pdfService._buildErrorLog(sharpLog, { pitch: true, rhythm: true, intonation: true }).some(l => l.includes('sharp')));
        assert.ok(pdfService._buildErrorLog(flatLog, { pitch: true, rhythm: true, intonation: true }).some(l => l.includes('flat')));
    });

    it('should detect rushing/dragging timing tendency', () => {
        const rushingLog = { deviations: [
            { type: 'rhythm', measure: 1, deviation_ms: -25 },
            { type: 'rhythm', measure: 2, deviation_ms: -20 }
        ]};

        const result = pdfService._buildErrorLog(rushingLog, { pitch: true, rhythm: true, intonation: true });
        assert.ok(result.some(l => l.includes('early/rushing')));
    });

    it('should handle session with no errors', () => {
        const result = pdfService._buildErrorLog({}, { pitch: true, rhythm: true, intonation: true });
        assert.ok(result.some(l => l.includes('No errors recorded')));
    });

    it('should filter error log by metrics', () => {
        const sessionLog = { deviations: [
            { type: 'pitch', measure: 1, deviation_cents: 20 },
            { type: 'rhythm', measure: 1, deviation_ms: 30 }
        ]};

        const pitchOnly = pdfService._buildErrorLog(sessionLog, { pitch: true, rhythm: false, intonation: false });
        assert.ok(pitchOnly.some(l => l.includes('pitch')));
        assert.ok(!pitchOnly.some(l => l.includes('rhythm')));
    });

    it('should build heat map summary with color coding', () => {
        const heatMapData = [
            { measure: 1, accuracy: 95 },
            { measure: 2, accuracy: 65 },
            { measure: 3, accuracy: 30 }
        ];

        const summary = pdfService._buildHeatMapSummary(heatMapData);
        assert.strictEqual(summary.available, true);
        assert.strictEqual(summary.measures.length, 3);
        assert.strictEqual(summary.measures[0].color, 'success');
        assert.strictEqual(summary.measures[1].color, 'primary');
        assert.strictEqual(summary.measures[2].color, 'error');
    });

    it('should handle empty heat map data', () => {
        const summary = pdfService._buildHeatMapSummary([]);
        assert.strictEqual(summary.available, false);
        assert.strictEqual(summary.measures.length, 0);
        assert.strictEqual(summary.legend.length, 3);
    });

    it('should generate recommendations for poor pitch', () => {
        const recommendations = pdfService._buildRecommendations({ average_pitch_deviation_cents: 30 });
        assert.ok(recommendations.some(r => r.includes('intonation exercises')));
    });

    it('should generate recommendations for poor rhythm', () => {
        const recommendations = pdfService._buildRecommendations({ average_rhythm_deviation_ms: 50 });
        assert.ok(recommendations.some(r => r.includes('metronome')));
    });

    it('should recommend isolating worst measure', () => {
        const recommendations = pdfService._buildRecommendations({ worst_measure: 12 });
        assert.ok(recommendations.some(r => r.includes('measure 12')));
    });

    it('should recommend breaking piece into sections for many problems', () => {
        const recommendations = pdfService._buildRecommendations({
            problem_measures: [{ measure: 1 }, { measure: 2 }, { measure: 3 }, { measure: 4 }]
        });
        assert.ok(recommendations.some(r => r.includes('smaller sections')));
    });

    it('should give positive feedback when no issues', () => {
        const recommendations = pdfService._buildRecommendations({});
        assert.ok(recommendations.some(r => r.includes('Great work')));
    });

    it('should generate a fallback data URL when jsPDF not available', () => {
        const result = pdfService.generateReport({ studentName: 'Test' });
        // In Node without browser jsPDF, falls back to JSON
        assert.ok(result.dataUrl.startsWith('data:application/'));
    });

    it('should include a download function', () => {
        const result = pdfService.generateReport({});
        assert.strictEqual(typeof result.download, 'function');
    });

    it('should generate share link', () => {
        const link = pdfService.generateShareLink({
            student: 'Alice',
            score: { title: 'Sonata' },
            generatedAt: '2024-01-15',
            statistics: {}
        });
        assert.ok(link.includes('/report?data='));
    });

    it('should share via email and return mailtoOpened status', () => {
        const result = pdfService.shareViaEmail('teacher@school.edu', {
            report: { student: 'Alice' }
        });
        assert.strictEqual(result.email, 'teacher@school.edu');
        assert.ok(result.subject.includes('Alice'));
        assert.strictEqual(result.mailtoOpened, true);
    });

    it('should generate multi-page report with teacher notes', () => {
        const result = pdfService.generateReport({
            studentName: 'Alice',
            teacherNotes: 'Great improvement on bowing technique.',
            sessionLog: {
                duration_ms: 300000, total_deviations: 10,
                pitch_deviations: 5, rhythm_deviations: 3, intonation_deviations: 2,
                deviations: [
                    { type: 'pitch', measure: 1, deviation_cents: -15 },
                    { type: 'rhythm', measure: 2, deviation_ms: 30 }
                ]
            },
            summaryStats: {
                average_pitch_deviation_cents: 15,
                average_rhythm_deviation_ms: 20,
                worst_measure: 3
            }
        });

        assert.strictEqual(result.pageCount, 3);
        assert.strictEqual(result.report.teacherNotes, 'Great improvement on bowing technique.');
    });

    it('should generate at least 2 pages', () => {
        const result = pdfService.generateReport({ sessionLog: {}, summaryStats: {} });
        assert.ok(result.pageCount >= 2);
    });
});

describe('PDFExportService - Heat Map Rendering', () => {
    let pdfService;

    beforeEach(() => {
        pdfService = new PDFExportService();
    });

    it('should include heat map data in report', () => {
        const result = pdfService.generateReport({
            heatMapData: [
                { measure: 1, accuracy: 90, errorCount: 2 },
                { measure: 2, accuracy: 45, errorCount: 8 },
                { measure: 3, accuracy: 70, errorCount: 4 }
            ]
        });

        // Verify heat map data in the report structure
        assert.strictEqual(result.report.heatMapSummary.available, true);
        assert.strictEqual(result.report.heatMapSummary.measures.length, 3);
        assert.strictEqual(result.report.heatMapSummary.measures[0].color, 'success');
        assert.strictEqual(result.report.heatMapSummary.measures[1].color, 'error');
        assert.strictEqual(result.report.heatMapSummary.measures[2].color, 'primary');
    });

    it('should include heat map legend', () => {
        const result = pdfService.generateReport({
            heatMapData: [{ measure: 1, accuracy: 90 }]
        });

        assert.strictEqual(result.report.heatMapSummary.legend.length, 3);
        assert.ok(result.report.heatMapSummary.legend.some(l => l.label.includes('Good')));
        assert.ok(result.report.heatMapSummary.legend.some(l => l.label.includes('Problem')));
    });
});

console.log('Running PDFExportService tests...');
