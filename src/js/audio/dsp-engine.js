/**
 * Core DSP Engine - High-Performance Pitch Detection Pipeline
 *
 * Architecture: Web Audio API → ScriptProcessorNode/AudioWorklet → DSP Pipeline
 * Strict latency budget: <30ms from microphone input to visual UI update
 *
 * Pipeline stages:
 *   1. PYINPitchDetector  - Probabilistic YIN with multi-candidate thresholding
 *   2. SympatheticResonanceFilter - Filters sympathetic vibrations from adjacent strings
 *   3. PolyphonicAnalyzer - Detects double stops (two simultaneous notes)
 *   4. VibratoSmoother   - 200ms moving average to find true center frequency
 *   5. SessionLogWriter   - Continuous JSON deviation logging
 *   6. PerformanceMonitor - Latency and underrun tracking
 */

// ──────────────────────────────────────────────────────────────────────────────
// PYINPitchDetector - Proper pYIN with probabilistic multi-candidate approach
// ──────────────────────────────────────────────────────────────────────────────

class PYINPitchDetector {
    constructor(options = {}) {
        this.sampleRate = options.sampleRate || 44100;
        this.bufferSize = options.bufferSize || 2048;
        this.minFrequency = options.minFrequency || 27.5;
        this.maxFrequency = options.maxFrequency || 4186;

        // pYIN-specific: multiple threshold candidates
        this.thresholdDistribution = options.thresholdDistribution || [
            0.01, 0.02, 0.03, 0.05, 0.08, 0.10, 0.15, 0.20, 0.30, 0.50
        ];

        // Beta distribution parameters for threshold weighting
        this.betaAlpha = options.betaAlpha || 2;
        this.betaBeta = options.betaBeta || 18;

        // Pitch tracking state for HMM-like smoothing
        this.pitchHistory = [];
        this.maxHistoryLength = options.maxHistoryLength || 8;
        this.transitionSemitonePenalty = options.transitionSemitonePenalty || 0.5;

        // Note mapping
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.a4Frequency = 440;
        this.a4MIDI = 69;
    }

    configure(options = {}) {
        if (options.sampleRate !== undefined) this.sampleRate = options.sampleRate;
        if (options.bufferSize !== undefined) this.bufferSize = options.bufferSize;
        if (options.minFrequency !== undefined) this.minFrequency = options.minFrequency;
        if (options.maxFrequency !== undefined) this.maxFrequency = options.maxFrequency;
    }

    /**
     * pYIN detection: evaluates multiple threshold candidates, weights by
     * beta distribution, and selects the most probable pitch.
     * @param {Float32Array} buffer - Audio samples
     * @returns {{ frequency: number|null, confidence: number, candidates: Array }}
     */
    detect(buffer) {
        if (!buffer || buffer.length < this.bufferSize) {
            return { frequency: null, confidence: 0, candidates: [] };
        }

        const minTau = Math.max(2, Math.floor(this.sampleRate / this.maxFrequency));
        const maxTau = Math.min(
            buffer.length - 1,
            Math.floor(this.sampleRate / this.minFrequency)
        );

        if (minTau >= maxTau) {
            return { frequency: null, confidence: 0, candidates: [] };
        }

        // Step 1: Difference function
        const diff = this._computeDifference(buffer, minTau, maxTau);
        // Step 2: CMNDF
        const cmndf = this._computeCMNDF(diff, maxTau - minTau);

        // Step 3: Multi-candidate thresholding (core pYIN innovation)
        const candidates = this._extractCandidates(cmndf, minTau, maxTau, buffer);

        if (candidates.length === 0) {
            return { frequency: null, confidence: 0, candidates: [] };
        }

        // Step 4: Weight candidates using beta distribution
        const weighted = this._weightCandidates(candidates);

        // Step 5: HMM-based temporal smoothing
        const best = this._selectBestCandidate(weighted);

        // Track history for temporal smoothing
        if (best.frequency) {
            this.pitchHistory.push(best.frequency);
            if (this.pitchHistory.length > this.maxHistoryLength) {
                this.pitchHistory.shift();
            }
        }

        return best;
    }

    _computeDifference(buffer, minTau, maxTau) {
        const length = maxTau - minTau;
        const diff = new Float32Array(length);
        const windowSize = Math.min(this.bufferSize, buffer.length - maxTau);

        for (let i = 0; i < length; i++) {
            const tau = minTau + i;
            let sum = 0;
            for (let j = 0; j < windowSize; j++) {
                const delta = buffer[j] - buffer[j + tau];
                sum += delta * delta;
            }
            diff[i] = sum;
        }

        return diff;
    }

