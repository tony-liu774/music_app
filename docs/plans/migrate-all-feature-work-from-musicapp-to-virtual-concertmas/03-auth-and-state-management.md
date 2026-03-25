# Milestone 3: Auth and State Management

## Goal

Migrate the authentication system, Supabase client, Zustand stores, and auth-related components so that protected routes and state management are operational.

**Target repo:** `tony-liu774/virtual-concertmaster` — see 00-overview.md "Cross-Repo Execution Model" for setup.

## Tasks

### Task 3.1: Migrate Supabase Client and Auth Context

**Description:** Copy the Supabase client library (`client/src/lib/supabase.js`), AuthContext (`client/src/contexts/AuthContext.jsx`), AuthSyncProvider (`client/src/contexts/AuthSyncProvider.jsx`), and the `.env.example` file. These provide the Supabase connection, auth state management via React context, and cross-tab auth synchronization. Update import paths for the new flat `src/` structure.

**Agent type:** coder

**Subtasks:**
1. Copy `client/src/lib/supabase.js` to `src/lib/supabase.js`
2. Copy `client/src/contexts/AuthContext.jsx` to `src/contexts/AuthContext.jsx`
3. Copy `client/src/contexts/AuthSyncProvider.jsx` to `src/contexts/AuthSyncProvider.jsx`
4. Copy `client/.env.example` to `.env.example` in virtual-concertmaster root (merge with any existing)
5. Update import paths in all copied files
6. Copy auth component tests from `client/src/components/auth/__tests__/AuthContext.test.jsx`
7. Run tests and verify they pass
8. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- Supabase client initializes without errors when env vars are set
- AuthContext provides login/logout/session state
- AuthSyncProvider syncs auth state across browser tabs
- Auth context tests pass

**Dependencies:** Task 1.1 (needs @supabase/supabase-js)

---

### Task 3.2: Migrate Zustand Stores

**Description:** Copy all 6 Zustand stores from `client/src/stores/` into `src/stores/`: useAudioStore, useAuthStore, useLibraryStore, useSessionStore, useSettingsStore, useUIStore. These replace the stubs created in Milestone 2. Also copy their co-located test files.

**Agent type:** coder

**Subtasks:**
1. Copy all store files from `client/src/stores/` to `src/stores/`
2. Copy all store test files (*.test.js) alongside them
3. Update any import paths (e.g., references to `../lib/supabase` or `../services/`)
4. For services not yet migrated, create minimal stubs with TODO comments
5. Remove any stubs created in Milestone 2 that are now replaced by real implementations
6. Run store tests with `npx vitest run src/stores`
7. Fix any failing tests
8. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- All 6 stores exist in `src/stores/` with correct exports
- Store tests pass
- Milestone 2 stubs are replaced with real implementations

**Dependencies:** Task 3.1 (stores reference Supabase client), Task 1.1 (needs zustand)

---

### Task 3.3: Migrate Auth Components

**Description:** Copy LoginPage and ProtectedRoute from `client/src/components/auth/` into `src/components/auth/`. These depend on AuthContext and useAuthStore which are now available from prior tasks.

**Agent type:** coder

**Subtasks:**
1. Copy `client/src/components/auth/LoginPage.jsx` to `src/components/auth/LoginPage.jsx`
2. Copy `client/src/components/auth/ProtectedRoute.jsx` to `src/components/auth/ProtectedRoute.jsx`
3. Copy test files from `client/src/components/auth/__tests__/` to `src/components/auth/__tests__/`
4. Update import paths for contexts, stores, and UI components
5. Run auth component tests
6. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- LoginPage and ProtectedRoute render without errors
- Auth component tests pass
- Components correctly reference AuthContext and useAuthStore

**Dependencies:** Task 3.1, Task 3.2, Task 2.1 (auth components use UI primitives)
