/**
 * Tests for Onboarding Service and Audio Engine Calibration
 */

// Set up globals
global.window = global;
global.localStorage = {
    data: {},
    getItem: jest.fn(function(key) { return this.data[key] || null; }),
    setItem: jest.fn(function(key, value) { this.data[key] = value; }),
    removeItem: jest.fn(function(key) { delete this.data[key]; }),
    clear: function() { this.data = {}; }
};
global.navigator = {
    mediaDevices: {
        getUserMedia: jest.fn().mockResolvedValue({
            getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }])
        })
    }
};

require('../src/js/services/onboarding-service.js');
require('../src/js/audio/audio-engine.js');

const OnboardingService = global.window.OnboardingService;
const AudioEngine = global.window.AudioEngine;

describe('OnboardingService', () => {
    let service;

    beforeEach(() => {
        global.localStorage.clear();
        jest.clearAllMocks();
        service = new OnboardingService();
    });

    describe('constructor', () => {
        test('should initialize with correct default values', () => {
            expect(service.currentStep).toBe(0);
            expect(service.steps).toEqual(['welcome', 'permissions', 'instrument', 'calibration', 'complete']);
            expect(service.selectedInstrument).toBeNull();
            expect(service.microphoneGranted).toBe(false);
            expect(service.cameraGranted).toBe(false);
        });

        test('should have instrument ranges defined', () => {
            expect(service.instrumentRanges).toBeDefined();
            expect(service.instrumentRanges.violin).toBeDefined();
            expect(service.instrumentRanges.viola).toBeDefined();
            expect(service.instrumentRanges.cello).toBeDefined();
            expect(service.instrumentRanges.bass).toBeDefined();
        });
    });

    describe('instrument ranges', () => {
        test('should have correct violin range', () => {
            const violin = service.instrumentRanges.violin;
            expect(violin.minFreq).toBe(196);
            expect(violin.maxFreq).toBe(2637);
            expect(violin.name).toBe('Violin');
        });

        test('should have correct viola range', () => {
            const viola = service.instrumentRanges.viola;
            expect(viola.minFreq).toBe(130);
            expect(viola.maxFreq).toBe(1760);
            expect(viola.name).toBe('Viola');
        });

        test('should have correct cello range', () => {
            const cello = service.instrumentRanges.cello;
            expect(cello.minFreq).toBe(65);
            expect(cello.maxFreq).toBe(987);
            expect(cello.name).toBe('Cello');
        });

        test('should have correct double bass range', () => {
            const bass = service.instrumentRanges.bass;
            expect(bass.minFreq).toBe(41);
            expect(bass.maxFreq).toBe(523);
            expect(bass.name).toBe('Double Bass');
        });
    });

    describe('checkOnboardingStatus', () => {
        test('should return false when onboarding not completed', () => {
            global.localStorage.getItem.mockReturnValueOnce(null);
            expect(service.checkOnboardingStatus()).toBe(false);
        });

        test('should return false when instrument not selected', () => {
            global.localStorage.getItem
                .mockReturnValueOnce('true')  // onboarding_complete
                .mockReturnValueOnce(null);   // selected_instrument
            expect(service.checkOnboardingStatus()).toBe(false);
        });

        test('should return true when fully completed', () => {
            global.localStorage.getItem
                .mockReturnValueOnce('true')    // onboarding_complete
                .mockReturnValueOnce('violin'); // selected_instrument
            expect(service.checkOnboardingStatus()).toBe(true);
        });
    });

    describe('step navigation', () => {
        test('should start at welcome step', () => {
            service.start();
            expect(service.getCurrentStep()).toBe('welcome');
            expect(service.currentStep).toBe(0);
        });

        test('should move to next step', () => {
            service.start();
            service.nextStep();
            expect(service.getCurrentStep()).toBe('permissions');
            expect(service.currentStep).toBe(1);
        });

        test('should move to previous step', () => {
            service.start();
            service.nextStep();
            service.nextStep();
            service.prevStep();
            expect(service.getCurrentStep()).toBe('permissions');
            expect(service.currentStep).toBe(1);
        });

        test('should not go below step 0', () => {
            service.start();
            service.prevStep();
            expect(service.currentStep).toBe(0);
        });

        test('should not exceed max step', () => {
            service.start();
            for (let i = 0; i < 10; i++) {
                service.nextStep();
            }
            expect(service.getCurrentStep()).toBe('complete');
        });
    });

    describe('instrument selection', () => {
        test('should select valid instrument', () => {
            service.selectInstrument('violin');
            expect(service.selectedInstrument).toBe('violin');
            expect(global.localStorage.setItem).toHaveBeenCalledWith('selected_instrument', 'violin');
        });

        test('should not select invalid instrument', () => {
            service.selectInstrument('invalid');
            expect(service.selectedInstrument).toBeNull();
        });

        test('should get selected instrument range', () => {
            service.selectInstrument('cello');
            const range = service.getSelectedInstrumentRange();
            expect(range.name).toBe('Cello');
            expect(range.minFreq).toBe(65);
            expect(range.maxFreq).toBe(987);
        });

        test('should return null for range when no instrument selected', () => {
            expect(service.getSelectedInstrumentRange()).toBeNull();
        });
    });

    describe('getInstrumentOptions', () => {
        test('should return all instrument options', () => {
            const options = service.getInstrumentOptions();
            expect(options).toHaveLength(4);
            expect(options[0].id).toBe('violin');
            expect(options[1].id).toBe('viola');
            expect(options[2].id).toBe('cello');
            expect(options[3].id).toBe('bass');
        });

        test('should include name, description, and range for each instrument', () => {
            const options = service.getInstrumentOptions();
            const violin = options.find(o => o.id === 'violin');
            expect(violin.name).toBe('Violin');
            expect(violin.description).toBeDefined();
            expect(violin.range).toBe('196-2637 Hz');
        });
    });

    describe('permissions', () => {
        test('should request microphone permission', async () => {
            const result = await service.requestMicrophonePermission();
            expect(result).toBe(true);
            expect(service.microphoneGranted).toBe(true);
            expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
        });

        test('should handle microphone permission denial', async () => {
            navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Denied'));
            const result = await service.requestMicrophonePermission();
            expect(result).toBe(false);
            expect(service.microphoneGranted).toBe(false);
        });

        test('should request camera permission', async () => {
            const result = await service.requestCameraPermission();
            expect(result).toBe(true);
            expect(service.cameraGranted).toBe(true);
        });

        test('should request all permissions', async () => {
            const result = await service.requestPermissions();
            expect(result.microphone).toBe(true);
            expect(result.camera).toBe(true);
        });
    });

    describe('callbacks', () => {
        test('should call onStepChange callback', () => {
            const callback = jest.fn();
            service.setOnStepChange(callback);
            service.start();
            expect(callback).toHaveBeenCalledWith({
                step: 'welcome',
                stepIndex: 0,
                totalSteps: 5
            });
        });

        test('should call onComplete callback', () => {
            const callback = jest.fn();
            service.setOnComplete(callback);
            service.selectInstrument('violin');
            service.microphoneGranted = true;
            service.cameraGranted = true;
            service.finishOnboarding();
            expect(callback).toHaveBeenCalledWith(expect.objectContaining({
                instrument: 'violin'
            }));
        });
    });

    describe('progress', () => {
        test('should calculate progress correctly', () => {
            service.start();
            expect(service.getProgress()).toBe(0);

            service.nextStep();
            expect(service.getProgress()).toBe(25);

            service.nextStep();
            expect(service.getProgress()).toBe(50);
        });
    });

    describe('reset', () => {
        test('should reset onboarding status', () => {
            service.hasCompletedOnboarding = true;
            service.selectedInstrument = 'violin';
            service.resetOnboarding();
            expect(service.hasCompletedOnboarding).toBe(false);
            expect(service.selectedInstrument).toBeNull();
            expect(global.localStorage.removeItem).toHaveBeenCalledWith('onboarding_complete');
            expect(global.localStorage.removeItem).toHaveBeenCalledWith('selected_instrument');
        });
    });
});