    _computeCMNDF(diff, length) {
        const cmndf = new Float32Array(length);
        cmndf[0] = 1;
        let runningSum = 0;

        for (let i = 1; i < length; i++) {
            runningSum += diff[i];
            cmndf[i] = runningSum !== 0 ? (diff[i] * i) / runningSum : 1;
        }

        return cmndf;
    }

    /**
     * Extract pitch candidates at multiple threshold levels.
     * For each threshold, find the first local minimum of CMNDF below it.
     */
    _extractCandidates(cmndf, minTau, maxTau, buffer) {
        const candidates = [];
        const seen = new Set();

        for (const threshold of this.thresholdDistribution) {
            for (let i = 1; i < cmndf.length - 1; i++) {
                if (cmndf[i] < threshold) {
                    // Walk to local minimum
                    while (i + 1 < cmndf.length - 1 && cmndf[i + 1] < cmndf[i]) {
                        i++;
                    }

                    const tau = minTau + i;
                    // Deduplicate by tau value
                    if (!seen.has(tau)) {
                        seen.add(tau);

                        // Parabolic interpolation for sub-sample accuracy
                        const refinedTau = this._parabolicInterpolation(cmndf, i);
                        const frequency = this.sampleRate / (minTau + refinedTau);

                        if (frequency >= this.minFrequency && frequency <= this.maxFrequency) {
                            candidates.push({
                                frequency,
                                tau: minTau + refinedTau,
                                cmndfValue: cmndf[i],
                                threshold,
                                confidence: 1 - cmndf[i]
                            });
                        }
                    }
                    break; // Only first minimum per threshold
                }
            }
        }

        return candidates;
    }

    _parabolicInterpolation(cmndf, index) {
        if (index <= 0 || index >= cmndf.length - 1) return index;

        const alpha = cmndf[index - 1];
        const beta = cmndf[index];
        const gamma = cmndf[index + 1];
        const denominator = 2 * (2 * beta - alpha - gamma);

        if (Math.abs(denominator) < 1e-12) return index;

        return index + (alpha - gamma) / denominator;
    }

    /**
     * Weight candidates using a beta distribution prior.
     * Lower thresholds are more likely to yield correct pitches.
     */
    _weightCandidates(candidates) {
        if (candidates.length === 0) return [];

        return candidates.map(c => {
            // Beta distribution weight: favor low CMNDF values
            const x = Math.max(0.001, Math.min(0.999, c.cmndfValue));
            const betaWeight = this._betaPDF(x, this.betaAlpha, this.betaBeta);

            // Temporal continuity bonus
            let continuityBonus = 1.0;
            if (this.pitchHistory.length > 0) {
                const lastFreq = this.pitchHistory[this.pitchHistory.length - 1];
                const semitones = Math.abs(12 * Math.log2(c.frequency / lastFreq));
                continuityBonus = Math.exp(-semitones * this.transitionSemitonePenalty);
            }

            return {
                ...c,
                weight: betaWeight * continuityBonus * c.confidence
            };
        }).sort((a, b) => b.weight - a.weight);
    }

    _betaPDF(x, alpha, beta) {
        // Simplified beta PDF (unnormalized, sufficient for comparison)
        if (x <= 0 || x >= 1) return 0;
        return Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1);
    }

    /**
     * Select best candidate with temporal smoothing.
     */
    _selectBestCandidate(weightedCandidates) {
        if (weightedCandidates.length === 0) {
            return { frequency: null, confidence: 0, candidates: [] };
        }

        const best = weightedCandidates[0];
        return {
            frequency: best.frequency,
            confidence: best.confidence,
            candidates: weightedCandidates.slice(0, 3)
        };
    }

    frequencyToMIDI(frequency) {
        if (!frequency || frequency <= 0) return null;
        return Math.round(12 * Math.log2(frequency / this.a4Frequency) + this.a4MIDI);
    }

    midiToFrequency(midi) {
        return this.a4Frequency * Math.pow(2, (midi - this.a4MIDI) / 12);
    }

    midiToNoteName(midi) {
        if (midi === null || midi === undefined) return null;
        const octave = Math.floor(midi / 12) - 1;
        const noteIndex = ((midi % 12) + 12) % 12;
        return { name: this.noteNames[noteIndex], octave, midi };
    }

    frequencyToNote(frequency) {
        const midi = this.frequencyToMIDI(frequency);
        return this.midiToNoteName(midi);
    }

    centsDeviation(observed, target) {
        if (!observed || !target || observed <= 0 || target <= 0) return 0;
        return Math.round(1200 * Math.log2(observed / target));
    }

    reset() {
        this.pitchHistory = [];
    }
}


