/**
 * Heat Map Renderer - Visual overlay showing problem areas on sheet music
 */

class HeatMapRenderer {
    constructor(container) {
        this.container = container;
        this.measureData = [];
        this.noteData = []; // Store note-level data for detail view
        this.canvas = null;
        this.ctx = null;
        this.onMeasureClick = null; // Callback for measure click
        this.barRects = []; // Store bar positions for click detection
    }

    init() {
        // Create canvas for rendering
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'heatmap-canvas';
        this.container?.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
        this.resize();

        // Add click handler
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.style.cursor = 'pointer';
    }

    handleClick(event) {
        if (!this.barRects.length) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Find which bar was clicked
        for (const barRect of this.barRects) {
            if (x >= barRect.x && x <= barRect.x + barRect.width &&
                y >= barRect.y && y <= barRect.y + barRect.height) {
                // Show detail for this measure
                if (this.onMeasureClick) {
                    const noteDetails = this.getNoteDetailsForMeasure(barRect.measure);
                    this.onMeasureClick(barRect.measure, barRect.score, noteDetails);
                }
                return;
            }
        }
    }

    getNoteDetailsForMeasure(measure) {
        return this.noteData.filter(n => n.measure === measure).map(n => ({
            note: n.noteName || '?',
            accuracy: n.accuracy,
            centsDeviation: n.centsDeviation || 0,
            timestamp: n.timestamp
        }));
    }

    resize() {
        if (!this.canvas || !this.container) return;
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    setData(sessionData) {
        // Convert session data to measure-level scores
        this.measureData = this.calculateMeasureScores(sessionData);

        // Store note-level data for detail view
        this.noteData = [];
        if (sessionData && sessionData.notes) {
            for (const noteData of sessionData.notes) {
                if (noteData.note && noteData.measure) {
                    this.noteData.push({
                        measure: noteData.measure,
                        noteName: noteData.note.name + noteData.note.octave,
                        accuracy: noteData.accuracy || 0,
                        centsDeviation: noteData.note.centsDeviation || 0,
                        timestamp: noteData.timestamp,
                        matched: noteData.matched
                    });
                }
            }
        }
    }

    calculateMeasureScores(sessionData) {
        const measures = {};

        if (!sessionData || !sessionData.notes) return [];

        // Group notes by measure
        for (const noteData of sessionData.notes) {
            if (!noteData.measure) continue;

            if (!measures[noteData.measure]) {
                measures[noteData.measure] = { total: 0, count: 0 };
            }

            const accuracy = noteData.accuracy || 100;
            measures[noteData.measure].total += accuracy;
            measures[noteData.measure].count++;
        }

        // Calculate average per measure
        const result = [];
        for (const [measure, data] of Object.entries(measures)) {
            result.push({
                measure: parseInt(measure),
                score: data.count > 0 ? data.total / data.count : 100
            });
        }

        return result.sort((a, b) => a.measure - b.measure);
    }

    render() {
        if (!this.ctx || !this.canvas) return;

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Reset bar rectangles for click detection
        this.barRects = [];

        if (this.measureData.length === 0) {
            // Show placeholder
            ctx.fillStyle = '#6a6a7a';
            ctx.font = '16px Source Sans 3';
            ctx.textAlign = 'center';
            ctx.fillText('Practice to see your heat map', width / 2, height / 2);
            return;
        }

        // Draw heat map bars
        const barWidth = (width - 40) / Math.max(this.measureData.length, 1);
        const maxBarHeight = height - 40;
        const startX = 20;

        this.measureData.forEach((data, index) => {
            const x = startX + index * barWidth;
            const barHeight = (data.score / 100) * maxBarHeight;
            const y = height - 20 - barHeight;

            // Store bar rectangle for click detection
            this.barRects.push({
                measure: data.measure,
                score: data.score,
                x: x,
                y: y,
                width: barWidth - 4,
                height: barHeight
            });

            // Get color based on score
            ctx.fillStyle = this.getColorForScore(data.score);

            // Draw bar with rounded top
            this.drawRoundedBar(ctx, x, y, barWidth - 4, barHeight, 4);

            // Draw measure number
            ctx.fillStyle = '#a0a0b0';
            ctx.font = '10px Source Sans 3';
            ctx.textAlign = 'center';
            ctx.fillText(data.measure, x + barWidth / 2, height - 5);

            // Draw score above bar
            ctx.fillStyle = '#f5f5dc';
            ctx.fillText(Math.round(data.score) + '%', x + barWidth / 2, y - 5);
        });
    }

    drawRoundedBar(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x, y + height);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    }

    getColorForScore(score) {
        // Color gradient: green (good) -> yellow (needs work) -> red (struggling)
        if (score >= 90) return '#2d5a4a'; // Good - emerald
        if (score >= 75) return '#4a5a3d'; // Okay - olive
        if (score >= 60) return '#c9a227'; // Needs work - amber
        if (score >= 40) return '#8b3d2b'; // Struggling - dark orange
        return '#8b2942'; // Critical - crimson
    }

    clear() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.measureData = [];
    }

    // Get summary for modal display
    getSummary() {
        if (this.measureData.length === 0) return null;

        const scores = this.measureData.map(m => m.score);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

        // Find measures needing most practice (lowest scores)
        const problemMeasures = [...this.measureData]
            .sort((a, b) => a.score - b.score)
            .slice(0, 3);

        return {
            averageScore: Math.round(avg),
            totalMeasures: this.measureData.length,
            problemMeasures: problemMeasures.map(m => m.measure)
        };
    }
}

window.HeatMapRenderer = HeatMapRenderer;