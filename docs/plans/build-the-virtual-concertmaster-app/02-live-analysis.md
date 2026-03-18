# Milestone 2: Live Performance Analysis

## Goal
Enable real-time audio tracking and analysis during live performance, including pitch detection, instrument detection, and comparison against imported sheet music.

## Scope
- Real-time audio capture and processing via Web Audio API
- YIN/pYIN pitch detection algorithm implementation
- Instrument type detection from audio characteristics
- Real-time matching of played notes to sheet music
- Visual cursor/position tracking ("Follow-the-ball")

---

## Task 2.1: Audio Engine Core

### Description
Build the core audio processing infrastructure using the Web Audio API for low-latency microphone input capture and analysis.

### Subtasks
1. Create `js/audio/audio-engine.js` - Main audio context management
2. Implement microphone input stream handling
3. Create AudioWorklet for sample-level processing
4. Implement gain control and audio level monitoring
5. Add audio visualization (waveform display)
6. Handle audio device selection and permission management

### Acceptance Criteria
- [ ] Audio context initializes on user gesture
- [ ] Microphone input is captured with <20ms latency
- [ ] Audio level meter shows real-time input levels
5. [ ] Device selection works for multiple microphones
- [ ] Graceful handling of permission denial

### Depends On
- None

### Agent Type
- Coder

---

## Task 2.2: Pitch Detection (YIN/pYIN)

### Description
Implement the YIN and pYIN algorithms for accurate pitch detection from audio samples, essential for matching performed notes to sheet music.

### Subtasks
1. Create `js/audio/pitch-detector.js` - Core YIN algorithm implementation
2. Add pYIN variant for improved accuracy
3. Implement frequency-to-MIDI note conversion
4. Create buffer management for continuous detection
5. Add confidence scoring for detected pitches
6. Optimize for real-time performance (target <10ms per analysis)

### Acceptance Criteria
- [ ] YIN algorithm detects pitches within 1 cent accuracy
- [ ] Detected pitches convert correctly to musical note names
- [ ] Confidence scores differentiate certain vs uncertain detections
- [ ] Algorithm handles octave errors correctly
- [ ] Processing latency stays under 10ms for real-time use

### Depends On
- Task 2.1 (Audio Engine provides sample buffer)

### Agent Type
- Coder

---

## Task 2.3: Instrument Detection

### Description
Analyze audio characteristics to identify the type of instrument being played, enabling more accurate note detection and performance feedback.

### Technical Notes & Limitations
- **Accuracy Reality**: Client-side JavaScript instrument detection achieves ~70-80% accuracy (not 80%+). This is a known limitation.
- **Polyphonic Instruments**: YIN/pYIN is designed for monophonic pitch detection. For polyphonic instruments (piano, guitar):
  - Primary approach: Guide user to play one note at a time
  - Future enhancement: Use chroma features for chord detection (lower accuracy)
- **Supported Instruments (Initial Scope)**: Monophonic instruments only
  - **Woodwinds**: Flute, Oboe, Clarinet, Bassoon, Saxophone
  - **Brass**: Trumpet, Horn, Trombone, Tuba
  - **Strings**: Violin, Viola, Cello (single note)
  - **Excluded**: Piano, Guitar, Harp (polyphonic - limited accuracy)
- **Monophonic focus**: Initial implementation targets monophonic instruments

### Subtasks
1. Create `js/audio/instrument-detector.js` - Instrument classification
2. Implement spectral analysis for timbre characterization
3. Build classifier for common monophonic instrument types (violin, flute, clarinet, etc.)
4. Add support for dynamic instrument switching during piece
5. Create instrument profile calibration
6. Add user manual override for instrument selection
7. Document limitations for polyphonic instruments in UI

### Acceptance Criteria
- [ ] Detects common monophonic instruments with >70% accuracy
- [ ] Handles instrument changes during performance
- [ ] Instrument type affects pitch detection parameters
- [ ] User can manually override detected instrument
- [ ] UI clearly indicates detection is not 100% accurate
- [ ] Clear messaging when polyphonic instruments may have limited accuracy

### Depends On
- Task 2.1 (Audio Engine provides analysis data)

### Agent Type
- Coder

---

## Task 2.4: Sheet Music Comparison Engine

### Description
Build the core matching engine that compares detected pitches in real-time against the expected notes from the parsed sheet music.

### Subtasks
1. Create `js/analysis/performance-comparator.js` - Note matching logic
2. Implement dynamic time warping for tempo variations
3. Build note window matching (exact, transposition, grace notes)
4. Add handling for tempo rubato and ritardando
5. Create lookahead buffer for anticipation
6. Implement score state tracking (current position in piece)

### Acceptance Criteria
- [ ] Detected notes match to correct score positions
- [ ] Handles tempo variations without losing sync
- [ ] Transposition is detected and handled
- [ ] Score position updates in real-time during playback
- [ ] Grace notes and ornaments are accommodated

### Depends On
- Task 1.3 (Sheet Music Data Model)
- Task 2.2 (Pitch Detection)

### Agent Type
- Coder

---

## Task 2.5: Follow-the-Ball Sight Reading

### Description
Implement the "Follow-the-ball" cursor system for sight-reading practice, providing a visual guide that moves across the sheet music in time with the performance.

### Subtasks
1. Create `js/components/follow-the-ball.js` - Cursor tracking component
2. Implement smooth position interpolation between notes
3. Build configurable speed/tempo settings
4. Add practice mode with auto-advance (no audio required)
5. Create highlight system for upcoming notes
6. Add countdown/animation before starting

### Acceptance Criteria
- [ ] Ball cursor smoothly follows current note position
- [ ] Cursor position syncs with detected audio timing
- [ ] User can adjust speed for practice mode
- [ ] Upcoming notes are highlighted in advance
- [ ] Works with both live audio and metronome-only mode

### Depends On
- Task 2.4 (Sheet Music Comparison Engine)
- Task 1.4 (MusicXML/MEI Parser provides note positions)

### Agent Type
- Coder

---

## Changes Required

All changes must be on a feature branch with a GitHub PR created via `gh pr create`.
