/**
 * The Virtual Concertmaster - Main Application
 * Coordinates all modules and handles UI interactions
 */

class ConcertmasterApp {
    constructor() {
        // Core modules
        this.audioEngine = null;
        this.pitchDetector = null;
        this.precisionTuner = null;
        this.tunerGauge = null;
        this.metronome = null;
        this.scoreLibrary = null;
        this.performanceComparator = null;
        this.rhythmAnalyzer = null;
        this.currentScore = null;

        // State
        this.isPracticing = false;
        this.isTunerActive = false;
        this.selectedInstrument = 'violin';
        this.confidenceThreshold = 0.85;
        this.cursorEnabled = false;

        // Performance tracking
        this.sessionData = null;
        this.accuracyScorer = null;
        this.performanceHistory = null;

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

            // Initialize precision tuner
            await this.precisionTuner.init();

            // Load library
            await this.loadLibrary();

            // Load performance history
            await this.performanceHistory.init();

            console.log('Concertmaster initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            this.showToast('Failed to initialize: ' + error.message, 'error');
        }
    }

    initializeComponents() {
        // Create core components
        this.pitchDetector = new PitchDetector();
        this.precisionTuner = new PrecisionTuner();
        this.metronome = new Metronome();
        this.scoreLibrary = new ScoreLibrary();
        this.performanceComparator = new PerformanceComparator();
        this.rhythmAnalyzer = new RhythmAnalyzer();
        this.accuracyScorer = new AccuracyScorer();
        this.performanceHistory = new PerformanceHistory();

        // Get DOM elements
        this.views = {
            library: document.getElementById('library-view'),
            tuner: document.getElementById('tuner-view'),
            practice: document.getElementById('practice-view'),
            metronome: document.getElementById('metronome-view'),
            settings: document.getElementById('settings-view')
        };

        this.toastContainer = document.getElementById('toast-container');

        // Initialize renderers
        this.initRenderers();

        // Initialize tuner components
        this.initTuner();
    }

    initTuner() {
        // Initialize tuner gauge
        const gaugeContainer = document.getElementById('tuner-gauge');
        if (gaugeContainer) {
            this.tunerGauge = new TunerGauge('tuner-gauge', { size: 300 });
            this.tunerGauge.init();
        }

        // Initialize precision tuner
        this.precisionTuner.onNoteDetected = (data) => {
            if (this.tunerGauge) {
                this.tunerGauge.update(data);
            }
        };

        this.precisionTuner.onError = (error) => {
            this.showToast('Tuner error: ' + error.message, 'error');
        };

        // Setup tuner event listeners
        this.setupTunerListeners();
    }

