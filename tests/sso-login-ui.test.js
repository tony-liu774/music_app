/**
 * Tests for SSOLoginUI - Launch screen SSO component
 * Uses Jest's jsdom environment (configured in jest.config.js)
 */

// Mock AuthService
class MockAuthService {
    constructor() {
        this._authenticated = false;
        this._listeners = [];
    }
    isAuthenticated() { return this._authenticated; }
    _storeAuth() {}
    _notifyListeners(event, user) {
        this._listeners.forEach(cb => cb(event, user));
    }
    onAuthStateChange(cb) {
        this._listeners.push(cb);
        return () => { this._listeners = this._listeners.filter(l => l !== cb); };
    }
    async getAuthHeaders() {
        return this._authenticated ? { Authorization: 'Bearer token' } : {};
    }
}

// Mock OAuthService
class MockOAuthService {
    constructor() {
        this._googleResult = null;
        this._appleResult = null;
        this._googleError = null;
        this._appleError = null;
        this.providerKey = 'music_app_oauth_provider';
    }
    async signInWithGoogle() {
        if (this._googleError) throw this._googleError;
        return this._googleResult;
    }
    async signInWithApple() {
        if (this._appleError) throw this._appleError;
        return this._appleResult;
    }
    clearProvider() {
        localStorage.removeItem(this.providerKey);
    }
}

// Load the component
const SSOLoginUI = require('../src/js/components/sso-login-ui');

