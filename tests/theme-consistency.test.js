/**
 * Theme Consistency Tests
 *
 * Verifies that CSS files use Midnight Conservatory theme variables (var(--xxx))
 * instead of hardcoded color values, ensuring a consistent visual design.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS_DIR = path.join(__dirname, '..', 'src', 'css');

/**
 * Read a CSS file and return its content.
 */
function readCSS(filename) {
    return fs.readFileSync(path.join(CSS_DIR, filename), 'utf8');
}

/**
 * Find lines with hardcoded hex colors that are NOT inside var() fallbacks
 * or inside comments. Returns array of { line, lineNumber, color }.
 *
 * Allowed exceptions:
 * - Colors inside var(--xxx, #fallback) patterns
 * - Colors inside comments
 * - Brand-specific colors (Google white #ffffff, Apple black #000000)
 * - rgba(...) with literal numbers (common pattern)
 */
function findHardcodedColors(css, allowedColors = []) {
    const lines = css.split('\n');
    const issues = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip comments
        if (line.startsWith('/*') || line.startsWith('*') || line.startsWith('//')) continue;

        // Skip lines that are inside var() fallbacks - pattern: var(--xxx, #color)
        // We strip these out before checking
        const lineWithoutVarFallbacks = line.replace(/var\([^)]+\)/g, '');

        // Find hex colors in the remaining text
        const hexMatches = lineWithoutVarFallbacks.match(/#[0-9a-fA-F]{3,8}\b/g);
        if (hexMatches) {
            for (const color of hexMatches) {
                const normalized = color.toLowerCase();
                if (allowedColors.includes(normalized)) continue;
                issues.push({ line: lines[i], lineNumber: i + 1, color });
            }
        }
    }

    return issues;
}

/**
 * Verify that a CSS file defines essential Midnight Conservatory theme properties
 * by using var() references.
 */
