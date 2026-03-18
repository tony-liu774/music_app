/**
 * Pitch Detector - YIN/pYIN Algorithm Implementation
 * Monophonic pitch detection for real-time note identification
 */

class PitchDetector {
    constructor() {
        // Audio parameters
        this.sampleRate = 44100;
        this.bufferSize = 2048;
        this.hopSize = 512;
        this.minFrequency = 27.5;  // A0
        this.maxFrequency = 4186; // C8

        // Detection parameters
        this.confidenceThreshold = 0.85;
        this.threshold = 0.15; // YIN threshold

        // Note mapping
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.a4Frequency = 440;
        this.a4MIDI = 69;
    }

    configure(options = {}) {
        if (options.sampleRate) this.sampleRate = options.sampleRate;
        if (options.bufferSize) this.bufferSize = options.bufferSize;
        if (options.hopSize) this.hopSize = options.hopSize;
        if (options.confidenceThreshold) this.confidenceThreshold = options.confidenceThreshold;
        if (options.minFrequency) this.minFrequency = options.minFrequency;
        if (options.maxFrequency) this.maxFrequency = options.maxFrequency;
        if (options.threshold) this.threshold = options.threshold;
    }

    /**
     * YIN Pitch Detection Algorithm
     * @param {Float32Array} buffer - Audio samples
     * @returns {Object} - { frequency, confidence }
     */
    detect(buffer) {
        if (!buffer || buffer.length < this.bufferSize) {
            return { frequency: null, confidence: 0 };
        }

        // Calculate minimum and maximum tau values
        const minTau = Math.floor(this.sampleRate / this.maxFrequency);
        const maxTau = Math.floor(this.sampleRate / this.minFrequency);

        // Step 1: Calculate difference function
        const diff = this.computeDifferenceFunction(buffer, minTau, maxTau);

        // Step 2: Cumulative mean normalized difference function
        const cmndf = this.computeCMNDF(diff, minTau, maxTau);

        // Step 3: Absolute threshold
        const tau = this.findTau(cmndf, minTau, maxTau);

        if (tau === null) {
            return { frequency: null, confidence: 0 };
        }

        // Step 4: Parabolic interpolation for better precision
        const frequency = this.sampleRate / this.interpolateTau(buffer, tau);

        // Calculate confidence (1 - d'[tau])
        const confidence = 1 - cmndf[tau - minTau];

        // Validate frequency range
        if (frequency < this.minFrequency || frequency > this.maxFrequency) {
            return { frequency: null, confidence: 0 };
        }

        return { frequency, confidence };
    }

    /**
     * Compute the difference function
     */
    computeDifferenceFunction(buffer, minTau, maxTau) {
        const tauRange = maxTau - minTau;
        const diff = new Float32Array(tauRange);

        for (let tau = minTau; tau < maxTau; tau++) {
            let sum = 0;
            for (let j = 0; j < this.bufferSize; j++) {
                const delta = buffer[j] - buffer[j + tau];
                sum += delta * delta;
            }
            diff[tau - minTau] = sum;
        }

        return diff;
    }

    /**
     * Compute Cumulative Mean Normalized Difference Function
     */
    computeCMNDF(diff, minTau, maxTau) {
        const cmndf = new Float32Array(maxTau - minTau);
        cmndf[0] = 1;

        let runningSum = 0;

        for (let tau = 1; tau < cmndf.length; tau++) {
            runningSum += diff[tau];
            if (runningSum !== 0) {
                cmndf[tau] = diff[tau] * tau / runningSum;
            } else {
                cmndf[tau] = 1;
            }
        }

        return cmndf;
    }

    /**
     * Find the tau value with minimum CMNDF below threshold
     */
    findTau(cmndf, minTau, maxTau) {
        let tau = null;
        let minValue = 1;

        for (let i = 0; i < cmndf.length; i++) {
            if (cmndf[i] < this.threshold) {
                // Find first local minimum after threshold crossing
                while (i + 1 < cmndf.length && cmndf[i + 1] < cmndf[i]) {
                    i++;
                }

                if (cmndf[i] < minValue) {
                    minValue = cmndf[i];
                    tau = minTau + i;
                }
                break;
            }

            if (cmndf[i] < minValue) {
                minValue = cmndf[i];
                tau = minTau + i;
            }
        }

        return tau;
    }

