/**
 * Theme Consistency Tests — Tailwind CSS v4 Migration
 *
 * Verifies that the consolidated app.css defines the Midnight Conservatory theme
 * using Tailwind v4's @theme block and @layer architecture, and that the compiled
 * output (public/styles.css) contains the expected CSS custom properties.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS_DIR = path.join(__dirname, '..', 'src', 'css');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/**
 * Read app.css (the single Tailwind CSS v4 source file).
 */
function readAppCSS() {
    return fs.readFileSync(path.join(CSS_DIR, 'app.css'), 'utf8');
}

/**
 * Read the compiled output (public/styles.css).
 */
function readCompiledCSS() {
    return fs.readFileSync(path.join(PUBLIC_DIR, 'styles.css'), 'utf8');
}

/**
 * Count var() references in CSS.
 */
function countVarReferences(css) {
    const matches = css.match(/var\(--[a-z-]+/g) || [];
    return matches.length;
}

// ============ Tests ============

describe('Tailwind CSS v4 Migration — Midnight Conservatory', () => {

    describe('app.css structure', () => {
        it('should exist as the single CSS source file', () => {
            assert.ok(fs.existsSync(path.join(CSS_DIR, 'app.css')), 'app.css should exist');
        });

        it('should import tailwindcss', () => {
            const css = readAppCSS();
            assert.ok(css.includes('@import "tailwindcss"'), 'Should import Tailwind CSS v4');
        });

        it('should define @theme block with Midnight Conservatory colors', () => {
            const css = readAppCSS();
            assert.ok(css.includes('@theme {'), 'Should have @theme block');
            assert.ok(css.includes('--color-oxford-blue: #0a0a12'), 'Should define oxford-blue');
            assert.ok(css.includes('--color-amber: #c9a227'), 'Should define amber');
            assert.ok(css.includes('--color-emerald: #10b981'), 'Should define emerald');
            assert.ok(css.includes('--color-crimson: #dc2626'), 'Should define crimson');
            assert.ok(css.includes('--color-ivory: #f3f4f6'), 'Should define ivory');
            assert.ok(css.includes('--color-surface: #141420'), 'Should define surface');
            assert.ok(css.includes('--color-elevated: #1a1a28'), 'Should define elevated');
        });

        it('should define typography in @theme', () => {
            const css = readAppCSS();
            assert.ok(css.includes("--font-heading: 'Playfair Display'"), 'Should define heading font');
            assert.ok(css.includes("--font-body: 'Source Sans 3'"), 'Should define body font');
            assert.ok(css.includes("--font-mono: 'JetBrains Mono'"), 'Should define mono font');
        });

        it('should define glow shadow effects in @theme', () => {
            const css = readAppCSS();
            assert.ok(css.includes('--shadow-amber-glow:'), 'Should define amber glow shadow');
            assert.ok(css.includes('--shadow-emerald-glow:'), 'Should define emerald glow shadow');
            assert.ok(css.includes('--shadow-crimson-glow:'), 'Should define crimson glow shadow');
        });

        it('should include @layer base with backward-compatible CSS variables', () => {
            const css = readAppCSS();
            assert.ok(css.includes('@layer base'), 'Should have @layer base');
            assert.ok(css.includes('--bg-deep: #0a0a12'), 'Should define --bg-deep');
            assert.ok(css.includes('--bg-surface: #141420'), 'Should define --bg-surface');
            assert.ok(css.includes('--bg-elevated: #1a1a28'), 'Should define --bg-elevated');
            assert.ok(css.includes('--primary: #c9a227'), 'Should define --primary');
            assert.ok(css.includes('--success: #10b981'), 'Should define --success');
            assert.ok(css.includes('--error: #dc2626'), 'Should define --error');
            assert.ok(css.includes('--text-primary: #f3f4f6'), 'Should define --text-primary');
            assert.ok(css.includes('--text-secondary: #a0a0b0'), 'Should define --text-secondary');
            assert.ok(css.includes('--text-muted: #6a6a7a'), 'Should define --text-muted');
            assert.ok(css.includes('--border: #2a2a3a'), 'Should define --border');
            assert.ok(css.includes('--accent: #c9a227'), 'Should define --accent');
            assert.ok(css.includes('--accent-glow:'), 'Should define --accent-glow');
            assert.ok(css.includes('--bg-card:'), 'Should define --bg-card');
            assert.ok(css.includes('--border-subtle:'), 'Should define --border-subtle');
            assert.ok(css.includes('--font-mono:'), 'Should define --font-mono');
            assert.ok(css.includes('--shadow-glow:'), 'Should define --shadow-glow');
            assert.ok(css.includes('--container-max: 1200px'), 'Should define --container-max');
        });

        it('should include @layer components', () => {
            const css = readAppCSS();
            assert.ok(css.includes('@layer components'), 'Should have @layer components');
        });

        it('should include grid background pattern via repeating-linear-gradient', () => {
            const css = readAppCSS();
            assert.ok(
                css.includes('repeating-linear-gradient'),
                'Should include repeating-linear-gradient for grid background pattern'
            );
        });

        it('should include Polished Amber glow effects', () => {
            const css = readAppCSS();
            assert.ok(
                css.includes('--primary-glow: rgba(201, 162, 39,'),
                'Should define --primary-glow with amber rgba value'
            );
            assert.ok(
                css.includes('var(--primary-glow)'),
                'Should reference --primary-glow for amber glow effects'
            );
        });
    });

    describe('app.css component styles', () => {
        it('should include nav-link styles', () => {
            const css = readAppCSS();
            assert.ok(css.includes('.nav-link'), 'Should include nav-link styles');
        });

        it('should include mobile navigation styles', () => {
            const css = readAppCSS();
            assert.ok(css.includes('.mobile-nav'), 'Should include mobile navigation');
        });

        it('should include gradient styles', () => {
            const css = readAppCSS();
            assert.ok(css.includes('gradient'), 'Should include gradient styles');
        });

        it('should include tone quality indicator styles', () => {
            const css = readAppCSS();
            assert.ok(css.includes('.tone-quality-indicator'), 'Should include tone quality indicator');
            assert.ok(css.includes('.tone-quality-bar'), 'Should include tone quality bar');
        });

        it('should include heat map history styles', () => {
            const css = readAppCSS();
            assert.ok(css.includes('.heatmap-controls'), 'Should include heatmap controls');
            assert.ok(css.includes('.week-card'), 'Should include week card styles');
        });

        it('should include studio license UI styles', () => {
            const css = readAppCSS();
            assert.ok(css.includes('.license-content'), 'Should include license content');
            assert.ok(css.includes('.plan-card'), 'Should include plan card styles');
        });

        it('should include video snippet styles', () => {
            const css = readAppCSS();
            assert.ok(css.includes('.video-snippet-btn'), 'Should include video snippet button');
            assert.ok(css.includes('.video-trim-controls'), 'Should include video trim controls');
        });

        it('should include video recorder modal styles', () => {
            const css = readAppCSS();
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
            const css = readAppCSS();
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
            const css = readAppCSS();
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

        it('should include scale engine styles', () => {
            const css = readAppCSS();
            assert.ok(css.includes('.scale-engine-panel'), 'Should include scale-engine-panel');
            assert.ok(css.includes('.scale-btn-primary'), 'Should include scale-btn-primary');
        });

        it('should include annotation toolbar styles', () => {
            const css = readAppCSS();
            assert.ok(css.includes('#annotation-toolbar'), 'Should include annotation-toolbar');
            assert.ok(css.includes('.annotation-tool-btn'), 'Should include annotation-tool-btn');
        });

        it('should include SSO login styles', () => {
            const css = readAppCSS();
            assert.ok(css.includes('.sso-login-screen'), 'Should include sso-login-screen');
            assert.ok(css.includes('.sso-btn'), 'Should include sso-btn');
        });

        it('should include role selection styles', () => {
            const css = readAppCSS();
            assert.ok(css.includes('.role-selection-screen'), 'Should include role-selection-screen');
            assert.ok(css.includes('.role-card'), 'Should include role-card');
        });

        it('should use theme variables extensively', () => {
            const css = readAppCSS();
            const varCount = countVarReferences(css);
            assert.ok(varCount > 200, `app.css should have >200 var() references, got ${varCount}`);
        });
    });

    describe('Compiled output (public/styles.css)', () => {
        it('should exist', () => {
            assert.ok(
                fs.existsSync(path.join(PUBLIC_DIR, 'styles.css')),
                'public/styles.css should exist (run npm run build:css)'
            );
        });

        it('should contain Tailwind CSS v4 header', () => {
            const css = readCompiledCSS();
            assert.ok(css.includes('tailwindcss v4'), 'Should contain Tailwind v4 version comment');
        });

        it('should contain Midnight Conservatory color values', () => {
            const css = readCompiledCSS();
            assert.ok(css.includes('#0a0a12'), 'Should contain Oxford Blue #0a0a12');
            assert.ok(css.includes('#c9a227'), 'Should contain Polished Amber #c9a227');
            assert.ok(css.includes('#10b981'), 'Should contain Emerald #10b981');
            assert.ok(css.includes('#dc2626'), 'Should contain Crimson #dc2626');
            assert.ok(css.includes('#f3f4f6'), 'Should contain Soft Ivory #f3f4f6');
        });

        it('should contain backward-compatible CSS variables', () => {
            const css = readCompiledCSS();
            assert.ok(css.includes('--bg-deep:'), 'Should contain --bg-deep variable');
            assert.ok(css.includes('--primary:'), 'Should contain --primary variable');
            assert.ok(css.includes('--text-primary:'), 'Should contain --text-primary variable');
        });

        it('should contain Playfair Display font reference', () => {
            const css = readCompiledCSS();
            assert.ok(css.includes('Playfair Display'), 'Should reference Playfair Display font');
        });

        it('should contain Source Sans 3 font reference', () => {
            const css = readCompiledCSS();
            assert.ok(css.includes('Source Sans 3'), 'Should reference Source Sans 3 font');
        });

        it('should contain glow effects', () => {
            const css = readCompiledCSS();
            assert.ok(css.includes('glow'), 'Should contain glow effect styles');
            assert.ok(css.includes('box-shadow'), 'Should contain box-shadow for glow');
        });
    });

    describe('Old CSS files should NOT exist', () => {
        it('should NOT have standalone styles.css', () => {
            assert.ok(
                !fs.existsSync(path.join(CSS_DIR, 'styles.css')),
                'styles.css should be deleted (migrated to app.css)'
            );
        });

        it('should NOT have standalone scale-engine.css', () => {
            assert.ok(
                !fs.existsSync(path.join(CSS_DIR, 'scale-engine.css')),
                'scale-engine.css should be deleted (migrated to app.css)'
            );
        });

        it('should NOT have standalone annotation-toolbar.css', () => {
            assert.ok(
                !fs.existsSync(path.join(CSS_DIR, 'annotation-toolbar.css')),
                'annotation-toolbar.css should be deleted (migrated to app.css)'
            );
        });

        it('should NOT have standalone sso-login.css', () => {
            assert.ok(
                !fs.existsSync(path.join(CSS_DIR, 'sso-login.css')),
                'sso-login.css should be deleted (migrated to app.css)'
            );
        });

        it('should NOT have standalone role-selection.css', () => {
            assert.ok(
                !fs.existsSync(path.join(CSS_DIR, 'role-selection.css')),
                'role-selection.css should be deleted (migrated to app.css)'
            );
        });

        it('should NOT have standalone midnight-conservatory.css', () => {
            assert.ok(
                !fs.existsSync(path.join(CSS_DIR, 'themes', 'midnight-conservatory.css')),
                'midnight-conservatory.css should be deleted (absorbed into @theme block)'
            );
        });
    });

    describe('index.html Tailwind integration', () => {
        it('should reference compiled public/styles.css', () => {
            const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
            assert.ok(
                html.includes('public/styles.css'),
                'Should link to public/styles.css (compiled Tailwind output)'
            );
        });

        it('should NOT reference old individual CSS files', () => {
            const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
            assert.ok(
                !html.includes('src/css/styles.css'),
                'Should NOT reference old src/css/styles.css'
            );
            assert.ok(
                !html.includes('src/css/scale-engine.css'),
                'Should NOT reference old src/css/scale-engine.css'
            );
            assert.ok(
                !html.includes('midnight-conservatory.css'),
                'Should NOT reference old midnight-conservatory.css'
            );
        });

        it('should include Google Fonts for Playfair Display, Source Sans 3, JetBrains Mono', () => {
            const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
            assert.ok(html.includes('Playfair+Display'), 'Should load Playfair Display');
            assert.ok(html.includes('Source+Sans+3'), 'Should load Source Sans 3');
            assert.ok(html.includes('JetBrains+Mono'), 'Should load JetBrains Mono');
        });

        it('should use deep Oxford Blue theme color', () => {
            const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
            assert.ok(html.includes('content="#0a0a12"'), 'theme-color meta should be #0a0a12');
        });

        it('should set viewport with maximum-scale=1 to prevent zoom', () => {
            const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
            assert.ok(
                html.includes('maximum-scale=1'),
                'Viewport meta should include maximum-scale=1'
            );
            assert.ok(
                /initial-scale=1[,"\s]/.test(html),
                'Viewport initial-scale should be exactly 1'
            );
        });

        it('should include font preconnect hints for Google Fonts', () => {
            const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
            assert.ok(
                html.includes('preconnect" href="https://fonts.googleapis.com"'),
                'Should preconnect to fonts.googleapis.com'
            );
            assert.ok(
                html.includes('preconnect" href="https://fonts.gstatic.com"'),
                'Should preconnect to fonts.gstatic.com'
            );
        });
    });

    describe('Service worker asset references', () => {
        it('should reference public/styles.css in sw.js', () => {
            const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
            assert.ok(
                sw.includes('/public/styles.css'),
                'sw.js should cache /public/styles.css'
            );
        });

        it('should NOT reference deleted CSS files in sw.js', () => {
            const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
            assert.ok(
                !sw.includes('/src/css/themes/midnight-conservatory.css'),
                'sw.js should NOT reference deleted midnight-conservatory.css'
            );
            assert.ok(
                !sw.includes('/src/css/styles.css'),
                'sw.js should NOT reference deleted styles.css'
            );
        });

        it('should have bumped cache version', () => {
            const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
            assert.ok(
                !sw.includes('concertmaster-v2'),
                'sw.js should not still use concertmaster-v2 cache version'
            );
        });
    });

    describe('Build tool dependencies', () => {
        it('should have tailwindcss in devDependencies, not dependencies', () => {
            const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
            assert.ok(!pkg.dependencies['tailwindcss'], 'tailwindcss should NOT be in dependencies');
            assert.ok(!pkg.dependencies['@tailwindcss/cli'], '@tailwindcss/cli should NOT be in dependencies');
            assert.ok(pkg.devDependencies['tailwindcss'], 'tailwindcss should be in devDependencies');
            assert.ok(pkg.devDependencies['@tailwindcss/cli'], '@tailwindcss/cli should be in devDependencies');
        });
    });

    describe('@theme block overrides Tailwind defaults', () => {
        it('should override --text-3xl and --text-4xl in @theme', () => {
            const css = readAppCSS();
            // Extract the @theme block
            const themeMatch = css.match(/@theme\s*\{[\s\S]*?\n\}/);
            assert.ok(themeMatch, 'Should have @theme block');
            const themeBlock = themeMatch[0];
            assert.ok(themeBlock.includes('--text-3xl: 2rem'), '--text-3xl should be overridden in @theme');
            assert.ok(themeBlock.includes('--text-4xl: 3rem'), '--text-4xl should be overridden in @theme');
        });

        it('should override border radius tokens in @theme', () => {
            const css = readAppCSS();
            const themeMatch = css.match(/@theme\s*\{[\s\S]*?\n\}/);
            const themeBlock = themeMatch[0];
            assert.ok(themeBlock.includes('--radius-sm: 4px'), '--radius-sm should be in @theme');
            assert.ok(themeBlock.includes('--radius-md: 8px'), '--radius-md should be in @theme');
            assert.ok(themeBlock.includes('--radius-lg: 12px'), '--radius-lg should be in @theme');
            assert.ok(themeBlock.includes('--radius-xl: 16px'), '--radius-xl should be in @theme');
            assert.ok(themeBlock.includes('--radius-full: 9999px'), '--radius-full should be in @theme');
        });

        it('should override --shadow-lg in @theme', () => {
            const css = readAppCSS();
            const themeMatch = css.match(/@theme\s*\{[\s\S]*?\n\}/);
            const themeBlock = themeMatch[0];
            assert.ok(themeBlock.includes('--shadow-lg:'), '--shadow-lg should be in @theme');
        });
    });

    describe('No duplicate typography between layers', () => {
        it('should NOT have h1-h6 styles in @layer components', () => {
            const css = readAppCSS();
            // Find the components layer
            const compMatch = css.match(/@layer components\s*\{([\s\S]*)\}/);
            assert.ok(compMatch, 'Should have @layer components');
            const compBlock = compMatch[1];
            // Check no duplicate heading rules in components layer
            // The base layer defines headings; components should not re-declare them
            const headingPattern = /^\s*h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{/m;
            assert.ok(
                !headingPattern.test(compBlock),
                'h1-h6 typography should only be in @layer base, not duplicated in @layer components'
            );
        });
    });

    describe('Midnight Conservatory visual requirements', () => {
        it('should define Soft Ivory text color (#f3f4f6), not pure white', () => {
            const css = readAppCSS();
            assert.ok(css.includes('--text-primary: #f3f4f6'), 'Text primary should be Soft Ivory #f3f4f6');
            assert.ok(!css.includes('--text-primary: #ffffff'), 'Text primary should NOT be pure white');
        });

        it('should define constrained container max-width', () => {
            const css = readAppCSS();
            assert.ok(
                css.includes('--container-max: 1200px'),
                'Should define --container-max: 1200px for constrained layout'
            );
        });

        it('should define Polished Amber as theme color (#c9a227)', () => {
            const css = readAppCSS();
            assert.ok(css.includes('--color-amber: #c9a227'), 'Should define amber theme token');
            assert.ok(css.includes('--primary: #c9a227'), 'Should define --primary variable');
        });

        it('should define deep Oxford Blue background (#0a0a12)', () => {
            const css = readAppCSS();
            assert.ok(css.includes('--color-oxford-blue: #0a0a12'), 'Should define oxford-blue theme token');
            assert.ok(css.includes('--bg-deep: #0a0a12'), 'Should define --bg-deep variable');
        });
    });
});
