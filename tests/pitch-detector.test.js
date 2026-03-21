/**
 * Tests for Pitch Detector - Using Node's native test framework
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Define window first
global.window = global;
global.navigator = { mediaDevices: { getUserMedia: () => Promise.resolve(), enumerateDevices: () => Promise.resolve([]) } };
global.AudioContext = class AudioContext {
    constructor(options = {}) { this.sampleRate = options.sampleRate || 44100; }
    createAnalyser() { return { fftSize: 4096, frequencyBinCount: 2048, getFloatFrequencyData: () => {}, getFloatTimeDomainData: () => {} }; }
    createBuffer() { return { getChannelData: () => new Float32Array(44100) }; }
    createGain() { return { gain: { value: 1 } }; }
    createMediaStreamSource() { return { connect: () => {}, disconnect: () => {} }; }
    close() {}
    resume() {}
};

require('../src/js/audio/pitch-detector.js');

const PitchDetector = global.window.PitchDetector;
const PYinDetector = global.window.PYinDetector;
const PolyphonicPitchDetector = global.window.PolyphonicPitchDetector;
const VibratoFilter = global.window.VibratoFilter;

describe('PitchDetector', () => {
    let detector;

    beforeEach(() => {
        detector = new PitchDetector();
        detector.configure({ sampleRate: 44100, bufferSize: 2048 });
    });

    it('should convert frequency to MIDI correctly', () => {
        assert.strictEqual(detector.frequencyToMIDI(440), 69);
        assert.strictEqual(detector.frequencyToMIDI(261.63), 60);
    });

    it('should convert MIDI to note name correctly', () => {
        const note = detector.midiToNoteName(60);
        assert.strictEqual(note.name, 'C');
        assert.strictEqual(note.octave, 4);
    });

    it('should calculate cents deviation correctly', () => {
        const cents = detector.centsDeviation(440, 415.30);
        assert.ok(Math.abs(cents) - 100 < 1);
    });

    it('should get instrument frequency ranges', () => {
        const violinRange = detector.getInstrumentRange('violin');
        assert.strictEqual(violinRange.min, 196);
        assert.strictEqual(violinRange.max, 2637);
    });

    it('should return null for invalid frequencies', () => {
        assert.strictEqual(detector.frequencyToMIDI(0), null);
        assert.strictEqual(detector.frequencyToMIDI(-1), null);
    });

    it('should convert frequency to note name with octave', () => {
        const note = detector.frequencyToNote(440);
        assert.strictEqual(note.name, 'A');
        assert.strictEqual(note.octave, 4);
        assert.strictEqual(note.midi, 69);
    });

    it('should get MIDI frequency from note', () => {
        const freq = detector.midiToFrequency(69);
        assert.ok(Math.abs(freq - 440) < 0.1);
    });
});

describe('PYinDetector', () => {
    it('should inherit from PitchDetector', () => {
        const pyin = new PYinDetector();
        assert.ok(pyin instanceof PitchDetector);
    });

    it('should have different threshold than base PitchDetector', () => {
        const pyin = new PYinDetector();
        const base = new PitchDetector();
        assert.notStrictEqual(pyin.threshold, base.threshold);
    });
});

describe('VibratoFilter', () => {
    let filter;

    beforeEach(() => {
        filter = new VibratoFilter({ windowSize: 5, minConfidence: 0.5 });
    });

    it('should return null when no samples added', () => {
        assert.strictEqual(filter.getSmoothedFrequency(), null);
    });

    it('should calculate smoothed frequency', () => {
        filter.addSample(440, 0.9);
        filter.addSample(442, 0.9);
        filter.addSample(438, 0.9);

        const smoothed = filter.getSmoothedFrequency();
        assert.ok(smoothed > 438);
        assert.ok(smoothed < 442);
    });

    it('should reset correctly', () => {
        filter.addSample(440, 0.9);
        filter.reset();
        assert.strictEqual(filter.getSmoothedFrequency(), null);
    });

    it('should detect vibrato', () => {
        // Add samples with vibrato-like variations
        for (let i = 0; i < 10; i++) {
            const freq = 440 + Math.sin(i * 0.5) * 5; // ~5 cents variation
            filter.addSample(freq, 0.9);
        }

        const status = filter.getVibratoStatus();
        assert.ok(status.isVibrato !== undefined);
    });

    it('should calculate smoothed cents deviation', () => {
        filter.addSample(440, 0.9, 440); // target = 440
        filter.addSample(442, 0.9, 440);
        filter.addSample(438, 0.9, 440);

        const smoothedCents = filter.getSmoothedCentsDeviation();
        assert.ok(smoothedCents !== null);
    });
});

describe('PolyphonicPitchDetector', () => {
    let polyDetector;

    beforeEach(() => {
        polyDetector = new PolyphonicPitchDetector();
    });

    it('should convert frequency to note correctly', () => {
        const note = polyDetector.frequencyToNote(440);
        assert.strictEqual(note.name, 'A');
        assert.strictEqual(note.midi, 69);
    });

    it('should calculate cents deviation', () => {
        const cents = polyDetector.centsDeviation(440, 440);
        assert.strictEqual(cents, 0);
    });

    it('should return empty array for empty buffer', () => {
        const result = polyDetector.detectPolyphonic([]);
        assert.deepStrictEqual(result, []);
    });

    it('should return empty array for null buffer', () => {
        const result = polyDetector.detectPolyphonic(null);
        assert.deepStrictEqual(result, []);
    });

    it('should configure correctly', () => {
        polyDetector.configure({ maxVoices: 3, confidenceThreshold: 0.9 });
        assert.strictEqual(polyDetector.maxVoices, 3);
        assert.strictEqual(polyDetector.confidenceThreshold, 0.9);
    });
});