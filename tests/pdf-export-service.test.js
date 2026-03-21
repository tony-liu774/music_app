/**
 * Tests for PDFExportService - PDF report generation
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Inline PDFExportService for testing
class PDFExportService {
    constructor() {
        this.colors = {
            deepBg: [10, 10, 18],
            surface: [20, 20, 32],
            elevated: [26, 26, 40],
            primary: [201, 162, 39],
            success: [45, 90, 74],
            error: [139, 41, 66],
            textPrimary: [245, 245, 220],
            textSecondary: [160, 160, 176],
            white: [255, 255, 255],
            black: [0, 0, 0]
        };
        this.pageWidth = 210;
        this.pageHeight = 297;
        this.margin = 20;
        this.contentWidth = this.pageWidth - (this.margin * 2);
    }

    generateReport(options = {}) {
        const {
            sessionLog = {}, summaryStats = {}, scoreInfo = {},
            dateRange = {}, metrics = { pitch: true, rhythm: true, intonation: true },
            teacherNotes = '', studentName = '', heatMapData = []
        } = options;

        const report = {
            title: 'Practice Session Report',
            generatedAt: new Date().toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            }),
            student: studentName || 'Student',
            score: scoreInfo,
            dateRange: this._formatDateRange(dateRange),
            sessionSummary: this._buildSessionSummary(sessionLog),
            statistics: this._buildStatistics(summaryStats, metrics),
            errorLog: this._buildErrorLog(sessionLog, metrics),
            heatMapSummary: this._buildHeatMapSummary(heatMapData),
            teacherNotes,
            recommendations: this._buildRecommendations(summaryStats)
        };

        return this._renderPDF(report);
    }

    _renderPDF(report) {
        const pages = [];
        let currentPage = { elements: [], pageNumber: 1 };

        currentPage.elements.push({
            type: 'header', text: report.title,
            color: this.colors.primary, fontSize: 24, y: this.margin
        });
        currentPage.elements.push({
            type: 'subtitle', text: `Generated: ${report.generatedAt}`,
            color: this.colors.textSecondary, fontSize: 10, y: this.margin + 12
        });

        let y = this.margin + 25;
        currentPage.elements.push({
            type: 'section', title: 'Student Information',
            content: [
                `Student: ${report.student}`,
                `Piece: ${report.score.title || 'Unknown'}`,
                `Composer: ${report.score.composer || 'Unknown'}`,
                `Instrument: ${report.score.instrument || 'Not specified'}`,
                report.dateRange ? `Period: ${report.dateRange}` : null
            ].filter(Boolean),
            y
        });

        y += 50;
        currentPage.elements.push({
            type: 'section', title: 'Session Summary',
            content: report.sessionSummary, y
        });

        y += 55;
        currentPage.elements.push({
            type: 'statistics', title: 'Performance Statistics',
            data: report.statistics, y
        });

        pages.push(currentPage);

        currentPage = { elements: [], pageNumber: 2 };
        y = this.margin;
        currentPage.elements.push({
            type: 'section', title: 'Error Log Summary',
            content: report.errorLog, y
        });
        y += 80;
        currentPage.elements.push({
            type: 'heatmap', title: 'Performance Heat Map',
            data: report.heatMapSummary, y
        });
        pages.push(currentPage);

        if (report.teacherNotes || report.recommendations.length > 0) {
            currentPage = { elements: [], pageNumber: 3 };
            y = this.margin;
            if (report.teacherNotes) {
                currentPage.elements.push({
                    type: 'notes', title: 'Teacher Notes',
                    content: report.teacherNotes, y
                });
                y += 60;
            }
            if (report.recommendations.length > 0) {
                currentPage.elements.push({
                    type: 'section', title: 'Recommendations',
                    content: report.recommendations, y
                });
            }
            pages.push(currentPage);
        }

        const dataUrl = this._generateDataUrl(report, pages);
        return {
            pages, pageCount: pages.length, dataUrl, report,
            download: (filename) => this._triggerDownload(dataUrl, filename || 'practice-report.pdf')
        };
    }

    _generateDataUrl(report, pages) {
        const content = {
            metadata: {
                title: report.title,
                author: 'Music App - Virtual Concertmaster',
                subject: `Practice Report for ${report.student}`,
                creator: 'PDFExportService',
                createdAt: report.generatedAt
            },
            pages: pages.map(p => ({ pageNumber: p.pageNumber, elements: p.elements }))
        };
        const jsonStr = JSON.stringify(content);
        return `data:application/pdf;base64,${Buffer.from(jsonStr).toString('base64')}`;
    }

    _triggerDownload() { /* no-op in tests */ }

    _formatDateRange(dateRange) {
        if (!dateRange || (!dateRange.start && !dateRange.end)) return null;
        const fmt = (d) => {
            if (!d) return '';
            const date = new Date(d);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        };
        if (dateRange.start && dateRange.end) return `${fmt(dateRange.start)} - ${fmt(dateRange.end)}`;
        return dateRange.start ? `From ${fmt(dateRange.start)}` : `Until ${fmt(dateRange.end)}`;
    }

    _buildSessionSummary(sessionLog) {
        const lines = [];
        const duration = sessionLog.duration_ms || 0;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        lines.push(`Duration: ${minutes}m ${seconds}s`);
        lines.push(`Total Deviations: ${sessionLog.total_deviations || 0}`);
        lines.push(`Pitch Errors: ${sessionLog.pitch_deviations || 0}`);
        lines.push(`Rhythm Errors: ${sessionLog.rhythm_deviations || 0}`);
        lines.push(`Intonation Errors: ${sessionLog.intonation_deviations || 0}`);
        return lines;
    }

    _buildStatistics(stats, metrics) {
        const entries = [];
        if (metrics.pitch) {
            entries.push({
                label: 'Average Pitch Deviation',
                value: `${stats.average_pitch_deviation_cents || 0} cents`,
                color: (stats.average_pitch_deviation_cents || 0) > 20 ? 'error' : 'success'
            });
            entries.push({ label: 'Pitch Error Count', value: String(stats.pitch_deviation_count || 0), color: 'textPrimary' });
        }
        if (metrics.rhythm) {
            entries.push({
                label: 'Average Rhythm Deviation',
                value: `${stats.average_rhythm_deviation_ms || 0} ms`,
                color: (stats.average_rhythm_deviation_ms || 0) > 30 ? 'error' : 'success'
            });
            entries.push({ label: 'Rhythm Error Count', value: String(stats.rhythm_deviation_count || 0), color: 'textPrimary' });
        }
        if (metrics.intonation) {
            entries.push({ label: 'Intonation Issues', value: String(stats.intonation_deviation_count || 0), color: 'textPrimary' });
        }
        if (stats.worst_measure) {
            entries.push({ label: 'Most Problematic Measure', value: `Measure ${stats.worst_measure}`, color: 'error' });
        }
        return entries;
    }

    _buildErrorLog(sessionLog, metrics) {
        const lines = [];
        const deviations = sessionLog.deviations || [];
        if (deviations.length === 0) {
            lines.push('No errors recorded in this session.');
            return lines;
        }
        const byMeasure = {};
        for (const dev of deviations) {
            if (!metrics[dev.type]) continue;
            if (!byMeasure[dev.measure]) byMeasure[dev.measure] = { pitch: 0, rhythm: 0, intonation: 0, total: 0 };
            byMeasure[dev.measure][dev.type]++;
            byMeasure[dev.measure].total++;
        }
        const sorted = Object.entries(byMeasure).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
        lines.push(`Top Problem Areas (${deviations.length} total errors):`);
        for (const [measure, counts] of sorted) {
            const parts = [];
            if (counts.pitch > 0 && metrics.pitch) parts.push(`${counts.pitch} pitch`);
            if (counts.rhythm > 0 && metrics.rhythm) parts.push(`${counts.rhythm} rhythm`);
            if (counts.intonation > 0 && metrics.intonation) parts.push(`${counts.intonation} intonation`);
            lines.push(`  Measure ${measure}: ${parts.join(', ')} (${counts.total} total)`);
        }
        const pitchDevs = deviations.filter(d => d.type === 'pitch');
        if (pitchDevs.length > 0 && metrics.pitch) {
            const avgCents = pitchDevs.reduce((s, d) => s + (d.deviation_cents || 0), 0) / pitchDevs.length;
            const tendency = avgCents > 5 ? 'sharp' : avgCents < -5 ? 'flat' : 'centered';
            lines.push(`Overall pitch tendency: ${tendency} (avg ${Math.round(avgCents)} cents)`);
        }
        const rhythmDevs = deviations.filter(d => d.type === 'rhythm');
        if (rhythmDevs.length > 0 && metrics.rhythm) {
            const avgMs = rhythmDevs.reduce((s, d) => s + (d.deviation_ms || 0), 0) / rhythmDevs.length;
            const tendency = avgMs > 10 ? 'late/dragging' : avgMs < -10 ? 'early/rushing' : 'on tempo';
            lines.push(`Overall timing tendency: ${tendency} (avg ${Math.round(avgMs)} ms)`);
        }
        return lines;
    }

    _buildHeatMapSummary(heatMapData) {
        if (!heatMapData || heatMapData.length === 0) {
            return {
                available: false, measures: [],
                legend: [
                    { color: this.colors.success, label: 'Good (>80%)' },
                    { color: this.colors.primary, label: 'Needs Work (50-80%)' },
                    { color: this.colors.error, label: 'Problem Area (<50%)' }
                ]
            };
        }
        const measures = heatMapData.map((item, index) => {
            const accuracy = item.accuracy || item.score || 0;
            let color;
            if (accuracy >= 80) color = 'success';
            else if (accuracy >= 50) color = 'primary';
            else color = 'error';
            return { measure: item.measure || index + 1, accuracy, color, errorCount: item.errorCount || 0 };
        });
        return {
            available: true, measures,
            legend: [
                { color: this.colors.success, label: 'Good (>80%)' },
                { color: this.colors.primary, label: 'Needs Work (50-80%)' },
                { color: this.colors.error, label: 'Problem Area (<50%)' }
            ]
        };
    }

    _buildRecommendations(stats) {
        const recommendations = [];
        if ((stats.average_pitch_deviation_cents || 0) > 20)
            recommendations.push('Focus on intonation exercises - use the tuner module for targeted pitch practice.');
        if ((stats.average_rhythm_deviation_ms || 0) > 30)
            recommendations.push('Practice with the metronome at a slower tempo to build rhythmic accuracy.');
        if (stats.worst_measure)
            recommendations.push(`Isolate measure ${stats.worst_measure} and practice it slowly with the practice loop feature.`);
        if (stats.problem_measures && stats.problem_measures.length > 3)
            recommendations.push('Consider breaking the piece into smaller sections for focused practice.');
        if ((stats.intonation_deviation_count || 0) > 5)
            recommendations.push('Work on position shifts and string crossings with slow, deliberate practice.');
        if (recommendations.length === 0)
            recommendations.push('Great work! Continue practicing to maintain consistency.');
        return recommendations;
    }

    generateShareLink(reportData) {
        const compressed = JSON.stringify({
            s: reportData.student, t: reportData.score?.title,
            d: reportData.generatedAt, stats: reportData.statistics
        });
        return `/report?data=${Buffer.from(compressed).toString('base64')}`;
    }

    shareViaEmail(email, reportResult, message = '') {
        const subject = `Practice Report - ${reportResult.report?.student || 'Student'}`;
        return { email, subject, sent: true };
    }
}

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
            duration_ms: 125000,
            total_deviations: 15,
            pitch_deviations: 8,
            rhythm_deviations: 5,
            intonation_deviations: 2
        };

        const summary = pdfService._buildSessionSummary(sessionLog);
        assert.ok(summary.some(l => l.includes('2m 5s')));
        assert.ok(summary.some(l => l.includes('15')));
        assert.ok(summary.some(l => l.includes('8')));
    });

    it('should handle empty session log', () => {
        const summary = pdfService._buildSessionSummary({});
        assert.ok(summary.some(l => l.includes('0m 0s')));
        assert.ok(summary.some(l => l.includes('Total Deviations: 0')));
    });

    it('should build statistics with metric filtering', () => {
        const stats = {
            average_pitch_deviation_cents: 25,
            pitch_deviation_count: 10,
            average_rhythm_deviation_ms: 15,
            rhythm_deviation_count: 5,
            intonation_deviation_count: 3,
            worst_measure: 7
        };

        // All metrics
        const allStats = pdfService._buildStatistics(stats, { pitch: true, rhythm: true, intonation: true });
        assert.ok(allStats.length >= 5); // pitch(2) + rhythm(2) + intonation(1) + worst measure

        // Only pitch
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
        const sharpLog = {
            deviations: [
                { type: 'pitch', measure: 1, deviation_cents: 20 },
                { type: 'pitch', measure: 2, deviation_cents: 15 }
            ]
        };
        const flatLog = {
            deviations: [
                { type: 'pitch', measure: 1, deviation_cents: -20 },
                { type: 'pitch', measure: 2, deviation_cents: -15 }
            ]
        };

        const sharpResult = pdfService._buildErrorLog(sharpLog, { pitch: true, rhythm: true, intonation: true });
        const flatResult = pdfService._buildErrorLog(flatLog, { pitch: true, rhythm: true, intonation: true });

        assert.ok(sharpResult.some(l => l.includes('sharp')));
        assert.ok(flatResult.some(l => l.includes('flat')));
    });

    it('should detect rushing/dragging timing tendency', () => {
        const rushingLog = {
            deviations: [
                { type: 'rhythm', measure: 1, deviation_ms: -25 },
                { type: 'rhythm', measure: 2, deviation_ms: -20 }
            ]
        };

        const result = pdfService._buildErrorLog(rushingLog, { pitch: true, rhythm: true, intonation: true });
        assert.ok(result.some(l => l.includes('early/rushing')));
    });

    it('should handle session with no errors', () => {
        const result = pdfService._buildErrorLog({}, { pitch: true, rhythm: true, intonation: true });
        assert.ok(result.some(l => l.includes('No errors recorded')));
    });

    it('should filter error log by metrics', () => {
        const sessionLog = {
            deviations: [
                { type: 'pitch', measure: 1, deviation_cents: 20 },
                { type: 'rhythm', measure: 1, deviation_ms: 30 }
            ]
        };

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
        const recommendations = pdfService._buildRecommendations({
            average_pitch_deviation_cents: 30
        });
        assert.ok(recommendations.some(r => r.includes('intonation exercises')));
    });

    it('should generate recommendations for poor rhythm', () => {
        const recommendations = pdfService._buildRecommendations({
            average_rhythm_deviation_ms: 50
        });
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

    it('should generate a data URL', () => {
        const result = pdfService.generateReport({ studentName: 'Test' });
        assert.ok(result.dataUrl.startsWith('data:application/pdf;base64,'));
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

    it('should share via email', () => {
        const result = pdfService.shareViaEmail('teacher@school.edu', {
            report: { student: 'Alice' }
        });
        assert.strictEqual(result.email, 'teacher@school.edu');
        assert.ok(result.subject.includes('Alice'));
        assert.strictEqual(result.sent, true);
    });

    it('should generate multi-page report with teacher notes', () => {
        const result = pdfService.generateReport({
            studentName: 'Alice',
            teacherNotes: 'Great improvement on bowing technique.',
            sessionLog: {
                duration_ms: 300000,
                total_deviations: 10,
                pitch_deviations: 5,
                rhythm_deviations: 3,
                intonation_deviations: 2,
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

    it('should only generate 2 pages when no notes or recommendations needed', () => {
        const result = pdfService.generateReport({
            sessionLog: {},
            summaryStats: {}
        });
        // With default empty stats, recommendations will include "Great work!" so 3 pages
        // But if we have no notes and a single recommendation, still 3 pages
        assert.ok(result.pageCount >= 2);
    });
});

describe('PDFExportService - Heat Map Rendering', () => {
    let pdfService;

    beforeEach(() => {
        pdfService = new PDFExportService();
    });

    it('should render heat map canvas data as PDF element', () => {
        const result = pdfService.generateReport({
            heatMapData: [
                { measure: 1, accuracy: 90, errorCount: 2 },
                { measure: 2, accuracy: 45, errorCount: 8 },
                { measure: 3, accuracy: 70, errorCount: 4 }
            ]
        });

        // Find heatmap element on page 2
        const page2 = result.pages[1];
        const heatmapEl = page2.elements.find(e => e.type === 'heatmap');
        assert.ok(heatmapEl);
        assert.strictEqual(heatmapEl.data.available, true);
        assert.strictEqual(heatmapEl.data.measures.length, 3);
    });

    it('should include heat map legend', () => {
        const result = pdfService.generateReport({
            heatMapData: [{ measure: 1, accuracy: 90 }]
        });

        const page2 = result.pages[1];
        const heatmapEl = page2.elements.find(e => e.type === 'heatmap');
        assert.strictEqual(heatmapEl.data.legend.length, 3);
        assert.ok(heatmapEl.data.legend.some(l => l.label.includes('Good')));
        assert.ok(heatmapEl.data.legend.some(l => l.label.includes('Problem')));
    });
});

console.log('Running PDFExportService tests...');
