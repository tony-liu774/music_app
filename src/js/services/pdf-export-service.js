/**
 * PDF Export Service - Generates professional teacher reports from session data
 * Uses jsPDF for real PDF generation
 * Includes session summary, error log, heat map, and teacher notes
 */

// jsPDF loaded via script tag in browser, or via require in Node
const jsPDFModule = (typeof require !== 'undefined') ? (() => { try { return require('jspdf'); } catch { return null; } })() : null;

class PDFExportService {
    constructor() {
        // Midnight Conservatory theme colors (RGB)
        this.colors = {
            deepBg: [10, 10, 18],          // #0a0a12
            surface: [20, 20, 32],           // #141420
            elevated: [26, 26, 40],          // #1a1a28
            primary: [201, 162, 39],         // #c9a227 - Amber
            success: [45, 90, 74],           // #2d5a4a - Emerald
            error: [139, 41, 66],            // #8b2942 - Crimson
            textPrimary: [245, 245, 220],    // #f5f5dc
            textSecondary: [160, 160, 176],  // #a0a0b0
            white: [255, 255, 255],
            black: [0, 0, 0]
        };

        this.pageWidth = 210;  // A4 width in mm
        this.pageHeight = 297; // A4 height in mm
        this.margin = 20;
        this.contentWidth = this.pageWidth - (this.margin * 2);
    }

    /**
     * Generate a PDF report from session data
     * @param {Object} options - Report options
     * @param {Object} options.sessionLog - Session log from SessionLogger
     * @param {Object} options.summaryStats - Summary statistics
     * @param {Object} options.scoreInfo - Score metadata (title, composer, etc.)
     * @param {Object} options.dateRange - Date range filter { start, end }
     * @param {Object} options.metrics - Which metrics to include { pitch, rhythm, intonation }
     * @param {string} options.teacherNotes - Free-text teacher notes
     * @param {string} options.studentName - Student name
     * @param {Array} options.heatMapData - Heat map data array
     * @returns {Object} PDF document result
     */
    generateReport(options = {}) {
        const {
            sessionLog = {},
            summaryStats = {},
            scoreInfo = {},
            dateRange = {},
            metrics = { pitch: true, rhythm: true, intonation: true },
            teacherNotes = '',
            studentName = '',
            heatMapData = []
        } = options;

        // Build structured report data
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

    /**
     * Render the PDF document using jsPDF
     * @param {Object} report - Structured report data
     * @returns {Object} PDF result with dataUrl and pages
     * @private
     */
    _renderPDF(report) {
        // Try to use jsPDF for real PDF generation
        const jsPDF = this._getJsPDF();

        if (jsPDF) {
            return this._renderWithJsPDF(jsPDF, report);
        }

        // Fallback: structured page data for environments without jsPDF
        return this._renderStructured(report);
    }

    /**
     * Get the jsPDF constructor
     * @returns {Function|null}
     * @private
     */
    _getJsPDF() {
        // Browser: loaded via script tag
        if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) {
            return window.jspdf.jsPDF;
        }
        // Node.js: loaded via require
        if (jsPDFModule) {
            return jsPDFModule.jsPDF || jsPDFModule;
        }
        return null;
    }

