/**
 * Bluetooth HID Listener - Hands-free UI navigation for gigging musicians
 * Supports AirTurn pedals and similar Bluetooth HID devices
 * Listens for keyboard events (PageUp/PageDown) from paired BT devices
 */

class BluetoothHIDListener {
    constructor() {
        // Settings
        this.enabled = false;
        this.connected = false;
        this.deviceName = null;

        // Key bindings (default: AirTurn pedal mappings)
        this.bindings = {
            PageUp: 'nextMeasure',
            PageDown: 'prevMeasure',
            ArrowRight: 'nextMeasure',
            ArrowLeft: 'prevMeasure',
            ArrowUp: 'nextPage',
            ArrowDown: 'prevPage',
            ' ': 'toggleLoop'
        };

        // Callbacks for integration
        this.onNextMeasure = null;
        this.onPrevMeasure = null;
        this.onNextPage = null;
        this.onPrevPage = null;
        this.onToggleLoop = null;
        this.onPedalPress = null; // Visual feedback callback

        // State tracking
        this.currentMeasure = 0;
        this.totalMeasures = 1;
        this.lastKeyTime = 0;
        this.debounceMs = 100; // Prevent double-triggers
        this.feedbackTimeout = null;

        // Bound handler reference for cleanup
        this._boundKeyHandler = null;

        // Load saved settings
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

    /**
     * Setup keyboard event listener for HID input
     * AirTurn pedals send standard keyboard events when paired via Bluetooth
     */
    setupKeyboardListener() {
        this._boundKeyHandler = this.handleKeyEvent.bind(this);
        document.addEventListener('keydown', this._boundKeyHandler);
    }

    /**
     * Handle incoming keyboard events from BT HID device
     */
    handleKeyEvent(event) {
        if (!this.enabled) return;

        var action = this.bindings[event.key];
        if (!action) return;

        // Debounce to prevent double-triggers from pedal bounce
        var now = Date.now();
        if (now - this.lastKeyTime < this.debounceMs) return;
        this.lastKeyTime = now;

        // Prevent default browser behavior (page scrolling)
        event.preventDefault();

        // Mark as connected on first recognized input
        if (!this.connected) {
            this.connected = true;
            this.updateStatusIndicator();
        }

        // Show visual feedback
        this.showPedalFeedback(action);

        // Execute the action
        this.executeAction(action);
    }

    /**
     * Execute a pedal action
     */
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
                // Jump forward 8 measures (one page)
                this.currentMeasure = Math.min(this.currentMeasure + 8, this.totalMeasures - 1);
                if (this.onNextPage) {
                    this.onNextPage(this.currentMeasure);
                }
                break;
            case 'prevPage':
                // Jump back 8 measures (one page)
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

    /**
     * Show visual feedback when a pedal is pressed
     */
    showPedalFeedback(action) {
        var indicator = document.getElementById('pedal-feedback-indicator');
        if (!indicator) return;

        // Set feedback text based on action
        var label = this.getActionLabel(action);
        var feedbackText = indicator.querySelector('.pedal-feedback-text');
        if (feedbackText) {
            feedbackText.textContent = label;
        }

        // Show with glow animation
        indicator.classList.add('active');
        indicator.setAttribute('aria-label', 'Pedal pressed: ' + label);

        // Notify callback
        if (this.onPedalPress) {
            this.onPedalPress(action, label);
        }

        // Hide after brief flash
        if (this.feedbackTimeout) {
            clearTimeout(this.feedbackTimeout);
        }
        this.feedbackTimeout = setTimeout(function() {
            indicator.classList.remove('active');
        }, 400);
    }

    /**
     * Get human-readable label for an action
     */
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

    /**
     * Update the status indicator in the UI
     */
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

    /**
     * Setup settings UI event listeners
     */
    setupSettingsUI() {
        // Enable/disable toggle
        var pedalToggle = document.getElementById('pedal-enable-toggle');
        if (pedalToggle) {
            pedalToggle.addEventListener('click', function() {
                this.toggle();
            }.bind(this));
        }

        // Device name input
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

        // Update toggle UI state
        if (pedalToggle) {
            pedalToggle.classList.toggle('active', this.enabled);
            pedalToggle.setAttribute('aria-checked', this.enabled);
        }
    }

    /**
     * Toggle pedal on/off
     */
    toggle() {
        this.enabled = !this.enabled;
        this.saveSettings();

        var pedalToggle = document.getElementById('pedal-enable-toggle');
        if (pedalToggle) {
            pedalToggle.classList.toggle('active', this.enabled);
            pedalToggle.setAttribute('aria-checked', this.enabled);
        }

        // Show/hide pedal controls
        var controlsGroup = document.getElementById('pedal-controls-group');
        if (controlsGroup) {
            controlsGroup.style.display = this.enabled ? 'block' : 'none';
        }

        this.updateStatusIndicator();

        if (!this.enabled) {
            this.connected = false;
        }
    }

    /**
     * Set the total measures count (from sheet music)
     */
    setTotalMeasures(total) {
        this.totalMeasures = Math.max(1, total);
    }

    /**
     * Set the current measure (sync with other components)
     */
    setCurrentMeasure(measure) {
        this.currentMeasure = Math.max(0, Math.min(measure, this.totalMeasures - 1));
    }

    /**
     * Update a key binding
     */
    setBinding(key, action) {
        this.bindings[key] = action;
        this.saveSettings();
    }

    /**
     * Get the current measure progress as 0-1 ratio
     */
    getMeasureProgress() {
        if (this.totalMeasures <= 1) return 0;
        return this.currentMeasure / (this.totalMeasures - 1);
    }

    /**
     * Clean up event listeners
     */
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

window.BluetoothHIDListener = BluetoothHIDListener;
