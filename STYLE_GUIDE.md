# Style Guide — Midnight Conservatory

## CSS Architecture

All styling uses **Tailwind CSS v4** with a single source file: `src/css/app.css`.

### Rules

1. **No standalone CSS files.** All styles live in `src/css/app.css`.
2. **No hardcoded colors.** Use theme tokens (`bg-oxford-blue`, `text-ivory`, `text-amber`, etc.) or CSS custom properties (`var(--primary)`, `var(--bg-deep)`, etc.).
3. **Utility-first.** Prefer Tailwind utility classes in HTML for simple styling.
4. **Complex components** use `@layer components` in `app.css`.
5. **Theme tokens** are defined in the `@theme` block — edit there to change the design system.

### Build

```bash
npm run build:css          # One-time build
npm run watch:css          # Watch mode for development
```

Source: `src/css/app.css` → Compiled: `public/styles.css`

### Theme Tokens (Tailwind utilities)

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

### Typography

- **Headings:** `font-heading` (Playfair Display)
- **Body:** `font-body` (Source Sans 3)
- **Code:** `font-mono` (JetBrains Mono)

### Glow Effects

- `shadow-amber-glow` — Polished Amber atmospheric glow
- `shadow-emerald-glow` — Correct/success feedback glow
- `shadow-crimson-glow` — Error feedback glow
