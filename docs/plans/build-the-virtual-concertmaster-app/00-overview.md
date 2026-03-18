# The Virtual Concertmaster App - Implementation Plan

## 1. Project Overview

**Project Name:** The Virtual Concertmaster
**Type:** Progressive Web Application (PWA) for Music Practice and Performance
**Core Functionality:** A comprehensive platform for musicians to search, scan, and practice sheet music with real-time audio analysis, performance feedback, and visual metrics.
**Target Users:** Musicians of all levels seeking to improve their performance accuracy, sight-reading skills, and practice efficiency.

---

## 2. High-Level Approach

This application will be built as a full-stack application with a **Node.js/Express backend** and **vanilla JavaScript frontend** using the Web Audio API for real-time audio processing. The architecture prioritizes:

- **Backend-hosted OMR processing** via Audiveris (Java-based OMR engine)
- **Backend IMSLP proxy** using web scraping with proper rate limiting and caching
- **Client-side processing** for low-latency audio feedback during live performance
- **Modular component design** for maintainability and feature expansion
- **Offline-first PWA capabilities** for practice anywhere (cached content)

### Technology Stack
- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend:** Node.js with Express, Puppeteer for scraping
- **Audio Processing:** Web Audio API, YIN/pYIN algorithms for pitch detection
- **OMR Processing:** Audiveris (server-side) via Java runtime
- **Data Storage:** IndexedDB for local sheet music, localStorage for settings
- **PWA:** Service Worker, Web App Manifest

### Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (PWA)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │AudioEngine│  │SheetMusic│  │Performance│  │Metrics       │  │
│  │(YIN/pYIN)│  │Parser    │  │Comparator │  │Calculator    │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP/REST
┌───────────────────────────┴─────────────────────────────────────┐
│                      Backend (Node.js)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │IMSLP Proxy   │  │OMR Service   │  │File Storage       │   │
│  │(Puppeteer)   │  │(Audiveris)    │  │(Local/Cloud)      │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Milestones Summary

| Milestone | Title | Description |
|-----------|-------|-------------|
| 0 | Backend Infrastructure | Node.js server, Audiveris OMR service, IMSLP proxy |
| 1 | Song Ingestion | IMSLP search (via backend proxy) and OMR sheet music scanning |
| 2 | Live Performance Analysis | Real-time audio tracking, instrument detection, sheet music comparison |
| 3 | Feedback & Metrics | Note accuracy scoring, rhythmic precision analysis, visual heat maps |
| 4 | Midnight Conservatory Aesthetic | Dark elegant theme with classical music visual elements |

---

## 4. Cross-Milestone Dependencies

### Critical Sequencing
1. **Milestone 0 (Backend Infrastructure)** must complete first - all external services (OMR, IMSLP) require backend endpoints
2. **Milestone 1 (Song Ingestion)** depends on Milestone 0 backend being available
3. **Milestone 2 (Live Analysis)** must complete after Milestone 1, as the analysis engine requires parsed sheet music data
4. **Milestone 3 (Feedback & Metrics)** depends on Milestone 2's scoring engine
5. **Milestone 4 (Aesthetic)** applies the visual theme across all completed features but can have initial styling applied incrementally
6. The "Follow-the-ball" cursor feature (sight-reading practice) depends on both the sheet music parsing (Milestone 1) and real-time tracking (Milestone 2)

### Integration Points
- Backend from Milestone 0 provides REST APIs consumed by Milestone 1
- Sheet music data model from Milestone 1 feeds into Milestone 2's comparison engine
- Audio analysis from Milestone 2 produces data consumed by Milestone 3's metrics engine
- All milestones use shared CSS variables for the Midnight Conservatory theme

---

## 5. Total Task Count

**Estimated Total: 25 tasks across 5 milestones**

- Milestone 0 (Backend Infrastructure): 7 tasks
- Milestone 1 (Song Ingestion): 5 tasks
- Milestone 2 (Live Analysis): 5 tasks
- Milestone 3 (Feedback & Metrics): 4 tasks
- Milestone 4 (Midnight Aesthetic): 4 tasks

---

## 6. Initial Architecture Notes

### Key Modules to Create

#### Backend (Node.js)
1. **Express Server** - REST API server handling all external integrations
2. **IMSLPProxy** - Puppeteer-based scraping service for IMSLP (with caching)
3. **AudiverisService** - Java process manager for running OMR processing
4. **FileStorage** - Local file storage with cloud backup capability

#### Frontend
1. **AudioEngine** - Manages microphone input, pitch detection (YIN/pYIN), and audio analysis
2. **SheetMusicParser** - Handles MusicXML/MEI parsing and note extraction
3. **PerformanceComparator** - Matches live audio to expected notes with timing analysis
4. **MetricsCalculator** - Computes accuracy scores and identifies problem areas
5. **IMSLPClient** - Frontend client for backend IMSLP proxy endpoint
6. **OMRUploader** - Frontend service for uploading images to backend Audiveris service

### Known Limitations & Trade-offs
- **Polyphonic Instruments**: YIN/pYIN is designed for monophonic pitch detection. For polyphonic instruments (piano, guitar), we will use:
  - Single-note detection with user guidance (play one note at a time)
  - Future enhancement: Chroma features for chord detection (lower accuracy)
- **Instrument Detection**: Client-side JS has ~70-80% accuracy. Will use template matching with confidence thresholds
- **Tempo Variations**: Real-time DTW is computationally expensive; will use elastic matching with fixed tolerance windows

### Data Flow
```
Backend (Node.js)
  ├── IMSLP Search → Puppeteer scrape → Cache → Return results to frontend
  └── Image Upload → Audiveris OMR → MusicXML → Return to frontend

Frontend
  └── MusicXML → Sheet Music Parser → Music Data Model
                                                    ↓
Microphone Input → Audio Engine → Pitch Detection
                                            ↓
                               Performance Comparator ← Music Data Model
                                            ↓
                               Metrics Calculator → Visual Feedback
```