describe('AudioEngine Calibration', () => {
    let engine;

    beforeEach(() => {
        // Mock AudioContext
        global.AudioContext = jest.fn().mockImplementation(() => ({
            sampleRate: 44100,
            state: 'running',
            createAnalyser: jest.fn().mockReturnValue({
                fftSize: 4096,
                frequencyBinCount: 2048,
                smoothingTimeConstant: 0.8,
                getFloatFrequencyData: jest.fn(),
                getFloatTimeDomainData: jest.fn(),
                getByteFrequencyData: jest.fn()
            }),
            createGain: jest.fn().mockReturnValue({ gain: { value: 1 }, connect: jest.fn(), disconnect: jest.fn() }),
            createBiquadFilter: jest.fn().mockReturnValue({
                type: 'bandpass',
                frequency: { value: 0 },
                Q: { value: 1 },
                connect: jest.fn(),
                disconnect: jest.fn()
            }),
            createMediaStreamSource: jest.fn().mockReturnValue({ connect: jest.fn(), disconnect: jest.fn() }),
            close: jest.fn(),
            resume: jest.fn()
        }));

        engine = new AudioEngine();
    });

    describe('instrument ranges', () => {
        test('should have correct instrument ranges', () => {
            expect(engine.instrumentRanges.violin.minFreq).toBe(196);
            expect(engine.instrumentRanges.violin.maxFreq).toBe(2637);

            expect(engine.instrumentRanges.viola.minFreq).toBe(130);
            expect(engine.instrumentRanges.viola.maxFreq).toBe(1760);

            expect(engine.instrumentRanges.cello.minFreq).toBe(65);
            expect(engine.instrumentRanges.cello.maxFreq).toBe(987);

            expect(engine.instrumentRanges.bass.minFreq).toBe(41);
            expect(engine.instrumentRanges.bass.maxFreq).toBe(523);
        });
    });

    describe('setInstrumentCalibration', () => {
        test('should set violin calibration', async () => {
            await engine.init();
            const result = engine.setInstrumentCalibration('violin');

            expect(result).toBe(true);
            expect(engine.currentInstrument).toBe('violin');
            expect(engine.inputFilter).toBeDefined();
        });

        test('should set viola calibration', async () => {
            await engine.init();
            const result = engine.setInstrumentCalibration('viola');

            expect(result).toBe(true);
            expect(engine.currentInstrument).toBe('viola');
        });

        test('should set cello calibration', async () => {
            await engine.init();
            const result = engine.setInstrumentCalibration('cello');

            expect(result).toBe(true);
            expect(engine.currentInstrument).toBe('cello');
        });

        test('should set bass calibration', async () => {
            await engine.init();
            const result = engine.setInstrumentCalibration('bass');

            expect(result).toBe(true);
            expect(engine.currentInstrument).toBe('bass');
        });

        test('should return false for invalid instrument', async () => {
            await engine.init();
            const result = engine.setInstrumentCalibration('invalid');

            expect(result).toBe(false);
            expect(engine.currentInstrument).toBeNull();
        });
    });

    describe('getCurrentInstrumentRange', () => {
        test('should return null when no instrument set', () => {
            expect(engine.getCurrentInstrumentRange()).toBeNull();
        });

        test('should return correct range for violin', async () => {
            await engine.init();
            engine.setInstrumentCalibration('violin');
            const range = engine.getCurrentInstrumentRange();

            expect(range.minFreq).toBe(196);
            expect(range.maxFreq).toBe(2637);
        });

        test('should return correct range for cello', async () => {
            await engine.init();
            engine.setInstrumentCalibration('cello');
            const range = engine.getCurrentInstrumentRange();

            expect(range.minFreq).toBe(65);
            expect(range.maxFreq).toBe(987);
        });
    });
});
