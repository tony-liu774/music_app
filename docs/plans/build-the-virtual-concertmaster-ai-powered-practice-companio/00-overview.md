# The Virtual Concertmaster -- AI-Powered Practice Companion

## Goal

Migrate the existing vanilla-JS + Express monolith into a modern **Vite + React + Zustand** frontend application with the "Midnight Conservatory" design system, real-time audio analysis via Web Workers, VexFlow-based sheet music rendering, and AI-powered coaching. The Express backend remains as-is for API routes; the frontend is rebuilt from scratch as a React SPA.

## Current State

The codebase already contains significant working logic in vanilla JS:

- **Audio DSP pipeline** (`src/js/audio/`): pYIN pitch detection, DSP engine with vibrato smoothing, tone quality analysis, articulation detection, volume envelope analysis, scale engine
- **UI components** (`src/js/components/`): sheet music renderer (canvas-based), follow-the-ball cursor, heat map renderer, practice loop, tuner, onboarding, dashboard, annotation canvas, assignment UI, studio dashboard
- **Services** (`src/js/services/`): auth, OAuth, cloud sync, offline session manager, library, LLM, PDF export, annotation, session persistence, push notifications
- **Analysis** (`src/js/analysis/`): session logger, AI summary generator, intonation analyzer, dynamics comparator
- **Backend routes** (`src/routes/`): auth, OAuth, AI, OMR, sync, teacher, license, assignments, notifications, IMSLP, health
- **Styling**: Tailwind CSS v4 with full `@theme` palette in `src/css/app.css` (Midnight Conservatory tokens already defined)
- **Main app**: 3100-line `app.js` monolith class orchestrating everything

The migration strategy is to **wrap existing logic into React components and Zustand stores** rather than rewriting DSP/analysis algorithms. The `@theme` tokens and `app.css` are already Tailwind v4 CSS-first and will carry forward.

## Approach

1. Scaffold a Vite + React project alongside the existing Express backend (dual-entry setup)
2. Build the base component library using existing Midnight Conservatory tokens
3. Port audio DSP to Web Worker architecture with React hooks
4. Build the "Ghost" practice UI with VexFlow sheet music and predictive cursor
5. Integrate AI coaching, analytics, and heat map overlays
6. Add offline support, AudioContext handling, and polish

## Milestones

1. **Environment and Scaffolding** -- Initialize Vite + React alongside Express, configure Tailwind v4 CSS-first, build base UI component library (Buttons, Modals, Nav, Layout) in Midnight Conservatory theme, set up Zustand stores
2. **The Ear -- DSP and Hardware** -- Port audio capture and pitch detection to Web Worker architecture, build React hooks for microphone access with graceful denial handling, implement vibrato filter and continuous session logging
3. **The Ghost Practice UI** -- Build the main practice view with distraction-free fade behavior, integrate VexFlow for MusicXML sheet music rendering, implement predictive amber cursor and intonation needle
4. **AI Coach and Analytics** -- Wire post-session AI coaching via LLM backend, build crimson heat map overlay on sheet music, implement smart loop extraction with tempo reduction
5. **Edge Cases and Offline Support** -- Add offline caching with IndexedDB sync, handle AudioContext suspension, final integration testing and polish

## Cross-Milestone Dependencies

- Milestone 2 depends on Milestone 1 (React scaffolding, Zustand stores, base components)
- Milestone 3 depends on Milestone 1 (layout, nav components) and partially on Milestone 2 (audio hooks for intonation needle)
- Milestone 4 depends on Milestone 2 (session logger data) and Milestone 3 (sheet music renderer for heat map overlay)
- Milestone 5 depends on all prior milestones

## Estimated Task Count

22 tasks across 5 milestones.
