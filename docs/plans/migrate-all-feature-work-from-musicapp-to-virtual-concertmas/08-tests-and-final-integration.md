# Milestone 8: Tests and Final Integration

## Goal

Run the full test suite across all migrated code, fix any remaining import/path issues, verify the application builds and runs end-to-end, and clean up any leftover stubs or TODO comments.

## Tasks

### Task 8.1: Migrate Remaining Test Files and Run Full Suite

**Description:** Ensure all test files from music_app have been migrated. Some test files from `tests/` may test vanilla JS engine modules and belong in `src/engine/__tests__/`. Some test files from `client/src/test/` (like eslint-prettier.test.js and project-setup.test.js) need to be adapted for the new repo structure. Run the complete test suite and fix all failures.

**Agent type:** coder

**Subtasks:**
1. Audit all test files in music_app against what has been migrated -- identify any gaps
2. Copy `client/src/test/eslint-prettier.test.js` and `client/src/test/project-setup.test.js` to `src/test/`, adapting path references
3. Migrate any remaining engine test files from `tests/` that were not covered in Milestone 6 (e.g., dashboard-ui.test.js, tuner.test.js, onboarding.test.js, sso-login-ui.test.js, role-selection-ui.test.js, role-selection-service.test.js, practice-loop.test.js, theme-consistency.test.js, sw-queue.test.js, bluetooth-hid.test.js, annotation-canvas.test.js, annotation-service.test.js, cloud-sync-service.test.js, pdf-export-service.test.js, heat-map-history-service.test.js, library-service.test.js, llm-service.test.js, offline-session-manager.test.js, session-persistence-service.test.js)
4. Run `npx vitest run` for the full frontend test suite
5. Run `cd server && npm test` for the backend test suite
6. Fix all import path errors, missing module references, and test configuration issues
7. Ensure all tests pass (or document known failures with justification)
8. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- All test files from music_app have been migrated to virtual-concertmaster
- `npx vitest run` passes for the frontend
- `cd server && npm test` passes for the backend
- No orphaned stubs remain (all TODOs from prior milestones are resolved)

**Dependencies:** All prior milestones (1-7)

---

### Task 8.2: Verify Build, Dev Server, and Tauri Integration

**Description:** Confirm the complete application works end-to-end: Vite production build succeeds, dev server starts, Tauri app launches (if Rust toolchain is available), and all routes render correctly. Clean up any remaining artifacts from the migration (unused files, dead imports, leftover Sandbox-only code).

**Agent type:** coder

**Subtasks:**
1. Run `npm run build` and verify it completes with no errors
2. Run `npm run preview` and verify the production build serves correctly
3. Run `npm run dev` and verify the Vite dev server starts
4. Navigate through all routes in the browser: login, dashboard, library, practice, tuner, settings, studio-dashboard
5. If Tauri CLI is available, run `npm run tauri dev` and verify the desktop app launches
6. Remove or update the original Sandbox page if it is no longer needed
7. Update `index.html` if any changes are needed (title, meta tags, etc.)
8. Copy `.env.example` and `SUPABASE_SETUP.md` documentation if useful
9. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- `npm run build` succeeds with zero errors and zero warnings (or only known Vite warnings)
- Dev server starts and all routes are accessible
- No dead imports or unused files remain
- The Midnight Conservatory theme renders correctly across all pages

**Dependencies:** Task 8.1, Task 5.3 (routing)

---

### Task 8.3: Copy Ancillary Files and Documentation

**Description:** Migrate supporting files that are not code but are important for the project: `.gitignore` updates, `.env.example`, `STYLE_GUIDE.md`, PWA assets (`public/sw.js`, `public/push-notification-worker.js`), and the existing plan documents for historical reference.

**Agent type:** coder

**Subtasks:**
1. Merge `.gitignore` from music_app with virtual-concertmaster's existing `.gitignore`
2. Copy `STYLE_GUIDE.md` to virtual-concertmaster root
3. Copy PWA-related files (`sw.js`, `public/push-notification-worker.js`) to appropriate locations (may need adaptation for Tauri)
4. Copy `.env.example` files and merge them
5. Verify no sensitive files are committed (check for .env, credentials, API keys)
6. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- `.gitignore` covers all relevant patterns (node_modules, dist, .env, Tauri build artifacts)
- Style guide is available in the repo
- No sensitive files are tracked

**Dependencies:** None
