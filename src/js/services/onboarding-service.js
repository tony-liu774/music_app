/**
 * Onboarding Service - First-time user flow for permissions and instrument calibration
 * Integrates with InstrumentStore for global state management.
 */

class OnboardingService {
    constructor(store) {
        this.store = store || (typeof window !== 'undefined' && window.instrumentStore) || null;
        this.currentStep = 0;
        this.steps = ['welcome', 'permissions', 'instrument', 'calibration', 'complete'];
        this.selectedInstrument = null;
        this.microphoneGranted = false;
        this.microphoneDenied = false;
        this.cameraGranted = false;
        this.cameraDenied = false;
        this.calibrationComplete = false;
        this.onStepChange = null;
        this.onComplete = null;

        // Delegate to store's canonical instrument ranges
        this.instrumentRanges = this.store ? this.store.instrumentRanges : {
            violin: { name: 'Violin', minFreq: 196, maxFreq: 2637, typicalFreq: 440, description: 'The highest-pitched member of the violin family' },
            viola: { name: 'Viola', minFreq: 130, maxFreq: 1760, typicalFreq: 261, description: 'Larger than a violin, with a richer, deeper tone' },
            cello: { name: 'Cello', minFreq: 65, maxFreq: 987, typicalFreq: 130.81, description: 'Large instrument played seated, with a warm, singing tone' },
            bass: { name: 'Double Bass', minFreq: 41, maxFreq: 523, typicalFreq: 82.41, description: 'The largest and lowest-pitched member of the violin family' }
        };

        // Check if onboarding has been completed
        this.hasCompletedOnboarding = this.checkOnboardingStatus();
    }

    /**
     * Check if user has completed onboarding
     * @returns {boolean}
     */
    checkOnboardingStatus() {
        try {
            return localStorage.getItem('onboarding_complete') === 'true' &&
                   localStorage.getItem('selected_instrument') !== null;
        } catch {
            return false;
        }
    }

    /**
     * Start the onboarding flow
     */
    start() {
        this.currentStep = 0;
        this.notifyStepChange();
    }

    /**
     * Move to next step
     */
    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.notifyStepChange();
        }
    }

    /**
     * Move to previous step
     */
    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.notifyStepChange();
        }
    }

    /**
     * Get current step name
     * @returns {string}
     */
    getCurrentStep() {
        return this.steps[this.currentStep];
    }

    /**
     * Notify step change
     */
    notifyStepChange() {
        if (this.onStepChange) {
            this.onStepChange({
                step: this.getCurrentStep(),
                stepIndex: this.currentStep,
                totalSteps: this.steps.length
            });
        }
    }

    /**
     * Request microphone permission
     * @returns {Promise<boolean>}
     */
    async requestMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Stop the stream immediately - we just wanted permission
            stream.getTracks().forEach(track => track.stop());
            this.microphoneGranted = true;
            this.microphoneDenied = false;
            if (this.store) {
                this.store.setMicrophoneGranted(true);
            }
            return true;
        } catch (error) {
            console.error('Microphone permission denied:', error);
            this.microphoneGranted = false;
            this.microphoneDenied = true;
            if (this.store) {
                this.store.setMicrophoneGranted(false);
            }
            return false;
        }
    }

    /**
     * Request camera permission (for future OMR feature)
     * @returns {Promise<boolean>}
     */
    async requestCameraPermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            stream.getTracks().forEach(track => track.stop());
            this.cameraGranted = true;
            this.cameraDenied = false;
            if (this.store) {
                this.store.setCameraGranted(true);
            }
            return true;
        } catch (error) {
            console.error('Camera permission denied:', error);
            this.cameraGranted = false;
            this.cameraDenied = true;
            if (this.store) {
                this.store.setCameraGranted(false);
            }
            return false;
        }
    }

    /**
     * Request all permissions
     * @returns {Promise<Object>}
     */
    async requestPermissions() {
        const micResult = await this.requestMicrophonePermission();
        const camResult = await this.requestCameraPermission();

        return {
            microphone: micResult,
            camera: camResult
        };
    }

    /**
     * Check if microphone access is required but denied
     * @returns {boolean}
     */
    isMicrophoneBlocked() {
        return this.microphoneDenied && !this.microphoneGranted;
    }

    /**
     * Set selected instrument and sync to global store
     * @param {string} instrument - Instrument key
     */
    selectInstrument(instrument) {
        if (this.instrumentRanges[instrument]) {
            this.selectedInstrument = instrument;
            // Delegate persistence to store (single source of truth)
            if (this.store) {
                this.store.setInstrument(instrument);
            } else {
                // Fallback when no store available
                try {
                    localStorage.setItem('selected_instrument', instrument);
                } catch (e) {
                    console.warn('Could not save instrument to localStorage');
                }
            }
        }
    }

    /**
     * Get selected instrument range
     * @returns {Object|null}
     */
    getSelectedInstrumentRange() {
        if (!this.selectedInstrument) return null;
        return this.instrumentRanges[this.selectedInstrument];
    }

    /**
     * Get all instrument options
     * @returns {Array}
     */
    getInstrumentOptions() {
        return Object.entries(this.instrumentRanges).map(([key, value]) => ({
            id: key,
            name: value.name,
            description: value.description,
            range: `${value.minFreq}-${value.maxFreq} Hz`
        }));
    }

    /**
     * Complete calibration
     * @param {Object} calibrationData - Optional calibration data
     */
    completeCalibration(calibrationData = {}) {
        this.calibrationComplete = true;
        this.currentStep = this.steps.indexOf('complete');
        this.notifyStepChange();
    }

    /**
     * Finish onboarding and sync state to store
     */
    finishOnboarding() {
        try {
            localStorage.setItem('onboarding_complete', 'true');
        } catch (e) {
            console.warn('Could not save onboarding status');
        }

        if (this.store) {
            this.store.setOnboardingComplete(true);
        }

        if (this.onComplete) {
            this.onComplete({
                instrument: this.selectedInstrument,
                instrumentRange: this.getSelectedInstrumentRange(),
                permissions: {
                    microphone: this.microphoneGranted,
                    camera: this.cameraGranted
                }
            });
        }
    }

    /**
     * Skip onboarding (for returning users)
     */
    skipOnboarding() {
        this.finishOnboarding();
    }

    /**
     * Reset onboarding (for settings reset)
     */
    resetOnboarding() {
        try {
            localStorage.removeItem('onboarding_complete');
            localStorage.removeItem('selected_instrument');
        } catch (e) {
            console.warn('Could not reset onboarding');
        }
        this.hasCompletedOnboarding = false;
        this.selectedInstrument = null;
        this.currentStep = 0;
        if (this.store) {
            this.store.reset();
        }
    }

    /**
     * Set callback for step changes
     * @param {Function} callback
     */
    setOnStepChange(callback) {
        this.onStepChange = callback;
    }

    /**
     * Set callback for completion
     * @param {Function} callback
     */
    setOnComplete(callback) {
        this.onComplete = callback;
    }

    /**
     * Get onboarding progress percentage
     * @returns {number}
     */
    getProgress() {
        return Math.round((this.currentStep / (this.steps.length - 1)) * 100);
    }
}

if (typeof window !== 'undefined') {
    window.OnboardingService = OnboardingService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OnboardingService };
}
