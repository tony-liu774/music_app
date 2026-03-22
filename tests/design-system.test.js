/**
 * Design System Enforcement Tests — Midnight Conservatory Theme Guard
 *
 * These tests enforce that ALL CSS files use design tokens from
 * midnight-conservatory.css instead of hardcoded color values.
 * Any PR that breaks these tests MUST fix the hardcoded colors
 * before merging.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS_DIR = path.join(__dirname, '..', 'src', 'css');
const THEME_FILE = path.join(CSS_DIR, 'themes', 'midnight-conservatory.css');
const STYLES_FILE = path.join(CSS_DIR, 'styles.css');
const ROOT_DIR = path.join(__dirname, '..');

function readCSS(filepath) {
    return fs.readFileSync(filepath, 'utf8');
}

/**
 * Find hardcoded hex colors NOT inside var() fallbacks or comments.
 * Returns array of { line, lineNumber, color }.
 */
function findHardcodedHexColors(css, allowedColors = []) {
    const lines = css.split('\n');
    const issues = [];
    let inBlockComment = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Track block comments
        if (line.includes('/*')) inBlockComment = true;
        if (line.includes('*/')) { inBlockComment = false; continue; }
        if (inBlockComment) continue;
        if (line.startsWith('//')) continue;

        // Strip var() fallbacks
        const lineWithoutVarFallbacks = line.replace(/var\([^)]+\)/g, '');

        // Find hex colors
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
 * Find hardcoded rgba() values NOT inside var() fallbacks, comments,
 * or the :root block (where token definitions live).
 */
function findHardcodedRgba(css, opts = {}) {
    const lines = css.split('\n');
    const issues = [];
    let inBlockComment = false;
    let inRoot = false;
    let braceDepth = 0;
    const { allowGradients = true, allowKeyframes = true } = opts;
    let inKeyframe = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Track block comments
        if (trimmed.includes('/*')) inBlockComment = true;
        if (trimmed.includes('*/')) { inBlockComment = false; continue; }
        if (inBlockComment) continue;
        if (trimmed.startsWith('//')) continue;

        // Track :root block
        if (trimmed.startsWith(':root')) inRoot = true;
        if (inRoot) {
            braceDepth += (trimmed.match(/{/g) || []).length;
            braceDepth -= (trimmed.match(/}/g) || []).length;
            if (braceDepth <= 0) inRoot = false;
            continue;
        }

        // Track @keyframes blocks
        if (trimmed.startsWith('@keyframes')) inKeyframe = true;
        if (inKeyframe && trimmed === '}') { inKeyframe = false; continue; }
        if (inKeyframe && allowKeyframes) continue;

        // Skip gradient functions if allowed
        if (allowGradients && /gradient\(/.test(trimmed)) continue;

        // Strip var() patterns
        const withoutVar = trimmed.replace(/var\([^)]+\)/g, '');

        // Find rgba() that are NOT inside var()
        const rgbaMatches = withoutVar.match(/rgba?\([^)]+\)/g);
        if (rgbaMatches) {
            for (const rgba of rgbaMatches) {
                issues.push({ line: lines[i], lineNumber: i + 1, color: rgba });
            }
        }
    }

    return issues;
}

// ============ Theme Token Tests ============

