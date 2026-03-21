/**
 * Tone Quality Analyzer - DSP Expansion
 * Analyzes bow technique through FFT harmonic analysis
 * Detects tone quality, harshness, wolf tones, and overtone ratios
 */

class ToneQualityAnalyzer {
    constructor() {
        // Audio parameters
        this.sampleRate = 44100;
        this.fftSize = 4096;

        // Frequency ranges for string instruments
        this.instrumentRanges = {
            violin: { min: 196, max: 2637 },    // G3 to E7
            viola: { min: 130, max: 1319 },    // C3 to E6
            cello: { min: 65, max: 987 },      // C2 to B5
            bass: { min: 41, max: 262 }        // E1 to C4
        };

        // Current instrument
        this.instrument = 'violin';

        // Analysis parameters
        this.confidenceThreshold = 0.001;  // Low threshold for AnalyserNode path (max ~0.0316)
        this.harmonicOrder = 8;  // Analyze up to 8th harmonic

        // Tone quality thresholds
        // Note: After dB-to-linear conversion, max amplitude is ~0.0316 (-30dB)
        // Thresholds are scaled accordingly
        this.harshnessThreshold = 0.35;  // High-frequency energy ratio for harshness
        this.wolfToneThreshold = 0.005;  // Threshold for wolf tone detection (low due to dB conversion)
        this.purityThreshold = 60;       // Minimum purity score for good tone

        // Wolf tone detection - common wolf tone frequencies for each instrument
        // More accurate frequencies based on typical instrument physics
        this.wolfToneFrequencies = {
            violin: [659, 698, 740, 784, 830, 880, 932, 988],  // E5 and above
            viola: [220, 247, 277, 311, 349, 392, 440],         // A4 and above
            cello: [147, 165, 175, 196, 220, 247],             // D3 and above
            bass: [55, 82, 110, 147]                             // A1 and above
        };

        // History for smoothing
        this.qualityHistory = [];
        this.maxHistorySize = 5;

        // Harmonic analysis results
        this.currentHarmonics = [];
        this.currentPurityScore = 0;
        this.currentHarshnessScore = 0;
        this.wolfToneDetected = false;
        this.wolfToneFrequency = null;

        // Pre-computed frequency bins (for when using external FFT data)
        this.frequencyBins = null;
    }