// ──────────────────────────────────────────────────────────────────────────────
// SympatheticResonanceFilter - Identifies and filters sympathetic string vibrations
// ──────────────────────────────────────────────────────────────────────────────

class SympatheticResonanceFilter {
    constructor(options = {}) {
        this.instrument = options.instrument || 'violin';
        this.toleranceCents = options.toleranceCents || 30;
        this.sympatheticThreshold = options.sympatheticThreshold || 0.3;

        // Open string frequencies for each instrument (standard tuning)
        this.openStrings = {
            violin: [196.00, 293.66, 440.00, 659.25],     // G3, D4, A4, E5
            viola:  [130.81, 196.00, 293.66, 440.00],      // C3, G3, D4, A4
            cello:  [65.41, 98.00, 146.83, 220.00],        // C2, G2, D3, A3
            bass:   [41.20, 55.00, 73.42, 98.00]           // E1, A1, D2, G2
        };

        this._buildResonanceTable();
    }

    setInstrument(instrument) {
        this.instrument = instrument;
        this._buildResonanceTable();
    }

    /**
     * Build a lookup of all resonance frequencies (fundamentals + harmonics)
     * that could cause sympathetic vibration on the current instrument.
     */
    _buildResonanceTable() {
        this.resonanceFrequencies = [];
        const strings = this.openStrings[this.instrument] || this.openStrings.violin;

        for (const fundamental of strings) {
            // Include harmonics up to the 8th
            for (let h = 1; h <= 8; h++) {
                this.resonanceFrequencies.push({
                    frequency: fundamental * h,
                    harmonic: h,
                    stringFrequency: fundamental,
                    isFundamental: h === 1
                });
            }
        }
    }

    /**
     * Check if a detected frequency is likely a sympathetic resonance
     * rather than the actually played note.
     * @param {number} frequency - Detected frequency
     * @param {number} amplitude - Amplitude of this detection
     * @param {number} primaryFrequency - The primary (loudest) detected pitch
     * @param {number} primaryAmplitude - Amplitude of the primary pitch
     * @returns {{ isSympathetic: boolean, resonanceSource: Object|null }}
     */
    analyze(frequency, amplitude, primaryFrequency, primaryAmplitude) {
        if (!frequency || !primaryFrequency) {
            return { isSympathetic: false, resonanceSource: null };
        }

        // If this IS the primary pitch, it's not sympathetic
        if (Math.abs(frequency - primaryFrequency) < 1) {
            return { isSympathetic: false, resonanceSource: null };
        }

        // Check if this frequency matches a resonance of the instrument strings
        for (const resonance of this.resonanceFrequencies) {
            const cents = Math.abs(1200 * Math.log2(frequency / resonance.frequency));
            if (cents <= this.toleranceCents) {
                // It matches a resonance frequency. Check amplitude ratio.
                const amplitudeRatio = primaryAmplitude > 0
                    ? amplitude / primaryAmplitude
                    : 1;

                // Sympathetic vibrations are typically much quieter than the primary
                if (amplitudeRatio < this.sympatheticThreshold) {
                    return {
                        isSympathetic: true,
                        resonanceSource: {
                            stringFrequency: resonance.stringFrequency,
                            harmonic: resonance.harmonic,
                            matchedFrequency: resonance.frequency,
                            amplitudeRatio
                        }
                    };
                }
            }
        }

        return { isSympathetic: false, resonanceSource: null };
    }

    /**
     * Filter an array of detected notes, removing sympathetic resonances.
     * @param {Array} notes - Array of { frequency, amplitude|confidence, ... }
     * @returns {Array} Filtered notes with sympathetic ones removed
     */
    filter(notes) {
        if (!notes || notes.length <= 1) return notes || [];

        // Sort by amplitude/confidence (primary pitch is loudest)
        const sorted = [...notes].sort((a, b) =>
            (b.amplitude || b.confidence || 0) - (a.amplitude || a.confidence || 0)
        );
        const primary = sorted[0];

        return sorted.filter(note => {
            const result = this.analyze(
                note.frequency,
                note.amplitude || note.confidence || 1,
                primary.frequency,
                primary.amplitude || primary.confidence || 1
            );
            note._sympathetic = result.isSympathetic;
            note._resonanceSource = result.resonanceSource;
            return !result.isSympathetic;
        });
    }

    getOpenStrings() {
        return this.openStrings[this.instrument] || this.openStrings.violin;
    }
}


// ──────────────────────────────────────────────────────────────────────────────
// VibratoSmoother - 200ms time-window moving average for true center frequency
// ──────────────────────────────────────────────────────────────────────────────

