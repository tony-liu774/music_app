# Milestone 2: The Ear -- DSP and Hardware

## Goal

Port the existing audio capture and pitch detection logic into a Web Worker architecture accessible via React hooks. Build the microphone onboarding flow with graceful denial handling, implement the vibrato filter, and establish continuous error logging to the session store.

## Scope

- Microphone access onboarding flow with permission states
- Pitch detection (pYIN) running in a dedicated Web Worker (mandatory for <30ms latency)
- Vibrato filter: 200ms moving average window for center frequency
- Integration with Zustand audio store for real-time state updates
- Continuous error logging to JSON session array
- AudioContext lifecycle management

---

### Task 1: Microphone Onboarding Flow

**Description:** Build the `getUserMedia` onboarding flow as a React component with graceful handling for all permission states (prompt, granted, denied). Port logic from existing `onboarding-ui.js` and `onboarding-service.js`.

**Agent type:** coder

**Depends on:** Milestone 1 / Task 3 (Base UI Component Library), Milestone 1 / Task 5 (Zustand Store Architecture)

**Subtasks:**
1. Create `client/src/hooks/useMicrophone.js` -- custom hook wrapping `navigator.mediaDevices.getUserMedia`, tracks permission state (idle, prompting, granted, denied, error), stores the `MediaStream` reference
2. Create `client/src/components/onboarding/MicPermissionModal.jsx` -- modal with instrument icon, explanation text, "Allow Microphone" button, denial fallback with instructions to enable in browser settings
3. Integrate with `useAudioStore` -- update mic permission status on grant/deny
4. Handle edge cases: browser not supporting getUserMedia, HTTPS requirement notice, permission previously denied (check `navigator.permissions.query`)
5. Add animated visual feedback when mic is active (subtle amber pulse on the mic icon)
6. Persist permission state in localStorage so returning users skip the prompt

**Acceptance criteria:**
- First-time users see a clear modal explaining why mic access is needed
- Granting permission updates the audio store and closes the modal
- Denying permission shows helpful instructions without blocking the app
- The hook cleans up MediaStream on unmount
- Works on Chrome, Firefox, and Safari
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 2: Web Worker Pitch Detection Pipeline

**Description:** Extract the pYIN pitch detection algorithm from `src/js/audio/pitch-detector.js` and the DSP pipeline from `src/js/audio/dsp-engine.js` into a dedicated Web Worker. Create a React hook that communicates with the worker via `postMessage`.

**Agent type:** coder

**Depends on:** Milestone 1 / Task 1 (Initialize Vite + React Project), Milestone 2 / Task 1 (Microphone Onboarding Flow)

**Subtasks:**
1. Create `client/src/workers/dsp-worker.js` -- Web Worker that receives Float32Array audio buffers and runs the pYIN pitch detection algorithm. Port the `PYINPitchDetector` class from `src/js/audio/dsp-engine.js` (lines 1-200 approximately) into the worker
2. Create `client/src/workers/dsp-worker-protocol.js` -- define message types: `INIT` (configure sample rate, buffer size), `PROCESS` (send audio buffer), `RESULT` (return pitch, confidence, note name, cents deviation), `ERROR`
3. Create `client/src/hooks/useAudioPipeline.js` -- React hook that: creates an AudioContext, connects a MediaStream source to a ScriptProcessorNode (or AudioWorkletNode), sends audio buffers to the Web Worker, receives results and updates `useAudioStore`
4. Port the `SympatheticResonanceFilter` from `dsp-engine.js` into the worker to filter false detections from adjacent open strings
5. Ensure transferable objects (`ArrayBuffer`) are used in `postMessage` for zero-copy performance
6. Add a `PerformanceMonitor` inside the worker that logs processing time per frame and flags if >30ms

**Acceptance criteria:**
- Pitch detection runs entirely in a Web Worker, not on the main thread
- Main thread UI remains at 60fps while audio is being processed
- Detected pitch data (frequency, note, cents, confidence) appears in the Zustand audio store in real time
- Processing latency per frame is under 30ms as measured by the performance monitor
- Worker properly terminates on component unmount
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 3: Vibrato Filter and Smoothing

**Description:** Implement the vibrato smoother as part of the DSP worker pipeline. Use a 200ms moving average window to find the true center frequency, filtering out vibrato oscillations that would otherwise cause erratic intonation readings.

**Agent type:** coder

**Depends on:** Milestone 2 / Task 2 (Web Worker Pitch Detection Pipeline)

**Subtasks:**
1. Port the `VibratoSmoother` class from `src/js/audio/dsp-engine.js` into the Web Worker
2. Implement the 200ms moving average window: at 44100Hz with hop size 512, this is approximately 17 frames
3. Output both raw frequency and smoothed center frequency in the worker result messages
4. Add vibrato detection: flag when pitch oscillation amplitude exceeds a configurable threshold (default 30 cents) and frequency is 4-8Hz (typical vibrato range)
5. Update `useAudioStore` with vibrato state: `{ isVibrato: boolean, vibratoRate: number, vibratoWidth: number, centerFrequency: number }`
6. Write unit tests for the vibrato smoother with synthetic sinusoidal frequency input

**Acceptance criteria:**
- Vibrato oscillations do not cause the intonation display to flicker
- The smoothed center frequency is stable to within 5 cents during normal vibrato
- Vibrato rate and width are accurately detected for typical string vibrato (4-8Hz, 20-50 cents)
- Unit tests pass with synthetic data
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`

---

### Task 4: Session Logger Integration

**Description:** Wire the continuous error logging system into the React/Zustand architecture. Every pitch detection result that deviates from the expected note (based on the loaded score) gets logged to a JSON array in the session store, ready for post-practice AI analysis.

**Agent type:** coder

**Depends on:** Milestone 2 / Task 2 (Web Worker Pitch Detection Pipeline), Milestone 1 / Task 5 (Zustand Store Architecture)

**Subtasks:**
1. Port the `SessionLogger` class from `src/js/analysis/session-logger.js` into `client/src/services/SessionLogger.js`, adapting it to work with Zustand stores instead of direct DOM/class references
2. Create `client/src/hooks/useSessionLogger.js` -- hook that subscribes to audio store pitch updates and logs deviations to the session store
3. Each log entry format: `{ timestamp, measureNumber, beat, expectedNote, detectedNote, centsDeviation, confidence, isVibrato }`
4. Implement session lifecycle: `startSession(scoreId)`, `pauseSession()`, `resumeSession()`, `endSession()` -- all wired to session store state
5. Add aggregation methods: `getErrorsByMeasure()`, `getWorstMeasures(n)`, `getSessionSummary()` for downstream AI analysis
6. Ensure logging does not impact main thread performance (batch updates to store)

**Acceptance criteria:**
- Every pitch deviation during practice is logged with full context
- Session store contains a complete JSON array of all logged events after practice
- `getWorstMeasures(5)` returns the 5 measures with highest average deviation
- Logging overhead is negligible (no dropped frames)
- Changes must be on a feature branch with a GitHub PR created via `gh pr create`
