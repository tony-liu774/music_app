/**
 * Onboarding UI Component
 * Handles first-run user experience for permissions and instrument calibration.
 * Features a visually elegant carousel for instrument selection.
 */

class OnboardingUI {
    constructor(onboardingService) {
        this.service = onboardingService;
        this.container = null;
        this.currentStep = 'welcome';
        this.carouselIndex = 0;
        this._calibrationTimer = null;
        this._toastTimer = null;

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
        this._clearTimers();
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
     * Clear any pending timers
     */
    _clearTimers() {
        if (this._calibrationTimer) {
            clearTimeout(this._calibrationTimer);
            this._calibrationTimer = null;
        }
        if (this._toastTimer) {
            clearTimeout(this._toastTimer);
            this._toastTimer = null;
        }
    }

    /**
     * Render the current step
     */
    renderCurrentStep() {
        if (!this.container) return;

        // Clear timers from previous step
        this._clearTimers();

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
                        <circle cx="32" cy="32" r="30" stroke="var(--primary)" stroke-width="2"/>
                        <path d="M20 44V20L32 12L44 20V44L32 52L20 44Z" fill="var(--primary)" opacity="0.3"/>
                        <path d="M32 12V52M20 20L44 44M44 20L20 44" stroke="var(--primary)" stroke-width="2"/>
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

        container.querySelector('#onboarding-start')?.addEventListener('click', () => {
            this.service.nextStep();
        });

        container.querySelector('#onboarding-skip')?.addEventListener('click', () => {
            this.service.skipOnboarding();
        });
    }

    /**
     * Render permissions step with denied state UI
     */
    renderPermissionsStep(container) {
        container.innerHTML = `
            <div class="onboarding-step permissions-step">
                <div class="onboarding-icon">
                    <svg viewBox="0 0 64 64" fill="none">
                        <rect x="8" y="24" width="48" height="28" rx="4" stroke="var(--primary)" stroke-width="2"/>
                        <path d="M32 32V44" stroke="var(--primary)" stroke-width="2"/>
                        <circle cx="32" cy="18" r="6" stroke="var(--primary)" stroke-width="2"/>
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
                        <p>Required for real-time pitch tracking and performance analysis</p>
                        <button class="btn btn-outline" id="request-mic">Allow Microphone</button>
                        <div class="permission-denied-msg" id="mic-denied-msg" style="display:none;">
                            <span class="denied-icon">
                                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd"/>
                                </svg>
                            </span>
                            <span>Permission denied. Tuner &amp; Practice require microphone access.</span>
                            <button class="btn-link" id="open-mic-settings">Open Settings</button>
                        </div>
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
                        <div class="permission-denied-msg" id="cam-denied-msg" style="display:none;">
                            <span class="denied-icon">
                                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd"/>
                                </svg>
                            </span>
                            <span>Permission denied. Camera is optional.</span>
                            <button class="btn-link" id="open-cam-settings">Open Settings</button>
                        </div>
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
     * Setup permission request handlers with denied-state support
     */
    setupPermissionHandlers() {
        const micBtn = this.container.querySelector('#request-mic');
        const camBtn = this.container.querySelector('#request-cam');
        const nextBtn = this.container.querySelector('#onboarding-next-permissions');
        const backBtn = this.container.querySelector('#onboarding-back');

        micBtn?.addEventListener('click', async () => {
            const granted = await this.service.requestMicrophonePermission();
            const card = this.container.querySelector('#mic-permission-card');
            const deniedMsg = this.container.querySelector('#mic-denied-msg');
            if (granted) {
                card.classList.add('granted');
                card.classList.remove('denied');
                micBtn.textContent = 'Granted';
                micBtn.disabled = true;
                if (deniedMsg) deniedMsg.style.display = 'none';
            } else {
                card.classList.add('denied');
                if (deniedMsg) deniedMsg.style.display = 'flex';
            }
        });

        camBtn?.addEventListener('click', async () => {
            const granted = await this.service.requestCameraPermission();
            const card = this.container.querySelector('#cam-permission-card');
            const deniedMsg = this.container.querySelector('#cam-denied-msg');
            if (granted) {
                card.classList.add('granted');
                card.classList.remove('denied');
                camBtn.textContent = 'Granted';
                camBtn.disabled = true;
                if (deniedMsg) deniedMsg.style.display = 'none';
            } else {
                card.classList.add('denied');
                if (deniedMsg) deniedMsg.style.display = 'flex';
            }
        });

        // Open OS settings handlers
        this.container.querySelector('#open-mic-settings')?.addEventListener('click', () => {
            this._openOSSettings();
        });
        this.container.querySelector('#open-cam-settings')?.addEventListener('click', () => {
            this._openOSSettings();
        });

        nextBtn?.addEventListener('click', () => {
            // Warn if mic was denied — Tuner/Practice will be blocked
            if (this.service.microphoneDenied && !this.service.microphoneGranted) {
                const proceed = confirm(
                    'Microphone access was denied. Tuner and Practice features will be unavailable until you grant microphone permission.\n\nContinue anyway?'
                );
                if (!proceed) return;
            }
            this.service.nextStep();
        });

        backBtn?.addEventListener('click', () => {
            this.service.prevStep();
        });
    }

    /**
     * Attempt to open OS-level permission settings
     */
    _openOSSettings() {
        // Guide the user to their OS/browser settings
        const isMac = (navigator.userAgentData?.platform || navigator.userAgent || '').toLowerCase().includes('mac');
        const guidance = isMac
            ? 'Open System Settings > Privacy & Security > Microphone, then enable access for your browser.'
            : 'Open your browser settings and allow microphone access for this site.';

        // Show a toast-style message
        this._showSettingsGuidance(guidance);
    }

    /**
     * Show settings guidance overlay
     */
    _showSettingsGuidance(message) {
        // Cancel any in-flight timer before starting a new one
        if (this._toastTimer) {
            clearTimeout(this._toastTimer);
            this._toastTimer = null;
        }
        let toast = this.container.querySelector('.settings-guidance-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'settings-guidance-toast';
            this.container.querySelector('.onboarding-container')?.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('visible');
        this._toastTimer = setTimeout(() => {
            this._toastTimer = null;
            toast.classList.remove('visible');
        }, 5000);
    }

    /**
     * Render instrument selection step as an elegant carousel
     */
    renderInstrumentStep(container) {
        const instruments = this.service.getInstrumentOptions();
        this.carouselIndex = 0;

        container.innerHTML = `
            <div class="onboarding-step instrument-step">
                <h2>Select Your Instrument</h2>
                <p>Choose your primary instrument for optimized pitch detection and feedback.</p>

                <div class="instrument-carousel" role="listbox" aria-label="Instrument selection">
                    <button class="carousel-arrow carousel-arrow-left" id="carousel-prev" aria-label="Previous instrument">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                    </button>

                    <div class="carousel-track-wrapper">
                        <div class="carousel-track" id="carousel-track">
                            ${instruments.map((inst, i) => `
                                <div class="carousel-card${i === 0 ? ' active' : ''}" data-instrument="${inst.id}" data-index="${i}" role="option" aria-selected="${i === 0 ? 'true' : 'false'}" tabindex="0">
                                    <div class="carousel-card-icon">${this.instrumentIcons[inst.id]}</div>
                                    <h3>${inst.name}</h3>
                                    <p>${inst.description}</p>
                                    <span class="instrument-range">${inst.range}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <button class="carousel-arrow carousel-arrow-right" id="carousel-next" aria-label="Next instrument">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
                    </button>
                </div>

                <div class="carousel-dots" id="carousel-dots">
                    ${instruments.map((_, i) => `<button class="carousel-dot${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Go to instrument ${i + 1}"></button>`).join('')}
                </div>

                <div class="onboarding-actions">
                    <button class="btn btn-secondary" id="onboarding-back-inst">Back</button>
                    <button class="btn btn-primary" id="onboarding-next-inst">Continue</button>
                </div>
            </div>
        `;

        this.setupCarouselHandlers(instruments);
    }

    /**
     * Setup carousel navigation and selection handlers
     */
    setupCarouselHandlers(instruments) {
        const track = this.container.querySelector('#carousel-track');
        const prevBtn = this.container.querySelector('#carousel-prev');
        const nextBtn = this.container.querySelector('#carousel-next');
        const continueBtn = this.container.querySelector('#onboarding-next-inst');
        const backBtn = this.container.querySelector('#onboarding-back-inst');
        const dots = this.container.querySelectorAll('.carousel-dot');
        const cards = this.container.querySelectorAll('.carousel-card');

        // Select first instrument by default
        this.service.selectInstrument(instruments[0].id);

        const goToIndex = (index) => {
            if (index < 0) index = instruments.length - 1;
            if (index >= instruments.length) index = 0;
            this.carouselIndex = index;

            // Translate the track
            if (track) {
                track.style.transform = `translateX(-${index * 100}%)`;
            }

            // Update active card
            cards.forEach((card, i) => {
                card.classList.toggle('active', i === index);
                card.setAttribute('aria-selected', i === index ? 'true' : 'false');
            });

            // Update dots
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });

            // Select instrument
            this.service.selectInstrument(instruments[index].id);
        };

        prevBtn?.addEventListener('click', () => goToIndex(this.carouselIndex - 1));
        nextBtn?.addEventListener('click', () => goToIndex(this.carouselIndex + 1));

        // Dot navigation
        dots.forEach(dot => {
            dot.addEventListener('click', () => {
                goToIndex(parseInt(dot.dataset.index, 10));
            });
        });

        // Card click
        cards.forEach(card => {
            card.addEventListener('click', () => {
                goToIndex(parseInt(card.dataset.index, 10));
            });
        });

        // Keyboard navigation
        this.container.querySelector('.instrument-carousel')?.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') goToIndex(this.carouselIndex - 1);
            if (e.key === 'ArrowRight') goToIndex(this.carouselIndex + 1);
        });

        // Touch swipe support
        let touchStartX = 0;
        const wrapper = this.container.querySelector('.carousel-track-wrapper');
        wrapper?.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });
        wrapper?.addEventListener('touchend', (e) => {
            const diff = touchStartX - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) {
                goToIndex(this.carouselIndex + (diff > 0 ? 1 : -1));
            }
        }, { passive: true });

        continueBtn?.addEventListener('click', () => {
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
                        <circle cx="32" cy="32" r="20" stroke="var(--primary)" stroke-width="2"/>
                        <circle cx="32" cy="32" r="10" stroke="var(--primary)" stroke-width="2"/>
                        <circle cx="32" cy="32" r="3" fill="var(--primary)"/>
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

        // Auto-calibrate after a short delay (handle stored for cleanup)
        this._calibrationTimer = setTimeout(() => {
            this._calibrationTimer = null;
            if (this.service && !this.service.calibrationComplete) {
                this.service.completeCalibration();
            }
        }, 1500);

        container.querySelector('#onboarding-finish')?.addEventListener('click', () => {
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

        container.querySelector('#onboarding-done')?.addEventListener('click', () => {
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

if (typeof window !== 'undefined') {
    window.OnboardingUI = OnboardingUI;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OnboardingUI };
}
