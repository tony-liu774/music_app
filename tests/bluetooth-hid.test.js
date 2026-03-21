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

// Setup globals before requiring source
global.window = {};
global.localStorage = localStorageMock;
global.document = documentMock;
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;
global.Date = Date;

// Require the actual source file
const BluetoothHIDListener = require('../src/js/hardware/bluetooth-hid-listener.js');

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

        it('should load custom bindings from localStorage with validation', () => {
            const customBindings = { 'a': 'nextMeasure', 'b': 'invalidAction' };
            localStorage.setItem('bluetoothPedalBindings', JSON.stringify(customBindings));
            const l = new BluetoothHIDListener();
            assert.strictEqual(l.bindings['a'], 'nextMeasure');
            // Invalid action should NOT be loaded
            assert.strictEqual(l.bindings['b'], undefined);
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

        it('should clear deviceName from localStorage when set to null', () => {
            listener.deviceName = 'SomeDevice';
            listener.saveSettings();
            assert.strictEqual(localStorage.getItem('bluetoothLastDeviceName'), 'SomeDevice');

            listener.deviceName = null;
            listener.saveSettings();
            assert.strictEqual(localStorage.getItem('bluetoothLastDeviceName'), null);
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

        it('should allow updating bindings with valid actions', () => {
            listener.setBinding('Enter', 'toggleLoop');
            assert.strictEqual(listener.bindings['Enter'], 'toggleLoop');
        });

        it('should reject invalid action in setBinding', () => {
            listener.setBinding('Enter', 'invalidAction');
            assert.strictEqual(listener.bindings['Enter'], undefined);
        });
    });

    describe('Key Event Handling', () => {
        it('should ignore events when disabled', () => {
            listener.enabled = false;
            listener.init();
            let called = false;
            listener.onNextMeasure = () => { called = true; };

            const event = { key: 'PageUp', preventDefault: () => {}, target: { tagName: 'DIV' } };
            listener.handleKeyEvent(event);

            assert.strictEqual(called, false);
        });

        it('should ignore events when focused on input fields', () => {
            listener.enabled = true;
            listener.totalMeasures = 10;
            listener.init();

            let called = false;
            listener.onNextMeasure = () => { called = true; };

            const event = { key: 'PageUp', preventDefault: () => {}, target: { tagName: 'INPUT' } };
            listener.handleKeyEvent(event);
            assert.strictEqual(called, false);

            const event2 = { key: 'PageUp', preventDefault: () => {}, target: { tagName: 'TEXTAREA' } };
            listener.handleKeyEvent(event2);
            assert.strictEqual(called, false);

            const event3 = { key: 'PageUp', preventDefault: () => {}, target: { tagName: 'SELECT' } };
            listener.handleKeyEvent(event3);
            assert.strictEqual(called, false);
        });

        it('should handle PageUp as next measure when enabled', () => {
            listener.enabled = true;
            listener.totalMeasures = 10;
            listener.init();

            let receivedMeasure = null;
            listener.onNextMeasure = (m) => { receivedMeasure = m; };

            const event = { key: 'PageUp', preventDefault: () => {}, target: { tagName: 'DIV' } };
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

            const event = { key: 'PageDown', preventDefault: () => {}, target: { tagName: 'DIV' } };
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

            const event = { key: 'PageDown', preventDefault: () => {}, target: { tagName: 'DIV' } };
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

            const event = { key: 'PageUp', preventDefault: () => {}, target: { tagName: 'DIV' } };
            listener.handleKeyEvent(event);

            assert.strictEqual(receivedMeasure, 4);
            assert.strictEqual(listener.currentMeasure, 4);
        });

        it('should call preventDefault on recognized keys', () => {
            listener.enabled = true;
            listener.init();

            let prevented = false;
            const event = { key: 'PageUp', preventDefault: () => { prevented = true; }, target: { tagName: 'DIV' } };
            listener.handleKeyEvent(event);

            assert.strictEqual(prevented, true);
        });

        it('should ignore unrecognized keys', () => {
            listener.enabled = true;
            listener.init();

            let prevented = false;
            const event = { key: 'z', preventDefault: () => { prevented = true; }, target: { tagName: 'DIV' } };
            listener.handleKeyEvent(event);

            assert.strictEqual(prevented, false);
        });

        it('should debounce rapid presses of the same key', () => {
            listener.enabled = true;
            listener.totalMeasures = 10;
            listener.init();

            let callCount = 0;
            listener.onNextMeasure = () => { callCount++; };

            const event = { key: 'PageUp', preventDefault: () => {}, target: { tagName: 'DIV' } };

            // First press: should work
            listener.lastKeyTimes = {};
            listener.handleKeyEvent(event);
            assert.strictEqual(callCount, 1);

            // Second press too fast (same key): should be debounced
            listener.handleKeyEvent(event);
            assert.strictEqual(callCount, 1);
        });

        it('should allow rapid presses of different keys (per-key debounce)', () => {
            listener.enabled = true;
            listener.totalMeasures = 10;
            listener.currentMeasure = 5;
            listener.init();

            let nextCalled = false;
            let prevCalled = false;
            listener.onNextMeasure = () => { nextCalled = true; };
            listener.onPrevMeasure = () => { prevCalled = true; };

            // Press PageUp
            listener.lastKeyTimes = {};
            const event1 = { key: 'PageUp', preventDefault: () => {}, target: { tagName: 'DIV' } };
            listener.handleKeyEvent(event1);
            assert.strictEqual(nextCalled, true);

            // Immediately press PageDown (different key) - should NOT be debounced
            const event2 = { key: 'PageDown', preventDefault: () => {}, target: { tagName: 'DIV' } };
            listener.handleKeyEvent(event2);
            assert.strictEqual(prevCalled, true);
        });

        it('should mark as connected on first input', () => {
            listener.enabled = true;
            listener.init();

            assert.strictEqual(listener.connected, false);

            const event = { key: 'PageUp', preventDefault: () => {}, target: { tagName: 'DIV' } };
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

            const event = { key: 'ArrowUp', preventDefault: () => {}, target: { tagName: 'DIV' } };
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

            const event = { key: 'ArrowDown', preventDefault: () => {}, target: { tagName: 'DIV' } };
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

            const event = { key: 'ArrowUp', preventDefault: () => {}, target: { tagName: 'DIV' } };
            listener.handleKeyEvent(event);

            assert.strictEqual(receivedMeasure, 9);
            assert.strictEqual(listener.currentMeasure, 9);
        });
    });

    describe('Toggle Loop', () => {
        it('should trigger toggleLoop on space key', () => {
            listener.enabled = true;
            listener.init();

            let toggled = false;
            listener.onToggleLoop = () => { toggled = true; };

            const event = { key: ' ', preventDefault: () => {}, target: { tagName: 'DIV' } };
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

            const event = { key: 'PageUp', preventDefault: () => {}, target: { tagName: 'DIV' } };
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

// Require the real IntegrationController class
const IntegrationController = require('../src/js/components/integration-controller.js');

describe('IntegrationController - Bluetooth Pedal Wiring', () => {
    let controller;
    let mockApp;
    let mockListener;
    let mockFollowTheBall;

    beforeEach(() => {
        localStorage.clear();
        Object.keys(documentElements).forEach(k => { delete documentElements[k]; });

        mockFollowTheBall = {
            setTargetPosition: function(pos) { this._lastPosition = pos; },
            saveSettings: function() {},
            speed: 1,
            _lastPosition: null
        };

        mockApp = {
            sheetMusicRenderer: {
                setCursorPosition: function(pos) { this._lastPosition = pos; },
                _lastPosition: null
            },
            practiceLoopController: {
                isActive: false,
                start: function() { this.isActive = true; },
                stop: function() { this.isActive = false; }
            }
        };

        mockListener = new BluetoothHIDListener();
        mockListener.totalMeasures = 16;

        controller = new IntegrationController(mockApp);
        controller.setBluetoothHIDListener(mockListener);
        controller.setFollowTheBall(mockFollowTheBall);
    });

    afterEach(() => {
        mockListener.destroy();
    });

    it('should wire navigation callbacks via setupBluetoothPedalIntegration', () => {
        controller.setupBluetoothPedalIntegration();

        assert.ok(mockListener.onNextMeasure, 'onNextMeasure should be set');
        assert.ok(mockListener.onPrevMeasure, 'onPrevMeasure should be set');
        assert.ok(mockListener.onNextPage, 'onNextPage should be set');
        assert.ok(mockListener.onPrevPage, 'onPrevPage should be set');
        assert.ok(mockListener.onToggleLoop, 'onToggleLoop should be set');
    });

    it('should update Follow-the-Ball and renderer on nextMeasure', () => {
        controller.setupBluetoothPedalIntegration();

        // Simulate advancing to measure 4
        mockListener.currentMeasure = 4;
        mockListener.onNextMeasure(4);

        // Follow-the-Ball should get progress (4/15 ≈ 0.267)
        assert.ok(Math.abs(mockFollowTheBall._lastPosition - 4 / 15) < 0.001);
        // Renderer should get the measure index
        assert.strictEqual(mockApp.sheetMusicRenderer._lastPosition, 4);
    });

    it('should toggle practice loop on toggleLoop', () => {
        controller.setupBluetoothPedalIntegration();

        // First toggle: start
        assert.strictEqual(mockApp.practiceLoopController.isActive, false);
        mockListener.onToggleLoop();
        assert.strictEqual(mockApp.practiceLoopController.isActive, true);

        // Second toggle: stop
        mockListener.onToggleLoop();
        assert.strictEqual(mockApp.practiceLoopController.isActive, false);
    });

    it('should handle missing followTheBall gracefully', () => {
        controller.followTheBall = null;
        controller.setupBluetoothPedalIntegration();

        // Should not throw
        mockListener.currentMeasure = 2;
        mockListener.onNextMeasure(2);

        // Renderer should still be updated
        assert.strictEqual(mockApp.sheetMusicRenderer._lastPosition, 2);
    });

    it('should handle missing practiceLoopController gracefully', () => {
        mockApp.practiceLoopController = null;
        controller.setupBluetoothPedalIntegration();

        // Should not throw
        mockListener.onToggleLoop();
    });

    it('should skip wiring when no bluetoothHIDListener is set', () => {
        const controller2 = new IntegrationController(mockApp);
        // No listener set - should not throw
        controller2.setupBluetoothPedalIntegration();
    });
});
