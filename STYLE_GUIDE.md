# Midnight Conservatory — Style Guide

> **RULE: No hardcoded hex codes in any CSS file. Use `var(--xxx)` ONLY.**
>
> Every component in the app MUST reference the design tokens defined in
> `src/css/themes/midnight-conservatory.css`. No exceptions.

This document is mandatory reading for any developer (human or AI) before
touching CSS in this project. All tokens are CSS custom properties defined
in `:root` inside `midnight-conservatory.css`.

---

## Color Palette

### Backgrounds

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-deep` | `#0a0a12` | Global background (Deep Oxford Blue) |
| `--bg-surface` | `#141420` | Cards, panels, modals |
| `--bg-elevated` | `#1a1a28` | Hover states, dropdowns |
| `--bg-hover` | `#222233` | Hover overlays |
| `--bg-navy` | `#0a192f` | Post-session review ("Stage Darkens") |
| `--bg-card` | `#1a1a28` | Card alias (same as elevated) |

### Background Overlays

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-deep-nav` | `rgba(10, 10, 18, 0.98)` | Navigation bar backdrop |
| `--bg-deep-overlay` | `rgba(10, 10, 18, 0.95)` | Onboarding/modal overlays |
| `--bg-navy-overlay` | `rgba(10, 25, 47, 0.85)` | Post-session darkening overlay |
| `--overlay-light` | `rgba(0, 0, 0, 0.5)` | Video overlays, dimming |
| `--overlay-dark` | `rgba(0, 0, 0, 0.7)` | Modal backdrops |

### Primary — Polished Amber

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#c9a227` | Buttons, cursor, active elements |
| `--primary-light` | `#ddb832` | Hover states |
| `--primary-dark` | `#a68520` | Pressed states |
| `--primary-gold` | `#ffd700` | Bright gold (follow-the-ball highlight) |
| `--primary-gold-deep` | `#8b6914` | Deep gold (follow-the-ball shadow) |
| `--primary-glow` | `rgba(201, 162, 39, 0.3)` | Box-shadow glow |

#### Primary Opacity Variants

| Token | Opacity | Usage |
|-------|---------|-------|
| `--primary-bg-subtle` | 6% | Lightest tint (card resting state) |
| `--primary-bg-light` | 8% | Nav hover background |
| `--primary-bg` | 10% | Standard primary tint |
| `--primary-bg-medium` | 15% | Selected card background |
| `--primary-bg-strong` | 20% | Emphasis background |
| `--primary-bg-glow` | 25% | Strong glow background |
| `--primary-border` | 20% | Subtle primary-tinted border |
| `--primary-border-hover` | 30% | Hover border |
| `--primary-fill` | 30% | SVG fill (radar charts) |

### Success — High-Contrast Emerald

| Token | Value | Usage |
|-------|-------|-------|
| `--success` | `#10b981` | Correct intonation, in-tune |
| `--success-light` | `#34d399` | Light emerald |
| `--success-dark` | `#2d5a4a` | Dark emerald (badges) |
| `--success-dark-deep` | `#1a3d30` | Deepest emerald (gradient end) |
| `--success-glow` | `rgba(16, 185, 129, 0.3)` | Emerald glow |
| `--success-bg` | 10% opacity | Success background tint |
| `--success-bg-medium` | 20% opacity | Medium success background |

### Error — Deep Crimson

| Token | Value | Usage |
|-------|-------|-------|
| `--error` | `#dc2626` | Errors, sharp/flat, heat map |
| `--error-light` | `#ef4444` | Light crimson |
| `--error-glow` | `rgba(220, 38, 38, 0.3)` | Crimson glow |
| `--error-bg` | 15% opacity | Error background tint |
| `--error-bg-medium` | 20% opacity | Medium error background |

### Warning — Orange

| Token | Value | Usage |
|-------|-------|-------|
| `--warning` | `#f97316` | Fair accuracy, caution states |
| `--warning-light` | `#fb923c` | Light warning |
| `--warning-glow` | `rgba(249, 115, 22, 0.3)` | Warning glow |

### Score Tiers

| Token | Value | Usage |
|-------|-------|-------|
| `--score-good` | `#6aaa6a` | "Good" score tier |
| `--score-good-bg` | `rgba(106, 170, 106, 0.15)` | Good tier background |
| `--score-needs-work` | `#d07030` | "Needs work" score tier |
| `--score-needs-work-bg` | `rgba(208, 112, 48, 0.15)` | Needs work background |

### Annotation Blue

| Token | Value | Usage |
|-------|-------|-------|
| `--annotation-blue` | `#00d4ff` | Neon cyan for annotations |
| `--annotation-blue-glow` | `rgba(0, 212, 255, 0.4)` | Annotation glow |

