/**
 * Tests for InstrumentStore - Global state management for DSP engine
 */

// Reset singleton before loading
delete global.window.InstrumentStore;
delete global.window.instrumentStore;

require('../src/js/services/instrument-store.js');

const InstrumentStore = global.window.InstrumentStore;

describe('InstrumentStore', () => {
    let store;
    let setItemSpy;
    let getItemSpy;
    let removeItemSpy;

    beforeEach(() => {
        localStorage.clear();
        setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
        getItemSpy = jest.spyOn(Storage.prototype, 'getItem');
        removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem');
        store = new InstrumentStore();
    });

    afterEach(() => {
        setItemSpy.mockRestore();
        getItemSpy.mockRestore();
        removeItemSpy.mockRestore();
    });

    describe('constructor', () => {
        test('should initialize with null instrument', () => {
            expect(store.getInstrument()).toBeNull();
            expect(store.getInstrumentRange()).toBeNull();
        });

        test('should initialize with permissions false', () => {
            expect(store.isMicrophoneGranted()).toBe(false);
            const state = store.getState();
            expect(state.cameraGranted).toBe(false);
        });

        test('should initialize with onboardingComplete false', () => {
            expect(store.getState().onboardingComplete).toBe(false);
        });

        test('should have all four instrument ranges', () => {
            expect(store.instrumentRanges.violin).toBeDefined();
            expect(store.instrumentRanges.viola).toBeDefined();
            expect(store.instrumentRanges.cello).toBeDefined();
            expect(store.instrumentRanges.bass).toBeDefined();
        });
    });

    describe('hydration from localStorage', () => {
        test('should hydrate instrument from localStorage', () => {
            localStorage.setItem('selected_instrument', 'cello');
            localStorage.setItem('onboarding_complete', 'true');

            const hydrated = new InstrumentStore();
            expect(hydrated.getInstrument()).toBe('cello');
            expect(hydrated.getInstrumentRange().name).toBe('Cello');
            expect(hydrated.getState().onboardingComplete).toBe(true);
        });

        test('should hydrate mic permission from localStorage', () => {
            localStorage.setItem('mic_permission_granted', 'true');

            const hydrated = new InstrumentStore();
            expect(hydrated.isMicrophoneGranted()).toBe(true);
        });

        test('should ignore invalid instrument in localStorage', () => {
            localStorage.setItem('selected_instrument', 'banjo');

            const hydrated = new InstrumentStore();
            expect(hydrated.getInstrument()).toBeNull();
        });
    });

    describe('setInstrument', () => {
        test('should set valid instrument', () => {
            const result = store.setInstrument('violin');
            expect(result).toBe(true);
            expect(store.getInstrument()).toBe('violin');
        });

        test('should set instrument range when setting instrument', () => {
            store.setInstrument('viola');
            const range = store.getInstrumentRange();
            expect(range.name).toBe('Viola');
            expect(range.minFreq).toBe(130);
            expect(range.maxFreq).toBe(1760);
        });

        test('should persist instrument to localStorage', () => {
            store.setInstrument('cello');
            expect(setItemSpy).toHaveBeenCalledWith('selected_instrument', 'cello');
        });

        test('should reject invalid instrument', () => {
            const result = store.setInstrument('guitar');
            expect(result).toBe(false);
            expect(store.getInstrument()).toBeNull();
        });

        test('should reject null instrument', () => {
            const result = store.setInstrument(null);
            expect(result).toBe(false);
        });

        test('should notify listeners on instrument change', () => {
            const listener = jest.fn();
            store.subscribe(listener);
            store.setInstrument('bass');
            expect(listener).toHaveBeenCalledWith('instrument', 'bass', expect.any(Object));
        });
    });

    describe('setMicrophoneGranted', () => {
        test('should set microphone granted', () => {
            store.setMicrophoneGranted(true);
            expect(store.isMicrophoneGranted()).toBe(true);
        });

        test('should persist mic state to localStorage', () => {
            store.setMicrophoneGranted(true);
            expect(setItemSpy).toHaveBeenCalledWith('mic_permission_granted', 'true');
        });

        test('should set microphone denied', () => {
            store.setMicrophoneGranted(false);
            expect(store.isMicrophoneGranted()).toBe(false);
        });

        test('should notify listeners', () => {
            const listener = jest.fn();
            store.subscribe(listener);
            store.setMicrophoneGranted(true);
            expect(listener).toHaveBeenCalledWith('microphoneGranted', true, expect.any(Object));
        });
    });

    describe('setCameraGranted', () => {
        test('should set camera granted', () => {
            store.setCameraGranted(true);
            expect(store.getState().cameraGranted).toBe(true);
        });

        test('should persist to localStorage', () => {
            store.setCameraGranted(true);
            expect(setItemSpy).toHaveBeenCalledWith('cam_permission_granted', 'true');
        });
    });

    describe('setOnboardingComplete', () => {
        test('should mark onboarding complete', () => {
            store.setOnboardingComplete(true);
            expect(store.getState().onboardingComplete).toBe(true);
        });

        test('should persist to localStorage', () => {
            store.setOnboardingComplete(true);
            expect(setItemSpy).toHaveBeenCalledWith('onboarding_complete', 'true');
        });
    });

    describe('subscribe / unsubscribe', () => {
        test('should return a listener id', () => {
            const id = store.subscribe(jest.fn());
            expect(typeof id).toBe('number');
            expect(id).toBeGreaterThan(0);
        });

        test('should notify all subscribers', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();
            store.subscribe(listener1);
            store.subscribe(listener2);
            store.setInstrument('violin');
            expect(listener1).toHaveBeenCalled();
            expect(listener2).toHaveBeenCalled();
        });

        test('should stop notifying after unsubscribe', () => {
            const listener = jest.fn();
            const id = store.subscribe(listener);
            store.unsubscribe(id);
            store.setInstrument('violin');
            expect(listener).not.toHaveBeenCalled();
        });

        test('should catch errors in listeners', () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation();
            store.subscribe(() => { throw new Error('test'); });
            expect(() => store.setInstrument('violin')).not.toThrow();
            errorSpy.mockRestore();
        });
    });

    describe('getState', () => {
        test('should return a copy (not reference)', () => {
            const state1 = store.getState();
            state1.instrument = 'hacked';
            expect(store.getInstrument()).toBeNull();
        });

        test('should reflect current state', () => {
            store.setInstrument('violin');
            store.setMicrophoneGranted(true);
            store.setOnboardingComplete(true);
            const state = store.getState();
            expect(state.instrument).toBe('violin');
            expect(state.microphoneGranted).toBe(true);
            expect(state.onboardingComplete).toBe(true);
        });
    });

    describe('reset', () => {
        test('should clear all state', () => {
            store.setInstrument('violin');
            store.setMicrophoneGranted(true);
            store.setOnboardingComplete(true);
            store.reset();
            expect(store.getInstrument()).toBeNull();
            expect(store.isMicrophoneGranted()).toBe(false);
            expect(store.getState().onboardingComplete).toBe(false);
        });

        test('should clear localStorage entries', () => {
            store.reset();
            expect(removeItemSpy).toHaveBeenCalledWith('selected_instrument');
            expect(removeItemSpy).toHaveBeenCalledWith('onboarding_complete');
            expect(removeItemSpy).toHaveBeenCalledWith('mic_permission_granted');
            expect(removeItemSpy).toHaveBeenCalledWith('cam_permission_granted');
        });

        test('should notify listeners', () => {
            const listener = jest.fn();
            store.subscribe(listener);
            store.reset();
            expect(listener).toHaveBeenCalledWith('reset', null, expect.any(Object));
        });
    });
});