class VibratoSmoother {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 200; // 200ms window
        this.minSamples = options.minSamples || 3;
        this.vibratoMinCents = options.vibratoMinCents || 5;
        this.vibratoMaxCents = options.vibratoMaxCents || 50;
        this.minConfidence = options.minConfidence || 0.6;

        this.samples = []; // { frequency, confidence, timestamp }
        this.centerFrequency = null;
        this.isVibrato = false;
        this.vibratoDepthCents = 0;
        this.vibratoRateHz = 0;
    }

    /**
     * Add a pitch sample and recalculate the smoothed center frequency.
     * @param {number} frequency - Detected frequency
     * @param {number} confidence - Detection confidence (0-1)
     * @param {number} [timestamp] - Timestamp in ms (defaults to Date.now())
     * @returns {{ centerFrequency: number|null, isVibrato: boolean, depthCents: number }}
     */
    addSample(frequency, confidence, timestamp) {
        const ts = timestamp || Date.now();

        if (frequency && confidence >= this.minConfidence) {
            this.samples.push({ frequency, confidence, timestamp: ts });
        }

        // Evict samples outside the 200ms window
        const cutoff = ts - this.windowMs;
        while (this.samples.length > 0 && this.samples[0].timestamp < cutoff) {
            this.samples.shift();
        }

        this._recalculate();

        return {
            centerFrequency: this.centerFrequency,
            isVibrato: this.isVibrato,
            depthCents: this.vibratoDepthCents,
            rateHz: this.vibratoRateHz
        };
    }

    _recalculate() {
        if (this.samples.length < this.minSamples) {
            this.centerFrequency = this.samples.length > 0
                ? this.samples[this.samples.length - 1].frequency
                : null;
            this.isVibrato = false;
            this.vibratoDepthCents = 0;
            this.vibratoRateHz = 0;
            return;
        }

        // Confidence-weighted moving average
        let weightedSum = 0;
        let weightSum = 0;

        for (const sample of this.samples) {
            weightedSum += sample.frequency * sample.confidence;
            weightSum += sample.confidence;
        }

        this.centerFrequency = weightSum > 0 ? weightedSum / weightSum : null;

        // Detect vibrato characteristics
        this._analyzeVibrato();
    }

    _analyzeVibrato() {
        if (!this.centerFrequency || this.samples.length < this.minSamples) {
            this.isVibrato = false;
            this.vibratoDepthCents = 0;
            this.vibratoRateHz = 0;
            return;
        }

        const frequencies = this.samples.map(s => s.frequency);

        // Calculate peak-to-peak deviation in cents from center
        let maxCents = 0;
        for (const freq of frequencies) {
            const cents = Math.abs(1200 * Math.log2(freq / this.centerFrequency));
            if (cents > maxCents) maxCents = cents;
        }
        this.vibratoDepthCents = Math.round(maxCents);

        // Vibrato is present if oscillation is within typical range
        this.isVibrato = this.vibratoDepthCents >= this.vibratoMinCents &&
                         this.vibratoDepthCents <= this.vibratoMaxCents;

        // Estimate vibrato rate by counting zero-crossings of deviation
        if (this.isVibrato && this.samples.length >= 4) {
            const deviations = frequencies.map(f => f - this.centerFrequency);
            let zeroCrossings = 0;
            for (let i = 1; i < deviations.length; i++) {
                if ((deviations[i] >= 0) !== (deviations[i - 1] >= 0)) {
                    zeroCrossings++;
                }
            }
            const durationSec = (this.samples[this.samples.length - 1].timestamp -
                                 this.samples[0].timestamp) / 1000;
            // Each full cycle has 2 zero crossings
            this.vibratoRateHz = durationSec > 0
                ? Math.round((zeroCrossings / 2) / durationSec * 10) / 10
                : 0;
        } else {
            this.vibratoRateHz = 0;
        }
    }

    getCenterFrequency() {
        return this.centerFrequency;
    }

    centsDeviationFromTarget(targetFrequency) {
        if (!this.centerFrequency || !targetFrequency) return null;
        return Math.round(1200 * Math.log2(this.centerFrequency / targetFrequency));
    }

    getState() {
        return {
            centerFrequency: this.centerFrequency,
            isVibrato: this.isVibrato,
            depthCents: this.vibratoDepthCents,
            rateHz: this.vibratoRateHz,
            sampleCount: this.samples.length,
            windowMs: this.windowMs
        };
    }

    reset() {
        this.samples = [];
        this.centerFrequency = null;
        this.isVibrato = false;
        this.vibratoDepthCents = 0;
        this.vibratoRateHz = 0;
    }
}