    /**
     * Configure the analyzer
     */
    configure(options = {}) {
        if (options.sampleRate !== undefined) this.sampleRate = options.sampleRate;
        if (options.fftSize !== undefined) this.fftSize = options.fftSize;
        if (options.instrument !== undefined) this.instrument = options.instrument;
        if (options.harshnessThreshold !== undefined) this.harshnessThreshold = options.harshnessThreshold;
        if (options.wolfToneThreshold !== undefined) this.wolfToneThreshold = options.wolfToneThreshold;

        // Pre-compute frequency bins
        this.frequencyBins = this.computeFrequencyBins();
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
     * Analyze audio buffer for tone quality
     * @param {Float32Array} buffer - Audio samples (time domain)
     * @param {number} fundamentalFrequency - Detected fundamental frequency
     * @param {Float32Array} frequencyData - Optional pre-computed frequency data from AnalyserNode
     * @returns {Object} Tone quality analysis results
     */
    analyze(buffer, fundamentalFrequency, frequencyData) {
        // Use provided frequency data if available (from AnalyserNode)
        // Otherwise compute from buffer
        let fft, frequencies;

        if (frequencyData && frequencyData.length > 0) {
            // Convert Uint8Array (dB-scaled) to linear amplitude
            // AnalyserNode.getByteFrequencyData maps dB range [minDecibels, maxDecibels] to [0, 255]
            // Default range: -100 dBFS to -30 dBFS
            const minDecibels = -100;
            const maxDecibels = -30;
            const dbRange = maxDecibels - minDecibels;

            fft = new Float32Array(frequencyData.length);
            for (let i = 0; i < frequencyData.length; i++) {
                // Convert byte to dB, then to linear amplitude
                const db = (frequencyData[i] / 255) * dbRange + minDecibels;
                // Convert dB to linear: linear = 10^(dB/20)
                fft[i] = Math.pow(10, db / 20);
            }
            frequencies = this.frequencyBins || this.computeFrequencyBins();
        } else if (!buffer || buffer.length < 1024) {
            return this.getDefaultResult();
        } else {
            // Fall back to simplified DFT for smaller buffers
            fft = this.computeSimplifiedFFT(buffer);
            frequencies = this.frequencyBins || this.computeFrequencyBins();
        }

        // Get frequency range for current instrument
        const range = this.instrumentRanges[this.instrument] || this.instrumentRanges.violin;

        // Find fundamental in spectrum if not provided
        if (!fundamentalFrequency) {
            fundamentalFrequency = this.findFundamentalFrequency(fft, frequencies, range);
        }

        if (!fundamentalFrequency) {
            return this.getDefaultResult();
        }

        // Analyze harmonics
        const harmonicAnalysis = this.analyzeHarmonics(fft, frequencies, fundamentalFrequency, range);
        this.currentHarmonics = harmonicAnalysis.harmonics;

        // Calculate purity score (0-100%)
        const purityScore = this.calculatePurityScore(harmonicAnalysis);
        this.currentPurityScore = purityScore;

        // Detect harsh/scratchy bowing
        const harshnessResult = this.detectHarshness(fft, frequencies, range);
        this.currentHarshnessScore = harshnessResult.score;

        // Detect wolf tones
        const wolfToneResult = this.detectWolfTones(fft, frequencies, fundamentalFrequency, range);
        this.wolfToneDetected = wolfToneResult.detected;
        this.wolfToneFrequency = wolfToneResult.frequency;

        // Calculate overall tone quality score
        const qualityScore = this.calculateToneQualityScore(purityScore, harshnessResult.score, wolfToneResult.detected);

        // Handle NaN from purity score
        if (!Number.isFinite(qualityScore)) {
            return this.getDefaultResult();
        }

        // Update history for smoothing
        this.qualityHistory.push(qualityScore);
        if (this.qualityHistory.length > this.maxHistorySize) {
            this.qualityHistory.shift();
        }

        // Get smoothed score
        const smoothedScore = this.getSmoothedScore();

        return {
            qualityScore: smoothedScore,
            purityScore: purityScore,
            harshnessScore: harshnessResult.score,
            harshnessLevel: harshnessResult.level,
            wolfToneDetected: wolfToneResult.detected,
            wolfToneFrequency: wolfToneResult.frequency,
            harmonicRatios: harmonicAnalysis.ratios,
            harmonics: harmonicAnalysis.harmonics,
            fundamentalFrequency: fundamentalFrequency,
            timestamp: Date.now()
        };
    }

    /**
     * Compute simplified FFT using a more efficient approach
     * Uses reduced complexity for real-time performance
     */
    computeSimplifiedFFT(buffer) {
        const numBins = this.fftSize / 2;
        const fftData = new Float32Array(numBins);

        // Apply Hann window
        const windowed = new Float32Array(buffer.length);
        for (let i = 0; i < buffer.length; i++) {
            const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (buffer.length - 1)));
            windowed[i] = buffer[i] * window;
        }

        // Use a simpler approach - compute only essential frequency bins
        // Use Goertzel-like approach for specific harmonic frequencies
        const minFreq = 50;
        const maxFreq = 8000;
        const minBin = Math.floor(minFreq * this.fftSize / this.sampleRate);
        const maxBin = Math.floor(maxFreq * this.fftSize / this.sampleRate);

        // Use smaller DFT for performance - sample every Nth bin
        const step = Math.max(1, Math.floor((maxBin - minBin) / 200));

        for (let k = minBin; k < maxBin && k < numBins; k += step) {
            let real = 0;
            let imag = 0;

            // Use only a portion of the buffer for speed
            const samplesToUse = Math.min(1024, windowed.length);
            const angleStep = (2 * Math.PI * k) / this.fftSize;

            for (let n = 0; n < samplesToUse; n++) {
                const angle = angleStep * n;
                real += windowed[n] * Math.cos(angle);
                imag -= windowed[n] * Math.sin(angle);
            }

            const magnitude = Math.sqrt(real * real + imag * imag) / samplesToUse;

            // Fill in neighboring bins with interpolated values
            for (let i = 0; i < step && k + i < numBins; i++) {
                fftData[k + i] = magnitude * (1 - Math.abs(i - step / 2) / step);
            }
        }

