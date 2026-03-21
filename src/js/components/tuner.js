/**
 * Precision Tuner Component
 * Real-time frequency detection with glowing needle-style gauge
 */

class PrecisionTuner {
    constructor(container) {
        this.container = container;
        this.pitchDetector = null;
        this.audioEngine = null;
        this.isActive = false;
        this.currentNote = null;
        this.targetNote = null;
        this.centsDeviation = 0;
        this.confidenceThreshold = 0.85;
        this.selectedInstrument = 'violin';

        // Instrument tuning reference frequencies
        this.instrumentTuning = {
            violin: { openStrings: ['G3', 'D4', 'A4', 'E5'], standard: 'A4=440' },
            viola: { openStrings: ['C3', 'G3', 'D4', 'A4'], standard: 'A4=440' },
            cello: { openStrings: ['C2', 'G2', 'D3', 'A3'], standard: 'A4=440' },
            bass: { openStrings: ['E1', 'A1', 'D2', 'G2'], standard: 'A4=440' }
        };

        // Note names for display
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // Threshold for showing needle gauge
        this.deviationThreshold = 10;

        // Animation frame for smooth needle movement
        this.animationFrame = null;
        this.smoothedCents = 0;

        this._init();
    }

    _init() {
        this.render();
        this.bindEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="tuner-view">
                <div class="tuner-header">
                    <h1>Precision Tuner</h1>
                    <p class="subtitle">Fine-tune your instrument</p>
                </div>

                <div class="tuner-instrument-selector">
                    <button class="tuner-instrument-btn active" data-instrument="violin">
                        <span class="instrument-icon">🎻</span>
                        <span>Violin</span>
                    </button>
                    <button class="tuner-instrument-btn" data-instrument="viola">
                        <span class="instrument-icon">🎻</span>
                        <span>Viola</span>
                    </button>
                    <button class="tuner-instrument-btn" data-instrument="cello">
                        <span class="instrument-icon">🎻</span>
                        <span>Cello</span>
                    </button>
                    <button class="tuner-instrument-btn" data-instrument="bass">
                        <span class="instrument-icon">🎸</span>
                        <span>Bass</span>
                    </button>
                </div>

                <div class="tuner-display">
                    <div class="note-reference" id="tuner-reference">
                        <span class="reference-label">Target:</span>
                        <span class="reference-note">--</span>
                    </div>

                    <div class="needle-gauge-container" id="needle-gauge-container">
                        <div class="needle-gauge">
                            <div class="gauge-arc"></div>
                            <div class="gauge-markings">
                                <span class="marking flat">-50</span>
                                <span class="marking flat">-25</span>
                                <span class="marking center">0</span>
                                <span class="marking sharp">+25</span>
                                <span class="marking sharp">+50</span>
                            </div>
                            <div class="needle" id="tuner-needle">
                                <div class="needle-glow"></div>
                            </div>
                            <div class="gauge-center-mark"></div>
                        </div>
                    </div>

                    <div class="current-note-display">
                        <span class="current-note" id="tuner-current-note">--</span>
                        <span class="current-octave" id="tuner-current-octave"></span>
                    </div>

                    <div class="pitch-feedback" id="pitch-feedback">
                        <span class="feedback-text">Waiting for input...</span>
                    </div>

                    <div class="cents-display" id="tuner-cents">
                        <span class="cents-value">0</span>
                        <span class="cents-unit">cents</span>
                    </div>

                    <div class="frequency-display" id="tuner-frequency">
                        <span class="frequency-value">--</span>
                        <span class="frequency-unit">Hz</span>
                    </div>
                </div>

                <div class="tuner-controls">
                    <button class="tuner-start-btn" id="tuner-start-btn">
                        <svg viewBox="0 0 24 24" fill="currentColor" class="start-icon">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        <svg viewBox="0 0 24 24" fill="currentColor" class="stop-icon" style="display: none;">
                            <rect x="6" y="4" width="4" height="16"/>
                            <rect x="14" y="4" width="4" height="16"/>
                        </svg>
                        <span class="btn-text">Start Tuner</span>
                    </button>
                </div>

                <div class="tuner-open-strings" id="tuner-open-strings">
                    <span class="open-strings-label">Open Strings:</span>
                    <div class="open-strings-list" id="open-strings-list">
                        <!-- Populated based on instrument -->
                    </div>
                </div>

                <div class="tuner-status" id="tuner-status">
                    <span class="status-indicator"></span>
                    <span class="status-text">Microphone access required</span>
                </div>
            </div>
        `;

        this.updateOpenStrings();
    }

    bindEvents() {
        // Instrument selection
        this.container.querySelectorAll('.tuner-instrument-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const instrument = e.currentTarget.dataset.instrument;
                this.selectInstrument(instrument);
            });
        });

        // Start/Stop button
        const startBtn = this.container.querySelector('#tuner-start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.toggleTuner());
        }
    }

    updateOpenStrings() {
        const listEl = this.container.querySelector('#open-strings-list');
        if (!listEl) return;

        const strings = this.instrumentTuning[this.selectedInstrument]?.openStrings || [];
        listEl.innerHTML = strings.map(note => `
            <span class="open-string-note" data-note="${note}">${note}</span>
        `).join('');
    }

    selectInstrument(instrument) {
        // Update buttons
        this.container.querySelectorAll('.tuner-instrument-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.instrument === instrument);
        });

        this.selectedInstrument = instrument;
        this.updateOpenStrings();

        // Update pitch detector range if available
        if (this.pitchDetector) {
            const range = this.pitchDetector.getInstrumentRange(instrument);
            this.pitchDetector.minFrequency = range.min;
            this.pitchDetector.maxFrequency = range.max;
        }
    }

    async toggleTuner() {
        if (this.isActive) {
            this.stop();
        } else {
            await this.start();
        }
    }

    async start() {
        if (!this.audioEngine) {
            this.audioEngine = new AudioEngine();
            await this.audioEngine.init();
        }

        try {
            await this.audioEngine.requestMicrophoneAccess();
        } catch (error) {
            this.updateStatus('Microphone access denied', 'error');
            return;
        }

        if (!this.pitchDetector) {
            this.pitchDetector = new PitchDetector();
        }

        // Set instrument range
        const range = this.pitchDetector.getInstrumentRange(this.selectedInstrument);
        this.pitchDetector.minFrequency = range.min;
        this.pitchDetector.maxFrequency = range.max;
        this.pitchDetector.confidenceThreshold = this.confidenceThreshold;

        this.isActive = true;
        this.updateUIState(true);
        this.updateStatus('Listening...', 'active');

        // Start audio capture
        this.audioEngine.startCapture((data) => {
            this.processAudio(data);
        }, 50);
    }

    stop() {
        this.isActive = false;

        if (this.audioEngine) {
            this.audioEngine.stopListening();
        }

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        this.updateUIState(false);
        this.updateStatus('Tap Start to begin', 'inactive');

        // Reset display
        this.resetDisplay();
    }

    processAudio(data) {
        if (!data.timeData) return;

        // Check audio level - ignore if too quiet
        if (data.level < 0.01) {
            this.showWaitingState();
            return;
        }

        // Detect pitch
        this.pitchDetector.sampleRate = data.sampleRate;
        this.pitchDetector.bufferSize = data.bufferSize;

        const result = this.pitchDetector.process(data.timeData);

        if (result && result.confidence >= this.confidenceThreshold) {
            this.currentNote = result;

            // Calculate cents from nearest note
            const nearestNote = this.getNearestNote(result.frequency);
            this.centsDeviation = this.pitchDetector.centsDeviation(result.frequency, nearestNote.frequency);
            this.targetNote = nearestNote;

            // Smooth the cents value for animation
            this.smoothedCents = this.smoothedCents * 0.7 + this.centsDeviation * 0.3;

            // Use raw cents for color/feedback, smoothed cents for needle animation
            this.updateDisplay(result, this.centsDeviation, this.smoothedCents);
        } else {
            this.showWaitingState();
        }
    }

    getNearestNote(frequency) {
        const midi = 12 * Math.log2(frequency / 440) + 69;
        const roundedMidi = Math.round(midi);
        const noteFrequency = 440 * Math.pow(2, (roundedMidi - 69) / 12);

        const noteIndex = roundedMidi % 12;
        const octave = Math.floor(roundedMidi / 12) - 1;

        return {
            midi: roundedMidi,
            name: this.noteNames[noteIndex],
            octave: octave,
            frequency: noteFrequency
        };
    }

    updateDisplay(note, cents, smoothedCents) {
        // Update note display
        const noteEl = this.container.querySelector('#tuner-current-note');
        const octaveEl = this.container.querySelector('#tuner-current-octave');

        if (noteEl) noteEl.textContent = note.name || '--';
        if (octaveEl) octaveEl.textContent = note.octave !== undefined ? note.octave : '';

        // Update frequency display
        const freqEl = this.container.querySelector('.frequency-value');
        if (freqEl) freqEl.textContent = note.frequency ? note.frequency.toFixed(1) : '--';

        // Update cents display (show raw cents)
        const centsEl = this.container.querySelector('.cents-value');
        if (centsEl) centsEl.textContent = cents > 0 ? `+${Math.round(cents)}` : Math.round(cents);

        // Update target note display
        if (this.targetNote) {
            const refNoteEl = this.container.querySelector('.reference-note');
            if (refNoteEl) refNoteEl.textContent = `${this.targetNote.name}${this.targetNote.octave}`;
        }

        // Update needle rotation using smoothed cents for smoother animation
        const needle = this.container.querySelector('#tuner-needle');
        if (needle) {
            const centsForNeedle = smoothedCents !== undefined ? smoothedCents : cents;
            // Clamp cents to -50 to +50 range for display
            const clampedCents = Math.max(-50, Math.min(50, centsForNeedle));
            const rotation = clampedCents * 1.8; // 180 degrees = 100 cents
            needle.style.transform = `rotate(${rotation}deg)`;
        }

        // Update feedback colors using raw cents for correct state transitions
        this.updateFeedback(cents);
    }

    updateFeedback(cents) {
        const feedbackEl = this.container.querySelector('#pitch-feedback');
        const centsDisplay = this.container.querySelector('#tuner-cents');
        const needleGlow = this.container.querySelector('.needle-glow');

        if (!feedbackEl) return;

        const absCents = Math.abs(cents);

        // Remove existing state classes
        feedbackEl.classList.remove('in-tune', 'sharp', 'flat', 'slight-sharp', 'slight-flat', 'waiting');
        if (centsDisplay) centsDisplay.classList.remove('emerald', 'crimson', 'amber');

        if (absCents <= 10) {
            // In tune - Emerald
            feedbackEl.classList.add('in-tune');
            feedbackEl.querySelector('.feedback-text').textContent = 'In Tune';
            if (centsDisplay) centsDisplay.classList.add('emerald');
            if (needleGlow) needleGlow.style.background = 'var(--success-light)';

            // Hide needle when in tune
            const needleContainer = this.container.querySelector('#needle-gauge-container');
            if (needleContainer) needleContainer.classList.remove('visible');
        } else if (absCents <= 30) {
            // Slight deviation - Polished Amber (10-30 cents)
            if (cents > 0) {
                feedbackEl.classList.add('slight-sharp');
                feedbackEl.querySelector('.feedback-text').textContent = 'Slightly Sharp';
            } else {
                feedbackEl.classList.add('slight-flat');
                feedbackEl.querySelector('.feedback-text').textContent = 'Slightly Flat';
            }
            if (centsDisplay) centsDisplay.classList.add('amber');
            if (needleGlow) needleGlow.style.background = 'var(--primary-light)';

            // Show needle gauge for slight deviation
            const needleContainer = this.container.querySelector('#needle-gauge-container');
            if (needleContainer) needleContainer.classList.add('visible');
        } else if (cents > 30) {
            // Significant sharp - Crimson
            feedbackEl.classList.add('sharp');
            feedbackEl.querySelector('.feedback-text').textContent = 'Sharp';
            if (centsDisplay) centsDisplay.classList.add('crimson');
            if (needleGlow) needleGlow.style.background = 'var(--error-light)';

            // Show needle gauge
            const needleContainer = this.container.querySelector('#needle-gauge-container');
            if (needleContainer) needleContainer.classList.add('visible');
        } else {
            // Significant flat - Crimson
            feedbackEl.classList.add('flat');
            feedbackEl.querySelector('.feedback-text').textContent = 'Flat';
            if (centsDisplay) centsDisplay.classList.add('crimson');
            if (needleGlow) needleGlow.style.background = 'var(--error-light)';

            // Show needle gauge
            const needleContainer = this.container.querySelector('#needle-gauge-container');
            if (needleContainer) needleContainer.classList.add('visible');
        }
    }

    showWaitingState() {
        const feedbackEl = this.container.querySelector('#pitch-feedback');
        if (feedbackEl) {
            feedbackEl.classList.remove('in-tune', 'sharp', 'flat', 'slight-sharp', 'slight-flat');
            feedbackEl.classList.add('waiting');
            feedbackEl.querySelector('.feedback-text').textContent = 'Play a note...';
        }

        // Hide needle gauge
        const needleContainer = this.container.querySelector('#needle-gauge-container');
        if (needleContainer) needleContainer.classList.remove('visible');
    }

    resetDisplay() {
        const noteEl = this.container.querySelector('#tuner-current-note');
        const octaveEl = this.container.querySelector('#tuner-current-octave');
        const freqEl = this.container.querySelector('.frequency-value');
        const centsEl = this.container.querySelector('.cents-value');
        const refNoteEl = this.container.querySelector('.reference-note');
        const feedbackEl = this.container.querySelector('#pitch-feedback');
        const needleContainer = this.container.querySelector('#needle-gauge-container');
        const needle = this.container.querySelector('#tuner-needle');

        if (noteEl) noteEl.textContent = '--';
        if (octaveEl) octaveEl.textContent = '';
        if (freqEl) freqEl.textContent = '--';
        if (centsEl) centsEl.textContent = '0';
        if (refNoteEl) refNoteEl.textContent = '--';

        if (feedbackEl) {
            feedbackEl.classList.remove('in-tune', 'sharp', 'flat', 'slight-sharp', 'slight-flat');
            feedbackEl.classList.add('waiting');
            feedbackEl.querySelector('.feedback-text').textContent = 'Waiting for input...';
        }

        if (needleContainer) needleContainer.classList.remove('visible');
        if (needle) needle.style.transform = 'rotate(0deg)';
    }

    updateUIState(isActive) {
        const btn = this.container.querySelector('#tuner-start-btn');
        if (!btn) return;

        const startIcon = btn.querySelector('.start-icon');
        const stopIcon = btn.querySelector('.stop-icon');
        const btnText = btn.querySelector('.btn-text');

        if (isActive) {
            btn.classList.add('active');
            if (startIcon) startIcon.style.display = 'none';
            if (stopIcon) stopIcon.style.display = 'block';
            if (btnText) btnText.textContent = 'Stop Tuner';
        } else {
            btn.classList.remove('active');
            if (startIcon) startIcon.style.display = 'block';
            if (stopIcon) stopIcon.style.display = 'none';
            if (btnText) btnText.textContent = 'Start Tuner';
        }
    }

    updateStatus(message, status) {
        const statusEl = this.container.querySelector('#tuner-status');
        if (!statusEl) return;

        const indicator = statusEl.querySelector('.status-indicator');
        const text = statusEl.querySelector('.status-text');

        statusEl.classList.remove('active', 'error', 'inactive');
        statusEl.classList.add(status);

        if (text) text.textContent = message;
    }

    setConfidenceThreshold(value) {
        this.confidenceThreshold = value;
        if (this.pitchDetector) {
            this.pitchDetector.confidenceThreshold = value;
        }
    }

    destroy() {
        this.stop();
        this.container.innerHTML = '';
    }
}

// Export for use in other modules
window.PrecisionTuner = PrecisionTuner;
