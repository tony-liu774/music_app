/**
 * Tests for VolumeEnvelopeAnalyzer
 * Run with: node tests/volume-envelope-analyzer.test.js
 */

// Inline the class for testing (browser module)
class VolumeEnvelopeAnalyzer {
    constructor() {
        this.rmsHistory = [];
        this.maxHistorySize = 100;
        this.dynamicThresholds = {
            pp: 0.02, p: 0.05, mp: 0.10, mf: 0.18, f: 0.30, ff: 0.45
        };
        this.windowSize = 8;
        this.crescendoThreshold = 0.015;
        this.decrescendoThreshold = 0.015;
        this.currentDynamic = 'mf';
        this.currentTrend = 'stable';
        this.trendStartTime = null;
        this.trendStartLevel = null;
    }

    addSample(rmsLevel, timestamp = Date.now()) {
        this.rmsHistory.push({ rms: Math.max(0, rmsLevel), timestamp });
        if (this.rmsHistory.length > this.maxHistorySize) this.rmsHistory.shift();
        this.currentDynamic = this.classifyDynamic(rmsLevel);
        const trend = this.detectTrend();
        if (trend !== this.currentTrend) {
            this.trendStartTime = timestamp;
            this.trendStartLevel = rmsLevel;
            this.currentTrend = trend;
        }
        return this.getState();
    }

    classifyDynamic(rmsLevel) {
        if (rmsLevel >= this.dynamicThresholds.ff) return 'ff';
        if (rmsLevel >= this.dynamicThresholds.f) return 'f';
        if (rmsLevel >= this.dynamicThresholds.mf) return 'mf';
        if (rmsLevel >= this.dynamicThresholds.mp) return 'mp';
        if (rmsLevel >= this.dynamicThresholds.p) return 'p';
        return 'pp';
    }

    detectTrend() {
        if (this.rmsHistory.length < this.windowSize) return 'stable';
        const recent = this.rmsHistory.slice(-this.windowSize);
        const slope = this.calculateSlope(recent.map(s => s.rms));
        if (slope > this.crescendoThreshold) return 'crescendo';
        if (slope < -this.decrescendoThreshold) return 'decrescendo';
        return 'stable';
    }

    calculateSlope(values) {
        const n = values.length;
        if (n < 2) return 0;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += i; sumY += values[i]; sumXY += i * values[i]; sumXX += i * i;
        }
        const denominator = n * sumXX - sumX * sumX;
        if (denominator === 0) return 0;
        return (n * sumXY - sumX * sumY) / denominator;
    }

    analyzeAttack(audioBuffer, sampleRate = 44100) {
        if (!audioBuffer || audioBuffer.length === 0) {
            return { attackTime: 0, peakAmplitude: 0, decayRate: 0 };
        }
        let peakIndex = 0, peakValue = 0;
        for (let i = 0; i < audioBuffer.length; i++) {
            const abs = Math.abs(audioBuffer[i]);
            if (abs > peakValue) { peakValue = abs; peakIndex = i; }
        }
        const threshold = peakValue * 0.1;
        let attackStart = 0;
        for (let i = 0; i < peakIndex; i++) {
            if (Math.abs(audioBuffer[i]) > threshold) { attackStart = i; break; }
        }
        const attackTime = (peakIndex - attackStart) / sampleRate * 1000;
        let decayEnd = audioBuffer.length - 1;
        const decayThreshold = peakValue * 0.5;
        for (let i = peakIndex; i < audioBuffer.length; i++) {
            if (Math.abs(audioBuffer[i]) < decayThreshold) { decayEnd = i; break; }
        }
        const decayTime = (decayEnd - peakIndex) / sampleRate * 1000;
        const decayRate = decayTime > 0 ? peakValue / decayTime : 0;
        return {
            attackTime: Math.round(attackTime * 10) / 10,
            peakAmplitude: Math.round(peakValue * 1000) / 1000,
            decayRate: Math.round(decayRate * 1000) / 1000
        };
    }

    getSmoothedRMS() {
        if (this.rmsHistory.length === 0) return 0;
        const windowSize = Math.min(5, this.rmsHistory.length);
        const recent = this.rmsHistory.slice(-windowSize);
        return recent.reduce((sum, s) => sum + s.rms, 0) / windowSize;
    }

    static dynamicToLevel(dynamic) {
        const levels = { 'pp': 0, 'p': 1, 'mp': 2, 'mf': 3, 'f': 4, 'ff': 5 };
        return levels[dynamic] !== undefined ? levels[dynamic] : 3;
    }

    static levelToDynamic(level) {
        const dynamics = ['pp', 'p', 'mp', 'mf', 'f', 'ff'];
        const clamped = Math.max(0, Math.min(5, Math.round(level)));
        return dynamics[clamped];
    }

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

    reset() {
        this.rmsHistory = [];
        this.currentDynamic = 'mf';
        this.currentTrend = 'stable';
        this.trendStartTime = null;
        this.trendStartLevel = null;
    }
}

