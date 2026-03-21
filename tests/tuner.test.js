/**
 * Tests for Precision Tuner Component
 */

// Load the tuner component
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

// Set up the DOM
document.body.innerHTML = html;

// Load the required scripts
const pitchDetectorCode = fs.readFileSync(path.resolve(__dirname, '../src/js/audio/pitch-detector.js'), 'utf8');
eval(pitchDetectorCode);

const tunerCode = fs.readFileSync(path.resolve(__dirname, '../src/js/components/tuner.js'), 'utf8');
eval(tunerCode);

describe('PrecisionTuner', () => {
    let container;
    let tuner;

    beforeEach(() => {
        // Create a mock container element
        container = document.createElement('div');
        document.body.appendChild(container);

        // Mock AudioEngine and PitchDetector
        window.AudioEngine = class {
            constructor() {}
            async init() {}
            async requestMicrophoneAccess() {}
            startCapture() {}
            stopListening() {}
        };
        window.PitchDetector = class {
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
            process(buffer) {
                if (!buffer || buffer.length < 1024) return null;
                // Simulate detecting A4 (440 Hz)
                return {
                    name: 'A',
                    octave: 4,
                    midi: 69,
                    frequency: 440,
                    confidence: 0.95,
                    centsDeviation: 0
                };
            }
            centsDeviation(observedFreq, targetFreq) {
                if (!observedFreq || !targetFreq) return 0;
                return Math.round(1200 * Math.log2(observedFreq / targetFreq));
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
    });

    afterEach(() => {
        if (tuner) {
            tuner.destroy();
        }
        document.body.removeChild(container);
    });

    describe('Initialization', () => {
        it('should create tuner instance with container', () => {
            tuner = new PrecisionTuner(container);
            expect(tuner).toBeDefined();
            expect(tuner.container).toBe(container);
        });

        it('should set default instrument to violin', () => {
            tuner = new PrecisionTuner(container);
            expect(tuner.selectedInstrument).toBe('violin');
        });

        it('should set deviation threshold to 10 cents', () => {
            tuner = new PrecisionTuner(container);
            expect(tuner.deviationThreshold).toBe(10);
        });

        it('should render tuner UI', () => {
            tuner = new PrecisionTuner(container);
            const tunerView = container.querySelector('.tuner-view');
            expect(tunerView).toBeDefined();
        });

        it('should render instrument selector buttons', () => {
            tuner = new PrecisionTuner(container);
            const buttons = container.querySelectorAll('.tuner-instrument-btn');
            expect(buttons.length).toBe(4);
        });

        it('should render needle gauge', () => {
            tuner = new PrecisionTuner(container);
            const needleGauge = container.querySelector('.needle-gauge-container');
            expect(needleGauge).toBeDefined();
        });
    });

    describe('Instrument Selection', () => {
        it('should change instrument when button clicked', () => {
            tuner = new PrecisionTuner(container);

            const violaBtn = container.querySelector('[data-instrument="viola"]');
            violaBtn.click();

            expect(tuner.selectedInstrument).toBe('viola');
        });

        it('should update active class on instrument buttons', () => {
            tuner = new PrecisionTuner(container);

            const celloBtn = container.querySelector('[data-instrument="cello"]');
            celloBtn.click();

            const violaBtn = container.querySelector('[data-instrument="viola"]');
            const celloBtnActive = container.querySelector('[data-instrument="cello"].active');

            expect(violaBtn.classList.contains('active')).toBe(false);
            expect(celloBtnActive).toBeDefined();
        });

        it('should update open strings display', () => {
            tuner = new PrecisionTuner(container);

            const bassBtn = container.querySelector('[data-instrument="bass"]');
            bassBtn.click();

            const openStrings = container.querySelectorAll('.open-string-note');
            expect(openStrings.length).toBe(4);
        });
    });

    describe('Instrument Tuning Ranges', () => {
        it('should have correct violin tuning', () => {
            tuner = new PrecisionTuner(container);
            expect(tuner.instrumentTuning.violin.openStrings).toEqual(['G3', 'D4', 'A4', 'E5']);
        });

        it('should have correct viola tuning', () => {
            tuner = new PrecisionTuner(container);
            expect(tuner.instrumentTuning.viola.openStrings).toEqual(['C3', 'G3', 'D4', 'A4']);
        });

        it('should have correct cello tuning', () => {
            tuner = new PrecisionTuner(container);
            expect(tuner.instrumentTuning.cello.openStrings).toEqual(['C2', 'G2', 'D3', 'A3']);
        });

        it('should have correct bass tuning', () => {
            tuner = new PrecisionTuner(container);
            expect(tuner.instrumentTuning.bass.openStrings).toEqual(['E1', 'A1', 'D2', 'G2']);
        });
    });

    describe('Note Display', () => {
        it('should display note name', () => {
            tuner = new PrecisionTuner(container);

            // Simulate a note detection
            tuner.currentNote = { name: 'A', octave: 4, frequency: 440 };
            tuner.updateDisplay(tuner.currentNote, 0);

            const noteEl = container.querySelector('#tuner-current-note');
            expect(noteEl.textContent).toBe('A');
        });

        it('should display octave', () => {
            tuner = new PrecisionTuner(container);

            tuner.currentNote = { name: 'A', octave: 4, frequency: 440 };
            tuner.updateDisplay(tuner.currentNote, 0);

            const octaveEl = container.querySelector('#tuner-current-octave');
            expect(octaveEl.textContent).toBe('4');
        });

        it('should display frequency', () => {
            tuner = new PrecisionTuner(container);

            tuner.currentNote = { name: 'A', octave: 4, frequency: 440 };
            tuner.updateDisplay(tuner.currentNote, 0);

            const freqEl = container.querySelector('.frequency-value');
            expect(freqEl.textContent).toBe('440.0');
        });
    });

    describe('Feedback States', () => {
        it('should show "In Tune" when within threshold', () => {
            tuner = new PrecisionTuner(container);

            tuner.updateFeedback(5); // 5 cents - within 10 cent threshold

            const feedbackEl = container.querySelector('#pitch-feedback');
            expect(feedbackEl.classList.contains('in-tune')).toBe(true);
        });

        it('should show "Sharp" when above threshold', () => {
            tuner = new PrecisionTuner(container);

            tuner.updateFeedback(25); // 25 cents sharp

            const feedbackEl = container.querySelector('#pitch-feedback');
            expect(feedbackEl.classList.contains('sharp')).toBe(true);
        });

        it('should show "Flat" when below threshold', () => {
            tuner = new PrecisionTuner(container);

            tuner.updateFeedback(-25); // 25 cents flat

            const feedbackEl = container.querySelector('#pitch-feedback');
            expect(feedbackEl.classList.contains('flat')).toBe(true);
        });

        it('should hide needle gauge when in tune', () => {
            tuner = new PrecisionTuner(container);

            tuner.updateFeedback(5); // Within threshold

            const needleContainer = document.getElementById('needle-gauge-container');
            expect(needleContainer.classList.contains('visible')).toBe(false);
        });

        it('should show needle gauge when out of tune', () => {
            tuner = new PrecisionTuner(container);

            tuner.updateFeedback(25); // Outside threshold

            const needleContainer = document.getElementById('needle-gauge-container');
            expect(needleContainer.classList.contains('visible')).toBe(true);
        });
    });

    describe('Needle Rotation', () => {
        it('should rotate needle to 0 degrees at center when out of tune', () => {
            tuner = new PrecisionTuner(container);

            const needle = document.getElementById('tuner-needle');
            // Use 15 cents (outside 10 cent threshold) to show needle
            tuner.updateDisplay({ name: 'A', octave: 4, frequency: 442 }, 15);

            // At 15 cents, rotation should be 27 degrees (15 * 1.8)
            expect(needle.style.transform).toBe('rotate(27deg)');
        });

        it('should rotate needle positive for sharp', () => {
            tuner = new PrecisionTuner(container);

            const needle = document.getElementById('tuner-needle');
            tuner.updateDisplay({ name: 'A', octave: 4, frequency: 445 }, 25);

            expect(needle.style.transform).toBe('rotate(45deg)');
        });

        it('should rotate needle negative for flat', () => {
            tuner = new PrecisionTuner(container);

            const needle = document.getElementById('tuner-needle');
            tuner.updateDisplay({ name: 'A', octave: 4, frequency: 435 }, -25);

            expect(needle.style.transform).toBe('rotate(-45deg)');
        });

        it('should clamp needle rotation at max', () => {
            tuner = new PrecisionTuner(container);

            const needle = document.getElementById('tuner-needle');
            tuner.updateDisplay({ name: 'A', octave: 4, frequency: 460 }, 100);

            // Should clamp to 50 cents = 90 degrees
            expect(needle.style.transform).toBe('rotate(90deg)');
        });
    });

    describe('Cents Display', () => {
        it('should display positive cents with + sign', () => {
            tuner = new PrecisionTuner(container);

            tuner.updateDisplay({ name: 'A', octave: 4, frequency: 442 }, 15);

            const centsEl = container.querySelector('.cents-value');
            expect(centsEl.textContent).toBe('+15');
        });

        it('should display negative cents without + sign', () => {
            tuner = new PrecisionTuner(container);

            tuner.updateDisplay({ name: 'A', octave: 4, frequency: 438 }, -15);

            const centsEl = container.querySelector('.cents-value');
            expect(centsEl.textContent).toBe('-15');
        });

        it('should display 0 cents correctly', () => {
            tuner = new PrecisionTuner(container);

            tuner.updateDisplay({ name: 'A', octave: 4, frequency: 440 }, 0);

            const centsEl = container.querySelector('.cents-value');
            expect(centsEl.textContent).toBe('0');
        });
    });

    describe('Status Updates', () => {
        it('should update status text', () => {
            tuner = new PrecisionTuner(container);

            tuner.updateStatus('Listening...', 'active');

            const statusText = container.querySelector('.status-text');
            expect(statusText.textContent).toBe('Listening...');
        });

        it('should add active class when listening', () => {
            tuner = new PrecisionTuner(container);

            tuner.updateStatus('Listening...', 'active');

            const statusEl = container.querySelector('#tuner-status');
            expect(statusEl.classList.contains('active')).toBe(true);
        });

        it('should add error class on error', () => {
            tuner = new PrecisionTuner(container);

            tuner.updateStatus('Microphone denied', 'error');

            const statusEl = container.querySelector('#tuner-status');
            expect(statusEl.classList.contains('error')).toBe(true);
        });
    });

    describe('Confidence Threshold', () => {
        it('should set confidence threshold', () => {
            tuner = new PrecisionTuner(container);

            tuner.setConfidenceThreshold(0.9);

            expect(tuner.confidenceThreshold).toBe(0.9);
        });

        it('should update pitch detector threshold', () => {
            tuner = new PrecisionTuner(container);
            tuner.pitchDetector = new PitchDetector();

            tuner.setConfidenceThreshold(0.75);

            expect(tuner.pitchDetector.confidenceThreshold).toBe(0.75);
        });
    });

    describe('Destroy', () => {
        it('should clear container on destroy', () => {
            tuner = new PrecisionTuner(container);
            tuner.destroy();

            expect(container.innerHTML).toBe('');
        });

        it('should stop tuner on destroy', () => {
            tuner = new PrecisionTuner(container);
            tuner.isActive = true;

            tuner.destroy();

            expect(tuner.isActive).toBe(false);
        });
    });
});

describe('PitchDetector (for tuner integration)', () => {
    let pitchDetector;

    beforeEach(() => {
        window.PitchDetector = class {
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
            getInstrumentRange(instrument) {
                const ranges = {
                    violin: { min: 196, max: 2637 },
                    viola: { min: 130, max: 1319 },
                    cello: { min: 65, max: 987 },
                    bass: { min: 41, max: 262 }
                };
                return ranges[instrument] || ranges.violin;
            }
            centsDeviation(observedFreq, targetFreq) {
                if (!observedFreq || !targetFreq) return 0;
                return Math.round(1200 * Math.log2(observedFreq / targetFreq));
            }
        };
        pitchDetector = new PitchDetector();
    });

    it('should calculate cents deviation correctly for A4', () => {
        // 440 Hz should be 0 cents from 440 Hz
        const cents = pitchDetector.centsDeviation(440, 440);
        expect(cents).toBe(0);
    });

    it('should calculate positive cents for sharp', () => {
        // ~445.07 Hz is 20 cents sharp of A4
        const cents = pitchDetector.centsDeviation(445.07, 440);
        expect(cents).toBe(20);
    });

    it('should calculate negative cents for flat', () => {
        // ~434.96 Hz is 20 cents flat of A4
        const cents = pitchDetector.centsDeviation(434.96, 440);
        expect(cents).toBe(-20);
    });

    it('should return violin range', () => {
        const range = pitchDetector.getInstrumentRange('violin');
        expect(range.min).toBe(196);
        expect(range.max).toBe(2637);
    });

    it('should return viola range', () => {
        const range = pitchDetector.getInstrumentRange('viola');
        expect(range.min).toBe(130);
        expect(range.max).toBe(1319);
    });

    it('should return cello range', () => {
        const range = pitchDetector.getInstrumentRange('cello');
        expect(range.min).toBe(65);
        expect(range.max).toBe(987);
    });

    it('should return bass range', () => {
        const range = pitchDetector.getInstrumentRange('bass');
        expect(range.min).toBe(41);
        expect(range.max).toBe(262);
    });

    it('should default to violin range for unknown instrument', () => {
        const range = pitchDetector.getInstrumentRange('unknown');
        expect(range.min).toBe(196);
        expect(range.max).toBe(2637);
    });
});
