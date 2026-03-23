# Milestone 1: Environment and Scaffolding

## Goal

Set up a Vite + React project alongside the existing Express backend, configure Tailwind v4 with the existing CSS-first `@theme` palette, enforce code quality with ESLint + Prettier (no inline styling), and build the foundational UI component library in the Midnight Conservatory theme.

## Scope

- Vite + React project initialization (separate from Express backend)
- Tailwind v4 integration using the existing `src/css/app.css` `@theme` block (no `tailwind.config.js`)
- ESLint + Prettier configuration enforcing no inline styles and no hardcoded hex codes
- Base UI components: Button, Modal, Card, Navigation (top nav + mobile bottom tab bar), Layout shell
- Zustand store architecture: separate UI store and Audio store
- Routing setup (hash-based to match existing nav: dashboard, library, practice, tuner, settings)

---

### Task 1: Initialize Vite + React Project

**Description:** Create a Vite + React project structure in a `client/` directory alongside the existing Express backend. Configure the dev server to proxy API requests to Express on port 3000.

**Agent type:** coder

**Depends on:** (none)

**Subtasks:**
1. Create `client/` directory with `npm create vite@latest` using the React template
2. Install dependencies: `react`, `react-dom`, `react-router-dom`, `zustand`, `vexflow`
3. Configure `vite.config.js` with proxy to Express backend (`/api` -> `http://localhost:3000`)
4. Move/copy the existing `src/css/app.css` into `client/src/styles/app.css` as the single Tailwind source file
5. Verify `@theme` block is preserved and Tailwind v4 PostCSS integration works with Vite
6. Set up `client/index.html` with Google Fonts (Playfair Display, Source Sans 3, JetBrains Mono) and meta tags matching existing `index.html`
7. Add npm scripts: `dev` (Vite dev server), `build` (production build), `preview`
8. Verify the dev server starts and renders a minimal React app with Midnight Conservatory background color

**Acceptance criteria:**
- `cd client && npm run dev` starts a Vite dev server with hot reload
- The page renders with `bg-oxford-blue` background and `text-ivory` text
- API proxy forwards `/api/*` requests to Express
- No `tailwind.config.js` file exists anywhere in the project
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 2: ESLint and Prettier Configuration

**Description:** Configure ESLint and Prettier in the `client/` directory to enforce code quality, ban inline styles, and prevent hardcoded hex codes in component files.

**Agent type:** coder

**Depends on:** Task 1 (Initialize Vite + React Project)

**Subtasks:**
1. Install ESLint with React and hooks plugins, plus Prettier
2. Create `.eslintrc.cjs` with rules: `no-restricted-syntax` to ban `style=` JSX attributes containing color values, custom rule or pattern to flag hex color literals in `.jsx`/`.tsx` files
3. Create `.prettierrc` with consistent formatting (single quotes, trailing commas, 2-space indent)
4. Add `lint` and `format` scripts to `client/package.json`
5. Verify lint passes on all existing files and catches violations when inline hex codes are added

**Acceptance criteria:**
- `npm run lint` passes with zero errors on clean codebase
- Adding `style={{ color: '#ff0000' }}` to a component triggers a lint error
- Prettier formats all files consistently
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 3: Base UI Component Library

**Description:** Build the foundational UI components in the Midnight Conservatory theme using Tailwind utility classes exclusively (no hardcoded hex). Components: Button (primary/secondary/ghost variants), Modal, Card, Toast notification, and input fields.

**Agent type:** coder

**Depends on:** Task 1 (Initialize Vite + React Project)

**Subtasks:**
1. Create `client/src/components/ui/Button.jsx` with variants: primary (amber), secondary (surface), ghost (transparent), danger (crimson). Support sizes: sm, md, lg. Include hover/focus states with glow effects (`shadow-amber-glow`, etc.)
2. Create `client/src/components/ui/Modal.jsx` with backdrop blur, slide-in animation, close on Escape/backdrop click, focus trap. Use `bg-elevated` background with `border-border` borders
3. Create `client/src/components/ui/Card.jsx` with subtle border glow on hover, `bg-surface` base with `rounded-lg`
4. Create `client/src/components/ui/Toast.jsx` with success (emerald), error (crimson), info (amber) variants. Auto-dismiss with configurable duration. Position bottom-right
5. Create `client/src/components/ui/Input.jsx` and `Select.jsx` with Midnight Conservatory styling (surface background, ivory text, amber focus ring)
6. Create `client/src/components/ui/index.js` barrel export
7. All SVG icons used in components must have explicit `max-w` and `max-h` classes

**Acceptance criteria:**
- All components render correctly with Midnight Conservatory theme colors
- No hardcoded hex codes in any component file
- All SVG/icon elements have bounded dimensions via `max-w-*` and `max-h-*` classes
- Button hover states show appropriate glow effects
- Modal traps focus and closes on Escape
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 4: Navigation and Layout Shell

**Description:** Build the application layout shell with top navigation bar (desktop) and bottom tab bar (mobile), matching the existing nav structure. Implement hash-based routing for all views.

**Agent type:** coder

**Depends on:** Task 3 (Base UI Component Library)

**Subtasks:**
1. Create `client/src/components/layout/MainNav.jsx` -- desktop top navigation with logo, nav links (Home, Library, Practice, Tuner, Settings), active state with amber underline
2. Create `client/src/components/layout/MobileNav.jsx` -- bottom tab bar matching existing Tonic-style design with SVG icons, active amber highlight
3. Create `client/src/components/layout/AppShell.jsx` -- wraps content with nav, handles responsive breakpoints, provides main content area with proper padding
4. Set up `react-router-dom` with hash router and routes: `/` (dashboard), `/library`, `/practice`, `/tuner`, `/settings`, `/studio-dashboard`
5. Create placeholder page components for each route in `client/src/pages/`
6. Implement nav link active state tracking via router location
7. Logo SVG must have `max-w-8 max-h-8` classes

**Acceptance criteria:**
- Desktop shows top nav bar, mobile shows bottom tab bar
- Clicking nav links changes the route and highlights the active link with amber
- All page routes render their placeholder content
- Navigation is smooth with no full-page reloads
- Logo and nav icons have bounded dimensions
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 5: Zustand Store Architecture

**Description:** Set up the Zustand store architecture with separate stores for UI state and Audio state, plus a session store for practice data. This establishes the state management foundation for the entire app.

**Agent type:** coder

**Depends on:** Task 1 (Initialize Vite + React Project)

**Subtasks:**
1. Create `client/src/stores/useUIStore.js` -- manages: current view, modal state, toast queue, sidebar open/closed, theme preferences, nav visibility (for ghost mode fade)
2. Create `client/src/stores/useAudioStore.js` -- manages: mic permission status, audio context state (suspended/running/closed), current pitch data (frequency, note, cents, confidence), vibrato data, is-practicing flag, selected instrument
3. Create `client/src/stores/useSessionStore.js` -- manages: current session ID, session start time, error log array (JSON), score ID, practice history
4. Create `client/src/stores/useLibraryStore.js` -- manages: score list, selected score, search/filter state, loading state
5. Add Zustand devtools middleware to all stores for debugging
6. Write unit tests for each store verifying state transitions

**Acceptance criteria:**
- Each store is independently importable and functional
- UI store and Audio store are fully separate with no cross-dependencies
- Zustand devtools show store state in browser devtools
- Unit tests pass for all store state transitions
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`
