/**
 * Annotation Canvas - Overlay for sheet music annotations
 * Supports freehand drawing, bowings, fingerings, and layer management
 */

class AnnotationCanvas {
    constructor(container) {
        this.container = container;
        this.canvas = null;
        this.ctx = null;
        this.annotations = []; // Array of annotation objects
        this.history = [];
        this.historyIndex = -1;

        // Current tool state
        this.currentTool = 'pen';
        this.currentColor = '#00d4ff';
        this.currentLineWidth = 2;
        this.currentFingering = '1';

        // Drawing state
        this.isDrawing = false;
        this.currentStroke = [];
        this.layerVisibility = { my: true, shared: true };

        // Event system
        this.listeners = {};

        // Performance
        this.isDirty = true;
        this.animationFrameId = null;
        this.renderInterval = 1000 / 60; // 60fps
        this.lastRenderTime = 0;
    }

    init() {
        if (this.canvas) return;

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'annotation-canvas';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.zIndex = '10';
        this.canvas.style.touchAction = 'none';
        this.canvas.style.cursor = 'crosshair';

        this.container?.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d', { alpha: true });
        this.resize();

        // Event listeners
        this.canvas.addEventListener('pointerdown', e => this.onPointerDown(e));
        this.canvas.addEventListener('pointermove', e => this.onPointerMove(e));
        this.canvas.addEventListener('pointerup', e => this.onPointerUp(e));
        this.canvas.addEventListener('pointerleave', e => this.onPointerUp(e));

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas || !this.container) return;

        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        this.markDirty();
    }

    setTool(tool) {
        if (tool === this.currentTool) return;
        this.currentTool = tool;
    }

    setColor(color) {
        // Validate color - must be valid hex or rgb format
        if (typeof color === 'string' && /^(#[0-9a-fA-F]{6}|rgb\(\d+,\s*\d+,\s*\d+\))$/.test(color)) {
            this.currentColor = color;
        }
    }

    setLineWidth(width) {
        // Clamp line width to 1-20 pixels
        const w = parseInt(width);
        if (!isNaN(w) && w >= 1 && w <= 20) {
            this.currentLineWidth = w;
        }
    }

    setFingering(digit) {
        if (['1', '2', '3', '4'].includes(String(digit))) {
            this.currentFingering = String(digit);
        }
    }

    validateAnnotation(ann) {
        // Validate annotation object structure
        if (!ann || typeof ann !== 'object') return false;
        if (!['stroke', 'symbol'].includes(ann.type)) return false;
        if (typeof ann.id !== 'string' || !ann.id) return false;
        if (!Array.isArray(ann.points) && ann.type === 'stroke') return false;
        if (typeof ann.color !== 'string' || !ann.color) return false;
        if (typeof ann.layerId !== 'string') return false;
        return true;
    }

    clampCoordinates(x, y) {
        // Clamp coordinates to canvas bounds
        const clampedX = Math.max(0, Math.min(x, this.canvas?.width || 800));
        const clampedY = Math.max(0, Math.min(y, this.canvas?.height || 600));
        return { x: clampedX, y: clampedY };
    }

    onPointerDown(e) {
        const { x, y } = this.clampCoordinates(e.offsetX, e.offsetY);

        this.isDrawing = true;

        if (this.currentTool === 'eraser') {
            this.eraseAt(x, y);
            return;
        }

        this.currentStroke = [{ x, y, pressure: e.pressure || 1 }];
    }

    onPointerMove(e) {
        if (!this.isDrawing) return;

        const { x, y } = this.clampCoordinates(e.offsetX, e.offsetY);

        if (this.currentTool === 'eraser') {
            this.eraseAt(x, y);
            return;
        }

        // Add point to current stroke
        this.currentStroke.push({ x, y, pressure: e.pressure || 1 });

        // Draw live
        this.drawStroke(this.currentStroke);
    }

    onPointerUp(e) {
        if (!this.isDrawing) return;

        this.isDrawing = false;

        if (this.currentTool === 'eraser') {
            // Save eraser history on completion
            this.saveHistory();
            this.emit('change', { annotations: this.annotations });
            return;
        }

        if (this.currentStroke.length === 0) return;

        // Create annotation
        const annotation = {
            id: Date.now() + Math.random().toString().slice(2),
            type: 'stroke',
            tool: this.currentTool,
            color: this.currentColor,
            lineWidth: this.currentLineWidth,
            points: this.normalizePoints(this.currentStroke),
            timestamp: Date.now(),
            layerId: 'my'
        };

        this.addAnnotation(annotation);
    }

    normalizePoints(points) {
        // Convert canvas coords to 0-1 normalized coords
        return points.map(p => ({
            x: p.x / this.canvas.width,
            y: p.y / this.canvas.height,
            pressure: p.pressure
        }));
    }

    denormalizePoints(points) {
        // Convert normalized coords back to canvas coords
        return points.map(p => ({
            x: p.x * this.canvas.width,
            y: p.y * this.canvas.height,
            pressure: p.pressure
        }));
    }

    drawStroke(points, color = null, lineWidth = null) {
        if (points.length < 2) return;

        const ctx = this.ctx;
        ctx.strokeStyle = color || this.currentColor;
        ctx.lineWidth = lineWidth || this.currentLineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        ctx.stroke();
    }

    placeSymbol(x, y, tool = null, value = null) {
        // Clamp coordinates to canvas bounds
        const { x: clampedX, y: clampedY } = this.clampCoordinates(x, y);

        const t = tool || this.currentTool;
        const ctx = this.ctx;

        ctx.fillStyle = this.currentColor;
        ctx.strokeStyle = this.currentColor;
        ctx.lineWidth = this.currentLineWidth;

        if (t === 'upbow') {
            // Draw up-bow symbol (∩)
            ctx.beginPath();
            ctx.arc(clampedX, clampedY, 8, Math.PI, 0, false);
            ctx.stroke();
        } else if (t === 'downbow') {
            // Draw down-bow symbol (□)
            ctx.strokeRect(clampedX - 6, clampedY - 6, 12, 12);
        } else if (t === 'fingering') {
            // Draw fingering number in circle
            const digit = value || this.currentFingering;
            ctx.beginPath();
            ctx.arc(clampedX, clampedY, 8, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fill();

            ctx.fillStyle = '#0a0a12'; // Text color (opposite of neon)
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(digit, clampedX, clampedY);
        }

        // Create annotation for symbol
        const annotation = {
            id: Date.now() + Math.random().toString().slice(2),
            type: 'symbol',
            tool: t,
            color: this.currentColor,
            x: clampedX / this.canvas.width,
            y: clampedY / this.canvas.height,
            value: value || this.currentFingering,
            timestamp: Date.now(),
            layerId: 'my'
        };

        this.addAnnotation(annotation);
    }

    eraseAt(x, y, radius = 15, saveToHistory = false) {
        const ctx = this.ctx;
        ctx.clearRect(x - radius, y - radius, radius * 2, radius * 2);

        // Remove annotations near this point
        this.annotations = this.annotations.filter(ann => {
            if (ann.type === 'stroke') {
                return !ann.points.some(p => {
                    const px = p.x * this.canvas.width;
                    const py = p.y * this.canvas.height;
                    return Math.hypot(px - x, py - y) < radius;
                });
            } else if (ann.type === 'symbol') {
                const ax = ann.x * this.canvas.width;
                const ay = ann.y * this.canvas.height;
                return Math.hypot(ax - x, ay - y) >= radius;
            }
            return true;
        });

        // Only save history on completion (saveToHistory=true), not on every move
        if (saveToHistory) {
            this.saveHistory();
        }
        this.emit('change', { annotations: this.annotations });
        this.markDirty();
    }

    addAnnotation(annotation) {
        this.annotations.push(annotation);
        this.saveHistory();
        this.emit('change', { annotations: this.annotations });
        this.markDirty();
    }

    saveHistory() {
        // Trim redo stack
        this.history = this.history.slice(0, this.historyIndex + 1);

        // Save current state
        this.history.push(JSON.parse(JSON.stringify(this.annotations)));
        this.historyIndex++;

        // Limit history size
        if (this.history.length > 100) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.annotations = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.emit('change', { annotations: this.annotations, isHistoryAction: true });
            this.markDirty();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.annotations = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.emit('change', { annotations: this.annotations, isHistoryAction: true });
            this.markDirty();
        }
    }

    clearAll() {
        this.annotations = [];
        this.currentStroke = [];
        this.saveHistory();
        this.emit('change', { annotations: this.annotations, cleared: true });
        this.markDirty();
    }

    setLayerVisible(layerId, visible) {
        this.layerVisibility[layerId] = visible;
        this.markDirty();
    }

    exportAnnotations() {
        return JSON.parse(JSON.stringify(this.annotations));
    }

    loadAnnotations(annotations) {
        if (!Array.isArray(annotations)) {
            console.warn('loadAnnotations: Invalid annotations - not an array');
            return;
        }

        // Filter and validate all annotations
        const validAnnotations = annotations.filter(ann => {
            const isValid = this.validateAnnotation(ann);
            if (!isValid) {
                console.warn('loadAnnotations: Skipping invalid annotation', ann);
            }
            return isValid;
        });

        this.annotations = JSON.parse(JSON.stringify(validAnnotations));
        // Clear prior history to avoid confusing undo stack
        this.history = [];
        this.historyIndex = -1;
        this.saveHistory();
        this.markDirty();
    }

    markDirty() {
        this.isDirty = true;
        this.scheduleRender();
    }

    scheduleRender() {
        if (this.animationFrameId) return;

        this.animationFrameId = requestAnimationFrame(() => {
            const now = performance.now();
            if (now - this.lastRenderTime > this.renderInterval) {
                this.render();
                this.lastRenderTime = now;
                this.animationFrameId = null;
            } else {
                this.animationFrameId = requestAnimationFrame(() => {
                    this.render();
                    this.lastRenderTime = performance.now();
                    this.animationFrameId = null;
                });
            }
        });
    }

    render() {
        if (!this.isDirty || !this.ctx) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Render visible annotations
        for (const ann of this.annotations) {
            if (!this.layerVisibility[ann.layerId]) continue;

            if (ann.type === 'stroke') {
                const points = this.denormalizePoints(ann.points);
                this.drawStroke(points, ann.color, ann.lineWidth);
            } else if (ann.type === 'symbol') {
                const x = ann.x * this.canvas.width;
                const y = ann.y * this.canvas.height;
                this.placeSymbol(x, y, ann.tool, ann.value);
            }
        }

        this.isDirty = false;
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.canvas?.remove();
    }
}

window.AnnotationCanvas = AnnotationCanvas;
