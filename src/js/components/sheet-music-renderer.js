/**
 * Sheet Music Renderer - Visual rendering of music notation
 * Displays notes from the parsed score
 * Optimized for 60fps rendering
 */

class SheetMusicRenderer {
    constructor(container) {
        this.container = container;
        this.canvas = null;
        this.ctx = null;
        this.score = null;
        this.cursorPosition = null;
        this.noteWidth = 30;
        this.staffY = 80;
        this.lineSpacing = 10;

        // Performance optimization
        this.isDirty = true;
        this.animationFrameId = null;
        this.lastRenderTime = 0;
        this.renderInterval = 1000 / 60; // 60fps target
    }

    init() {
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'sheet-music-canvas';
        this.container?.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.resize();

        window.addEventListener('resize', () => this.resize());
    }

    setScore(score) {
        this.score = score;
        this.markDirty();
    }

    resize() {
        if (!this.canvas || !this.container) return;

        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.markDirty();
    }

    markDirty() {
        this.isDirty = true;
        this.scheduleRender();
    }

    scheduleRender() {
        if (this.animationFrameId) return;

        const now = performance.now();
        const timeSinceLastRender = now - this.lastRenderTime;

        if (timeSinceLastRender >= this.renderInterval) {
            this.render();
        } else {
            this.animationFrameId = requestAnimationFrame(() => {
                this.animationFrameId = null;
                this.render();
            });
        }
    }

    render() {
        if (!this.ctx || !this.canvas) return;
        if (!this.isDirty) return;

        this.lastRenderTime = performance.now();

        // Clear canvas with background color
        this.ctx.fillStyle = '#141420';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.score) {
            this.renderPlaceholder();
            this.isDirty = false;
            return;
        }

        // Draw staff lines
        this.drawStaffLines();

        // Draw clef
        this.drawClef();

        // Draw notes
        this.drawNotes();

        // Draw cursor highlight if active
        if (this.cursorPosition !== null) {
            this.drawCursorHighlight();
        }

        // Draw measure numbers
        this.drawMeasureNumbers();