    /**
     * Render a real PDF using jsPDF
     * @param {Function} jsPDF - jsPDF constructor
     * @param {Object} report - Report data
     * @returns {Object} PDF result
     * @private
     */
    _renderWithJsPDF(jsPDF, report) {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const m = this.margin;
        const w = this.contentWidth;

        // Set document properties
        doc.setProperties({
            title: report.title,
            subject: `Practice Report for ${report.student}`,
            author: 'Music App - Virtual Concertmaster',
            creator: 'PDFExportService'
        });

        // --- Page 1: Title & Summary ---
        let y = m;

        // Title
        doc.setFontSize(24);
        doc.setTextColor(...this.colors.primary);
        doc.text(report.title, m, y + 8);
        y += 14;

        // Subtitle
        doc.setFontSize(10);
        doc.setTextColor(...this.colors.textSecondary);
        doc.text(`Generated: ${report.generatedAt}`, m, y + 4);
        y += 12;

        // Divider
        doc.setDrawColor(...this.colors.primary);
        doc.setLineWidth(0.5);
        doc.line(m, y, m + w, y);
        y += 8;

        // Student info section
        y = this._addSection(doc, 'Student Information', [
            `Student: ${report.student}`,
            `Piece: ${report.score.title || 'Unknown'}`,
            `Composer: ${report.score.composer || 'Unknown'}`,
            `Instrument: ${report.score.instrument || 'Not specified'}`,
            ...(report.dateRange ? [`Period: ${report.dateRange}`] : [])
        ], y, m);

        y += 5;

        // Session summary
        y = this._addSection(doc, 'Session Summary', report.sessionSummary, y, m);
        y += 5;

        // Statistics
        doc.setFontSize(12);
        doc.setTextColor(...this.colors.primary);
        doc.text('Performance Statistics', m, y);
        y += 6;

        for (const stat of report.statistics) {
            const colorKey = stat.color || 'textPrimary';
            const color = this.colors[colorKey] || this.colors.textPrimary;
            doc.setFontSize(10);
            doc.setTextColor(...this.colors.textSecondary);
            doc.text(`${stat.label}:`, m + 2, y);
            doc.setTextColor(...color);
            doc.text(stat.value, m + 70, y);
            y += 5;
        }

        // --- Page 2: Error Log & Heat Map ---
        doc.addPage();
        y = m;

        y = this._addSection(doc, 'Error Log Summary', report.errorLog, y, m);
        y += 10;

        // Heat map visualization
        doc.setFontSize(12);
        doc.setTextColor(...this.colors.primary);
        doc.text('Performance Heat Map', m, y);
        y += 8;

        if (report.heatMapSummary.available) {
            const measures = report.heatMapSummary.measures;
            const cellSize = Math.min(8, (w - 4) / Math.max(measures.length, 1));
            const cols = Math.floor(w / cellSize);

            for (let i = 0; i < measures.length; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = m + col * cellSize;
                const cy = y + row * cellSize;

                const colorKey = measures[i].color;
                const color = this.colors[colorKey] || this.colors.textSecondary;
                doc.setFillColor(...color);
                doc.rect(x, cy, cellSize - 1, cellSize - 1, 'F');

                doc.setFontSize(5);
                doc.setTextColor(...this.colors.white);
                doc.text(String(measures[i].measure), x + 1, cy + cellSize - 2);
            }

            y += (Math.ceil(measures.length / cols) + 1) * cellSize + 5;
        } else {
            doc.setFontSize(10);
            doc.setTextColor(...this.colors.textSecondary);
            doc.text('No heat map data available.', m + 2, y);
            y += 8;
        }

        // Legend
        const legend = report.heatMapSummary.legend;
        for (const item of legend) {
            doc.setFillColor(...item.color);
            doc.rect(m + 2, y - 3, 4, 4, 'F');
            doc.setFontSize(8);
            doc.setTextColor(...this.colors.textSecondary);
            doc.text(item.label, m + 9, y);
            y += 6;
        }

        // --- Page 3: Teacher Notes & Recommendations ---
        if (report.teacherNotes || report.recommendations.length > 0) {
            doc.addPage();
            y = m;

            if (report.teacherNotes) {
                y = this._addSection(doc, 'Teacher Notes', [report.teacherNotes], y, m);
                y += 10;
            }

            if (report.recommendations.length > 0) {
                y = this._addSection(doc, 'Recommendations', report.recommendations.map((r, i) => `${i + 1}. ${r}`), y, m);
            }
        }

        const pageCount = doc.internal.getNumberOfPages();
        const dataUrl = doc.output('datauristring');

        return {
            pages: Array.from({ length: pageCount }, (_, i) => ({ pageNumber: i + 1 })),
            pageCount,
            dataUrl,
            report,
            download: (filename) => {
                doc.save(filename || 'practice-report.pdf');
            }
        };
    }