describe('SSOLoginUI', () => {
    let authService, oauthService, ui;

    beforeEach(() => {
        // Create the SSO login screen container in the DOM
        document.body.innerHTML = `
            <div id="sso-login-screen" class="sso-login-screen" aria-hidden="true"></div>
        `;
        authService = new MockAuthService();
        oauthService = new MockOAuthService();
    });

    afterEach(() => {
        if (ui) ui.destroy();
        document.body.innerHTML = '';
    });

    test('constructor requires OAuthService', () => {
        expect(() => new SSOLoginUI(null, authService)).toThrow('OAuthService is required');
    });

    test('constructor requires AuthService', () => {
        expect(() => new SSOLoginUI(oauthService, null)).toThrow('AuthService is required');
    });

    test('init renders the login screen with Google and Apple buttons', () => {
        ui = new SSOLoginUI(oauthService, authService);
        ui.init();

        expect(document.getElementById('sso-google-btn')).toBeTruthy();
        expect(document.getElementById('sso-apple-btn')).toBeTruthy();
        expect(document.getElementById('sso-skip-btn')).toBeTruthy();
    });

    test('init renders branding elements', () => {
        ui = new SSOLoginUI(oauthService, authService);
        ui.init();

        expect(document.querySelector('.sso-login-title').textContent).toBe('The Virtual Concertmaster');
        expect(document.querySelector('.sso-login-subtitle')).toBeTruthy();
        expect(document.querySelector('.sso-login-logo')).toBeTruthy();
    });

    test('Google button contains "Continue with Google" text', () => {
        ui = new SSOLoginUI(oauthService, authService);
        ui.init();

        const btn = document.getElementById('sso-google-btn');
        expect(btn.textContent).toContain('Continue with Google');
    });

    test('Apple button contains "Continue with Apple" text', () => {
        ui = new SSOLoginUI(oauthService, authService);
        ui.init();

        const btn = document.getElementById('sso-apple-btn');
        expect(btn.textContent).toContain('Continue with Apple');
    });

    test('show makes the screen visible', () => {
        ui = new SSOLoginUI(oauthService, authService);
        ui.init();
        ui.show();

        const container = document.getElementById('sso-login-screen');
        expect(container.classList.contains('visible')).toBe(true);
        expect(container.getAttribute('aria-hidden')).toBe('false');
    });

    test('hide makes the screen invisible', () => {
        ui = new SSOLoginUI(oauthService, authService);
        ui.init();
        ui.show();
        ui.hide();

        const container = document.getElementById('sso-login-screen');
        expect(container.classList.contains('visible')).toBe(false);
        expect(container.getAttribute('aria-hidden')).toBe('true');
    });

    test('isAuthenticated delegates to authService', () => {
        ui = new SSOLoginUI(oauthService, authService);
        expect(ui.isAuthenticated()).toBe(false);

        authService._authenticated = true;
        expect(ui.isAuthenticated()).toBe(true);
    });

    test('Google sign-in button calls oauthService and fires onSuccess', async () => {
        const mockUser = { id: '1', email: 'test@gmail.com', displayName: 'Test' };
        oauthService._googleResult = mockUser;

        let successCalled = false;
        let successUser = null;
        let successProvider = null;

        ui = new SSOLoginUI(oauthService, authService);
        ui.init({
            onSuccess: (user, provider) => {
                successCalled = true;
                successUser = user;
                successProvider = provider;
            }
        });
        ui.show();

        document.getElementById('sso-google-btn').click();
        await new Promise(r => setTimeout(r, 50));

        expect(successCalled).toBe(true);
        expect(successUser).toEqual(mockUser);
        expect(successProvider).toBe('google');
    });

    test('Apple sign-in button calls oauthService and fires onSuccess', async () => {
        const mockUser = { id: '2', email: 'test@icloud.com', displayName: 'Apple User' };
        oauthService._appleResult = mockUser;

        let successProvider = null;
        ui = new SSOLoginUI(oauthService, authService);
        ui.init({
            onSuccess: (user, provider) => { successProvider = provider; }
        });
        ui.show();

        document.getElementById('sso-apple-btn').click();
        await new Promise(r => setTimeout(r, 50));

        expect(successProvider).toBe('apple');
    });

    test('skip button hides screen and fires onSuccess with null user', () => {
        let successUser = 'not-called';
        let successProvider = null;

        ui = new SSOLoginUI(oauthService, authService);
        ui.init({
            onSuccess: (user, provider) => {
                successUser = user;
                successProvider = provider;
            }
        });
        ui.show();

        document.getElementById('sso-skip-btn').click();

        expect(successUser).toBe(null);
        expect(successProvider).toBe('skip');
        expect(document.getElementById('sso-login-screen').classList.contains('visible')).toBe(false);
    });

    test('Google sign-in error displays error message and fires onError', async () => {
        oauthService._googleError = new Error('Test error');

        let errorCalled = false;
        let errorProvider = null;

        ui = new SSOLoginUI(oauthService, authService);
        ui.init({
            onError: (err, provider) => {
                errorCalled = true;
                errorProvider = provider;
            }
        });
        ui.show();

        document.getElementById('sso-google-btn').click();
        await new Promise(r => setTimeout(r, 50));

        expect(errorCalled).toBe(true);
        expect(errorProvider).toBe('google');
        const errorEl = document.getElementById('sso-error-message');
        expect(errorEl.textContent).toBe('Test error');
        expect(errorEl.classList.contains('visible')).toBe(true);
    });

    test('Apple sign-in error fires onError callback', async () => {
        oauthService._appleError = new Error('Apple failed');

        let errorProvider = null;
        ui = new SSOLoginUI(oauthService, authService);
        ui.init({
            onError: (err, provider) => { errorProvider = provider; }
        });
        ui.show();

        document.getElementById('sso-apple-btn').click();
        await new Promise(r => setTimeout(r, 50));

        expect(errorProvider).toBe('apple');
    });

    test('loading state disables all buttons', async () => {
        oauthService.signInWithGoogle = () => new Promise(resolve => {
            setTimeout(() => resolve({ id: '1' }), 200);
        });

        ui = new SSOLoginUI(oauthService, authService);
        ui.init();
        ui.show();

        document.getElementById('sso-google-btn').click();

        // Check immediate state (loading)
        await new Promise(r => setTimeout(r, 10));
        const buttons = document.querySelectorAll('.sso-btn');
        buttons.forEach(btn => {
            expect(btn.disabled).toBe(true);
        });

        // Wait for completion
        await new Promise(r => setTimeout(r, 250));
    });

    test('destroy clears container innerHTML', () => {
        ui = new SSOLoginUI(oauthService, authService);
        ui.init();

        const container = document.getElementById('sso-login-screen');
        expect(container.innerHTML.length).toBeGreaterThan(0);

        ui.destroy();
        expect(container.innerHTML).toBe('');
    });

    test('init handles missing container gracefully', () => {
        document.body.innerHTML = ''; // Remove the container
        ui = new SSOLoginUI(oauthService, authService);
        // Should not throw
        ui.init();
    });

    test('show/hide handle null container gracefully', () => {
        ui = new SSOLoginUI(oauthService, authService);
        // container is null since init wasn't called on empty DOM
        ui.show(); // should not throw
        ui.hide(); // should not throw
    });

    test('double click during loading is ignored', async () => {
        let callCount = 0;
        oauthService.signInWithGoogle = async () => {
            callCount++;
            await new Promise(r => setTimeout(r, 100));
            return { id: '1' };
        };

        ui = new SSOLoginUI(oauthService, authService);
        ui.init();
        ui.show();

        document.getElementById('sso-google-btn').click();
        document.getElementById('sso-google-btn').click(); // second click

        await new Promise(r => setTimeout(r, 150));
        expect(callCount).toBe(1);
    });

    test('error is cleared on next sign-in attempt', async () => {
        // First: trigger an error
        oauthService._googleError = new Error('First error');

        ui = new SSOLoginUI(oauthService, authService);
        ui.init();
        ui.show();

        document.getElementById('sso-google-btn').click();
        await new Promise(r => setTimeout(r, 50));

        const errorEl = document.getElementById('sso-error-message');
        expect(errorEl.classList.contains('visible')).toBe(true);

        // Second: fix error and try again
        oauthService._googleError = null;
        oauthService._googleResult = { id: '1' };

        document.getElementById('sso-google-btn').click();
        // Error should be cleared immediately
        await new Promise(r => setTimeout(r, 10));
        expect(errorEl.classList.contains('visible')).toBe(false);

        await new Promise(r => setTimeout(r, 50));
    });

    test('has proper ARIA attributes', () => {
        ui = new SSOLoginUI(oauthService, authService);
        ui.init();

        const errorEl = document.getElementById('sso-error-message');
        expect(errorEl.getAttribute('role')).toBe('alert');
        expect(errorEl.getAttribute('aria-live')).toBe('polite');
    });

    test('Escape key dismisses the dialog (same as skip)', () => {
        let successUser = 'not-called';
        let successProvider = null;

        ui = new SSOLoginUI(oauthService, authService);
        ui.init({
            onSuccess: (user, provider) => {
                successUser = user;
                successProvider = provider;
            }
        });
        ui.show();

        // Simulate pressing Escape
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        document.dispatchEvent(event);

        expect(successUser).toBe(null);
        expect(successProvider).toBe('skip');
        expect(document.getElementById('sso-login-screen').classList.contains('visible')).toBe(false);
    });

    test('Escape key does nothing when dialog is not visible', () => {
        let successCalled = false;

        ui = new SSOLoginUI(oauthService, authService);
        ui.init({
            onSuccess: () => { successCalled = true; }
        });
        // Do NOT call show() -- dialog is hidden

        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        document.dispatchEvent(event);

        expect(successCalled).toBe(false);
    });

    test('show moves focus to the first button', () => {
        ui = new SSOLoginUI(oauthService, authService);
        ui.init();
        ui.show();

        const googleBtn = document.getElementById('sso-google-btn');
        expect(document.activeElement).toBe(googleBtn);
    });

    test('focus trap wraps Tab from last to first focusable element', () => {
        ui = new SSOLoginUI(oauthService, authService);
        ui.init();
        ui.show();

        const skipBtn = document.getElementById('sso-skip-btn');
        skipBtn.focus();

        // Simulate Tab on the last button
        const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        skipBtn.dispatchEvent(tabEvent);

        // The event should have been prevented (focus trap caught it)
        expect(tabEvent.defaultPrevented).toBe(true);
    });

    test('focus trap wraps Shift+Tab from first to last focusable element', () => {
        ui = new SSOLoginUI(oauthService, authService);
        ui.init();
        ui.show();

        const googleBtn = document.getElementById('sso-google-btn');
        googleBtn.focus();

        // Simulate Shift+Tab on the first button
        const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
        googleBtn.dispatchEvent(shiftTabEvent);

        // The event should have been prevented (focus trap caught it)
        expect(shiftTabEvent.defaultPrevented).toBe(true);
    });
});