// ──────────────────────────────────────────────────────────────────────────────
// PerformanceMonitor - Tracks latency and buffer underruns
// ──────────────────────────────────────────────────────────────────────────────

class DSPPerformanceMonitor {
    constructor(options = {}) {
        this.latencyBudgetMs = options.latencyBudgetMs || 30;
        this.historySize = options.historySize || 100;

        this.latencyHistory = [];
        this.underrunCount = 0;
        this.totalFrames = 0;
        this.droppedFrames = 0;
        this.lastProcessTime = null;
    }

    /**
     * Record the processing time for one frame.
     * @param {number} startTime - performance.now() at frame start
     * @param {number} endTime - performance.now() at frame end
     */
    recordFrame(startTime, endTime) {
        const latency = endTime - startTime;
        this.totalFrames++;

        this.latencyHistory.push(latency);
        if (this.latencyHistory.length > this.historySize) {
            this.latencyHistory.shift();
        }

        if (latency > this.latencyBudgetMs) {
            this.droppedFrames++;
        }

        this.lastProcessTime = latency;
    }

    recordUnderrun() {
        this.underrunCount++;
    }

    getAverageLatency() {
        if (this.latencyHistory.length === 0) return 0;
        const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
        return Math.round((sum / this.latencyHistory.length) * 100) / 100;
    }

    getMaxLatency() {
        if (this.latencyHistory.length === 0) return 0;
        return Math.max(...this.latencyHistory);
    }

    getP95Latency() {
        if (this.latencyHistory.length === 0) return 0;
        const sorted = [...this.latencyHistory].sort((a, b) => a - b);
        const idx = Math.floor(sorted.length * 0.95);
        return sorted[Math.min(idx, sorted.length - 1)];
    }

    isWithinBudget() {
        return this.getAverageLatency() <= this.latencyBudgetMs;
    }

    getStats() {
        return {
            averageLatencyMs: this.getAverageLatency(),
            maxLatencyMs: this.getMaxLatency(),
            p95LatencyMs: this.getP95Latency(),
            totalFrames: this.totalFrames,
            droppedFrames: this.droppedFrames,
            dropRate: this.totalFrames > 0
                ? Math.round((this.droppedFrames / this.totalFrames) * 10000) / 100
                : 0,
            underrunCount: this.underrunCount,
            withinBudget: this.isWithinBudget(),
            latencyBudgetMs: this.latencyBudgetMs
        };
    }

    reset() {
        this.latencyHistory = [];
        this.underrunCount = 0;
        this.totalFrames = 0;
        this.droppedFrames = 0;
        this.lastProcessTime = null;
    }
}


// ──────────────────────────────────────────────────────────────────────────────
// DSPEngine - Main orchestrator that ties everything together
// ──────────────────────────────────────────────────────────────────────────────

class DSPEngine {
    constructor(options = {}) {
        this.sampleRate = options.sampleRate || 44100;
        this.bufferSize = options.bufferSize || 2048;

        this.config = {
            sampleRate: this.sampleRate,
            bufferSize: this.bufferSize,
            latencyBudgetMs: options.latencyBudgetMs || 30,
            instrument: options.instrument || 'violin',
            polyphonicEnabled: options.polyphonicEnabled !== false,
            maxVoices: options.maxVoices || 2,
            vibratoWindowMs: options.vibratoWindowMs || 200,
            centsTolerance: options.centsTolerance || 50,
            confidenceThreshold: options.confidenceThreshold || 0.6,
            minLevel: options.minLevel || 0.01
        };

        // Instrument frequency ranges
        this.instrumentRanges = {
            violin: { min: 196, max: 2637 },
            viola:  { min: 130, max: 1319 },
            cello:  { min: 65, max: 987 },
            bass:   { min: 41, max: 262 }
        };

        const range = this.instrumentRanges[this.config.instrument] ||
                       this.instrumentRanges.violin;

        // Initialize pipeline components
        this.pitchDetector = new PYINPitchDetector({
            sampleRate: this.sampleRate,
            bufferSize: this.bufferSize,
            minFrequency: range.min,
            maxFrequency: range.max
        });

        this.sympatheticFilter = new SympatheticResonanceFilter({
            instrument: this.config.instrument
        });

        this.vibratoSmoothers = [];
        for (let i = 0; i < this.config.maxVoices; i++) {
            this.vibratoSmoothers.push(new VibratoSmoother({
                windowMs: this.config.vibratoWindowMs,
                minConfidence: this.config.confidenceThreshold * 0.8
            }));
        }

        this.performanceMonitor = new DSPPerformanceMonitor({
            latencyBudgetMs: this.config.latencyBudgetMs
        });

        // For polyphonic detection, we use the existing PolyphonicPitchDetector if available
        this.polyphonicDetector = null;

        // State
        this.isRunning = false;
        this.audioContext = null;
        this.scriptProcessor = null;
        this.microphoneSource = null;
        this.sessionLogger = null;
        this.currentScore = null;
        this.currentPosition = 0;
        this.sessionStartTime = null;

        // Tracking metrics
        this.totalNotesPlayed = 0;
        this.correctNotes = 0;
        this.lastDetectedNotes = [];

        // Callbacks
        this.onPitchDetected = null;
        this.onNoteMatch = null;
        this.onError = null;
        this.onLevelChange = null;
        this.onPerformanceWarning = null;

        // UI update throttling for 60fps
        this._lastUIUpdate = 0;
        this._uiUpdateInterval = 1000 / 60; // ~16.67ms
    }

