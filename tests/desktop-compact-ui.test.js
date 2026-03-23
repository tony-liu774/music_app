/**
 * Desktop Compact UI Tests
 *
 * Verifies that the UI uses properly compact sizing for desktop viewports.
 * Uses range assertions (min–max) to guard against both oversized and
 * accidentally zeroed-out values.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS_PATH = path.join(__dirname, '..', 'src', 'css', 'app.css');
const COMPILED_PATH = path.join(__dirname, '..', 'public', 'styles.css');

function readAppCSS() {
    return fs.readFileSync(CSS_PATH, 'utf8');
}

function readCompiledCSS() {
    return fs.readFileSync(COMPILED_PATH, 'utf8');
}

/**
 * Extract the FIRST CSS custom property value from the file.
 * Note: this returns the first occurrence; for properties defined in
 * multiple blocks, the effective value depends on CSS cascade rules.
 */
function extractCSSVar(css, varName) {
    const regex = new RegExp(`${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*([^;]+)`);
    const match = css.match(regex);
    return match ? match[1].trim() : null;
}

/**
 * Parse a rem/px value to pixels (assuming 16px base).
 * Returns NaN for non-numeric values (e.g., var() references).
 */
function toPixels(value) {
    if (!value) return NaN;
    if (value.startsWith('var(')) return NaN;
    if (value.endsWith('px')) return parseFloat(value);
    if (value.endsWith('rem')) return parseFloat(value) * 16;
    return parseFloat(value);
}

/**
 * Assert that a pixel value falls within [min, max] range.
 */
function assertRange(px, min, max, label) {
    assert.ok(!isNaN(px), `${label}: value should be a numeric pixel value, got NaN`);
    assert.ok(px >= min && px <= max, `${label} should be ${min}–${max}px, got ${px}px`);
}

