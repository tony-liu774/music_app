/**
 * Sheet Music Renderer - Visual rendering of music notation
 * Displays notes from the parsed score
 */

class SheetMusicRenderer {
    constructor(container) {
        this.container = container;
        this.canvas = null;
        this.ctx = null;
        this.score = null;
        this.cursorPosition = null;
        this.cursorVisible = false;
        this.cursorGlowIntensity = 0;
        this.cursorX = 0;
        this.cursorY = 0;
        this.targetCursorX = 0;
        this.targetCursorY = 0;
        this.animationFrameId = null;
        this.noteWidth = 30;
        this.staffY = 80;
        this.lineSpacing = 10;
        this.isOnPitch = false;
    }

    init() {
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'sheet-music-canvas';
        this.container?.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
        this.resize();

        window.addEventListener('resize', () => this.resize());

        // Start animation loop for smooth cursor movement
        this.startAnimationLoop();
    }

    startAnimationLoop() {
        const animate = () => {
            if (this.cursorVisible) {
                // Smooth interpolation towards target position
                const smoothing = 0.15;
                this.cursorX += (this.targetCursorX - this.cursorX) * smoothing;
                this.cursorY += (this.targetCursorY - this.cursorY) * smoothing;

                // Pulse glow effect
                const time = Date.now() / 1000;
                this.cursorGlowIntensity = 0.5 + 0.5 * Math.sin(time * 3);
            }
            this.render();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        animate();
    }

    stopAnimationLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    setScore(score) {
        this.score = score;
        this.render();
    }

    resize() {
        if (!this.canvas || !this.container) return;

        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    render() {
        if (!this.ctx || !this.canvas) return;

        // Clear canvas
        this.ctx.fillStyle = '#141420';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.score) {
            this.renderPlaceholder();
            return;
        }

        // Draw staff lines
        this.drawStaffLines();

        // Draw clef
        this.drawClef();

        // Draw notes
        this.drawNotes();

        // Draw measure numbers
        this.drawMeasureNumbers();

        // Draw cursor (follow-the-ball) on top
        if (this.cursorVisible && this.cursorPosition) {
            this.drawCursor();
        }
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

    drawCursor() {
        const ctx = this.ctx;
        const x = this.cursorX;
        const y = this.cursorY;

        // Determine cursor color based on pitch accuracy
        const baseColor = this.isOnPitch ? '#2d5a4a' : '#8b2942'; // Emerald or Crimson
        const glowColor = this.isOnPitch ? 'rgba(45, 90, 74, ' : 'rgba(139, 41, 66, ';

        // Draw outer glow (atmospheric effect)
        const glowRadius = 25 + this.cursorGlowIntensity * 15;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
        gradient.addColorStop(0, glowColor + (0.4 * this.cursorGlowIntensity) + ')');
        gradient.addColorStop(0.5, glowColor + (0.2 * this.cursorGlowIntensity) + ')');
        gradient.addColorStop(1, glowColor + '0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw inner cursor ball
        ctx.fillStyle = baseColor;
        ctx.shadowColor = this.isOnPitch ? '#2d5a4a' : '#8b2942';
        ctx.shadowBlur = 15 + this.cursorGlowIntensity * 10;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();

        // Reset shadow
        ctx.shadowBlur = 0;

        // Draw highlight on ball
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(x - 3, y - 3, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    setCursorPosition(position, isOnPitch = false) {
        this.cursorPosition = position;
        this.isOnPitch = isOnPitch;

        if (position && this.score) {
            const coords = this.getNoteCoordinates(position.measureIndex, position.noteIndex);
            if (coords) {
                this.targetCursorX = coords.x;
                this.targetCursorY = coords.y;
            }
        }
    }

    setCursorVisible(visible) {
        this.cursorVisible = visible;
        if (!visible) {
            this.cursorPosition = null;
        }
    }

    getNoteCoordinates(measureIndex, noteIndex) {
        if (!this.score || !this.score.parts.length) return null;

        const startX = 100;
        const measures = this.score.parts[0].measures || [];
        if (measureIndex >= measures.length) return null;

        const measureWidth = (this.canvas.width - 140) / Math.min(measures.length, 8);
        const measureX = startX + measureIndex * measureWidth;

        const measure = measures[measureIndex];
        if (!measure || noteIndex >= measure.notes.length) return null;

        const note = measure.notes[noteIndex];
        const noteX = measureX + 20 + noteIndex * this.noteWidth;
        const noteY = this.getNoteY(note);

        return { x: noteX, y: noteY };
    }

    clear() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    destroy() {
        this.stopAnimationLoop();
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }

    getCanvas() {
        return this.canvas;
    }
}

window.SheetMusicRenderer = SheetMusicRenderer;