    /**
     * Add a section with title and content lines to the jsPDF doc
     * @param {Object} doc - jsPDF document
     * @param {string} title - Section title
     * @param {Array<string>} lines - Content lines
     * @param {number} y - Current Y position
     * @param {number} m - Margin
     * @returns {number} New Y position
     * @private
     */
    _addSection(doc, title, lines, y, m) {
        doc.setFontSize(12);
        doc.setTextColor(...this.colors.primary);
        doc.text(title, m, y);
        y += 6;

        doc.setFontSize(10);
        doc.setTextColor(...this.colors.textPrimary);
        for (const line of lines) {
            // Word-wrap long lines
            const wrapped = doc.splitTextToSize(line, this.contentWidth - 4);
            for (const wl of wrapped) {
                doc.text(wl, m + 2, y);
                y += 5;
            }
        }

        return y;
    }

    /**
     * Fallback structured rendering when jsPDF is not available
     * @param {Object} report - Report data
     * @returns {Object} Structured page result
     * @private
     */
    _renderStructured(report) {
        const pages = [];
        let currentPage = { elements: [], pageNumber: 1 };

        currentPage.elements.push({ type: 'header', text: report.title, color: this.colors.primary, fontSize: 24, y: this.margin });
        currentPage.elements.push({ type: 'subtitle', text: `Generated: ${report.generatedAt}`, color: this.colors.textSecondary, fontSize: 10, y: this.margin + 12 });

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
        currentPage.elements.push({ type: 'section', title: 'Session Summary', content: report.sessionSummary, y });
        y += 55;
        currentPage.elements.push({ type: 'statistics', title: 'Performance Statistics', data: report.statistics, y });
        pages.push(currentPage);

        currentPage = { elements: [], pageNumber: 2 };
        y = this.margin;
        currentPage.elements.push({ type: 'section', title: 'Error Log Summary', content: report.errorLog, y });
        y += 80;
        currentPage.elements.push({ type: 'heatmap', title: 'Performance Heat Map', data: report.heatMapSummary, y });
        pages.push(currentPage);

        if (report.teacherNotes || report.recommendations.length > 0) {
            currentPage = { elements: [], pageNumber: 3 };
            y = this.margin;
            if (report.teacherNotes) {
                currentPage.elements.push({ type: 'notes', title: 'Teacher Notes', content: report.teacherNotes, y });
                y += 60;
            }
            if (report.recommendations.length > 0) {
                currentPage.elements.push({ type: 'section', title: 'Recommendations', content: report.recommendations, y });
            }
            pages.push(currentPage);
        }

        const dataUrl = this._generateFallbackDataUrl(report, pages);

        return {
            pages,
            pageCount: pages.length,
            dataUrl,
            report,
            download: (filename) => this._triggerDownload(dataUrl, filename || 'practice-report.pdf')
        };
    }

    /**
     * Generate fallback data URL when jsPDF is unavailable
     * @param {Object} report - Report data
     * @param {Array} pages - Page data
     * @returns {string} Data URL
     * @private
     */
    _generateFallbackDataUrl(report, pages) {
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
        if (typeof btoa !== 'undefined') {
            return `data:application/json;base64,${btoa(jsonStr)}`;
        }
        if (typeof Buffer !== 'undefined') {
            return `data:application/json;base64,${Buffer.from(jsonStr).toString('base64')}`;
        }
        return `data:application/json;content,${encodeURIComponent(jsonStr)}`;
    }

    /**
     * Trigger a download of the PDF
     * @param {string} dataUrl - Data URL
     * @param {string} filename - Filename
     * @private
     */
    _triggerDownload(dataUrl, filename) {
        if (typeof document !== 'undefined') {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    /**
     * Format date range for display
     * @param {Object} dateRange - { start, end }
     * @returns {string|null}
     * @private
     */
    _formatDateRange(dateRange) {
        if (!dateRange || (!dateRange.start && !dateRange.end)) return null;

        const fmt = (d) => {
            if (!d) return '';
            const date = new Date(d);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        };

        if (dateRange.start && dateRange.end) {
            return `${fmt(dateRange.start)} - ${fmt(dateRange.end)}`;
        }
        return dateRange.start ? `From ${fmt(dateRange.start)}` : `Until ${fmt(dateRange.end)}`;
    }

    /**
     * Build session summary lines
     * @param {Object} sessionLog - Session log data
     * @returns {Array<string>} Summary lines
     * @private
     */
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

    /**
     * Build statistics section
     * @param {Object} stats - Summary statistics
     * @param {Object} metrics - Which metrics to include
     * @returns {Array<Object>} Statistics entries
     * @private
     */
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

    /**
     * Build error log summary
     * @param {Object} sessionLog - Session log data
     * @param {Object} metrics - Which metrics to include
     * @returns {Array<string>} Error log lines
     * @private
     */
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
            if (!byMeasure[dev.measure]) {
                byMeasure[dev.measure] = { pitch: 0, rhythm: 0, intonation: 0, total: 0 };
            }
            byMeasure[dev.measure][dev.type]++;
            byMeasure[dev.measure].total++;
        }

        const sorted = Object.entries(byMeasure)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 10);

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

