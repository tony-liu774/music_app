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

/**
 * Polyphonic Pitch Detector - for double stops and chords
 * Uses spectral analysis and harmonic filtering to detect multiple notes
 */
class PolyphonicPitchDetector {
    constructor() {
        this.sampleRate = 44100;
        this.bufferSize = 2048;
        this.minFrequency = 27.5;  // A0
        this.maxFrequency = 4186; // C8

        // Detection parameters
        this.confidenceThreshold = 0.7;
        this.maxVoices = 2; // Support double stops
        this.minAmplitude = 0.01;

        // Note mapping
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.a4Frequency = 440;
        this.a4MIDI = 69;

        // For FFT analysis
        this.fftSize = 4096;
    }

    configure(options = {}) {
        if (options.sampleRate) this.sampleRate = options.sampleRate;
        if (options.bufferSize) this.bufferSize = options.bufferSize;
        if (options.maxVoices) this.maxVoices = options.maxVoices;
        if (options.confidenceThreshold) this.confidenceThreshold = options.confidenceThreshold;
        if (options.minFrequency) this.minFrequency = options.minFrequency;
        if (options.maxFrequency) this.maxFrequency = options.maxFrequency;
    }

    /**
     * Detect multiple fundamental frequencies in the audio buffer
     * Uses spectral peak detection with harmonic filtering
     * @param {Float32Array} buffer - Audio samples
     * @returns {Array} - Array of { frequency, confidence, amplitude }
     */
    detectPolyphonic(buffer) {
        if (!buffer || buffer.length < this.bufferSize) {
            return [];
        }

        // Compute FFT
        const fft = this.computeFFT(buffer);
        const frequencies = this.computeFrequencyBins();

        // Find spectral peaks
        const peaks = this.findSpectralPeaks(fft, frequencies);

        // Filter peaks and remove harmonics
        const fundamentalFrequencies = this.filterHarmonics(peaks);

        // Convert to note information
        const notes = fundamentalFrequencies
            .filter(f => f.confidence >= this.confidenceThreshold)
            .map(f => ({
                ...this.frequencyToNote(f.frequency),
                frequency: f.frequency,
                confidence: f.confidence,
                amplitude: f.amplitude,
                centsDeviation: 0
            }))
            .slice(0, this.maxVoices);

        return notes;
    }

    /**
     * Compute FFT of the audio buffer (simplified version)
     */
    computeFFT(buffer) {
        const numBins = this.fftSize / 2;
        const fftData = new Float32Array(numBins);

        const minBin = Math.floor(this.minFrequency * this.fftSize / this.sampleRate);
        const maxBin = Math.floor(this.maxFrequency * this.fftSize / this.sampleRate);

        for (let k = minBin; k < maxBin && k < numBins; k++) {
            let real = 0;
            let imag = 0;

            for (let n = 0; n < buffer.length; n++) {
                const angle = (2 * Math.PI * k * n) / this.fftSize;
                real += buffer[n] * Math.cos(angle);
                imag -= buffer[n] * Math.sin(angle);
            }

            fftData[k] = Math.sqrt(real * real + imag * imag) / buffer.length;
        }

        return fftData;
    }

    /**
     * Compute frequency values for each FFT bin
     */
    computeFrequencyBins() {
        const numBins = this.fftSize / 2;
        const frequencies = new Float32Array(numBins);

        for (let i = 0; i < numBins; i++) {
            frequencies[i] = i * this.sampleRate / this.fftSize;
        }

        return frequencies;
    }

    /**
     * Find peaks in the spectral data
     */
    findSpectralPeaks(fftData, frequencies) {
        const peaks = [];
        const minBin = Math.floor(this.minFrequency * this.fftSize / this.sampleRate);
        const maxBin = Math.floor(this.maxFrequency * this.fftSize / this.sampleRate);

        for (let i = minBin + 1; i < maxBin - 1; i++) {
            if (fftData[i] > fftData[i - 1] && fftData[i] > fftData[i + 1]) {
                const frequency = frequencies[i];
                const amplitude = fftData[i];

                if (amplitude > this.minAmplitude) {
                    // Parabolic interpolation
                    const alpha = fftData[i - 1];
                    const beta = fftData[i];
                    const gamma = fftData[i + 1];

                    const interpolatedBin = i + 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
                    const refinedFrequency = interpolatedBin * this.sampleRate / this.fftSize;

                    peaks.push({
                        frequency: refinedFrequency,
                        amplitude: amplitude,
                        bin: i
                    });
                }
            }
        }

        peaks.sort((a, b) => b.amplitude - a.amplitude);
        return peaks;
    }

