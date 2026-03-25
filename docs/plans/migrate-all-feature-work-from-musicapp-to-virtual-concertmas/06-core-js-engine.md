# Milestone 6: Core JS Engine

## Goal

Migrate the vanilla JavaScript engine modules (audio processing, analysis, parsers, hardware listeners, services, components, and utilities) from `src/js/` into `src/engine/` in virtual-concertmaster.

## Tasks

### Task 6.1: Migrate Audio and Analysis Modules

**Description:** Copy the core audio engine and analysis modules from `src/js/audio/` and `src/js/analysis/` into `src/engine/audio/` and `src/engine/analysis/`. The audio modules include: pitch-detector, dsp-engine, live-audio-tracker, tone-quality-analyzer, scale-engine, articulation-detector, and volume-envelope-analyzer. The analysis modules include: ai-summary-generator, intonation-analyzer, session-logger, and dynamics-comparator. Also copy the metrics module (rhythm-analyzer) and models (scale-data, sheet-music).

**Agent type:** coder

**Subtasks:**
1. Create `src/engine/` directory structure: `audio/`, `analysis/`, `metrics/`, `models/`
2. Copy `src/js/audio/*.js` to `src/engine/audio/`
3. Copy `src/js/analysis/*.js` to `src/engine/analysis/`
4. Copy `src/js/metrics/rhythm-analyzer.js` to `src/engine/metrics/`
5. Copy `src/js/models/*.js` to `src/engine/models/`
6. Update all internal cross-references between engine modules (e.g., `../audio/pitch-detector` stays the same, but verify)
7. Copy corresponding test files from `tests/` (pitch-detector.test.js, dsp-engine.test.js, ai-summary-generator.test.js, intonation-analyzer.test.js, session-logger.test.js, dynamics-comparator.test.js, tone-quality-analyzer.test.js, scale-engine.test.js, volume-envelope-analyzer.test.js, articulation-detector.test.js, musicxml-dynamics.test.js) to `src/engine/__tests__/`
8. Update test file import paths to reference `../audio/`, `../analysis/`, etc.
9. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- All audio and analysis modules exist in `src/engine/`
- Internal cross-references resolve correctly
- Engine test files are present and import paths are updated

**Dependencies:** None (engine code is vanilla JS with no React dependencies)

---

### Task 6.2: Migrate Engine Services, Components, Parsers, and Utilities

**Description:** Copy the remaining engine modules: `src/js/services/` (17 service files including auth, cloud-sync, library, IMSLP, annotation, assignment, license, LLM, OAuth, offline, OMR, onboarding, push notification, session persistence, teacher, video), `src/js/components/` (17 UI controller files), `src/js/parsers/` (MusicXML parser and generator), `src/js/hardware/` (Bluetooth HID listener), and `src/js/utils/` (accessibility manager, performance optimizer).

**Agent type:** coder

**Subtasks:**
1. Copy `src/js/services/*.js` to `src/engine/services/`
2. Copy `src/js/components/*.js` to `src/engine/components/`
3. Copy `src/js/parsers/*.js` to `src/engine/parsers/`
4. Copy `src/js/hardware/*.js` to `src/engine/hardware/`
5. Copy `src/js/utils/*.js` to `src/engine/utils/`
6. Copy `src/js/app.js` to `src/engine/app.js`
7. Update all internal import paths across copied files
8. Copy remaining test files from `tests/` that correspond to these modules to `src/engine/__tests__/`
9. Update test import paths
10. Changes must be on a feature branch with a GitHub PR created via `gh pr create`

**Acceptance criteria:**
- All engine service, component, parser, hardware, and utility modules exist under `src/engine/`
- Internal cross-references resolve correctly
- Corresponding test files are present with updated paths

**Dependencies:** Task 6.1 (some services reference audio/analysis modules)
