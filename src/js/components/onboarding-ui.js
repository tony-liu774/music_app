/**
 * Onboarding UI Component
 * Handles first-run user experience for permissions and instrument calibration
 */

class OnboardingUI {
    constructor(onboardingService) {
        this.service = onboardingService;
        this.container = null;
        this.currentStep = 'welcome';

        // Instrument icons (SVG paths)
        this.instrumentIcons = {
            violin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C12 3 8 5 6 8C4 11 4 14 5 16C6 18 9 20 12 20C15 20 18 18 19 16C20 14 20 11 18 8C16 5 12 3 12 3ZM12 17C10 17 8 16 7 14C8 15 10 16 12 16C14 16 16 15 17 14C16 16 14 17 12 17Z"/></svg>',
            viola: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C12 2 7 4.5 5 8C3 11.5 3 15 5 17.5C7 20 11 21 12 21C13 21 17 20 19 17.5C21 15 21 11.5 19 8C17 4.5 12 2 12 2ZM12 18C9.5 18 7 16.5 6 14C7.5 15.5 9.5 17 12 17C14.5 17 16.5 15.5 18 14C17 16.5 14.5 18 12 18Z"/></svg>',
            cello: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2C6 2 4 5 4 9C4 13 4 17 6 21C6 21 8 22 12 22C16 22 18 21 18 21C20 17 20 13 20 9C20 5 18 2 18 2H6ZM12 19C9 19 7.5 17.5 7 15C8 16.5 9.5 18 12 18C14.5 18 16 16.5 17 15C16.5 17.5 15 19 12 19Z"/></svg>',
            bass: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4C4 4 3 7 3 11C3 15 3 18 5 21C5 21 7 22 12 22C17 22 19 21 19 21C21 18 21 15 21 11C21 7 20 4 20 4H4ZM12 19C9 19 8 17 8 15C8 16 9 17 12 17C15 17 16 16 16 15C16 17 15 19 12 19Z"/></svg>'
        };
    }

    /**
     * Initialize the onboarding UI
     */
    init() {
        this.container = document.getElementById('onboarding-modal');
        if (!this.container) {
            console.warn('Onboarding modal container not found');
            return;
        }

        this.service.setOnStepChange((data) => this.onStepChange(data));
        this.service.setOnComplete((data) => this.onComplete(data));

        // Check if onboarding is needed
        if (!this.service.hasCompletedOnboarding) {
            this.show();
            this.renderCurrentStep();
        }
    }

    /**
     * Show the onboarding modal
     */
    show() {
        if (this.container) {
            this.container.classList.add('active');
        }
    }

    /**
     * Hide the onboarding modal
     */
    hide() {
        if (this.container) {
            this.container.classList.remove('active');
        }
    }

    /**
     * Handle step changes
     */
    onStepChange(data) {
        this.currentStep = data.step;
        this.renderCurrentStep();
    }

    /**
     * Handle onboarding completion
     */
    onComplete(data) {
        this.hide();
    }

    /**
     * Render the current step
     */
    renderCurrentStep() {
        if (!this.container) return;

        const stepContent = this.container.querySelector('.onboarding-content');
        const progressBar = this.container.querySelector('.onboarding-progress');

        if (progressBar) {
            const progress = this.service.getProgress();
            progressBar.style.width = `${progress}%`;
        }

        switch (this.currentStep) {
            case 'welcome':
                this.renderWelcomeStep(stepContent);
                break;
            case 'permissions':
                this.renderPermissionsStep(stepContent);
                break;
            case 'instrument':
                this.renderInstrumentStep(stepContent);
                break;
            case 'calibration':
                this.renderCalibrationStep(stepContent);
                break;
            case 'complete':
                this.renderCompleteStep(stepContent);
                break;
        }
    }

