# Style Guide — Midnight Conservatory

## CSS Architecture

All styling uses **Tailwind CSS v4** with a single source file: `src/css/app.css`.

### Migration Status

This is a **CSS consolidation** step. All six legacy CSS files have been merged into `src/css/app.css` using `@layer components` to preserve existing class names used by JavaScript. Existing components use CSS custom properties (`var(--primary)`, `var(--bg-deep)`, etc.) defined in `@layer base`.

**For new code**, prefer Tailwind utility classes (`bg-oxford-blue`, `text-amber`, etc.) in HTML. Migrating existing components to utility-first HTML is a follow-up task.

### Rules

1. **No standalone CSS files.** All styles live in `src/css/app.css`.
2. **No hardcoded colors.** Use Tailwind utility classes (`bg-oxford-blue`, `text-ivory`, `text-amber`, etc.) for new code, or CSS custom properties (`var(--primary)`, `var(--bg-deep)`, etc.) in existing components.
3. **Utility-first for new code.** Prefer Tailwind utility classes in HTML for simple styling.
4. **Complex components** use `@layer components` in `app.css`.
5. **Theme tokens** are defined in the `@theme` block — edit there to change the design system.

### Build

```bash
npm run build:css          # One-time build
npm run watch:css          # Watch mode for development
```

Source: `src/css/app.css` → Compiled: `public/styles.css`

### Theme Tokens (Tailwind utilities)

These tokens are defined in the `@theme` block and generate Tailwind utility classes. They map to `--color-*` CSS custom properties (e.g., `--color-oxford-blue`).

| Token               | Value                          | Utility Example       |
|---------------------|--------------------------------|-----------------------|
| `oxford-blue`       | `#0a0a12`                      | `bg-oxford-blue`      |
| `surface`           | `#141420`                      | `bg-surface`          |
| `elevated`          | `#1a1a28`                      | `bg-elevated`         |
| `amber`             | `#c9a227`                      | `text-amber`          |
| `emerald`           | `#10b981`                      | `text-emerald`        |
| `crimson`           | `#dc2626`                      | `text-crimson`        |
| `ivory`             | `#f5f5dc`                      | `text-ivory`          |
| `ivory-muted`       | `#a0a0b0`                      | `text-ivory-muted`    |
| `ivory-dim`         | `#6a6a7a`                      | `text-ivory-dim`      |

**Note:** Existing components use backward-compatible aliases (`var(--bg-surface)`, `var(--bg-elevated)`) defined in `@layer base`. These resolve to the same values as the theme tokens above.

### Typography

- **Headings:** `font-heading` (Playfair Display)
- **Body:** `font-body` (Source Sans 3)
- **Code:** `font-mono` (JetBrains Mono)

### Glow Effects

- `shadow-amber-glow` — Polished Amber atmospheric glow
- `shadow-emerald-glow` — Correct/success feedback glow
- `shadow-crimson-glow` — Error feedback glow