        return fftData;
    }

    /**
     * Find fundamental frequency from spectrum peak
     */
    findFundamentalFrequency(fft, frequencies, range) {
        const minBin = Math.floor(range.min * this.fftSize / this.sampleRate);
        const maxBin = Math.floor(range.max * this.fftSize / this.sampleRate);

        let maxAmplitude = 0;
        let fundamentalBin = minBin;

        // Find the strongest peak in the instrument range
        for (let i = minBin; i < maxBin && i < fft.length; i++) {
            if (fft[i] > maxAmplitude) {
                maxAmplitude = fft[i];
                fundamentalBin = i;
            }
        }

        if (maxAmplitude < this.confidenceThreshold) {
            return null;
        }

        // Parabolic interpolation for better precision
        if (fundamentalBin > 0 && fundamentalBin < fft.length - 1) {
            const alpha = fft[fundamentalBin - 1];
            const beta = fft[fundamentalBin];
            const gamma = fft[fundamentalBin + 1];

            // Guard against division by zero
            const denom = alpha - 2 * beta + gamma;
            if (Math.abs(denom) < 1e-10) {
                return frequencies[fundamentalBin];
            }

            const p = 0.5 * (alpha - gamma) / denom;
            return (fundamentalBin + p) * this.sampleRate / this.fftSize;
        }

        return frequencies[fundamentalBin];
    }

    /**
     * Analyze harmonic series
     */
    analyzeHarmonics(fft, frequencies, fundamentalFrequency, range) {
        const harmonics = [];
        const ratios = [];

        // Find harmonics of fundamental
        for (let h = 1; h <= this.harmonicOrder; h++) {
            const harmonicFreq = fundamentalFrequency * h;

            // Skip if outside instrument range
            if (harmonicFreq > range.max) break;

            // Find the bin for this harmonic
            const harmonicBin = Math.floor(harmonicFreq * this.fftSize / this.sampleRate);

            if (harmonicBin >= 0 && harmonicBin < fft.length) {
                // Get amplitude with some tolerance - search neighborhood
                const tolerance = Math.max(2, Math.ceil(0.05 * harmonicBin));
                let maxAmp = 0;
                let peakBin = harmonicBin;

                for (let i = -tolerance; i <= tolerance; i++) {
                    const idx = harmonicBin + i;
                    if (idx >= 0 && idx < fft.length && fft[idx] > maxAmp) {
                        maxAmp = fft[idx];
                        peakBin = idx;
                    }
                }

                // Calculate actual frequency via interpolation
                let actualFreq = frequencies[peakBin];
                if (peakBin > 0 && peakBin < fft.length - 1) {
                    const alpha = fft[peakBin - 1];
                    const beta = fft[peakBin];
                    const gamma = fft[peakBin + 1];

                    // Guard against division by zero
                    const denom = alpha - 2 * beta + gamma;
                    if (Math.abs(denom) > 1e-10) {
                        const p = 0.5 * (alpha - gamma) / denom;
                        actualFreq = (peakBin + p) * this.sampleRate / this.fftSize;
                    }
                }

                harmonics.push({
                    harmonic: h,
                    frequency: actualFreq,
                    amplitude: maxAmp,
                    idealRatio: 1 / h
                });

                ratios.push(maxAmp);
            }
        }

        // Calculate ratio to fundamental
        const fundamentalAmp = harmonics.length > 0 ? harmonics[0].amplitude : 1;
        const normalizedRatios = harmonics.map(h =>
            fundamentalAmp > 0 ? h.amplitude / fundamentalAmp : 0
        );

        return {
            harmonics,
            ratios: normalizedRatios,
            fundamentalAmplitude: fundamentalAmp
        };
    }

    /**
     * Calculate tone purity score (0-100%)
     * Based on harmonic balance - ideal is strong fundamental with smoothly decreasing harmonics
     * Removed the incorrect even/odd penalty as it penalizes good bowing technique
     */
    calculatePurityScore(harmonicAnalysis) {
        const { harmonics, fundamentalAmplitude } = harmonicAnalysis;

        if (harmonics.length < 2 || fundamentalAmplitude <= 0) {
            return 75; // Default if not enough harmonics detected
        }

        // Ideal harmonic series has smoothly decreasing amplitudes
        // Calculate deviation from ideal
        let deviation = 0;

        for (let i = 0; i < harmonics.length; i++) {
            const h = harmonics[i].harmonic;
            const amplitude = harmonics[i].amplitude;

            // Ideal amplitude decreases as 1/h
            const idealAmplitude = fundamentalAmplitude / h;

            // Guard against division by zero
            if (idealAmplitude <= 0) continue;

            const amplitudeDeviation = Math.abs(amplitude - idealAmplitude) / idealAmplitude;
            deviation += amplitudeDeviation;
        }

        // Calculate average deviation
        const avgDeviation = deviation / harmonics.length;

        // Purity score: lower deviation = higher purity
        // Removed even/odd penalty as it's acoustically incorrect
        let purityScore = Math.max(0, 100 - (avgDeviation * 50));

        return Math.round(purityScore);
    }

    /**
     * Detect harsh/scratchy bowing based on high-frequency energy
     * Range: 50 Hz - 3 kHz (low-mid) vs 3-8 kHz (high)
     * Bow harshness/noise typically appears above 3 kHz
     */
    detectHarshness(fft, frequencies, range) {
        // Calculate energy in different frequency bands
        // Low-mid: 50 Hz to 3 kHz (musical content)
        // High: 3 kHz to 8 kHz (where bow noise appears)
        const lowMidStart = Math.floor(50 * this.fftSize / this.sampleRate);
        const lowMidEnd = Math.floor(3000 * this.fftSize / this.sampleRate);
        const highStart = Math.floor(3000 * this.fftSize / this.sampleRate);
        const highEnd = Math.floor(8000 * this.fftSize / this.sampleRate);

        let lowMidEnergy = 0;
        let highEnergy = 0;

        for (let i = lowMidStart; i < lowMidEnd && i < fft.length; i++) {
            lowMidEnergy += fft[i] * fft[i];
        }

        for (let i = highStart; i < highEnd && i < fft.length; i++) {
            highEnergy += fft[i] * fft[i];
        }

        // Calculate harshness ratio
        const totalEnergy = lowMidEnergy + highEnergy;
        const harshnessRatio = totalEnergy > 0 ? highEnergy / totalEnergy : 0;

        // Determine harshness level and score using continuous function
        // Score decreases smoothly from 100 (good) to 0 (harsh) as harshness ratio increases
        // Using harshnessRatio / (harshnessThreshold * 2) as normalized measure (0 to ~1)
        let level = 'good';
        let score = 100;

        const normalizedHarshness = harshnessRatio / (this.harshnessThreshold * 2);

        if (normalizedHarshness >= 1) {
            level = 'harsh';
            score = Math.max(0, 100 * (1 - normalizedHarshness));
        } else if (normalizedHarshness >= 0.5) {
            level = 'acceptable';
            score = Math.max(0, 100 * (1 - normalizedHarshness));
        } else {
            level = 'good';
            score = 100 * (1 - normalizedHarshness * 0.2); // Max 20% penalty for good range
        }

        return {
            score: Math.round(score),
            level,
            ratio: harshnessRatio
        };
    }

    /**
     * Detect wolf tones - narrow resonances that interfere with playing
     */
    detectWolfTones(fft, frequencies, fundamentalFrequency, range) {
        const wolfTones = this.wolfToneFrequencies[this.instrument] || this.wolfToneFrequencies.violin;

        for (const wolfFreq of wolfTones) {
            // Check if wolf tone frequency is in range
            if (wolfFreq < range.min || wolfFreq > range.max) continue;

            // Check if detected frequency is near a wolf tone
            const deviation = Math.abs(fundamentalFrequency - wolfFreq);
            const percentDeviation = deviation / wolfFreq;

            // Within 3% of wolf tone (tighter tolerance)
            if (percentDeviation < 0.03) {
                // Find the actual peak in the region
                const wolfBin = Math.floor(wolfFreq * this.fftSize / this.sampleRate);
                const searchRange = Math.max(5, Math.floor(0.05 * wolfBin));

                let peakAmplitude = 0;
                let peakBin = wolfBin;

                // Search neighborhood for actual peak
                for (let i = -searchRange; i <= searchRange; i++) {
                    const idx = wolfBin + i;
                    if (idx >= 0 && idx < fft.length && fft[idx] > peakAmplitude) {
                        peakAmplitude = fft[idx];
                        peakBin = idx;
                    }
                }

                if (peakAmplitude > this.wolfToneThreshold) {
                    let bandwidth = 0;

                    // Measure bandwidth (bins above half amplitude)
                    for (let i = peakBin - 1; i >= 0 && fft[i] > peakAmplitude * 0.5; i--) {
                        bandwidth++;
                    }
                    for (let i = peakBin + 1; i < fft.length && fft[i] > peakAmplitude * 0.5; i++) {
                        bandwidth++;
                    }

                    // Narrow bandwidth indicates wolf tone
                    const qFactor = bandwidth < 5;

                    if (qFactor) {
                        return {
                            detected: true,
                            frequency: wolfFreq,
                            intensity: peakAmplitude
                        };
                    }
                }
            }
        }

        return {
            detected: false,
            frequency: null,
            intensity: 0
        };
    }

    /**
     * Calculate overall tone quality score
     */
    calculateToneQualityScore(purityScore, harshnessScore, wolfToneDetected) {
        // Guard against NaN
        if (!Number.isFinite(purityScore)) purityScore = 50;
        if (!Number.isFinite(harshnessScore)) harshnessScore = 50;

        let score = (purityScore * 0.5) + (harshnessScore * 0.5);

        // Penalize wolf tones significantly
        if (wolfToneDetected) {
            score *= 0.7;
        }

        return Math.round(Math.max(0, Math.min(100, score)));
    }

    /**
     * Get smoothed score from history, filtering out NaN
     */
    getSmoothedScore() {
        if (this.qualityHistory.length === 0) return 0;

        const validScores = this.qualityHistory.filter(s => Number.isFinite(s));
        if (validScores.length === 0) return 0;

        const sum = validScores.reduce((a, b) => a + b, 0);
        return Math.round(sum / validScores.length);
    }

    /**
     * Get default result when no analysis available
     */
    getDefaultResult() {
        return {
            qualityScore: 0,
            purityScore: 0,
            harshnessScore: 50,
            harshnessLevel: 'unknown',
            wolfToneDetected: false,
            wolfToneFrequency: null,
            harmonicRatios: [],
            harmonics: [],
            fundamentalFrequency: null,
            timestamp: Date.now()
        };
    }

    /**
     * Get current analysis result
     */
    getCurrentResult() {
        if (this.qualityHistory.length === 0) {
            return this.getDefaultResult();
        }

        return {
            qualityScore: this.getSmoothedScore(),
            purityScore: this.currentPurityScore || 0,
            harshnessScore: this.currentHarshnessScore,
            harshnessLevel: this.getHarshnessLevel(),
            wolfToneDetected: this.wolfToneDetected,
            wolfToneFrequency: this.wolfToneFrequency,
            harmonicRatios: this.currentHarmonics.map(h => h.amplitude),
            harmonics: this.currentHarmonics,
            fundamentalFrequency: null,
            timestamp: Date.now()
        };
    }

    /**
     * Get harshness level string
     */
    getHarshnessLevel() {
        if (this.currentHarshnessScore >= 80) return 'excellent';
        if (this.currentHarshnessScore >= 60) return 'good';
        if (this.currentHarshnessScore >= 40) return 'acceptable';
        if (this.currentHarshnessScore >= 20) return 'harsh';
        return 'very_harsh';
    }

    /**
     * Get color for tone quality (emerald=good, crimson=harsh)
     */
    static getQualityColor(score) {
        if (score >= 60) return '#10b981'; // emerald
        if (score >= 40) return '#f59e0b'; // amber
        return '#dc2626'; // crimson
    }

    /**
     * Get status based on score
     */
    static getQualityStatus(score) {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'acceptable';
        if (score >= 20) return 'harsh';
        return 'very_harsh';
    }

    /**
     * Reset analysis state
     */
    reset() {
        this.qualityHistory = [];
        this.currentHarmonics = [];
        this.currentPurityScore = 0;
        this.currentHarshnessScore = 0;
        this.wolfToneDetected = false;
        this.wolfToneFrequency = null;
    }

    /**
     * Get analysis state for logging
     */
    getState() {
        return {
            qualityScore: this.getSmoothedScore(),
            purityScore: this.currentPurityScore || 0,
            harshnessScore: this.currentHarshnessScore,
            harshnessLevel: this.getHarshnessLevel(),
            wolfToneDetected: this.wolfToneDetected,
            wolfToneFrequency: this.wolfToneFrequency,
            historyLength: this.qualityHistory.length
        };
    }
}

// Export for use in other modules
window.ToneQualityAnalyzer = ToneQualityAnalyzer;
