# Milestone 5: Edge Cases and Offline Support

## Goal

Harden the application for real-world usage: add offline caching with IndexedDB sync-on-reconnect, handle AudioContext suspension properly, build the tuner and settings pages, and perform final integration testing and polish.

## Scope

- Offline mode: cache score library and track DSP data in IndexedDB, sync when reconnected
- AudioContext suspension handling (auto-resume on first user interaction)
- Tuner page (standalone, outside practice mode)
- Settings page (instrument selection, tuning reference, sensitivity)
- Final integration testing across the full practice flow

---

### Task 1: Offline Caching and Sync

**Description:** Port the existing `offline-session-manager.js` into the React app and extend it to cache the score library, session data, and queue API calls for sync when the connection is restored.

**Agent type:** coder

**Depends on:** Milestone 2 / Task 4 (Session Logger Integration), Milestone 3 / Task 5 (Score Library Browser)

**Subtasks:**
1. Port `src/js/services/offline-session-manager.js` into `client/src/services/OfflineManager.js` -- adapt IndexedDB operations to work with React lifecycle
2. Create `client/src/hooks/useOffline.js` -- hook that tracks online/offline status via `navigator.onLine` and `online`/`offline` events, exposes status to UI store
3. Implement score library caching: on first load, cache all score metadata and MusicXML data to IndexedDB. On subsequent loads, serve from cache if offline
4. Implement session data queuing: when offline, queue session logs and AI debrief requests in IndexedDB. When back online, process the queue in order
5. Add a subtle offline indicator in the nav bar (ivory-dim "Offline" badge) when disconnected
6. Port the service worker from `sw.js` to cache static assets for the new Vite/React build output — note the existing `sw.js` cache list references vanilla JS paths and must be updated to match `client/dist/` asset hashes and paths
7. Handle conflict resolution: if a session was logged both offline and synced by another device, use timestamp-based last-write-wins

**Acceptance criteria:**
- App launches and displays cached scores when fully offline
- Practice sessions complete fully offline with all data stored in IndexedDB
- On reconnection, queued data syncs automatically with a brief toast confirmation
- Offline indicator appears/disappears correctly based on connection status
- No data loss when transitioning between online and offline states
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 2: AudioContext Suspension Handling

**Description:** Handle the browser AudioContext suspension policy correctly. Browsers require a user gesture before audio can play. Ensure the AudioContext is created suspended and resumed on the first user interaction, with clear UI feedback.

**Agent type:** coder

**Depends on:** Milestone 2 / Task 2 (Web Worker Pitch Detection Pipeline)

**Subtasks:**
1. Update `useAudioPipeline` hook to create AudioContext in a suspended state initially
2. Add a one-time "Tap to Enable Audio" overlay that appears if AudioContext is suspended when practice starts
3. On first user interaction (click/tap/keypress), call `audioContext.resume()` and dismiss the overlay
4. Handle the case where AudioContext becomes suspended mid-session (e.g., tab goes to background on mobile): detect the `statechange` event, pause the session, show a "Tap to Resume" prompt
5. Update the audio store with AudioContext state (suspended/running/closed) for UI awareness
6. Test on iOS Safari where AudioContext policies are strictest

**Acceptance criteria:**
- AudioContext resumes correctly on first user interaction
- If AudioContext suspends mid-session, the app gracefully pauses and prompts the user
- No silent failures where the app appears to be recording but AudioContext is actually suspended
- Works on iOS Safari, Chrome, and Firefox
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 3: Tuner Page

**Description:** Build a standalone tuner page accessible from the nav bar, separate from the practice view. Port the existing tuner component with its gauge visualization.

**Agent type:** coder

**Depends on:** Milestone 2 / Task 2 (Web Worker Pitch Detection Pipeline), Milestone 1 / Task 3 (Base UI Component Library)