    setupTunerListeners() {
        // Instrument selection buttons
        document.querySelectorAll('.tuner-instrument-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tuner-instrument-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedInstrument = btn.dataset.instrument;
                this.precisionTuner.setInstrument(this.selectedInstrument);
            });
        });

        // Tuner toggle button
        const tunerToggle = document.getElementById('tuner-toggle');
        tunerToggle?.addEventListener('click', async () => {
            if (this.isTunerActive) {
                this.precisionTuner.stopListening();
                this.isTunerActive = false;
                tunerToggle.classList.remove('active', 'listening');
                tunerToggle.querySelector('span').textContent = 'Start Tuner';
                if (this.tunerGauge) {
                    this.tunerGauge.reset();
                }
            } else {
                const success = await this.precisionTuner.startListening();
                if (success) {
                    this.isTunerActive = true;
                    tunerToggle.classList.add('active', 'listening');
                    tunerToggle.querySelector('span').textContent = 'Stop Tuner';
                    this.showToast('Tuner active - play a note', 'success');
                } else {
                    this.showToast('Could not access microphone', 'error');
                }
            }
        });

        // Reference frequency input
        const refFreqInput = document.getElementById('reference-freq');
        refFreqInput?.addEventListener('change', (e) => {
            const freq = parseFloat(e.target.value);
            if (freq >= 430 && freq <= 450) {
                this.precisionTuner.setReferenceFrequency(freq);
                this.showToast(`Reference A4 set to ${freq} Hz`, 'info');
            }
        });
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

            // Add click handler for measure details
            this.heatMapRenderer.onMeasureClick = (measure, score, notes) => {
                this.showMeasureDetail(measure, score, notes);
            };
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
            // Trigger file input for scanning
            const scanInput = document.getElementById('scan-file-input');
            if (scanInput) {
                scanInput.click();
            } else {
                this.showToast('Scan feature coming soon', 'info');
            }
        });

        // Handle scan file input
        document.getElementById('scan-file-input')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.processScannedImage(file);
            }
        });

        document.getElementById('search-imslp-btn')?.addEventListener('click', () => {
            document.getElementById('imslp-modal')?.classList.add('active');
        });

        // IMSLP search
        document.getElementById('imslp-search-btn')?.addEventListener('click', () => {
            this.searchIMSLP();
        });

        // Measure detail modal close button
        document.getElementById('close-detail-btn')?.addEventListener('click', () => {
            document.getElementById('measure-detail-modal')?.classList.remove('active');
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

        // Follow-the-ball cursor toggle
        const cursorToggle = document.getElementById('show-cursor-toggle');
        if (cursorToggle) {
            // Load saved preference
            const savedPref = localStorage.getItem('cursorEnabled');
            this.cursorEnabled = savedPref === 'true';

            // Update toggle state
            cursorToggle.classList.toggle('active', this.cursorEnabled);
            cursorToggle.setAttribute('aria-checked', this.cursorEnabled);

            // Handle toggle click
            cursorToggle.addEventListener('click', () => {
                this.cursorEnabled = !this.cursorEnabled;
                localStorage.setItem('cursorEnabled', this.cursorEnabled);
                cursorToggle.classList.toggle('active', this.cursorEnabled);
                cursorToggle.setAttribute('aria-checked', this.cursorEnabled);

                // Update sheet music renderer
                if (this.sheetMusicRenderer) {
                    this.sheetMusicRenderer.setCursorVisible(this.cursorEnabled);
                }
            });
        }
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

        grid.innerHTML = scores.map(score => {
            // Get improvement data if available
            const improvement = this.performanceHistory?.calculateImprovement(score.id);
            const recentSessions = this.performanceHistory?.getSessionsForScore(score.id) || [];
            const lastSession = recentSessions.length > 0 ? recentSessions[recentSessions.length - 1] : null;

            return `
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
                ${improvement ? `
                <div class="session-improvement">
                    <span class="improvement-trend ${improvement.trend}">
                        ${improvement.trend === 'improving' ? '↑' : improvement.trend === 'declining' ? '↓' : '→'}
                        ${improvement.improvement > 0 ? '+' : ''}${improvement.improvement}%
                    </span>
                    <span class="improvement-sessions">${improvement.sessionCount} sessions</span>
                </div>
                ` : lastSession ? `
                <div class="session-improvement">
                    <span class="last-score">Last: ${Math.round(lastSession.overallScore)}%</span>
                </div>
                ` : ''}
            </div>
        `}).join('');

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
            this.sheetMusicRenderer.setCursorVisible(this.cursorEnabled);
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

    async processScannedImage(file) {
        this.showToast('Processing scanned image...', 'info');

        try {
            // Initialize OMR client if needed
            if (!this.omrClient) {
                this.omrClient = new OMRClient();
            }

            // Process the image
            const result = await this.omrClient.processImage(file, {
                enhance: true,
                deskew: true
            });

            // Show success message
            this.showToast('Image processed successfully', 'success');

            // For now, show the result (placeholder - would create actual score in production)
            console.log('OMR Result:', result);

            // Close modal
            document.getElementById('import-modal')?.classList.remove('active');

        } catch (error) {
            console.error('OMR processing error:', error);
            this.showToast('Failed to process image: ' + error.message, 'error');
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
        this.sessionData = {
            scoreId: this.currentScore.id,
            startTime: Date.now(),
            notes: [],
            pitchAccuracy: [],
            timingAccuracy: []
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

        this.showToast('Practice started - play your instrument', 'success');
    }

    stopPractice() {
        this.isPracticing = false;
        this.audioEngine.stopListening();

        // Hide cursor
        if (this.sheetMusicRenderer) {
            this.sheetMusicRenderer.setCursorVisible(false);
        }

        // Calculate final scores
        const finalScore = this.accuracyScorer.calculateOverall(this.sessionData);

        // Save session to history
        if (this.sessionData && this.currentScore) {
            const sessionRecord = {
                scoreId: this.currentScore.id,
                scoreTitle: this.currentScore.title,
                overallScore: finalScore.overall,
                pitchScore: finalScore.pitch,
                timingScore: finalScore.timing,
                duration: Date.now() - this.sessionData.startTime,
                notes: this.sessionData.notes,
                completedAt: new Date().toISOString()
            };
            this.performanceHistory.saveSession(sessionRecord);
        }

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
                                matched: comparison.matched
                            });
                        }
                    }
                }

                // Update cursor position
                if (this.sheetMusicRenderer && this.cursorEnabled) {
                    const isOnPitch = comparison.matched && Math.abs(result.centsDeviation || 0) <= 10;
                    this.sheetMusicRenderer.setCursorPosition(
                        this.performanceComparator.getProgress(),
                        isOnPitch
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

        // Update timing (placeholder)
        if (timingDisplay) {
            timingDisplay.textContent = '0ms';
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

        // Update heat map with session data
        if (this.heatMapRenderer && this.sessionData) {
            this.heatMapRenderer.setData(this.sessionData);
            this.heatMapRenderer.render();
        }

        // Show modal
        modal.classList.add('active');
    }

    showMeasureDetail(measure, score, notes) {
        const modal = document.getElementById('measure-detail-modal');
        if (!modal) return;

        // Update measure info
        document.getElementById('detail-measure-number').textContent = measure;
        document.getElementById('detail-measure-score').textContent = Math.round(score) + '%';

        // Update note breakdown
        const breakdown = document.getElementById('note-breakdown');
        if (!breakdown) return;

        if (!notes || notes.length === 0) {
            breakdown.innerHTML = '<p class="empty-state">No note data available</p>';
        } else {
            breakdown.innerHTML = notes.map(note => {
                const accuracyClass = note.accuracy >= 90 ? 'good' : note.accuracy >= 70 ? 'okay' : 'poor';
                return `
                    <div class="note-item">
                        <span class="note-name">${note.note}</span>
                        <div>
                            <span class="note-accuracy ${accuracyClass}">${Math.round(note.accuracy)}%</span>
                            <span class="cents-deviation">(${note.centsDeviation > 0 ? '+' : ''}${note.centsDeviation}¢)</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Show modal
        modal.classList.add('active');
    }

    async searchIMSLP() {
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

        try {
            // Initialize client if needed
            if (!this.imslpClient) {
                this.imslpClient = new IMSLPClient();
            }

            // Call backend API
            const results = await this.imslpClient.search(query, this.selectedInstrument);

            if (results.length === 0) {
                if (resultsEl) {
                    resultsEl.innerHTML = '<div class="empty-state"><p>No results found</p></div>';
                }
                return;
            }

            // Render results
            if (resultsEl) {
                resultsEl.innerHTML = results.map(result => `
                    <div class="search-result-item" data-id="${result.id}">
                        <div class="result-info">
                            <h4>${result.title}</h4>
                            <p>${result.composer} • ${result.instrument} • ${result.difficulty}</p>
                        </div>
                        <button class="btn btn-secondary imslp-download-btn" data-id="${result.id}">Download</button>
                    </div>
                `).join('');

                // Add download handlers
                resultsEl.querySelectorAll('.imslp-download-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const id = e.target.dataset.id;
                        this.downloadFromIMSLP(id);
                    });
                });
            }
        } catch (error) {
            console.error('IMSLP search error:', error);
            this.showToast('Search failed: ' + error.message, 'error');
            if (resultsEl) {
                resultsEl.innerHTML = '<div class="empty-state"><p>Search failed. Please try again.</p></div>';
            }
        }
    }

    async downloadFromIMSLP(id) {
        this.showToast('Downloading...', 'info');

        try {
            // For now, show a message that this is a placeholder
            this.showToast('Download feature coming soon', 'info');
        } catch (error) {
            console.error('Download error:', error);
            this.showToast('Download failed: ' + error.message, 'error');
        }
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