    /**
     * Initialize the DSP engine.
     * @param {Object} [audioEngine] - Optional existing AudioEngine instance
     */
    async initialize(audioEngine) {
        try {
            if (audioEngine) {
                this.audioContext = audioEngine.audioContext;
                this.microphoneSource = audioEngine.microphone;
            }

            // Initialize polyphonic detector if available
            if (typeof PolyphonicPitchDetector !== 'undefined' && this.config.polyphonicEnabled) {
                this.polyphonicDetector = new PolyphonicPitchDetector();
                this.polyphonicDetector.configure({
                    sampleRate: this.sampleRate,
                    bufferSize: this.bufferSize,
                    maxVoices: this.config.maxVoices,
                    minFrequency: this.config.instrument
                        ? (this.instrumentRanges[this.config.instrument] || this.instrumentRanges.violin).min
                        : 27.5,
                    maxFrequency: this.config.instrument
                        ? (this.instrumentRanges[this.config.instrument] || this.instrumentRanges.violin).max
                        : 4186
                });
            }

            // Initialize session logger if available
            if (typeof SessionLogger !== 'undefined') {
                this.sessionLogger = new SessionLogger();
            }

            return true;
        } catch (error) {
            if (this.onError) this.onError(error);
            throw error;
        }
    }

    /**
     * Set instrument and reconfigure all components.
     */
    setInstrument(instrument) {
        this.config.instrument = instrument;
        const range = this.instrumentRanges[instrument] || this.instrumentRanges.violin;

        this.pitchDetector.configure({
            minFrequency: range.min,
            maxFrequency: range.max
        });

        this.sympatheticFilter.setInstrument(instrument);

        if (this.polyphonicDetector) {
            this.polyphonicDetector.configure({
                minFrequency: range.min,
                maxFrequency: range.max
            });
        }
    }

    /**
     * Set the score for comparison.
     */
    setScore(score) {
        this.currentScore = score;
        this.currentPosition = 0;
        this.totalNotesPlayed = 0;
        this.correctNotes = 0;
    }