    /**
     * Render welcome step
     */
    renderWelcomeStep(container) {
        container.innerHTML = `
            <div class="onboarding-step welcome-step">
                <div class="onboarding-icon">
                    <svg viewBox="0 0 64 64" fill="none">
                        <circle cx="32" cy="32" r="30" stroke="var(--accent)" stroke-width="2"/>
                        <path d="M20 44V20L32 12L44 20V44L32 52L20 44Z" fill="var(--accent)" opacity="0.3"/>
                        <path d="M32 12V52M20 20L44 44M44 20L20 44" stroke="var(--accent)" stroke-width="2"/>
                    </svg>
                </div>
                <h2>Welcome to Virtual Concertmaster</h2>
                <p>Your personal bowed string instrument practice companion. Let's get you set up for success.</p>
                <div class="onboarding-actions">
                    <button class="btn btn-primary" id="onboarding-start">Get Started</button>
                    <button class="btn btn-secondary" id="onboarding-skip">Skip</button>
                </div>
            </div>
        `;

        document.getElementById('onboarding-start')?.addEventListener('click', () => {
            this.service.nextStep();
        });

        document.getElementById('onboarding-skip')?.addEventListener('click', () => {
            this.service.skipOnboarding();
        });
    }

    /**
     * Render permissions step
     */
    renderPermissionsStep(container) {
        container.innerHTML = `
            <div class="onboarding-step permissions-step">
                <div class="onboarding-icon">
                    <svg viewBox="0 0 64 64" fill="none">
                        <rect x="8" y="24" width="48" height="28" rx="4" stroke="var(--accent)" stroke-width="2"/>
                        <path d="M32 32V44" stroke="var(--accent)" stroke-width="2"/>
                        <circle cx="32" cy="18" r="6" stroke="var(--accent)" stroke-width="2"/>
                    </svg>
                </div>
                <h2>Enable Permissions</h2>
                <p>Virtual Concertmaster needs access to your microphone and camera to help you practice.</p>

                <div class="permission-cards">
                    <div class="permission-card" id="mic-permission-card">
                        <div class="permission-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                            </svg>
                        </div>
                        <h3>Microphone</h3>
                        <p>For real-time pitch tracking and performance analysis</p>
                        <button class="btn btn-outline" id="request-mic">Allow Microphone</button>
                    </div>

                    <div class="permission-card" id="cam-permission-card">
                        <div class="permission-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                            </svg>
                        </div>
                        <h3>Camera</h3>
                        <p>For scanning sheet music using Optical Music Recognition</p>
                        <button class="btn btn-outline" id="request-cam">Allow Camera</button>
                    </div>
                </div>

                <div class="onboarding-actions">
                    <button class="btn btn-secondary" id="onboarding-back">Back</button>
                    <button class="btn btn-primary" id="onboarding-next-permissions">Continue</button>
                </div>
            </div>
        `;

        this.setupPermissionHandlers();
    }

    /**
     * Setup permission request handlers
     */
    setupPermissionHandlers() {
        const micBtn = document.getElementById('request-mic');
        const camBtn = document.getElementById('request-cam');
        const nextBtn = document.getElementById('onboarding-next-permissions');
        const backBtn = document.getElementById('onboarding-back');

        micBtn?.addEventListener('click', async () => {
            const granted = await this.service.requestMicrophonePermission();
            const card = document.getElementById('mic-permission-card');
            if (granted) {
                card.classList.add('granted');
                micBtn.textContent = 'Granted';
                micBtn.disabled = true;
            }
        });

        camBtn?.addEventListener('click', async () => {
            const granted = await this.service.requestCameraPermission();
            const card = document.getElementById('cam-permission-card');
            if (granted) {
                card.classList.add('granted');
                camBtn.textContent = 'Granted';
                camBtn.disabled = true;
            }
        });

        nextBtn?.addEventListener('click', () => {
            this.service.nextStep();
        });

        backBtn?.addEventListener('click', () => {
            this.service.prevStep();
        });
    }

