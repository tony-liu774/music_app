# Migration Plan: music_app to virtual-concertmaster

## Goal

Migrate all 25 tasks worth of feature work from `tony-liu774/music_app` into `tony-liu774/virtual-concertmaster`, adapting everything to fit the existing Tauri + Vite + React + Tailwind CSS v4 scaffold.

## Current State

**Source repo (music_app)** contains:
- `client/` -- React SPA (Vite + Tailwind v4): 28 components, 10 hooks, 6 stores, 5 services, 8 pages, 65 test files
- `src/js/` -- Vanilla JS engine: 61 files (audio DSP, analysis, components, services, parsers, utils)
- `src/` -- Express backend: routes, middleware, config, services (80 files)
- `src/css/` -- Midnight Conservatory theme (CSS variables + Tailwind v4 `@theme`)
- `tests/` -- 47 server/engine test files

**Target repo (virtual-concertmaster)** contains:
- Phase 0 scaffold: Vite + React + Tailwind CSS v4 + Tauri (3 commits)
- `src/index.css` -- Midnight Conservatory design system (Tailwind v4 `@theme` tokens)
- `src/App.jsx` -- Landing page with route to Sandbox
- `src-tauri/` -- Tauri v2 Rust shell (build.rs, capabilities, config)

## Cross-Repo Execution Model

All task agents run inside the **music_app** repository worktree. To work on virtual-concertmaster, each task must:

1. **Clone the target repo** as a first step: `gh repo clone tony-liu774/virtual-concertmaster /tmp/virtual-concertmaster` (or reuse if already cloned)
2. **Read source files** from the music_app worktree (the current working directory) using relative paths
3. **Write/copy files** into the cloned virtual-concertmaster directory at `/tmp/virtual-concertmaster/`
4. **Create branches, commit, and push** from inside `/tmp/virtual-concertmaster/`
5. **Create PRs** targeting the `tony-liu774/virtual-concertmaster` repo: `gh pr create --repo tony-liu774/virtual-concertmaster`

Every task description below specifies that the PR targets **virtual-concertmaster**. The agent should treat the music_app worktree as read-only source material and the `/tmp/virtual-concertmaster` clone as the working repo where all changes are committed.

## High-Level Approach

1. **Foundation first** -- Merge package dependencies, unify the CSS theme, and set up test infrastructure in the target repo
2. **Client code in layers** -- Migrate UI primitives, then layout, then feature components, then pages, wiring up routing last
3. **Core JS engine** -- Copy audio/analysis/parser modules, adapting any import paths
4. **Backend as a sidecar** -- Migrate the Express server into a `server/` directory (Tauri can spawn it or it runs standalone)
5. **Tests follow code** -- Each milestone migrates the corresponding test files
6. **Path/import fixup** -- Every milestone includes an import adaptation step since `client/src/` flattens to `src/`

## Key Structural Changes

| music_app path | virtual-concertmaster path | Notes |
|---|---|---|
| `client/src/components/` | `src/components/` | Flat src, no client/ prefix |
| `client/src/hooks/` | `src/hooks/` | Same |
| `client/src/stores/` | `src/stores/` | Same |
| `client/src/services/` | `src/services/` | Same |
| `client/src/pages/` | `src/pages/` | Same |
| `client/src/contexts/` | `src/contexts/` | Same |
| `client/src/workers/` | `src/workers/` | Same |
| `client/src/lib/` | `src/lib/` | Same |
| `client/src/constants/` | `src/constants/` | Same |
| `client/src/styles/app.css` | `src/index.css` | Merge into existing theme file |
| `client/src/test/` | `src/test/` | Same |
| `src/js/` | `src/engine/` | Rename for clarity in new repo |
| `src/` (Express server) | `server/` | Separate from Vite frontend |
| `src/css/themes/` | Absorbed into `src/index.css` | Tailwind v4 @theme tokens |
| `tests/` | `server/tests/` | Collocated with server |

## Milestones

1. **Foundation and Dependencies** -- Merge package.json dependencies, unify CSS theme tokens, configure Vitest, set up ESLint/Prettier
2. **UI Primitives and Layout** -- Migrate ui/ components (Button, Card, Input, Modal, Select, Toast), layout components (AppShell, MainNav, MobileNav, OfflineIndicator), and their tests
3. **Auth and State Management** -- Migrate auth components, contexts (AuthContext, AuthSyncProvider), Zustand stores, and Supabase client
4. **Practice Components** -- Migrate practice/ components (SheetMusic, IntonationNeedle, PracticeControls, PredictiveCursor, HeatMapOverlay, CoachDebrief, SmartLoop, AudioSuspensionOverlay) and hooks
5. **Library, Dashboard, and Pages** -- Migrate library/, dashboard/, tuner/, onboarding/ components and all pages, wire up routing
6. **Core JS Engine** -- Migrate audio engine, analysis modules, parsers, hardware listeners, and vanilla JS services into src/engine/
7. **Backend Server** -- Migrate Express server, routes, middleware, config, and server services into server/
8. **Tests and Final Integration** -- Migrate remaining test files, verify all imports, run full test suite, fix any breakages

## Cross-Milestone Dependencies

- Milestone 2 depends on Milestone 1 (needs dependencies and theme)
- Milestone 3 depends on Milestone 1 (needs Zustand, Supabase deps)
- Milestone 4 depends on Milestones 2 and 3 (practice components use UI primitives and stores)
- Milestone 5 depends on Milestones 2, 3, and 4 (pages compose all prior components)
- Milestone 6 is independent of Milestones 2-5 (engine code is vanilla JS)
- Milestone 7 is independent of Milestones 2-5 (backend is separate)
- Milestone 8 depends on all prior milestones

## Estimated Task Count

23 tasks across 8 milestones.