// Test runner
function runTests() {
    console.log('Running VolumeEnvelopeAnalyzer Tests...\n');
    let passed = 0, failed = 0;

    function test(name, fn) {
        try { fn(); console.log(`✓ ${name}`); passed++; }
        catch (e) { console.log(`✗ ${name}\n  Error: ${e.message}`); failed++; }
    }

    function assertEqual(actual, expected, msg) {
        if (actual !== expected) throw new Error(`${msg}: expected ${expected}, got ${actual}`);
    }

    function assertTrue(value, msg) {
        if (!value) throw new Error(msg || 'Expected true');
    }

    // Test 1: Classify dynamics from RMS
    test('should classify pp dynamic from very low RMS', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        assertEqual(analyzer.classifyDynamic(0.01), 'pp', 'Very quiet = pp');
    });

    test('should classify p dynamic', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        assertEqual(analyzer.classifyDynamic(0.06), 'p', 'Quiet = p');
    });

    test('should classify mp dynamic', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        assertEqual(analyzer.classifyDynamic(0.12), 'mp', 'Moderate quiet = mp');
    });

    test('should classify mf dynamic', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        assertEqual(analyzer.classifyDynamic(0.20), 'mf', 'Moderate loud = mf');
    });

    test('should classify f dynamic', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        assertEqual(analyzer.classifyDynamic(0.35), 'f', 'Loud = f');
    });

    test('should classify ff dynamic', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        assertEqual(analyzer.classifyDynamic(0.50), 'ff', 'Very loud = ff');
    });

    // Test 2: Detect crescendo trend
    test('should detect crescendo from rising RMS values', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        // Feed rising RMS values
        for (let i = 0; i < 10; i++) {
            analyzer.addSample(0.05 + i * 0.03, 1000 + i * 50);
        }
        const state = analyzer.getState();
        assertEqual(state.currentTrend, 'crescendo', 'Rising volumes = crescendo');
    });

    // Test 3: Detect decrescendo trend
    test('should detect decrescendo from falling RMS values', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        for (let i = 0; i < 10; i++) {
            analyzer.addSample(0.50 - i * 0.03, 1000 + i * 50);
        }
        const state = analyzer.getState();
        assertEqual(state.currentTrend, 'decrescendo', 'Falling volumes = decrescendo');
    });

    // Test 4: Detect stable trend
    test('should detect stable when RMS values are constant', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        for (let i = 0; i < 10; i++) {
            analyzer.addSample(0.20, 1000 + i * 50);
        }
        const state = analyzer.getState();
        assertEqual(state.currentTrend, 'stable', 'Constant volumes = stable');
    });

    // Test 5: Calculate slope
    test('should calculate positive slope for increasing values', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        const slope = analyzer.calculateSlope([0.1, 0.2, 0.3, 0.4]);
        assertTrue(slope > 0, 'Slope should be positive');
    });

    test('should calculate negative slope for decreasing values', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        const slope = analyzer.calculateSlope([0.4, 0.3, 0.2, 0.1]);
        assertTrue(slope < 0, 'Slope should be negative');
    });

    test('should calculate zero slope for constant values', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        const slope = analyzer.calculateSlope([0.2, 0.2, 0.2, 0.2]);
        assertEqual(slope, 0, 'Slope should be zero');
    });

    // Test 6: Smoothed RMS
    test('should return smoothed RMS from recent samples', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        analyzer.addSample(0.10, 1000);
        analyzer.addSample(0.20, 1050);
        analyzer.addSample(0.30, 1100);
        const smoothed = analyzer.getSmoothedRMS();
        assertTrue(Math.abs(smoothed - 0.20) < 0.001, `Smoothed should be ~0.20, got ${smoothed}`);
    });

    // Test 7: Dynamic to level conversion
    test('should convert dynamic markings to numeric levels', () => {
        assertEqual(VolumeEnvelopeAnalyzer.dynamicToLevel('pp'), 0, 'pp = 0');
        assertEqual(VolumeEnvelopeAnalyzer.dynamicToLevel('p'), 1, 'p = 1');
        assertEqual(VolumeEnvelopeAnalyzer.dynamicToLevel('mp'), 2, 'mp = 2');
        assertEqual(VolumeEnvelopeAnalyzer.dynamicToLevel('mf'), 3, 'mf = 3');
        assertEqual(VolumeEnvelopeAnalyzer.dynamicToLevel('f'), 4, 'f = 4');
        assertEqual(VolumeEnvelopeAnalyzer.dynamicToLevel('ff'), 5, 'ff = 5');
    });

    // Test 8: Level to dynamic conversion
    test('should convert numeric levels to dynamic markings', () => {
        assertEqual(VolumeEnvelopeAnalyzer.levelToDynamic(0), 'pp', '0 = pp');
        assertEqual(VolumeEnvelopeAnalyzer.levelToDynamic(3), 'mf', '3 = mf');
        assertEqual(VolumeEnvelopeAnalyzer.levelToDynamic(5), 'ff', '5 = ff');
    });

    // Test 9: Analyze attack from audio buffer
    test('should analyze attack envelope from audio buffer', () => {
        // Simulate a sharp attack then decay
        const buffer = new Float32Array(4410); // 0.1 seconds at 44100
        for (let i = 0; i < buffer.length; i++) {
            if (i < 100) buffer[i] = i / 100 * 0.8; // Fast ramp up
            else buffer[i] = 0.8 * Math.exp(-(i - 100) / 500); // Exponential decay
        }
        const analyzer = new VolumeEnvelopeAnalyzer();
        const result = analyzer.analyzeAttack(buffer);
        assertTrue(result.peakAmplitude > 0.5, `Peak should be > 0.5, got ${result.peakAmplitude}`);
        assertTrue(result.attackTime > 0, 'Attack time should be > 0');
    });

    test('should handle empty audio buffer in analyzeAttack', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        const result = analyzer.analyzeAttack(new Float32Array(0));
        assertEqual(result.attackTime, 0, 'Empty buffer: attackTime = 0');
        assertEqual(result.peakAmplitude, 0, 'Empty buffer: peakAmplitude = 0');
    });

    test('should handle null audio buffer', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        const result = analyzer.analyzeAttack(null);
        assertEqual(result.attackTime, 0, 'Null buffer: attackTime = 0');
    });

    // Test 10: History size limit
    test('should limit history size', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        for (let i = 0; i < 150; i++) {
            analyzer.addSample(0.20, 1000 + i * 10);
        }
        assertTrue(analyzer.rmsHistory.length <= 100, 'History should be bounded at 100');
    });

    // Test 11: Reset
    test('should reset all state', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        analyzer.addSample(0.30, 1000);
        analyzer.addSample(0.40, 1050);
        analyzer.reset();
        assertEqual(analyzer.rmsHistory.length, 0, 'History cleared');
        assertEqual(analyzer.currentDynamic, 'mf', 'Dynamic reset to mf');
        assertEqual(analyzer.currentTrend, 'stable', 'Trend reset to stable');
    });

    // Test 12: State object
    test('should return complete state object', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        analyzer.addSample(0.25, 1000);
        const state = analyzer.getState();
        assertTrue(state.currentDynamic !== undefined, 'State has currentDynamic');
        assertTrue(state.currentTrend !== undefined, 'State has currentTrend');
        assertTrue(state.smoothedRMS !== undefined, 'State has smoothedRMS');
        assertTrue(state.dynamicLevel !== undefined, 'State has dynamicLevel');
        assertTrue(state.historyLength !== undefined, 'State has historyLength');
    });

    // Test 13: Negative RMS clamped
    test('should clamp negative RMS to 0', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        analyzer.addSample(-0.5, 1000);
        assertEqual(analyzer.rmsHistory[0].rms, 0, 'Negative RMS clamped to 0');
    });

    // Test 14: trendDuration uses sample timestamp, not Date.now()
    test('should compute trendDuration from sample timestamps', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        // Feed rising values to trigger a crescendo trend change
        for (let i = 0; i < 10; i++) {
            analyzer.addSample(0.05 + i * 0.03, 5000 + i * 50);
        }
        const state = analyzer.getState();
        // trendDuration should be based on last sample timestamp minus trendStartTime
        // Not dependent on Date.now(), so should be a small fixed value
        assertTrue(state.trendDuration >= 0, 'trendDuration should be >= 0');
        assertTrue(state.trendDuration <= 500, `trendDuration should be based on sample timestamps, got ${state.trendDuration}`);
    });

    // Test 15: analyzeAttack accepts custom sampleRate
    test('should accept custom sampleRate in analyzeAttack', () => {
        const analyzer = new VolumeEnvelopeAnalyzer();
        const buffer = new Float32Array(4800); // 0.1s at 48000
        for (let i = 0; i < buffer.length; i++) {
            if (i < 100) buffer[i] = i / 100 * 0.8;
            else buffer[i] = 0.8 * Math.exp(-(i - 100) / 500);
        }
        const result44 = analyzer.analyzeAttack(buffer, 44100);
        const result48 = analyzer.analyzeAttack(buffer, 48000);
        // Higher sampleRate = shorter attack time for same number of samples
        assertTrue(result48.attackTime < result44.attackTime, 'Higher sampleRate should yield shorter attack time');
    });

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

runTests();
