/**
 * Sheet Music Renderer - Visual rendering of music notation
 * Displays notes from the parsed score with zoom and pan support
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

        // Zoom and pan state
        this.zoom = 1;
        this.minZoom = 0.5;
        this.maxZoom = 2;
        this.zoomStep = 0.1;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.lastPanX = 0;
        this.lastPanY = 0;

        // Zoom controls
        this.zoomControls = null;
        this.zoomInBtn = null;
        this.zoomOutBtn = null;
        this.zoomLevelDisplay = null;
    }

    init() {
        // Create wrapper for zoom/pan
        this.canvasWrapper = document.createElement('div');
        this.canvasWrapper.className = 'sheet-music-canvas-wrapper';

        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'sheet-music-canvas';

        // Create zoom controls
        this.createZoomControls();

        // Append to container
        this.container?.appendChild(this.canvasWrapper);
        this.canvasWrapper.appendChild(this.canvas);
        this.canvasWrapper.appendChild(this.zoomControls);

        this.ctx = this.canvas.getContext('2d');
        this.resize();

        window.addEventListener('resize', () => this.resize());

        // Start animation loop for smooth cursor movement
        this.startAnimationLoop();

        // Setup zoom and pan event listeners
        this.setupZoomPanEvents();
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

    /**
     * Create zoom control buttons
     */
    createZoomControls() {
        this.zoomControls = document.createElement('div');
        this.zoomControls.className = 'zoom-controls';

        // Zoom out button
        this.zoomOutBtn = document.createElement('button');
        this.zoomOutBtn.className = 'zoom-btn zoom-out';
        this.zoomOutBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        this.zoomOutBtn.title = 'Zoom Out';
        this.zoomOutBtn.addEventListener('click', () => this.zoomOut());

        // Zoom level display
        this.zoomLevelDisplay = document.createElement('span');
        this.zoomLevelDisplay.className = 'zoom-level';
        this.zoomLevelDisplay.textContent = '100%';

        // Zoom in button
        this.zoomInBtn = document.createElement('button');
        this.zoomInBtn.className = 'zoom-btn zoom-in';
        this.zoomInBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        this.zoomInBtn.title = 'Zoom In';
        this.zoomInBtn.addEventListener('click', () => this.zoomIn());

        // Reset zoom button
        this.zoomResetBtn = document.createElement('button');
        this.zoomResetBtn.className = 'zoom-btn zoom-reset';
        this.zoomResetBtn.textContent = 'Reset';
        this.zoomResetBtn.title = 'Reset Zoom';
        this.zoomResetBtn.addEventListener('click', () => this.resetZoom());

        this.zoomControls.appendChild(this.zoomOutBtn);
        this.zoomControls.appendChild(this.zoomLevelDisplay);
        this.zoomControls.appendChild(this.zoomInBtn);
        this.zoomControls.appendChild(this.zoomResetBtn);
    }

    /**
     * Setup zoom and pan event handlers
     */
    setupZoomPanEvents() {
        // Mouse wheel zoom
        this.canvas.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -this.zoomStep : this.zoomStep;
                this.setZoom(this.zoom + delta);
            }
        }, { passive: false });

        // Pan with mouse drag (when zoomed)
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.zoom > 1) {
                this.isPanning = true;
                this.lastPanX = e.clientX;
                this.lastPanY = e.clientY;
                this.canvas.style.cursor = 'grabbing';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                const deltaX = e.clientX - this.lastPanX;
                const deltaY = e.clientY - this.lastPanY;
                this.panX += deltaX;
                this.panY += deltaY;
                this.lastPanX = e.clientX;
                this.lastPanY = e.clientY;
                this.applyTransform();
            }
        });

        document.addEventListener('mouseup', () => {
            this.isPanning = false;
            if (this.zoom > 1) {
                this.canvas.style.cursor = 'grab';
            } else {
                this.canvas.style.cursor = 'default';
            }
        });

        // Touch events for pinch-to-zoom
        let lastTouchDistance = 0;
        let lastTouchCenter = null;

        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
                lastTouchCenter = {
                    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                };
            } else if (e.touches.length === 1 && this.zoom > 1) {
                this.isPanning = true;
                this.lastPanX = e.touches[0].clientX;
                this.lastPanY = e.touches[0].clientY;
            }
        }, { passive: true });

        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                // Pinch zoom
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (lastTouchDistance > 0) {
                    const scale = distance / lastTouchDistance;
                    this.setZoom(this.zoom * scale);
                }

                lastTouchDistance = distance;
            } else if (e.touches.length === 1 && this.isPanning) {
                const deltaX = e.touches[0].clientX - this.lastPanX;
                const deltaY = e.touches[0].clientY - this.lastPanY;
                this.panX += deltaX;
                this.panY += deltaY;
                this.lastPanX = e.touches[0].clientX;
                this.lastPanY = e.touches[0].clientY;
                this.applyTransform();
            }
        }, { passive: true });

        this.canvas.addEventListener('touchend', () => {
            this.isPanning = false;
            lastTouchDistance = 0;
            lastTouchCenter = null;
        }, { passive: true });
    }

    /**
     * Apply zoom and pan transform
     */
    applyTransform() {
        if (this.canvasWrapper) {
            const transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
            this.canvas.style.transform = transform;
            this.canvas.style.transformOrigin = 'center center';
        }
    }

    /**
     * Zoom in
     */
    zoomIn() {
        this.setZoom(this.zoom + this.zoomStep);
    }

    /**
     * Zoom out
     */
    zoomOut() {
        this.setZoom(this.zoom - this.zoomStep);
    }

    /**
     * Set zoom level
     */
    setZoom(level) {
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, level));
        const zoomChanged = newZoom !== this.zoom;

        this.zoom = newZoom;

        // Update display
        if (this.zoomLevelDisplay) {
            this.zoomLevelDisplay.textContent = Math.round(this.zoom * 100) + '%';
        }

        // Update button states
        if (this.zoomOutBtn) {
            this.zoomOutBtn.disabled = this.zoom <= this.minZoom;
        }
        if (this.zoomInBtn) {
            this.zoomInBtn.disabled = this.zoom >= this.maxZoom;
        }

        // Apply transform
        this.applyTransform();

        // Reset pan when zoom changes (unless at max zoom)
        if (zoomChanged && this.zoom <= 1) {
            this.resetPan();
        } else if (zoomChanged) {
            // Center the content when zooming
            this.centerContent();
        }
    }

    /**
     * Reset zoom to 100%
     */
    resetZoom() {
        this.setZoom(1);
        this.resetPan();
    }

    /**
     * Reset pan offset
     */
    resetPan() {
        this.panX = 0;
        this.panY = 0;
        this.applyTransform();
    }

    /**
     * Center content in container
     */
    centerContent() {
        if (this.zoom > 1 && this.container) {
            const containerRect = this.container.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();

            // Calculate offset to center
            this.panX = (containerRect.width - canvasRect.width * this.zoom) / 2;
            this.panY = (containerRect.height - canvasRect.height * this.zoom) / 2;

            this.applyTransform();
        }
    }

    /**
     * Get current zoom level
     */
    getZoom() {
        return this.zoom;
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