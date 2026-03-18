# Milestone 3: Feedback & Metrics

## Goal
Provide comprehensive performance feedback including note accuracy scoring, rhythmic precision analysis, and visual heat maps highlighting problem areas in the sheet music.

## Scope
- Real-time accuracy scoring display
- Rhythmic precision analysis and visualization
- Visual heat maps on sheet music
- Performance history and progress tracking
- Detailed session summaries

---

## Task 3.1: Note Accuracy Scoring

### Description
Calculate and display real-time accuracy scores comparing performed notes against expected sheet music notes.

### Subtasks
1. Create `js/metrics/accuracy-scorer.js` - Core scoring algorithm
2. Implement pitch accuracy calculation (cents deviation)
3. Add timing accuracy component (early/late detection)
4. Build running score vs. section score display
5. Create score breakdown by note, measure, and section
6. Add scoring for dynamics and articulation matching

### Acceptance Criteria
- [ ] Real-time accuracy percentage updates during performance
- [ ] Pitch accuracy shows cents deviation from target
- [ ] Timing accuracy shows milliseconds early/late
- [ ] Overall score combines pitch and timing components
- [ ] Score breakdown shows problem areas per measure

### Depends On
- Task 2.4 (Performance Comparator provides matching data)

### Agent Type
- Coder

---

## Task 3.2: Rhythmic Precision Analysis

### Description
Analyze rhythmic accuracy including note durations, beat consistency, and tempo adherence throughout the performance.

### Subtasks
1. Create `js/metrics/rhythm-analyzer.js` - Rhythm analysis engine
2. Implement beat detection from audio onset
3. Calculate note duration accuracy
4. Build tempo deviation tracking over time
5. Add swing/groove analysis for applicable styles
6. Create rhythmic difficulty assessment

### Acceptance Criteria
- [ ] Note durations compared to expected with percentage accuracy
- [ ] Beat consistency shows standard deviation
- [ ] Tempo map shows deviations over piece duration
- [ ] Overall rhythm score displayed
- [ ] Problem rhythmic areas identified

### Depends On
- Task 2.4 (Performance Comparator provides timing data)

### Agent Type
- Coder

---

## Task 3.3: Visual Heat Maps

### Description
Render visual overlays on the sheet music showing problem areas using color-coded heat maps based on error frequency and severity.

### Subtasks
1. Create `js/components/heat-map-renderer.js` - Heat map visualization
2. Implement color gradient (green/yellow/red) based on error severity
3. Add frequency-based intensity mapping
4. Build interactive heat map display on sheet music
5. Create measure-level and note-level granularity toggle
6. Add heat map legend and explanation UI

### Acceptance Criteria
- [ ] Heat map displays on sheet music with correct positioning
- [ ] Color intensity reflects error frequency/severity
- [ ] User can toggle between measure and note granularity
- [ ] Heat map updates after each practice session
- [ ] Legend explains color meanings

### Depends On
- Task 3.1 (Accuracy Scorer provides error data)
- Task 3.2 (Rhythm Analyzer provides timing error data)

### Agent Type
- Coder

---

## Task 3.4: Performance History & Sessions

### Description
Track and store performance sessions over time, allowing users to review progress and compare performances of the same piece.

### Subtasks
1. Create `js/services/performance-history.js` - Session storage service
2. Implement session data model (date, score, duration, notes)
3. Build session list UI with filtering and sorting
4. Create session detail view with full metrics breakdown
5. Add comparison view between sessions
6. Implement progress charts over time

### Acceptance Criteria
- [ ] Each practice session is automatically saved
- [ ] Session history shows date, score, duration for each attempt
- [ ] User can view detailed breakdown of any past session
- [ ] Comparison view shows improvement over time
- [ ] Progress charts visualize skill development

### Depends On
- Task 3.1 (Accuracy scoring provides session data)
- Task 3.2 (Rhythm analysis provides session data)

### Agent Type
- Coder

---

## Changes Required

All changes must be on a feature branch with a GitHub PR created via `gh pr create`.
