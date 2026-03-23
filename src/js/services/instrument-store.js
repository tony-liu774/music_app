/**
 * InstrumentStore - Global state for instrument selection and permissions
 * Provides a pub/sub store that the DSP engine and UI components read from.
 */

class InstrumentStore {
    constructor() {
        this._state = {
            instrument: null,
            instrumentRange: null,
            microphoneGranted: false,
            cameraGranted: false,
            onboardingComplete: false
        };
        this._listeners = new Map();
        this._listenerIdCounter = 0;

        // Instrument frequency ranges (Hz) — canonical source
        this.instrumentRanges = {
            violin: {
                name: 'Violin',
                minFreq: 196,
                maxFreq: 2637,
                typicalFreq: 440,
                openStrings: ['G3', 'D4', 'A4', 'E5']
            },
            viola: {
                name: 'Viola',
                minFreq: 130,
                maxFreq: 1760,
                typicalFreq: 261,
                openStrings: ['C3', 'G3', 'D4', 'A4']
            },
            cello: {
                name: 'Cello',
                minFreq: 65,
                maxFreq: 987,
                typicalFreq: 130.81,
                openStrings: ['C2', 'G2', 'D3', 'A3']
            },
            bass: {
                name: 'Double Bass',
                minFreq: 41,
                maxFreq: 523,
                typicalFreq: 82.41,
                openStrings: ['E1', 'A1', 'D2', 'G2']
            }
        };

        this._hydrateFromStorage();
    }

    /**
     * Hydrate state from localStorage on construction
     */
    _hydrateFromStorage() {
        try {
            const instrument = localStorage.getItem('selected_instrument');
            const onboardingComplete = localStorage.getItem('onboarding_complete') === 'true';
            const micGranted = localStorage.getItem('mic_permission_granted') === 'true';
            const camGranted = localStorage.getItem('cam_permission_granted') === 'true';

            if (instrument && this.instrumentRanges[instrument]) {
                this._state.instrument = instrument;
                this._state.instrumentRange = this.instrumentRanges[instrument];
            }
            this._state.onboardingComplete = onboardingComplete;
            this._state.microphoneGranted = micGranted;
            this._state.cameraGranted = camGranted;
        } catch {
            // localStorage unavailable
        }
    }

    /**
     * Get current state (read-only snapshot)
     */
    getState() {
        return Object.assign({}, this._state);
    }

    /**
     * Get selected instrument key
     */
    getInstrument() {
        return this._state.instrument;
    }

    /**
     * Get selected instrument's frequency range
     */
    getInstrumentRange() {
        return this._state.instrumentRange;
    }

    /**
     * Check if microphone is granted
     */
    isMicrophoneGranted() {
        return this._state.microphoneGranted;
    }

    /**
     * Set the selected instrument and persist
     */
    setInstrument(instrumentKey) {
        if (!instrumentKey || !this.instrumentRanges[instrumentKey]) {
            return false;
        }
        this._state.instrument = instrumentKey;
        this._state.instrumentRange = this.instrumentRanges[instrumentKey];
        try {
            localStorage.setItem('selected_instrument', instrumentKey);
        } catch {
            // localStorage unavailable
        }
        this._notify('instrument', instrumentKey);
        return true;
    }

    /**
     * Set microphone permission state
     */
    setMicrophoneGranted(granted) {
        this._state.microphoneGranted = !!granted;
        try {
            localStorage.setItem('mic_permission_granted', String(!!granted));
        } catch {
            // localStorage unavailable
        }
        this._notify('microphoneGranted', !!granted);
    }

    /**
     * Set camera permission state
     */
    setCameraGranted(granted) {
        this._state.cameraGranted = !!granted;
        try {
            localStorage.setItem('cam_permission_granted', String(!!granted));
        } catch {
            // localStorage unavailable
        }
        this._notify('cameraGranted', !!granted);
    }

    /**
     * Mark onboarding as complete
     */
    setOnboardingComplete(complete) {
        this._state.onboardingComplete = !!complete;
        try {
            localStorage.setItem('onboarding_complete', String(!!complete));
        } catch {
            // localStorage unavailable
        }
        this._notify('onboardingComplete', !!complete);
    }

    /**
     * Subscribe to state changes
     * @param {Function} listener - fn(key, value, state)
     * @returns {number} listener id (use to unsubscribe)
     */
    subscribe(listener) {
        const id = ++this._listenerIdCounter;
        this._listeners.set(id, listener);
        return id;
    }

    /**
     * Unsubscribe a listener
     */
    unsubscribe(id) {
        this._listeners.delete(id);
    }

    /**
     * Notify all listeners
     */
    _notify(key, value) {
        const state = this.getState();
        this._listeners.forEach(listener => {
            try {
                listener(key, value, state);
            } catch (e) {
                console.error('InstrumentStore listener error:', e);
            }
        });
    }

    /**
     * Reset all state (for testing / settings reset)
     */
    reset() {
        this._state = {
            instrument: null,
            instrumentRange: null,
            microphoneGranted: false,
            cameraGranted: false,
            onboardingComplete: false
        };
        try {
            localStorage.removeItem('selected_instrument');
            localStorage.removeItem('onboarding_complete');
            localStorage.removeItem('mic_permission_granted');
            localStorage.removeItem('cam_permission_granted');
        } catch {
            // localStorage unavailable
        }
        this._notify('reset', null);
    }
}

// Singleton instance
if (typeof window !== 'undefined') {
    window.InstrumentStore = InstrumentStore;
    if (!window.instrumentStore) {
        window.instrumentStore = new InstrumentStore();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InstrumentStore };
}
