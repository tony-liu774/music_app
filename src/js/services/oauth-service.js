/**
 * OAuth Service - Client-side SSO integration for Google and Apple sign-in.
 * Handles the full OAuth flow: SDK initialization, user consent, token exchange,
 * and session persistence via the existing AuthService.
 */

class OAuthService {
    constructor(authService, apiBaseUrl = '') {
        if (!authService) {
            throw new Error('AuthService is required');
        }
        this.authService = authService;
        this.apiBaseUrl = apiBaseUrl;
        this.googleClientId = '';
        this.appleClientId = '';
        this._googleInitialized = false;
        this._appleInitialized = false;
        this.providerKey = 'music_app_oauth_provider';
    }

    /**
     * Configure OAuth provider client IDs.
     * @param {Object} config - { googleClientId, appleClientId }
     */
    configure(config = {}) {
        if (config.googleClientId) {
            this.googleClientId = config.googleClientId;
        }
        if (config.appleClientId) {
            this.appleClientId = config.appleClientId;
        }
    }

    /**
     * Fetch OAuth config (public client IDs) from the server.
     * Falls back to window.OAUTH_CONFIG if the fetch fails.
     * @returns {Promise<void>}
     */
    async fetchConfig() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/auth/oauth/config`);
            if (response.ok) {
                const config = await response.json();
                this.configure(config);
                return;
            }
        } catch {
            // Fetch failed, fall through to window config
        }
        // Fallback to global config
        if (typeof window !== 'undefined' && window.OAUTH_CONFIG) {
            this.configure(window.OAUTH_CONFIG);
        }
    }

    /**
     * Initialize the Google Sign-In SDK.
     * Loads the GSI client library and configures the client.
     * @returns {Promise<boolean>} true if initialized
     */
    async initGoogle() {
        if (this._googleInitialized) return true;
        if (!this.googleClientId) return false;

        // Check if google.accounts.id is already available (script loaded in HTML)
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            this._googleInitialized = true;
            return true;
        }

        // Otherwise, dynamically load the GSI script
        return new Promise((resolve) => {
            if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
                const interval = setInterval(() => {
                    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
                        this._googleInitialized = true;
                        clearInterval(interval);
                        resolve(true);
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(interval);
                    resolve(false);
                }, 5000);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                this._googleInitialized = true;
                resolve(true);
            };
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize the Apple Sign-In SDK.
     * @returns {Promise<boolean>} true if initialized
     */
    async initApple() {
        if (this._appleInitialized) return true;
        if (!this.appleClientId) return false;

        if (typeof AppleID !== 'undefined' && AppleID.auth) {
            this._appleInitialized = true;
            return true;
        }

        return new Promise((resolve) => {
            if (document.querySelector('script[src*="appleid.auth.js"]')) {
                const interval = setInterval(() => {
                    if (typeof AppleID !== 'undefined' && AppleID.auth) {
                        this._appleInitialized = true;
                        clearInterval(interval);
                        resolve(true);
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(interval);
                    resolve(false);
                }, 5000);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                this._appleInitialized = true;
                resolve(true);
            };
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
        });
    }

    /**
     * Sign in with Google.
     * Uses a settled-once pattern to avoid the race between callback and prompt notification.
     * @returns {Promise<Object>} User object
     */
    async signInWithGoogle() {
        if (!this._googleInitialized) {
            const initialized = await this.initGoogle();
            if (!initialized) {
                throw new Error('Google Sign-In SDK not available');
            }
        }

        return new Promise((resolve, reject) => {
            let settled = false;

            google.accounts.id.initialize({
                client_id: this.googleClientId,
                callback: async (response) => {
                    if (settled) return;
                    settled = true;
                    try {
                        const user = await this._exchangeGoogleToken(response.credential);
                        resolve(user);
                    } catch (error) {
                        reject(error);
                    }
                }
            });

            google.accounts.id.prompt((notification) => {
                if (settled) return;
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    settled = true;
                    reject(new Error('Google Sign-In was dismissed'));
                }
            });
        });
    }

    /**
     * Sign in with Apple.
     * @returns {Promise<Object>} User object
     */
    async signInWithApple() {
        if (!this._appleInitialized) {
            const initialized = await this.initApple();
            if (!initialized) {
                throw new Error('Apple Sign-In SDK not available');
            }
        }

        AppleID.auth.init({
            clientId: this.appleClientId,
            scope: 'name email',
            redirectURI: window.location.origin,
            usePopup: true
        });

        const response = await AppleID.auth.signIn();

        if (!response || !response.authorization || !response.authorization.id_token) {
            throw new Error('Apple Sign-In failed: no token received');
        }

        // Apple provides user info only on first authorization
        const appleUser = response.user || {};
        const displayName = appleUser.name
            ? `${appleUser.name.firstName || ''} ${appleUser.name.lastName || ''}`.trim()
            : undefined;

        // Only send displayName to backend, NOT email
        // (email comes from the verified token on the server side)
        return this._exchangeAppleToken(
            response.authorization.id_token,
            displayName
        );
    }

    /**
     * Exchange a Google ID token with our backend for app tokens.
     * @param {string} idToken - Google credential JWT
     * @returns {Promise<Object>} User object
     * @private
     */
    async _exchangeGoogleToken(idToken) {
        const response = await fetch(`${this.apiBaseUrl}/api/auth/oauth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Google authentication failed');
        }

        const data = await response.json();
        this.authService._storeAuth(data);
        this._storeProvider('google');
        this.authService._notifyListeners('login', data.user);
        return data.user;
    }

    /**
     * Exchange an Apple ID token with our backend for app tokens.
     * @param {string} idToken - Apple ID token JWT
     * @param {string} [displayName] - User display name (first auth only)
     * @returns {Promise<Object>} User object
     * @private
     */
    async _exchangeAppleToken(idToken, displayName) {
        const response = await fetch(`${this.apiBaseUrl}/api/auth/oauth/apple`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, displayName })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Apple authentication failed');
        }

        const data = await response.json();
        this.authService._storeAuth(data);
        this._storeProvider('apple');
        this.authService._notifyListeners('login', data.user);
        return data.user;
    }

    /**
     * Link an additional OAuth provider to the current account.
     * @param {string} provider - 'google' or 'apple'
     * @param {string} idToken - Provider ID token
     * @returns {Promise<Object>} Link result
     */
    async linkProvider(provider, idToken) {
        const headers = await this.authService.getAuthHeaders();
        if (!headers.Authorization) {
            throw new Error('Must be authenticated to link accounts');
        }

        const response = await fetch(`${this.apiBaseUrl}/api/auth/oauth/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ provider, idToken })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Account linking failed');
        }

        return response.json();
    }

    /**
     * Get the OAuth provider used for the current session.
     * @returns {string|null} Provider name or null
     */
    getProvider() {
        try {
            return localStorage.getItem(this.providerKey);
        } catch {
            return null;
        }
    }

    /**
     * Store the OAuth provider name for the current session.
     * @param {string} provider
     * @private
     */
    _storeProvider(provider) {
        try {
            localStorage.setItem(this.providerKey, provider);
        } catch {
            // localStorage quota exceeded - non-critical
        }
    }

    /**
     * Clear stored provider on logout.
     */
    clearProvider() {
        try {
            localStorage.removeItem(this.providerKey);
        } catch {
            // non-critical
        }
    }
}

if (typeof window !== 'undefined') {
    window.OAuthService = OAuthService;
}
if (typeof module !== 'undefined') {
    module.exports = OAuthService;
}
