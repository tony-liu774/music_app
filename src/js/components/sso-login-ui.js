/**
 * SSO Login UI - Launch screen with Google and Apple sign-in buttons.
 * Renders a full-screen overlay on Oxford Blue background with
 * high-contrast, clean "Continue with Google" and "Continue with Apple" buttons.
 */

class SSOLoginUI {
    constructor(oauthService, authService) {
        if (!oauthService) {
            throw new Error('OAuthService is required');
        }
        if (!authService) {
            throw new Error('AuthService is required');
        }
        this.oauthService = oauthService;
        this.authService = authService;
        this.container = null;
        this._onSuccess = null;
        this._onError = null;
        this._loading = false;
        this._abortController = null;
    }

    /**
     * Initialize the SSO login screen.
     * Creates the DOM elements and attaches event listeners.
     * @param {Object} options
     * @param {Function} options.onSuccess - Callback when auth succeeds
     * @param {Function} options.onError - Callback when auth fails
     */
    init(options = {}) {
        this._onSuccess = options.onSuccess || (() => {});
        this._onError = options.onError || (() => {});

        this.container = document.getElementById('sso-login-screen');
        if (!this.container) return;

        this._render();
        this._bindEvents();
    }

    /**
     * Show the SSO login screen.
     */
    show() {
        if (this.container) {
            this.container.classList.add('visible');
            this.container.setAttribute('aria-hidden', 'false');
        }
    }

    /**
     * Hide the SSO login screen.
     */
    hide() {
        if (this.container) {
            this.container.classList.remove('visible');
            this.container.setAttribute('aria-hidden', 'true');
        }
    }

    /**
     * Check if user is already authenticated; if so, skip login.
     * @returns {boolean} true if user is authenticated
     */
    isAuthenticated() {
        return this.authService.isAuthenticated();
    }

    /**
     * Render the login screen HTML.
     * @private
     */
    _render() {
        this.container.innerHTML = `
            <div class="sso-login-content">
                <div class="sso-login-branding">
                    <svg class="sso-login-logo" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                        <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="2.5"/>
                        <path d="M32 16v32M24 24l8 8 8-8M24 40l8-8 8 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                    <h1 class="sso-login-title">The Virtual Concertmaster</h1>
                    <p class="sso-login-subtitle">Practice with precision. Perform with confidence.</p>
                </div>

                <div class="sso-login-buttons">
                    <button class="sso-btn sso-btn-google" id="sso-google-btn" type="button">
                        <svg class="sso-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span>Continue with Google</span>
                    </button>

                    <button class="sso-btn sso-btn-apple" id="sso-apple-btn" type="button">
                        <svg class="sso-btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                        </svg>
                        <span>Continue with Apple</span>
                    </button>
                </div>

                <div class="sso-login-divider">
                    <span>or</span>
                </div>

                <button class="sso-btn sso-btn-skip" id="sso-skip-btn" type="button">
                    Continue without account
                </button>

                <p class="sso-login-terms">
                    By signing in, you agree to our Terms of Service and Privacy Policy.
                </p>

                <div class="sso-login-error" id="sso-error-message" role="alert" aria-live="polite"></div>
                <div class="sso-login-spinner" id="sso-spinner" aria-hidden="true">
                    <div class="sso-spinner-ring"></div>
                </div>
            </div>
        `;
    }

    /**
     * Bind click events to SSO buttons.
     * @private
     */
    _bindEvents() {
        // Use AbortController so destroy() can remove all listeners at once
        this._abortController = new AbortController();
        const opts = { signal: this._abortController.signal };

        const googleBtn = this.container.querySelector('#sso-google-btn');
        const appleBtn = this.container.querySelector('#sso-apple-btn');
        const skipBtn = this.container.querySelector('#sso-skip-btn');

        if (googleBtn) {
            googleBtn.addEventListener('click', () => this._handleGoogleSignIn(), opts);
        }
        if (appleBtn) {
            appleBtn.addEventListener('click', () => this._handleAppleSignIn(), opts);
        }
        if (skipBtn) {
            skipBtn.addEventListener('click', () => this._handleSkip(), opts);
        }
    }

    /**
     * Handle Google sign-in button click.
     * @private
     */
    async _handleGoogleSignIn() {
        if (this._loading) return;
        this._setLoading(true);
        this._clearError();

        try {
            const user = await this.oauthService.signInWithGoogle();
            this.hide();
            this._onSuccess(user, 'google');
        } catch (error) {
            this._showError(error.message || 'Google sign-in failed. Please try again.');
            this._onError(error, 'google');
        } finally {
            this._setLoading(false);
        }
    }

    /**
     * Handle Apple sign-in button click.
     * @private
     */
    async _handleAppleSignIn() {
        if (this._loading) return;
        this._setLoading(true);
        this._clearError();

        try {
            const user = await this.oauthService.signInWithApple();
            this.hide();
            this._onSuccess(user, 'apple');
        } catch (error) {
            this._showError(error.message || 'Apple sign-in failed. Please try again.');
            this._onError(error, 'apple');
        } finally {
            this._setLoading(false);
        }
    }

    /**
     * Handle skip (continue without account).
     * @private
     */
    _handleSkip() {
        this.hide();
        this._onSuccess(null, 'skip');
    }

    /**
     * Show/hide the loading spinner.
     * @param {boolean} loading
     * @private
     */
    _setLoading(loading) {
        this._loading = loading;
        const spinner = this.container.querySelector('#sso-spinner');
        const buttons = this.container.querySelectorAll('.sso-btn');

        if (spinner) {
            spinner.setAttribute('aria-hidden', String(!loading));
        }
        buttons.forEach(btn => {
            btn.disabled = loading;
        });
    }

    /**
     * Display an error message.
     * @param {string} message
     * @private
     */
    _showError(message) {
        const el = this.container.querySelector('#sso-error-message');
        if (el) {
            el.textContent = message;
            el.classList.add('visible');
        }
    }

    /**
     * Clear the error message.
     * @private
     */
    _clearError() {
        const el = this.container.querySelector('#sso-error-message');
        if (el) {
            el.textContent = '';
            el.classList.remove('visible');
        }
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
    window.SSOLoginUI = SSOLoginUI;
}
if (typeof module !== 'undefined') {
    module.exports = SSOLoginUI;
}