    /**
     * Render instrument selection step
     */
    renderInstrumentStep(container) {
        const instruments = this.service.getInstrumentOptions();

        container.innerHTML = `
            <div class="onboarding-step instrument-step">
                <div class="onboarding-icon">
                    <svg viewBox="0 0 64 64" fill="none">
                        <circle cx="32" cy="32" r="25" stroke="var(--accent)" stroke-width="2"/>
                        <path d="M22 42V22H32L42 42H22Z" stroke="var(--accent)" stroke-width="2"/>
                    </svg>
                </div>
                <h2>Select Your Instrument</h2>
                <p>Choose your primary instrument for optimized pitch detection and feedback.</p>

                <div class="instrument-grid">
                    ${instruments.map(inst => `
                        <div class="instrument-card" data-instrument="${inst.id}">
                            <div class="instrument-icon">${this.instrumentIcons[inst.id]}</div>
                            <h3>${inst.name}</h3>
                            <p>${inst.description}</p>
                            <span class="instrument-range">${inst.range}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="onboarding-actions">
                    <button class="btn btn-secondary" id="onboarding-back-inst">Back</button>
                    <button class="btn btn-primary" id="onboarding-next-inst" disabled>Continue</button>
                </div>
            </div>
        `;

        this.setupInstrumentHandlers(instruments);
    }

    /**
     * Setup instrument selection handlers
     */
    setupInstrumentHandlers(instruments) {
        const cards = document.querySelectorAll('.instrument-card');
        const nextBtn = document.getElementById('onboarding-next-inst');
        const backBtn = document.getElementById('onboarding-back-inst');

        cards.forEach(card => {
            card.addEventListener('click', () => {
                // Deselect all
                cards.forEach(c => c.classList.remove('selected'));
                // Select clicked
                card.classList.add('selected');
                // Save selection
                const instrument = card.dataset.instrument;
                this.service.selectInstrument(instrument);
                // Enable continue
                nextBtn.disabled = false;
            });
        });

        nextBtn?.addEventListener('click', () => {
            this.service.nextStep();
        });

        backBtn?.addEventListener('click', () => {
            this.service.prevStep();
        });
    }

    /**
     * Render calibration step
     */
    renderCalibrationStep(container) {
        const range = this.service.getSelectedInstrumentRange();

        container.innerHTML = `
            <div class="onboarding-step calibration-step">
                <div class="onboarding-icon">
                    <svg viewBox="0 0 64 64" fill="none">
                        <circle cx="32" cy="32" r="20" stroke="var(--accent)" stroke-width="2"/>
                        <circle cx="32" cy="32" r="10" stroke="var(--accent)" stroke-width="2"/>
                        <circle cx="32" cy="32" r="3" fill="var(--accent)"/>
                    </svg>
                </div>
                <h2>Calibrating Audio Engine</h2>
                <p>We're setting up optimal frequency detection for your <strong>${range?.name || 'instrument'}</strong>.</p>

                <div class="calibration-info">
                    <div class="calibration-range">
                        <span class="label">Frequency Range</span>
                        <span class="value">${range?.minFreq || '?'} - ${range?.maxFreq || '?'} Hz</span>
                    </div>
                    <div class="calibration-filters">
                        <span class="label">Active Filters</span>
                        <span class="value">Bandpass + Sympathetic Vibration Removal</span>
                    </div>
                </div>

                <div class="calibration-status">
                    <div class="calibration-loading">
                        <div class="spinner"></div>
                        <span>Calibrating...</span>
                    </div>
                </div>

                <div class="onboarding-actions">
                    <button class="btn btn-primary" id="onboarding-finish">Start Practicing</button>
                </div>
            </div>
        `;

        // Auto-calibrate after a short delay
        setTimeout(() => {
            this.service.completeCalibration();
        }, 1500);

        document.getElementById('onboarding-finish')?.addEventListener('click', () => {
            this.service.finishOnboarding();
        });
    }

    /**
     * Render completion step
     */
    renderCompleteStep(container) {
        container.innerHTML = `
            <div class="onboarding-step complete-step">
                <div class="onboarding-icon success">
                    <svg viewBox="0 0 64 64" fill="none">
                        <circle cx="32" cy="32" r="30" stroke="var(--success)" stroke-width="2"/>
                        <path d="M20 32L28 40L44 24" stroke="var(--success)" stroke-width="3"/>
                    </svg>
                </div>
                <h2>You're All Set!</h2>
                <p>Virtual Concertmaster is ready to help you improve your playing. Happy practicing!</p>

                <div class="onboarding-actions">
                    <button class="btn btn-primary" id="onboarding-done">Begin Practice</button>
                </div>
            </div>
        `;

        document.getElementById('onboarding-done')?.addEventListener('click', () => {
            this.service.finishOnboarding();
        });
    }

    /**
     * Update progress bar
     */
    updateProgress(progress) {
        const progressBar = this.container?.querySelector('.onboarding-progress');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
    }
}

window.OnboardingUI = OnboardingUI;