### Text Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#f5f5dc` | Soft Ivory (NOT pure white) |
| `--text-secondary` | `#a0a0b0` | Secondary labels |
| `--text-muted` | `#6a6a7a` | Disabled states, hints |
| `--text-overlay` | `rgba(255, 255, 255, 0.8)` | Text on dark overlays |
| `--text-overlay-bright` | `rgba(255, 255, 255, 0.9)` | Bright overlay text |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `--border` | `#2a2a3a` | Standard border |
| `--border-light` | `#3a3a4a` | Light border |
| `--border-subtle` | `#2a2a3a` | Subtle border |
| `--border-white-subtle` | `rgba(255, 255, 255, 0.1)` | White hairline on dark surfaces |

---

## Typography

### Font Families

| Token | Value | When to Use |
|-------|-------|-------------|
| `--font-heading` | `'Playfair Display', Georgia, serif` | Section headings, titles, branding. Use for anything that should feel prestigious and classical. |
| `--font-body` | `'Source Sans 3', -apple-system, BlinkMacSystemFont, sans-serif` | Body text, labels, buttons, form inputs. Use for readability and UI elements. |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', monospace` | Code, technical values (Hz, cents), exercise info. |

### Rules

- **Playfair Display** (serif): headings (`h1`–`h4`), titles, branding text, modal headers
- **Source Sans 3** (sans-serif): body copy, labels, buttons, navigation, form fields
- **JetBrains Mono** (monospace): technical readouts, frequencies, note names, score counts

### Font Sizes

| Token | Value |
|-------|-------|
| `--text-xs` | `0.75rem` (12px) |
| `--text-sm` | `0.875rem` (14px) |
| `--text-base` | `1rem` (16px) |
| `--text-lg` | `1.125rem` (18px) |
| `--text-xl` | `1.25rem` (20px) |
| `--text-2xl` | `1.5rem` (24px) |
| `--text-3xl` | `2rem` (32px) |
| `--text-4xl` | `3rem` (48px) |

---

## The "Emitted Light" Philosophy

Active elements in the Midnight Conservatory don't just change color — they **glow**.
This creates the feeling of performing under stage lighting in a concert hall.

### How It Works

- **Active elements** emit a soft glow via `box-shadow` using the `--*-glow` tokens
- **Inactive elements** are muted and flat — no glow, no shadow
- The glow should feel like light being cast outward, not a bright border

### Effect Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-glow` | `0 0 20px var(--primary-glow)` | Amber glow on active elements |
| `--shadow-success` | `0 0 20px var(--success-glow)` | Emerald glow on correct pitch |
| `--shadow-error` | `0 0 20px var(--error-glow)` | Crimson glow on errors |

### Examples

```css
/* Active button */
.btn-primary:hover {
    box-shadow: var(--shadow-glow);
}

/* Correct note */
.note-indicator.correct {
    box-shadow: var(--shadow-success);
}

/* Use utility classes */
.my-element.active { @extend .glow-amber; }
```

---

## The "Breath" Effect

The intonation needle uses a slow, breathing animation to feel organic:

```css
.intonation-needle {
    transition: var(--transition-breath); /* opacity 0.6s ease-in-out */
}
```

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-breath` | `opacity 0.6s ease-in-out` | Intonation needle breathing |
| `--transition-fade` | `opacity 0.3s ease` | Ghost UI nav fade |
| `--transition-fast` | `150ms ease` | Quick interactions (hover, click) |
| `--transition-normal` | `300ms ease` | Standard transitions |
| `--transition-slow` | `500ms ease` | Slow, dramatic transitions |

---

## Ghost UI Rules

Navigation and secondary UI elements should fade in/out rather than
snapping. This creates a "ghostly" feel appropriate for a dark concert hall.

### What Fades

- Navigation bars: use `--bg-deep-nav` (98% opacity) for glass-like transparency
- Modal overlays: use `--bg-deep-overlay` (95% opacity) with `backdrop-filter: blur()`
- Post-session overlay: use `--bg-navy-overlay` (85% opacity) — the "Stage Darkens"
- Secondary labels: transition opacity with `--transition-fade`

### When

- Nav appears immediately but background has built-in transparency
- Modals fade in with `opacity 0.4s ease` and `visibility 0.4s ease`
- Post-session overlay fades in with `animation: fadeIn 0.5s ease-out`
- Hover effects: `--transition-fast` (150ms)

### How

```css
.modal-overlay {
    opacity: 0;
    visibility: hidden;
    transition: var(--transition-fade), visibility 0.3s ease;
}

