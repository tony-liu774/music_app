/**
 * Tests for Onboarding Service, OnboardingUI, and Audio Engine Calibration
 */

// Mock getUserMedia before anything loads
const mockGetUserMedia = jest.fn().mockResolvedValue({
    getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }])
});

Object.defineProperty(global.navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia },
    writable: true,
    configurable: true
});

// Load InstrumentStore first (OnboardingService depends on it)
delete global.window.InstrumentStore;
delete global.window.instrumentStore;
require('../src/js/services/instrument-store.js');
require('../src/js/services/onboarding-service.js');

const OnboardingService = global.window.OnboardingService;
const InstrumentStore = global.window.InstrumentStore;

describe('OnboardingService', () => {
    let service;
    let store;

    beforeEach(() => {
        localStorage.clear();
        mockGetUserMedia.mockReset();
        mockGetUserMedia.mockResolvedValue({
            getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }])
        });
        store = new InstrumentStore();
        service = new OnboardingService(store);
    });

    describe('constructor', () => {
        test('should initialize with correct default values', () => {
            expect(service.currentStep).toBe(0);
            expect(service.steps).toEqual(['welcome', 'permissions', 'instrument', 'calibration', 'complete']);
            expect(service.selectedInstrument).toBeNull();
            expect(service.microphoneGranted).toBe(false);
            expect(service.cameraGranted).toBe(false);
        });

        test('should accept store parameter', () => {
            expect(service.store).toBe(store);
        });

        test('should work without store', () => {
            const savedStore = window.instrumentStore;
            window.instrumentStore = null;
            const noStoreService = new OnboardingService(null);
            expect(noStoreService.store).toBeNull();
            noStoreService.selectInstrument('violin');
            expect(noStoreService.selectedInstrument).toBe('violin');
            window.instrumentStore = savedStore;
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
            expect(service.checkOnboardingStatus()).toBe(false);
        });

        test('should return false when instrument not selected', () => {
            localStorage.setItem('onboarding_complete', 'true');
            expect(service.checkOnboardingStatus()).toBe(false);
        });

        test('should return true when fully completed', () => {
            localStorage.setItem('onboarding_complete', 'true');
            localStorage.setItem('selected_instrument', 'violin');
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
            expect(localStorage.getItem('selected_instrument')).toBe('violin');
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

        test('should sync instrument to global store', () => {
            service.selectInstrument('viola');
            expect(store.getInstrument()).toBe('viola');
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
            expect(service.microphoneDenied).toBe(false);
            expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
        });

        test('should handle microphone permission denial', async () => {
            mockGetUserMedia.mockRejectedValueOnce(new Error('Denied'));
            const result = await service.requestMicrophonePermission();
            expect(result).toBe(false);
            expect(service.microphoneGranted).toBe(false);
            expect(service.microphoneDenied).toBe(true);
        });

        test('should sync mic permission to store on grant', async () => {
            await service.requestMicrophonePermission();
            expect(store.isMicrophoneGranted()).toBe(true);
        });

        test('should sync mic permission to store on denial', async () => {
            mockGetUserMedia.mockRejectedValueOnce(new Error('Denied'));
            await service.requestMicrophonePermission();
            expect(store.isMicrophoneGranted()).toBe(false);
        });

        test('should request camera permission', async () => {
            const result = await service.requestCameraPermission();
            expect(result).toBe(true);
            expect(service.cameraGranted).toBe(true);
            expect(service.cameraDenied).toBe(false);
        });

        test('should handle camera permission denial', async () => {
            mockGetUserMedia.mockRejectedValueOnce(new Error('Denied'));
            const result = await service.requestCameraPermission();
            expect(result).toBe(false);
            expect(service.cameraGranted).toBe(false);
            expect(service.cameraDenied).toBe(true);
        });

        test('should sync camera permission to store', async () => {
            await service.requestCameraPermission();
            expect(store.getState().cameraGranted).toBe(true);
        });

        test('should request all permissions', async () => {
            const result = await service.requestPermissions();
            expect(result.microphone).toBe(true);
            expect(result.camera).toBe(true);
        });

        test('isMicrophoneBlocked should return true after denial', async () => {
            mockGetUserMedia.mockRejectedValueOnce(new Error('Denied'));
            await service.requestMicrophonePermission();
            expect(service.isMicrophoneBlocked()).toBe(true);
        });

        test('isMicrophoneBlocked should return false after grant', async () => {
            await service.requestMicrophonePermission();
            expect(service.isMicrophoneBlocked()).toBe(false);
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

    describe('finishOnboarding', () => {
        test('should sync onboarding complete to store', () => {
            service.finishOnboarding();
            expect(store.getState().onboardingComplete).toBe(true);
        });

        test('should persist to localStorage', () => {
            service.finishOnboarding();
            expect(localStorage.getItem('onboarding_complete')).toBe('true');
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
            expect(localStorage.getItem('onboarding_complete')).toBeNull();
            expect(localStorage.getItem('selected_instrument')).toBeNull();
        });

        test('should reset global store', () => {
            store.setInstrument('violin');
            store.setMicrophoneGranted(true);
            service.resetOnboarding();
            expect(store.getInstrument()).toBeNull();
            expect(store.isMicrophoneGranted()).toBe(false);
        });
    });
});

describe('OnboardingUI', () => {
    let service;
    let store;
    let ui;
    let container;

    beforeEach(() => {
        localStorage.clear();
        mockGetUserMedia.mockReset();
        mockGetUserMedia.mockResolvedValue({
            getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }])
        });

        store = new InstrumentStore();
        service = new OnboardingService(store);

        // Set up DOM
        container = document.createElement('div');
        container.id = 'onboarding-modal';
        container.className = 'modal onboarding-modal';
        container.innerHTML = `
            <div class="onboarding-container">
                <div class="onboarding-progress-bar">
                    <div class="onboarding-progress"></div>
                </div>
                <div class="onboarding-content"></div>
            </div>
        `;
        document.body.appendChild(container);

        // Load OnboardingUI
        require('../src/js/components/onboarding-ui.js');
        ui = new (global.window.OnboardingUI)(service);
    });

    afterEach(() => {
        container.remove();
    });

    test('should render welcome step on init when onboarding not complete', () => {
        ui.init();
        const heading = container.querySelector('h2');
        expect(heading.textContent).toBe('Welcome to Virtual Concertmaster');
    });

    test('should show modal when onboarding needed', () => {
        ui.init();
        expect(container.classList.contains('active')).toBe(true);
    });

    test('should not show modal when onboarding already complete', () => {
        service.hasCompletedOnboarding = true;
        ui.init();
        expect(container.classList.contains('active')).toBe(false);
    });

    test('should render permissions step with denied message elements', () => {
        ui.init();
        service.nextStep(); // go to permissions
        expect(container.querySelector('#mic-denied-msg')).not.toBeNull();
        expect(container.querySelector('#cam-denied-msg')).not.toBeNull();
    });

    test('should show denied message when mic permission fails', async () => {
        ui.init();
        service.nextStep(); // go to permissions
        mockGetUserMedia.mockRejectedValueOnce(new Error('Denied'));
        const micBtn = container.querySelector('#request-mic');
        micBtn.click();
        // Wait for async
        await new Promise(r => setTimeout(r, 10));
        const deniedMsg = container.querySelector('#mic-denied-msg');
        expect(deniedMsg.style.display).toBe('flex');
    });

    test('should show granted state when mic permission succeeds', async () => {
        ui.init();
        service.nextStep();
        const micBtn = container.querySelector('#request-mic');
        micBtn.click();
        await new Promise(r => setTimeout(r, 10));
        const card = container.querySelector('#mic-permission-card');
        expect(card.classList.contains('granted')).toBe(true);
        expect(micBtn.textContent).toBe('Granted');
        expect(micBtn.disabled).toBe(true);
    });

    test('should render instrument carousel with 4 cards', () => {
        ui.init();
        service.nextStep(); // permissions
        service.nextStep(); // instrument
        const cards = container.querySelectorAll('.carousel-card');
        expect(cards.length).toBe(4);
    });

    test('should have carousel navigation arrows', () => {
        ui.init();
        service.nextStep();
        service.nextStep();
        expect(container.querySelector('#carousel-prev')).toBeTruthy();
        expect(container.querySelector('#carousel-next')).toBeTruthy();
    });

    test('should have carousel dots', () => {
        ui.init();
        service.nextStep();
        service.nextStep();
        const dots = container.querySelectorAll('.carousel-dot');
        expect(dots.length).toBe(4);
    });

    test('should select first instrument by default in carousel', () => {
        ui.init();
        service.nextStep();
        service.nextStep();
        expect(service.selectedInstrument).toBe('violin');
    });

    test('carousel next arrow should advance to next instrument', () => {
        ui.init();
        service.nextStep();
        service.nextStep();
        const nextBtn = container.querySelector('#carousel-next');
        nextBtn.click();
        expect(service.selectedInstrument).toBe('viola');
        expect(ui.carouselIndex).toBe(1);
    });

    test('carousel should wrap around from last to first', () => {
        ui.init();
        service.nextStep();
        service.nextStep();
        const nextBtn = container.querySelector('#carousel-next');
        nextBtn.click(); // viola
        nextBtn.click(); // cello
        nextBtn.click(); // bass
        nextBtn.click(); // wrap to violin
        expect(service.selectedInstrument).toBe('violin');
        expect(ui.carouselIndex).toBe(0);
    });

    test('carousel dot click should navigate to that instrument', () => {
        ui.init();
        service.nextStep();
        service.nextStep();
        const dots = container.querySelectorAll('.carousel-dot');
        dots[2].click(); // cello
        expect(service.selectedInstrument).toBe('cello');
        expect(ui.carouselIndex).toBe(2);
    });

    test('carousel prev arrow should wrap from first to last', () => {
        ui.init();
        service.nextStep();
        service.nextStep();
        const prevBtn = container.querySelector('#carousel-prev');
        prevBtn.click(); // wrap to bass
        expect(service.selectedInstrument).toBe('bass');
        expect(ui.carouselIndex).toBe(3);
    });

    test('should render calibration step with instrument name', () => {
        ui.init();
        service.selectInstrument('viola');
        service.currentStep = 3; // calibration
        ui.currentStep = 'calibration';
        ui.renderCurrentStep();
        const text = container.querySelector('.calibration-step p');
        expect(text.innerHTML).toContain('Viola');
    });

    test('should render complete step with success message', () => {
        ui.init();
        service.currentStep = 4; // complete
        ui.currentStep = 'complete';
        ui.renderCurrentStep();
        expect(container.querySelector('.complete-step h2').textContent).toBe("You're All Set!");
    });

    test('should hide modal on completion', () => {
        ui.init();
        ui.onComplete({});
        expect(container.classList.contains('active')).toBe(false);
    });

    test('skip button should finish onboarding', () => {
        ui.init();
        // Set callback after init (init sets its own onComplete)
        const completeCb = jest.fn();
        service.setOnComplete(completeCb);
        container.querySelector('#onboarding-skip').click();
        expect(completeCb).toHaveBeenCalled();
    });

    test('progress bar should update with step changes', () => {
        ui.init();
        const progressBar = container.querySelector('.onboarding-progress');
        expect(progressBar.style.width).toBe('0%');
        service.nextStep();
        expect(progressBar.style.width).toBe('25%');
    });

    test('carousel cards should have ARIA attributes', () => {
        ui.init();
        service.nextStep();
        service.nextStep();
        const cards = container.querySelectorAll('.carousel-card');
        expect(cards[0].getAttribute('role')).toBe('option');
        expect(cards[0].getAttribute('aria-selected')).toBe('true');
        expect(cards[1].getAttribute('aria-selected')).toBe('false');
    });

    test('open settings button should show guidance toast', () => {
        ui.init();
        service.nextStep();
        // Simulate denied state to show the button
        const deniedMsg = container.querySelector('#mic-denied-msg');
        deniedMsg.style.display = 'flex';
        const settingsBtn = container.querySelector('#open-mic-settings');
        settingsBtn.click();
        const toast = container.querySelector('.settings-guidance-toast');
        expect(toast).not.toBeNull();
        expect(toast.classList.contains('visible')).toBe(true);
    });
});
