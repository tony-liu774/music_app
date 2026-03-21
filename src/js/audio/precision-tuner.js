/**
 * Precision Tuner Module
 * Real-time frequency detection with needle-style gauge display
 * Supports Violin, Viola, Cello, and Double Bass tuning
 */

class PrecisionTuner {
    constructor() {
        // Audio components
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isListening = false;

        // Pitch detection
        this.pitchDetector = new PitchDetector();
        this.sampleRate = 44100;
        this.bufferSize = 4096;

        // Tuning state
        this.currentNote = null;
        this.currentFrequency = null;
        this.centsDeviation = 0;
        this.confidence = 0;

        // Instrument configuration
        this.selectedInstrument = 'violin';
        this.instrumentRanges = {
            violin: {
                name: 'Violin',
                minFreq: 196,   // G3
                maxFreq: 2637,  // E7
                strings: [
                    { note: 'G', octave: 3, frequency: 196.00 },
                    { note: 'D', octave: 4, frequency: 293.66 },
                    { note: 'A', octave: 4, frequency: 440.00 },
                    { note: 'E', octave: 5, frequency: 659.26 }
                ]
            },
            viola: {
                name: 'Viola',
                minFreq: 130,   // C3
                maxFreq: 1319,  // E6
                strings: [
                    { note: 'C', octave: 3, frequency: 130.81 },
                    { note: 'G', octave: 3, frequency: 196.00 },
                    { note: 'D', octave: 4, frequency: 293.66 },
                    { note: 'A', octave: 4, frequency: 440.00 }
                ]
            },
            cello: {
                name: 'Cello',
                minFreq: 65,    // C2
                maxFreq: 987,   // B5
                strings: [
                    { note: 'C', octave: 2, frequency: 65.41 },
                    { note: 'G', octave: 2, frequency: 98.00 },
                    { note: 'D', octave: 3, frequency: 146.83 },
                    { note: 'A', octave: 3, frequency: 220.00 }
                ]
            },
            bass: {
                name: 'Double Bass',
                minFreq: 41,    // E1
                maxFreq: 262,   // C4
                strings: [
                    { note: 'E', octave: 1, frequency: 41.20 },
                    { note: 'A', octave: 1, frequency: 55.00 },
                    { note: 'D', octave: 2, frequency: 73.42 },
                    { note: 'G', octave: 2, frequency: 98.00 }
                ]
            }
        };

        // Reference A4 tuning (can be adjusted)
        this.referenceFrequency = 440;
        this.referenceA4MIDI = 69;

        // Callbacks
        this.onNoteDetected = null;
        this.onError = null;

        // Animation frame
        this.animationFrame = null;
        this.processInterval = null;
    }

    /**
     * Initialize the tuner
     */
    async init() {
        // Audio context will be created on user interaction
        this.pitchDetector.configure({
            sampleRate: this.sampleRate,
            bufferSize: this.bufferSize,
            confidenceThreshold: 0.80
        });

        this.setInstrument(this.selectedInstrument);
    }

    /**
     * Set the current instrument
     */
    setInstrument(instrument) {
        if (!this.instrumentRanges[instrument]) {
            instrument = 'violin';
        }

        this.selectedInstrument = instrument;
        const range = this.instrumentRanges[instrument];

        this.pitchDetector.minFrequency = range.minFreq;
        this.pitchDetector.maxFrequency = range.maxFreq;

        // Update UI
        this.updateStringDisplay();
    }

    /**
     * Get current instrument info
     */
    getInstrumentInfo() {
        return this.instrumentRanges[this.selectedInstrument];
    }

    /**
     * Update string display in UI
     */
    updateStringDisplay() {
        const strings = this.instrumentRanges[this.selectedInstrument].strings;
        const stringDisplay = document.getElementById('tuner-strings');

        if (stringDisplay) {
            stringDisplay.innerHTML = strings.map((string, index) => `
                <div class="tuner-string" data-string="${index}">
                    <span class="string-note">${string.note}${string.octave}</span>
                    <span class="string-freq">${string.frequency.toFixed(1)} Hz</span>
                </div>
            `).join('');
        }
    }