    /**
     * Start the DSP processing pipeline.
     * Uses ScriptProcessorNode for broad browser compatibility with low latency.
     */
    async start() {
        if (this.isRunning) return;

        try {
            if (!this.audioContext) {
                const AudioCtx = typeof AudioContext !== 'undefined'
                    ? AudioContext
                    : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null);

                if (!AudioCtx) throw new Error('Web Audio API not supported');

                this.audioContext = new AudioCtx({
                    sampleRate: this.sampleRate,
                    latencyHint: 'interactive'
                });
            }

            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Request microphone if not already connected
            if (!this.microphoneSource) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                });
                this.microphoneSource = this.audioContext.createMediaStreamSource(stream);
            }

            // Use ScriptProcessorNode for direct buffer access with minimal latency
            this.scriptProcessor = this.audioContext.createScriptProcessor(
                this.bufferSize, 1, 1
            );

            this.scriptProcessor.onaudioprocess = (event) => {
                this._processFrame(event.inputBuffer.getChannelData(0));
            };

            this.microphoneSource.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);

            this.isRunning = true;
            this.sessionStartTime = Date.now();

            if (this.sessionLogger) {
                this.sessionLogger.startSession('dsp-' + Date.now());
            }

            this.performanceMonitor.reset();
        } catch (error) {
            if (this.onError) this.onError(error);
            throw error;
        }
    }

    /**
     * Stop the DSP processing pipeline.
     */
    stop() {
        if (!this.isRunning) return;

        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor = null;
        }

        if (this.microphoneSource) {
            this.microphoneSource.disconnect();
            this.microphoneSource = null;
        }

        this.isRunning = false;

        // Reset vibrato smoothers
        this.vibratoSmoothers.forEach(s => s.reset());
        this.pitchDetector.reset();
    }

    /**
     * Core processing frame - called by ScriptProcessorNode for each audio buffer.
     * Must complete within the latency budget (<30ms).
     */
    _processFrame(buffer) {
        const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const timestamp = Date.now();

        // 1. Check audio level (gate)
        const rms = this._computeRMS(buffer);

        if (this.onLevelChange) {
            this.onLevelChange(rms);
        }

        if (rms < this.config.minLevel) {
            this.lastDetectedNotes = [];
            this._recordPerformance(startTime);
            return;
        }

        // 2. Pitch detection with pYIN
        let detectedNotes = [];

        // Try polyphonic detection first if enabled
        if (this.config.polyphonicEnabled && this.polyphonicDetector) {
            const polyNotes = this.polyphonicDetector.detectPolyphonic(buffer);
            if (polyNotes.length > 0) {
                detectedNotes = polyNotes;
            }
        }

        // Fall back to monophonic pYIN
        if (detectedNotes.length === 0) {
            const result = this.pitchDetector.detect(buffer);
            if (result.frequency && result.confidence >= this.config.confidenceThreshold) {
                const noteInfo = this.pitchDetector.frequencyToNote(result.frequency);
                if (noteInfo) {
                    detectedNotes = [{
                        ...noteInfo,
                        frequency: result.frequency,
                        confidence: result.confidence,
                        amplitude: rms,
                        candidates: result.candidates
                    }];
                }
            }
        }

        // 3. Filter sympathetic vibrations
        if (detectedNotes.length > 1) {
            detectedNotes = this.sympatheticFilter.filter(detectedNotes);
        }

        // 4. Apply vibrato smoothing (200ms window)
        const smoothedNotes = detectedNotes.map((note, index) => {
            const smoother = this.vibratoSmoothers[Math.min(index, this.vibratoSmoothers.length - 1)];
            const result = smoother.addSample(note.frequency, note.confidence, timestamp);

            return {
                ...note,
                rawFrequency: note.frequency,
                centerFrequency: result.centerFrequency,
                isVibrato: result.isVibrato,
                vibratoDepthCents: result.depthCents,
                vibratoRateHz: result.rateHz
            };
        });

        this.lastDetectedNotes = smoothedNotes;

        // 5. Compare to score and log deviations
        if (smoothedNotes.length > 0 && this.currentScore) {
            this._compareToScore(smoothedNotes, timestamp);
        }

        // 6. Fire callback (throttled to 60fps for UI)
        if (this.onPitchDetected) {
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if (now - this._lastUIUpdate >= this._uiUpdateInterval) {
                this._lastUIUpdate = now;
                this.onPitchDetected({
                    notes: smoothedNotes,
                    level: rms,
                    timestamp,
                    latencyMs: now - startTime
                });
            }
        }

        this._recordPerformance(startTime);
    }

    _computeRMS(buffer) {
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        return Math.sqrt(sum / buffer.length);
    }

    _recordPerformance(startTime) {
        const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.performanceMonitor.recordFrame(startTime, endTime);

        if (!this.performanceMonitor.isWithinBudget() && this.onPerformanceWarning) {
            this.onPerformanceWarning(this.performanceMonitor.getStats());
        }
    }

    _compareToScore(notes, timestamp) {
        if (!this.currentScore) return;

        const allScoreNotes = this.currentScore.getAllNotes
            ? this.currentScore.getAllNotes()
            : (this.currentScore.notes || []);
        const expected = allScoreNotes[this.currentPosition];
        if (!expected) return;

        const expectedMIDI = expected.getMIDI ? expected.getMIDI() : expected.midi;
        const expectedFreq = expected.getFrequency
            ? expected.getFrequency()
            : (expected.frequency || this.pitchDetector.midiToFrequency(expectedMIDI));

        for (const note of notes) {
            if (note.midi === expectedMIDI) {
                // Use the vibrato-smoothed center frequency for deviation
                const effectiveFreq = note.centerFrequency || note.frequency;
                const cents = this.pitchDetector.centsDeviation(effectiveFreq, expectedFreq);
                const timingMs = this.sessionStartTime
                    ? timestamp - this.sessionStartTime
                    : 0;

                note.centsDeviation = cents;
                note.matched = Math.abs(cents) <= this.config.centsTolerance;

                if (note.matched) {
                    this.correctNotes++;
                }
                this.totalNotesPlayed++;

                // Log deviation to session logger
                if (this.sessionLogger) {
                    this.sessionLogger.logPitchDeviation({
                        measure: expected.measure || 1,
                        beat: expected.beat || 1,
                        expectedPitch: this._formatNoteName(expectedMIDI),
                        actualPitch: note.name + note.octave,
                        deviationCents: cents,
                        expectedFrequency: expectedFreq,
                        actualFrequency: effectiveFreq
                    });

                    if (expected.expectedTimeMs !== undefined) {
                        const timingDeviation = timingMs - expected.expectedTimeMs;
                        this.sessionLogger.logRhythmDeviation({
                            measure: expected.measure || 1,
                            beat: expected.beat || 1,
                            expectedMs: expected.expectedTimeMs,
                            actualMs: timingMs,
                            deviationMs: timingDeviation
                        });
                    }
                }

                // Fire note match callback
                if (this.onNoteMatch) {
                    this.onNoteMatch({
                        matched: note.matched,
                        expectedNote: expected,
                        detectedNote: note,
                        centsDeviation: cents,
                        position: this.currentPosition,
                        isVibrato: note.isVibrato,
                        vibratoDepthCents: note.vibratoDepthCents
                    });
                }

                // Advance position
                if (note.matched && this.currentPosition < allScoreNotes.length - 1) {
                    this.currentPosition++;
                }

                break;
            }
        }
    }

    _formatNoteName(midi) {
        const note = this.pitchDetector.midiToNoteName(midi);
        return note ? note.name + note.octave : '?';
    }

    /**
     * Process a single buffer directly (for testing or manual use).
     * @param {Float32Array} buffer - Audio samples
     * @param {number} [timestamp] - Optional timestamp
     * @returns {{ notes: Array, level: number }}
     */
    processBuffer(buffer, timestamp) {
        const ts = timestamp || Date.now();
        const rms = this._computeRMS(buffer);

        if (rms < this.config.minLevel) {
            return { notes: [], level: rms };
        }

        let detectedNotes = [];

        // pYIN detection
        const result = this.pitchDetector.detect(buffer);
        if (result.frequency && result.confidence >= this.config.confidenceThreshold) {
            const noteInfo = this.pitchDetector.frequencyToNote(result.frequency);
            if (noteInfo) {
                detectedNotes = [{
                    ...noteInfo,
                    frequency: result.frequency,
                    confidence: result.confidence,
                    amplitude: rms,
                    candidates: result.candidates
                }];
            }
        }

        // Vibrato smoothing
        const smoothedNotes = detectedNotes.map((note, index) => {
            const smoother = this.vibratoSmoothers[Math.min(index, this.vibratoSmoothers.length - 1)];
            const smoothResult = smoother.addSample(note.frequency, note.confidence, ts);

            return {
                ...note,
                rawFrequency: note.frequency,
                centerFrequency: smoothResult.centerFrequency,
                isVibrato: smoothResult.isVibrato,
                vibratoDepthCents: smoothResult.depthCents
            };
        });

        return { notes: smoothedNotes, level: rms };
    }

    getState() {
        return {
            isRunning: this.isRunning,
            instrument: this.config.instrument,
            currentNotes: this.lastDetectedNotes,
            currentPosition: this.currentPosition,
            totalNotesPlayed: this.totalNotesPlayed,
            correctNotes: this.correctNotes,
            accuracy: this.totalNotesPlayed > 0
                ? Math.round((this.correctNotes / this.totalNotesPlayed) * 100)
                : 0,
            sessionDurationMs: this.sessionStartTime ? Date.now() - this.sessionStartTime : 0,
            performance: this.performanceMonitor.getStats()
        };
    }

    getSessionLog() {
        return this.sessionLogger ? this.sessionLogger.getSessionLog() : null;
    }

    getSessionSummary() {
        return this.sessionLogger ? this.sessionLogger.getSummaryStats() : null;
    }

    exportSessionForLLM() {
        return this.sessionLogger ? this.sessionLogger.exportForLLM() : null;
    }

    dispose() {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close().catch(() => {});
            this.audioContext = null;
        }
        this.vibratoSmoothers.forEach(s => s.reset());
        this.pitchDetector.reset();
        this.performanceMonitor.reset();
    }
}


// ──────────────────────────────────────────────────────────────────────────────
// Exports
// ──────────────────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
    window.PYINPitchDetector = PYINPitchDetector;
    window.SympatheticResonanceFilter = SympatheticResonanceFilter;
    window.VibratoSmoother = VibratoSmoother;
    window.DSPPerformanceMonitor = DSPPerformanceMonitor;
    window.DSPEngine = DSPEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PYINPitchDetector,
        SympatheticResonanceFilter,
        VibratoSmoother,
        DSPPerformanceMonitor,
        DSPEngine
    };
}
