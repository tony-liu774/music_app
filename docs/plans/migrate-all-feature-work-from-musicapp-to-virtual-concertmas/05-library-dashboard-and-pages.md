# Milestone 5: Library, Dashboard, and Pages

## Goal

Migrate all remaining feature components (library, dashboard, tuner, onboarding) and all page components, then wire up the full routing tree in App.jsx.

## Tasks

### Task 5.1: Migrate Library, Dashboard, Tuner, and Onboarding Components

**Description:** Copy the remaining component directories: `library/` (ScoreCard), `dashboard/` (PracticeStreakWidget, ProgressChart, RecentSessionsList, UpNextWidget), `tuner/` (TunerDisplay, TunerGauge, index barrel), and `onboarding/` (MicPermissionModal). These are leaf components that compose into pages.

**Agent type:** coder

**Subtasks:**
1. Copy `client/src/components/library/` to `src/components/library/` with tests
2. Copy `client/src/components/dashboard/` to `src/components/dashboard/` with tests
3. Copy `client/src/components/tuner/` to `src/components/tuner/` with tests
4. Copy `client/src/components/onboarding/` to `src/components/onboarding/` with tests
5. Update all import paths
6. Run tests for all copied components
7. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- All 4 component directories exist with their files and tests
- All component tests pass
- ScoreCard, dashboard widgets, tuner, and onboarding modal render correctly

**Dependencies:** Task 2.1 (UI primitives), Task 3.2 (stores), Task 4.1 (hooks)

---

### Task 5.2: Migrate Page Components

**Description:** Copy all 8 page components from `client/src/pages/` to `src/pages/`: Dashboard, Library, PracticePage, Tuner/TunerPage, Settings/SettingsPage, StudioDashboard. Some pages have duplicate variants (Tuner vs TunerPage) -- consolidate to single versions. Copy page test files as well.

**Agent type:** coder

**Subtasks:**
1. Copy all page files from `client/src/pages/` to `src/pages/`
2. Copy page test files from `client/src/pages/__tests__/` to `src/pages/__tests__/`
3. Audit duplicate pages (Tuner vs TunerPage, Settings vs SettingsPage) and consolidate if they are identical
4. Update all imports for components, hooks, stores, and services
5. Run page tests
6. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- All page components exist in `src/pages/`
- No redundant duplicate pages
- Page tests pass

**Dependencies:** Task 5.1 (pages compose feature components), Task 4.2 (practice components)

---

### Task 5.3: Wire Up Routing and App Entry Point

**Description:** Update `src/App.jsx` and `src/main.jsx` to match the full routing tree from music_app. The source uses HashRouter with AuthProvider, AuthSyncProvider, and ToastProvider wrapping all routes. The target currently uses BrowserRouter with only "/" and "/sandbox" routes. Switch to HashRouter (better for Tauri file:// protocol), add all provider wrappers, and register all routes with ProtectedRoute guards. Keep the Sandbox page accessible for development.

**Agent type:** coder

**Subtasks:**
1. Update `src/App.jsx` to use HashRouter, wrap with AuthProvider, AuthSyncProvider, ToastProvider
2. Add all routes: login, index (Dashboard), library, practice, tuner, settings, studio-dashboard
3. Wrap authenticated routes in ProtectedRoute
4. Keep `/sandbox` route for development reference
5. Update `src/main.jsx` to remove BrowserRouter (now in App.jsx) and remove registerServiceWorker call (Tauri handles this differently)
6. Copy `client/src/lib/registerSW.js` to `src/lib/registerSW.js` for reference but do not auto-register
7. Verify the app starts with `npm run dev` and renders the login page
8. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- App renders with HashRouter
- All routes are registered and accessible
- Unauthenticated users are redirected to /login
- Authenticated users see the Dashboard at /
- Sandbox page remains accessible at /sandbox

**Dependencies:** Task 5.2 (all pages), Task 3.3 (auth components)
