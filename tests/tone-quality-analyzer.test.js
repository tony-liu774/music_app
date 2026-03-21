/**
 * Tests for Tone Quality Analyzer
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// Define window first
global.window = global;
global.navigator = { mediaDevices: { getUserMedia: () => {}, enumerateDevices: () => {} } };
global.AudioContext = class AudioContext {
    constructor(options = {}) { this.sampleRate = options.sampleRate || 44100; }
    createAnalyser() { return { fftSize: 4096, frequencyBinCount: 2048, getFloatFrequencyData: () => {}, getFloatTimeDomainData: () => {} }; }
    createBuffer() { return { getChannelData: () => new Float32Array(44100) }; }
    createGain() { return { gain: { value: 1 } }; }
    createMediaStreamSource() { return { connect: () => {}, disconnect: () => {} }; }
    close() {}
    resume() {}
};

require('../src/js/audio/tone-quality-analyzer.js');

const ToneQualityAnalyzer = global.window.ToneQualityAnalyzer;

describe('ToneQualityAnalyzer', () => {
    let analyzer;

    beforeEach(() => {
        analyzer = new ToneQualityAnalyzer();
        analyzer.configure({ sampleRate: 44100, fftSize: 4096, bufferSize: 2048, instrument: 'violin' });
    });

    test('should have default values', () => {
        assert.strictEqual(analyzer.sampleRate, 44100);
        assert.strictEqual(analyzer.fftSize, 4096);
        assert.strictEqual(analyzer.instrument, 'violin');
    });

    test('should configure instrument', () => {
        analyzer.configure({ instrument: 'cello' });
        assert.strictEqual(analyzer.instrument, 'cello');
    });

    test('should have instrument frequency ranges', () => {
        assert.deepStrictEqual(analyzer.instrumentRanges.violin, { min: 196, max: 2637 });
        assert.deepStrictEqual(analyzer.instrumentRanges.viola, { min: 130, max: 1319 });
        assert.deepStrictEqual(analyzer.instrumentRanges.cello, { min: 65, max: 987 });
        assert.deepStrictEqual(analyzer.instrumentRanges.bass, { min: 41, max: 262 });
    });

    test('should compute FFT bins', () => {
        const frequencies = analyzer.computeFrequencyBins();
        assert.strictEqual(frequencies.length, analyzer.fftSize / 2);
    });

    test('should handle empty buffer', () => {
        const result = analyzer.analyze(null, 440);
        assert.strictEqual(result.qualityScore, 50);
        assert.strictEqual(result.purityScore, 50);
    });

    test('should handle small buffer', () => {
        const smallBuffer = new Float32Array(100);
        const result = analyzer.analyze(smallBuffer, 440);
        assert.strictEqual(result.qualityScore, 50);
    });

    test('should calculate purity score from harmonics', () => {
        const harmonicAnalysis = {
            harmonics: [
                { harmonic: 1, amplitude: 1.0 },
                { harmonic: 2, amplitude: 0.5 },
                { harmonic: 3, amplitude: 0.33 },
                { harmonic: 4, amplitude: 0.25 }
            ],
            ratios: [1.0, 0.5, 0.33, 0.25],
            fundamentalAmplitude: 1.0
        };

        const purityScore = analyzer.calculatePurityScore(harmonicAnalysis);
        assert.ok(purityScore > 50, 'Good harmonic series should have high purity');
    });

    test('should penalize unbalanced harmonics', () => {
        const harmonicAnalysis = {
            harmonics: [
                { harmonic: 1, amplitude: 0.3 },
                { harmonic: 2, amplitude: 1.0 },
                { harmonic: 3, amplitude: 0.2 },
                { harmonic: 4, amplitude: 0.8 }
            ],
            ratios: [0.3, 1.0, 0.2, 0.8],
            fundamentalAmplitude: 0.3
        };

        const purityScore = analyzer.calculatePurityScore(harmonicAnalysis);
        assert.ok(purityScore < 80, 'Unbalanced harmonics should have lower purity');
    });

    test('should detect good tone', () => {
        const fft = new Float32Array(2048);
        const frequencies = analyzer.computeFrequencyBins();

        const violinRange = analyzer.instrumentRanges.violin;
        const lowMidStart = Math.floor(violinRange.min * analyzer.fftSize / analyzer.sampleRate);
        const highStart = Math.floor(violinRange.max * 0.5 * analyzer.fftSize / analyzer.sampleRate);

        for (let i = lowMidStart; i < highStart; i++) {
            fft[i] = 0.5;
        }
        for (let i = highStart; i < fft.length; i++) {
            fft[i] = 0.05;
        }

        const result = analyzer.detectHarshness(fft, frequencies, violinRange);
        assert.strictEqual(result.level, 'good');
        assert.ok(result.score > 60);
    });

    test('should detect harsh tone', () => {
        const fft = new Float32Array(2048);
        const frequencies = analyzer.computeFrequencyBins();

        const violinRange = analyzer.instrumentRanges.violin;
        const lowMidStart = Math.floor(violinRange.min * analyzer.fftSize / analyzer.sampleRate);
        const highStart = Math.floor(violinRange.max * 0.5 * analyzer.fftSize / analyzer.sampleRate);

        for (let i = lowMidStart; i < highStart; i++) {
            fft[i] = 0.2;
        }
        for (let i = highStart; i < fft.length; i++) {
            fft[i] = 0.8;
        }

        const result = analyzer.detectHarshness(fft, frequencies, violinRange);
        assert.ok(result.score < 60, 'Harsh tone should have lower score');
    });

    test('should return emerald color for good tone', () => {
        const color = ToneQualityAnalyzer.getQualityColor(80);
        assert.strictEqual(color, '#10b981');
    });

    test('should return amber color for acceptable tone', () => {
        const color = ToneQualityAnalyzer.getQualityColor(50);
        assert.strictEqual(color, '#f59e0b');
    });

    test('should return crimson for harsh tone', () => {
        const color = ToneQualityAnalyzer.getQualityColor(30);
        assert.strictEqual(color, '#dc2626');
    });

    test('should return correct status', () => {
        assert.strictEqual(ToneQualityAnalyzer.getQualityStatus(90), 'excellent');
        assert.strictEqual(ToneQualityAnalyzer.getQualityStatus(70), 'good');
        assert.strictEqual(ToneQualityAnalyzer.getQualityStatus(50), 'acceptable');
        assert.strictEqual(ToneQualityAnalyzer.getQualityStatus(30), 'harsh');
        assert.strictEqual(ToneQualityAnalyzer.getQualityStatus(10), 'very_harsh');
    });

    test('should reset analysis state', () => {
        analyzer.qualityHistory = [80, 85, 90];
        analyzer.currentPurityScore = 75;
        analyzer.currentHarshnessScore = 80;
        analyzer.wolfToneDetected = true;

        analyzer.reset();

        assert.strictEqual(analyzer.qualityHistory.length, 0);
        assert.strictEqual(analyzer.currentPurityScore, 0);
        assert.strictEqual(analyzer.currentHarshnessScore, 0);
        assert.strictEqual(analyzer.wolfToneDetected, false);
    });

    test('should work with all instruments', () => {
        const instruments = ['violin', 'viola', 'cello', 'bass'];

        instruments.forEach(instrument => {
            analyzer.configure({ instrument });
            assert.strictEqual(analyzer.instrument, instrument);

            const result = analyzer.analyze(new Float32Array(2048), 440);
            assert.ok(result.qualityScore !== undefined);
        });
    });

    test('should penalize wolf tones', () => {
        const purityScore = 85;
        const harshnessScore = 90;
        const wolfToneDetected = false;

        const scoreWithoutWolf = analyzer.calculateToneQualityScore(purityScore, harshnessScore, wolfToneDetected);

        const scoreWithWolf = analyzer.calculateToneQualityScore(purityScore, harshnessScore, true);

        assert.ok(scoreWithWolf < scoreWithoutWolf, 'Wolf tone should reduce quality score');
    });
});
