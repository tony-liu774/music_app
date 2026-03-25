# Milestone 2: UI Primitives and Layout

## Goal

Migrate the foundational UI component library and layout shell so that subsequent milestones can compose pages from these building blocks.

## Tasks

### Task 2.1: Migrate UI Component Library

**Description:** Copy the 7 UI primitive components from `client/src/components/ui/` into `src/components/ui/` in virtual-concertmaster. These are: Button, Card, Input, Modal, Select, Toast (with ToastProvider context), and the barrel `index.js`. All use Tailwind v4 utility classes with Midnight Conservatory theme tokens. Update any import paths that reference `client/src/` to use the flat `src/` structure.

**Agent type:** coder

**Subtasks:**
1. Copy all files from music_app `client/src/components/ui/` to virtual-concertmaster `src/components/ui/`
2. Review each file for import paths -- update any that reference `../../styles/` or other `client/src/` relative paths
3. Copy test files from `client/src/components/ui/__tests__/` to `src/components/ui/__tests__/`
4. Run the UI component tests with `npx vitest run src/components/ui`
5. Fix any failing tests due to path or dependency issues
6. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- All 7 UI components exist in `src/components/ui/`
- Barrel export `src/components/ui/index.js` re-exports all components
- All UI component tests pass
- No hardcoded colors (theme tokens used throughout)

**Dependencies:** Task 1.1, Task 1.2, Task 1.3

---

### Task 2.2: Migrate Layout Components

**Description:** Copy the 4 layout components from `client/src/components/layout/` into `src/components/layout/`: AppShell (main layout wrapper with `<Outlet/>`), MainNav (desktop navigation), MobileNav (responsive mobile nav), and OfflineIndicator. These import from `../ui/` and use hooks like `useOffline`. The hooks will be migrated in later tasks, so for now stub or conditionally import them to keep the components loadable.

**Agent type:** coder

**Subtasks:**
1. Copy all files from `client/src/components/layout/` to `src/components/layout/`
2. Copy test files from `client/src/components/layout/__tests__/` to `src/components/layout/__tests__/`
3. Update imports: `../ui/` paths should work as-is since UI components are already migrated
4. For hooks not yet migrated (useOffline), create minimal stub files in `src/hooks/` that export the expected interface
5. Update any references to `useAuthStore` or `useUIStore` -- create minimal stubs in `src/stores/` if needed
6. Run layout component tests with `npx vitest run src/components/layout`
7. Fix any failing tests
8. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- All 4 layout components exist in `src/components/layout/`
- Components can be imported without errors
- Layout tests pass (with stubs where necessary)
- Stubs are clearly marked with TODO comments for replacement in later milestones

**Dependencies:** Task 2.1
