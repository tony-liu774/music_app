/**
 * Volume Envelope Analyzer - Detects crescendo/decrescendo patterns from audio amplitude
 * Analyzes RMS levels over time to identify dynamic changes in live performance
 */

class VolumeEnvelopeAnalyzer {
    constructor() {
        // RMS history for envelope tracking
        this.rmsHistory = [];
        this.maxHistorySize = 100;

        // Dynamic level thresholds (RMS values mapped to musical dynamics)
        this.dynamicThresholds = {
            pp: 0.02,
            p: 0.05,
            mp: 0.10,
            mf: 0.18,
            f: 0.30,
            ff: 0.45
        };

        // Envelope detection parameters
        this.windowSize = 8;           // Samples to analyze for trend
        this.crescendoThreshold = 0.015; // Min RMS increase per sample to count as crescendo
        this.decrescendoThreshold = 0.015; // Min RMS decrease per sample to count as decrescendo

        // Current state
        this.currentDynamic = 'mf';
        this.currentTrend = 'stable'; // 'crescendo', 'decrescendo', 'stable'
        this.trendStartTime = null;
        this.trendStartLevel = null;
    }

    /**
     * Add an RMS sample to the history and analyze
     * @param {number} rmsLevel - RMS level (0-1 range)
     * @param {number} timestamp - Sample timestamp in ms
     * @returns {Object} Current envelope analysis
     */
    addSample(rmsLevel, timestamp = Date.now()) {
        this.rmsHistory.push({
            rms: Math.max(0, rmsLevel),
            timestamp
        });

        if (this.rmsHistory.length > this.maxHistorySize) {
            this.rmsHistory.shift();
        }

        // Update dynamic level
        this.currentDynamic = this.classifyDynamic(rmsLevel);

        // Detect trend
        const trend = this.detectTrend();
        if (trend !== this.currentTrend) {
            this.trendStartTime = timestamp;
            this.trendStartLevel = rmsLevel;
            this.currentTrend = trend;
        }

        return this.getState();
    }

    /**
     * Classify RMS level to musical dynamic marking
     * @param {number} rmsLevel - RMS amplitude (0-1)
     * @returns {string} Dynamic marking (pp, p, mp, mf, f, ff)
     */
    classifyDynamic(rmsLevel) {
        if (rmsLevel >= this.dynamicThresholds.ff) return 'ff';
        if (rmsLevel >= this.dynamicThresholds.f) return 'f';
        if (rmsLevel >= this.dynamicThresholds.mf) return 'mf';
        if (rmsLevel >= this.dynamicThresholds.mp) return 'mp';
        if (rmsLevel >= this.dynamicThresholds.p) return 'p';
        return 'pp';
    }

    /**
     * Detect volume trend (crescendo/decrescendo/stable)
     * Uses linear regression over recent samples
     * @returns {string} 'crescendo', 'decrescendo', or 'stable'
     */
    detectTrend() {
        if (this.rmsHistory.length < this.windowSize) return 'stable';

        const recent = this.rmsHistory.slice(-this.windowSize);
        const slope = this.calculateSlope(recent.map(s => s.rms));

        if (slope > this.crescendoThreshold) return 'crescendo';
        if (slope < -this.decrescendoThreshold) return 'decrescendo';
        return 'stable';
    }

    /**
     * Calculate slope of RMS values using simple linear regression
     * @param {number[]} values - Array of RMS values
     * @returns {number} Slope (positive = getting louder)
     */
    calculateSlope(values) {
        const n = values.length;
        if (n < 2) return 0;

        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += values[i];
            sumXY += i * values[i];
            sumXX += i * i;
        }

        const denominator = n * sumXX - sumX * sumX;
        if (denominator === 0) return 0;

