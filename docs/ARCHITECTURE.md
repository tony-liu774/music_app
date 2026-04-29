# Architecture Analysis: Vanilla JS vs React

**Date:** 2026-04-29
**Status:** Documented

## Executive Summary

The Virtual Concertmaster currently operates as **two parallel frontend applications** with significant duplication:

1. **Vanilla JS App** (production) - Full-featured app using ES modules and DOM manipulation
2. **React Client** (in development) - Modern SPA using React 19, Zustand, and Vite

This document analyzes both architectures and recommends a migration strategy.

---

## Current Architecture

### 1. Vanilla JS Application (`src/`)

**Entry Point:** `index.html` (root)

**Characteristics:**
- Uses ES6 modules via `<script type="module">` tags
- Direct DOM manipulation via class-based components
- Custom `ConcertmasterApp` class orchestrates all modules
- Auth: Custom JWT tokens via `AuthService`
- No centralized state management
- Server: Express.js (`src/index.js`)

**Key Directories:**
```
src/
├── js/
│   ├── app.js              # Main app orchestration
│   ├── audio/              # Web Audio API, pitch detection
│   ├── services/           # Business logic (auth, library, etc.)
│   ├── components/         # UI components (dashboard-ui, tuner, etc.)
│   ├── analysis/           # Performance analysis (intonation, rhythm)
│   └── models/             # Data models (sheet-music)
├── routes/                 # Express API routes
├── middleware/             # Express middleware
└── config/                # Configuration
```

### 2. React Client Application (`client/`)

**Entry Point:** `client/index.html`

**Characteristics:**
- Vite-powered React 19 SPA
- Zustand for state management
- React Router v7 with HashRouter
- Supabase for authentication
- Component-based architecture
- React hooks for audio pipeline

**Key Directories:**
```
client/src/
├── App.jsx                 # Main React app
├── pages/                  # Route pages (Dashboard, Practice, etc.)
├── components/             # React components
│   ├── ui/                 # Base UI components
│   ├── practice/           # Practice-specific components
│   ├── tuner/              # Tuner components
│   └── auth/               # Auth components
├── hooks/                  # Custom React hooks
├── stores/                 # Zustand stores
├── services/               # API clients
├── contexts/               # React contexts
└── workers/               # Web Workers (DSP)
```

---

## Duplicate Components Analysis

### Audio Pipeline (CRITICAL - No Migration Recommended)

| Feature | Vanilla JS | React |
|---------|------------|-------|
| Pitch Detection | `src/js/audio/pitch-detector.js` | `client/src/hooks/useAudioPipeline.js` |
| DSP Engine | `src/js/audio/dsp-engine.js` | `client/src/workers/dsp-worker.js` |
| Audio Engine | `src/js/audio/audio-engine.js` | `client/src/services/AudioEngine.js` |

**Verdict:** Keep vanilla JS DSP engine. It handles complex audio processing that doesn't benefit from React's virtual DOM.

### Tuner

| Feature | Vanilla JS | React |
|---------|------------|-------|
| Tuner Logic | `src/js/components/tuner.js` | `client/src/components/tuner/` |
| Gauge | `src/js/components/tuner-gauge.js` | `client/src/components/tuner/TunerGauge.jsx` |

**Verdict:** Migrate UI layer to React while keeping audio processing in vanilla JS.

### Authentication

| Feature | Vanilla JS | React |
|---------|------------|-------|
| Auth Service | `src/js/services/auth-service.js` | `client/src/contexts/AuthContext.jsx` |
| OAuth | `src/js/services/oauth-service.js` | Supabase Auth |

**Verdict:** Major conflict - two different auth systems. React uses Supabase; Vanilla JS uses custom JWT.

**Recommendation:** Consolidate on Supabase Auth for both, migrate vanilla JS auth to use Supabase.

### Dashboard

| Feature | Vanilla JS | React |
|---------|------------|-------|
| Dashboard | `src/js/components/dashboard-ui.js` | `client/src/pages/Dashboard.jsx` |

**Verdict:** Migrate to React completely. React's component model is better for this UI.

### Sheet Music

| Feature | Vanilla JS | React |
|---------|------------|-------|
| Renderer | `src/js/components/sheet-music-renderer.js` | `client/src/components/practice/SheetMusic.jsx` |

**Verdict:** React wrapper is a thin layer. Consolidate by keeping one implementation.

### Services (Partial Overlap)

| Vanilla JS | React |
|------------|-------|
| `auth-service.js` | `AuthContext.jsx` (Supabase) |
| `library-service.js` | `LibraryService.js` |
| `imslp-client.js` | `IMSLPClient.js` |
| `onboarding-service.js` | N/A |
| `assignment-service.js` | `AssignmentService.js` |

---

## Runtime Architecture

### How They Work Currently

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  ROOT index.html                                     │    │
│  │  (Vanilla JS App - Production)                       │    │
│  │                                                       │    │
│  │  - Loaded via <script> tags                         │    │
│  │  - ConcertmasterApp class orchestrates                │    │
│  │  - Direct DOM manipulation                           │    │
│  │  - Web Audio API for pitch detection                 │    │
│  │                                                       │    │
│  │  ⚠️ NOT LOADED when using React client              │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  CLIENT/ index.html                                  │    │
│  │  (React App - In Development)                        │    │
│  │                                                       │    │
│  │  - Vite bundles React + dependencies                 │    │
│  │  - Mounts to <div id="root">                         │    │
│  │  - Uses Supabase for auth                           │    │
│  │  - Own audio pipeline via Web Workers                │    │
│  │                                                       │    │
│  │  ⚠️ NOT LOADED when using vanilla JS app            │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Serving Architecture

