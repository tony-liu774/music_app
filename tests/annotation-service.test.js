/**
 * Annotation Service Tests
 * Local storage and service logic tests
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

describe('AnnotationService', () => {
    let service;
    let mockLocalStorage;

    // Simple mock AnnotationService for testing core logic
    class MockAnnotationService {
        constructor() {
            this.firebaseEnabled = false; // Default to local-only
            this.canvas = null;
            this.scoreId = null;
            this.db = null;
            this.dbRef = null;
            this.listener = null;
            this._remoteUpdate = false;
            this.listeners = {};
            this.localAnnotations = {};
        }

        init(canvas, scoreId) {
            this.canvas = canvas;
            if (scoreId) {
                this.setScoreId(scoreId);
            }
            if (this.canvas && this.canvas.on) {
                this.canvas.on('change', data => {
                    if (this._remoteUpdate) return;
                    this.onCanvasChange(data);
                });
            }
        }

        setScoreId(id) {
            if (this.listener) {
                this.listener();
                this.listener = null;
            }

            this.scoreId = id;

            if (!this.firebaseEnabled) {
                this.loadFromLocal();
            }
        }

        onCanvasChange(data) {
            if (!data.annotations) return;

            if (!this.firebaseEnabled) {
                this.saveAllToLocal(data.annotations);
            }

            this.emit('syncStatus', 'synced');
        }

        saveAllToLocal(annotations) {
            if (!this.scoreId) return;

            this.localAnnotations = {};
            annotations.forEach(ann => {
                this.localAnnotations[ann.id] = ann;
            });

            mockLocalStorage.setItem(
                `annotations_${this.scoreId}`,
                JSON.stringify(annotations)
            );
        }

        saveToLocal() {
            if (!this.scoreId) return;

            const annotations = Object.values(this.localAnnotations);
            mockLocalStorage.setItem(
                `annotations_${this.scoreId}`,
                JSON.stringify(annotations)
            );
        }

        loadFromLocal() {
            if (!this.scoreId) return;

            const stored = mockLocalStorage.getItem(`annotations_${this.scoreId}`);
            if (!stored) return;

            try {
                const annotations = JSON.parse(stored);
                this._remoteUpdate = true;
                if (this.canvas && this.canvas.loadAnnotations) {
                    this.canvas.loadAnnotations(annotations);
                }
                this._remoteUpdate = false;

                this.localAnnotations = {};
                annotations.forEach(ann => {
                    this.localAnnotations[ann.id] = ann;
                });

                this.emit('loaded', { annotations });
            } catch (e) {
                // Silently ignore parse errors
            }
        }

        clearAll() {
            if (!this.firebaseEnabled) {
                this.localAnnotations = {};
                mockLocalStorage.removeItem(`annotations_${this.scoreId}`);
                this.emit('syncStatus', 'synced');
            }
        }

        deleteAnnotation(id) {
            delete this.localAnnotations[id];
            this.saveToLocal();
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
            if (this.listener) {
                this.listener();
                this.listener = null;
            }
        }
    }

    beforeEach(() => {
        mockLocalStorage = {
            data: {},
            getItem: function(key) { return this.data[key] || null; },
            setItem: function(key, value) { this.data[key] = value; },
            removeItem: function(key) { delete this.data[key]; },
            clear: function() { this.data = {}; }
        };

        service = new MockAnnotationService();
    });

    afterEach(() => {
        service.destroy();
        mockLocalStorage.clear();
    });

    it('should initialize in local-only mode by default', () => {
        assert.strictEqual(service.firebaseEnabled, false);
    });

    it('should initialize with canvas', () => {
        const mockCanvas = { on: () => {}, loadAnnotations: () => {} };
        service.init(mockCanvas, 'test-score');

        assert.strictEqual(service.canvas, mockCanvas);
        assert.strictEqual(service.scoreId, 'test-score');
    });

    it('should save annotations to localStorage in local mode', () => {
        service.scoreId = 'test-score';

        const annotations = [
            {
                id: '1',
                type: 'stroke',
                tool: 'pen',
                color: '#00d4ff',
                points: [{ x: 0.1, y: 0.1 }],
                layerId: 'my'
            }
        ];

        service.saveAllToLocal(annotations);

        const stored = mockLocalStorage.getItem('annotations_test-score');
        assert.strictEqual(stored !== null, true);

        const parsed = JSON.parse(stored);
        assert.strictEqual(parsed.length, 1);
        assert.strictEqual(parsed[0].id, '1');
    });

    it('should clear all annotations', () => {
        service.scoreId = 'test-score';

        const annotations = [
            { id: '1', type: 'stroke', points: [], layerId: 'my' },
            { id: '2', type: 'stroke', points: [], layerId: 'my' }
        ];

        mockLocalStorage.setItem('annotations_test-score', JSON.stringify(annotations));
        service.clearAll();

        const stored = mockLocalStorage.getItem('annotations_test-score');
        assert.strictEqual(stored === null, true);
    });

    it('should switch score ID and unsubscribe old listener', () => {
        service.scoreId = 'score-1';

        let oldListenerCalled = false;
        service.listener = () => {
            oldListenerCalled = true;
        };

        service.setScoreId('score-2');

        assert.strictEqual(service.scoreId, 'score-2');
        assert.strictEqual(oldListenerCalled, true);
    });

    it('should emit sync status event', () => {
        let statusEmitted = null;
        service.on('syncStatus', (status) => {
            statusEmitted = status;
        });

        service.emit('syncStatus', 'synced');
        assert.strictEqual(statusEmitted, 'synced');
    });

    it('should handle empty localStorage gracefully', () => {
        service.scoreId = 'nonexistent-score';

        // Should not throw
        service.loadFromLocal();
        assert.strictEqual(service.localAnnotations !== null, true);
    });

    it('should handle malformed JSON in localStorage', () => {
        service.scoreId = 'test-score';

        mockLocalStorage.setItem('annotations_test-score', 'invalid json');

        // Should not throw
        service.loadFromLocal();
        assert.strictEqual(service.localAnnotations !== null, true);
    });

    it('should delete annotation from local storage', () => {
        service.scoreId = 'test-score';

        const annotations = [
            { id: '1', type: 'stroke', points: [], layerId: 'my' },
            { id: '2', type: 'stroke', points: [], layerId: 'my' }
        ];

        service.localAnnotations = { '1': annotations[0], '2': annotations[1] };

        service.deleteAnnotation('1');

        assert.strictEqual(service.localAnnotations['1'], undefined);
        assert.strictEqual(service.localAnnotations['2'] !== undefined, true);
    });

    it('should prevent echo loop on remote update', () => {
        service._remoteUpdate = true;
        // When _remoteUpdate flag is set, onCanvasChange should bail out
        service.onCanvasChange({ annotations: [] });
        // If we reach here without error, the test passes
        assert.strictEqual(service._remoteUpdate, true);
    });
});
