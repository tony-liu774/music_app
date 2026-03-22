/**
 * @jest-environment node
 *
 * Tests for Midnight Conservatory theme variable application.
 * Verifies that CSS files use theme variables instead of hardcoded colors,
 * and that the theme file defines all required variables.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readCSS(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('Midnight Conservatory Theme', () => {
    let themeCSS, stylesCSS, ssoCSS, roleCSS;

    beforeAll(() => {
        themeCSS = readCSS('src/css/themes/midnight-conservatory.css');
        stylesCSS = readCSS('src/css/styles.css');
        ssoCSS = readCSS('src/css/sso-login.css');
        roleCSS = readCSS('src/css/role-selection.css');
    });

    describe('Theme file defines all required CSS variables', () => {
        const requiredVars = [
            '--bg-deep', '--bg-surface', '--bg-elevated', '--bg-hover',
            '--primary', '--primary-light', '--primary-dark', '--primary-glow',
            '--success', '--success-light', '--success-glow',
            '--error', '--error-light', '--error-glow',
            '--text-primary', '--text-secondary', '--text-muted',
            '--border', '--border-light',
            '--font-heading', '--font-body', '--font-mono',
            '--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-glow',
        ];

        test.each(requiredVars)('defines %s', (varName) => {
            expect(themeCSS).toContain(`${varName}:`);
        });

        test('defines alpha variants for overlays', () => {
            expect(themeCSS).toContain('--bg-deep-98');
            expect(themeCSS).toContain('--bg-deep-95');
            expect(themeCSS).toContain('--bg-deep-85');
            expect(themeCSS).toContain('--bg-overlay');
            expect(themeCSS).toContain('--border-alpha-10');
            expect(themeCSS).toContain('--border-alpha-15');
        });

        test('defines status colors', () => {
            expect(themeCSS).toContain('--status-pending');
            expect(themeCSS).toContain('--status-pending-bg');
            expect(themeCSS).toContain('--status-replied');
            expect(themeCSS).toContain('--status-replied-bg');
        });
    });

    describe('Theme uses correct Midnight Conservatory colors', () => {
        test('background is Oxford Blue #0a0a12', () => {
            expect(themeCSS).toMatch(/--bg-deep:\s*#0a0a12/);
        });

        test('primary accent is Polished Amber #c9a227', () => {
            expect(themeCSS).toMatch(/--primary:\s*#c9a227/);
        });

        test('text is Soft Ivory #f5f5dc', () => {
            expect(themeCSS).toMatch(/--text-primary:\s*#f5f5dc/);
        });

        test('success is Emerald #10b981', () => {
            expect(themeCSS).toMatch(/--success:\s*#10b981/);
        });

        test('error is Crimson #dc2626', () => {
            expect(themeCSS).toMatch(/--error:\s*#dc2626/);
        });

        test('heading font is Playfair Display', () => {
            expect(themeCSS).toMatch(/--font-heading:.*Playfair Display/);
        });

        test('body font is Source Sans 3', () => {
            expect(themeCSS).toMatch(/--font-body:.*Source Sans 3/);
        });
    });

    describe('styles.css uses theme variables for core properties', () => {
        test('body background uses var(--bg-deep)', () => {
            expect(stylesCSS).toMatch(/body\s*\{[^}]*background:\s*var\(--bg-deep\)/);
        });

        test('body color uses var(--text-primary)', () => {
            expect(stylesCSS).toMatch(/body\s*\{[^}]*color:\s*var\(--text-primary\)/);
        });

        test('body font uses var(--font-body)', () => {
            expect(stylesCSS).toMatch(/body\s*\{[^}]*font-family:\s*var\(--font-body\)/);
        });

        test('headings use var(--font-heading)', () => {
            expect(stylesCSS).toMatch(/h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{[^}]*font-family:\s*var\(--font-heading\)/);
        });

        test('nav background uses theme variable, not hardcoded rgba', () => {
            const navMatch = stylesCSS.match(/\.main-nav\s*\{[^}]*background:\s*([^;]+)/);
            expect(navMatch).toBeTruthy();
            expect(navMatch[1]).toContain('var(--bg-deep');
        });

        test('mobile nav uses theme variable for background', () => {
            const mobileNavSection = stylesCSS.match(/\.mobile-nav\s*\{[^}]*background:\s*([^;]+)/);
            expect(mobileNavSection).toBeTruthy();
            expect(mobileNavSection[1]).toContain('var(--bg-deep');
        });
    });

    describe('sso-login.css uses theme variables', () => {
        test('does NOT hardcode #002147 background', () => {
            expect(ssoCSS).not.toContain('#002147');
        });

        test('screen background uses var(--bg-deep)', () => {
            expect(ssoCSS).toMatch(/\.sso-login-screen\s*\{[^}]*background:\s*var\(--bg-deep\)/);
        });

        test('title uses var(--text-primary) for color', () => {
            expect(ssoCSS).toMatch(/\.sso-login-title\s*\{[^}]*color:\s*var\(--text-primary\)/);
        });

        test('title uses var(--font-heading) for font', () => {
            expect(ssoCSS).toMatch(/\.sso-login-title\s*\{[^}]*font-family:\s*var\(--font-heading\)/);
        });

        test('logo uses var(--primary) for color', () => {
            expect(ssoCSS).toMatch(/\.sso-login-logo\s*\{[^}]*color:\s*var\(--primary\)/);
        });

        test('error message uses var(--error)', () => {
            expect(ssoCSS).toMatch(/\.sso-login-error\s*\{[^}]*color:\s*var\(--error\)/);
        });

        test('spinner ring uses var(--primary) for border', () => {
            expect(ssoCSS).toMatch(/\.sso-spinner-ring\s*\{[^}]*border-top-color:\s*var\(--primary\)/);
        });

        test('skip button hover uses var(--primary)', () => {
            expect(ssoCSS).toContain('color: var(--primary)');
        });

        test('divider uses var(--border)', () => {
            expect(ssoCSS).toContain('background: var(--border)');
        });

        test('subtitle uses var(--font-body)', () => {
            expect(ssoCSS).toMatch(/\.sso-login-subtitle\s*\{[^}]*font-family:\s*var\(--font-body\)/);
        });
    });

    describe('role-selection.css uses theme variables', () => {
        test('does NOT hardcode #002147 background', () => {
            expect(roleCSS).not.toContain('#002147');
        });

        test('screen background uses var(--bg-deep)', () => {
            expect(roleCSS).toMatch(/\.role-selection-screen\s*\{[^}]*background:\s*var\(--bg-deep\)/);
        });

        test('title uses var(--text-primary) for color', () => {
            expect(roleCSS).toMatch(/\.role-selection-title\s*\{[^}]*color:\s*var\(--text-primary\)/);
        });

        test('title uses var(--font-heading) for font', () => {
            expect(roleCSS).toMatch(/\.role-selection-title\s*\{[^}]*font-family:\s*var\(--font-heading\)/);
        });

        test('card icon uses var(--primary)', () => {
            expect(roleCSS).toMatch(/\.role-card-icon\s*\{[^}]*color:\s*var\(--primary\)/);
        });

        test('card title uses var(--text-primary)', () => {
            expect(roleCSS).toMatch(/\.role-card-title\s*\{[^}]*color:\s*var\(--text-primary\)/);
        });

        test('card description uses var(--text-secondary)', () => {
            expect(roleCSS).toMatch(/\.role-card-description\s*\{[^}]*color:\s*var\(--text-secondary\)/);
        });

        test('skip button uses var(--text-muted)', () => {
            expect(roleCSS).toMatch(/\.role-skip-btn\s*\{[^}]*color:\s*var\(--text-muted\)/);
        });

        test('subtitle uses var(--font-body)', () => {
            expect(roleCSS).toMatch(/\.role-selection-subtitle\s*\{[^}]*font-family:\s*var\(--font-body\)/);
        });

        test('role card hover uses var(--primary) for border-color', () => {
            expect(roleCSS).toMatch(/\.role-card:hover\s*\{[^}]*border-color:\s*var\(--primary\)/);
        });
    });

    describe('index.html CSS link order', () => {
        let indexHTML;

        beforeAll(() => {
            indexHTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
        });

        test('midnight-conservatory.css is linked before styles.css', () => {
            const themePos = indexHTML.indexOf('midnight-conservatory.css');
            const stylesPos = indexHTML.indexOf('styles.css');
            expect(themePos).toBeGreaterThan(-1);
            expect(stylesPos).toBeGreaterThan(-1);
            expect(themePos).toBeLessThan(stylesPos);
        });

        test('loads Playfair Display font', () => {
            expect(indexHTML).toContain('Playfair+Display');
        });

        test('loads Source Sans 3 font', () => {
            expect(indexHTML).toContain('Source+Sans+3');
        });

        test('theme-color meta uses #0a0a12', () => {
            expect(indexHTML).toMatch(/theme-color.*#0a0a12/);
        });
    });

    describe('No hardcoded anti-pattern colors in CSS files', () => {
        test('sso-login.css does not use #f5f5f5 (should be var(--text-primary))', () => {
            expect(ssoCSS).not.toContain('#f5f5f5');
        });

        test('role-selection.css does not use #f5f5f5 (should be var(--text-primary))', () => {
            expect(roleCSS).not.toContain('#f5f5f5');
        });

        test('styles.css does not use recording dot hardcoded #ef4444', () => {
            const recordingDot = stylesCSS.match(/\.recording-dot\s*\{[^}]*background:\s*([^;]+)/);
            expect(recordingDot).toBeTruthy();
            expect(recordingDot[1]).toContain('var(--error');
        });

        test('styles.css inbox status uses theme variables for pending', () => {
            const inboxPending = stylesCSS.match(/\.inbox-item-status\.pending\s*\{[^}]*color:\s*([^;]+)/);
            expect(inboxPending).toBeTruthy();
            expect(inboxPending[1]).toContain('var(--status-pending)');
        });

        test('styles.css inbox status uses theme variables for replied', () => {
            const inboxReplied = stylesCSS.match(/\.inbox-item-status\.replied\s*\{[^}]*color:\s*([^;]+)/);
            expect(inboxReplied).toBeTruthy();
            expect(inboxReplied[1]).toContain('var(--status-replied)');
        });

        test('styles.css follow-the-ball gradient uses theme primary variables', () => {
            const ftb = stylesCSS.match(/\.follow-the-ball-inner\s*\{[^}]*background:\s*([^;]+)/);
            expect(ftb).toBeTruthy();
            expect(ftb[1]).toContain('var(--primary');
        });

        test('styles.css uses var(--bg-deep-98) for translucent navs', () => {
            expect(stylesCSS).toContain('var(--bg-deep-98)');
        });

        test('styles.css uses var(--bg-deep-95) for modal overlays', () => {
            expect(stylesCSS).toContain('var(--bg-deep-95)');
        });

        test('styles.css uses var(--bg-deep-85) for session ended overlay', () => {
            expect(stylesCSS).toContain('var(--bg-deep-85)');
        });

        test('styles.css uses var(--border-alpha-10) for subtle borders', () => {
            expect(stylesCSS).toContain('var(--border-alpha-10)');
        });
    });
});