    /**
     * Build heat map summary
     * @param {Array} heatMapData - Heat map data
     * @returns {Object} Heat map summary
     * @private
     */
    _buildHeatMapSummary(heatMapData) {
        if (!heatMapData || heatMapData.length === 0) {
            return {
                available: false,
                measures: [],
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

            return {
                measure: item.measure || index + 1,
                accuracy,
                color,
                errorCount: item.errorCount || 0
            };
        });

        return {
            available: true,
            measures,
            legend: [
                { color: this.colors.success, label: 'Good (>80%)' },
                { color: this.colors.primary, label: 'Needs Work (50-80%)' },
                { color: this.colors.error, label: 'Problem Area (<50%)' }
            ]
        };
    }

    /**
     * Build practice recommendations based on statistics
     * @param {Object} stats - Summary statistics
     * @returns {Array<string>} Recommendation lines
     * @private
     */
    _buildRecommendations(stats) {
        const recommendations = [];

        if ((stats.average_pitch_deviation_cents || 0) > 20) {
            recommendations.push('Focus on intonation exercises - use the tuner module for targeted pitch practice.');
        }
        if ((stats.average_rhythm_deviation_ms || 0) > 30) {
            recommendations.push('Practice with the metronome at a slower tempo to build rhythmic accuracy.');
        }
        if (stats.worst_measure) {
            recommendations.push(`Isolate measure ${stats.worst_measure} and practice it slowly with the practice loop feature.`);
        }
        if (stats.problem_measures && stats.problem_measures.length > 3) {
            recommendations.push('Consider breaking the piece into smaller sections for focused practice.');
        }
        if ((stats.intonation_deviation_count || 0) > 5) {
            recommendations.push('Work on position shifts and string crossings with slow, deliberate practice.');
        }
        if (recommendations.length === 0) {
            recommendations.push('Great work! Continue practicing to maintain consistency.');
        }

        return recommendations;
    }

    /**
     * Generate a shareable link for the report (uses summary only, no PII in URL)
     * @param {Object} reportData - Report data to encode
     * @returns {string} Shareable URL with minimal data
     */
    generateShareLink(reportData) {
        const compressed = JSON.stringify({
            s: reportData.student,
            t: reportData.score?.title,
            d: reportData.generatedAt,
            stats: reportData.statistics
        });

        const origin = (typeof location !== 'undefined' && location?.origin) || '';
        if (typeof btoa !== 'undefined') {
            return `${origin}/report?data=${btoa(compressed)}`;
        }
        if (typeof Buffer !== 'undefined') {
            return `/report?data=${Buffer.from(compressed).toString('base64')}`;
        }
        return `/report?data=${encodeURIComponent(compressed)}`;
    }

    /**
     * Open the user's email client with report details.
     * Note: This opens a mailto link - actual sending depends on the user's mail client.
     * @param {string} email - Recipient email
     * @param {Object} reportResult - PDF generation result
     * @param {string} message - Optional message
     * @returns {Object} Status indicating the mailto link was opened
     */
    shareViaEmail(email, reportResult, message = '') {
        const subject = encodeURIComponent(
            `Practice Report - ${reportResult.report?.student || 'Student'}`
        );
        const body = encodeURIComponent(
            `${message}\n\nPractice report attached.\nGenerated by Virtual Concertmaster.`
        );

        if (typeof window !== 'undefined') {
            window.open(`mailto:${email}?subject=${subject}&body=${body}`);
        }

        return { email, subject: decodeURIComponent(subject), mailtoOpened: true };
    }
}

if (typeof window !== 'undefined') {
    window.PDFExportService = PDFExportService;
}
if (typeof module !== 'undefined') {
    module.exports = PDFExportService;
}