describe('Design System — Token Definitions', () => {
    const css = readCSS(THEME_FILE);

    it('should define all required background tokens', () => {
        const requiredTokens = [
            '--bg-deep', '--bg-surface', '--bg-elevated', '--bg-hover',
            '--bg-navy', '--bg-card', '--bg-deep-nav', '--bg-deep-overlay',
            '--bg-navy-overlay', '--overlay-light', '--overlay-dark',
        ];
        for (const token of requiredTokens) {
            assert.ok(css.includes(`${token}:`), `Missing token: ${token}`);
        }
    });

    it('should define all required primary color tokens', () => {
        const requiredTokens = [
            '--primary:', '--primary-light:', '--primary-dark:',
            '--primary-glow:', '--primary-bg:', '--primary-bg-subtle:',
            '--primary-bg-light:', '--primary-bg-medium:', '--primary-bg-strong:',
            '--primary-border:', '--primary-border-hover:', '--primary-fill:',
        ];
        for (const token of requiredTokens) {
            assert.ok(css.includes(token), `Missing token: ${token}`);
        }
    });

    it('should define all required success color tokens', () => {
        const requiredTokens = [
            '--success:', '--success-light:', '--success-dark:',
            '--success-glow:', '--success-bg:', '--success-bg-medium:',
        ];
        for (const token of requiredTokens) {
            assert.ok(css.includes(token), `Missing token: ${token}`);
        }
    });

    it('should define all required error color tokens', () => {
        const requiredTokens = [
            '--error:', '--error-light:', '--error-glow:',
            '--error-bg:', '--error-bg-medium:',
        ];
        for (const token of requiredTokens) {
            assert.ok(css.includes(token), `Missing token: ${token}`);
        }
    });

    it('should define warning color tokens', () => {
        assert.ok(css.includes('--warning:'), 'Missing --warning token');
        assert.ok(css.includes('--warning-glow:'), 'Missing --warning-glow token');
    });

    it('should define score tier tokens', () => {
        assert.ok(css.includes('--score-good:'), 'Missing --score-good token');
        assert.ok(css.includes('--score-good-bg:'), 'Missing --score-good-bg token');
        assert.ok(css.includes('--score-needs-work:'), 'Missing --score-needs-work token');
        assert.ok(css.includes('--score-needs-work-bg:'), 'Missing --score-needs-work-bg token');
    });

    it('should define annotation blue tokens', () => {
        assert.ok(css.includes('--annotation-blue:'), 'Missing --annotation-blue token');
        assert.ok(css.includes('--annotation-blue-glow:'), 'Missing --annotation-blue-glow token');
    });

    it('should define all text color tokens', () => {
        assert.ok(css.includes('--text-primary:'), 'Missing --text-primary');
        assert.ok(css.includes('--text-secondary:'), 'Missing --text-secondary');
        assert.ok(css.includes('--text-muted:'), 'Missing --text-muted');
        assert.ok(css.includes('--text-overlay:'), 'Missing --text-overlay');
        assert.ok(css.includes('--text-overlay-bright:'), 'Missing --text-overlay-bright');
    });

    it('should define border tokens', () => {
        assert.ok(css.includes('--border:'), 'Missing --border');
        assert.ok(css.includes('--border-light:'), 'Missing --border-light');
        assert.ok(css.includes('--border-subtle:'), 'Missing --border-subtle');
        assert.ok(css.includes('--border-white-subtle:'), 'Missing --border-white-subtle');
    });

    it('should define typography tokens', () => {
        assert.ok(css.includes("'Playfair Display'"), 'Missing Playfair Display in --font-heading');
        assert.ok(css.includes("'Source Sans 3'"), 'Missing Source Sans 3 in --font-body');
        assert.ok(css.includes("'JetBrains Mono'"), 'Missing JetBrains Mono in --font-mono');
    });

    it('should define all font size tokens', () => {
        const sizes = ['--text-xs', '--text-sm', '--text-base', '--text-lg',
            '--text-xl', '--text-2xl', '--text-3xl', '--text-4xl'];
        for (const size of sizes) {
            assert.ok(css.includes(`${size}:`), `Missing font size token: ${size}`);
        }
    });

    it('should define all spacing tokens', () => {
        const spaces = ['--space-1', '--space-2', '--space-3', '--space-4',
            '--space-5', '--space-6', '--space-8', '--space-10', '--space-12', '--space-16'];
        for (const space of spaces) {
            assert.ok(css.includes(`${space}:`), `Missing spacing token: ${space}`);
        }
    });

    it('should define effect shadow tokens', () => {
        assert.ok(css.includes('--shadow-glow:'), 'Missing --shadow-glow');
        assert.ok(css.includes('--shadow-success:'), 'Missing --shadow-success');
        assert.ok(css.includes('--shadow-error:'), 'Missing --shadow-error');
    });

    it('should define transition tokens including breath and fade', () => {
        assert.ok(css.includes('--transition-breath:'), 'Missing --transition-breath');
        assert.ok(css.includes('--transition-fade:'), 'Missing --transition-fade');
        assert.ok(css.includes('--transition-fast:'), 'Missing --transition-fast');
        assert.ok(css.includes('--transition-normal:'), 'Missing --transition-normal');
    });

    it('should define border-radius-pill token', () => {
        assert.ok(css.includes('--border-radius-pill:'), 'Missing --border-radius-pill');
        assert.ok(css.includes('9999px'), '--border-radius-pill should be 9999px');
    });

    it('should use correct core color values', () => {
        assert.ok(css.includes('#0a0a12'), '--bg-deep should be Deep Oxford Blue #0a0a12');
        assert.ok(css.includes('#c9a227'), '--primary should be Polished Amber #c9a227');
        assert.ok(css.includes('#10b981'), '--success should be Emerald #10b981');
        assert.ok(css.includes('#dc2626'), '--error should be Crimson #dc2626');
        assert.ok(css.includes('#f97316'), '--warning should be Orange #f97316');
    });
});

