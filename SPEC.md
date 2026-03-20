# The Virtual Concertmaster - Technical Specification

## 1. Project Overview

**Project Name:** The Virtual Concertmaster
**Type:** Progressive Web Application (PWA) for Bowed String Instrument Practice
**Core Functionality:** Real-time audio analysis and performance feedback for violin, viola, cello, and double bass players. Users can upload/scan sheet music and receive instant feedback on pitch accuracy, timing, and rhythm.
**Target Users:** Students and musicians practicing bowed string instruments who want to improve intonation and rhythmic precision.

---

## 2. UI/UX Specification

### 2.1 Layout Structure

**App Shell**
- Fixed top navigation bar with app logo and main nav links
- Bottom navigation bar on mobile (Library, Practice, Metronome, Settings)
- Main content area with smooth page transitions

**Main Sections**
1. **Library View** - Grid of imported sheet music with search/filter
2. **Practice View** - Sheet music display with real-time feedback overlay
3. **Session Summary** - Post-practice heat map and score breakdown
4. **Metronome** - Standalone metronome with visual beat indicator
5. **Settings** - Instrument selection, sensitivity, theme options

**Responsive Breakpoints**
- Mobile: < 768px (single column, bottom nav)
- Tablet: 768px - 1024px (two column where appropriate)
- Desktop: > 1024px (full layout with sidebar)

### 2.2 Visual Design - "Midnight Conservatory" Theme

**Color Palette**
- Background Deep: `#0a0a12` (Oxford Blue dark)
- Background Surface: `#141420` (card backgrounds)
- Primary Accent: `#c9a227` (Polished Amber)
- Secondary Accent: `#2d5a4a` (Emerald - correct intonation)
- Error Accent: `#8b2942` (Crimson - sharp/flat indicators)
- Text Primary: `#f5f5dc` (Ivory)
- Text Secondary: `#a0a0b0` (muted)
- Border: `#2a2a3a`

**Typography**
- Headings: "Playfair Display" (serif, elegant)
- Body: "Source Sans 3" (sans-serif, readable)
- Monospace/Code: "JetBrains Mono" (for BPM, note values)
- Font sizes: H1: 48px, H2: 32px, H3: 24px, Body: 16px, Small: 14px

**Spacing System**
- Section padding: 64px vertical
- Container max-width: 1200px
- Card padding: 24px
- Component gap: 16px
- Border radius: 12px (cards), 8px (buttons), 4px (inputs)

**Visual Effects**
- Cards: subtle amber glow on hover
- Active note indicator: pulsing emerald glow
- Off-pitch indicator: crimson gradient
- Smooth fade transitions (300ms)
- Musical note decorations (subtle treble clef motifs)

### 2.3 Components

**Sheet Music Card**
- Thumbnail preview of first measure
- Title, composer, instrument badge
- Difficulty indicator (1-5 stars)
- Last practiced date
- States: default, hover (lift + glow), selected

**Instrument Selector**
- Violin, Viola, Cello, Double Bass icons
- Visual indicator of selected instrument
- Audio sample preview option

**Real-time Feedback Display**
- Large note name display (current note)
- Cents deviation indicator (-50 to +50)
- Timing accuracy (early/late ms)
- Running accuracy percentage

**Heat Map Overlay**
- Color gradient: Green (good) → Yellow (needs work) → Red (struggling)
- Toggle: Note level / Measure level
- Interactive: tap measure for detail

**Metronome Controls**
- BPM display (large, readable)
- Tempo slider with presets (Largo, Andante, Allegro, etc.)
- Tap tempo button
- Visual beat indicator (4 beats per measure default)
- Start/Stop button with animation

---

## 3. Functionality Specification

### 3.1 Core Features

**1. Sheet Music Import**
- IMSLP search via backend proxy (Task 1.1)
- Image upload for OMR scanning (Task 1.2)
- Direct MusicXML/MEI file upload
- Library storage in IndexedDB

**2. Audio Processing Pipeline**
- Microphone input capture (<20ms latency)
- YIN/pYIN pitch detection algorithm
- Real-time pitch-to-note conversion
- Confidence scoring (threshold: 0.85)