**Express Server** (`src/index.js`):
- Serves static files from root directory (`app.use(express.static(...))`)
- API routes: `/api/auth/*`, `/api/teacher/*`, `/api/omr/*`, etc.
- The React client needs its own build step to be served

---

## Migration Strategy Recommendation

### Chosen Strategy: **Option B - Micro-frontend Split**

**Rationale:** The audio pipeline (pitch detection, DSP) is performance-critical and already working well in vanilla JS. Migrating it to React offers no benefits and introduces unnecessary complexity.

### Architecture After Migration

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React SPA (Main Shell)                              │   │
│  │                                                       │   │
│  │  - App routing (React Router)                        │   │
│  │  - UI state (Zustand stores)                        │   │
│  │  - Auth UI (Login, Settings)                        │   │
│  │  - Dashboard, Library pages                          │   │
│  │  - Components: Button, Modal, Toast, etc.           │   │
│  │                                                       │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │  Vanilla JS Audio Engine (Embedded)           │   │   │
│  │  │                                                │   │   │
│  │  │  - PitchDetector (pYIN algorithm)             │   │   │
│  │  │  - DSP Engine (Vibrato detection)             │   │   │
│  │  │  - Tone Quality Analyzer                      │   │   │
│  │  │  - AudioContext management                    │   │   │
│  │  │                                                │   │   │
│  │  │  Exposed via window.VirtualConcertmaster     │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  │                                                       │   │
│  │  ┌───────────────────────────────────────────────┐   │   │
│  │  │  React UI Layer for Audio                    │   │   │
│  │  │                                                │   │   │
│  │  │  - TunerDisplay (reads from engine)          │   │   │
│  │  │  - TunerGauge                                 │   │   │
│  │  │  - SheetMusic (VexFlow integration)           │   │   │
│  │  │  - HeatMapOverlay                             │   │   │
│  │  └───────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Migration Phases

#### Phase 1: Consolidate Auth (High Priority)
- Migrate vanilla JS `AuthService` to use Supabase
- Update all vanilla JS services to use Supabase tokens
- Remove custom JWT implementation from `src/js/services/auth-service.js`

#### Phase 2: Extract Audio Engine
- Bundle vanilla JS audio modules into a single bundle
- Expose via `window.VirtualConcertmaster` global
- Document the API interface

#### Phase 3: React Integration Layer
- Create React hooks that wrap the vanilla JS audio engine
- `useAudioPipeline()` already exists - verify it uses the shared engine
- Migrate tuner UI to use React components reading from engine

#### Phase 4: UI Component Migration
- Migrate Dashboard, Library, Settings to React
- Remove corresponding vanilla JS components
- Keep Practice loop components in vanilla JS (they're tightly coupled to audio)

#### Phase 5: Deprecate Vanilla JS App Shell
- Once all pages are in React, deprecate `index.html` vanilla JS app
- Keep audio engine bundle for reuse

### What NOT to Migrate

1. **DSP Engine** (`src/js/audio/dsp-engine.js`) - Core audio processing
2. **Pitch Detector** (`src/js/audio/pitch-detector.js`) - Complex algorithm
3. **Tone Quality Analyzer** (`src/js/audio/tone-quality-analyzer.js`) - Specialized DSP
4. **Volume Envelope Analyzer** - DSP specialist work
5. **Articulation Detector** - Audio analysis

### What TO Migrate

1. **All UI Components** - React is better for component composition
2. **Routing** - React Router
3. **State Management** - Zustand stores
4. **API Services** - Can be shared or migrated to React Query patterns
5. **Auth** - Consolidate on Supabase

---

## Risks and Considerations

### Risk 1: Dual Auth Systems
Currently, vanilla JS uses custom JWT while React uses Supabase. This must be resolved first.

**Mitigation:** Migrate vanilla JS to Supabase before any other work.

### Risk 2: Audio Pipeline Compatibility
The vanilla JS and React audio pipelines have separate DSP worker implementations.

**Mitigation:** Extract a shared DSP worker bundle that both can use.

### Risk 3: Code Duplication
Significant effort required to eliminate duplicated logic.

**Mitigation:** Use this document as a guide; track migration progress.

---

## Files Reference

### Vanilla JS (to be migrated away from)
- `src/js/app.js` - Main orchestration
- `src/js/components/*.js` - UI components
- `src/js/services/auth-service.js` - Custom JWT auth

### Vanilla JS (to be preserved/embedded)
- `src/js/audio/` - All audio processing
- `src/js/analysis/` - Performance analysis

### React (target architecture)
- `client/src/` - All React components, hooks, stores
- `client/src/services/` - API clients
- `client/src/workers/` - Shared DSP worker

---

## Conclusion

**Option B (Micro-frontend Split)** is recommended because:

1. **Performance:** DSP engine must stay in vanilla JS for optimal audio performance
2. **Preserves Investment:** Existing vanilla JS audio code is battle-tested
3. **Modern UI:** React provides better developer experience for UI components
4. **Gradual Migration:** Can migrate page-by-page without big-bang rewrite
5. **Shared Resources:** Both apps use the same API backend

This approach respects the existing architecture while setting a clear path to a modern, maintainable codebase.