**Subtasks:**
1. Create `client/src/pages/TunerPage.jsx` -- full-screen tuner view with large note name display, cents deviation gauge, and frequency readout
2. Port `src/js/components/tuner.js` and `src/js/components/tuner-gauge.js` into React components: `TunerDisplay.jsx` and `TunerGauge.jsx`
3. Style the gauge with Midnight Conservatory theme: amber needle, emerald zone for in-tune (within 5 cents), crimson zones for sharp/flat
4. Display detected note name in large Playfair Display font, frequency in smaller Source Sans 3 below
5. Add instrument string reference pitches: show the 4 (or 5) open string reference notes for the selected instrument
6. Reuse the `useAudioPipeline` hook for pitch detection (same Web Worker, different UI)
7. All gauge SVG elements must have `max-w` and `max-h` classes

**Acceptance criteria:**
- Tuner accurately displays the detected note and cents deviation
- Gauge moves smoothly in response to pitch changes
- In-tune zone is clearly indicated with emerald coloring
- Open string references are shown for the selected instrument
- Tuner reuses the same audio pipeline as practice mode
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 4: Settings Page

**Description:** Build the settings page with instrument selection, tuning reference, sensitivity controls, and account management. Ensure settings propagate correctly to all dependent systems (tuner, sheet music renderer, DSP engine).

**Agent type:** coder

**Depends on:** Milestone 1 / Task 3 (Base UI Component Library), Milestone 1 / Task 6 (Supabase Auth Integration)

**Subtasks:**
1. Create `client/src/pages/SettingsPage.jsx` with sections: Instrument (violin/viola/cello/double bass), Tuning Reference (A4 = 440Hz, adjustable 430-450), Sensitivity (confidence threshold 0.7-0.95), Display (cursor speed, needle sensitivity), Account (linked to Supabase auth — show user email, sign out button)
2. Create `client/src/stores/useSettingsStore.js` — Zustand store for all user preferences with localStorage persistence
3. Persist all settings to localStorage and sync to Zustand settings store
4. Ensure instrument selection propagates to: tuner reference strings, clef in sheet music renderer, DSP engine frequency ranges
5. Style all form controls (sliders, dropdowns, radio groups) with Midnight Conservatory theme

**Acceptance criteria:**
- Settings page allows configuration of all key parameters
- Settings persist across page reloads via localStorage
- Instrument changes propagate correctly to tuner, sheet music, and DSP systems
- Account section shows current user info from Supabase auth
- No hardcoded hex codes in the settings page
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 5: End-to-End Integration Testing

**Description:** Perform comprehensive integration testing across the full practice flow and verify all systems work together: library selection → practice with ghost mode → AI debrief → heat map → smart loop. Includes performance audit and offline verification.

**Agent type:** coder

**Depends on:** All prior milestones and tasks (Task 1-4 in this milestone)

**Subtasks:**
1. Integration test: walk through full flow from library → select score → start practice → play for 30 seconds → stop → view AI debrief → view heat map → start smart loop → exit
2. Verify ghost mode fade works end-to-end: nav fades on play, reappears on stop
3. Verify offline: disable network, practice a cached score, re-enable, verify sync
4. Performance audit: ensure main thread stays at 60fps during practice with Web Worker DSP active (use Chrome DevTools Performance tab)
5. Verify AudioContext suspension handling across browsers (Chrome, Firefox, Safari)
6. Verify Supabase auth flow: login → protected routes → session persistence → logout
7. Verify the existing `sw.js` service worker correctly caches the new Vite build output paths (update service worker cache list if needed for the new `client/dist/` asset structure)
8. Fix any integration bugs found during testing

**Acceptance criteria:**
- Full practice flow works end-to-end without errors
- Ghost mode transitions are smooth (500ms fade)
- Offline practice and sync work correctly with no data loss
- Main thread maintains 60fps during active practice
- Auth flow works end-to-end with Supabase
- Service worker caches Vite build assets correctly
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`
