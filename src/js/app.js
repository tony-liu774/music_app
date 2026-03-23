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
        this.intonationAnalyzer = null;

        // UI Components
        this.sheetMusicRenderer = null;
        this.heatMapRenderer = null;
        this.followTheBall = null;

        // Scale Engine (warm-up generator)
        this.scaleEngine = null;
        this.scaleEngineUI = null;

        // Annotations
        this.annotationCanvas = null;
        this.annotationService = null;
        this.annotationCanvasClickHandler = null;

        // Onboarding
        this.onboardingService = null;
        this.onboardingUI = null;

        // DOM Elements
        this.views = {};
        this.toastContainer = null;

        // Tap tempo tracking
        this.tapTimes = [];

        // Cross-feature integration state
        this.cursorSpeed = 0;
        this.lastCursorPosition = null;
        this.lastCursorTime = 0;
        this.libraryZoomLevel = 1;
        this.focusedCardIndex = -1;

        // Debounce timer for rhythm analysis
        this.rhythmAnalysisDebounce = null;

        // Screen reader live region
        this.liveRegion = null;

        // Teacher mode
        this.isTeacherMode = false;
        this.teacherService = null;
        this.studioDashboard = null;

        // Assignment service (Smart Assignments)
        this.assignmentService = null;
        this.assignmentUI = null;

        // Up Next widget (Student view)
        this.upNextWidget = null;

        // SSO / OAuth
        this.authService = null;
        this.oauthService = null;
        this.ssoLoginUI = null;

        // License service
        this.licenseService = null;
        this.licenseUI = null;

        // Role Selection
        this.roleSelectionService = null;
        this.roleSelectionUI = null;
    }

    async init() {
        console.log('Initializing Virtual Concertmaster...');

        try {
            // Initialize SSO / OAuth
            await this.initSSO();

            // Initialize components
            this.initializeComponents();

            // Setup UI
            this.setupNavigation();
            this.setupModals();
            this.setupLibraryActions();
            this.setupPracticeControls();
            this.setupMetronome();
            this.setupSettings();

            // Initialize accessibility features
            this.initAccessibility();

            // Initialize onboarding
            this.initOnboarding();

            // Initialize audio engine
            await this.initializeAudio();

            // Load library
            await this.loadLibrary();

            // Initialize teacher mode if enabled
            this.initTeacherMode();

            // Initialize student widget when teacher mode is not active
            if (!this.isTeacherMode) {
                await this.initStudentWidget();
            }

            // Initialize license service (always needed for feature gating)
            await this.initLicense();

            // Initialize video snippet feature
            this.initVideoSnippets();

            // Initialize dashboard UI
            this.initDashboard();

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
        this.intonationAnalyzer = new IntonationAnalyzer();

        // Get DOM elements
        this.views = {
            dashboard: document.getElementById('dashboard-view'),
            library: document.getElementById('library-view'),
            practice: document.getElementById('practice-view'),
            metronome: document.getElementById('metronome-view'),
            settings: document.getElementById('settings-view'),
            tuner: document.getElementById('tuner-view'),
            studio: document.getElementById('studio-dashboard-view'),
            license: document.getElementById('license-view')
        };

        this.toastContainer = document.getElementById('toast-container');

        // Initialize Precision Tuner
        const tunerContainer = document.getElementById('tuner-container');
        if (tunerContainer) {
            this.tuner = new PrecisionTuner(tunerContainer);
        }

        // Initialize renderers
        this.initRenderers();

        // Initialize annotations
        this.initAnnotations();

        // Initialize scale engine
        this.initScaleEngine();
    }

    initRenderers() {
        // Initialize sheet music renderer
        const sheetContainer = document.getElementById('sheet-music-container');
        if (sheetContainer) {
            this.sheetMusicRenderer = new SheetMusicRenderer(sheetContainer);
            this.sheetMusicRenderer.init();

            // Initialize follow-the-ball cursor
            this.followTheBall = new FollowTheBall(sheetContainer);
            this.followTheBall.init();
            this.followTheBall.connectToRenderer(this.sheetMusicRenderer);
        }

        // Initialize heat map renderer
        const heatmapPreview = document.getElementById('heatmap-preview');
        if (heatmapPreview) {
            this.heatMapRenderer = new HeatMapRenderer(heatmapPreview);
            this.heatMapRenderer.init();
        }

        // Initialize Bluetooth HID listener for foot pedals
        this.bluetoothHIDListener = new BluetoothHIDListener();
        this.bluetoothHIDListener.init();

        // Initialize practice loop controller
        this.practiceLoopController = new PracticeLoopController();

        // Initialize Integration Controller and wire up components
        this.integrationController = new IntegrationController(this);
        this.integrationController.setFollowTheBall(this.followTheBall);
        this.integrationController.setBluetoothHIDListener(this.bluetoothHIDListener);
        this.integrationController.init();
    }

    /**
     * Initialize Annotation Canvas and Service
     */
    initAnnotations() {
        const sheetWrapper = document.getElementById('sheet-music-wrapper');
        if (sheetWrapper && typeof AnnotationCanvas !== 'undefined') {
            this.annotationCanvas = new AnnotationCanvas(sheetWrapper);
            this.annotationCanvas.init();

            if (typeof AnnotationService !== 'undefined') {
                this.annotationService = new AnnotationService();
                this.annotationService.init(this.annotationCanvas, null);

                this.setupAnnotationToolbar();
            }
        }
    }

    /**
     * Setup annotation toolbar event handlers
     */
    setupAnnotationToolbar() {
        if (!this.annotationCanvas) return;

        // Tool buttons with symbol placement support
        document.querySelectorAll('.annotation-tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.annotation-tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tool = btn.dataset.tool;
                this.annotationCanvas.setTool(tool);

                // For symbol tools, set up click handler on canvas for placement
                if (['upbow', 'downbow', 'fingering'].includes(tool)) {
                    this.enableSymbolPlacement(tool);
                } else {
                    this.disableSymbolPlacement();
                }
            });
        });

        // Color picker with validation
        const colorPicker = document.getElementById('annotation-color');
        if (colorPicker) {
            colorPicker.addEventListener('input', e => {
                const color = e.target.value;
                // Color input type already validates format, but validate anyway
                if (/^#[0-9a-fA-F]{6}$/.test(color)) {
                    this.annotationCanvas.setColor(color);
                }
            });
        }

        // Line width with bounds checking
        const lineWidthSlider = document.getElementById('annotation-line-width');
        if (lineWidthSlider) {
            lineWidthSlider.addEventListener('input', e => {
                const width = parseInt(e.target.value);
                if (!isNaN(width) && width >= 1 && width <= 8) {
                    this.annotationCanvas.setLineWidth(width);
                }
            });
        }

        // Undo/Redo
        const undoBtn = document.getElementById('annotation-undo-btn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.annotationCanvas.undo());
        }

        const redoBtn = document.getElementById('annotation-redo-btn');
        if (redoBtn) {
            redoBtn.addEventListener('click', () => this.annotationCanvas.redo());
        }

        const clearBtn = document.getElementById('annotation-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.annotationCanvas.clearAll();
                if (this.annotationService) {
                    this.annotationService.clearAll();
                }
            });
        }

        // Keyboard shortcuts (don't trigger in input fields)
        document.addEventListener('keydown', e => {
            // Check if user is typing in an input/textarea
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
                return;
            }

            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.annotationCanvas.undo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                this.annotationCanvas.redo();
            }
        });

        // Layer toggles
        document.querySelectorAll('#annotation-layers input[data-layer]').forEach(cb => {
            cb.addEventListener('change', () => {
                this.annotationCanvas.setLayerVisible(cb.dataset.layer, cb.checked);
            });
        });

        // Sync status from AnnotationService
        if (this.annotationService) {
            this.annotationService.on('syncStatus', status => {
                const el = document.getElementById('annotation-sync-status');
                if (el) {
                    el.style.color = status === 'synced' ? '#00d4ff' : '#c9a227';
                    el.title = status === 'synced' ? 'Synced' : 'Syncing...';
                }
            });

            this.annotationService.on('quotaExceeded', data => {
                this.showToast(data.message, 'error');
            });
        }
    }

    enableSymbolPlacement(tool) {
        if (!this.annotationCanvas || !this.annotationCanvas.canvas) return;

        const canvas = this.annotationCanvas.canvas;
        const handler = (e) => {
            if (this.annotationCanvas.currentTool !== tool) {
                canvas.removeEventListener('click', handler);
                return;
            }
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.annotationCanvas.placeSymbol(x, y, tool);
        };

        canvas.addEventListener('click', handler);
        this.annotationCanvasClickHandler = handler;
    }

    disableSymbolPlacement() {
        if (!this.annotationCanvas || !this.annotationCanvas.canvas) return;
        if (this.annotationCanvasClickHandler) {
            this.annotationCanvas.canvas.removeEventListener('click', this.annotationCanvasClickHandler);
            this.annotationCanvasClickHandler = null;
        }
    }

    /**
     * Initialize Scale Engine warm-up generator
     */
    initScaleEngine() {
        this.scaleEngine = new ScaleEngine();

        const scaleContainer = document.getElementById('scale-engine-container');
        if (scaleContainer) {
            this.scaleEngineUI = new ScaleEngineUI(scaleContainer);
            this.scaleEngineUI.init(this.scaleEngine);
            this.scaleEngineUI.connectModules({
                metronome: this.metronome,
                followTheBall: this.followTheBall,
                intonationAnalyzer: this.intonationAnalyzer,
                sheetMusicRenderer: this.sheetMusicRenderer
            });
        }
    }

    /**
     * Initialize onboarding flow
     */
    initOnboarding() {
        // Create onboarding service
        this.onboardingService = new OnboardingService();

        // Load saved instrument if available
        const savedInstrument = localStorage.getItem('selected_instrument');
        if (savedInstrument && this.onboardingService.instrumentRanges[savedInstrument]) {
            this.selectedInstrument = savedInstrument;
        }

        // Create onboarding UI
        this.onboardingUI = new OnboardingUI(this.onboardingService);

        // Set up completion callback to apply calibration
        this.onboardingService.setOnComplete((data) => {
            // Apply instrument calibration to audio engine
            if (this.audioEngine && data.instrument) {
                this.audioEngine.setInstrumentCalibration(data.instrument);
                this.selectedInstrument = data.instrument;
            }

            // Request microphone access if not already granted
            if (data.permissions?.microphone) {
                this.requestMicrophoneAccess();
            }
        });

        // Initialize UI
        this.onboardingUI.init();
    }

    /**
     * Request microphone access
     */
    async requestMicrophoneAccess() {
        if (this.audioEngine) {
            try {
                await this.audioEngine.requestMicrophoneAccess();
            } catch (error) {
                console.warn('Microphone access not granted:', error);
            }
        }
    }

    /**
     * Initialize SSO / OAuth services and show login screen if needed.
     */
    async initSSO() {
        if (typeof AuthService === 'undefined' || typeof OAuthService === 'undefined') {
            return;
        }

        this.authService = new AuthService();
        this.oauthService = new OAuthService(this.authService);

        // Initialize role selection service
        if (typeof RoleSelectionService !== 'undefined') {
            this.roleSelectionService = new RoleSelectionService(this.authService);
        }

        // Initialize offline session manager and session persistence
        if (typeof OfflineSessionManager !== 'undefined') {
            this.offlineSessionManager = new OfflineSessionManager();
        }

        const syncService = typeof CloudSyncService !== 'undefined'
            ? new CloudSyncService(this.authService)
            : null;

        if (typeof SessionPersistenceService !== 'undefined') {
            this.sessionPersistence = new SessionPersistenceService(
                this.authService,
                this.offlineSessionManager || null,
                { syncService }
            );

            // Restore session on startup (keeps user logged in across restarts)
            await this.sessionPersistence.initialize();

            // Register the service worker for offline caching and queue replay
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(err =>
                    console.warn('SW registration failed:', err)
                );

                // Respond to SW token requests for offline queue replay
                navigator.serviceWorker.addEventListener('message', async (event) => {
                    if (event.data && event.data.type === 'REQUEST_AUTH_TOKEN') {
                        if (event.ports && event.ports[0]) {
                            const token = await this.authService.getToken();
                            event.ports[0].postMessage({ token });
                        }
                    }
                });
            }
        }

        // Fetch OAuth client IDs from the server endpoint
        await this.oauthService.fetchConfig();

        // Listen for logout events to clear OAuth provider, role, and session
        this.authService.onAuthStateChange((event) => {
            if (event === 'logout') {
                this.oauthService.clearProvider();
                if (this.roleSelectionService) {
                    this.roleSelectionService.clearRole();
                }
                if (this.sessionPersistence) {
                    this.sessionPersistence.onLogout();
                }
                // Clear API cache in SW to prevent cross-user data leakage
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_API_CACHE' });
                }
            }
        });

        // Initialize role selection UI
        this._initRoleSelectionUI();

        // Show SSO login screen if user is not authenticated
        if (typeof SSOLoginUI !== 'undefined') {
            this.ssoLoginUI = new SSOLoginUI(this.oauthService, this.authService);
            this.ssoLoginUI.init({
                onSuccess: (user, provider) => {
                    if (user) {
                        this.showToast(`Signed in as ${user.displayName || user.email}`, 'success');
                        // Track session on login
                        if (this.sessionPersistence) {
                            this.sessionPersistence.onLogin(user);
                        }
                    }
                    // Show role selection for new users (first sign-in)
                    if (user && this.roleSelectionService && !this.roleSelectionService.hasSelectedRole()) {
                        this._showRoleSelection();
                    } else if (this.roleSelectionService) {
                        this._applyUserRole(this.roleSelectionService.getRole());
                    }
                },
                onError: (error, provider) => {
                    console.warn(`SSO error (${provider}):`, error.message);
                }
            });

            if (!this.authService.isAuthenticated()) {
                this.ssoLoginUI.show();
            } else if (this.roleSelectionService && !this.roleSelectionService.hasSelectedRole()) {
                // User is authenticated but hasn't picked a role yet
                this._showRoleSelection();
            } else if (this.roleSelectionService) {
                // Apply saved role on app load
                this._applyUserRole(this.roleSelectionService.getRole());
            }
        }
    }

    /**
     * Initialize the role selection UI component.
     * @private
     */
    _initRoleSelectionUI() {
        if (typeof RoleSelectionUI === 'undefined' || !this.roleSelectionService) {
            return;
        }

        this.roleSelectionUI = new RoleSelectionUI(this.roleSelectionService);
        this.roleSelectionUI.init({
            onRoleSelected: (role, inviteLink) => {
                if (role === 'skip') {
                    // Default to student view so the user is not left in limbo.
                    // Mark role as selected so the screen does not re-appear on reload.
                    this.roleSelectionService.setRole('student');
                    this._applyUserRole('student');
                    return;
                }
                this._applyUserRole(role);
                if (role === 'teacher' && inviteLink) {
                    this.showToast('Studio invite link generated!', 'success');
                }
            }
        });
    }

    /**
     * Show the role selection screen.
     * @private
     */
    _showRoleSelection() {
        if (this.roleSelectionUI) {
            this.roleSelectionUI.show();
        }
    }

    /**
     * Apply user role: route to correct dashboard and trigger appropriate flows.
     * Student → Home Dashboard → Trigger Instrument Calibration
     * Teacher → Studio Dashboard → Generate Studio Invite Link
     * @param {string} role - 'student' or 'teacher'
     * @private
     */
    _applyUserRole(role) {
        if (!role) {
            // Corrupted state: selected flag is set but role is missing.
            // Re-show role selection or default to student view.
            if (this.roleSelectionService) {
                this.roleSelectionService.clearRole();
            }
            this._showRoleSelection();
            return;
        }

        if (role === 'teacher') {
            // Enable teacher mode and show studio dashboard
            this.toggleTeacherMode(true);
            const teacherToggle = document.getElementById('teacher-mode-toggle');
            if (teacherToggle) {
                teacherToggle.classList.add('active');
                teacherToggle.setAttribute('aria-checked', 'true');
            }
            localStorage.setItem('teacher_mode', 'true');
            this.showView('studio-dashboard-view');
        } else if (role === 'student') {
            // Show home dashboard (library) and trigger calibration if needed
            this.showView('library-view');
            if (this.onboardingService && !this.onboardingService.hasCompletedOnboarding) {
                this.onboardingService.start();
            }
        }
    }

    async initializeAudio() {
        this.audioEngine = new AudioEngine();
        this.audioEngine.onError = (error) => {
            this.showToast('Audio error: ' + error.message, 'error');
        };

        await this.audioEngine.init();
    }

    /**
     * Initialize the Dashboard UI component
     */
    initDashboard() {
        if (typeof DashboardUI !== 'undefined') {
            this.dashboardUI = new DashboardUI(this);
            this.dashboardUI.init();
        }
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

        // Dashboard quick-access card navigation
        document.querySelectorAll('.dashboard-card[data-navigate]').forEach(card => {
            const navigate = () => {
                const target = card.dataset.navigate;
                const viewId = target + '-view';
                this.showView(viewId);

                // Update mobile nav active state
                document.querySelectorAll('.mobile-nav-link').forEach(l => {
                    l.classList.remove('active');
                    if (l.getAttribute('href') === '#' + target) {
                        l.classList.add('active');
                    }
                });
            };
            card.addEventListener('click', navigate);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate();
                }
            });
        });

        // Hero resume practice button
        const heroResumeBtn = document.getElementById('hero-resume-btn');
        if (heroResumeBtn) {
            heroResumeBtn.addEventListener('click', () => {
                this.showView('practice-view');
                document.querySelectorAll('.mobile-nav-link').forEach(l => {
                    l.classList.remove('active');
                    if (l.getAttribute('href') === '#practice') {
                        l.classList.add('active');
                    }
                });
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

        // Refresh dashboard when navigating back to it
        if (viewId === 'dashboard-view' && this.dashboardUI) {
            this.dashboardUI.refresh();
        }
    }

    /**
     * Navigate to a view by name (used by widgets)
     */
    navigateTo(viewName) {
        // Map view names to view IDs
        const viewMap = {
            'library': 'library-view',
            'practice': 'practice-view',
            'metronome': 'metronome-view',
            'settings': 'settings-view',
            'tuner': 'tuner-view',
            'studio': 'studio-dashboard-view'
        };

        const viewId = viewMap[viewName];
        if (viewId) {
            this.showView(viewId);
        }
    }

    /**
     * Load a piece/score by ID (used by widgets)
     */
    loadPiece(pieceId) {
        if (pieceId && this.selectScore) {
            this.selectScore(pieceId);
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
            this.openScannerModal();
        });

        // Scanner modal setup
        this.setupScannerModal();

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

        // Library search - Global search (local + IMSLP)
        document.getElementById('library-search-input')?.addEventListener('input', (e) => {
            this.globalSearch(e.target.value);
        });

        // Search source toggle (local only vs global)
        document.getElementById('search-local-only')?.addEventListener('change', (e) => {
            const query = document.getElementById('library-search-input').value;
            this.globalSearch(query);
        });

        // Filter chips - Instrument
        document.getElementById('instrument-chips')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('chip')) {
                document.querySelectorAll('#instrument-chips .chip').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                this.applyFilters();
            }
        });

        // Filter chips - Difficulty
        document.getElementById('difficulty-chips')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('chip')) {
                document.querySelectorAll('#difficulty-chips .chip').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                this.applyFilters();
            }
        });

        // Composer filter dropdown
        document.getElementById('composer-filter')?.addEventListener('change', (e) => {
            this.applyFilters();
        });

        // Populate composer filter from library
        this.populateComposerFilter();
    }

    /**
     * Global search - queries both local library and IMSLP
     */
    async globalSearch(query) {
        const searchLocalOnly = document.getElementById('search-local-only')?.checked ?? true;
        const localResults = this.filterLibrary(query);

        if (searchLocalOnly) {
            this.renderLibrary(localResults);
            return;
        }

        if (query && query.trim().length > 0) {
            try {
                const imslpResults = await this.searchIMSLP(query);
                const allResults = [...localResults, ...imslpResults.map(item => ({
                    ...item,
                    isIMSLP: true
                }))];
                this.renderLibrary(allResults);
            } catch (error) {
                console.error('IMSLP search error:', error);
                this.renderLibrary(localResults);
            }
        } else {
            this.renderLibrary(localResults);
        }
    }

    /**
     * Search IMSLP database
     */
    async searchIMSLP(query) {
        try {
            const imslpClient = new IMSLPClient();
            const results = await imslpClient.search(query);
            return results.map(item => ({
                id: item.id || item.scoreId,
                title: item.title || item.compositionTitle,
                composer: item.composer || 'Unknown',
                instrument: item.instrument || 'violin',
                difficulty: 3,
                addedAt: new Date().toISOString(),
                isIMSLP: true,
                thumbnail: item.thumbnail || null,
                source: 'IMSLP'
            }));
        } catch (error) {
            console.error('IMSLP search failed:', error);
            return [];
        }
    }

    /**
     * Apply all filters (instrument, difficulty, composer)
     */
    applyFilters() {
        const query = document.getElementById('library-search-input').value;
        let results = this.scoreLibrary.scores;

        if (query) {
            results = this.scoreLibrary.search(query);
        }

        // Apply instrument filter
        const activeInstrument = document.querySelector('#instrument-chips .chip.active');
        const instrumentFilter = activeInstrument?.dataset.value || 'all';
        if (instrumentFilter !== 'all') {
            results = results.filter(score =>
                score.instrument?.toLowerCase() === instrumentFilter.toLowerCase()
            );
        }

        // Apply difficulty filter
        const activeDifficulty = document.querySelector('#difficulty-chips .chip.active');
        const difficultyFilter = activeDifficulty?.dataset.value || 'all';
        if (difficultyFilter !== 'all') {
            const diffLevel = parseInt(difficultyFilter);
            results = results.filter(score => score.difficulty === diffLevel);
        }

        // Apply composer filter
        const composerFilter = document.getElementById('composer-filter')?.value || 'all';
        if (composerFilter !== 'all') {
            results = results.filter(score =>
                score.composer?.toLowerCase() === composerFilter.toLowerCase()
            );
        }

        this.renderLibrary(results);
    }

    /**
     * Populate composer filter dropdown from library
     */
    populateComposerFilter() {
        const scores = this.scoreLibrary?.scores || [];
        const composers = [...new Set(scores.map(s => s.composer).filter(Boolean))].sort();

        const select = document.getElementById('composer-filter');
        if (!select) return;

        select.innerHTML = '<option value="all">All Composers</option>';
        composers.forEach(composer => {
            const option = document.createElement('option');
            option.value = composer;
            option.textContent = composer;
            select.appendChild(option);
        });
    }

    filterLibrary(query) {
        return this.scoreLibrary.search(query);
    }

    /**
     * Generate difficulty stars HTML
     */
    generateDifficultyStars(difficulty = 3) {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(`<span class="${i <= difficulty ? 'star-filled' : 'star-empty'}">★</span>`);
        }
        return stars.join('');
    }

    /**
     * Format last practiced date
     */
    formatLastPracticed(dateString) {
        if (!dateString) return 'Never practiced';
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return date.toLocaleDateString();
    }

    /**
     * Render library - accepts optional scores array
     */
    renderLibrary(scores = null) {
        const grid = document.getElementById('library-grid');
        if (!grid) return;

        const displayScores = scores !== null ? scores : this.scoreLibrary.scores;

        if (displayScores.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/>
                        <circle cx="18" cy="16" r="3"/>
                    </svg>
                    <h3>No scores found</h3>
                    <p>${scores !== null ? 'Try adjusting your filters' : 'Import sheet music to get started with practice'}</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = displayScores.map((score, index) => `
            <div class="library-card ${score.isIMSLP ? 'imslp-card' : ''}" data-id="${score.id}" data-index="${index}" tabindex="0" role="option">
                <div class="library-card-thumbnail">
                    ${score.thumbnail ? `<img data-src="${score.thumbnail}" alt="" class="lazy-thumbnail" loading="lazy">` : `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    `}
                    ${score.isIMSLP ? '<span class="imslp-badge">IMSLP</span>' : ''}
                </div>
                <h3 class="library-card-title">${score.title}</h3>
                <p class="library-card-composer">${score.composer}</p>
                <div class="library-card-meta">
                    <span class="instrument-badge">${score.instrument || 'Violin'}</span>
                    <span class="difficulty-stars">${this.generateDifficultyStars(score.difficulty)}</span>
                    <button class="share-btn" data-id="${score.id}" title="Share score" aria-label="Share ${score.title}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="18" cy="5" r="3"/>
                            <circle cx="6" cy="12" r="3"/>
                            <circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                    </button>
                </div>
                <div class="library-card-stats">
                    <span class="practice-count">${score.practiceCount || 0} practices</span>
                    <span class="last-practiced">${this.formatLastPracticed(score.lastPracticed)}</span>
                </div>
            </div>
        `).join('');

        this.setupLazyLoading();

        grid.querySelectorAll('.library-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.share-btn')) return;
                const id = card.dataset.id;
                const isIMSLP = card.classList.contains('imslp-card');
                if (isIMSLP) {
                    this.handleIMSLPCardClick(card, id);
                } else {
                    this.selectScore(id);
                }
            });
        });

        grid.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.shareScore(id);
            });
        });
    }

    /**
     * Handle IMSLP card click
     */
    async handleIMSLPCardClick(cardElement, imslpId) {
        const confirmed = confirm('Add this IMSLP score to your local library?');
        if (confirmed) {
            alert('IMSLP download functionality - Score added to library!');
        }
    }

    /**
     * Share a score from the library
     */
    async shareScore(id) {
        const score = this.scoreLibrary.scores.find(s => s.id === id);
        if (!score) {
            alert('Score not found');
            return;
        }

        const shareData = {
            title: score.title,
            composer: score.composer,
            instrument: score.instrument,
            difficulty: score.difficulty
        };

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${shareData.title} by ${shareData.composer}`,
                    text: `Check out this sheet music: ${shareData.title}`,
                    url: window.location.href
                });
                return;
            } catch (err) {
                console.log('Share cancelled:', err);
            }
        }

        const shareText = `${shareData.title} by ${shareData.composer} (${shareData.instrument}, ${shareData.difficulty} stars)`;
        try {
            await navigator.clipboard.writeText(shareText);
            alert('Score info copied to clipboard!');
        } catch (err) {
            prompt('Copy this to share:', shareText);
        }
    }

    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target.querySelector('.lazy-thumbnail');
                        if (img && img.dataset.src) {
                            img.src = img.dataset.src;
                            img.classList.add('loaded');
                            observer.unobserve(entry.target);
                        }
                    }
                });
            }, { rootMargin: '50px' });

            document.querySelectorAll('.library-card').forEach(card => {
                observer.observe(card);
            });
        }
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

        // Teacher mode toggle
        const teacherToggle = document.getElementById('teacher-mode-toggle');
        if (teacherToggle) {
            // Restore saved state
            const savedTeacherMode = localStorage.getItem('teacher_mode') === 'true';
            if (savedTeacherMode) {
                teacherToggle.classList.add('active');
                teacherToggle.setAttribute('aria-checked', 'true');
            }

            teacherToggle.addEventListener('click', () => {
                const isActive = teacherToggle.classList.toggle('active');
                teacherToggle.setAttribute('aria-checked', isActive ? 'true' : 'false');
                localStorage.setItem('teacher_mode', isActive ? 'true' : 'false');
                this.toggleTeacherMode(isActive);
            });
        }
    }

    updateInstrumentSettings() {
        // Adjust pitch detection range based on instrument
        const range = this.pitchDetector.getInstrumentRange(this.selectedInstrument);
        this.pitchDetector.minFrequency = range.min;
        this.pitchDetector.maxFrequency = range.max;
    }

    // ============================================
    // Teacher Mode / Studio Dashboard
    // ============================================

    initTeacherMode() {
        const savedTeacherMode = localStorage.getItem('teacher_mode') === 'true';
        if (savedTeacherMode) {
            this.toggleTeacherMode(true);
        }
    }

    async toggleTeacherMode(enabled) {
        this.isTeacherMode = enabled;

        // Show/hide studio nav link
        const studioNavLinks = document.querySelectorAll('.studio-nav-link');
        studioNavLinks.forEach(link => {
            link.style.display = enabled ? '' : 'none';
        });

        // Show/hide the studio dashboard view
        const studioView = document.getElementById('studio-dashboard-view');
        if (studioView) {
            studioView.style.display = enabled ? '' : 'none';
        }

        // Show/hide assignments section
        const assignmentsSection = document.getElementById('assignments-section');
        if (assignmentsSection) {
            assignmentsSection.style.display = enabled ? '' : 'none';
        }

        if (enabled && !this.studioDashboard) {
            // Initialize teacher service and dashboard on first enable
            this.teacherService = new TeacherService();
            this.studioDashboard = new StudioDashboard(this.teacherService);
            await this.studioDashboard.init();

            // Initialize AssignmentService and AssignmentUI for Smart Assignments
            this.assignmentService = new AssignmentService();
            this.assignmentUI = new AssignmentUI(this.assignmentService, this.teacherService, this.scoreLibrary);
            await this.assignmentUI.init();
        } else if (enabled && this.studioDashboard) {
            await this.studioDashboard.refresh();
        }

        // Initialize Up Next widget for students (when not in teacher mode)
        if (!enabled) {
            await this.initStudentWidget();
        }
    }

    async initStudentWidget() {
        // Initialize Up Next widget for student view
        if (!this.upNextWidget) {
            this.assignmentService = new AssignmentService();
            this.upNextWidget = new UpNextWidget(this.assignmentService);
            await this.upNextWidget.init();

            // Show the widget
            const widgetContainer = document.getElementById('up-next-widget');
            if (widgetContainer) {
                widgetContainer.style.display = '';
            }
        } else {
            await this.upNextWidget.refresh();
        }
    }

    // ============================================
    // License Service
    // ============================================

    async initLicense() {
        // Initialize license service
        if (!this.licenseService) {
            this.licenseService = new LicenseService(this.apiBaseUrl);
            this.licenseService.init();
        }

        // Initialize license UI
        if (!this.licenseUI) {
            this.licenseUI = new StudioLicenseUI(
                this.licenseService,
                this.authService,
                () => this.applyFeatureGating() // Callback to re-apply feature gating on license change
            );
            await this.licenseUI.init();
        }

        // Apply feature gating
        this.applyFeatureGating();
    }

    /**
     * Apply feature gating based on license status
     */
    applyFeatureGating() {
        if (!this.licenseService) return;

        // Feature gating for navigation and UI elements
        const featuresToGate = [
            { id: 'studioDashboard', selector: '.studio-nav-link' },
            { id: 'aiCoach', selector: '#ai-coach-toggle, .ai-coach-section' },
            { id: 'heatMap', selector: '#heatmap-btn' },
            { id: 'omrScanner', selector: '#scan-music-btn' },
            { id: 'communityLibrary', selector: '#library-upload-btn' },
            { id: 'scaleEngine', selector: '#scale-engine-btn' },
            { id: 'annotations', selector: '#annotation-toolbar' },
            { id: 'teacherReports', selector: '#generate-report-btn' },
            { id: 'videoSnippets', selector: '#video-snippet-btn' },
            { id: 'bluetoothPedal', selector: '#bluetooth-pedal-toggle' },
            { id: 'advancedDSP', selector: '.advanced-dsp-toggle' }
        ];

        featuresToGate.forEach(feature => {
            const hasFeature = this.licenseService.hasFeature(feature.id);
            document.querySelectorAll(feature.selector).forEach(el => {
                // Only apply gating if element wasn't explicitly hidden by other code
                // Use data attribute to track explicit hides vs license-gated hides
                if (el.dataset.explicitHide === 'true') return;
                el.style.display = hasFeature ? '' : 'none';
            });
        });

        // Show/hide studio dashboard based on license
        const tier = this.licenseService.getTier();
        const studioNavLinks = document.querySelectorAll('.studio-nav-link');
        studioNavLinks.forEach(link => {
            // Show studio dashboard if pro/studio or teacher mode enabled
            link.style.display = (tier === 'pro' || tier === 'studio' || this.isTeacherMode) ? '' : 'none';
        });
    }

    // ============================================
    // Video Snippet / Office Hours Drop
    // ============================================

    initVideoSnippets() {
        // Video snippet button in practice view
        const videoSnippetBtn = document.getElementById('video-snippet-btn');
        const videoSnippetModal = document.getElementById('video-snippet-modal');
        const videoSnippetClose = document.getElementById('video-snippet-close');
        const cancelVideoBtn = document.getElementById('cancel-video-btn');
        const submitVideoBtn = document.getElementById('submit-video-btn');
        const startRecordBtn = document.getElementById('start-record-btn');
        const videoPreview = document.getElementById('video-preview');
        const videoOverlay = document.getElementById('video-overlay');
        const recordingIndicator = document.getElementById('recording-indicator');
        const recordingTime = document.getElementById('recording-time');
        const videoForm = document.getElementById('video-form');
        const snippetTitle = document.getElementById('snippet-title');
        const snippetNotes = document.getElementById('snippet-notes');

        // Teacher inbox elements
        const teacherInboxModal = document.getElementById('teacher-inbox-modal');
        const inboxClose = document.getElementById('inbox-close');
        const inboxTabs = document.querySelectorAll('.inbox-tab');

        // Video reply elements
        const videoReplyModal = document.getElementById('video-reply-modal');
        const replyClose = document.getElementById('reply-close');
        const cancelReplyBtn = document.getElementById('cancel-reply-btn');
        const sendReplyBtn = document.getElementById('send-reply-btn');
        const replyTypeBtns = document.querySelectorAll('.reply-type-btn');
        const replyText = document.getElementById('reply-text');
        const voiceReplyRecorder = document.getElementById('voice-reply-recorder');
        const voiceRecordBtn = document.getElementById('voice-record-btn');

        let currentRecording = null;
        let isRecording = false;

        // Open video snippet modal
        if (videoSnippetBtn && videoSnippetModal) {
            videoSnippetBtn.addEventListener('click', async () => {
                this.openModal(videoSnippetModal);
                await this.startVideoPreview(videoPreview, videoOverlay, startRecordBtn);
            });
        }

        // Close video snippet modal
        const closeVideoModal = () => {
            this.closeModal(videoSnippetModal);
            this.stopVideoPreview();
            resetVideoRecorder();
        };

        if (videoSnippetClose) videoSnippetClose.addEventListener('click', closeVideoModal);
        if (cancelVideoBtn) cancelVideoBtn.addEventListener('click', closeVideoModal);

        // Start recording
        if (startRecordBtn) {
            startRecordBtn.addEventListener('click', async () => {
                if (!window.videoSnippetService) {
                    this.showToast('Video service not available', 'error');
                    return;
                }

                try {
                    await window.videoSnippetService.requestPermissions();
                    window.videoSnippetService.startRecording(videoPreview);
                    isRecording = true;

                    videoOverlay.style.display = 'none';
                    recordingIndicator.style.display = 'flex';

                    // Update time display
                    window.videoSnippetService.onTimeUpdate = (elapsed, max) => {
                        recordingTime.textContent = `0:${elapsed.toString().padStart(2, '0')} / 0:${max.toString().padStart(2, '0')}`;
                    };

                    // Handle recording complete
                    window.videoSnippetService.onRecordingComplete = (recording) => {
                        currentRecording = recording;
                        videoForm.style.display = 'block';
                        submitVideoBtn.style.display = 'inline-block';
                    };
                } catch (error) {
                    this.showToast('Failed to start recording: ' + error.message, 'error');
                }
            });
        }

        // Submit video
        if (submitVideoBtn) {
            submitVideoBtn.addEventListener('click', async () => {
                if (!currentRecording) return;

                try {
                    const studentId = localStorage.getItem('user_id') || 'student-1';
                    const studentName = localStorage.getItem('user_name') || 'Student';

                    await window.videoSnippetService.submitSnippet({
                        studentId,
                        studentName,
                        videoData: currentRecording.videoData,
                        thumbnail: currentRecording.thumbnail,
                        duration: currentRecording.duration,
                        title: snippetTitle.value,
                        notes: snippetNotes.value
                    });

                    this.showToast('Video sent to teacher!', 'success');
                    closeVideoModal();
                } catch (error) {
                    this.showToast('Failed to send video: ' + error.message, 'error');
                }
            });
        }

        // Reset video recorder
        const resetVideoRecorder = () => {
            currentRecording = null;
            isRecording = false;
            videoOverlay.style.display = 'flex';
            recordingIndicator.style.display = 'none';
            videoForm.style.display = 'none';
            submitVideoBtn.style.display = 'none';
            snippetTitle.value = '';
            snippetNotes.value = '';
            recordingTime.textContent = '0:00 / 0:15';
        };

        // Teacher inbox tab switching
        inboxTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                inboxTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const tabName = tab.dataset.tab;
                document.getElementById('inbox-received').style.display = tabName === 'received' ? 'block' : 'none';
                document.getElementById('inbox-sent').style.display = tabName === 'sent' ? 'block' : 'none';
            });
        });

        // Close inbox modal
        if (inboxClose) {
            inboxClose.addEventListener('click', () => this.closeModal(teacherInboxModal));
        }

        // Close reply modal
        if (replyClose) {
            replyClose.addEventListener('click', () => this.closeModal(videoReplyModal));
        }
        if (cancelReplyBtn) {
            cancelReplyBtn.addEventListener('click', () => this.closeModal(videoReplyModal));
        }

        // Reply type switching
        let currentReplyType = 'text';
        let currentSnippetId = null;
        let voiceRecordingData = null;

        replyTypeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                replyTypeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const type = btn.dataset.type;
                currentReplyType = type;
                if (type === 'text') {
                    replyText.style.display = 'block';
                    voiceReplyRecorder.style.display = 'none';
                } else {
                    replyText.style.display = 'none';
                    voiceReplyRecorder.style.display = 'flex';
                }
            });
        });

        // Send reply
        if (sendReplyBtn) {
            sendReplyBtn.addEventListener('click', async () => {
                if (!currentSnippetId) {
                    this.showToast('No snippet selected', 'error');
                    return;
                }

                try {
                    let replyTextValue = null;
                    let replyVoiceDataValue = null;

                    if (currentReplyType === 'text') {
                        replyTextValue = replyText.value.trim();
                        if (!replyTextValue) {
                            this.showToast('Please enter a reply', 'error');
                            return;
                        }
                    } else {
                        replyVoiceDataValue = voiceRecordingData;
                        if (!replyVoiceDataValue) {
                            this.showToast('Please record a voice note', 'error');
                            return;
                        }
                    }

                    await window.videoSnippetService.submitReply(
                        currentSnippetId,
                        replyTextValue,
                        replyVoiceDataValue,
                        currentReplyType
                    );

                    this.showToast('Reply sent!', 'success');
                    this.closeModal(videoReplyModal);
                    replyText.value = '';
                    voiceRecordingData = null;
                    currentSnippetId = null;

                    // Refresh inbox
                    this.loadTeacherInbox();
                } catch (error) {
                    this.showToast('Failed to send reply: ' + error.message, 'error');
                }
            });
        }

        // Load teacher inbox data
        this.loadTeacherInbox = async () => {
            try {
                const response = await window.videoSnippetService.getAllSnippets();
                this.renderTeacherInbox(response.snippets);
            } catch (error) {
                console.error('Failed to load inbox:', error);
            }
        };

        // Render teacher inbox
        this.renderTeacherInbox = (snippets) => {
            const receivedList = document.getElementById('received-snippets-list');
            if (!receivedList) return;

            receivedList.innerHTML = '';

            if (snippets.length === 0) {
                document.getElementById('inbox-empty-received').style.display = 'block';
                return;
            }

            document.getElementById('inbox-empty-received').style.display = 'none';

            snippets.forEach(snippet => {
                const item = document.createElement('div');
                item.className = 'inbox-item';
                item.innerHTML = `
                    <img class="inbox-item-thumb" src="${snippet.thumbnail || ''}" alt="">
                    <div class="inbox-item-info">
                        <div class="inbox-item-title">${snippet.title || 'Untitled'}</div>
                        <div class="inbox-item-meta">
                            ${snippet.studentName}
                            <span class="inbox-item-status ${snippet.status}">${snippet.status}</span>
                        </div>
                    </div>
                `;
                item.addEventListener('click', () => this.openReplyModal(snippet));
                receivedList.appendChild(item);
            });
        };

        // Open reply modal
        this.openReplyModal = (snippet) => {
            currentSnippetId = snippet.id;
            const videoPlayer = document.getElementById('reply-video-player');
            if (videoPlayer && snippet.videoData) {
                // Convert base64 to blob URL
                const blob = this.base64ToBlob(snippet.videoData, 'video/webm');
                videoPlayer.src = URL.createObjectURL(blob);
            }
            this.openModal(videoReplyModal);
        };

        // Convert base64 to blob
        this.base64ToBlob = (base64, mimeType) => {
            const byteCharacters = atob(base64.split(',')[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            return new Blob([byteArray], { type: mimeType });
        };

        // Load student's sent snippets
        this.loadStudentSnippets = async () => {
            try {
                const studentId = localStorage.getItem('user_id') || 'student-1';
                const response = await window.videoSnippetService.getSnippets(studentId);
                this.renderStudentSnippets(response.snippets);
            } catch (error) {
                console.error('Failed to load student snippets:', error);
            }
        };

        // Render student sent snippets
        this.renderStudentSnippets = (snippets) => {
            const sentList = document.getElementById('sent-snippets-list');
            if (!sentList) return;

            sentList.innerHTML = '';

            if (snippets.length === 0) {
                document.getElementById('inbox-empty-sent').style.display = 'block';
                return;
            }

            document.getElementById('inbox-empty-sent').style.display = 'none';

            snippets.forEach(snippet => {
                const card = document.createElement('div');
                card.className = 'sent-snippet-card';

                const hasReply = snippet.teacherReply && snippet.teacherReply.length > 0;

                card.innerHTML = `
                    <img class="sent-snippet-thumb" src="${snippet.thumbnail || ''}" alt="">
                    <div class="sent-snippet-info">
                        <div class="sent-snippet-title">${snippet.title || 'Untitled'}</div>
                        <div class="sent-snippet-meta">
                            ${new Date(snippet.submittedAt).toLocaleDateString()}
                            <span class="sent-snippet-status ${snippet.status}">${snippet.status}</span>
                        </div>
                        ${hasReply ? `<div class="sent-snippet-reply">${snippet.replyType === 'voice' ? 'Voice reply received' : snippet.teacherReply}</div>` : ''}
                    </div>
                `;
                sentList.appendChild(card);
            });
        };

        // Listen for tab changes to load student snippets
        inboxTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                if (tab.dataset.tab === 'sent') {
                    this.loadStudentSnippets();
                }
            });
        });
    }

    async startVideoPreview(videoElement, overlay, startBtn) {
        if (!window.videoSnippetService) return;

        try {
            await window.videoSnippetService.requestPermissions();
            const stream = window.videoSnippetService.getStream();
            if (videoElement && stream) {
                videoElement.srcObject = stream;
                videoElement.play();
            }
            if (overlay && startBtn) {
                overlay.style.display = 'flex';
            }
        } catch (error) {
            this.showToast('Camera access denied', 'error');
        }
    }

    stopVideoPreview() {
        if (window.videoSnippetService) {
            window.videoSnippetService.stopPreview();
        }
    }

    // ============================================
    // Cross-Feature Integration
    // ============================================

    updateCursorSpeed(position) {
        const now = Date.now();
        if (this.lastCursorPosition !== null && this.lastCursorTime > 0) {
            const timeDelta = now - this.lastCursorTime;
            if (timeDelta > 0) {
                const positionDelta = Math.abs(position - this.lastCursorPosition);
                // Calculate speed as positions per second
                this.cursorSpeed = (positionDelta / timeDelta) * 1000;
            }
        }
        this.lastCursorPosition = position;
        this.lastCursorTime = now;

        // Apply cursor speed to rhythm analysis (affects sensitivity)
        if (this.rhythmAnalyzer) {
            const tempo = this.metronome?.bpm || 120;
            this.rhythmAnalyzer.setTempo(tempo);
            // Higher speed = more lenient timing analysis
            const sensitivityMultiplier = Math.max(0.5, Math.min(1.5, 1 + (this.cursorSpeed / 100)));
            this.rhythmAnalyzer.timingSensitivity = sensitivityMultiplier;
        }
    }

    zoomLibrary(direction) {
        // Zoom in/out during cursor/focus movement
        const minZoom = 0.8;
        const maxZoom = 1.5;
        const zoomStep = 0.1;

        if (direction === 'in') {
            this.libraryZoomLevel = Math.min(maxZoom, this.libraryZoomLevel + zoomStep);
        } else if (direction === 'out') {
            this.libraryZoomLevel = Math.max(minZoom, this.libraryZoomLevel - zoomStep);
        }

        // Apply zoom to library cards
        const grid = document.getElementById('library-grid');
        if (grid) {
            grid.style.transform = `scale(${this.libraryZoomLevel})`;
            grid.style.transformOrigin = 'top left';
        }
    }

    persistThreeAxisScores() {
        // Persist three-axis scores with session data
        if (!this.sessionData) return;

        // Calculate three-axis scores: pitch, timing, rhythm
        const pitchScore = this.sessionData.pitchAccuracy.length > 0
            ? this.sessionData.pitchAccuracy.reduce((a, b) => a + b, 0) / this.sessionData.pitchAccuracy.length
            : 0;

        const timingScore = this.sessionData.timingAccuracy.length > 0
            ? this.sessionData.timingAccuracy.reduce((a, b) => a + b, 0) / this.sessionData.timingAccuracy.length
            : pitchScore;

        // Rhythm score based on beat deviation
        const rhythmScore = this.rhythmAnalyzer
            ? this.rhythmAnalyzer.calculateBeatDeviation()
            : timingScore;

        this.sessionData.threeAxisScores = {
            pitch: Math.round(pitchScore),
            timing: Math.round(timingScore),
            rhythm: Math.round(rhythmScore)
        };

        // Store in localStorage for persistence across sessions
        try {
            const history = JSON.parse(localStorage.getItem('sessionHistory') || '[]');
            history.push({
                scoreId: this.currentScore?.id,
                timestamp: Date.now(),
                scores: this.sessionData.threeAxisScores
            });
            // Keep last 50 sessions
            if (history.length > 50) {
                history.shift();
            }
            localStorage.setItem('sessionHistory', JSON.stringify(history));
        } catch (e) {
            console.warn('Could not persist session data:', e);
        }
    }

    // ============================================
    // Accessibility
    // ============================================

    initAccessibility() {
        // Create live region for screen reader announcements
        this.liveRegion = document.createElement('div');
        this.liveRegion.setAttribute('aria-live', 'polite');
        this.liveRegion.setAttribute('aria-atomic', 'true');
        this.liveRegion.className = 'sr-only';
        this.liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;';
        document.body.appendChild(this.liveRegion);

        // Setup keyboard navigation for library
        this.setupLibraryKeyboardNav();

        // Add ARIA labels to feedback panel
        this.setupFeedbackPanelARIA();
    }

    announceToScreenReader(message) {
        if (this.liveRegion) {
            this.liveRegion.textContent = '';
            setTimeout(() => {
                this.liveRegion.textContent = message;
            }, 100);
        }
    }

    setupLibraryKeyboardNav() {
        const grid = document.getElementById('library-grid');
        if (!grid) return;

        // Make grid focusable
        grid.setAttribute('tabindex', '0');
        grid.setAttribute('role', 'listbox');
        grid.setAttribute('aria-label', 'Music library');

        document.addEventListener('keydown', (e) => {
            // Only handle navigation when library view is active
            if (!this.views.library?.classList.contains('active')) return;

            const cards = grid.querySelectorAll('.library-card');
            if (cards.length === 0) return;

            switch (e.key) {
                case 'ArrowRight':
                case 'ArrowDown':
                    e.preventDefault();
                    this.focusedCardIndex = Math.min(this.focusedCardIndex + 1, cards.length - 1);
                    this.focusLibraryCard(cards);
                    this.zoomLibrary('in');
                    break;
                case 'ArrowLeft':
                case 'ArrowUp':
                    e.preventDefault();
                    this.focusedCardIndex = Math.max(this.focusedCardIndex - 1, 0);
                    this.focusLibraryCard(cards);
                    this.zoomLibrary('out');
                    break;
                case 'Enter':
                case ' ':
                    if (this.focusedCardIndex >= 0 && cards[this.focusedCardIndex]) {
                        e.preventDefault();
                        cards[this.focusedCardIndex].click();
                    }
                    break;
                case 'Home':
                    e.preventDefault();
                    this.focusedCardIndex = 0;
                    this.focusLibraryCard(cards);
                    break;
                case 'End':
                    e.preventDefault();
                    this.focusedCardIndex = cards.length - 1;
                    this.focusLibraryCard(cards);
                    break;
            }
        });
    }

    focusLibraryCard(cards) {
        cards.forEach((card, index) => {
            card.classList.toggle('focused', index === this.focusedCardIndex);
            card.setAttribute('aria-selected', index === this.focusedCardIndex ? 'true' : 'false');
            if (index === this.focusedCardIndex) {
                card.focus();
            }
        });
    }

    setupFeedbackPanelARIA() {
        const feedbackPanel = document.querySelector('.feedback-panel');
        if (feedbackPanel) {
            feedbackPanel.setAttribute('role', 'region');
            feedbackPanel.setAttribute('aria-label', 'Performance feedback');

            // Add ARIA labels to indicators
            const pitchIndicator = feedbackPanel.querySelector('.pitch-indicator');
            if (pitchIndicator) {
                pitchIndicator.setAttribute('role', 'group');
                pitchIndicator.setAttribute('aria-label', 'Pitch accuracy indicator');
            }

            const timingIndicator = feedbackPanel.querySelector('.timing-indicator');
            if (timingIndicator) {
                timingIndicator.setAttribute('role', 'group');
                timingIndicator.setAttribute('aria-label', 'Timing accuracy indicator');
            }

            const scoreDisplay = feedbackPanel.querySelector('.score-display');
            if (scoreDisplay) {
                scoreDisplay.setAttribute('aria-live', 'polite');
            }
        }
    }

    announceScoreChange(score) {
        if (score !== undefined) {
            this.announceToScreenReader(`Score updated: ${Math.round(score)}%`);
        } else if (this.currentScore) {
            this.announceToScreenReader(`Selected: ${this.currentScore.title} by ${this.currentScore.composer}. Ready to practice.`);
        }
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

        grid.innerHTML = scores.map((score, index) => `
            <div class="library-card" data-id="${score.id}" data-index="${index}" tabindex="0" role="option">
                <div class="library-card-thumbnail">
                    ${score.thumbnail ? `<img data-src="${score.thumbnail}" alt="" class="lazy-thumbnail" loading="lazy">` : `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    `}
                </div>
                <h3 class="library-card-title">${score.title}</h3>
                <p class="library-card-composer">${score.composer}</p>
                <div class="library-card-meta">
                    <span class="instrument-badge">${score.instrument || 'Violin'}</span>
                    <span>${this.formatDate(score.addedAt)}</span>
                </div>
            </div>
        `).join('');

        // Setup lazy loading with IntersectionObserver
        this.setupLazyLoading();

        // Add click handlers
        grid.querySelectorAll('.library-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                this.selectScore(id);
            });
        });
    }

    setupLazyLoading() {
        // Use IntersectionObserver for lazy loading thumbnails
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target.querySelector('.lazy-thumbnail');
                        if (img && img.dataset.src) {
                            img.src = img.dataset.src;
                            img.classList.add('loaded');
                            observer.unobserve(entry.target);
                        }
                    }
                });
            }, { rootMargin: '50px' });

            document.querySelectorAll('.library-card').forEach(card => {
                observer.observe(card);
            });
        }
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

        // Remove session-ended state from sheet music container
        const sheetContainer = document.getElementById('sheet-music-container');
        if (sheetContainer) {
            sheetContainer.classList.remove('session-ended');
        }

        // Set annotation score ID for cloud sync
        if (this.annotationService) {
            this.annotationService.setScoreId(score.id || score.title);
        }

        // Set up performance comparator with the score
        this.performanceComparator.setScore(score);

        // Render sheet music
        if (this.sheetMusicRenderer) {
            this.sheetMusicRenderer.setScore(score);
        }

        // Sync total measures to Bluetooth pedal listener
        if (this.bluetoothHIDListener && score.parts && score.parts[0]) {
            const totalMeasures = score.parts[0].measures ? score.parts[0].measures.length : 1;
            this.bluetoothHIDListener.setTotalMeasures(totalMeasures);
            this.bluetoothHIDListener.setCurrentMeasure(0);
        }

        // Update UI
        const titleEl = document.getElementById('current-piece-title');
        if (titleEl) titleEl.textContent = score.title;

        const startBtn = document.getElementById('start-practice-btn');
        if (startBtn) startBtn.disabled = false;

        // Switch to practice view
        this.showView('practice-view');

        // Announce score change to screen readers
        this.announceScoreChange();
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

        // Reset analyzers for new session
        this.rhythmAnalyzer.reset();
        this.intonationAnalyzer.reset();

        this.showToast('Practice started - play your instrument', 'success');
    }

    stopPractice() {
        this.isPracticing = false;
        this.audioEngine.stopListening();

        // Persist three-axis scores before ending session
        this.persistThreeAxisScores();

        // Calculate final scores
        const finalScore = this.accuracyScorer.calculateOverall(this.sessionData);

        // Add session-ended state to sheet music container
        const sheetContainer = document.getElementById('sheet-music-container');
        if (sheetContainer) {
            sheetContainer.classList.add('session-ended');
        }

        // Reset cursor when practice ends
        if (this.followTheBall) {
            this.followTheBall.reset();
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
            // Record note onset for rhythm analysis
            const noteTimestamp = Date.now();
            this.rhythmAnalyzer.recordNoteOnset(noteTimestamp);

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
                        result.timestamp = noteTimestamp;

                        // Record to intonation analyzer
                        this.intonationAnalyzer.recordNote(result);

                        // Calculate rhythm score and record
                        const rhythmScore = this.rhythmAnalyzer.calculateOverallTiming();
                        this.intonationAnalyzer.recordRhythmScore(rhythmScore);

                        // Store in session data
                        if (this.sessionData) {
                            this.sessionData.pitchAccuracy.push(accuracy);
                            this.sessionData.timingAccuracy.push(rhythmScore);
                            this.sessionData.notes.push({
                                note: result,
                                timestamp: noteTimestamp,
                                measure: measure,
                                accuracy: accuracy,
                                rhythmScore: rhythmScore,
                                matched: comparison.matched
                            });
                        }

                        // Debounced rhythm analysis - only analyze every 500ms
                        this.debouncedRhythmAnalysis(result);
                    }
                }

                // Update cursor position and track speed for rhythm analysis
                const progress = this.performanceComparator.getProgress();
                this.updateCursorSpeed(progress);

                if (this.sheetMusicRenderer) {
                    this.sheetMusicRenderer.setCursorPosition(progress);
                }

                // Update follow-the-ball cursor
                if (this.followTheBall && this.followTheBall.enabled) {
                    this.followTheBall.setTargetPosition(
                        this.performanceComparator.getProgress()
                    );

                    // Trigger bounce on note detection
                    this.followTheBall.onNoteDetected();
                }
            }

            // Update UI with current note
            this.updateFeedbackDisplay(result);
        }
    }

    debouncedRhythmAnalysis(result) {
        if (this.rhythmAnalysisDebounce) {
            clearTimeout(this.rhythmAnalysisDebounce);
        }

        this.rhythmAnalysisDebounce = setTimeout(() => {
            if (this.rhythmAnalyzer && result) {
                this.rhythmAnalyzer.recordNoteOnset(Date.now());
                const timingScore = this.rhythmAnalyzer.calculateOverallTiming();

                if (this.sessionData) {
                    this.sessionData.timingAccuracy.push(timingScore);
                }
            }
        }, 500);
    }

    updateFeedbackDisplay(noteInfo) {
        const noteDisplay = document.getElementById('current-note');
        const octaveDisplay = document.getElementById('current-octave');
        const accuracyScore = document.getElementById('accuracy-score');
        const pitchMarker = document.getElementById('pitch-marker');
        const centsDisplay = document.getElementById('cents-display');
        const timingDisplay = document.getElementById('timing-display');

        // Get three-axis scores
        const intonationScores = this.intonationAnalyzer.calculateIntonationScore();
        const timingDeviation = this.intonationAnalyzer.getTimingDeviation();

        if (noteDisplay) {
            noteDisplay.textContent = noteInfo.name;
        }
        if (octaveDisplay) {
            octaveDisplay.textContent = noteInfo.octave;
        }

        // Use three-axis combined score for accuracy display
        const combinedScore = intonationScores.overall;
        if (accuracyScore) {
            // Animate score transition
            this.animateScoreChange(accuracyScore, combinedScore);
        }

        // Update pitch meter (center is 0 cents)
        if (pitchMarker && centsDisplay) {
            const cents = noteInfo.centsDeviation || 0;
            const percent = Math.max(-50, Math.min(50, cents)) + 50;
            pitchMarker.style.left = percent + '%';
            centsDisplay.textContent = (cents > 0 ? '+' : '') + cents + '¢';

            // Color based on accuracy - emerald for good, crimson for poor
            if (Math.abs(cents) <= 10) {
                pitchMarker.style.backgroundColor = '#10b981'; // emerald
            } else if (Math.abs(cents) <= 25) {
                pitchMarker.style.backgroundColor = '#f59e0b'; // amber
            } else {
                pitchMarker.style.backgroundColor = '#ef4444'; // crimson
            }
        }

        // Update timing display with actual milliseconds
        if (timingDisplay) {
            const ms = timingDeviation;
            const sign = ms > 0 ? '+' : '';
            timingDisplay.textContent = sign + ms + 'ms';

            // Color based on timing accuracy
            if (Math.abs(ms) <= 50) {
                timingDisplay.style.color = '#10b981'; // emerald
            } else if (Math.abs(ms) <= 100) {
                timingDisplay.style.color = '#f59e0b'; // amber
            } else {
                timingDisplay.style.color = '#ef4444'; // crimson
            }
        }

        // Update intonation indicator if present
        const intonationIndicator = document.getElementById('intonation-indicator');
        if (intonationIndicator) {
            intonationIndicator.textContent = Math.round(intonationScores.overall) + '%';
            intonationIndicator.style.color = IntonationAnalyzer.getScoreColor(intonationScores.overall);
        }
    }

    /**
     * Animate score value change with smooth transition
     */
    animateScoreChange(element, targetScore) {
        const currentText = element.textContent;
        const currentScore = parseInt(currentText) || 0;
        const duration = 300;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const score = Math.round(currentScore + (targetScore - currentScore) * easeProgress);

            element.textContent = score + '%';

            // Update color based on score
            if (score >= 80) {
                element.style.color = '#10b981'; // emerald
            } else if (score >= 60) {
                element.style.color = '#f59e0b'; // amber
            } else {
                element.style.color = '#ef4444'; // crimson
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    showSessionSummary(score) {
        const modal = document.getElementById('session-summary-modal');
        if (!modal) return;

        // Get intonation analysis for three-axis breakdown
        const intonationScores = this.intonationAnalyzer.calculateIntonationScore();
        const weakestAxis = this.intonationAnalyzer.getWeakestAxis();

        // Update summary data with three-axis scores
        document.getElementById('final-score').textContent = Math.round(intonationScores.overall) + '%';
        document.getElementById('pitch-accuracy').textContent = Math.round(intonationScores.pitch) + '%';
        document.getElementById('timing-accuracy').textContent = Math.round(intonationScores.rhythm) + '%';

        // Add intonation accuracy if element exists
        const intonationAccuracyEl = document.getElementById('intonation-accuracy');
        if (intonationAccuracyEl) {
            intonationAccuracyEl.textContent = Math.round(intonationScores.transition) + '%';
        }

        const duration = this.sessionData?.startTime ? Date.now() - this.sessionData.startTime : 0;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        document.getElementById('session-duration').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Add recommendation based on weakest axis
        this.addRecommendation(weakestAxis);

        // Render radar chart for three-axis visualization
        this.renderRadarChart(intonationScores);

        // Update heat map with session data
        if (this.heatMapRenderer && this.sessionData) {
            this.heatMapRenderer.setData(this.sessionData);
            this.heatMapRenderer.render();
        }

        // Show modal
        modal.classList.add('active');
    }

    /**
     * Add recommendation based on weakest performance axis
     */
    addRecommendation(weakestAxis) {
        const recommendations = {
            pitch: 'Focus on pitch accuracy: Use a tuner to train your ear for correct intonation. Pay attention to finger placement.',
            rhythm: 'Work on timing: Practice with a metronome at slower tempos. Focus on maintaining steady beat throughout.',
            intonation: 'Improve note transitions: Practice scales and arpeggios slowly, focusing on smooth connections between notes.'
        };

        const recommendationEl = document.getElementById('session-recommendation');
        if (recommendationEl) {
            recommendationEl.textContent = recommendations[weakestAxis.name] || '';
            recommendationEl.style.display = recommendationEl.textContent ? 'block' : 'none';
        }
    }

    /**
     * Render radar chart for three-axis visualization
     */
    renderRadarChart(scores) {
        const canvas = document.getElementById('radar-chart-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 20;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background circles
        ctx.strokeStyle = '#2a2a3a';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * (i / 4), 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw axis lines and labels
        const axes = [
            { label: 'Pitch', value: scores.pitch, angle: -Math.PI / 2 },
            { label: 'Rhythm', value: scores.rhythm, angle: Math.PI / 6 },
            { label: 'Intonation', value: scores.transition, angle: Math.PI * 5 / 6 }
        ];

        ctx.strokeStyle = '#3a3a4a';
        ctx.fillStyle = '#a0a0b0';
        ctx.font = '12px Source Sans 3';
        ctx.textAlign = 'center';

        axes.forEach((axis) => {
            const x = centerX + Math.cos(axis.angle) * radius;
            const y = centerY + Math.sin(axis.angle) * radius;

            // Draw axis line
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.stroke();

            // Draw label
            const labelX = centerX + Math.cos(axis.angle) * (radius + 15);
            const labelY = centerY + Math.sin(axis.angle) * (radius + 15);
            ctx.fillText(axis.label, labelX, labelY + 4);
        });

        // Draw data polygon
        ctx.beginPath();
        ctx.fillStyle = 'rgba(16, 185, 129, 0.3)'; // emerald with opacity
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;

        axes.forEach((axis, index) => {
            const valueRadius = (axis.value / 100) * radius;
            const x = centerX + Math.cos(axis.angle) * valueRadius;
            const y = centerY + Math.sin(axis.angle) * valueRadius;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw data points
        axes.forEach((axis) => {
            const valueRadius = (axis.value / 100) * radius;
            const x = centerX + Math.cos(axis.angle) * valueRadius;
            const y = centerY + Math.sin(axis.angle) * valueRadius;

            ctx.beginPath();
            ctx.fillStyle = IntonationAnalyzer.getScoreColor(axis.value);
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
        });
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

    // ============================================
    // OMR Scanner Modal Methods
    // ============================================

    setupScannerModal() {
        const scannerModal = document.getElementById('scanner-modal');
        if (!scannerModal) return;

        // Tab switching
        document.querySelectorAll('.scanner-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchScannerTab(tabName);
            });
        });

        // Upload zone click
        const uploadZone = document.getElementById('upload-zone');
        const fileInput = document.getElementById('scanner-file-input');

        uploadZone?.addEventListener('click', () => {
            fileInput?.click();
        });

        // Drag and drop
        uploadZone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone?.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });

        uploadZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            const files = e.dataTransfer?.files;
            if (files?.length) {
                this.handleScannerFile(files[0]);
            }
        });

        // File input change
        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                this.handleScannerFile(file);
            }
        });

        // Remove selected file
        document.getElementById('remove-selected-file')?.addEventListener('click', () => {
            this.clearScannerFile();
        });

        // Cancel button
        document.getElementById('cancel-scanner-btn')?.addEventListener('click', () => {
            this.closeScannerModal();
        });

        // Close button
        document.getElementById('scanner-close-btn')?.addEventListener('click', () => {
            this.closeScannerModal();
        });

        // Process scan button
        document.getElementById('process-scan-btn')?.addEventListener('click', () => {
            this.processScan();
        });

        // Retry button
        document.getElementById('retry-scan-btn')?.addEventListener('click', () => {
            this.retryScan();
        });

        // Scan another button
        document.getElementById('scan-another-btn')?.addEventListener('click', () => {
            this.scanAnother();
        });

        // Add to library button
        document.getElementById('add-to-library-btn')?.addEventListener('click', () => {
            this.addScannedToLibrary();
        });

        // Open camera button
        document.getElementById('open-camera-btn')?.addEventListener('click', () => {
            this.openCamera();
        });
    }

    openScannerModal() {
        const modal = document.getElementById('scanner-modal');
        if (modal) {
            modal.classList.add('active');
            this.resetScannerModal();
        }
    }

    closeScannerModal() {
        const modal = document.getElementById('scanner-modal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.resetScannerModal();
    }

    resetScannerModal() {
        // Reset state
        this.scannerFile = null;
        this.scannedScore = null;

        // Show upload content
        this.showScannerContent('upload');

        // Clear file selection
        document.getElementById('upload-zone')?.style.removeProperty('display');
        document.getElementById('selected-file')?.style.setProperty('display', 'none');
        const fileInput = document.getElementById('scanner-file-input');
        if (fileInput) fileInput.value = '';

        // Reset process button
        const processBtn = document.getElementById('process-scan-btn');
        if (processBtn) {
            processBtn.disabled = true;
        }

        // Switch to upload tab
        this.switchScannerTab('upload');
    }

    switchScannerTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.scanner-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update content
        document.querySelectorAll('.scanner-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const content = document.getElementById(`scanner-${tabName}-content`);
        if (content) {
            content.classList.add('active');
        }
    }

    showScannerContent(type) {
        // Hide all content sections and actions
        document.getElementById('scanner-upload-content')?.style.setProperty('display', 'none');
        document.getElementById('scanner-camera-content')?.style.setProperty('display', 'none');
        document.getElementById('scanner-processing')?.style.setProperty('display', 'none');
        document.getElementById('scanner-error')?.style.setProperty('display', 'none');
        document.getElementById('scanner-success')?.style.setProperty('display', 'none');
        document.getElementById('scanner-actions')?.style.setProperty('display', 'none');

        // Show requested content
        if (type === 'upload' || type === 'camera') {
            document.getElementById(`scanner-${type}-content`)?.style.removeProperty('display');
            document.getElementById('scanner-actions')?.style.removeProperty('display');
        } else if (type === 'processing') {
            document.getElementById('scanner-processing')?.style.removeProperty('display');
            // Keep actions hidden during processing
        } else if (type === 'error') {
            document.getElementById('scanner-error')?.style.removeProperty('display');
            document.getElementById('scanner-actions')?.style.removeProperty('display');
        } else if (type === 'success') {
            document.getElementById('scanner-success')?.style.removeProperty('display');
            // Keep actions hidden during success (use success-specific buttons)
        }
    }

    handleScannerFile(file) {
        try {
            // Validate file
            const omrClient = new OMRClient();
            omrClient.validateFile(file);

            this.scannerFile = file;

            // Show selected file
            const uploadZone = document.getElementById('upload-zone');
            const selectedFile = document.getElementById('selected-file');

            if (uploadZone) uploadZone.style.display = 'none';
            if (selectedFile) {
                selectedFile.style.display = 'flex';
                const fileName = document.getElementById('selected-file-name');
                const fileSize = document.getElementById('selected-file-size');

                if (fileName) fileName.textContent = file.name;
                if (fileSize) fileSize.textContent = this.formatFileSize(file.size);
            }

            // Enable process button
            const processBtn = document.getElementById('process-scan-btn');
            if (processBtn) processBtn.disabled = false;

        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    clearScannerFile() {
        this.scannerFile = null;

        const uploadZone = document.getElementById('upload-zone');
        const selectedFile = document.getElementById('selected-file');
        const fileInput = document.getElementById('scanner-file-input');
        const processBtn = document.getElementById('process-scan-btn');

        if (uploadZone) uploadZone.style.display = '';
        if (selectedFile) selectedFile.style.display = 'none';
        if (fileInput) fileInput.value = '';
        if (processBtn) processBtn.disabled = true;
    }

    async processScan() {
        if (!this.scannerFile) {
            this.showToast('Please select a file first', 'error');
            return;
        }

        // Show processing state
        this.showScannerContent('processing');

        const omrClient = new OMRClient();

        omrClient.onProgress(({ percent, message }) => {
            this.updateProcessingProgress(percent, message);
        });

        try {
            const score = await omrClient.processFile(this.scannerFile);
            this.scannedScore = score;

            // Show success state
            this.showScannerSuccess(score);

        } catch (error) {
            // Show error state
            this.showScannerError(error.message);
        }
    }

    updateProcessingProgress(percent, message) {
        const progressBar = document.getElementById('processing-progress-bar');
        const percentText = document.getElementById('processing-percent');
        const messageText = document.getElementById('processing-message');

        if (progressBar) progressBar.style.width = `${percent}%`;
        if (percentText) percentText.textContent = `${percent}%`;
        if (messageText) messageText.textContent = message;
    }

    showScannerError(message) {
        const errorEl = document.getElementById('error-message');
        if (errorEl) errorEl.textContent = message;

        this.showScannerContent('error');
    }

    showScannerSuccess(score) {
        const titleEl = document.getElementById('scanned-title');
        const metaEl = document.getElementById('scanned-meta');

        if (titleEl) titleEl.textContent = score.title || 'Scanned Score';
        if (metaEl) {
            const measureCount = score.getTotalMeasures();
            const noteCount = score.getAllNotes().length;
            metaEl.textContent = `${measureCount} measures, ${noteCount} notes`;
        }

        this.showScannerContent('success');
    }

    retryScan() {
        // Clear file and reset DOM, then show upload content
        this.clearScannerFile();
        this.showScannerContent('upload');
    }

    scanAnother() {
        this.resetScannerModal();
    }

    async openCamera() {
        const omrClient = new OMRClient();

        try {
            const imageData = await omrClient.scanFromCamera();

            // Convert to a "file" for processing using existing dataURLToBlob method
            const blob = omrClient.dataURLToBlob(imageData);
            const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });

            this.scannerFile = file;

            // Show selected file
            const uploadZone = document.getElementById('upload-zone');
            const selectedFile = document.getElementById('selected-file');

            if (uploadZone) uploadZone.style.display = 'none';
            if (selectedFile) {
                selectedFile.style.display = 'flex';
                const fileName = document.getElementById('selected-file-name');
                const fileSize = document.getElementById('selected-file-size');

                if (fileName) fileName.textContent = file.name;
                if (fileSize) fileSize.textContent = this.formatFileSize(file.size);
            }

            // Enable process button
            const processBtn = document.getElementById('process-scan-btn');
            if (processBtn) processBtn.disabled = false;

            // Switch back to upload tab and show upload content
            this.switchScannerTab('upload');
            this.showScannerContent('upload');

        } catch (error) {
            if (error.message !== 'Camera scan cancelled') {
                this.showToast(error.message, 'error');
            }
        }
    }

    async addScannedToLibrary() {
        if (!this.scannedScore) {
            this.showToast('No scanned score to add', 'error');
            return;
        }

        try {
            // Get metadata from user
            const title = this.scannedScore.title || 'Scanned Score';
            const composer = this.scannedScore.composer || 'Unknown';

            // Add to library
            await this.scoreLibrary.addScore({
                title: title,
                composer: composer,
                instrument: 'violin',
                difficulty: 3,
                data: this.scannedScore,
                source: 'scanner'
            });

            // Refresh library display
            await this.loadLibrary();

            // Close modal
            this.closeScannerModal();

            this.showToast('Score added to library!', 'success');

        } catch (error) {
            this.showToast('Failed to add score: ' + error.message, 'error');
        }
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ConcertmasterApp();
    window.app.init();
});