        return (n * sumXY - sumX * sumY) / denominator;
    }

    /**
     * Analyze the attack characteristics of the current note onset
     * @param {Float32Array} audioBuffer - Time-domain audio data
     * @param {number} [sampleRate=44100] - Audio sample rate in Hz
     * @returns {Object} Attack analysis { attackTime, peakAmplitude, decayRate }
     */
    analyzeAttack(audioBuffer, sampleRate = 44100) {
        if (!audioBuffer || audioBuffer.length === 0) {
            return { attackTime: 0, peakAmplitude: 0, decayRate: 0 };
        }

        // Find peak amplitude
        let peakIndex = 0;
        let peakValue = 0;
        for (let i = 0; i < audioBuffer.length; i++) {
            const abs = Math.abs(audioBuffer[i]);
            if (abs > peakValue) {
                peakValue = abs;
                peakIndex = i;
            }
        }

        // Attack time: from first significant amplitude to peak
        const threshold = peakValue * 0.1;
        let attackStart = 0;
        for (let i = 0; i < peakIndex; i++) {
            if (Math.abs(audioBuffer[i]) > threshold) {
                attackStart = i;
                break;
            }
        }

        const attackTime = (peakIndex - attackStart) / sampleRate * 1000; // ms

        // Decay rate: how quickly amplitude drops after peak
        let decayEnd = audioBuffer.length - 1;
        const decayThreshold = peakValue * 0.5;
        for (let i = peakIndex; i < audioBuffer.length; i++) {
            if (Math.abs(audioBuffer[i]) < decayThreshold) {
                decayEnd = i;
                break;
            }
        }

        const decayTime = (decayEnd - peakIndex) / sampleRate * 1000; // ms
        const decayRate = decayTime > 0 ? peakValue / decayTime : 0;

        return {
            attackTime: Math.round(attackTime * 10) / 10,
            peakAmplitude: Math.round(peakValue * 1000) / 1000,
            decayRate: Math.round(decayRate * 1000) / 1000
        };
    }

    /**
     * Get the smoothed RMS level (averaged over recent samples)
     * @returns {number} Smoothed RMS
     */
    getSmoothedRMS() {
        if (this.rmsHistory.length === 0) return 0;

        const windowSize = Math.min(5, this.rmsHistory.length);
        const recent = this.rmsHistory.slice(-windowSize);
        return recent.reduce((sum, s) => sum + s.rms, 0) / windowSize;
    }

    /**
     * Convert dynamic marking to a numeric level (0-5)
     * @param {string} dynamic - Dynamic marking string
     * @returns {number} Numeric level (0=pp, 1=p, 2=mp, 3=mf, 4=f, 5=ff)
     */
    static dynamicToLevel(dynamic) {
        const levels = { 'pp': 0, 'p': 1, 'mp': 2, 'mf': 3, 'f': 4, 'ff': 5 };
        return levels[dynamic] !== undefined ? levels[dynamic] : 3;
    }

    /**
     * Convert numeric level (0-5) to dynamic marking
     * @param {number} level - Numeric dynamic level
     * @returns {string} Dynamic marking
     */
    static levelToDynamic(level) {
        const dynamics = ['pp', 'p', 'mp', 'mf', 'f', 'ff'];
        const clamped = Math.max(0, Math.min(5, Math.round(level)));
        return dynamics[clamped];
    }

    /**
     * Get current analysis state
     * @returns {Object} Current volume envelope state
     */
    getState() {
        const lastTimestamp = this.rmsHistory.length > 0
            ? this.rmsHistory[this.rmsHistory.length - 1].timestamp
            : 0;
        return {
            currentDynamic: this.currentDynamic,
            currentTrend: this.currentTrend,
            smoothedRMS: this.getSmoothedRMS(),
            trendDuration: this.trendStartTime ? lastTimestamp - this.trendStartTime : 0,
            dynamicLevel: VolumeEnvelopeAnalyzer.dynamicToLevel(this.currentDynamic),
            historyLength: this.rmsHistory.length
        };
    }

    /**
     * Reset the analyzer
     */
    reset() {
        this.rmsHistory = [];
        this.currentDynamic = 'mf';
        this.currentTrend = 'stable';
        this.trendStartTime = null;
        this.trendStartLevel = null;
    }
}

window.VolumeEnvelopeAnalyzer = VolumeEnvelopeAnalyzer;