// ============ No Hardcoded Colors Tests ============

describe('Design System — No Hardcoded Colors in styles.css', () => {
    it('should have zero hardcoded hex colors outside var() fallbacks', () => {
        const css = readCSS(STYLES_FILE);
        const issues = findHardcodedHexColors(css);
        assert.strictEqual(issues.length, 0,
            `styles.css has ${issues.length} hardcoded hex color(s):\n` +
            issues.map(i => `  Line ${i.lineNumber}: ${i.color} → ${i.line.trim()}`).join('\n')
        );
    });

    it('should have zero hardcoded rgba() colors outside var() fallbacks, gradients, and keyframes', () => {
        const css = readCSS(STYLES_FILE);
        const issues = findHardcodedRgba(css, { allowGradients: true, allowKeyframes: true });
        assert.strictEqual(issues.length, 0,
            `styles.css has ${issues.length} hardcoded rgba() color(s):\n` +
            issues.map(i => `  Line ${i.lineNumber}: ${i.color} → ${i.line.trim()}`).join('\n')
        );
    });
});

describe('Design System — No Hardcoded Colors in scale-engine.css', () => {
    it('should have zero hardcoded hex colors outside var() fallbacks', () => {
        const css = readCSS(path.join(CSS_DIR, 'scale-engine.css'));
        const issues = findHardcodedHexColors(css);
        assert.strictEqual(issues.length, 0,
            `scale-engine.css has hardcoded hex colors:\n` +
            issues.map(i => `  Line ${i.lineNumber}: ${i.color} → ${i.line.trim()}`).join('\n')
        );
    });
});

describe('Design System — No Hardcoded Colors in annotation-toolbar.css', () => {
    it('should have zero hardcoded hex colors outside var() fallbacks', () => {
        const css = readCSS(path.join(CSS_DIR, 'annotation-toolbar.css'));
        // Allow #c9a227 in CSS attribute selectors matching inline styles
        const issues = findHardcodedHexColors(css, ['#c9a227']);
        assert.strictEqual(issues.length, 0,
            `annotation-toolbar.css has hardcoded hex colors:\n` +
            issues.map(i => `  Line ${i.lineNumber}: ${i.color} → ${i.line.trim()}`).join('\n')
        );
    });

    it('should use var(--annotation-blue) instead of hardcoded #00d4ff', () => {
        const css = readCSS(path.join(CSS_DIR, 'annotation-toolbar.css'));
        assert.ok(css.includes('var(--annotation-blue)'),
            'Should reference var(--annotation-blue) for annotation colors');
        // Verify no direct #00d4ff usage (outside var fallbacks)
        const withoutVar = css.replace(/var\([^)]+\)/g, '');
        assert.ok(!withoutVar.includes('#00d4ff'),
            'Should not use #00d4ff outside var() fallbacks');
    });
});

