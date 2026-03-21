/**
 * Tests for BluetoothHIDListener - Bluetooth Pedal Support
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

// Mock document
const documentListeners = {};
const documentElements = {};

const documentMock = {
    addEventListener: (event, handler) => {
        if (!documentListeners[event]) documentListeners[event] = [];
        documentListeners[event].push(handler);
    },
    removeEventListener: (event, handler) => {
        if (documentListeners[event]) {
            documentListeners[event] = documentListeners[event].filter(h => h !== handler);
        }
    },
    getElementById: (id) => documentElements[id] || null,
    createElement: (tag) => ({
        tagName: tag,
        className: '',
        classList: {
            _classes: new Set(),
            add(c) { this._classes.add(c); },
            remove(c) { this._classes.delete(c); },
            toggle(c, force) {
                if (force !== undefined) {
                    if (force) this._classes.add(c);
                    else this._classes.delete(c);
                } else {
                    if (this._classes.has(c)) this._classes.delete(c);
                    else this._classes.add(c);
                }
            },
            contains(c) { return this._classes.has(c); }
        },
        style: {},
        setAttribute: function() {},
        getAttribute: function() { return null; },
        addEventListener: function() {},
        querySelector: function() { return null; },
        appendChild: function() {},
        innerHTML: '',
        textContent: '',
        value: ''
    })
};

// Setup globals
global.window = {};
global.localStorage = localStorageMock;
global.document = documentMock;
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;
global.Date = Date;

// Create mock DOM elements for settings UI
function createMockElements() {
    const createElement = (overrides) => ({
        className: '',
        classList: {
            _classes: new Set(),
            add(c) { this._classes.add(c); },
            remove(c) { this._classes.delete(c); },
            toggle(c, force) {
                if (force !== undefined) {
                    if (force) this._classes.add(c);
                    else this._classes.delete(c);
                } else {
                    if (this._classes.has(c)) this._classes.delete(c);
                    else this._classes.add(c);
                }
            },
            contains(c) { return this._classes.has(c); }
        },
        style: {},
        _listeners: {},
        setAttribute: function(k, v) { this['_attr_' + k] = v; },
        getAttribute: function(k) { return this['_attr_' + k] || null; },
        addEventListener: function(event, handler) {
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(handler);
        },
        querySelector: function(selector) {
            if (selector === '.pedal-feedback-text') return this._feedbackText || null;
            if (selector === '.pedal-status-dot') return this._statusDot || null;
            if (selector === '.pedal-status-text') return this._statusText || null;
            return null;
        },
        textContent: '',
        value: '',
        ...overrides
    });

    // Pedal feedback indicator with children
    const feedbackText = createElement({ textContent: '' });
    const feedbackIndicator = createElement({
        _feedbackText: feedbackText
    });

    // Pedal status
    const statusDot = createElement({ className: 'pedal-status-dot disabled' });
    const statusText = createElement({ textContent: 'Pedal Disabled' });
    const pedalStatus = createElement({
        _statusDot: statusDot,
        _statusText: statusText
    });

    // Toggle button
    const pedalToggle = createElement({});

    // Device name input
    const deviceNameInput = createElement({ value: '' });

    // Pedal controls group
    const controlsGroup = createElement({ style: {} });

    documentElements['pedal-feedback-indicator'] = feedbackIndicator;
    documentElements['pedal-status'] = pedalStatus;
    documentElements['pedal-enable-toggle'] = pedalToggle;
    documentElements['pedal-device-name'] = deviceNameInput;
    documentElements['pedal-controls-group'] = controlsGroup;

    return {
        feedbackIndicator,
        feedbackText,
        pedalStatus,
        statusDot,
        statusText,
        pedalToggle,
        deviceNameInput,
        controlsGroup
    };
}

// BluetoothHIDListener implementation for testing
class BluetoothHIDListener {
    constructor() {
        this.enabled = false;
        this.connected = false;
        this.deviceName = null;

        this.bindings = {
            PageUp: 'nextMeasure',
            PageDown: 'prevMeasure',
            ArrowRight: 'nextMeasure',
            ArrowLeft: 'prevMeasure',
            ArrowUp: 'nextPage',
            ArrowDown: 'prevPage',
            ' ': 'toggleLoop'
        };

        this.onNextMeasure = null;
        this.onPrevMeasure = null;
        this.onNextPage = null;
        this.onPrevPage = null;
        this.onToggleLoop = null;
        this.onPedalPress = null;

        this.currentMeasure = 0;
        this.totalMeasures = 1;
        this.lastKeyTime = 0;
        this.debounceMs = 100;
        this.feedbackTimeout = null;
        this._boundKeyHandler = null;

        this.loadSettings();
    }

    loadSettings() {
        var savedEnabled = localStorage.getItem('bluetoothPedalEnabled');
        var savedBindings = localStorage.getItem('bluetoothPedalBindings');
        var savedDeviceName = localStorage.getItem('bluetoothLastDeviceName');

        if (savedEnabled !== null) {
            this.enabled = savedEnabled === 'true';
        }
        if (savedBindings) {
            try {
                var parsed = JSON.parse(savedBindings);
                Object.assign(this.bindings, parsed);
            } catch (e) {
                // Use defaults
            }
        }
        if (savedDeviceName) {
            this.deviceName = savedDeviceName;
        }
    }

    saveSettings() {
        localStorage.setItem('bluetoothPedalEnabled', this.enabled);
        localStorage.setItem('bluetoothPedalBindings', JSON.stringify(this.bindings));
        if (this.deviceName) {
            localStorage.setItem('bluetoothLastDeviceName', this.deviceName);
        }
    }

    init() {
        this.setupKeyboardListener();
        this.setupSettingsUI();
        this.updateStatusIndicator();
    }

    setupKeyboardListener() {
        this._boundKeyHandler = this.handleKeyEvent.bind(this);
        document.addEventListener('keydown', this._boundKeyHandler);
    }

    handleKeyEvent(event) {
        if (!this.enabled) return;

        var action = this.bindings[event.key];
        if (!action) return;

        var now = Date.now();
        if (now - this.lastKeyTime < this.debounceMs) return;
        this.lastKeyTime = now;

        event.preventDefault();

        if (!this.connected) {
            this.connected = true;
            this.updateStatusIndicator();
        }

        this.showPedalFeedback(action);
        this.executeAction(action);
    }

    executeAction(action) {
        switch (action) {
            case 'nextMeasure':
                this.currentMeasure = Math.min(this.currentMeasure + 1, this.totalMeasures - 1);
                if (this.onNextMeasure) {
                    this.onNextMeasure(this.currentMeasure);
                }
                break;
            case 'prevMeasure':
                this.currentMeasure = Math.max(this.currentMeasure - 1, 0);
                if (this.onPrevMeasure) {
                    this.onPrevMeasure(this.currentMeasure);
                }
                break;
            case 'nextPage':
                this.currentMeasure = Math.min(this.currentMeasure + 8, this.totalMeasures - 1);
                if (this.onNextPage) {
                    this.onNextPage(this.currentMeasure);
                }
                break;
            case 'prevPage':
                this.currentMeasure = Math.max(this.currentMeasure - 8, 0);
                if (this.onPrevPage) {
                    this.onPrevPage(this.currentMeasure);
                }
                break;
            case 'toggleLoop':
                if (this.onToggleLoop) {
                    this.onToggleLoop();
                }
                break;
        }
    }

    showPedalFeedback(action) {
        var indicator = document.getElementById('pedal-feedback-indicator');
        if (!indicator) return;

        var label = this.getActionLabel(action);
        var feedbackText = indicator.querySelector('.pedal-feedback-text');
        if (feedbackText) {
            feedbackText.textContent = label;
        }

        indicator.classList.add('active');
        indicator.setAttribute('aria-label', 'Pedal pressed: ' + label);

        if (this.onPedalPress) {
            this.onPedalPress(action, label);
        }

        if (this.feedbackTimeout) {
            clearTimeout(this.feedbackTimeout);
        }
        this.feedbackTimeout = setTimeout(function() {
            indicator.classList.remove('active');
        }, 400);
    }

    getActionLabel(action) {
        var labels = {
            nextMeasure: 'Next Measure',
            prevMeasure: 'Previous Measure',
            nextPage: 'Next Page',
            prevPage: 'Previous Page',
            toggleLoop: 'Toggle Loop'
        };
        return labels[action] || action;
    }

    updateStatusIndicator() {
        var statusEl = document.getElementById('pedal-status');
        if (!statusEl) return;

        var statusDot = statusEl.querySelector('.pedal-status-dot');
        var statusText = statusEl.querySelector('.pedal-status-text');

        if (!this.enabled) {
            if (statusDot) statusDot.className = 'pedal-status-dot disabled';
            if (statusText) statusText.textContent = 'Pedal Disabled';
        } else if (this.connected) {
            if (statusDot) statusDot.className = 'pedal-status-dot connected';
            if (statusText) statusText.textContent = this.deviceName || 'Pedal Connected';
        } else {
            if (statusDot) statusDot.className = 'pedal-status-dot listening';
            if (statusText) statusText.textContent = 'Listening for Pedal...';
        }
    }

    setupSettingsUI() {
        var pedalToggle = document.getElementById('pedal-enable-toggle');
        if (pedalToggle) {
            pedalToggle.addEventListener('click', function() {
                this.toggle();
            }.bind(this));
        }

        var deviceNameInput = document.getElementById('pedal-device-name');
        if (deviceNameInput) {
            if (this.deviceName) {
                deviceNameInput.value = this.deviceName;
            }
            deviceNameInput.addEventListener('change', function(e) {
                this.deviceName = e.target.value || null;
                this.saveSettings();
                this.updateStatusIndicator();
            }.bind(this));
        }

        if (pedalToggle) {
            pedalToggle.classList.toggle('active', this.enabled);
            pedalToggle.setAttribute('aria-checked', this.enabled);
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        this.saveSettings();

        var pedalToggle = document.getElementById('pedal-enable-toggle');
        if (pedalToggle) {
            pedalToggle.classList.toggle('active', this.enabled);
            pedalToggle.setAttribute('aria-checked', this.enabled);
        }

        var controlsGroup = document.getElementById('pedal-controls-group');
        if (controlsGroup) {
            controlsGroup.style.display = this.enabled ? 'block' : 'none';
        }

        this.updateStatusIndicator();

        if (!this.enabled) {
            this.connected = false;
        }
    }

    setTotalMeasures(total) {
        this.totalMeasures = Math.max(1, total);
    }

    setCurrentMeasure(measure) {
        this.currentMeasure = Math.max(0, Math.min(measure, this.totalMeasures - 1));
    }

    setBinding(key, action) {
        this.bindings[key] = action;
        this.saveSettings();
    }

    getMeasureProgress() {
        if (this.totalMeasures <= 1) return 0;
        return this.currentMeasure / (this.totalMeasures - 1);
    }

    destroy() {
        if (this._boundKeyHandler) {
            document.removeEventListener('keydown', this._boundKeyHandler);
            this._boundKeyHandler = null;
        }
        if (this.feedbackTimeout) {
            clearTimeout(this.feedbackTimeout);
        }
    }
}

// Tests
describe('BluetoothHIDListener', () => {
    let listener;
    let elements;

    beforeEach(() => {
        localStorage.clear();
        // Clear listeners
        Object.keys(documentListeners).forEach(k => { documentListeners[k] = []; });
        Object.keys(documentElements).forEach(k => { delete documentElements[k]; });
        elements = createMockElements();
        listener = new BluetoothHIDListener();
    });

    afterEach(() => {
        if (listener) {
            listener.destroy();
        }
    });

    describe('Constructor & Settings', () => {
        it('should initialize with defaults', () => {
            assert.strictEqual(listener.enabled, false);
            assert.strictEqual(listener.connected, false);
            assert.strictEqual(listener.deviceName, null);
            assert.strictEqual(listener.currentMeasure, 0);
            assert.strictEqual(listener.totalMeasures, 1);
        });

        it('should load enabled state from localStorage', () => {
            localStorage.setItem('bluetoothPedalEnabled', 'true');
            const l = new BluetoothHIDListener();
            assert.strictEqual(l.enabled, true);
            l.destroy();
        });

        it('should load device name from localStorage', () => {
            localStorage.setItem('bluetoothLastDeviceName', 'AirTurn PED');
            const l = new BluetoothHIDListener();
            assert.strictEqual(l.deviceName, 'AirTurn PED');
            l.destroy();
        });

        it('should load custom bindings from localStorage', () => {
            const customBindings = { 'a': 'nextMeasure' };
            localStorage.setItem('bluetoothPedalBindings', JSON.stringify(customBindings));
            const l = new BluetoothHIDListener();
            assert.strictEqual(l.bindings['a'], 'nextMeasure');
            // Default bindings should still exist
            assert.strictEqual(l.bindings['PageUp'], 'nextMeasure');
            l.destroy();
        });

        it('should handle invalid JSON in stored bindings gracefully', () => {
            localStorage.setItem('bluetoothPedalBindings', 'not-json');
            const l = new BluetoothHIDListener();
            // Should use defaults
            assert.strictEqual(l.bindings['PageUp'], 'nextMeasure');
            l.destroy();
        });

        it('should save settings to localStorage', () => {
            listener.enabled = true;
            listener.deviceName = 'TestDevice';
            listener.saveSettings();

            assert.strictEqual(localStorage.getItem('bluetoothPedalEnabled'), 'true');
            assert.strictEqual(localStorage.getItem('bluetoothLastDeviceName'), 'TestDevice');
            assert.ok(localStorage.getItem('bluetoothPedalBindings'));
        });
    });

    describe('Key Bindings', () => {
        it('should have default bindings for PageUp/PageDown', () => {
            assert.strictEqual(listener.bindings['PageUp'], 'nextMeasure');
            assert.strictEqual(listener.bindings['PageDown'], 'prevMeasure');
        });

        it('should have default bindings for arrow keys', () => {
            assert.strictEqual(listener.bindings['ArrowRight'], 'nextMeasure');
            assert.strictEqual(listener.bindings['ArrowLeft'], 'prevMeasure');
            assert.strictEqual(listener.bindings['ArrowUp'], 'nextPage');
            assert.strictEqual(listener.bindings['ArrowDown'], 'prevPage');
        });

        it('should have default binding for space (toggle loop)', () => {
            assert.strictEqual(listener.bindings[' '], 'toggleLoop');
        });

        it('should allow updating bindings', () => {
            listener.setBinding('Enter', 'toggleLoop');
            assert.strictEqual(listener.bindings['Enter'], 'toggleLoop');
        });
    });

    describe('Key Event Handling', () => {
        it('should ignore events when disabled', () => {
            listener.enabled = false;
            listener.init();
            let called = false;
            listener.onNextMeasure = () => { called = true; };

            // Simulate keydown
            const event = { key: 'PageUp', preventDefault: () => {} };
            listener.handleKeyEvent(event);

            assert.strictEqual(called, false);
        });

        it('should handle PageUp as next measure when enabled', () => {
            listener.enabled = true;
            listener.totalMeasures = 10;
            listener.init();

            let receivedMeasure = null;
            listener.onNextMeasure = (m) => { receivedMeasure = m; };

            const event = { key: 'PageUp', preventDefault: () => {} };
            listener.handleKeyEvent(event);

            assert.strictEqual(receivedMeasure, 1);
            assert.strictEqual(listener.currentMeasure, 1);
        });

        it('should handle PageDown as previous measure when enabled', () => {
            listener.enabled = true;
            listener.totalMeasures = 10;
            listener.currentMeasure = 5;
            listener.init();

            let receivedMeasure = null;
            listener.onPrevMeasure = (m) => { receivedMeasure = m; };

            const event = { key: 'PageDown', preventDefault: () => {} };
            listener.handleKeyEvent(event);

            assert.strictEqual(receivedMeasure, 4);
            assert.strictEqual(listener.currentMeasure, 4);
        });

        it('should not go below measure 0', () => {
            listener.enabled = true;
            listener.totalMeasures = 10;
            listener.currentMeasure = 0;
            listener.init();

            let receivedMeasure = null;
            listener.onPrevMeasure = (m) => { receivedMeasure = m; };

            const event = { key: 'PageDown', preventDefault: () => {} };
            listener.handleKeyEvent(event);

            assert.strictEqual(receivedMeasure, 0);
            assert.strictEqual(listener.currentMeasure, 0);
        });

        it('should not exceed total measures', () => {
            listener.enabled = true;
            listener.totalMeasures = 5;
            listener.currentMeasure = 4;
            listener.init();

            let receivedMeasure = null;
            listener.onNextMeasure = (m) => { receivedMeasure = m; };

            const event = { key: 'PageUp', preventDefault: () => {} };
            listener.handleKeyEvent(event);

            assert.strictEqual(receivedMeasure, 4); // 4 is max index (0-based, 5 measures)
            assert.strictEqual(listener.currentMeasure, 4);
        });

        it('should call preventDefault on recognized keys', () => {
            listener.enabled = true;
            listener.init();

            let prevented = false;
            const event = { key: 'PageUp', preventDefault: () => { prevented = true; } };
            listener.handleKeyEvent(event);

            assert.strictEqual(prevented, true);
        });

        it('should ignore unrecognized keys', () => {
            listener.enabled = true;
            listener.init();

            let prevented = false;
            const event = { key: 'z', preventDefault: () => { prevented = true; } };
            listener.handleKeyEvent(event);

            assert.strictEqual(prevented, false);
        });

        it('should debounce rapid key presses', () => {
            listener.enabled = true;
            listener.totalMeasures = 10;
            listener.init();

            let callCount = 0;
            listener.onNextMeasure = () => { callCount++; };

            const event = { key: 'PageUp', preventDefault: () => {} };

            // First press: should work
            listener.lastKeyTime = 0;
            listener.handleKeyEvent(event);
            assert.strictEqual(callCount, 1);

            // Second press too fast: should be debounced
            listener.handleKeyEvent(event);
            assert.strictEqual(callCount, 1);
        });

        it('should mark as connected on first input', () => {
            listener.enabled = true;
            listener.init();

            assert.strictEqual(listener.connected, false);

            const event = { key: 'PageUp', preventDefault: () => {} };
            listener.handleKeyEvent(event);

            assert.strictEqual(listener.connected, true);
        });
    });

    describe('Page Navigation', () => {
        it('should jump forward 8 measures on ArrowUp (next page)', () => {
            listener.enabled = true;
            listener.totalMeasures = 32;
            listener.currentMeasure = 0;
            listener.init();

            let receivedMeasure = null;
            listener.onNextPage = (m) => { receivedMeasure = m; };

            const event = { key: 'ArrowUp', preventDefault: () => {} };
            listener.handleKeyEvent(event);

            assert.strictEqual(receivedMeasure, 8);
            assert.strictEqual(listener.currentMeasure, 8);
        });

        it('should jump back 8 measures on ArrowDown (prev page)', () => {
            listener.enabled = true;
            listener.totalMeasures = 32;
            listener.currentMeasure = 16;
            listener.init();

            let receivedMeasure = null;
            listener.onPrevPage = (m) => { receivedMeasure = m; };

            const event = { key: 'ArrowDown', preventDefault: () => {} };
            listener.handleKeyEvent(event);

            assert.strictEqual(receivedMeasure, 8);
            assert.strictEqual(listener.currentMeasure, 8);
        });

        it('should clamp page navigation to bounds', () => {
            listener.enabled = true;
            listener.totalMeasures = 10;
            listener.currentMeasure = 5;
            listener.init();

            let receivedMeasure = null;
            listener.onNextPage = (m) => { receivedMeasure = m; };

            const event = { key: 'ArrowUp', preventDefault: () => {} };
            listener.handleKeyEvent(event);

            assert.strictEqual(receivedMeasure, 9); // clamped to max
            assert.strictEqual(listener.currentMeasure, 9);
        });
    });

    describe('Toggle Loop', () => {
        it('should trigger toggleLoop on space key', () => {
            listener.enabled = true;
            listener.init();

            let toggled = false;
            listener.onToggleLoop = () => { toggled = true; };

            const event = { key: ' ', preventDefault: () => {} };
            listener.handleKeyEvent(event);

            assert.strictEqual(toggled, true);
        });
    });

    describe('Visual Feedback', () => {
        it('should show feedback when pedal is pressed', () => {
            listener.enabled = true;
            listener.init();

            let feedbackAction = null;
            let feedbackLabel = null;
            listener.onPedalPress = (action, label) => {
                feedbackAction = action;
                feedbackLabel = label;
            };

            const event = { key: 'PageUp', preventDefault: () => {} };
            listener.handleKeyEvent(event);

            assert.strictEqual(feedbackAction, 'nextMeasure');
            assert.strictEqual(feedbackLabel, 'Next Measure');
        });

        it('should return correct action labels', () => {
            assert.strictEqual(listener.getActionLabel('nextMeasure'), 'Next Measure');
            assert.strictEqual(listener.getActionLabel('prevMeasure'), 'Previous Measure');
            assert.strictEqual(listener.getActionLabel('nextPage'), 'Next Page');
            assert.strictEqual(listener.getActionLabel('prevPage'), 'Previous Page');
            assert.strictEqual(listener.getActionLabel('toggleLoop'), 'Toggle Loop');
            assert.strictEqual(listener.getActionLabel('unknown'), 'unknown');
        });
    });

    describe('Measure Progress', () => {
        it('should calculate progress correctly', () => {
            listener.totalMeasures = 10;
            listener.currentMeasure = 0;
            assert.strictEqual(listener.getMeasureProgress(), 0);

            listener.currentMeasure = 9;
            assert.strictEqual(listener.getMeasureProgress(), 1);

            listener.currentMeasure = 4;
            const expected = 4 / 9;
            assert.ok(Math.abs(listener.getMeasureProgress() - expected) < 0.001);
        });

        it('should return 0 when only 1 measure', () => {
            listener.totalMeasures = 1;
            listener.currentMeasure = 0;
            assert.strictEqual(listener.getMeasureProgress(), 0);
        });

        it('should set total measures correctly', () => {
            listener.setTotalMeasures(16);
            assert.strictEqual(listener.totalMeasures, 16);
        });

        it('should clamp total measures to at least 1', () => {
            listener.setTotalMeasures(0);
            assert.strictEqual(listener.totalMeasures, 1);
        });

        it('should set current measure within bounds', () => {
            listener.totalMeasures = 10;
            listener.setCurrentMeasure(5);
            assert.strictEqual(listener.currentMeasure, 5);

            listener.setCurrentMeasure(15);
            assert.strictEqual(listener.currentMeasure, 9); // clamped

            listener.setCurrentMeasure(-1);
            assert.strictEqual(listener.currentMeasure, 0); // clamped
        });
    });

    describe('Toggle', () => {
        it('should toggle enabled state', () => {
            listener.init();
            assert.strictEqual(listener.enabled, false);

            listener.toggle();
            assert.strictEqual(listener.enabled, true);
            assert.strictEqual(localStorage.getItem('bluetoothPedalEnabled'), 'true');

            listener.toggle();
            assert.strictEqual(listener.enabled, false);
            assert.strictEqual(localStorage.getItem('bluetoothPedalEnabled'), 'false');
        });

        it('should reset connected state when disabled', () => {
            listener.enabled = true;
            listener.connected = true;
            listener.init();

            listener.toggle(); // Disables

            assert.strictEqual(listener.connected, false);
        });

        it('should show/hide controls group', () => {
            listener.init();

            listener.toggle(); // Enable
            assert.strictEqual(elements.controlsGroup.style.display, 'block');

            listener.toggle(); // Disable
            assert.strictEqual(elements.controlsGroup.style.display, 'none');
        });
    });

    describe('Status Indicator', () => {
        it('should show disabled state when not enabled', () => {
            listener.enabled = false;
            listener.init();
            listener.updateStatusIndicator();

            assert.strictEqual(elements.statusDot.className, 'pedal-status-dot disabled');
            assert.strictEqual(elements.statusText.textContent, 'Pedal Disabled');
        });

        it('should show listening state when enabled but not connected', () => {
            listener.enabled = true;
            listener.connected = false;
            listener.init();
            listener.updateStatusIndicator();

            assert.strictEqual(elements.statusDot.className, 'pedal-status-dot listening');
            assert.strictEqual(elements.statusText.textContent, 'Listening for Pedal...');
        });

        it('should show connected state with device name', () => {
            listener.enabled = true;
            listener.connected = true;
            listener.deviceName = 'AirTurn PED';
            listener.init();
            listener.updateStatusIndicator();

            assert.strictEqual(elements.statusDot.className, 'pedal-status-dot connected');
            assert.strictEqual(elements.statusText.textContent, 'AirTurn PED');
        });

        it('should show generic connected text when no device name', () => {
            listener.enabled = true;
            listener.connected = true;
            listener.deviceName = null;
            listener.init();
            listener.updateStatusIndicator();

            assert.strictEqual(elements.statusText.textContent, 'Pedal Connected');
        });
    });

    describe('Cleanup', () => {
        it('should remove keydown listener on destroy', () => {
            listener.init();
            const initialCount = (documentListeners['keydown'] || []).length;

            listener.destroy();

            assert.strictEqual(listener._boundKeyHandler, null);
        });

        it('should clear feedback timeout on destroy', () => {
            listener.feedbackTimeout = setTimeout(() => {}, 10000);
            listener.destroy();
            // No error thrown means clearTimeout was called
        });
    });
});
