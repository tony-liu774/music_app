/**
 * Role Selection UI - One-time screen for choosing Student or Teacher role.
 * Appears only on first account creation after OAuth sign-in.
 * Renders two selection cards in the Midnight Conservatory theme with Polished Amber accents.
 */

class RoleSelectionUI {
    constructor(roleSelectionService) {
        if (!roleSelectionService) {
            throw new Error('RoleSelectionService is required');
        }
        this.roleSelectionService = roleSelectionService;
        this.container = null;
        this._onRoleSelected = null;
        this._abortController = null;
        this._isSelecting = false;
    }

    /**
     * Initialize the role selection screen.
     * @param {Object} options
     * @param {Function} options.onRoleSelected - Callback with (role, inviteLink?)
     */
    init(options = {}) {
        this._onRoleSelected = options.onRoleSelected || (() => {});
        this.container = document.getElementById('role-selection-screen');
        if (!this.container) return;

        this._render();
        this._bindEvents();
    }

    /**
     * Show the role selection screen.
     */
    show() {
        if (this.container) {
            this.container.classList.add('visible');
            this.container.setAttribute('aria-hidden', 'false');
            const firstCard = this.container.querySelector('.role-card');
            if (firstCard) {
                firstCard.focus();
            }
        }
    }

    /**
     * Hide the role selection screen.
     */
    hide() {
        if (this.container) {
            this.container.classList.remove('visible');
            this.container.setAttribute('aria-hidden', 'true');
        }
    }

    /**
     * Render the role selection HTML.
     * @private
     */
    _render() {
        this.container.innerHTML = `
            <div class="role-selection-content">
                <div class="role-selection-header">
                    <svg class="role-selection-logo" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                        <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="2.5"/>
                        <path d="M32 16v32M24 24l8 8 8-8M24 40l8-8 8 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                    <h1 class="role-selection-title">Welcome to The Virtual Concertmaster</h1>
                    <p class="role-selection-subtitle">Tell us about yourself to personalize your experience</p>
                </div>

                <div class="role-cards">
                    <button class="role-card" id="role-student-card" data-role="student" type="button" aria-label="I am a Musician or Student">
                        <div class="role-card-icon">
                            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <path d="M18 44V12L42 8v32"/>
                                <circle cx="14" cy="44" r="4"/>
                                <circle cx="38" cy="40" r="4"/>
                            </svg>
                        </div>
                        <h2 class="role-card-title">I am a Musician / Student</h2>
                        <p class="role-card-description">Practice with real-time feedback, track your progress, and improve your technique</p>
                    </button>

                    <button class="role-card" id="role-teacher-card" data-role="teacher" type="button" aria-label="I am an Educator">
                        <div class="role-card-icon">
                            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <path d="M24 4L4 16l20 12 20-12L24 4z"/>
                                <path d="M4 16v12l20 12 20-12V16"/>
                                <path d="M36 22v14"/>
                                <circle cx="36" cy="38" r="2"/>
                            </svg>
                        </div>
                        <h2 class="role-card-title">I am an Educator</h2>
                        <p class="role-card-description">Manage your studio, track student progress, and share feedback with your roster</p>
                    </button>
                </div>

                <button class="role-skip-btn" id="role-skip-btn" type="button">
                    Skip for now
                </button>
            </div>
        `;
    }

    /**
     * Bind event listeners.
     * @private
     */
    _bindEvents() {
        this._abortController = new AbortController();
        const opts = { signal: this._abortController.signal };

        const studentCard = this.container.querySelector('#role-student-card');
        const teacherCard = this.container.querySelector('#role-teacher-card');
        const skipBtn = this.container.querySelector('#role-skip-btn');

        if (studentCard) {
            studentCard.addEventListener('click', () => this._handleRoleSelect('student'), opts);
        }
        if (teacherCard) {
            teacherCard.addEventListener('click', () => this._handleRoleSelect('teacher'), opts);
        }
        if (skipBtn) {
            skipBtn.addEventListener('click', () => this._handleSkip(), opts);
        }

        // Keyboard: Enter or Space on cards
        this.container.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.container.classList.contains('visible')) {
                this._handleSkip();
            }
        }, opts);

        // Focus trap within the dialog
        this.container.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            const focusable = this.container.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }, opts);
    }

    /**
     * Handle role selection.
     * @param {string} role - 'student' or 'teacher'
     * @private
     */
    async _handleRoleSelect(role) {
        // Guard against double-clicks while an async setRole is in-flight
        if (this._isSelecting) return;
        this._isSelecting = true;

        // Add selected state visually
        const cards = this.container.querySelectorAll('.role-card');
        cards.forEach(card => card.classList.remove('selected'));
        const selectedCard = this.container.querySelector(`[data-role="${role}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }

        await this.roleSelectionService.setRole(role);

        const inviteLink = role === 'teacher'
            ? this.roleSelectionService.getInviteLink()
            : null;

        this.hide();
        this._onRoleSelected(role, inviteLink);
    }

    /**
     * Handle skip - defaults to student role.
     * @private
     */
    _handleSkip() {
        this.hide();
        this._onRoleSelected('skip', null);
    }

    /**
     * Destroy and clean up.
     */
    destroy() {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

if (typeof window !== 'undefined') {
    window.RoleSelectionUI = RoleSelectionUI;
}
if (typeof module !== 'undefined') {
    module.exports = RoleSelectionUI;
}
