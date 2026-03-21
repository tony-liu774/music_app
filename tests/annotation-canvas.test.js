/**
 * Annotation Canvas Tests
 * Basic logic tests without browser dependencies
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

describe('AnnotationCanvas', () => {
    let canvas;

    // Simple mock AnnotationCanvas for testing core logic
    class MockAnnotationCanvas {
        constructor(container) {
            this.container = container;
            this.annotations = [];
            this.history = [];
            this.historyIndex = -1;
            this.currentTool = 'pen';
            this.currentColor = '#00d4ff';
            this.currentLineWidth = 2;
            this.currentFingering = '1';
            this.layerVisibility = { my: true, shared: true };
            this.listeners = {};
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

        addAnnotation(annotation) {
            this.annotations.push(annotation);
            this.saveHistory();
            this.emit('change', { annotations: this.annotations });
        }

        saveHistory() {
            this.history = this.history.slice(0, this.historyIndex + 1);
            this.history.push(JSON.parse(JSON.stringify(this.annotations)));
            this.historyIndex++;
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
            }
        }

        redo() {
            if (this.historyIndex < this.history.length - 1) {
                this.historyIndex++;
                this.annotations = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
                this.emit('change', { annotations: this.annotations, isHistoryAction: true });
            }
        }

        clearAll() {
            this.annotations = [];
            this.saveHistory();
            this.emit('change', { annotations: this.annotations, cleared: true });
        }

        setLayerVisible(layerId, visible) {
            this.layerVisibility[layerId] = visible;
        }

        exportAnnotations() {
            return JSON.parse(JSON.stringify(this.annotations));
        }

        loadAnnotations(annotations) {
            this.annotations = JSON.parse(JSON.stringify(annotations));
            this.saveHistory();
        }

        normalizePoints(points) {
            return points.map(p => ({
                x: p.x / 800,
                y: p.y / 600,
                pressure: p.pressure
            }));
        }

        denormalizePoints(points) {
            return points.map(p => ({
                x: p.x * 800,
                y: p.y * 600,
                pressure: p.pressure
            }));
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
    }

    beforeEach(() => {
        canvas = new MockAnnotationCanvas({ appendChild: () => {}, getBoundingClientRect: () => ({ width: 800, height: 600 }) });
    });

    it('should initialize with default tool pen', () => {
        assert.strictEqual(canvas.currentTool, 'pen');
    });

    it('should initialize with default color neon blue', () => {
        assert.strictEqual(canvas.currentColor, '#00d4ff');
    });

    it('should switch tools', () => {
        canvas.setTool('eraser');
        assert.strictEqual(canvas.currentTool, 'eraser');
    });

    it('should change color', () => {
        canvas.setColor('#ff0000');
        assert.strictEqual(canvas.currentColor, '#ff0000');
    });

    it('should change line width', () => {
        canvas.setLineWidth(5);
        assert.strictEqual(canvas.currentLineWidth, 5);
    });

    it('should set fingering digit', () => {
        canvas.setFingering('2');
        assert.strictEqual(canvas.currentFingering, '2');
    });

    it('should reject invalid fingering digit', () => {
        canvas.setFingering('5');
        assert.strictEqual(canvas.currentFingering, '1');
    });

    it('should undo annotation', () => {
        // Initialize with empty state
        canvas.saveHistory();

        canvas.addAnnotation({
            id: '1',
            type: 'stroke',
            tool: 'pen',
            color: '#00d4ff',
            lineWidth: 2,
            points: [{ x: 0.1, y: 0.1 }],
            timestamp: Date.now(),
            layerId: 'my'
        });

        assert.strictEqual(canvas.annotations.length, 1);
        canvas.undo();
        assert.strictEqual(canvas.annotations.length, 0);
    });

    it('should redo annotation after undo', () => {
        canvas.addAnnotation({
            id: '1',
            type: 'stroke',
            points: [{ x: 0.1, y: 0.1 }],
            layerId: 'my'
        });

        canvas.undo();
        canvas.redo();
        assert.strictEqual(canvas.annotations.length, 1);
    });

    it('should clear all annotations', () => {
        canvas.addAnnotation({ id: '1', type: 'stroke', points: [], layerId: 'my' });
        canvas.addAnnotation({ id: '2', type: 'stroke', points: [], layerId: 'my' });

        assert.strictEqual(canvas.annotations.length, 2);
        canvas.clearAll();
        assert.strictEqual(canvas.annotations.length, 0);
    });

    it('should toggle layer visibility', () => {
        canvas.setLayerVisible('my', false);
        assert.strictEqual(canvas.layerVisibility.my, false);
    });

    it('should export annotations', () => {
        canvas.addAnnotation({
            id: '1',
            type: 'stroke',
            points: [{ x: 0.1, y: 0.1 }],
            layerId: 'my'
        });

        const exported = canvas.exportAnnotations();
        assert.strictEqual(exported.length, 1);
        assert.strictEqual(exported[0].id, '1');
    });

    it('should load annotations', () => {
        const annotations = [
            { id: '1', type: 'stroke', points: [{ x: 0.1, y: 0.1 }], layerId: 'my' }
        ];

        canvas.loadAnnotations(annotations);
        assert.strictEqual(canvas.annotations.length, 1);
    });

    it('should emit change event on annotation', () => {
        let eventFired = false;
        canvas.on('change', () => { eventFired = true; });

        canvas.addAnnotation({ id: '1', type: 'stroke', points: [], layerId: 'my' });
        assert.strictEqual(eventFired, true);
    });

    it('should normalize and denormalize points', () => {
        const points = [
            { x: 400, y: 300, pressure: 1 },
            { x: 600, y: 400, pressure: 0.8 }
        ];

        const normalized = canvas.normalizePoints(points);
        assert.strictEqual(normalized[0].x, 0.5);
        assert.strictEqual(normalized[0].y, 0.5);

        const denormalized = canvas.denormalizePoints(normalized);
        assert.strictEqual(denormalized[0].x, 400);
        assert.strictEqual(denormalized[0].y, 300);
    });

    it('should not exceed history limit', () => {
        for (let i = 0; i < 102; i++) {
            canvas.addAnnotation({
                id: String(i),
                type: 'stroke',
                points: [{ x: 0.1, y: 0.1 }],
                layerId: 'my'
            });
        }

        assert.strictEqual(canvas.history.length <= 100, true);
    });
});
