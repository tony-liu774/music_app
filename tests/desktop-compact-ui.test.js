/**
 * Desktop Compact UI Tests
 *
 * Verifies that the UI uses properly compact sizing for desktop viewports.
 * Ensures elements are not oversized/zoomed-in appearance.
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
 * Extract a CSS custom property value from :root or @theme block.
 */
function extractCSSVar(css, varName) {
    const regex = new RegExp(`${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*([^;]+)`);
    const match = css.match(regex);
    return match ? match[1].trim() : null;
}

/**
 * Parse a rem/px value to pixels (assuming 16px base).
 */
function toPixels(value) {
    if (!value) return null;
    if (value.endsWith('px')) return parseFloat(value);
    if (value.endsWith('rem')) return parseFloat(value) * 16;
    return parseFloat(value);
}

describe('Desktop Compact UI — Sizing Constraints', () => {

    describe('Theme-level font sizes', () => {
        it('--text-4xl should be 2rem or smaller (max 32px)', () => {
            const css = readAppCSS();
            const val = extractCSSVar(css, '--text-4xl');
            assert.ok(val, '--text-4xl should be defined');
            const px = toPixels(val);
            assert.ok(px <= 32, `--text-4xl should be <= 32px, got ${px}px (${val})`);
        });

        it('--text-3xl should be 1.75rem or smaller (max 28px)', () => {
            const css = readAppCSS();
            const val = extractCSSVar(css, '--text-3xl');
            assert.ok(val, '--text-3xl should be defined');
            const px = toPixels(val);
            assert.ok(px <= 28, `--text-3xl should be <= 28px, got ${px}px (${val})`);
        });

        it('--text-base should be 1rem or smaller', () => {
            const css = readAppCSS();
            const val = extractCSSVar(css, '--text-base');
            assert.ok(val, '--text-base should be defined');
            const px = toPixels(val);
            assert.ok(px <= 16, `--text-base should be <= 16px, got ${px}px (${val})`);
        });
    });

    describe('Layout sizing', () => {
        it('--nav-height should be 56px or smaller', () => {
            const css = readAppCSS();
            const val = extractCSSVar(css, '--nav-height');
            assert.ok(val, '--nav-height should be defined');
            const px = toPixels(val);
            assert.ok(px <= 56, `--nav-height should be <= 56px, got ${px}px`);
        });

        it('--container-max should be 1200px', () => {
            const css = readAppCSS();
            const val = extractCSSVar(css, '--container-max');
            assert.ok(val, '--container-max should be defined');
            assert.strictEqual(val, '1200px');
        });
    });

    describe('Spacing variables are compact', () => {
        it('--space-8 should be 2rem or smaller', () => {
            const css = readAppCSS();
            const val = extractCSSVar(css, '--space-8');
            assert.ok(val, '--space-8 should be defined');
            const px = toPixels(val);
            assert.ok(px <= 32, `--space-8 should be <= 32px, got ${px}px`);
        });

        it('--space-10 should be 2.5rem or smaller', () => {
            const css = readAppCSS();
            const val = extractCSSVar(css, '--space-10');
            assert.ok(val, '--space-10 should be defined');
            const px = toPixels(val);
            assert.ok(px <= 40, `--space-10 should be <= 40px, got ${px}px`);
        });
    });

    describe('Dashboard card sizing', () => {
        it('dashboard-card padding should be 20px or smaller', () => {
            const css = readAppCSS();
            // Match the .dashboard-card padding
            const match = css.match(/\.dashboard-card\s*\{[^}]*padding:\s*([^;]+)/);
            assert.ok(match, 'Should find .dashboard-card padding');
            const padding = match[1].trim();
            const parts = padding.split(/\s+/);
            for (const part of parts) {
                const px = toPixels(part);
                assert.ok(px <= 20, `dashboard-card padding ${part} should be <= 20px, got ${px}px`);
            }
        });

        it('dashboard-card border-radius should be 16px or smaller', () => {
            const css = readAppCSS();
            const match = css.match(/\.dashboard-card\s*\{[^}]*border-radius:\s*([^;]+)/);
            assert.ok(match, 'Should find .dashboard-card border-radius');
            const px = toPixels(match[1].trim());
            assert.ok(px <= 16, `dashboard-card border-radius should be <= 16px, got ${px}px`);
        });

        it('dashboard-card-icon should be 44px or smaller', () => {
            const css = readAppCSS();
            const match = css.match(/\.dashboard-card-icon\s*\{[^}]*width:\s*([^;]+)/);
            assert.ok(match, 'Should find .dashboard-card-icon width');
            const px = toPixels(match[1].trim());
            assert.ok(px <= 44, `dashboard-card-icon width should be <= 44px, got ${px}px`);
        });
    });

    describe('Hero card sizing', () => {
        it('hero-card padding should be 24px or smaller', () => {
            const css = readAppCSS();
            const match = css.match(/\.hero-card\s*\{[^}]*padding:\s*([^;]+)/);
            assert.ok(match, 'Should find .hero-card padding');
            const parts = match[1].trim().split(/\s+/);
            for (const part of parts) {
                const px = toPixels(part);
                assert.ok(px <= 24, `hero-card padding ${part} should be <= 24px, got ${px}px`);
            }
        });

        it('hero-card border-radius should be 20px or smaller', () => {
            const css = readAppCSS();
            const match = css.match(/\.hero-card\s*\{[^}]*border-radius:\s*([^;]+)/);
            assert.ok(match, 'Should find .hero-card border-radius');
            const px = toPixels(match[1].trim());
            assert.ok(px <= 20, `hero-card border-radius should be <= 20px, got ${px}px`);
        });
    });

    describe('Stat card sizing', () => {
        it('stat-card padding should be 18px or smaller', () => {
            const css = readAppCSS();
            const match = css.match(/\.stat-card\s*\{[^}]*padding:\s*([^;]+)/);
            assert.ok(match, 'Should find .stat-card padding');
            const px = toPixels(match[1].trim());
            assert.ok(px <= 18, `stat-card padding should be <= 18px, got ${px}px`);
        });

        it('stat-card border-radius should be 16px or smaller', () => {
            const css = readAppCSS();
            const match = css.match(/\.stat-card\s*\{[^}]*border-radius:\s*([^;]+)/);
            assert.ok(match, 'Should find .stat-card border-radius');
            const px = toPixels(match[1].trim());
            assert.ok(px <= 16, `stat-card border-radius should be <= 16px, got ${px}px`);
        });
    });

    describe('Nav link sizing', () => {
        it('nav-link font-size should be 14px or smaller', () => {
            const css = readAppCSS();
            const match = css.match(/\.nav-link\s*\{[^}]*font-size:\s*([^;]+)/);
            assert.ok(match, 'Should find .nav-link font-size');
            const px = toPixels(match[1].trim());
            assert.ok(px <= 14, `nav-link font-size should be <= 14px, got ${px}px`);
        });
    });

    describe('Compiled output contains compact sizes', () => {
        it('compiled CSS should contain the compact nav-height', () => {
            const css = readCompiledCSS();
            assert.ok(css.includes('--nav-height: 52px') || css.includes('--nav-height:52px'),
                'Compiled CSS should have compact --nav-height (52px)');
        });

        it('compiled CSS should not contain oversized heading sizes', () => {
            const css = readCompiledCSS();
            // In @theme or :root, --text-4xl should not be 3rem
            assert.ok(!css.includes('--text-4xl: 3rem') && !css.includes('--text-4xl:3rem'),
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
});