        this.isDirty = false;
    }

    renderPlaceholder() {
        const ctx = this.ctx;
        ctx.fillStyle = '#6a6a7a';
        ctx.font = '18px Source Sans 3';
        ctx.textAlign = 'center';
        ctx.fillText('Select a piece from your library to view notation', this.canvas.width / 2, this.canvas.height / 2);
    }

    drawStaffLines() {
        const ctx = this.ctx;
        const startX = 60;
        const endX = this.canvas.width - 20;

        ctx.strokeStyle = '#3a3a4a';
        ctx.lineWidth = 1;

        for (let i = 0; i < 5; i++) {
            const y = this.staffY + i * this.lineSpacing;
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }

        // Draw bar lines
        ctx.strokeStyle = '#3a3a4a';
        const measures = this.score.parts[0]?.measures.length || 4;
        const measureWidth = (endX - startX - 40) / Math.min(measures, 8);

        for (let i = 0; i <= measures; i++) {
            const x = startX + 40 + i * measureWidth;
            ctx.beginPath();
            ctx.moveTo(x, this.staffY);
            ctx.lineTo(x, this.staffY + 4 * this.lineSpacing);
            ctx.stroke();
        }
    }

    drawClef() {
        const ctx = this.ctx;
        // Treble clef symbol
        ctx.fillStyle = '#f5f5dc';
        ctx.font = '60px serif';
        ctx.fillText('𝄞', 20, this.staffY + 35);
    }

    drawNotes() {
        if (!this.score || !this.score.parts.length) return;

        const ctx = this.ctx;
        const startX = 100;
        const measures = this.score.parts[0].measures || [];
        const measureWidth = (this.canvas.width - 140) / Math.min(measures.length, 8);

        measures.forEach((measure, measureIndex) => {
            if (measureIndex >= 8) return; // Limit to 8 measures visible

            const measureX = startX + measureIndex * measureWidth;

            measure.notes.forEach((note, noteIndex) => {
                const noteX = measureX + 20 + noteIndex * this.noteWidth;
                const noteY = this.getNoteY(note);

                // Draw note head
                ctx.fillStyle = noteY >= this.staffY && noteY <= this.staffY + 40 ? '#c9a227' : '#a0a0b0';
                this.drawNoteHead(ctx, noteX, noteY, note);

                // Draw ledger lines if needed
                this.drawLedgerLines(ctx, noteX, noteY);

                // Draw stem
                ctx.strokeStyle = '#a0a0b0';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(noteX + 8, noteY);
                ctx.lineTo(noteX + 8, noteY - 25);
                ctx.stroke();

                // Draw accidental if needed
                if (note.pitch.alter === 1) {
                    ctx.fillStyle = '#c9a227';
                    ctx.font = '16px serif';
                    ctx.fillText('♯', noteX - 12, noteY + 5);
                } else if (note.pitch.alter === -1) {
                    ctx.fillStyle = '#c9a227';
                    ctx.font = '16px serif';
                    ctx.fillText('♭', noteX - 12, noteY + 5);
                }
            });
        });
    }

    drawNoteHead(ctx, x, y, note) {
        ctx.beginPath();
        // Draw elliptical note head
        ctx.ellipse(x, y, 8, 6, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Fill based on duration
        if (note.duration <= 0.5) {
            // Eighth note - filled
            ctx.fill();
        } else {
            // Quarter note - outlined only
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#141420';
            ctx.fill();
        }
    }

    drawLedgerLines(ctx, x, y) {
        ctx.strokeStyle = '#3a3a4a';
        ctx.lineWidth = 1;

        // Above staff
        if (y < this.staffY) {
            for (let ly = this.staffY - this.lineSpacing; ly >= y - this.lineSpacing; ly -= this.lineSpacing) {
                ctx.beginPath();
                ctx.moveTo(x - 12, ly);
                ctx.lineTo(x + 12, ly);
                ctx.stroke();
            }
        }

        // Below staff
        if (y > this.staffY + 40) {
            for (let ly = this.staffY + 40 + this.lineSpacing; ly <= y + this.lineSpacing; ly += this.lineSpacing) {
                ctx.beginPath();
                ctx.moveTo(x - 12, ly);
                ctx.lineTo(x + 12, ly);
                ctx.stroke();
            }
        }
    }

    getNoteY(note) {
        // Calculate Y position based on pitch
        const steps = { 'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6 };
        const stepValue = steps[note.pitch.step] || 0;
        const octaveOffset = (note.pitch.octave - 4) * 7;

        // Position relative to middle C (C4)
        const position = stepValue + octaveOffset;

        // Map to staff (C4 is on first ledger line below treble staff)
        // Middle line of treble staff is B4
        const middleLinePosition = 6; // B4 position
        const diff = position - middleLinePosition;

        return this.staffY + 20 - (diff * (this.lineSpacing / 2));
    }

    drawMeasureNumbers() {
        const ctx = this.ctx;
        const startX = 100;
        const measures = this.score.parts[0]?.measures.length || 0;
        const measureWidth = (this.canvas.width - 140) / Math.min(measures, 8);

        ctx.fillStyle = '#6a6a7a';
        ctx.font = '12px Source Sans 3';

        for (let i = 0; i < Math.min(measures, 8); i++) {
            const x = startX + i * measureWidth + 10;
            ctx.fillText((i + 1).toString(), x, this.staffY + 55);
        }
    }

    drawCursorHighlight() {
        if (!this.score || !this.score.parts.length) return;

        const ctx = this.ctx;
        const startX = 100;
        const measures = this.score.parts[0].measures || [];
        const measureWidth = (this.canvas.width - 140) / Math.min(measures.length, 8);

        // Find note at cursor position
        let foundX = null;
        let foundY = null;

        measures.forEach((measure, measureIndex) => {
            if (measureIndex >= 8) return;

            const measureX = startX + measureIndex * measureWidth;

            measure.notes.forEach((note, noteIndex) => {
                const noteX = measureX + 20 + noteIndex * this.noteWidth;
                const noteY = this.getNoteY(note);

                // Check if this note is at or before the cursor position
                if (measureIndex < this.cursorPosition ||
                    (measureIndex === this.cursorPosition && noteIndex === 0)) {
                    foundX = noteX;
                    foundY = noteY;
                }
            });
        });

        if (foundX !== null && foundY !== null) {
            // Draw highlight box around current note
            ctx.strokeStyle = 'rgba(201, 162, 39, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(foundX - 15, foundY - 15, 30, 30, 4);
            ctx.stroke();
        }
    }

    setCursorPosition(position) {
        this.cursorPosition = position;
        this.markDirty();
    }

    clear() {
        if (this.ctx && this.canvas) {
            this.ctx.fillStyle = '#141420';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    getCanvas() {
        return this.canvas;
    }

    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
}

window.SheetMusicRenderer = SheetMusicRenderer;