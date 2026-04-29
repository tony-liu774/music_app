# Milestone 1: Foundation and Dependencies

## Goal

Prepare the virtual-concertmaster repo to receive migrated code by installing all required dependencies, unifying the CSS theme, and setting up test infrastructure.

## Tasks

### Task 1.1: Merge package.json Dependencies

**Description:** Add all dependencies from music_app's `client/package.json` and root `package.json` into virtual-concertmaster's `package.json`. The target repo already has React 19, react-router-dom 7, Tailwind v4, and Tauri. We need to add: `@supabase/supabase-js`, `vexflow`, `zustand`, and all dev dependencies (Vitest, Testing Library, jsdom, fake-indexeddb, Prettier, ESLint plugins). The Express backend dependencies will be handled in Milestone 7 with a separate `server/package.json`.

**Agent type:** coder

**Target repo:** `tony-liu774/virtual-concertmaster` — all changes and PRs target this repo, not music_app. See 00-overview.md "Cross-Repo Execution Model" for setup instructions.

**Subtasks:**
1. Clone virtual-concertmaster: `gh repo clone tony-liu774/virtual-concertmaster /tmp/virtual-concertmaster` (all subsequent work happens in `/tmp/virtual-concertmaster/`)
2. Read both package.json files to determine exact version ranges needed (music_app's from the current worktree, virtual-concertmaster's from the clone)
3. Add runtime dependencies to virtual-concertmaster's package.json: `@supabase/supabase-js`, `vexflow`, `zustand`
4. Add devDependencies: `@testing-library/jest-dom`, `@testing-library/react`, `@testing-library/user-event`, `fake-indexeddb`, `jsdom`, `vitest`, `prettier`, `eslint-config-prettier`, `eslint-plugin-react`
5. Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"format": "prettier --write \"src/**/*.{js,jsx,css,json}\""`, `"format:check": "prettier --check \"src/**/*.{js,jsx,css,json}\""`
6. Run `npm install` and verify no conflicts
7. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- `npm install` succeeds with no peer dependency errors
- `npm run build` still produces a working Vite build
- All new dependencies are listed in package.json

**Dependencies:** None

---

### Task 1.2: Unify CSS Theme Tokens

**Description:** Merge the Midnight Conservatory theme from music_app's `client/src/styles/app.css` into virtual-concertmaster's `src/index.css`. The target already has basic Tailwind v4 `@theme` tokens. The source has a much richer set including additional colors (amber-light/dark, emerald-light, crimson-light, google brand colors), glow shadows, custom animations (fade-in, slide-up, amber-pulse, ball-pulse, ball-bounce, glow-pulse, glow-bounce, amber-spin), `@layer base` CSS custom properties, `@layer components` cursor gradient classes, and layout variables. The two files use slightly different token naming (target uses `--color-bg-deep`, source uses `--color-oxford-blue`). Unify under the target's naming convention while adding all missing tokens.

**Agent type:** coder

**Subtasks:**
1. Read both CSS files side by side
2. Add missing `@theme` tokens to the target's `@theme` block: amber-light, amber-dark, amber-glow, emerald, emerald-light, emerald-glow, crimson, crimson-light, crimson-glow, border, border-light, card, border-subtle, google brand colors, font-mono, shadow tokens, all animation tokens
3. Copy all missing `@keyframes` definitions (fade-in, slide-up, amber-pulse, ball-pulse, ball-bounce, glow-bounce, amber-spin)
4. Add the `@layer base` block with `:root` CSS custom property aliases and `[data-theme='light']` overrides
5. Add the `@layer components` block with cursor gradient utility classes
6. Verify no duplicate token names or conflicting values
7. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- `src/index.css` contains all theme tokens from both sources
- Tailwind v4 `@theme` block is valid (no syntax errors)
- `npm run build` succeeds
- All `@keyframes`, `@layer base`, and `@layer components` blocks are present

**Dependencies:** None

---

### Task 1.3: Configure Vitest and Test Setup

**Description:** Set up Vitest in virtual-concertmaster to match the music_app client test infrastructure. This includes configuring `vite.config.js` with test settings (jsdom environment, setup files, globals) and creating the test setup file that imports Testing Library matchers.

**Agent type:** coder

**Subtasks:**
1. Read music_app's `client/vite.config.js` test configuration and `client/src/test/setup.js`
2. Add Vitest test config to virtual-concertmaster's `vite.config.js`: globals, jsdom environment, setupFiles, NODE_ENV
3. Copy `client/src/test/setup.js` to `src/test/setup.js` in virtual-concertmaster
4. Create a sample test file to verify the setup works
5. Run `npx vitest run` and confirm it passes
6. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- `npx vitest run` executes successfully
- jsdom environment is configured
- Testing Library matchers are available via setup file
- A sample test passes

**Dependencies:** Task 1.1 (needs vitest and testing-library installed)

---

### Task 1.4: Set Up ESLint and Prettier Configuration

**Description:** Migrate ESLint and Prettier configuration from music_app to virtual-concertmaster. The target already has a basic `eslint.config.js`. Enhance it with the no-hardcoded-hex custom rule and Prettier integration. Copy the custom ESLint rule plugin and `.prettierrc`.

**Agent type:** coder

**Subtasks:**
1. Read music_app's `client/.eslintrc.cjs`, `client/.prettierrc`, and `client/eslint-rules/` directory
2. Copy the `eslint-rules/` directory (custom no-hardcoded-hex plugin) to virtual-concertmaster
3. Create `.prettierrc` in virtual-concertmaster matching the source config
4. Update `eslint.config.js` to integrate Prettier and the custom hex rule
5. Update package.json devDependencies if any ESLint plugins are missing
6. Run `npm run lint` and fix any baseline issues
7. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- `npm run lint` runs without errors on existing files
- Custom no-hardcoded-hex rule is loaded
- Prettier config is present and `npm run format:check` works

**Dependencies:** Task 1.1 (needs eslint/prettier deps installed)
