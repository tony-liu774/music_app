/**
 * Accessibility Manager - Handles keyboard navigation, ARIA labels, and screen reader announcements
 */

class AccessibilityManager {
    constructor(app) {
        this.app = app;
        this.liveRegion = null;
        this.announcementQueue = [];
        this.isProcessingQueue = false;
        this.keyboardNavEnabled = true;
        this.focusedElement = null;
    }

    init() {
        this.setupKeyboardNavigation();
        this.setupLiveRegion();
        this.setupARIA();
    }

    /**
     * Setup keyboard navigation for library
     */
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (!this.keyboardNavEnabled) return;

            // Only handle if not in an input/textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key) {
                case 'ArrowRight':
                case 'ArrowLeft':
                    this.handleLibraryNav(e);
                    break;
                case 'Enter':
                    this.handleLibrarySelect(e);
                    break;
                case 'Tab':
                    this.handleTabNavigation(e);
                    break;
                case 'Escape':
                    this.handleEscape(e);
                    break;
                case ' ':
                    this.handleSpacebar(e);
                    break;
            }
        });
    }

    /**
     * Handle arrow key navigation in library
     */
    handleLibraryNav(e) {
        const libraryGrid = document.getElementById('library-grid');
        if (!libraryGrid) return;

        const cards = Array.from(libraryGrid.querySelectorAll('.library-card'));
        if (cards.length === 0) return;

        const currentFocus = document.activeElement;
        const currentIndex = cards.indexOf(currentFocus);

        let newIndex = currentIndex;

        if (e.key === 'ArrowRight') {
            newIndex = (currentIndex + 1) % cards.length;
        } else if (e.key === 'ArrowLeft') {
            newIndex = (currentIndex - 1 + cards.length) % cards.length;
        }

        if (newIndex !== currentIndex || currentIndex === -1) {
            cards[newIndex]?.focus();
            e.preventDefault();
        }
    }

    /**
     * Handle Enter key to select library item
     */
    handleLibrarySelect(e) {
        const currentFocus = document.activeElement;
        if (currentFocus?.classList.contains('library-card')) {
            const id = currentFocus.dataset.id;
            if (id) {
                this.app.selectScore(id);
                this.announce(`Selected: ${currentFocus.querySelector('.library-card-title')?.textContent}`);
            }
        }
    }

    /**
     * Handle Tab navigation with focus management
     */
    handleTabNavigation(e) {
        // Add focus indicators to interactive elements
        const focusableSelectors = [
            'button:not([disabled])',
            'a[href]',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ];

        const focusableElements = document.querySelectorAll(focusableSelectors.join(', '));
        focusableElements.forEach(el => {
            el.classList.add('keyboard-focusable');
        });
    }

    /**
     * Handle Escape key
     */
    handleEscape(e) {
        // Close modals
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            activeModal.classList.remove('active');
            this.announce('Modal closed');
            e.preventDefault();
        }

        // Stop practice if active
        if (this.app.isPracticing) {
            this.app.togglePractice();
            this.announce('Practice stopped');
            e.preventDefault();
        }
    }

    /**
     * Handle spacebar for toggles
     */
    handleSpacebar(e) {
        const target = e.target;
        if (target.classList.contains('toggle-btn') || target.classList.contains('star-btn')) {
            target.click();
            e.preventDefault();
        }
    }

    /**
     * Setup live region for screen reader announcements
     */
    setupLiveRegion() {
        this.liveRegion = document.createElement('div');
        this.liveRegion.setAttribute('role', 'status');
        this.liveRegion.setAttribute('aria-live', 'polite');
        this.liveRegion.setAttribute('aria-atomic', 'true');
        this.liveRegion.className = 'sr-only';
        this.liveRegion.id = 'sr-announcer';
        document.body.appendChild(this.liveRegion);
    }

    /**
     * Announce message to screen readers
     */
    announce(message, priority = 'polite') {
        if (!this.liveRegion) return;

        // Set priority
        this.liveRegion.setAttribute('aria-live', priority);

        // Clear and set new message
        this.liveRegion.textContent = '';

        // Use timeout to ensure screen reader picks up change
        setTimeout(() => {
            this.liveRegion.textContent = message;
        }, 50);
    }

    /**
     * Announce score changes
     */
    announceScoreChange(note, accuracy) {
        const noteName = note?.name || '--';
        const octave = note?.octave || '';
        const cents = note?.centsDeviation || 0;
        const accuracyPercent = Math.round(accuracy || 0);

        let message = `Note: ${noteName}${octave}`;

        if (cents !== 0) {
            const direction = cents > 0 ? 'sharp' : 'flat';
            message += `, ${Math.abs(cents)} cents ${direction}`;
        }

        message += `. Accuracy: ${accuracyPercent}%`;

        this.announce(message);
    }

    /**
     * Announce session summary
     */
    announceSessionSummary(breakdown) {
        const pitch = Math.round(breakdown.pitch?.score || 0);
        const rhythm = Math.round(breakdown.rhythm?.score || 0);
        const intonation = Math.round(breakdown.intonation?.score || 0);
        const overall = Math.round((pitch + rhythm + intonation) / 3);

        this.announce(
            `Practice complete. Overall accuracy: ${overall}%. ` +
            `Pitch: ${pitch}%. Rhythm: ${rhythm}%. Intonation: ${intonation}%.`,
            'assertive'
        );
    }

    /**
     * Setup ARIA labels for feedback panel
     */
    setupARIA() {
        this.setupFeedbackPanelARIA();
        this.setupLibraryARIA();
        this.setupSettingsARIA();
    }

    /**
     * Setup ARIA for feedback panel
     */
    setupFeedbackPanelARIA() {
        const feedbackPanel = document.getElementById('feedback-panel');
        if (feedbackPanel) {
            feedbackPanel.setAttribute('role', 'region');
            feedbackPanel.setAttribute('aria-label', 'Performance Feedback');
        }

        // Note display
        const noteDisplay = document.getElementById('current-note');
        if (noteDisplay) {
            noteDisplay.setAttribute('role', 'status');
            noteDisplay.setAttribute('aria-live', 'off');
        }

        // Accuracy score
        const accuracyScore = document.getElementById('accuracy-score');
        if (accuracyScore) {
            accuracyScore.setAttribute('role', 'status');
            accuracyScore.setAttribute('aria-label', 'Current accuracy percentage');
        }

        // Pitch meter
        const pitchMeter = document.getElementById('pitch-meter');
        if (pitchMeter) {
            pitchMeter.setAttribute('role', 'progressbar');
            pitchMeter.setAttribute('aria-valuemin', '-50');
            pitchMeter.setAttribute('aria-valuemax', '50');
            pitchMeter.setAttribute('aria-valuenow', '0');
            pitchMeter.setAttribute('aria-label', 'Pitch deviation in cents');
        }

        // Timing display
        const timingDisplay = document.getElementById('timing-display');
        if (timingDisplay) {
            timingDisplay.setAttribute('aria-label', 'Timing deviation in milliseconds');
        }
    }

    /**
     * Setup ARIA for library
     */
    setupLibraryARIA() {
        const libraryGrid = document.getElementById('library-grid');
        if (libraryGrid) {
            libraryGrid.setAttribute('role', 'list');
            libraryGrid.setAttribute('aria-label', 'Sheet music library');
        }

        // Search input
        const searchInput = document.getElementById('library-search-input');
        if (searchInput) {
            searchInput.setAttribute('aria-label', 'Search library');
            searchInput.setAttribute('placeholder', 'Search by title, composer, or instrument');
        }
    }

    /**
     * Setup ARIA for settings
     */
    setupSettingsARIA() {
        // Toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.setAttribute('role', 'switch');
            const isActive = btn.classList.contains('active');
            btn.setAttribute('aria-checked', isActive);
        });

        // Sliders
        document.querySelectorAll('input[type="range"]').forEach(slider => {
            const label = slider.closest('.slider-setting')?.querySelector('label');
            if (label) {
                slider.setAttribute('aria-label', label.textContent);
            }
        });

        // Instrument options
        document.querySelectorAll('.instrument-option').forEach(btn => {
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-checked', btn.classList.contains('active'));
        });
    }

    /**
     * Update pitch meter ARIA
     */
    updatePitchMeterARIA(cents) {
        const pitchMeter = document.getElementById('pitch-meter');
        if (pitchMeter) {
            pitchMeter.setAttribute('aria-valuenow', Math.round(cents));
        }
    }

    /**
     * Update accuracy ARIA
     */
    updateAccuracyARIA(score) {
        const accuracyScore = document.getElementById('accuracy-score');
        if (accuracyScore) {
            accuracyScore.setAttribute('aria-label', `Current accuracy: ${Math.round(score)} percent`);
        }
    }

    /**
     * Update toggle ARIA state
     */
    updateToggleARIA(button, isActive) {
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-checked', isActive);
    }

    /**
     * Enable/disable keyboard navigation
     */
    setKeyboardNavigationEnabled(enabled) {
        this.keyboardNavEnabled = enabled;
    }
}

window.AccessibilityManager = AccessibilityManager;