describe('Desktop Compact UI — Sizing Constraints', () => {

    describe('Theme-level font sizes', () => {
        it('--text-4xl should be 24–32px', () => {
            const css = readAppCSS();
            const val = extractCSSVar(css, '--text-4xl');
            assert.ok(val, '--text-4xl should be defined');
            assertRange(toPixels(val), 24, 32, '--text-4xl');
        });

        it('--text-3xl should be 20–28px', () => {
            const css = readAppCSS();
            const val = extractCSSVar(css, '--text-3xl');
            assert.ok(val, '--text-3xl should be defined');
            assertRange(toPixels(val), 20, 28, '--text-3xl');
        });

        it('--text-base should be 12–16px', () => {
            const css = readAppCSS();
            const val = extractCSSVar(css, '--text-base');
            assert.ok(val, '--text-base should be defined');
            assertRange(toPixels(val), 12, 16, '--text-base');
        });
    });

    describe('Layout sizing', () => {
        it('--nav-height should be 40–56px', () => {
            const css = readAppCSS();
            const val = extractCSSVar(css, '--nav-height');
            assert.ok(val, '--nav-height should be defined');
            assertRange(toPixels(val), 40, 56, '--nav-height');
        });

        it('--container-max should be 1200px', () => {
            const css = readAppCSS();
            const val = extractCSSVar(css, '--container-max');
            assert.ok(val, '--container-max should be defined');
            assert.strictEqual(val, '1200px');
        });
    });

    describe('Spacing variables follow standard scale', () => {
        it('--space-4 should equal 1rem (standard 4 * 0.25rem)', () => {
            const css = readAppCSS();
            const val = extractCSSVar(css, '--space-4');
            assert.ok(val, '--space-4 should be defined');
            assert.strictEqual(val, '1rem', '--space-4 should be 1rem (4 * 0.25rem)');
        });

        it('--space-8 should equal 2rem (standard 8 * 0.25rem)', () => {
            const css = readAppCSS();
            const val = extractCSSVar(css, '--space-8');
            assert.ok(val, '--space-8 should be defined');
            assert.strictEqual(val, '2rem', '--space-8 should be 2rem (8 * 0.25rem)');
        });
    });

    describe('Dashboard card sizing', () => {
        it('dashboard-card padding should be 10–20px', () => {
            const css = readAppCSS();
            const match = css.match(/\.dashboard-card\s*\{[^}]*padding:\s*([^;]+)/);
            assert.ok(match, 'Should find .dashboard-card padding');
            const padding = match[1].trim();
            const parts = padding.split(/\s+/);
            for (const part of parts) {
                const px = toPixels(part);
                assertRange(px, 10, 20, `dashboard-card padding (${part})`);
            }
        });

        it('dashboard-card border-radius should be 8–16px', () => {
            const css = readAppCSS();
            const match = css.match(/\.dashboard-card\s*\{[^}]*border-radius:\s*([^;]+)/);
            assert.ok(match, 'Should find .dashboard-card border-radius');
            const px = toPixels(match[1].trim());
            assertRange(px, 8, 16, 'dashboard-card border-radius');
        });

        it('dashboard-card-icon should be 32–44px', () => {
            const css = readAppCSS();
            const match = css.match(/\.dashboard-card-icon\s*\{[^}]*width:\s*([^;]+)/);
            assert.ok(match, 'Should find .dashboard-card-icon width');
            const px = toPixels(match[1].trim());
            assertRange(px, 32, 44, 'dashboard-card-icon width');
        });
    });

    describe('Hero card sizing', () => {
        it('hero-card padding should be 12–24px', () => {
            const css = readAppCSS();
            const match = css.match(/\.hero-card\s*\{[^}]*padding:\s*([^;]+)/);
            assert.ok(match, 'Should find .hero-card padding');
            const parts = match[1].trim().split(/\s+/);
            for (const part of parts) {
                const px = toPixels(part);
                assertRange(px, 12, 24, `hero-card padding (${part})`);
            }
        });

        it('hero-card border-radius should be 10–20px', () => {
            const css = readAppCSS();
            const match = css.match(/\.hero-card\s*\{[^}]*border-radius:\s*([^;]+)/);
            assert.ok(match, 'Should find .hero-card border-radius');
            const px = toPixels(match[1].trim());
            assertRange(px, 10, 20, 'hero-card border-radius');
        });
    });

    describe('Stat card sizing', () => {
        it('stat-card padding should be 10–18px', () => {
            const css = readAppCSS();
            const match = css.match(/\.stat-card\s*\{[^}]*padding:\s*([^;]+)/);
            assert.ok(match, 'Should find .stat-card padding');
            const px = toPixels(match[1].trim());
            assertRange(px, 10, 18, 'stat-card padding');
        });

        it('stat-card border-radius should be 8–16px', () => {
            const css = readAppCSS();
            const match = css.match(/\.stat-card\s*\{[^}]*border-radius:\s*([^;]+)/);
            assert.ok(match, 'Should find .stat-card border-radius');
            const px = toPixels(match[1].trim());
            assertRange(px, 8, 16, 'stat-card border-radius');
        });
    });

    describe('Accessibility — minimum font sizes', () => {
        it('nav-link font-size should be 14px (accessibility minimum)', () => {
            const css = readAppCSS();
            const match = css.match(/\.nav-link\s*\{[^}]*font-size:\s*([^;]+)/);
            assert.ok(match, 'Should find .nav-link font-size');
            const px = toPixels(match[1].trim());
            assertRange(px, 14, 15, 'nav-link font-size');
        });

        it('dashboard-card-sublabel should be at least 12px', () => {
            const css = readAppCSS();
            const match = css.match(/\.dashboard-card-sublabel\s*\{[^}]*font-size:\s*([^;]+)/);
            assert.ok(match, 'Should find .dashboard-card-sublabel font-size');
            const px = toPixels(match[1].trim());
            assertRange(px, 12, 14, 'dashboard-card-sublabel font-size');
        });
    });

    describe('Compiled output contains compact sizes', () => {
        it('compiled CSS should contain the compact nav-height', () => {
            const css = readCompiledCSS();
            assert.ok(css.includes('--nav-height:52px') || css.includes('--nav-height: 52px'),
                'Compiled CSS should have compact --nav-height (52px)');
        });

        it('compiled CSS should not contain oversized heading sizes', () => {
            const css = readCompiledCSS();
            assert.ok(!css.includes('--text-4xl:3rem') && !css.includes('--text-4xl: 3rem'),
                'Compiled CSS should not have oversized --text-4xl (3rem)');
        });
    });

    describe('Responsive breakpoints exist', () => {
        it('should have desktop breakpoint at min-width 768px', () => {
            const css = readAppCSS();
            assert.ok(css.includes('@media (min-width: 768px)'),
                'Should have desktop breakpoint');
        });

        it('should have mobile breakpoint at max-width 768px', () => {
            const css = readAppCSS();
            assert.ok(css.includes('@media (max-width: 768px)'),
                'Should have mobile breakpoint');
        });

        it('should have dashboard responsive adjustments', () => {
            const css = readAppCSS();
            assert.ok(css.includes('Dashboard Responsive'),
                'Should have dashboard responsive section');
        });
    });

    describe('Service worker cache version', () => {
        it('sw.js should use concertmaster-v4 cache name', () => {
            const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
            assert.ok(sw.includes("concertmaster-v4"),
                'Service worker should use concertmaster-v4 cache name');
        });
    });
});
