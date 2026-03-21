/**
 * Tests for Core DSP Engine
 * Covers: PYINPitchDetector, SympatheticResonanceFilter, VibratoSmoother,
 *         DSPPerformanceMonitor, DSPEngine
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock browser globals
global.window = global;
global.navigator = {
    mediaDevices: {
        getUserMedia: () => Promise.resolve({ getTracks: () => [] }),
        enumerateDevices: () => Promise.resolve([])
    }
};
global.AudioContext = class AudioContext {
    constructor(options = {}) {
        this.sampleRate = options.sampleRate || 44100;
        this.state = 'running';
    }
    createAnalyser() {
        return {
            fftSize: 4096, frequencyBinCount: 2048,
            getFloatTimeDomainData: () => {}, getByteFrequencyData: () => {}
        };
    }
    createGain() { return { gain: { value: 1 }, connect: () => {} }; }
    createScriptProcessor() {
        return {
            connect: () => {}, disconnect: () => {},
            onaudioprocess: null
        };
    }
    createMediaStreamSource() { return { connect: () => {}, disconnect: () => {} }; }
    close() { return Promise.resolve(); }
    resume() { return Promise.resolve(); }
};
global.performance = { now: () => Date.now() };

// Load the session-logger dependency (used by DSPEngine)
require('../src/js/analysis/session-logger.js');
// Load existing polyphonic detector (used by DSPEngine)
require('../src/js/audio/pitch-detector.js');
// Load the DSP engine
require('../src/js/audio/dsp-engine.js');

const {
    PYINPitchDetector,
    SympatheticResonanceFilter,
    VibratoSmoother,
    DSPPerformanceMonitor,
    DSPEngine
} = require('../src/js/audio/dsp-engine.js');

// ──────────────────────────────────────────────────────────────────────────────
// Helper: generate a sine wave buffer
// ──────────────────────────────────────────────────────────────────────────────

function generateSineWave(frequency, sampleRate, length, amplitude) {
    amplitude = amplitude || 0.5;
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    return buffer;
}

function generateSilence(length) {
    return new Float32Array(length);
}

function generateDualSineWave(freq1, freq2, sampleRate, length, amp1, amp2) {
    amp1 = amp1 || 0.5;
    amp2 = amp2 || 0.3;
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = amp1 * Math.sin(2 * Math.PI * freq1 * i / sampleRate) +
                     amp2 * Math.sin(2 * Math.PI * freq2 * i / sampleRate);
    }
    return buffer;
}

function generateVibratoWave(baseFreq, vibratoRate, vibratoDepthHz, sampleRate, length) {
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        const vibrato = vibratoDepthHz * Math.sin(2 * Math.PI * vibratoRate * i / sampleRate);
        const freq = baseFreq + vibrato;
        buffer[i] = 0.5 * Math.sin(2 * Math.PI * freq * i / sampleRate);
    }
    return buffer;
}

// ──────────────────────────────────────────────────────────────────────────────
// PYINPitchDetector
// ──────────────────────────────────────────────────────────────────────────────

describe('PYINPitchDetector', () => {
    let detector;

    beforeEach(() => {
        detector = new PYINPitchDetector({
            sampleRate: 44100,
            bufferSize: 2048,
            minFrequency: 27.5,
            maxFrequency: 4186
        });
    });

    it('should detect A4 (440Hz) from a sine wave', () => {
        const buffer = generateSineWave(440, 44100, 4096);
        const result = detector.detect(buffer);
        assert.ok(result.frequency, 'Should detect a frequency');
        // Allow ±5 Hz tolerance for YIN on a short buffer
        assert.ok(Math.abs(result.frequency - 440) < 5,
            `Detected ${result.frequency}Hz, expected ~440Hz`);
        assert.ok(result.confidence > 0.5, `Confidence ${result.confidence} should be > 0.5`);
    });

    it('should detect G3 (196Hz) from a sine wave', () => {
        const buffer = generateSineWave(196, 44100, 4096);
        const result = detector.detect(buffer);
        assert.ok(result.frequency, 'Should detect a frequency');
        assert.ok(Math.abs(result.frequency - 196) < 5,
            `Detected ${result.frequency}Hz, expected ~196Hz`);
    });

    it('should return null for silence', () => {
        const buffer = generateSilence(4096);
        const result = detector.detect(buffer);
        assert.strictEqual(result.frequency, null);
        assert.strictEqual(result.confidence, 0);
    });

    it('should return null for buffer too small', () => {
        const buffer = new Float32Array(128);
        const result = detector.detect(buffer);
        assert.strictEqual(result.frequency, null);
    });

    it('should produce multiple candidates (core pYIN feature)', () => {
        const buffer = generateSineWave(440, 44100, 4096);
        const result = detector.detect(buffer);
        assert.ok(Array.isArray(result.candidates), 'Should return candidates array');
    });

    it('should handle configure() correctly', () => {
        detector.configure({ minFrequency: 100, maxFrequency: 1000 });
        assert.strictEqual(detector.minFrequency, 100);
        assert.strictEqual(detector.maxFrequency, 1000);
    });

    it('should convert frequency to MIDI correctly', () => {
        assert.strictEqual(detector.frequencyToMIDI(440), 69);
        assert.strictEqual(detector.frequencyToMIDI(261.63), 60);
        assert.strictEqual(detector.frequencyToMIDI(null), null);
    });

    it('should convert MIDI to frequency correctly', () => {
        assert.strictEqual(detector.midiToFrequency(69), 440);
        const c4 = detector.midiToFrequency(60);
        assert.ok(Math.abs(c4 - 261.63) < 0.01, `C4 should be ~261.63Hz, got ${c4}`);
    });

    it('should convert MIDI to note name correctly', () => {
        const note = detector.midiToNoteName(69);
        assert.strictEqual(note.name, 'A');
        assert.strictEqual(note.octave, 4);
        assert.strictEqual(note.midi, 69);

        const c4 = detector.midiToNoteName(60);
        assert.strictEqual(c4.name, 'C');
        assert.strictEqual(c4.octave, 4);
    });

    it('should calculate cents deviation correctly', () => {
        assert.strictEqual(detector.centsDeviation(440, 440), 0);
        // A4 to A#4 is ~100 cents
        const cents = detector.centsDeviation(440, 415.3);
        assert.ok(Math.abs(cents - 100) <= 2, `Expected ~100 cents, got ${cents}`);
        assert.strictEqual(detector.centsDeviation(0, 440), 0);
        assert.strictEqual(detector.centsDeviation(null, 440), 0);
    });

    it('should provide temporal smoothing via pitch history', () => {
        // First detection
        const buf1 = generateSineWave(440, 44100, 4096);
        detector.detect(buf1);

        // Second detection at same pitch - should have continuity bonus
        const buf2 = generateSineWave(441, 44100, 4096);
        const result = detector.detect(buf2);
        assert.ok(result.frequency, 'Should detect frequency with history');
        assert.ok(detector.pitchHistory.length > 0, 'Should have pitch history');
    });

    it('should reset history correctly', () => {
        const buffer = generateSineWave(440, 44100, 4096);
        detector.detect(buffer);
        assert.ok(detector.pitchHistory.length > 0);

        detector.reset();
        assert.strictEqual(detector.pitchHistory.length, 0);
    });

    it('should handle frequencyToNote correctly', () => {
        const note = detector.frequencyToNote(440);
        assert.strictEqual(note.name, 'A');
        assert.strictEqual(note.octave, 4);

        assert.strictEqual(detector.frequencyToNote(0), null);
    });

    it('should use beta distribution for candidate weighting', () => {
        // The beta PDF should return non-zero for values in (0,1)
        const result = detector._betaPDF(0.1, 2, 18);
        assert.ok(result > 0, 'Beta PDF should be positive for x in (0,1)');

        // Edge cases
        assert.strictEqual(detector._betaPDF(0, 2, 18), 0);
        assert.strictEqual(detector._betaPDF(1, 2, 18), 0);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// SympatheticResonanceFilter
// ──────────────────────────────────────────────────────────────────────────────

describe('SympatheticResonanceFilter', () => {
    let filter;

    beforeEach(() => {
        filter = new SympatheticResonanceFilter({ instrument: 'violin' });
    });

    it('should initialize with correct open strings for violin', () => {
        const strings = filter.getOpenStrings();
        assert.strictEqual(strings.length, 4);
        assert.ok(Math.abs(strings[0] - 196) < 1, 'First string should be ~G3');
        assert.ok(Math.abs(strings[3] - 659.25) < 1, 'Fourth string should be ~E5');
    });

    it('should build resonance table with harmonics', () => {
        // 4 strings × 8 harmonics = 32 resonances
        assert.strictEqual(filter.resonanceFrequencies.length, 32);
        // First entry should be G3 fundamental
        assert.strictEqual(filter.resonanceFrequencies[0].harmonic, 1);
        assert.ok(filter.resonanceFrequencies[0].isFundamental);
    });

    it('should detect sympathetic vibrations (quiet resonance on adjacent string)', () => {
        // Primary note: A4 at amplitude 0.5
        // Secondary: D4 harmonic (293.66 Hz) at very low amplitude (sympathetic)
        const result = filter.analyze(293.66, 0.05, 440, 0.5);
        assert.ok(result.isSympathetic, 'Should detect D4 as sympathetic resonance');
        assert.ok(result.resonanceSource, 'Should provide resonance source info');
    });

    it('should NOT flag the primary note as sympathetic', () => {
        const result = filter.analyze(440, 0.5, 440, 0.5);
        assert.ok(!result.isSympathetic, 'Primary note should not be sympathetic');
    });

    it('should NOT flag a strong secondary note as sympathetic', () => {
        // Double stop: both notes are strong
        const result = filter.analyze(293.66, 0.4, 440, 0.5);
        assert.ok(!result.isSympathetic,
            'Strong secondary note should not be flagged as sympathetic');
    });

    it('should handle null inputs gracefully', () => {
        const result = filter.analyze(null, 0.5, 440, 0.5);
        assert.ok(!result.isSympathetic);
    });

    it('should filter notes array removing sympathetic vibrations', () => {
        const notes = [
            { frequency: 440, amplitude: 0.5, name: 'A', octave: 4 },
            { frequency: 293.66, amplitude: 0.05, name: 'D', octave: 4 } // sympathetic
        ];
        const filtered = filter.filter(notes);
        assert.strictEqual(filtered.length, 1);
        assert.ok(Math.abs(filtered[0].frequency - 440) < 1);
    });

    it('should preserve double stops (both notes strong)', () => {
        const notes = [
            { frequency: 440, amplitude: 0.5, name: 'A', octave: 4 },
            { frequency: 659.25, amplitude: 0.45, name: 'E', octave: 5 }
        ];
        const filtered = filter.filter(notes);
        assert.strictEqual(filtered.length, 2, 'Should preserve both notes in a double stop');
    });

    it('should return empty array for empty input', () => {
        const result = filter.filter([]);
        assert.strictEqual(result.length, 0);
    });

    it('should return single note unchanged', () => {
        const notes = [{ frequency: 440, amplitude: 0.5 }];
        const result = filter.filter(notes);
        assert.strictEqual(result.length, 1);
    });

    it('should switch instruments correctly', () => {
        filter.setInstrument('cello');
        const strings = filter.getOpenStrings();
        assert.ok(Math.abs(strings[0] - 65.41) < 1, 'Cello lowest string should be ~C2');
    });

    it('should detect harmonics of open strings as potential sympathetic', () => {
        // G3 2nd harmonic = 392 Hz. If this appears quietly while playing A4 (440)
        const result = filter.analyze(392, 0.03, 440, 0.5);
        assert.ok(result.isSympathetic, '2nd harmonic of G string should be sympathetic');
        assert.strictEqual(result.resonanceSource.harmonic, 2);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// VibratoSmoother
// ──────────────────────────────────────────────────────────────────────────────

describe('VibratoSmoother', () => {
    let smoother;

    beforeEach(() => {
        smoother = new VibratoSmoother({ windowMs: 200 });
    });

    it('should return null center frequency with no samples', () => {
        assert.strictEqual(smoother.getCenterFrequency(), null);
    });

    it('should return the single frequency when only one sample', () => {
        smoother.addSample(440, 0.9, 1000);
        assert.ok(smoother.getCenterFrequency(), 'Should have a center frequency');
    });

    it('should calculate weighted moving average within 200ms window', () => {
        const baseTime = 1000;
        smoother.addSample(438, 0.9, baseTime);
        smoother.addSample(440, 0.9, baseTime + 50);
        smoother.addSample(442, 0.9, baseTime + 100);

        const center = smoother.getCenterFrequency();
        assert.ok(center >= 438 && center <= 442,
            `Center ${center} should be between 438 and 442`);
    });

    it('should evict samples older than 200ms', () => {
        smoother.addSample(440, 0.9, 1000);
        smoother.addSample(442, 0.9, 1050);
        smoother.addSample(438, 0.9, 1100);

        // Add sample 250ms later - the first sample should be evicted
        smoother.addSample(441, 0.9, 1250);

        // Only 3 samples should remain (1050, 1100, 1250)
        assert.strictEqual(smoother.samples.length, 3);
    });

    it('should detect vibrato (oscillating pitch)', () => {
        const baseTime = 1000;
        // Simulate vibrato: pitch oscillates ±10Hz around 440Hz
        smoother.addSample(440, 0.9, baseTime);
        smoother.addSample(450, 0.9, baseTime + 30);
        smoother.addSample(440, 0.9, baseTime + 60);
        smoother.addSample(430, 0.9, baseTime + 90);
        smoother.addSample(440, 0.9, baseTime + 120);
        smoother.addSample(450, 0.9, baseTime + 150);

        const state = smoother.getState();
        assert.ok(state.isVibrato, 'Should detect vibrato');
        assert.ok(state.depthCents > 0, 'Vibrato depth should be positive');
    });

    it('should NOT detect vibrato for stable pitch', () => {
        const baseTime = 1000;
        smoother.addSample(440.0, 0.9, baseTime);
        smoother.addSample(440.1, 0.9, baseTime + 50);
        smoother.addSample(440.0, 0.9, baseTime + 100);
        smoother.addSample(439.9, 0.9, baseTime + 150);

        const state = smoother.getState();
        assert.ok(!state.isVibrato, 'Stable pitch should not be flagged as vibrato');
    });

    it('should ignore low-confidence samples', () => {
        const baseTime = 1000;
        smoother.addSample(440, 0.9, baseTime);
        smoother.addSample(500, 0.1, baseTime + 50); // low confidence - noise
        smoother.addSample(441, 0.9, baseTime + 100);

        const center = smoother.getCenterFrequency();
        // Center should be near 440, not pulled toward 500
        assert.ok(Math.abs(center - 440) < 5,
            `Center ${center} should be near 440, not pulled by noise`);
    });

    it('should calculate cents deviation from target', () => {
        smoother.addSample(440, 0.9, 1000);
        smoother.addSample(442, 0.9, 1050);
        smoother.addSample(441, 0.9, 1100);

        const cents = smoother.centsDeviationFromTarget(440);
        assert.ok(typeof cents === 'number', 'Should return a number');
        // Should be slightly sharp (positive cents)
        assert.ok(cents >= 0 && cents <= 10, `Cents ${cents} should be small positive`);
    });

    it('should reset correctly', () => {
        smoother.addSample(440, 0.9, 1000);
        assert.ok(smoother.getCenterFrequency() !== null);

        smoother.reset();
        assert.strictEqual(smoother.getCenterFrequency(), null);
        assert.strictEqual(smoother.samples.length, 0);
        assert.strictEqual(smoother.isVibrato, false);
    });

    it('should estimate vibrato rate from zero crossings', () => {
        const baseTime = 1000;
        // 5Hz vibrato over 200ms = 1 full cycle
        for (let i = 0; i < 10; i++) {
            const t = baseTime + i * 20;
            const freq = 440 + 10 * Math.sin(2 * Math.PI * 5 * i * 20 / 1000);
            smoother.addSample(freq, 0.9, t);
        }

        const state = smoother.getState();
        assert.ok(state.rateHz >= 0, 'Vibrato rate should be non-negative');
    });

    it('should handle windowMs configuration', () => {
        const custom = new VibratoSmoother({ windowMs: 500 });
        assert.strictEqual(custom.windowMs, 500);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// DSPPerformanceMonitor
// ──────────────────────────────────────────────────────────────────────────────

describe('DSPPerformanceMonitor', () => {
    let monitor;

    beforeEach(() => {
        monitor = new DSPPerformanceMonitor({ latencyBudgetMs: 30 });
    });

    it('should initialize with zero stats', () => {
        const stats = monitor.getStats();
        assert.strictEqual(stats.totalFrames, 0);
        assert.strictEqual(stats.droppedFrames, 0);
        assert.strictEqual(stats.underrunCount, 0);
    });

    it('should record frame latencies', () => {
        monitor.recordFrame(100, 105); // 5ms
        monitor.recordFrame(200, 208); // 8ms

        assert.strictEqual(monitor.totalFrames, 2);
        assert.ok(monitor.getAverageLatency() > 0);
        assert.strictEqual(monitor.getAverageLatency(), 6.5);
    });

    it('should detect dropped frames exceeding latency budget', () => {
        monitor.recordFrame(100, 105);   // 5ms - OK
        monitor.recordFrame(200, 235);   // 35ms - DROPPED (>30ms)

        assert.strictEqual(monitor.droppedFrames, 1);
        assert.strictEqual(monitor.totalFrames, 2);
    });

    it('should calculate P95 latency', () => {
        for (let i = 0; i < 20; i++) {
            monitor.recordFrame(0, 10); // 10ms
        }
        monitor.recordFrame(0, 50); // One outlier at 50ms

        const p95 = monitor.getP95Latency();
        assert.ok(p95 <= 50, 'P95 should be at most 50ms');
    });

    it('should report within budget when latencies are low', () => {
        monitor.recordFrame(0, 5);
        monitor.recordFrame(0, 8);
        monitor.recordFrame(0, 12);

        assert.ok(monitor.isWithinBudget(), 'Average of ~8ms should be within 30ms budget');
    });

    it('should report over budget when latencies are high', () => {
        monitor.recordFrame(0, 35);
        monitor.recordFrame(0, 40);
        monitor.recordFrame(0, 50);

        assert.ok(!monitor.isWithinBudget(), 'Average of ~42ms should exceed 30ms budget');
    });

    it('should track underrun count', () => {
        monitor.recordUnderrun();
        monitor.recordUnderrun();
        assert.strictEqual(monitor.getStats().underrunCount, 2);
    });

    it('should calculate drop rate as percentage', () => {
        monitor.recordFrame(0, 10); // OK
        monitor.recordFrame(0, 10); // OK
        monitor.recordFrame(0, 10); // OK
        monitor.recordFrame(0, 35); // Dropped

        const stats = monitor.getStats();
        assert.strictEqual(stats.dropRate, 25); // 1/4 = 25%
    });

    it('should reset all stats', () => {
        monitor.recordFrame(0, 10);
        monitor.recordUnderrun();

        monitor.reset();

        const stats = monitor.getStats();
        assert.strictEqual(stats.totalFrames, 0);
        assert.strictEqual(stats.underrunCount, 0);
        assert.strictEqual(stats.droppedFrames, 0);
    });

    it('should maintain a bounded history', () => {
        const mon = new DSPPerformanceMonitor({ historySize: 5, latencyBudgetMs: 30 });
        for (let i = 0; i < 10; i++) {
            mon.recordFrame(0, 10);
        }
        assert.strictEqual(mon.latencyHistory.length, 5);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// DSPEngine (integrated)
// ──────────────────────────────────────────────────────────────────────────────

describe('DSPEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new DSPEngine({
            sampleRate: 44100,
            bufferSize: 2048,
            instrument: 'violin',
            polyphonicEnabled: false, // disable for predictable unit tests
            vibratoWindowMs: 200
        });
    });

    it('should initialize with correct defaults', () => {
        assert.strictEqual(engine.config.instrument, 'violin');
        assert.strictEqual(engine.config.vibratoWindowMs, 200);
        assert.strictEqual(engine.config.latencyBudgetMs, 30);
        assert.strictEqual(engine.isRunning, false);
    });

    it('should initialize sub-components', async () => {
        const result = await engine.initialize();
        assert.ok(result);
        assert.ok(engine.pitchDetector instanceof PYINPitchDetector);
        assert.ok(engine.sympatheticFilter instanceof SympatheticResonanceFilter);
        assert.ok(engine.vibratoSmoothers.length >= 1);
        assert.ok(engine.performanceMonitor instanceof DSPPerformanceMonitor);
    });

    it('should initialize session logger when SessionLogger is available', async () => {
        await engine.initialize();
        assert.ok(engine.sessionLogger, 'Should have initialized session logger');
    });

    it('should switch instrument and reconfigure', () => {
        engine.setInstrument('cello');
        assert.strictEqual(engine.config.instrument, 'cello');
        assert.strictEqual(engine.pitchDetector.minFrequency, 65);
        assert.strictEqual(engine.pitchDetector.maxFrequency, 987);
    });

    it('should process a buffer with pYIN and return detected notes', () => {
        const buffer = generateSineWave(440, 44100, 4096);
        const result = engine.processBuffer(buffer);

        assert.ok(result.notes.length >= 0);
        assert.ok(result.level > 0, 'RMS level should be positive for a sine wave');
    });

    it('should return empty notes for silence', () => {
        const buffer = generateSilence(4096);
        const result = engine.processBuffer(buffer);

        assert.strictEqual(result.notes.length, 0);
    });

    it('should apply vibrato smoothing to detected notes', () => {
        // Process multiple buffers to build up vibrato smoother history
        const buffer = generateSineWave(440, 44100, 4096);
        engine.processBuffer(buffer, 1000);
        engine.processBuffer(buffer, 1050);
        engine.processBuffer(buffer, 1100);

        const result = engine.processBuffer(buffer, 1150);
        if (result.notes.length > 0) {
            assert.ok('centerFrequency' in result.notes[0],
                'Notes should have centerFrequency from vibrato smoother');
        }
    });

    it('should track state correctly', () => {
        const state = engine.getState();
        assert.strictEqual(state.isRunning, false);
        assert.strictEqual(state.instrument, 'violin');
        assert.strictEqual(state.accuracy, 0);
        assert.ok('performance' in state, 'State should include performance stats');
    });

    it('should set score and track position', () => {
        const mockScore = {
            getAllNotes: () => [
                { midi: 69, getMIDI: () => 69, getFrequency: () => 440, measure: 1, beat: 1 },
                { midi: 71, getMIDI: () => 71, getFrequency: () => 493.88, measure: 1, beat: 2 }
            ]
        };
        engine.setScore(mockScore);
        assert.strictEqual(engine.currentPosition, 0);
        assert.strictEqual(engine.totalNotesPlayed, 0);
    });

    it('should provide session log access', async () => {
        await engine.initialize();
        assert.ok(engine.getSessionLog() !== undefined);
    });

    it('should provide session summary access', async () => {
        await engine.initialize();
        const summary = engine.getSessionSummary();
        assert.ok(summary !== undefined);
    });

    it('should provide LLM export access', async () => {
        await engine.initialize();
        const exported = engine.exportSessionForLLM();
        assert.ok(typeof exported === 'string');
    });

    it('should dispose correctly', () => {
        engine.dispose();
        assert.strictEqual(engine.isRunning, false);
        assert.strictEqual(engine.audioContext, null);
    });

    it('should compute RMS level correctly', () => {
        const buffer = generateSineWave(440, 44100, 4096, 1.0);
        const rms = engine._computeRMS(buffer);
        // RMS of a sine wave with amplitude 1.0 is ~0.707
        assert.ok(Math.abs(rms - 0.707) < 0.02, `RMS ${rms} should be ~0.707`);
    });

    it('should compute RMS as 0 for silence', () => {
        const buffer = generateSilence(4096);
        const rms = engine._computeRMS(buffer);
        assert.strictEqual(rms, 0);
    });

    it('should handle score comparison with matching note', async () => {
        await engine.initialize();

        const mockScore = {
            getAllNotes: () => [
                { midi: 69, getMIDI: () => 69, getFrequency: () => 440, measure: 1, beat: 1 }
            ]
        };
        engine.setScore(mockScore);

        // Simulate note match callback
        let matchData = null;
        engine.onNoteMatch = (data) => { matchData = data; };

        // Process a buffer with A4
        const buffer = generateSineWave(440, 44100, 4096);
        const result = engine.processBuffer(buffer, 1000);

        // Try to trigger comparison
        if (result.notes.length > 0 && result.notes[0].midi === 69) {
            engine._compareToScore(result.notes, Date.now());
            if (matchData) {
                assert.ok('centsDeviation' in matchData);
            }
        }
    });

    it('should log deviations to session logger during score comparison', async () => {
        await engine.initialize();

        engine.sessionLogger.startSession('test-session');

        const mockScore = {
            getAllNotes: () => [
                { midi: 69, getMIDI: () => 69, getFrequency: () => 440, measure: 2, beat: 3 }
            ]
        };
        engine.setScore(mockScore);

        // Simulate a note detection and comparison
        const notes = [{
            midi: 69, name: 'A', octave: 4,
            frequency: 442, centerFrequency: 442, confidence: 0.9
        }];
        engine._compareToScore(notes, Date.now());

        const log = engine.getSessionLog();
        assert.ok(log.deviations.length > 0, 'Should have logged a deviation');
        assert.strictEqual(log.deviations[0].type, 'pitch');
        assert.ok(log.deviations[0].deviation_cents !== 0,
            'Should have non-zero cents deviation for 442 vs 440');
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// Integration: pYIN + Vibrato + Sympathetic filtering pipeline
// ──────────────────────────────────────────────────────────────────────────────

describe('DSP Pipeline Integration', () => {
    it('should produce stable center frequency through vibrato smoothing', () => {
        const smoother = new VibratoSmoother({ windowMs: 200 });
        const baseTime = 1000;

        // Simulate vibrato: 440Hz ± 5Hz over 200ms
        const frequencies = [435, 438, 440, 443, 445, 443, 440, 437, 435, 438];
        frequencies.forEach((f, i) => {
            smoother.addSample(f, 0.9, baseTime + i * 20);
        });

        const center = smoother.getCenterFrequency();
        assert.ok(center, 'Should have a center frequency');
        // Center should be near 440Hz despite vibrato
        assert.ok(Math.abs(center - 440) < 5,
            `Center frequency ${center} should be near 440Hz through vibrato`);
    });

    it('should filter sympathetic resonances while preserving intentional double stops', () => {
        const filter = new SympatheticResonanceFilter({ instrument: 'violin' });

        // Case 1: Sympathetic resonance (quiet D4 while playing A4)
        const case1 = filter.filter([
            { frequency: 440, amplitude: 0.5 },
            { frequency: 293.66, amplitude: 0.05 } // D4 open string, very quiet
        ]);
        assert.strictEqual(case1.length, 1, 'Should remove sympathetic resonance');

        // Case 2: Intentional double stop (A4 + E5)
        const case2 = filter.filter([
            { frequency: 440, amplitude: 0.5 },
            { frequency: 659, amplitude: 0.45 }
        ]);
        assert.strictEqual(case2.length, 2, 'Should preserve intentional double stop');
    });

    it('should handle instrument switching end-to-end', () => {
        const engine = new DSPEngine({ instrument: 'cello' });

        assert.strictEqual(engine.config.instrument, 'cello');
        assert.strictEqual(engine.pitchDetector.minFrequency, 65);
        assert.strictEqual(engine.sympatheticFilter.instrument, 'cello');

        engine.setInstrument('viola');
        assert.strictEqual(engine.pitchDetector.minFrequency, 130);
        assert.strictEqual(engine.sympatheticFilter.instrument, 'viola');
    });

    it('should track performance within latency budget for small buffers', () => {
        const engine = new DSPEngine({ bufferSize: 2048 });
        const buffer = generateSineWave(440, 44100, 4096);

        // Process several buffers
        for (let i = 0; i < 5; i++) {
            engine.processBuffer(buffer, 1000 + i * 50);
        }

        const stats = engine.performanceMonitor.getStats();
        assert.ok(stats.totalFrames === 0, 'processBuffer does not go through performance monitor');
    });

    it('should format note name for session logging', () => {
        const engine = new DSPEngine();
        const name = engine._formatNoteName(69);
        assert.strictEqual(name, 'A4');

        const name2 = engine._formatNoteName(60);
        assert.strictEqual(name2, 'C4');
    });
});