function countVarReferences(css) {
    const matches = css.match(/var\(--[a-z-]+/g) || [];
    return matches.length;
}

// ============ Tests ============

describe('Theme Consistency - Midnight Conservatory', () => {

    describe('midnight-conservatory.css theme file', () => {
        it('should exist and define core theme variables', () => {
            const css = readCSS('themes/midnight-conservatory.css');
            assert.ok(css.includes('--bg-deep:'), 'Missing --bg-deep variable');
            assert.ok(css.includes('--bg-surface:'), 'Missing --bg-surface variable');
            assert.ok(css.includes('--bg-elevated:'), 'Missing --bg-elevated variable');
            assert.ok(css.includes('--primary:'), 'Missing --primary variable');
            assert.ok(css.includes('--success:'), 'Missing --success variable');
            assert.ok(css.includes('--error:'), 'Missing --error variable');
            assert.ok(css.includes('--text-primary:'), 'Missing --text-primary variable');
            assert.ok(css.includes('--text-secondary:'), 'Missing --text-secondary variable');
            assert.ok(css.includes('--text-muted:'), 'Missing --text-muted variable');
            assert.ok(css.includes('--border:'), 'Missing --border variable');
            assert.ok(css.includes('--font-heading:'), 'Missing --font-heading variable');
            assert.ok(css.includes('--font-body:'), 'Missing --font-body variable');
            assert.ok(css.includes('--accent:'), 'Missing --accent variable');
            assert.ok(css.includes('--accent-glow:'), 'Missing --accent-glow variable');
            assert.ok(css.includes('--bg-card:'), 'Missing --bg-card variable');
            assert.ok(css.includes('--border-subtle:'), 'Missing --border-subtle variable');
            assert.ok(css.includes('--font-mono:'), 'Missing --font-mono variable');
        });

        it('should define Polished Amber as primary color (#c9a227)', () => {
            const css = readCSS('themes/midnight-conservatory.css');
            assert.ok(css.includes('#c9a227'), 'Primary color should be Polished Amber #c9a227');
        });

        it('should define deep Oxford Blue background (#0a0a12)', () => {
            const css = readCSS('themes/midnight-conservatory.css');
            assert.ok(css.includes('#0a0a12'), 'Deep background should be #0a0a12');
        });

        it('should define Emerald for success (#10b981)', () => {
            const css = readCSS('themes/midnight-conservatory.css');
            assert.ok(css.includes('#10b981'), 'Success color should be Emerald #10b981');
        });

        it('should define Crimson for errors (#dc2626)', () => {
            const css = readCSS('themes/midnight-conservatory.css');
            assert.ok(css.includes('#dc2626'), 'Error color should be Crimson #dc2626');
        });

        it('should define Playfair Display as heading font', () => {
            const css = readCSS('themes/midnight-conservatory.css');
            assert.ok(css.includes("'Playfair Display'"), 'Heading font should include Playfair Display');
        });

        it('should define Source Sans 3 as body font', () => {
            const css = readCSS('themes/midnight-conservatory.css');
            assert.ok(css.includes("'Source Sans 3'"), 'Body font should include Source Sans 3');
        });
    });

    describe('styles.css main stylesheet', () => {
        it('should exist and be substantial (>3000 lines)', () => {
            const css = readCSS('styles.css');
            const lineCount = css.split('\n').length;
            assert.ok(lineCount > 3000, `styles.css should have >3000 lines, got ${lineCount}`);
        });

        it('should use theme variables extensively', () => {
            const css = readCSS('styles.css');
            const varCount = countVarReferences(css);
            assert.ok(varCount > 200, `styles.css should have >200 var() references, got ${varCount}`);
        });

        it('should include Midnight Conservatory glow effects', () => {
            const css = readCSS('styles.css');
            assert.ok(css.includes('glow'), 'Should include glow effect styles');
            assert.ok(css.includes('box-shadow'), 'Should include box-shadow for glow');
        });

        it('should include animated underlines for nav', () => {
            const css = readCSS('styles.css');
            assert.ok(css.includes('.nav-link'), 'Should include nav-link styles');
        });

        it('should include mobile navigation styles', () => {
            const css = readCSS('styles.css');
            assert.ok(css.includes('.mobile-nav'), 'Should include mobile navigation');
        });

        it('should include gradient button styles', () => {
            const css = readCSS('styles.css');
            assert.ok(css.includes('gradient'), 'Should include gradient styles for buttons');
        });

        it('should include tone quality indicator styles', () => {
            const css = readCSS('styles.css');
            assert.ok(css.includes('.tone-quality-indicator'), 'Should include tone quality indicator');
            assert.ok(css.includes('.tone-quality-bar'), 'Should include tone quality bar');
        });

        it('should include heat map history styles', () => {
            const css = readCSS('styles.css');
            assert.ok(css.includes('.heatmap-controls'), 'Should include heatmap controls');
            assert.ok(css.includes('.week-card'), 'Should include week card styles');
        });

        it('should include studio license UI styles', () => {
            const css = readCSS('styles.css');
            assert.ok(css.includes('.license-content'), 'Should include license content');
            assert.ok(css.includes('.plan-card'), 'Should include plan card styles');
        });

        it('should include video snippet styles', () => {
            const css = readCSS('styles.css');
            assert.ok(css.includes('.video-snippet-btn'), 'Should include video snippet button');
            assert.ok(css.includes('.video-trim-controls'), 'Should include video trim controls');
        });

        it('should include video recorder modal styles', () => {
            const css = readCSS('styles.css');
            assert.ok(css.includes('.video-recorder'), 'Should include video-recorder');
            assert.ok(css.includes('.video-preview-container'), 'Should include video-preview-container');
            assert.ok(css.includes('.video-overlay'), 'Should include video-overlay');
            assert.ok(css.includes('.record-button'), 'Should include record-button');
            assert.ok(css.includes('.recording-indicator'), 'Should include recording-indicator');
            assert.ok(css.includes('.recording-dot'), 'Should include recording-dot');
            assert.ok(css.includes('.video-form'), 'Should include video-form');
            assert.ok(css.includes('.video-actions'), 'Should include video-actions');
        });

        it('should include teacher inbox modal styles', () => {
            const css = readCSS('styles.css');
            assert.ok(css.includes('.teacher-inbox'), 'Should include teacher-inbox');
            assert.ok(css.includes('.inbox-tabs'), 'Should include inbox-tabs');
            assert.ok(css.includes('.inbox-tab'), 'Should include inbox-tab');
            assert.ok(css.includes('.inbox-content'), 'Should include inbox-content');
            assert.ok(css.includes('.inbox-list'), 'Should include inbox-list');
            assert.ok(css.includes('.inbox-item'), 'Should include inbox-item');
            assert.ok(css.includes('.inbox-item-thumb'), 'Should include inbox-item-thumb');
            assert.ok(css.includes('.inbox-item-title'), 'Should include inbox-item-title');
            assert.ok(css.includes('.inbox-item-status'), 'Should include inbox-item-status');
        });

        it('should include video reply modal styles', () => {
            const css = readCSS('styles.css');
            assert.ok(css.includes('.video-reply-form'), 'Should include video-reply-form');
            assert.ok(css.includes('.reply-video-container'), 'Should include reply-video-container');
            assert.ok(css.includes('.reply-form'), 'Should include reply-form');
            assert.ok(css.includes('.reply-type-selector'), 'Should include reply-type-selector');
            assert.ok(css.includes('.reply-type-btn'), 'Should include reply-type-btn');
            assert.ok(css.includes('.voice-recorder'), 'Should include voice-recorder');
            assert.ok(css.includes('.voice-record-btn'), 'Should include voice-record-btn');
            assert.ok(css.includes('.voice-status'), 'Should include voice-status');
            assert.ok(css.includes('.reply-actions'), 'Should include reply-actions');
        });
    });

    describe('scale-engine.css', () => {
        it('should use theme variables for all colors', () => {
            const css = readCSS('scale-engine.css');
            const issues = findHardcodedColors(css);
            assert.strictEqual(issues.length, 0,
                `scale-engine.css has hardcoded colors:\n${issues.map(i => `  Line ${i.lineNumber}: ${i.color} in "${i.line.trim()}"`).join('\n')}`
            );
        });

        it('should reference theme variables', () => {
            const css = readCSS('scale-engine.css');
            const varCount = countVarReferences(css);
            assert.ok(varCount > 30, `scale-engine.css should have >30 var() references, got ${varCount}`);
        });
    });

    describe('annotation-toolbar.css', () => {
        it('should use theme variables for layout colors', () => {
            const css = readCSS('annotation-toolbar.css');
            // #c9a227 appears in a CSS attribute selector [style*="color: #c9a227"],
            // not as a hardcoded color value — it matches inline styles set by JS
            const issues = findHardcodedColors(css, ['#c9a227']);
            assert.strictEqual(issues.length, 0,
                `annotation-toolbar.css has hardcoded colors:\n${issues.map(i => `  Line ${i.lineNumber}: ${i.color} in "${i.line.trim()}"`).join('\n')}`
            );
        });

        it('should reference theme variables for borders and backgrounds', () => {
            const css = readCSS('annotation-toolbar.css');
            assert.ok(css.includes('var(--bg-surface'), 'Should use --bg-surface');
            assert.ok(css.includes('var(--border'), 'Should use --border');
            assert.ok(css.includes('var(--bg-deep'), 'Should use --bg-deep');
        });
    });

    describe('sso-login.css', () => {
        it('should use theme variables instead of hardcoded colors', () => {
            const css = readCSS('sso-login.css');
            // Allow brand-specific Google/Apple button colors
            const allowedBrandColors = ['#ffffff', '#1f1f1f', '#000000'];
            const issues = findHardcodedColors(css, allowedBrandColors);
            assert.strictEqual(issues.length, 0,
                `sso-login.css has hardcoded colors:\n${issues.map(i => `  Line ${i.lineNumber}: ${i.color} in "${i.line.trim()}"`).join('\n')}`
            );
        });

        it('should NOT use hardcoded #002147 (old Oxford Blue)', () => {
            const css = readCSS('sso-login.css');
            assert.ok(!css.includes('#002147'), 'Should not use hardcoded #002147, use var(--bg-deep) instead');
        });

        it('should reference --bg-deep for background', () => {
            const css = readCSS('sso-login.css');
            assert.ok(css.includes('var(--bg-deep'), 'Should use var(--bg-deep) for background');
        });

        it('should reference --primary for amber accents', () => {
            const css = readCSS('sso-login.css');
            assert.ok(css.includes('var(--primary'), 'Should use var(--primary) for amber accents');
        });

        it('should reference --text-primary for headings', () => {
            const css = readCSS('sso-login.css');
            assert.ok(css.includes('var(--text-primary'), 'Should use var(--text-primary) for heading text');
        });

        it('should reference --font-heading for title', () => {
            const css = readCSS('sso-login.css');
            assert.ok(css.includes('var(--font-heading'), 'Should use var(--font-heading) for title font');
        });

        it('should reference --error for error messages', () => {
            const css = readCSS('sso-login.css');
            assert.ok(css.includes('var(--error'), 'Should use var(--error) for error message color');
        });
    });

    describe('role-selection.css', () => {
        it('should use theme variables instead of hardcoded colors', () => {
            const css = readCSS('role-selection.css');
            const issues = findHardcodedColors(css);
            assert.strictEqual(issues.length, 0,
                `role-selection.css has hardcoded colors:\n${issues.map(i => `  Line ${i.lineNumber}: ${i.color} in "${i.line.trim()}"`).join('\n')}`
            );
        });

        it('should NOT use hardcoded #002147 (old Oxford Blue)', () => {
            const css = readCSS('role-selection.css');
            assert.ok(!css.includes('#002147'), 'Should not use hardcoded #002147, use var(--bg-deep) instead');
        });

        it('should reference --bg-deep for background', () => {
            const css = readCSS('role-selection.css');
            assert.ok(css.includes('var(--bg-deep'), 'Should use var(--bg-deep) for background');
        });

        it('should reference --primary for amber accents', () => {
            const css = readCSS('role-selection.css');
            assert.ok(css.includes('var(--primary'), 'Should use var(--primary) for amber accents');
        });

        it('should reference --text-primary for headings', () => {
            const css = readCSS('role-selection.css');
            assert.ok(css.includes('var(--text-primary'), 'Should use var(--text-primary) for heading text');
        });

        it('should reference --font-heading for title', () => {
            const css = readCSS('role-selection.css');
            assert.ok(css.includes('var(--font-heading'), 'Should use var(--font-heading) for title font');
        });

        it('should reference --text-muted for skip button', () => {
            const css = readCSS('role-selection.css');
            assert.ok(css.includes('var(--text-muted'), 'Should use var(--text-muted) for muted text');
        });
    });

    describe('index.html theme integration', () => {
        it('should load midnight-conservatory.css before styles.css', () => {
            const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
            const mcIndex = html.indexOf('midnight-conservatory.css');
            const stylesIndex = html.indexOf('styles.css');
            assert.ok(mcIndex !== -1, 'Should reference midnight-conservatory.css');
            assert.ok(stylesIndex !== -1, 'Should reference styles.css');
            assert.ok(mcIndex < stylesIndex, 'midnight-conservatory.css should load before styles.css');
        });

        it('should include Google Fonts for Playfair Display and Source Sans 3', () => {
            const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
            assert.ok(html.includes('Playfair+Display'), 'Should load Playfair Display from Google Fonts');
            assert.ok(html.includes('Source+Sans+3'), 'Should load Source Sans 3 from Google Fonts');
            assert.ok(html.includes('JetBrains+Mono'), 'Should load JetBrains Mono from Google Fonts');
        });

        it('should use deep Oxford Blue theme color', () => {
            const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
            assert.ok(html.includes('content="#0a0a12"'), 'theme-color meta should be #0a0a12');
        });

        it('should include all 6 CSS files', () => {
            const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
            assert.ok(html.includes('midnight-conservatory.css'), 'Should include midnight-conservatory.css');
            assert.ok(html.includes('styles.css'), 'Should include styles.css');
            assert.ok(html.includes('scale-engine.css'), 'Should include scale-engine.css');
            assert.ok(html.includes('annotation-toolbar.css'), 'Should include annotation-toolbar.css');
            assert.ok(html.includes('sso-login.css'), 'Should include sso-login.css');
            assert.ok(html.includes('role-selection.css'), 'Should include role-selection.css');
        });
    });
});
