/**
 * The Virtual Concertmaster - Main Application
 * Coordinates all modules and handles UI interactions
 */

class ConcertmasterApp {
    constructor() {
        // Core modules
        this.audioEngine = null;
        this.pitchDetector = null;
        this.metronome = null;
        this.scoreLibrary = null;
        this.performanceComparator = null;
        this.rhythmAnalyzer = null;
        this.currentScore = null;

        // State
        this.isPracticing = false;
        this.selectedInstrument = 'violin';
        this.confidenceThreshold = 0.85;

        // Performance tracking
        this.sessionData = null;
        this.accuracyScorer = null;

        // UI Components
        this.sheetMusicRenderer = null;
        this.heatMapRenderer = null;

        // DOM Elements
        this.views = {};
        this.toastContainer = null;

        // Tap tempo tracking
        this.tapTimes = [];
    }

    async init() {
        console.log('Initializing Virtual Concertmaster...');

        try {
            // Initialize components
            this.initializeComponents();

            // Setup UI
            this.setupNavigation();
            this.setupModals();
            this.setupLibraryActions();
            this.setupPracticeControls();
            this.setupMetronome();
            this.setupSettings();

            // Initialize audio engine
            await this.initializeAudio();

            // Load library
            await this.loadLibrary();

            console.log('Concertmaster initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            this.showToast('Failed to initialize: ' + error.message, 'error');
        }
    }

    initializeComponents() {
        // Create core components
        this.pitchDetector = new PitchDetector();
        this.metronome = new Metronome();
        this.scoreLibrary = new ScoreLibrary();
        this.performanceComparator = new PerformanceComparator();
        this.rhythmAnalyzer = new RhythmAnalyzer();
        this.accuracyScorer = new AccuracyScorer();

        // Get DOM elements
        this.views = {
            library: document.getElementById('library-view'),
            practice: document.getElementById('practice-view'),
            metronome: document.getElementById('metronome-view'),
            settings: document.getElementById('settings-view')
        };

        this.toastContainer = document.getElementById('toast-container');

        // Initialize renderers
        this.initRenderers();
    }

    initRenderers() {
        // Initialize sheet music renderer
        const sheetContainer = document.getElementById('sheet-music-container');
        if (sheetContainer) {
            this.sheetMusicRenderer = new SheetMusicRenderer(sheetContainer);
            this.sheetMusicRenderer.init();
        }

        // Initialize heat map renderer
        const heatmapPreview = document.getElementById('heatmap-preview');
        if (heatmapPreview) {
            this.heatMapRenderer = new HeatMapRenderer(heatmapPreview);
            this.heatMapRenderer.init();
        }
    }

    async initializeAudio() {
        this.audioEngine = new AudioEngine();
        this.audioEngine.onError = (error) => {
            this.showToast('Audio error: ' + error.message, 'error');
        };

        await this.audioEngine.init();
    }

    setupNavigation() {
        // Desktop navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const viewId = link.getAttribute('href').slice(1) + '-view';
                this.showView(viewId);
            });
        });

        // Mobile navigation
        document.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const viewId = link.getAttribute('href').slice(1) + '-view';
                this.showView(viewId);

                // Update active state
                document.querySelectorAll('.mobile-nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });

        // Mobile menu button
        const menuBtn = document.querySelector('.mobile-menu-btn');
        if (menuBtn) {
            menuBtn.addEventListener('click', () => {
                // Toggle mobile menu
                console.log('Toggle mobile menu');
            });
        }
    }

    showView(viewId) {
        // Update nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + viewId.replace('-view', '')) {
                link.classList.add('active');
            }
        });

        // Show/hide views
        Object.keys(this.views).forEach(key => {
            const view = this.views[key];
            if (view) {
                view.classList.remove('active');
            }
        });

        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
        }
    }

    setupModals() {
        // Close buttons
        document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
            el.addEventListener('click', () => {
                document.querySelectorAll('.modal.active').forEach(modal => {
                    modal.classList.remove('active');
                });
            });
        });

        // Import modal triggers
        document.getElementById('import-score-btn')?.addEventListener('click', () => {
            document.getElementById('import-modal')?.classList.add('active');
        });

        document.getElementById('scan-music-btn')?.addEventListener('click', () => {
            this.showToast('Scan feature coming soon', 'info');
        });

        document.getElementById('search-imslp-btn')?.addEventListener('click', () => {
            document.getElementById('imslp-modal')?.classList.add('active');
        });

        // IMSLP search
        document.getElementById('imslp-search-btn')?.addEventListener('click', () => {
            this.searchIMSLP();
        });
    }

    setupLibraryActions() {
        // File upload handler
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                this.handleFileUpload(e.target);
            });
        });

        // Library search
        document.getElementById('library-search-input')?.addEventListener('input', (e) => {
            this.filterLibrary(e.target.value);
        });
    }

    setupPracticeControls() {
        // Start practice button
        document.getElementById('start-practice-btn')?.addEventListener('click', () => {
            this.togglePractice();
        });

        // Practice metronome toggle
        document.getElementById('practice-metronome-btn')?.addEventListener('click', async () => {
            if (!this.metronome.audioContext) {
                await this.metronome.init();
            }
            this.metronome.toggle();

            const btn = document.getElementById('practice-metronome-btn');
            btn.classList.toggle('active', this.metronome.isPlaying);

            if (this.metronome.isPlaying) {
                this.showToast('Metronome started', 'info');
            }
        });
    }

    setupMetronome() {
        // BPM slider
        const tempoSlider = document.getElementById('tempo-slider');
        const bpmDisplay = document.getElementById('bpm-display');
        const tempoLabel = document.getElementById('tempo-label');

        tempoSlider?.addEventListener('input', (e) => {
            const bpm = parseInt(e.target.value);
            this.metronome.setBPM(bpm);
            if (bpmDisplay) bpmDisplay.textContent = bpm;
            if (tempoLabel) tempoLabel.textContent = this.metronome.getTempoLabel(bpm);

            // Update preset buttons
            document.querySelectorAll('.preset-btn').forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.dataset.tempo) === bpm);
            });
        });

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const bpm = parseInt(btn.dataset.tempo);
                this.metronome.setBPM(bpm);
                if (tempoSlider) tempoSlider.value = bpm;
                if (bpmDisplay) bpmDisplay.textContent = bpm;
                if (tempoLabel) tempoLabel.textContent = this.metronome.getTempoLabel(bpm);

                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Toggle metronome
        document.getElementById('metronome-toggle')?.addEventListener('click', async () => {
            if (!this.metronome.audioContext) {
                await this.metronome.init();
            }

            this.metronome.toggle();

            const btn = document.getElementById('metronome-toggle');
            const playIcon = btn.querySelector('.play-icon');
            const pauseIcon = btn.querySelector('.pause-icon');
            const span = btn.querySelector('span');

            if (this.metronome.isPlaying) {
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
                span.textContent = 'Stop';
            } else {
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
                span.textContent = 'Start';
            }
        });

        // Tap tempo
        const tapBtn = document.getElementById('tap-tempo-btn');
        tapBtn?.addEventListener('click', () => {
            const now = Date.now();
            this.tapTimes.push(now);

            // Keep only last 8 taps
            if (this.tapTimes.length > 8) {
                this.tapTimes.shift();
            }

            // Reset if too much time has passed
            if (this.tapTimes.length > 1 && now - this.tapTimes[this.tapTimes.length - 2] > 2000) {
                this.tapTimes = [now];
            }

            if (this.tapTimes.length >= 2) {
                const bpm = this.metronome.tapTempo(this.tapTimes);
                if (bpm) {
                    this.metronome.setBPM(bpm);
                    if (tempoSlider) tempoSlider.value = bpm;
                    if (bpmDisplay) bpmDisplay.textContent = bpm;
                    if (tempoLabel) tempoLabel.textContent = this.metronome.getTempoLabel(bpm);

                    document.querySelectorAll('.preset-btn').forEach(btn => {
                        btn.classList.toggle('active', parseInt(btn.dataset.tempo) === bpm);
                    });
                }
            }
        });

        // Reset tempo
        document.getElementById('reset-tempo-btn')?.addEventListener('click', () => {
            this.metronome.setBPM(120);
            if (tempoSlider) tempoSlider.value = 120;
            if (bpmDisplay) bpmDisplay.textContent = 120;
            if (tempoLabel) tempoLabel.textContent = 'Allegro';

            document.querySelectorAll('.preset-btn').forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.dataset.tempo) === 120);
            });
        });

        // Beat indicator callback
        this.metronome.onBeat = (beat, total) => {
            this.updateBeatIndicator(beat);
        };
    }

    updateBeatIndicator(beat) {
        const dots = document.querySelectorAll('.beat-dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === beat);
        });
    }

    setupSettings() {
        // Instrument selection
        document.querySelectorAll('.instrument-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.instrument-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedInstrument = btn.dataset.instrument;

                // Update confidence threshold based on instrument
                this.updateInstrumentSettings();
            });
        });

        // Sensitivity slider
        const sensitivitySlider = document.getElementById('sensitivity-slider');
        const sensitivityValue = document.getElementById('sensitivity-value');

        sensitivitySlider?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.confidenceThreshold = value;
            this.pitchDetector.confidenceThreshold = value;
            if (sensitivityValue) sensitivityValue.textContent = value.toFixed(2);
        });
    }

    updateInstrumentSettings() {
        // Adjust pitch detection range based on instrument
        const range = this.pitchDetector.getInstrumentRange(this.selectedInstrument);
        this.pitchDetector.minFrequency = range.min;
        this.pitchDetector.maxFrequency = range.max;
    }

    async loadLibrary() {
        await this.scoreLibrary.init();
        this.renderLibrary();
    }

    renderLibrary() {
        const grid = document.getElementById('library-grid');
        if (!grid) return;

        const scores = this.scoreLibrary.scores;

        if (scores.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/>
                        <circle cx="18" cy="16" r="3"/>
                    </svg>
                    <h3>No scores yet</h3>
                    <p>Import sheet music to get started with practice</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = scores.map(score => `
            <div class="library-card" data-id="${score.id}">
                <div class="library-card-thumbnail">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                </div>
                <h3 class="library-card-title">${score.title}</h3>
                <p class="library-card-composer">${score.composer}</p>
                <div class="library-card-meta">
                    <span class="instrument-badge">${score.instrument || 'Violin'}</span>
                    <span>${this.formatDate(score.addedAt)}</span>
                </div>
            </div>
        `).join('');

        // Add click handlers
        grid.querySelectorAll('.library-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                this.selectScore(id);
            });
        });
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    filterLibrary(query) {
        const results = this.scoreLibrary.search(query);
        const grid = document.getElementById('library-grid');

        if (results.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <p>No scores match your search</p>
                </div>
            `;
            return;
        }

        // Re-render with filtered results
        this.renderLibraryFiltered(results);
    }

    renderLibraryFiltered(scores) {
        const grid = document.getElementById('library-grid');

        grid.innerHTML = scores.map(score => `
            <div class="library-card" data-id="${score.id}">
                <div class="library-card-thumbnail">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                </div>
                <h3 class="library-card-title">${score.title}</h3>
                <p class="library-card-composer">${score.composer}</p>
                <div class="library-card-meta">
                    <span class="instrument-badge">${score.instrument || 'Violin'}</span>
                    <span>${this.formatDate(score.addedAt)}</span>
                </div>
            </div>
        `).join('');

        // Add click handlers
        grid.querySelectorAll('.library-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                this.selectScore(id);
            });
        });
    }

    selectScore(id) {
        const score = this.scoreLibrary.scores.find(s => s.id === id);
        if (!score) return;

        this.currentScore = score;

        // Set up performance comparator with the score
        this.performanceComparator.setScore(score);

        // Render sheet music
        if (this.sheetMusicRenderer) {
            this.sheetMusicRenderer.setScore(score);
        }

        // Update UI
        const titleEl = document.getElementById('current-piece-title');
        if (titleEl) titleEl.textContent = score.title;

        const startBtn = document.getElementById('start-practice-btn');
        if (startBtn) startBtn.disabled = false;

        // Switch to practice view
        this.showView('practice-view');
    }

    async handleFileUpload(input) {
        const file = input.files[0];
        if (!file) return;

        this.showToast('Processing file...', 'info');

        try {
            // Parse based on file type
            let score;
            if (file.name.endsWith('.musicxml') || file.name.endsWith('.xml')) {
                const text = await file.text();
                const parser = new MusicXMLParser();
                score = parser.parse(text);
            } else if (file.name.endsWith('.mei')) {
                this.showToast('MEI support coming soon', 'info');
                return;
            } else {
                this.showToast('Unsupported file format', 'error');
                return;
            }

            // Add to library
            await this.scoreLibrary.addScore(score);
            this.renderLibrary();
            this.showToast('Score added to library', 'success');

            // Close modal
            document.getElementById('import-modal')?.classList.remove('active');

        } catch (error) {
            console.error('File upload error:', error);
            this.showToast('Failed to process file: ' + error.message, 'error');
        }
    }

    async togglePractice() {
        if (this.isPracticing) {
            this.stopPractice();
        } else {
            await this.startPractice();
        }
    }

    async startPractice() {
        if (!this.currentScore) {
            this.showToast('Please select a score first', 'error');
            return;
        }

        // Request microphone access
        try {
            await this.audioEngine.requestMicrophoneAccess();
        } catch (error) {
            this.showToast('Microphone access required for practice', 'error');
            return;
        }

        this.isPracticing = true;

        // Initialize rhythm analyzer with score tempo
        const tempo = this.currentScore.tempo || 120;
        this.rhythmAnalyzer.setTempo(tempo);

        // Calculate expected note intervals based on score time signature
        const expectedIntervals = this.calculateExpectedIntervals();
        this.rhythmAnalyzer.setExpectedIntervals(expectedIntervals);

        // Track note timings
        this.lastNoteTime = null;
        this.beatStartTime = Date.now();
        this.currentBeatCount = 0;

        this.sessionData = {
            scoreId: this.currentScore.id,
            startTime: Date.now(),
            notes: [],
            pitchAccuracy: [],
            timingAccuracy: [],
            timingDeviations: []
        };

        // Update UI
        const startBtn = document.getElementById('start-practice-btn');
        startBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
            </svg>
        `;

        // Start audio processing
        this.audioEngine.startCapture((data) => {
            this.processAudio(data);
        }, 50);

        // Start metronome if it's enabled
        if (this.metronome.isPlaying) {
            this.showToast('Practice started with metronome', 'success');
        } else {
            this.showToast('Practice started - play your instrument', 'success');
        }
    }

    calculateExpectedIntervals() {
        // Estimate expected intervals between notes based on tempo
        // This is a simplified version - in production, parse actual note durations from MusicXML
        const msPerBeat = 60000 / this.rhythmAnalyzer.tempo;
        const intervals = [];

        if (!this.currentScore) return intervals;

        // Get all notes from the score
        const allNotes = this.currentScore.getAllNotes ? this.currentScore.getAllNotes() : [];

        // Estimate intervals based on typical note values
        // Default to quarter note intervals
        for (let i = 0; i < allNotes.length; i++) {
            intervals.push(msPerBeat);
        }

        return intervals;
    }

    stopPractice() {
        this.isPracticing = false;
        this.audioEngine.stopListening();

        // Calculate final scores
        const finalScore = this.accuracyScorer.calculateOverall(this.sessionData);

        // Update UI
        const startBtn = document.getElementById('start-practice-btn');
        startBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
        `;

        // Show session summary
        this.showSessionSummary(finalScore);

        this.showToast('Practice session ended', 'success');
    }

    processAudio(data) {
        if (!data.timeData) return;

        // Check audio level - ignore if too quiet
        if (data.level < 0.01) {
            return;
        }

        // Detect pitch
        this.pitchDetector.sampleRate = data.sampleRate;
        this.pitchDetector.bufferSize = data.bufferSize;

        const result = this.pitchDetector.process(data.timeData);

        if (result) {
            // Calculate timing deviation if we have previous note time
            const currentTime = Date.now();
            let timingDeviation = 0;
            let timingStatus = 'on-time';

            if (this.lastNoteTime) {
                const interval = currentTime - this.lastNoteTime;
                const expectedInterval = this.rhythmAnalyzer.expectedIntervals[0] || (60000 / this.rhythmAnalyzer.tempo);
                timingDeviation = interval - expectedInterval;

                // Determine if early, late, or on time
                // Threshold: within 100ms is "on time"
                if (timingDeviation < -100) {
                    timingStatus = 'early';
                } else if (timingDeviation > 100) {
                    timingStatus = 'late';
                } else {
                    timingStatus = 'on-time';
                }

                // Calculate timing accuracy (0-100)
                const timingAccuracy = Math.max(0, 100 - Math.abs(timingDeviation) / expectedInterval * 100);

                // Store timing data
                if (this.sessionData) {
                    this.sessionData.timingAccuracy.push(timingAccuracy);
                    this.sessionData.timingDeviations.push(timingDeviation);
                }

                // Add timing info to result for display
                result.timingDeviation = timingDeviation;
                result.timingStatus = timingStatus;
                result.timingAccuracy = timingAccuracy;
            }

            this.lastNoteTime = currentTime;

            // Compare against sheet music if score is loaded
            if (this.currentScore && this.performanceComparator) {
                const comparison = this.performanceComparator.compare(result);

                if (comparison.matched || comparison.centsDeviation !== undefined) {
                    // Calculate cents deviation from expected note
                    if (comparison.expectedNote) {
                        const expectedFreq = comparison.expectedNote.getFrequency();
                        result.centsDeviation = this.pitchDetector.centsDeviation(
                            result.frequency,
                            expectedFreq
                        );

                        // Track measure for heat map
                        const measure = this.performanceComparator.getMeasureAtPosition(
                            this.performanceComparator.currentPosition
                        );

                        // Calculate pitch accuracy
                        const accuracy = this.accuracyScorer.calculatePitchAccuracy(result);
                        result.measure = measure;
                        result.accuracy = accuracy;
                        result.matched = comparison.matched;

                        // Store in session data
                        if (this.sessionData) {
                            this.sessionData.pitchAccuracy.push(accuracy);
                            this.sessionData.notes.push({
                                note: result,
                                timestamp: Date.now(),
                                measure: measure,
                                accuracy: accuracy,
                                matched: comparison.matched,
                                timingDeviation: timingDeviation,
                                timingStatus: timingStatus
                            });
                        }
                    }
                }

                // Update cursor position
                if (this.sheetMusicRenderer) {
                    this.sheetMusicRenderer.setCursorPosition(
                        this.performanceComparator.getProgress()
                    );
                }
            }

            // Update UI with current note
            this.updateFeedbackDisplay(result);
        }
    }

    updateFeedbackDisplay(noteInfo) {
        const noteDisplay = document.getElementById('current-note');
        const octaveDisplay = document.getElementById('current-octave');
        const accuracyScore = document.getElementById('accuracy-score');
        const pitchMarker = document.getElementById('pitch-marker');
        const centsDisplay = document.getElementById('cents-display');
        const timingDisplay = document.getElementById('timing-display');
        const timingMarker = document.getElementById('timing-marker');
        const timingStatus = document.getElementById('timing-status');

        if (noteDisplay) {
            noteDisplay.textContent = noteInfo.name;
        }
        if (octaveDisplay) {
            octaveDisplay.textContent = noteInfo.octave;
        }

        // Calculate accuracy
        const accuracy = this.accuracyScorer.calculatePitchAccuracy(noteInfo);
        if (accuracyScore) {
            accuracyScore.textContent = Math.round(accuracy) + '%';
        }

        // Update pitch meter (center is 0 cents)
        if (pitchMarker && centsDisplay) {
            const cents = noteInfo.centsDeviation || 0;
            const percent = Math.max(-50, Math.min(50, cents)) + 50;
            pitchMarker.style.left = percent + '%';
            centsDisplay.textContent = (cents > 0 ? '+' : '') + cents + '¢';

            // Color based on accuracy
            if (Math.abs(cents) <= 10) {
                pitchMarker.style.backgroundColor = 'var(--success)';
            } else if (Math.abs(cents) <= 25) {
                pitchMarker.style.backgroundColor = 'var(--warning)';
            } else {
                pitchMarker.style.backgroundColor = 'var(--error)';
            }
        }

        // Update timing display
        if (timingDisplay) {
            const deviation = noteInfo.timingDeviation || 0;
            const sign = deviation > 0 ? '+' : '';
            timingDisplay.textContent = sign + Math.round(deviation) + 'ms';
        }

        // Update timing marker position and color
        if (timingMarker) {
            const deviation = noteInfo.timingDeviation || 0;
            // Map deviation to 0-100% range (-200ms to +200ms)
            const maxDeviation = 200;
            const percent = Math.max(-maxDeviation, Math.min(maxDeviation, deviation)) + maxDeviation;
            timingMarker.style.left = (percent / (maxDeviation * 2) * 100) + '%';

            // Remove previous classes
            timingMarker.classList.remove('early', 'late', 'on-time');

            // Add appropriate class based on timing status
            const status = noteInfo.timingStatus || 'on-time';
            timingMarker.classList.add(status);
        }

        // Update timing status indicator
        if (timingStatus) {
            const status = noteInfo.timingStatus || 'on-time';
            timingStatus.className = 'timing-status ' + status;

            if (status === 'early') {
                timingStatus.textContent = 'Early';
            } else if (status === 'late') {
                timingStatus.textContent = 'Late';
            } else {
                timingStatus.textContent = 'On Time';
            }
        }
    }

    showSessionSummary(score) {
        const modal = document.getElementById('session-summary-modal');
        if (!modal) return;

        // Update summary data
        document.getElementById('final-score').textContent = Math.round(score.overall) + '%';
        document.getElementById('pitch-accuracy').textContent = Math.round(score.pitch) + '%';
        document.getElementById('timing-accuracy').textContent = Math.round(score.timing) + '%';

        const duration = this.sessionData?.startTime ? Date.now() - this.sessionData.startTime : 0;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        document.getElementById('session-duration').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Add timing analysis message if available
        const timingAnalysisEl = document.getElementById('timing-analysis');
        if (timingAnalysisEl && score.timingAnalysis) {
            timingAnalysisEl.textContent = score.timingAnalysis.message;
            timingAnalysisEl.className = 'timing-analysis ' + score.timingAnalysis.status;
        }

        // Update heat map with session data
        if (this.heatMapRenderer && this.sessionData) {
            this.heatMapRenderer.setData(this.sessionData);
            this.heatMapRenderer.render();
        }

        // Show modal
        modal.classList.add('active');
    }

    searchIMSLP() {
        const input = document.getElementById('imslp-search-input');
        const query = input?.value?.trim();

        if (!query) {
            this.showToast('Please enter a search term', 'error');
            return;
        }

        // Show loading state
        const resultsEl = document.getElementById('imslp-results');
        if (resultsEl) {
            resultsEl.innerHTML = '<div class="empty-state"><p>Searching...</p></div>';
        }

        // Simulate search results (in real implementation, this would call backend)
        setTimeout(() => {
            if (resultsEl) {
                resultsEl.innerHTML = `
                    <div class="search-result-item">
                        <div class="result-info">
                            <h4>Bach - Cello Suite No. 1</h4>
                            <p>J.S. Bach • Cello</p>
                        </div>
                        <button class="btn btn-secondary">Download</button>
                    </div>
                    <div class="search-result-item">
                        <div class="result-info">
                            <h4>Vivaldi - Four Seasons</h4>
                            <p>A. Vivaldi • Violin</p>
                        </div>
                        <button class="btn btn-secondary">Download</button>
                    </div>
                `;
            }
        }, 1500);
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        this.toastContainer?.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ConcertmasterApp();
    window.app.init();
});