describe('Design System — No Hardcoded Colors in sso-login.css', () => {
    it('should have zero hardcoded hex colors (except brand-specific Google/Apple)', () => {
        const css = readCSS(path.join(CSS_DIR, 'sso-login.css'));
        const brandColors = ['#ffffff', '#1f1f1f', '#000000'];
        const issues = findHardcodedHexColors(css, brandColors);
        assert.strictEqual(issues.length, 0,
            `sso-login.css has hardcoded colors (excluding brand):\n` +
            issues.map(i => `  Line ${i.lineNumber}: ${i.color} → ${i.line.trim()}`).join('\n')
        );
    });
});

describe('Design System — No Hardcoded Colors in role-selection.css', () => {
    it('should have zero hardcoded hex colors outside var() fallbacks', () => {
        const css = readCSS(path.join(CSS_DIR, 'role-selection.css'));
        const issues = findHardcodedHexColors(css);
        assert.strictEqual(issues.length, 0,
            `role-selection.css has hardcoded hex colors:\n` +
            issues.map(i => `  Line ${i.lineNumber}: ${i.color} → ${i.line.trim()}`).join('\n')
        );
    });

    it('should have zero hardcoded rgba() outside var() fallbacks', () => {
        const css = readCSS(path.join(CSS_DIR, 'role-selection.css'));
        const issues = findHardcodedRgba(css);
        assert.strictEqual(issues.length, 0,
            `role-selection.css has hardcoded rgba():\n` +
            issues.map(i => `  Line ${i.lineNumber}: ${i.color} → ${i.line.trim()}`).join('\n')
        );
    });
});

// ============ Utility Class Tests ============

describe('Design System — Utility Classes', () => {
    const css = readCSS(STYLES_FILE);

    it('should define glow utility classes', () => {
        assert.ok(css.includes('.glow-amber'), 'Missing .glow-amber utility class');
        assert.ok(css.includes('.glow-emerald'), 'Missing .glow-emerald utility class');
        assert.ok(css.includes('.glow-crimson'), 'Missing .glow-crimson utility class');
    });

    it('should define typography utility classes', () => {
        assert.ok(css.includes('.text-heading'), 'Missing .text-heading utility class');
        assert.ok(css.includes('.text-body'), 'Missing .text-body utility class');
    });

    it('should define background utility classes', () => {
        assert.ok(css.includes('.bg-deep'), 'Missing .bg-deep utility class');
        assert.ok(css.includes('.bg-surface'), 'Missing .bg-surface utility class');
        assert.ok(css.includes('.bg-elevated'), 'Missing .bg-elevated utility class');
        assert.ok(css.includes('.bg-navy'), 'Missing .bg-navy utility class');
    });

    it('should define text color utility classes', () => {
        assert.ok(css.includes('.text-ivory'), 'Missing .text-ivory utility class');
        assert.ok(css.includes('.text-amber'), 'Missing .text-amber utility class');
        assert.ok(css.includes('.text-emerald'), 'Missing .text-emerald utility class');
        assert.ok(css.includes('.text-crimson'), 'Missing .text-crimson utility class');
    });

    it('should define transition utility classes', () => {
        assert.ok(css.includes('.transition-breath'), 'Missing .transition-breath utility class');
        assert.ok(css.includes('.transition-fade'), 'Missing .transition-fade utility class');
    });

    it('glow classes should reference design tokens', () => {
        assert.ok(css.includes('var(--primary-glow)'), '.glow-amber should use var(--primary-glow)');
        assert.ok(css.includes('var(--success-glow)'), '.glow-emerald should use var(--success-glow)');
        assert.ok(css.includes('var(--error-glow)'), '.glow-crimson should use var(--error-glow)');
    });
});

