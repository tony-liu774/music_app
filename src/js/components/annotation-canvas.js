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
        this.currentColor = color;
    }

    setLineWidth(width) {
        this.currentLineWidth = width;
    }

    setFingering(digit) {
        if (['1', '2', '3', '4'].includes(digit)) {
            this.currentFingering = digit;
        }
    }

    onPointerDown(e) {
        if (this.currentTool === 'eraser') {
            this.eraseAt(e.offsetX, e.offsetY);
            return;
        }

        this.isDrawing = true;
        this.currentStroke = [{ x: e.offsetX, y: e.offsetY, pressure: e.pressure || 1 }];
    }

    onPointerMove(e) {
        if (!this.isDrawing) return;

        if (this.currentTool === 'eraser') {
            this.eraseAt(e.offsetX, e.offsetY);
            return;
        }

        // Add point to current stroke
        this.currentStroke.push({ x: e.offsetX, y: e.offsetY, pressure: e.pressure || 1 });

        // Draw live
        this.drawStroke(this.currentStroke);
    }

    onPointerUp(e) {
        if (!this.isDrawing) return;

        this.isDrawing = false;

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
        const t = tool || this.currentTool;
        const ctx = this.ctx;

        ctx.fillStyle = this.currentColor;
        ctx.strokeStyle = this.currentColor;
        ctx.lineWidth = this.currentLineWidth;

        if (t === 'upbow') {
            // Draw up-bow symbol (∩)
            ctx.beginPath();
            ctx.arc(x, y, 8, Math.PI, 0, false);
            ctx.stroke();
        } else if (t === 'downbow') {
            // Draw down-bow symbol (□)
            ctx.strokeRect(x - 6, y - 6, 12, 12);
        } else if (t === 'fingering') {
            // Draw fingering number in circle
            const digit = value || this.currentFingering;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fill();

            ctx.fillStyle = '#0a0a12'; // Text color (opposite of neon)
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(digit, x, y);
        }

        // Create annotation for symbol
        const annotation = {
            id: Date.now() + Math.random().toString().slice(2),
            type: 'symbol',
            tool: t,
            color: this.currentColor,
            x: x / this.canvas.width,
            y: y / this.canvas.height,
            value: value || this.currentFingering,
            timestamp: Date.now(),
            layerId: 'my'
        };

        this.addAnnotation(annotation);
    }

    eraseAt(x, y, radius = 15) {
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

        this.saveHistory();
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
        this.annotations = JSON.parse(JSON.stringify(annotations));
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
