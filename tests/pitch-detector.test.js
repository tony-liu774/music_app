/**
 * Tests for Pitch Detector
 */

// Define window first
global.window = global;
global.navigator = { mediaDevices: { getUserMedia: jest.fn(), enumerateDevices: jest.fn() } };
global.AudioContext = class AudioContext {
    constructor(options = {}) { this.sampleRate = options.sampleRate || 44100; }
    createAnalyser() { return { fftSize: 4096, frequencyBinCount: 2048, getFloatFrequencyData: jest.fn(), getFloatTimeDomainData: jest.fn() }; }
    createBuffer() { return { getChannelData: jest.fn(() => new Float32Array(44100)) }; }
    createGain() { return { gain: { value: 1 } }; }
    createMediaStreamSource() { return { connect: jest.fn(), disconnect: jest.fn() }; }
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

    test('should convert frequency to MIDI correctly', () => {
        expect(detector.frequencyToMIDI(440)).toBe(69);
        expect(detector.frequencyToMIDI(261.63)).toBe(60);
    });

    test('should convert MIDI to note name correctly', () => {
        const note = detector.midiToNoteName(60);
        expect(note.name).toBe('C');
        expect(note.octave).toBe(4);
    });

    test('should calculate cents deviation correctly', () => {
        const cents = detector.centsDeviation(440, 415.30);
        expect(Math.abs(cents)).toBeCloseTo(100, 0);
    });

    test('should get instrument frequency ranges', () => {
        const violinRange = detector.getInstrumentRange('violin');
        expect(violinRange.min).toBe(196);
        expect(violinRange.max).toBe(2637);
    });
});

describe('PYinDetector', () => {
    test('should inherit from PitchDetector', () => {
        const pyin = new PYinDetector();
        expect(pyin).toBeInstanceOf(PitchDetector);
    });
});

describe('VibratoFilter', () => {
    let filter;

    beforeEach(() => {
        filter = new VibratoFilter({ windowSize: 5, minConfidence: 0.5 });
    });

    test('should return null when no samples added', () => {
        expect(filter.getSmoothedFrequency()).toBeNull();
    });

    test('should calculate smoothed frequency', () => {
        filter.addSample(440, 0.9);
        filter.addSample(442, 0.9);
        filter.addSample(438, 0.9);

        const smoothed = filter.getSmoothedFrequency();
        expect(smoothed).toBeGreaterThan(438);
        expect(smoothed).toBeLessThan(442);
    });

    test('should reset correctly', () => {
        filter.addSample(440, 0.9);
        filter.reset();
        expect(filter.getSmoothedFrequency()).toBeNull();
    });
});

describe('PolyphonicPitchDetector', () => {
    let polyDetector;

    beforeEach(() => {
        polyDetector = new PolyphonicPitchDetector();
    });

    test('should convert frequency to note correctly', () => {
        const note = polyDetector.frequencyToNote(440);
        expect(note.name).toBe('A');
        expect(note.midi).toBe(69);
    });

    test('should calculate cents deviation', () => {
        const cents = polyDetector.centsDeviation(440, 440);
        expect(cents).toBe(0);
    });
});