.modal-overlay.visible {
    opacity: 1;
    visibility: visible;
}
```

---

## Post-Session Transition

When a practice session ends, the UI transitions from the standard Oxford Blue
to the darker "Stage Darkens" navy, with a feathered crimson heat map overlay.

### The Spec

1. **Background shift**: `--bg-deep` (#0a0a12) → `--bg-navy-overlay` (rgba(10, 25, 47, 0.85))
2. **Heat map colors**: Use score tier tokens:
   - Excellent: `--success`
   - Good: `--primary`
   - Fair: `--warning`
   - Needs work: `--error`
3. **Overlay**: Applied via `::after` pseudo-element with `fadeIn` animation
4. **Duration**: 0.5s ease-out

```css
.sheet-music-container.session-ended::after {
    background: var(--bg-navy-overlay);
    animation: fadeIn 0.5s ease-out;
}
```

---

## Spacing Scale

| Token | Value |
|-------|-------|
| `--space-1` | `0.25rem` (4px) |
| `--space-2` | `0.5rem` (8px) |
| `--space-3` | `0.75rem` (12px) |
| `--space-4` | `1rem` (16px) |
| `--space-5` | `1.25rem` (20px) |
| `--space-6` | `1.5rem` (24px) |
| `--space-8` | `2rem` (32px) |
| `--space-10` | `2.5rem` (40px) |
| `--space-12` | `3rem` (48px) |
| `--space-16` | `4rem` (64px) |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `4px` | Small elements, tags |
| `--radius-md` | `8px` | Buttons, inputs |
| `--radius-lg` | `12px` | Cards, panels |
| `--radius-xl` | `16px` | Large cards, modals |
| `--radius-full` | `9999px` | Circles, pills |
| `--border-radius-pill` | `9999px` | Smart Loop button shape |

---

## Utility Classes

Available in `styles.css` for quick, consistent styling:

```css
/* Glows */
.glow-amber     /* box-shadow: 0 0 20px var(--primary-glow) */
.glow-emerald   /* box-shadow: 0 0 20px var(--success-glow) */
.glow-crimson   /* box-shadow: 0 0 20px var(--error-glow) */

/* Typography */
.text-heading   /* font-family: var(--font-heading) */
.text-body      /* font-family: var(--font-body) */
.text-mono      /* font-family: var(--font-mono) */

/* Backgrounds */
.bg-deep        /* background: var(--bg-deep) */
.bg-surface     /* background: var(--bg-surface) */
.bg-elevated    /* background: var(--bg-elevated) */
.bg-navy        /* background: var(--bg-navy) */

/* Text Colors */
.text-ivory     /* color: var(--text-primary) */
.text-amber     /* color: var(--primary) */
.text-emerald   /* color: var(--success) */
.text-crimson   /* color: var(--error) */

/* Transitions */
.transition-breath  /* transition: var(--transition-breath) */
.transition-fade    /* transition: var(--transition-fade) */
```

---

## Brand Exception: SSO Buttons

Google and Apple SSO buttons use hardcoded brand colors per their brand
guidelines. These are the ONLY permitted exceptions to the "no hardcoded
colors" rule:

- Google button: `background: #ffffff; color: #1f1f1f;`
- Apple button: `background: #000000; color: #ffffff;`

These exceptions are documented in `sso-login.css` with comments.

---

## CSS File Architecture

| File | Purpose |
|------|---------|
| `src/css/themes/midnight-conservatory.css` | **Design tokens only** — all CSS custom properties |
| `src/css/styles.css` | Main stylesheet — layout, components, utility classes |
| `src/css/scale-engine.css` | Scale engine component styles |
| `src/css/annotation-toolbar.css` | Score annotation toolbar |
| `src/css/sso-login.css` | SSO login screen |
| `src/css/role-selection.css` | Role selection screen |

### Load Order (in index.html)

1. `midnight-conservatory.css` — tokens MUST load first
2. `styles.css` — main styles consume tokens
3. Component CSS files — consume tokens

---

## Checklist for New CSS

Before submitting a PR that touches CSS:

- [ ] No hardcoded hex codes — `grep -rn '#[0-9a-fA-F]' src/css/` should only find var() fallbacks and the `:root` block
- [ ] Colors reference `var(--token-name)` tokens
- [ ] Fonts use `var(--font-heading)`, `var(--font-body)`, or `var(--font-mono)`
- [ ] Spacing uses `var(--space-N)` tokens
- [ ] Border radius uses `var(--radius-*)` tokens
- [ ] Active elements have glow effects using `var(--shadow-glow)` or similar
- [ ] Transitions use `var(--transition-*)` tokens
- [ ] The `theme-consistency.test.js` and `design-system.test.js` tests pass