    /**
     * Filter out harmonics to identify fundamental frequencies
     */
    filterHarmonics(peaks) {
        if (peaks.length === 0) return [];
        if (peaks.length === 1) {
            return [{ ...peaks[0], confidence: this.calculateConfidence(peaks[0].amplitude, peaks[0].amplitude) }];
        }

        const fundamentals = [];
        const usedPeaks = new Set();

        for (const peak of peaks) {
            if (usedPeaks.has(peak.bin)) continue;

            let isHarmonic = false;

            for (const fund of fundamentals) {
                const ratio = peak.frequency / fund.frequency;

                for (let h = 2; h <= 5; h++) {
                    if (Math.abs(ratio - h) < 0.05) {
                        isHarmonic = true;
                        break;
                    }
                }

                if (isHarmonic) break;
            }

            if (!isHarmonic) {
                const maxAmplitude = peaks[0].amplitude;
                const confidence = this.calculateConfidence(peak.amplitude, maxAmplitude);

                fundamentals.push({
                    frequency: peak.frequency,
                    amplitude: peak.amplitude,
                    confidence: confidence
                });

                for (const otherPeak of peaks) {
                    if (usedPeaks.has(otherPeak.bin)) continue;

                    const ratio = otherPeak.frequency / peak.frequency;
                    for (let h = 2; h <= 5; h++) {
                        if (Math.abs(ratio - h) < 0.05) {
                            usedPeaks.add(otherPeak.bin);
                            break;
                        }
                    }
                }
            }

            if (fundamentals.length >= this.maxVoices) break;
        }

        return fundamentals;
    }

    /**
     * Calculate confidence based on amplitude
     */
    calculateConfidence(amplitude, maxAmplitude) {
        if (maxAmplitude === 0) return 0;
        const ratio = amplitude / maxAmplitude;
        return 0.5 + (ratio * 0.5);
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
}

/**
 * Vibrato Filter - DSP smoothing to calculate average center frequency
 * This filters out pitch variations from vibrato to get the "intended" pitch
 */
class VibratoFilter {
    constructor(options = {}) {
        this.windowSize = options.windowSize || 10;
        this.minConfidence = options.minConfidence || 0.7;

        this.frequencyHistory = [];
        this.confidenceHistory = [];
        this.timestampHistory = [];

        this.smoothedFrequency = null;
        this.smoothedCentsDeviation = null;
        this.isVibrato = false;
        this.vibratoDepth = 0;
    }

    /**
     * Add a new frequency measurement to the filter
     */
    addSample(frequency, confidence, targetFrequency = null, timestamp = Date.now()) {
        if (!frequency || confidence < this.minConfidence) {
            this.frequencyHistory.push(null);
            this.confidenceHistory.push(confidence || 0);
            this.timestampHistory.push(timestamp);
        } else {
            this.frequencyHistory.push(frequency);
            this.confidenceHistory.push(confidence);
            this.timestampHistory.push(timestamp);
        }

        while (this.frequencyHistory.length > this.windowSize) {
            this.frequencyHistory.shift();
            this.confidenceHistory.shift();
            this.timestampHistory.shift();
        }

        this.updateSmoothedValues(targetFrequency);
    }

    /**
     * Update the smoothed frequency using weighted average
     */
    updateSmoothedValues(targetFrequency = null) {
        const validFrequencies = this.frequencyHistory.filter(f => f !== null);

        if (validFrequencies.length === 0) {
            this.smoothedFrequency = null;
            this.smoothedCentsDeviation = null;
            this.isVibrato = false;
            this.vibratoDepth = 0;
            return;
        }

        let weightedSum = 0;
        let weightSum = 0;

        for (let i = 0; i < this.frequencyHistory.length; i++) {
            if (this.frequencyHistory[i] !== null) {
                const weight = (i + 1) / this.frequencyHistory.length;
                weightedSum += this.frequencyHistory[i] * weight;
                weightSum += weight;
            }
        }

        this.smoothedFrequency = weightSum > 0 ? weightedSum / weightSum : null;

        if (validFrequencies.length >= 3) {
            const stdDev = this.calculateStandardDeviation(validFrequencies);
            const meanFreq = validFrequencies.reduce((a, b) => a + b, 0) / validFrequencies;

            if (meanFreq > 0 && stdDev > 0) {
                this.vibratoDepth = Math.round(1200 * Math.log2((meanFreq + stdDev) / meanFreq));
                this.isVibrato = this.vibratoDepth >= 5 && this.vibratoDepth <= 50;
            }
        }

        if (targetFrequency && this.smoothedFrequency) {
            this.smoothedCentsDeviation = Math.round(
                1200 * Math.log2(this.smoothedFrequency / targetFrequency)
            );
        } else {
            this.smoothedCentsDeviation = null;
        }
    }

    /**
     * Calculate standard deviation
     */
    calculateStandardDeviation(values) {
        if (values.length === 0) return 0;

        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;

        return Math.sqrt(variance);
    }

    getSmoothedFrequency() {
        return this.smoothedFrequency;
    }

    getSmoothedCentsDeviation() {
        return this.smoothedCentsDeviation;
    }

    getVibratoStatus() {
        return {
            isVibrato: this.isVibrato,
            depth: this.vibratoDepth,
            smoothedFrequency: this.smoothedFrequency
        };
    }

    reset() {
        this.frequencyHistory = [];
        this.confidenceHistory = [];
        this.timestampHistory = [];
        this.smoothedFrequency = null;
        this.smoothedCentsDeviation = null;
        this.isVibrato = false;
        this.vibratoDepth = 0;
    }

    getState() {
        return {
            smoothedFrequency: this.smoothedFrequency,
            smoothedCentsDeviation: this.smoothedCentsDeviation,
            isVibrato: this.isVibrato,
            vibratoDepth: this.vibratoDepth,
            historyLength: this.frequencyHistory.length,
            validSamples: this.frequencyHistory.filter(f => f !== null).length
        };
    }
}

// Export for use in other modules
window.PolyphonicPitchDetector = PolyphonicPitchDetector;
window.VibratoFilter = VibratoFilter;