    /**
     * Start listening to microphone
     */
    async startListening() {
        if (this.isListening) return;

        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate
            });

            // Create analyser
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.bufferSize;
            this.analyser.smoothingTimeConstant = 0.8;

            // Connect microphone
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);

            this.isListening = true;

            // Start processing
            this.processAudio();

            return true;
        } catch (error) {
            console.error('Failed to start tuner:', error);
            if (this.onError) {
                this.onError(error);
            }
            return false;
        }
    }

    /**
     * Stop listening to microphone
     */
    stopListening() {
        if (!this.isListening) return;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        if (this.processInterval) {
            clearInterval(this.processInterval);
        }

        if (this.microphone) {
            this.microphone.disconnect();
        }

        if (this.audioContext) {
            this.audioContext.close();
        }

        this.isListening = false;
    }

    /**
     * Process audio data
     */
    processAudio() {
        if (!this.isListening || !this.analyser) return;

        const bufferLength = this.analyser.fftSize;
        const timeData = new Float32Array(bufferLength);
        this.analyser.getFloatTimeDomainData(timeData);

        // Check audio level
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += timeData[i] * timeData[i];
        }
        const rms = Math.sqrt(sum / bufferLength);

        // Only process if there's enough signal
        if (rms > 0.01) {
            this.pitchDetector.sampleRate = this.audioContext.sampleRate;
            this.pitchDetector.bufferSize = bufferLength;

            const result = this.pitchDetector.process(timeData);

            if (result && result.frequency) {
                this.currentNote = result;
                this.currentFrequency = result.frequency;
                this.confidence = result.confidence;

                // Find closest note and calculate cents deviation
                const closestNote = this.findClosestNote(result.frequency);
                this.centsDeviation = this.pitchDetector.centsDeviation(
                    result.frequency,
                    closestNote.frequency
                );

                // Notify callback
                if (this.onNoteDetected) {
                    this.onNoteDetected({
                        note: result,
                        closestNote: closestNote,
                        centsDeviation: this.centsDeviation,
                        frequency: result.frequency,
                        confidence: result.confidence,
                        rms: rms
                    });
                }
            }
        }

        // Continue processing
        this.animationFrame = requestAnimationFrame(() => this.processAudio());
    }

    /**
     * Find the closest note to a given frequency
     */
    findClosestNote(frequency) {
        const midi = Math.round(12 * Math.log2(frequency / this.referenceFrequency) + this.referenceA4MIDI);
        const noteFrequency = this.referenceFrequency * Math.pow(2, (midi - this.referenceA4MIDI) / 12);

        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteIndex = midi % 12;
        const octave = Math.floor(midi / 12) - 1;

        return {
            name: noteNames[noteIndex],
            octave: octave,
            midi: midi,
            frequency: noteFrequency
        };
    }

    /**
     * Get cents deviation for a target note
     */
    getCentsDeviation(targetFrequency) {
        if (!this.currentFrequency) return 0;
        return this.pitchDetector.centsDeviation(this.currentFrequency, targetFrequency);
    }

    /**
     * Set reference A4 frequency
     */
    setReferenceFrequency(freq) {
        this.referenceFrequency = freq;
        this.referenceA4MIDI = Math.round(12 * Math.log2(freq / 440) + 69);
        this.pitchDetector.a4Frequency = freq;
        this.pitchDetector.a4MIDI = this.referenceA4MIDI;
    }

    /**
     * Get all supported instruments
     */
    getSupportedInstruments() {
        return Object.keys(this.instrumentRanges).map(key => ({
            id: key,
            name: this.instrumentRanges[key].name,
            strings: this.instrumentRanges[key].strings
        }));
    }
}

// Export for use
window.PrecisionTuner = PrecisionTuner;
