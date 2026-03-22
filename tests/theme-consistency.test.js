/**
 * Tests for Midnight Conservatory Theme Consistency
 * Ensures CSS files use theme variables instead of hardcoded colors
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const CSS_DIR = path.join(__dirname, '..', 'src', 'css');
const THEME_FILE = path.join(CSS_DIR, 'themes', 'midnight-conservatory.css');

// Theme spec colors that should NOT appear hardcoded
const THEME_COLORS = {
    '#002147': '--bg-deep (Oxford Blue background should be #0a0a12)',
    '#f5f5f5': '--text-primary (use var(--text-primary) for #f5f5dc)',
};

// Colors that are acceptable when hardcoded (branded buttons, decorative gradients)
const ALLOWED_HARDCODED = [
    '#ffffff', // Google sign-in button (branded)
    '#000000', // Apple sign-in button (branded)
    '#1f1f1f', // Google button text (branded)
    '#ffd700', // Follow-the-ball gradient (decorative)
    '#8b6914', // Follow-the-ball gradient (decorative)
    '#e6b800', // Badge gradient (decorative)
    '#2d5a4a', // Pro badge gradient (decorative)
    '#1a3d30', // Pro badge gradient (decorative)
    '#a68520', // Badge gradient (decorative)
    '#333',    // Apple button border (branded)
    '#00d4ff', // Annotation tool color (feature-specific)
];

// CSS files to check (exclude theme definition file itself)
const CSS_FILES_TO_CHECK = [
    'styles.css',
    'sso-login.css',
    'role-selection.css',
    'annotation-toolbar.css',
    'scale-engine.css',
];

describe('Midnight Conservatory Theme', () => {

    describe('Theme file defines required variables', () => {
        const themeContent = fs.readFileSync(THEME_FILE, 'utf-8');

        const requiredVars = [
            '--bg-deep',
            '--bg-surface',
            '--bg-elevated',
            '--bg-hover',
            '--primary',
            '--primary-light',
            '--primary-dark',
            '--primary-glow',
            '--success',
            '--success-light',
            '--error',
            '--error-light',
            '--text-primary',
            '--text-secondary',
            '--text-muted',
            '--border',
            '--border-light',
            '--font-heading',
            '--font-body',
            '--shadow-sm',
            '--shadow-md',
            '--shadow-lg',
            '--shadow-glow',
            '--bg-deep-98',
            '--bg-deep-95',
            '--bg-deep-85',
            '--bg-overlay',
            '--status-pending',
            '--status-replied',
        ];

        for (const varName of requiredVars) {
            it(`defines ${varName}`, () => {
                assert.ok(
                    themeContent.includes(`${varName}:`),
                    `Theme file must define CSS variable ${varName}`
                );
            });
        }

        it('uses correct Oxford Blue background #0a0a12', () => {
            assert.match(themeContent, /--bg-deep:\s*#0a0a12/);
        });

        it('uses correct Polished Amber primary #c9a227', () => {
            assert.match(themeContent, /--primary:\s*#c9a227/);
        });

        it('uses correct Soft Ivory text #f5f5dc', () => {
            assert.match(themeContent, /--text-primary:\s*#f5f5dc/);
        });

        it('uses Playfair Display for headings', () => {
            assert.match(themeContent, /--font-heading:.*Playfair Display/);
        });

        it('uses Source Sans 3 for body', () => {
            assert.match(themeContent, /--font-body:.*Source Sans 3/);
        });

        it('uses Emerald #10b981 for success', () => {
            assert.match(themeContent, /--success:\s*#10b981/);
        });

        it('uses Crimson #dc2626 for error', () => {
            assert.match(themeContent, /--error:\s*#dc2626/);
        });
    });

    describe('index.html CSS link order', () => {
        const indexContent = fs.readFileSync(
            path.join(__dirname, '..', 'index.html'), 'utf-8'
        );

        it('loads midnight-conservatory.css before styles.css', () => {
            const themePos = indexContent.indexOf('midnight-conservatory.css');
            const stylesPos = indexContent.indexOf('styles.css');
            assert.ok(themePos !== -1, 'midnight-conservatory.css must be linked');
            assert.ok(stylesPos !== -1, 'styles.css must be linked');
            assert.ok(
                themePos < stylesPos,
                'midnight-conservatory.css must load before styles.css'
            );
        });
    });

    describe('No banned hardcoded colors in CSS files', () => {
        for (const cssFile of CSS_FILES_TO_CHECK) {
            const filePath = path.join(CSS_DIR, cssFile);
            if (!fs.existsSync(filePath)) continue;
            const content = fs.readFileSync(filePath, 'utf-8');

            for (const [color, varName] of Object.entries(THEME_COLORS)) {
                it(`${cssFile} does not hardcode ${color} (use ${varName})`, () => {
                    // Check for the color outside of var() fallbacks and comments
                    const lines = content.split('\n');
                    const violations = [];
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (line.startsWith('/*') || line.startsWith('*')) continue;
                        if (line.includes(color) && !line.includes('var(')) {
                            violations.push(`Line ${i + 1}: ${line}`);
                        }
                    }
                    assert.strictEqual(
                        violations.length, 0,
                        `Found hardcoded ${color} in ${cssFile}:\n${violations.join('\n')}`
                    );
                });
            }
        }
    });

    describe('sso-login.css uses theme variables', () => {
        const content = fs.readFileSync(
            path.join(CSS_DIR, 'sso-login.css'), 'utf-8'
        );

        it('uses var(--bg-deep) for background, not #002147', () => {
            assert.ok(
                !content.includes('background: #002147'),
                'SSO login screen must use var(--bg-deep) not #002147'
            );
        });

        it('uses var(--primary) for accent color', () => {
            assert.ok(
                content.includes('var(--primary)'),
                'SSO login must reference --primary variable'
            );
        });

        it('uses var(--text-primary) for title color', () => {
            assert.ok(
                content.includes('var(--text-primary)'),
                'SSO login title must use --text-primary'
            );
        });

        it('uses var(--font-heading) for title font', () => {
            assert.ok(
                content.includes('var(--font-heading)'),
                'SSO login title must use --font-heading'
            );
        });

        it('uses var(--font-body) for body text', () => {
            assert.ok(
                content.includes('var(--font-body)'),
                'SSO login must use --font-body'
            );
        });

        it('uses var(--error) for error message color', () => {
            assert.ok(
                content.includes('var(--error)'),
                'SSO login error must use --error variable'
            );
        });

        it('uses var(--border) for dividers', () => {
            assert.ok(
                content.includes('var(--border)'),
                'SSO login dividers must use --border variable'
            );
        });

        it('uses var(--text-muted) for muted text', () => {
            assert.ok(
                content.includes('var(--text-muted)'),
                'SSO login must use --text-muted for subtle text'
            );
        });
    });

    describe('role-selection.css uses theme variables', () => {
        const content = fs.readFileSync(
            path.join(CSS_DIR, 'role-selection.css'), 'utf-8'
        );

        it('uses var(--bg-deep) for background, not #002147', () => {
            assert.ok(
                !content.includes('background: #002147'),
                'Role selection screen must use var(--bg-deep) not #002147'
            );
        });

        it('uses var(--primary) for accent elements', () => {
            assert.ok(
                content.includes('var(--primary)'),
                'Role selection must reference --primary variable'
            );
        });

        it('uses var(--text-primary) for title text', () => {
            assert.ok(
                content.includes('var(--text-primary)'),
                'Role selection title must use --text-primary'
            );
        });

        it('uses var(--font-heading) for headings', () => {
            assert.ok(
                content.includes('var(--font-heading)'),
                'Role selection must use --font-heading'
            );
        });

        it('uses var(--text-secondary) for descriptions', () => {
            assert.ok(
                content.includes('var(--text-secondary)'),
                'Role selection must use --text-secondary for descriptions'
            );
        });

        it('uses var(--text-muted) for skip button', () => {
            assert.ok(
                content.includes('var(--text-muted)'),
                'Role selection skip button must use --text-muted'
            );
        });
    });

    describe('styles.css uses theme variables for key elements', () => {
        const content = fs.readFileSync(
            path.join(CSS_DIR, 'styles.css'), 'utf-8'
        );

        it('body uses var(--bg-deep) for background', () => {
            assert.ok(
                content.includes('background: var(--bg-deep)'),
                'body background must use var(--bg-deep)'
            );
        });

        it('body uses var(--text-primary) for color', () => {
            assert.ok(
                content.includes('color: var(--text-primary)'),
                'body color must use var(--text-primary)'
            );
        });

        it('body uses var(--font-body) for font-family', () => {
            assert.ok(
                content.includes('var(--font-body)'),
                'body must use var(--font-body)'
            );
        });

        it('headings use var(--font-heading)', () => {
            assert.ok(
                content.includes('font-family: var(--font-heading)'),
                'headings must use var(--font-heading)'
            );
        });

        it('navigation uses var(--bg-deep-98) for semi-transparent bg', () => {
            assert.ok(
                content.includes('var(--bg-deep-98)'),
                'navigation must use var(--bg-deep-98) not hardcoded rgba'
            );
        });

        it('does not use #002147 anywhere', () => {
            assert.ok(
                !content.includes('#002147'),
                'styles.css must not contain old navy blue #002147'
            );
        });

        it('links use var(--primary) for color', () => {
            assert.match(content, /a\s*\{[^}]*color:\s*var\(--primary\)/s);
        });
    });
});