// ============ STYLE_GUIDE.md Tests ============

describe('Design System — STYLE_GUIDE.md', () => {
    it('should exist at the repo root', () => {
        const styleguide = path.join(ROOT_DIR, 'STYLE_GUIDE.md');
        assert.ok(fs.existsSync(styleguide), 'STYLE_GUIDE.md must exist at the repo root');
    });

    it('should contain the no-hardcoded-colors rule', () => {
        const content = fs.readFileSync(path.join(ROOT_DIR, 'STYLE_GUIDE.md'), 'utf8');
        assert.ok(content.includes('No hardcoded hex codes'),
            'STYLE_GUIDE.md must state the no-hardcoded-colors rule');
    });

    it('should document the color palette', () => {
        const content = fs.readFileSync(path.join(ROOT_DIR, 'STYLE_GUIDE.md'), 'utf8');
        assert.ok(content.includes('--bg-deep'), 'Should document --bg-deep');
        assert.ok(content.includes('--primary'), 'Should document --primary');
        assert.ok(content.includes('--success'), 'Should document --success');
        assert.ok(content.includes('--error'), 'Should document --error');
        assert.ok(content.includes('#c9a227'), 'Should include hex value for primary');
    });

    it('should document typography rules', () => {
        const content = fs.readFileSync(path.join(ROOT_DIR, 'STYLE_GUIDE.md'), 'utf8');
        assert.ok(content.includes('Playfair Display'), 'Should document Playfair Display usage');
        assert.ok(content.includes('Source Sans 3'), 'Should document Source Sans 3 usage');
    });

    it('should document the emitted light philosophy', () => {
        const content = fs.readFileSync(path.join(ROOT_DIR, 'STYLE_GUIDE.md'), 'utf8');
        assert.ok(content.includes('Emitted Light'),
            'Should document the emitted light philosophy');
    });

    it('should document the breath effect', () => {
        const content = fs.readFileSync(path.join(ROOT_DIR, 'STYLE_GUIDE.md'), 'utf8');
        assert.ok(content.includes('Breath'),
            'Should document the breath effect for intonation needle');
    });

    it('should document Ghost UI rules', () => {
        const content = fs.readFileSync(path.join(ROOT_DIR, 'STYLE_GUIDE.md'), 'utf8');
        assert.ok(content.includes('Ghost UI'),
            'Should document Ghost UI fade rules');
    });

    it('should document post-session transition', () => {
        const content = fs.readFileSync(path.join(ROOT_DIR, 'STYLE_GUIDE.md'), 'utf8');
        assert.ok(content.includes('Post-Session'),
            'Should document the post-session transition spec');
    });
});

// ============ CSS Architecture Tests ============

describe('Design System — CSS Architecture', () => {
    it('midnight-conservatory.css should load before styles.css in index.html', () => {
        const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
        const mcIndex = html.indexOf('midnight-conservatory.css');
        const stylesIndex = html.indexOf('styles.css');
        assert.ok(mcIndex !== -1, 'index.html must reference midnight-conservatory.css');
        assert.ok(stylesIndex !== -1, 'index.html must reference styles.css');
        assert.ok(mcIndex < stylesIndex,
            'midnight-conservatory.css MUST load BEFORE styles.css');
    });

    it('styles.css should use extensive var() references (>200)', () => {
        const css = readCSS(STYLES_FILE);
        const varCount = (css.match(/var\(--[a-z-]+/g) || []).length;
        assert.ok(varCount > 200,
            `styles.css should have >200 var() references, got ${varCount}`);
    });

    it('token file should define at least 60 custom properties', () => {
        const css = readCSS(THEME_FILE);
        const tokenCount = (css.match(/--[a-z][a-z0-9-]*:/g) || []).length;
        assert.ok(tokenCount >= 60,
            `Token file should define >=60 custom properties, got ${tokenCount}`);
    });
});
