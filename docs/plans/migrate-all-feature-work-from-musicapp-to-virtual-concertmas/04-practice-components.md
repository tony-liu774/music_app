# Milestone 4: Practice Components

## Goal

Migrate the core practice session UI -- the heart of the application -- including sheet music rendering, real-time intonation feedback, predictive cursor, heat map overlay, coach debrief, smart loop, and all supporting hooks and workers.

## Tasks

### Task 4.1: Migrate Practice Hooks and Workers

**Description:** Copy all practice-related hooks from `client/src/hooks/` and the DSP Web Worker files from `client/src/workers/` into virtual-concertmaster. These hooks provide the audio pipeline, microphone access, pitch detection bridge, score management, predictive cursor logic, heat map data processing, session logging, smart loop state, and audio context suspension handling.

**Agent type:** coder

**Subtasks:**
1. Copy all hook files from `client/src/hooks/` to `src/hooks/` (replacing any stubs from Milestone 2): useAudioPipeline, useMicrophone, usePredictiveCursor, useHeatMapData, useScore, useScoreCache, useSessionLogger, useSmartLoop, useAudioContextSuspension, useOffline
2. Copy all hook test files from `client/src/hooks/__tests__/` to `src/hooks/__tests__/`
3. Copy `client/src/workers/` directory (dsp-core.js, dsp-worker.js, dsp-worker-protocol.js) to `src/workers/`
4. Copy worker test files from `client/src/workers/__tests__/` to `src/workers/__tests__/`
5. Copy `client/src/lib/SessionLogger.js` to `src/lib/SessionLogger.js` and its test
6. Copy `client/src/constants/scoreLayout.js` to `src/constants/scoreLayout.js`
7. Update all import paths throughout copied files
8. Run hook and worker tests
9. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- All 10 hooks exist in `src/hooks/` with correct exports
- DSP worker files exist in `src/workers/`
- SessionLogger and scoreLayout constants are in place
- Hook and worker tests pass

**Dependencies:** Task 3.2 (hooks use Zustand stores), Task 1.3 (test setup)

---

### Task 4.2: Migrate Practice UI Components

**Description:** Copy all 8 practice components from `client/src/components/practice/` into `src/components/practice/`: SheetMusic (VexFlow notation renderer), IntonationNeedle (real-time pitch gauge), PracticeControls (play/pause/stop toolbar), PredictiveCursor (follow-the-ball amber cursor), HeatMapOverlay (red heat map over sheet music), CoachDebrief (AI coaching summary panel), SmartLoop (deliberate practice loop UI), and AudioSuspensionOverlay (browser autoplay policy handler).

**Agent type:** coder

**Subtasks:**
1. Copy all component files from `client/src/components/practice/` to `src/components/practice/`
2. Copy all test files from `client/src/components/practice/__tests__/` to `src/components/practice/__tests__/`
3. Update imports for hooks (now at `../../hooks/`), stores (`../../stores/`), UI components (`../ui/`), and services (`../../services/`)
4. For services not yet migrated (AISummaryService), create a stub with TODO comment
5. Run practice component tests with `npx vitest run src/components/practice`
6. Fix any failing tests
7. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- All 8 practice components exist in `src/components/practice/`
- Components import hooks and stores correctly
- Practice component tests pass
- VexFlow sheet music rendering is functional

**Dependencies:** Task 4.1 (practice components use hooks), Task 2.1 (use UI primitives)

---

### Task 4.3: Migrate Client Services

**Description:** Copy the 5 client-side service modules from `client/src/services/` into `src/services/`: AISummaryService (AI coaching debrief generation), IMSLPClient (IMSLP score search proxy), LibraryService (score library management), MusicXMLParser (MusicXML to internal model), and OfflineManager (offline data caching with IndexedDB). Replace any stubs created in prior milestones.

**Agent type:** coder

**Subtasks:**
1. Copy all service files from `client/src/services/` to `src/services/`
2. Copy service test files from `client/src/services/__tests__/` to `src/services/__tests__/`
3. Update import paths (references to stores, lib/supabase, etc.)
4. Remove any service stubs created in prior milestones
5. Run service tests with `npx vitest run src/services`
6. Fix any failing tests
7. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- All 5 services exist in `src/services/`
- Service tests pass
- All prior service stubs are replaced with real implementations

**Dependencies:** Task 3.1 (services use Supabase client), Task 3.2 (services use stores)