    /**
     * Parabolic interpolation for better tau precision
     */
    interpolateTau(buffer, tau) {
        if (tau <= 0 || tau >= this.bufferSize - 1) {
            return tau;
        }

        // Compute difference function for three points
        const s1 = this.diffPoint(buffer, tau - 1);
        const s2 = this.diffPoint(buffer, tau);
        const s3 = this.diffPoint(buffer, tau + 1);

        // Parabolic interpolation
        const adjust = (s3 - s1) / (2 * (2 * s2 - s3 - s1));

        return tau + adjust;
    }

    diffPoint(buffer, tau) {
        let sum = 0;
        for (let j = 0; j < this.bufferSize; j++) {
            const delta = buffer[j] - buffer[j + tau];
            sum += delta * delta;
        }
        return sum;
    }

    /**
     * Convert frequency to MIDI note number
     */
    frequencyToMIDI(frequency) {
        if (!frequency || frequency <= 0) return null;
        return Math.round(12 * Math.log2(frequency / this.a4Frequency) + this.a4MIDI);
    }

    /**
     * Convert MIDI note to note name and octave
     */
    midiToNoteName(midi) {
        if (midi === null || midi === undefined) return null;

        const octave = Math.floor(midi / 12) - 1;
        const noteIndex = midi % 12;

        return {
            name: this.noteNames[noteIndex],
            octave: octave,
            midi: midi
        };
    }

    /**
     * Convert frequency to note name with octave
     */
    frequencyToNote(frequency) {
        const midi = this.frequencyToMIDI(frequency);
        return this.midiToNoteName(midi);
    }

    /**
     * Calculate cents deviation from target frequency
     */
    centsDeviation(observedFreq, targetFreq) {
        if (!observedFreq || !targetFreq || observedFreq <= 0 || targetFreq <= 0) {
            return 0;
        }
        return Math.round(1200 * Math.log2(observedFreq / targetFreq));
    }

    /**
     * Get target frequency for a given MIDI note
     */
    midiToFrequency(midi) {
        return this.a4Frequency * Math.pow(2, (midi - this.a4MIDI) / 12);
    }

    /**
     * Process audio buffer and return note information
     */
    process(buffer) {
        const result = this.detect(buffer);

        if (!result.frequency || result.confidence < this.confidenceThreshold) {
            return null;
        }

        const noteInfo = this.frequencyToNote(result.frequency);

        return {
            ...noteInfo,
            frequency: result.frequency,
            confidence: result.confidence,
            centsDeviation: 0 // Will be set when comparing to expected note
        };
    }

    /**
     * Get frequency range for a specific instrument
     */
    getInstrumentRange(instrument) {
        const ranges = {
            violin: { min: 196, max: 2637 },    // G3 to E7
            viola: { min: 130, max: 1319 },    // C3 to E6
            cello: { min: 65, max: 987 },      // C2 to B5
            bass: { min: 41, max: 262 }        // E1 to C4
        };

        return ranges[instrument] || ranges.violin;
    }
}

// pYIN variant - optimized version of YIN
class PYinDetector extends PitchDetector {
    constructor() {
        super();
        this.threshold = 0.5; // pYIN uses a higher threshold
    }

    detect(buffer) {
        // pYIN uses a two-stage approach
        // Stage 1: Coarse detection with high threshold
        const result = super.detect(buffer);

        if (!result.frequency) {
            return { frequency: null, confidence: 0 };
        }

        // Stage 2: Refinement - could add more sophisticated processing here
        // For now, return the YIN result
        return result;
    }
}

// Export for use in other modules
window.PitchDetector = PitchDetector;
window.PYinDetector = PYinDetector;