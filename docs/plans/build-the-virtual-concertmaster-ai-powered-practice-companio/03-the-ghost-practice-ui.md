# Milestone 3: The Ghost Practice UI

## Goal

Build the main practice view with the signature "Ghost" behavior -- menus fade to invisible during play, leaving only sheet music and subtle feedback. Integrate VexFlow for MusicXML rendering, implement the predictive amber cursor, and build the "Breath" intonation needle.

## Scope

- Practice view layout with fade-to-ghost behavior (menus fade to `opacity-0` over 500ms)
- VexFlow-based sheet music rendering from MusicXML
- Predictive cursor: glowing amber ball tracking position on the score
- Intonation needle: invisible at correct pitch, appears on drift
- Practice controls: play/pause, tempo adjustment, measure selection

---

### Task 1: Practice View Layout and Ghost Mode

**Description:** Build the main practice view that implements the "Ghost" distraction-free behavior. When practice starts, all navigation and non-essential UI fades to `opacity-0` over 500ms, leaving only the sheet music and subtle feedback elements. UI reappears on pause or stop.

**Agent type:** coder

**Depends on:** Milestone 1 / Task 4 (Navigation and Layout Shell), Milestone 1 / Task 5 (Zustand Store Architecture)

**Subtasks:**
1. Create `client/src/pages/PracticePage.jsx` -- full-height practice view with sheet music area (80% height) and controls bar (bottom 20%)
2. Create `client/src/components/practice/PracticeControls.jsx` -- play/pause button (large, centered, amber), stop button, tempo slider (50-200 BPM), metronome toggle
3. Implement ghost mode in `useUIStore`: when `isPracticing` becomes true, set `navVisible: false`. Wire `AppShell` to apply `transition-opacity duration-500` and `opacity-0 pointer-events-none` to nav elements based on this state
4. Add a subtle "tap anywhere to show controls" overlay that briefly appears when controls are hidden
5. Practice controls bar also fades but reappears on touch/mouse movement with a 3-second auto-hide timer
6. Ensure keyboard shortcuts work even in ghost mode: Space (play/pause), Escape (stop and exit ghost mode)

**Acceptance criteria:**
- Starting practice fades nav out over 500ms, stopping brings it back
- Sheet music takes full viewport during ghost mode
- Controls reappear on mouse movement and auto-hide after 3 seconds
- Space and Escape keyboard shortcuts work at all times
- No layout shift when transitioning in/out of ghost mode
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 2: VexFlow Sheet Music Renderer

**Description:** Integrate VexFlow to render sheet music from MusicXML data. Port and upgrade the existing canvas-based `sheet-music-renderer.js` to use VexFlow's proper notation engine within a React component.

**Agent type:** coder

**Depends on:** Milestone 3 / Task 1 (Practice View Layout and Ghost Mode), Milestone 1 / Task 5 (Zustand Store Architecture)

**Subtasks:**
1. Create `client/src/components/practice/SheetMusic.jsx` -- React wrapper around a VexFlow `Renderer` attached to an SVG element (prefer SVG over canvas for crisp scaling)
2. Create `client/src/services/MusicXMLParser.js` -- port and adapt the existing `src/js/parsers/musicxml-parser.js` to output VexFlow-compatible note data (stave notes, time signatures, key signatures, dynamics)
3. Implement score layout: render measures across multiple systems (lines), handle line breaks, show clef and key signature at start of each system
4. Support instrument-specific clefs: treble (violin), alto (viola), bass (cello), bass (double bass with transposition)
5. Ensure the SVG element has explicit `max-w-full max-h-[70vh]` classes to prevent overflow
6. Add horizontal scroll for long scores, with current measure always visible
7. Style VexFlow output to match Midnight Conservatory: ivory note heads on oxford-blue background, amber for highlighted elements
8. Create `client/src/hooks/useScore.js` -- hook to load, parse, and cache MusicXML scores from the library

**Acceptance criteria:**
- MusicXML files render correctly as proper music notation via VexFlow
- Notes, rests, time signatures, key signatures, and dynamics display correctly
- Score scrolls horizontally for long pieces, keeping current position in view
- All notation is legible on the dark background (ivory on oxford-blue)
- SVG element is bounded and does not overflow its container
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 3: Predictive Cursor (Follow the Ball)