**3. Performance Comparison**
- Match detected notes to expected sheet music
- Track current position in score
- Handle tempo variations (DTW-based)
- Support rubato and ritardando

**4. Real-time Feedback**
- Note accuracy (cents deviation)
- Sharp/flat visual indicators (Emerald/Crimson)
- Timing precision (ms early/late)
- Running score display

**5. Post-Session Analysis**
- Heat map overlay on sheet music
- Measure-by-measure breakdown
- Pitch accuracy graph over time
- Session history with comparison

**6. Metronome**
- Web Audio API precise timing
- BPM range: 20-300
- Tempo presets
- Tap tempo
- Visual beat indicator

**7. Follow-the-Ball Cursor**
- Visual cursor moving across score
- Configurable speed
- Highlight upcoming notes
- Practice mode (auto-advance without audio)

### 3.2 User Interactions

- **Import Flow**: Search/Scan → Preview → Confirm → Add to Library
- **Practice Flow**: Select Score → Start → Real-time Feedback → End Session → View Heat Map
- **Settings Flow**: Instrument → Sensitivity → Save
- **Metronome Flow**: Set Tempo → Start → Adjust on fly → Stop

### 3.3 Data Handling

- **Sheet Music Storage**: IndexedDB (musicxml, metadata)
- **Session Data**: IndexedDB (scores, timestamps, per-note data)
- **Settings**: localStorage (instrument, theme preferences)
- **Audio Processing**: Client-side (Web Audio API)

### 3.4 Edge Cases

- **No microphone permission**: Show clear instructions, fallback to manual mode
- **Poor audio quality**: Display warning, suggest adjustments
- **Unsupported file format**: Clear error message with supported formats
- **Offline mode**: Cache essential assets, show offline indicator
- **OMR failure**: Offer retry or manual entry fallback
- **Polyphonic detection limits**: Guide user to play single notes

---

## 4. Technical Architecture

### 4.1 Frontend Structure
```
src/
├── js/
│   ├── audio/
│   │   ├── audio-engine.js    # Web Audio API management
│   │   ├── pitch-detector.js  # YIN/pYIN algorithm
│   │   ├── instrument-detector.js
│   │   └── metronome.js
│   ├── analysis/
│   │   └── performance-comparator.js
│   ├── components/
│   │   ├── library-view.js
│   │   ├── sheet-music-renderer.js
│   │   ├── follow-the-ball.js
│   │   └── heat-map-renderer.js
│   ├── parsers/
│   │   ├── musicxml-parser.js
│   │   └── mei-parser.js
│   ├── services/
│   │   ├── imslp-client.js
│   │   ├── omr-uploader.js
│   │   └── performance-history.js
│   ├── metrics/
│   │   ├── accuracy-scorer.js
│   │   └── rhythm-analyzer.js
│   ├── models/
│   │   └── sheet-music.js
│   └── utils/
│       └── animations.js
├── css/
│   ├── themes/
│   │   └── midnight-conservatory.css
│   └── styles.css
└── index.html
```

### 4.2 Audio Parameters
- Sample Rate: 44100 Hz
- Buffer Size: 2048 samples (46ms)
- Hop Size: 512 samples
- Frequency Range: A0 (27.5 Hz) to C8 (4186 Hz)
- Confidence Threshold: 0.85

---

## 5. Acceptance Criteria

### Visual
- [ ] Midnight Conservatory dark theme applied consistently
- [ ] Amber accents visible on interactive elements
- [ ] Emerald (correct) and Crimson (incorrect) feedback colors working
- [ ] Responsive layout works on 320px, 768px, and 1200px widths
- [ ] Smooth page transitions and micro-interactions

### Functional
- [ ] Microphone input captures audio with <50ms latency
- [ ] Pitch detection accurately identifies notes within 5 cents
- [ ] Sheet music renders from MusicXML
- [ ] Real-time feedback displays during practice
- [ ] Heat map shows problem areas after session
- [ ] Metronome keeps accurate time (no drift)
- [ ] Follow-the-ball cursor moves smoothly across score
- [ ] Library stores and displays imported scores
- [ ] PWA installs on mobile and desktop

### Performance
- [ ] Initial load under 3 seconds on 3G
- [ ] Audio processing under 10ms per cycle
- [ ] 60fps animations on mid-range devices