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
        this.bufferSize = 2048;
        this.hopSize = 512;

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
        this.confidenceThreshold = 0.1;
        this.harmonicOrder = 8;  // Analyze up to 8th harmonic

        // Tone quality thresholds
        this.harshnessThreshold = 0.35;  // High-frequency energy ratio for harshness
        this.wolfToneThreshold = 0.15;   // Narrow bandwidth threshold for wolf tones
        this.purityThreshold = 60;       // Minimum purity score for good tone

        // Wolf tone detection - common wolf tone frequencies for each instrument
        this.wolfToneFrequencies = {
            violin: [280, 315, 355, 400, 450, 500, 560, 630, 710],  // E string region
            viola: [175, 197, 220, 247, 278, 313],                     // C string region
            cello: [88, 98, 110, 123, 139, 156, 175],                  // C string region
            bass: [41, 55, 73, 82]                                      // E string region
        };

        // State
        this.lastAnalysisTime = 0;
        this.analysisInterval = 30; // Target <30ms latency

        // History for smoothing
        this.qualityHistory = [];
        this.maxHistorySize = 5;

        // Harmonic analysis results
        this.currentHarmonics = [];
        this.currentPurityScore = 0;
        this.currentHarshnessScore = 0;
        this.wolfToneDetected = false;
        this.wolfToneFrequency = null;
    }

    /**
     * Configure the analyzer
     */
    configure(options = {}) {
        if (options.sampleRate) this.sampleRate = options.sampleRate;
        if (options.fftSize) this.fftSize = options.fftSize;
        if (options.bufferSize) this.bufferSize = options.bufferSize;
        if (options.hopSize) this.hopSize = options.hopSize;
        if (options.instrument) this.instrument = options.instrument;
        if (options.harshnessThreshold) this.harshnessThreshold = options.harshnessThreshold;
        if (options.wolfToneThreshold) this.wolfToneThreshold = options.wolfToneThreshold;
    }

    /**
     * Analyze audio buffer for tone quality
     * @param {Float32Array} buffer - Audio samples
     * @param {number} fundamentalFrequency - Detected fundamental frequency
     * @returns {Object} Tone quality analysis results
     */
    analyze(buffer, fundamentalFrequency) {
        if (!buffer || buffer.length < this.bufferSize) {
            return this.getDefaultResult();
        }

        // Compute FFT
        const fft = this.computeFFT(buffer);
        const frequencies = this.computeFrequencyBins();

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
     * Compute FFT of audio buffer using Web Audio API style
     */
    computeFFT(buffer) {
        const numBins = this.fftSize / 2;
        const fftData = new Float32Array(numBins);

        // Apply Hann window
        const windowed = new Float32Array(buffer.length);
        for (let i = 0; i < buffer.length; i++) {
            const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (buffer.length - 1)));
            windowed[i] = buffer[i] * window;
        }

        // Compute DFT for relevant frequency bins
        const minBin = Math.floor(20 * this.fftSize / this.sampleRate);  // 20 Hz
        const maxBin = Math.floor(5000 * this.fftSize / this.sampleRate); // 5 kHz

        for (let k = minBin; k < maxBin && k < numBins; k++) {
            let real = 0;
            let imag = 0;

            for (let n = 0; n < windowed.length; n++) {
                const angle = (2 * Math.PI * k * n) / this.fftSize;
                real += windowed[n] * Math.cos(angle);
                imag -= windowed[n] * Math.sin(angle);
            }

            // Return magnitude spectrum
            fftData[k] = Math.sqrt(real * real + imag * imag) / windowed.length;
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

            const p = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
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
                // Get amplitude with some tolerance
                const tolerance = 0.1 * h;  // Wider tolerance for higher harmonics
                let maxAmp = fft[harmonicBin];
                let peakBin = harmonicBin;

                for (let i = -Math.ceil(tolerance); i <= Math.ceil(tolerance); i++) {
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
                    const p = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
                    actualFreq = (peakBin + p) * this.sampleRate / this.fftSize;
                }

                harmonics.push({
                    harmonic: h,
                    frequency: actualFreq,
                    amplitude: maxAmp,
                    idealRatio: 1 / h  // Ideal amplitude ratio (decreasing)
                });

                ratios.push(maxAmp);
            }
        }

        // Calculate ratio to fundamental
        const fundamentalAmp = harmonics.length > 0 ? harmonics[0].amplitude : 1;
        const normalizedRatios = harmonics.map(h => h.amplitude / fundamentalAmp);

        return {
            harmonics,
            ratios: normalizedRatios,
            fundamentalAmplitude: fundamentalAmp
        };
    }

    /**
     * Calculate tone purity score (0-100%)
     * Based on harmonic balance - ideal is strong fundamental with smoothly decreasing harmonics
     */
    calculatePurityScore(harmonicAnalysis) {
        const { harmonics, ratios } = harmonicAnalysis;

        if (harmonics.length < 2) {
            return 75; // Default if not enough harmonics detected
        }

        // Ideal harmonic series has smoothly decreasing amplitudes
        // Calculate deviation from ideal
        let deviation = 0;
        let evenOddRatio = 0;
        let evenSum = 0;
        let oddSum = 0;

        for (let i = 0; i < harmonics.length; i++) {
            const h = harmonics[i].harmonic;
            const amplitude = harmonics[i].amplitude;

            // Ideal amplitude decreases as 1/h
            const idealAmplitude = harmonics[0].amplitude / h;
            const amplitudeDeviation = Math.abs(amplitude - idealAmplitude) / idealAmplitude;
            deviation += amplitudeDeviation;

            // Track even vs odd harmonic balance
            if (h % 2 === 0) {
                evenSum += amplitude;
            } else {
                oddSum += amplitude;
            }
        }

        // Calculate average deviation
        const avgDeviation = deviation / harmonics.length;

        // Calculate even-odd balance (good tone has balanced harmonics)
        const totalHarmonicEnergy = evenSum + oddSum;
        evenOddRatio = totalHarmonicEnergy > 0 ? Math.abs(evenSum - oddSum) / totalHarmonicEnergy : 0.5;

        // Purity score: lower deviation = higher purity
        // Also penalize unbalanced even/odd ratio
        let purityScore = Math.max(0, 100 - (avgDeviation * 50) - (evenOddRatio * 30));

        return Math.round(purityScore);
    }

    /**
     * Detect harsh/scratchy bowing based on high-frequency energy
     */
    detectHarshness(fft, frequencies, range) {
        // Calculate energy in different frequency bands
        const lowMidStart = Math.floor(range.min * this.fftSize / this.sampleRate);
        const lowMidEnd = Math.floor(range.max * 0.5 * this.fftSize / this.sampleRate);
        const highStart = Math.floor(range.max * 0.5 * this.fftSize / this.sampleRate);
        const highEnd = Math.floor(range.max * this.fftSize / this.sampleRate);

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

        // Determine harshness level
        let level = 'good';
        let score = 100;

        if (harshnessRatio > this.harshnessThreshold * 2) {
            level = 'harsh';
            score = Math.max(0, 100 - (harshnessRatio - this.harshnessThreshold * 2) * 200);
        } else if (harshnessRatio > this.harshnessThreshold) {
            level = 'acceptable';
            score = Math.max(0, 100 - (harshnessRatio - this.harshnessThreshold) * 100);
        } else {
            level = 'good';
            score = 100 - (harshnessRatio / this.harshnessThreshold) * 20;
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

            if (percentDeviation < 0.05) { // Within 5% of wolf tone
                // Check for narrow peak (high Q factor)
                const wolfBin = Math.floor(wolfFreq * this.fftSize / this.sampleRate);

                if (wolfBin > 0 && wolfBin < fft.length - 1) {
                    const peakAmplitude = fft[wolfBin];
                    let bandwidth = 0;

                    // Measure bandwidth (bins above half amplitude)
                    for (let i = wolfBin - 1; i >= 0 && fft[i] > peakAmplitude * 0.5; i--) {
                        bandwidth++;
                    }
                    for (let i = wolfBin + 1; i < fft.length && fft[i] > peakAmplitude * 0.5; i++) {
                        bandwidth++;
                    }

                    // Narrow bandwidth indicates wolf tone
                    const qFactor = bandwidth < 5;

                    if (qFactor && peakAmplitude > this.wolfToneThreshold) {
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
        let score = (purityScore * 0.5) + (harshnessScore * 0.5);

        // Penalize wolf tones significantly
        if (wolfToneDetected) {
            score *= 0.7;
        }

        return Math.round(Math.max(0, Math.min(100, score)));
    }

    /**
     * Get smoothed score from history
     */
    getSmoothedScore() {
        if (this.qualityHistory.length === 0) return 0;
        const sum = this.qualityHistory.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.qualityHistory.length);
    }

    /**
     * Get default result when no analysis available
     */
    getDefaultResult() {
        return {
            qualityScore: 50,
            purityScore: 50,
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
            purityScore: this.currentPurityScore,
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
        if (score >= 80) return '#10b981'; // emerald - excellent
        if (score >= 60) return '#10b981'; // emerald - good
        if (score >= 40) return '#f59e0b'; // amber - acceptable
        return '#dc2626'; // crimson - harsh
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
            purityScore: this.currentPurityScore,
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