**Description:** Implement the glowing amber ball that tracks the current position on the sheet music during practice. Port and enhance the existing `follow-the-ball.js` to work with the VexFlow-rendered score and React state.

**Agent type:** coder

**Depends on:** Milestone 3 / Task 2 (VexFlow Sheet Music Renderer), Milestone 2 / Task 2 (Web Worker Pitch Detection Pipeline)

**Subtasks:**
1. Create `client/src/components/practice/PredictiveCursor.jsx` -- an absolutely positioned amber circle element that overlays the VexFlow SVG
2. Port position calculation logic from `src/js/components/follow-the-ball.js`: map the current beat position to an (x, y) coordinate on the rendered score
3. Use `requestAnimationFrame` for smooth 60fps cursor movement between notes
4. Apply the amber glow effect: `shadow-amber-glow` with a subtle pulsing animation synced to tempo
5. Implement predictive scrolling: when the cursor approaches the right edge, smooth-scroll the score to the next system
6. Support tempo-based advance (metronome mode) and pitch-based advance (detected note triggers advance)
7. Expose cursor position to audio store so the session logger knows which measure/beat is current

**Acceptance criteria:**
- Amber ball smoothly tracks across the score at the correct tempo
- Ball glows with amber shadow effect and pulses subtly with the beat
- Score automatically scrolls to keep the cursor visible
- Cursor position is accurately reflected in the audio store
- Animation is smooth at 60fps with no stuttering during audio processing
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 4: Breath Intonation Needle

**Description:** Build the "Breath" intonation needle -- a subtle visual indicator that is invisible when the player is in tune (within 10 cents) and smoothly appears with color feedback when intonation drifts.

**Agent type:** coder

**Depends on:** Milestone 2 / Task 2 (Web Worker Pitch Detection Pipeline), Milestone 2 / Task 3 (Vibrato Filter and Smoothing), Milestone 3 / Task 1 (Practice View Layout and Ghost Mode)

**Subtasks:**
1. Create `client/src/components/practice/IntonationNeedle.jsx` -- a thin vertical or arc-shaped indicator positioned near the sheet music
2. Subscribe to `useAudioStore` for smoothed cents deviation (post-vibrato-filter)
3. Implement visibility thresholds: fully invisible (`opacity-0`) at 0-10 cents deviation, gradually appearing from 10-25 cents, fully visible at 25+ cents
4. Color transitions: emerald tint when correcting back toward center, crimson when drifting further away. Use `transition-colors duration-300` for smooth color changes
5. Apply glow effects: `shadow-emerald-glow` for correction, `shadow-crimson-glow` for drift
6. Position the needle relative to the current cursor position so feedback is spatially connected to the note being played
7. Ensure the needle does not cause layout reflow -- use absolute positioning and opacity/transform only (GPU-composited properties)

**Acceptance criteria:**
- Needle is completely invisible when player is within 10 cents of correct pitch
- Needle smoothly appears and turns crimson when drifting sharp or flat
- Needle glows emerald when the player corrects their intonation
- No layout reflow or jank from needle visibility changes
- Needle position tracks with the predictive cursor
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 5: Score Library Browser

**Description:** Build the score library page where users browse, search, and select pieces for practice. Integrate with the existing library service and IMSLP client for score discovery.

**Agent type:** coder

**Depends on:** Milestone 1 / Task 3 (Base UI Component Library), Milestone 1 / Task 4 (Navigation and Layout Shell), Milestone 1 / Task 5 (Zustand Store Architecture)

**Subtasks:**
1. Create `client/src/pages/LibraryPage.jsx` -- grid/list view of available scores with search bar and instrument filter
2. Create `client/src/components/library/ScoreCard.jsx` -- card showing piece title, composer, instrument, difficulty, thumbnail preview
3. Port `src/js/services/library-service.js` into `client/src/services/LibraryService.js` -- adapt to work with React/Zustand
4. Port `src/js/services/imslp-client.js` for searching IMSLP public domain scores
5. Wire to `useLibraryStore` for search/filter state and score list
6. "Start Practice" button on score detail navigates to practice view with the selected score loaded
7. Support sorting by: recently practiced, composer, title, difficulty

**Acceptance criteria:**
- Library page displays available scores in a responsive grid
- Search filters scores by title and composer in real time
- Instrument filter shows only scores for the selected instrument
- Selecting a score and tapping "Practice" navigates to the practice view with that score loaded
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`
