# Virtual Concertmaster - Application Architecture

## Overview

The Virtual Concertmaster is a music practice application for bowed string instruments. The codebase currently contains **two frontend implementations** in active development:

1. **Vanilla JS App** (`src/` + root `index.html`) - The original production app
2. **React App** (`client/`) - The new React-based frontend being actively developed

---

## Architecture Decision: Option C - Progressive Migration

**Chosen Strategy: Progressive Migration**

The React app (`client/`) is being developed as a **gradual port** of the vanilla JS app. This approach allows:

- Incremental migration of features without disrupting production
- Parallel development of both codebases
- Shared core logic where beneficial
- Future consolidation when migration is complete

---

## Current State

### Vanilla JS App (Production)
**Location:** `src/` + root `index.html`

- **Entry Point:** `index.html` with `<script src="src/js/app.js"></script>`
- **Server:** Express (`src/index.js`) serves static files and API routes
- **Audio Processing:** Custom JS classes in `src/js/audio/` (PitchDetector, DSPEngine, etc.)
- **UI:** Vanilla JS DOM manipulation in `src/js/components/`
- **Services:** Backend API calls in `src/js/services/`

### React App (In Development)
**Location:** `client/`

- **Entry Point:** `client/index.html` with `<div id="root">`
- **Build Tool:** Vite (dev server proxies `/api` to Express)
- **Audio Processing:** Web Worker-based DSP in `client/src/workers/`
- **UI:** React components in `client/src/components/`
- **State:** Zustand stores in `client/src/stores/`

---

## Directory Structure

```
music_app/
├── index.html              # Vanilla JS app entry (served at /)
├── src/
│   ├── index.js           # Express server
│   ├── js/
│   │   ├── app.js         # ConcertmasterApp (main vanilla JS orchestrator)
│   │   ├── audio/         # Pitch detection, DSP, audio analysis
│   │   ├── components/    # Vanilla JS UI components
│   │   ├── services/      # API clients, business logic
│   │   ├── analysis/      # Session logging, intonation analysis
│   │   └── parsers/       # MusicXML parsing
│   ├── routes/            # Express API routes
│   ├── middleware/        # Express middleware
│   └── services/         # Backend services
├── client/
│   ├── index.html        # React app entry (separate dev server)
│   ├── src/
│   │   ├── main.jsx      # React entry point
│   │   ├── App.jsx       # React router setup
│   │   ├── components/   # React UI components
│   │   ├── pages/        # Route pages (Dashboard, Practice, etc.)
│   │   ├── stores/       # Zustand state management
│   │   ├── hooks/        # Custom React hooks
│   │   ├── services/     # React service layer (ported from src/)
│   │   ├── workers/      # Web Worker for DSP
│   │   └── lib/         # Utilities (SessionLogger re-export, Supabase)
│   └── vite.config.js   # Vite bundler config
└── docs/
    └── ARCHITECTURE.md   # This file
```

---

## Code Sharing & Porting

The React app has been **selectively ported** from vanilla JS:

### Direct Imports (Shared Code)
- `client/src/lib/SessionLogger.js` - ESM re-export of `src/js/analysis/session-logger.js`

### Ported Code (With Attribution)
The following files were ported from vanilla JS with comments noting the origin:

| React File | Vanilla JS Source | Notes |
|------------|------------------|-------|
| `components/tuner/TunerGauge.jsx` | `src/js/components/tuner-gauge.js` | UI port |
| `hooks/useSmartLoop.js` | `src/js/components/practice-loop.js` | Enhanced |
| `services/MusicXMLParser.js` | `src/js/parsers/musicxml-parser.js` | Adapted |
| `services/IMSLPClient.js` | `src/js/services/imslp-client.js` | Ported |
| `services/LibraryService.js` | `src/js/services/library-service.js` | Zustand version |
| `services/OfflineManager.js` | `src/js/services/offline-session-manager.js` | Extended |

### Independent Implementations
The React app has its own implementations for:
- **Audio Pipeline:** Uses Web Worker (`client/src/workers/dsp-worker.js`) instead of vanilla JS classes
- **State Management:** Zustand stores instead of class-based state
- **Routing:** React Router instead of hash-based navigation
- **Auth:** React Context + Supabase instead of vanilla auth service

---

## Runtime Architecture

### Production Mode (Vanilla JS)
```
User → Express (port 3000) → Serves index.html + src/js/app.js
                              ↓
                        Vanilla JS App runs
                        - Audio via src/js/audio/*
                        - UI via src/js/components/*
```

### Development Mode (React)
```
React Dev Server (Vite, port 5173) → Proxies /api to Express (port 3000)
       ↓
React SPA loads
- Audio via Web Workers
- UI via React components
```

---

## Duplicate Functionality

### Existing Duplications

| Feature | Vanilla JS | React |
|---------|-----------|-------|
| Pitch Detection | `PitchDetector` class | Web Worker DSP (`dsp-worker.js`) |
| Session Logging | `SessionLogger` class | Imports from vanilla (shared) |
| Practice Loop | `PracticeLoopController` | `useSmartLoop` hook |
| Tuner UI | `TunerGauge` component | `TunerGauge.jsx` component |
| Sheet Music | `SheetMusicRenderer` | VexFlow-based React component |
| Authentication | `auth-service.js` | `AuthContext` + Supabase |
| Library | `library-service.js` | `LibraryService.js` |

---

## Migration Status

| Feature | Status | Notes |
|---------|--------|-------|
| Routing/Navigation | ✅ Ported | React Router |
| Dashboard | ✅ Ported | React components |
| Library | ✅ Ported | LibraryService + Zustand |
| Practice View | ✅ Ported | PracticePage + hooks |
| Tuner | ✅ Ported | TunerDisplay + TunerGauge |
| Audio Pipeline | ✅ Ported | Web Worker DSP |
| Settings | ✅ Ported | useSettingsStore |
| Studio Dashboard | ✅ Ported | React page |
| Teacher Mode | 🔄 Partial | In progress |
| Full Integration | ⏳ Pending | Not deployed to production |

---

## Recommendation

The current **Progressive Migration (Option C)** strategy should continue:

1. **Keep both codebases** - The vanilla JS app remains the production app while React development continues
2. **Share core logic** - Continue importing shared modules where it makes sense
3. **Document bridge points** - Mark all ports with comments noting the source
4. **Migrate feature-by-feature** - Each feature is complete when:
   - All vanilla JS functionality is replicated
   - Tests pass in React app
   - No production dependencies on vanilla JS for that feature

---

## Future State (Post-Migration)

When migration is complete:
1. React app becomes the primary/only frontend
2. `src/` may be deprecated or moved to `/legacy/`
3. Express server (`src/index.js`) continues to serve API routes
4. Shared utilities may be extracted to a `packages/shared/` directory
