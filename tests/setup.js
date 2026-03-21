// Jest setup file
// This file is run before each test file

// Make sure the DOM is available
global.window = global;
global.document = global.document || {};

// Mock the AudioEngine and PitchDetector if not already loaded
if (typeof global.AudioEngine === 'undefined') {
    global.AudioEngine = class {
        constructor() {}
        async init() {}
        async requestMicrophoneAccess() {}
        startCapture() {}
        stopListening() {}
    };
}

if (typeof global.PitchDetector === 'undefined') {
    global.PitchDetector = class {
        constructor() {
            this.sampleRate = 44100;
            this.bufferSize = 2048;
            this.confidenceThreshold = 0.85;
            this.minFrequency = 196;
            this.maxFrequency = 2637;
            this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            this.a4Frequency = 440;
            this.a4MIDI = 69;
        }
        configure() {}
        process() { return null; }
        detect() { return { frequency: null, confidence: 0 }; }
        centsDeviation(observedFreq, targetFreq) {
            if (!observedFreq || !targetFreq) return 0;
            return Math.round(1200 * Math.log2(observedFreq / targetFreq));
        }
        midiToFrequency(midi) {
            return this.a4Frequency * Math.pow(2, (midi - this.a4MIDI) / 12);
        }
        frequencyToMIDI(frequency) {
            if (!frequency || frequency <= 0) return null;
            return Math.round(12 * Math.log2(frequency / this.a4Frequency) + this.a4MIDI);
        }
        frequencyToNote(frequency) {
            const midi = this.frequencyToMIDI(frequency);
            if (midi === null) return null;
            const octave = Math.floor(midi / 12) - 1;
            const noteIndex = midi % 12;
            return {
                name: this.noteNames[noteIndex],
                octave: octave,
                midi: midi
            };
        }
        getInstrumentRange(instrument) {
            const ranges = {
                violin: { min: 196, max: 2637 },
                viola: { min: 130, max: 1319 },
                cello: { min: 65, max: 987 },
                bass: { min: 41, max: 262 }
            };
            return ranges[instrument] || ranges.violin;
        }
    };
}

// Set up jest globals
global.test = test;
global.expect = expect;
global.describe = describe;
global.beforeEach = beforeEach;
global.afterEach = afterEach;
global.beforeAll = beforeAll;
global.afterAll = afterAll;
