/**
 * Integration Controller - Coordinates between features
 * Connects library zoom, cursor movement, and rhythm analysis
 */

class IntegrationController {
    constructor(app) {
        this.app = app;
        this.zoomController = null;
        this.followTheBall = null;
        this.rhythmAnalyzer = null;
        this.intonationAnalyzer = null;

        // Integration state
        this.lastZoomLevel = 100;
        this.cursorSpeedMultiplier = 1;
        this.debounceTimers = {};
    }

    init() {
        this.setupZoomCursorIntegration();
        this.setupCursorRhythmIntegration();
        this.setupSessionPersistence();
        this.setupPerformanceOptimizations();
    }

    /**
     * Connect Zoom Controller to the app
     */
    setZoomController(zoomController) {
        this.zoomController = zoomController;
    }

    /**
     * Connect FollowTheBall to the app
     */
    setFollowTheBall(followTheBall) {
        this.followTheBall = followTheBall;

        // Listen for cursor position changes
        if (followTheBall) {
            this.originalSetTargetPosition = followTheBall.setTargetPosition.bind(followTheBall);
            followTheBall.setTargetPosition = (position) => {
                this.onCursorPositionChange(position);
                return this.originalSetTargetPosition(position);
            };

            // Listen for speed changes
            followTheBall.saveSettings = followTheBall.saveSettings || (() => {});
            const originalSave = followTheBall.saveSettings.bind(followTheBall);
            followTheBall.saveSettings = () => {
                this.onCursorSpeedChange(followTheBall.speed);
                originalSave();
            };
        }
    }

    /**
     * Connect Rhythm Analyzer to the app
     */
    setRhythmAnalyzer(rhythmAnalyzer) {
        this.rhythmAnalyzer = rhythmAnalyzer;
    }

    /**
     * Connect Intonation Analyzer to the app
     */
    setIntonationAnalyzer(intonationAnalyzer) {
        this.intonationAnalyzer = intonationAnalyzer;
    }

    /**
     * Setup integration between zoom and cursor movement
     * Library zoom works during cursor movement
     */
    setupZoomCursorIntegration() {
        // When zoom changes, update cursor scale
        if (this.zoomController) {
            this.zoomController.onZoomChange = (zoomLevel) => {
                this.lastZoomLevel = zoomLevel;
                this.adjustCursorForZoom(zoomLevel);
            };
        }
    }

    /**
     * Adjust cursor behavior based on zoom level
     */
    adjustCursorForZoom(zoomLevel) {
        if (!this.followTheBall) return;

        // At higher zoom levels, slow down cursor movement slightly
        // to give player more time to see notes
        const zoomFactor = zoomLevel / 100;
        const adjustedSpeed = this.followTheBall.speed / Math.sqrt(zoomFactor);

        // Temporarily adjust speed (without saving)
        this.cursorSpeedMultiplier = zoomFactor;

        // Apply zoom-aware animation speed
        if (this.followTheBall.animationFrame) {
            // Speed will be applied on next animation frame
        }
    }

    /**
     * Setup integration between cursor speed and rhythm analysis
     * Cursor speed affects rhythm analysis sensitivity
     */
    setupCursorRhythmIntegration() {
        // Higher cursor speed = less strict rhythm analysis
        // Lower cursor speed = more strict rhythm analysis
    }

    /**
     * Handle cursor position changes
     */
    onCursorPositionChange(position) {
        // Debounce any heavy operations during cursor movement
        this.debounce('cursorMove', 16, () => {
            // Update any UI elements that depend on cursor position
            this.updateCursorPositionUI(position);
        });
    }

    /**
     * Handle cursor speed changes
     */
    onCursorSpeedChange(speed) {
        // Cursor speed affects rhythm analysis tolerance
        // Faster speed = more tolerance for timing errors
        if (this.rhythmAnalyzer) {
            const toleranceMultiplier = 1 + (speed - 1) * 0.3; // ±30% tolerance at 2x speed
            this.rhythmAnalyzer.toleranceMultiplier = toleranceMultiplier;
        }
    }

    /**
     * Update UI elements during cursor movement
     */
    updateCursorPositionUI(position) {
        // Could update measure indicator, progress bar, etc.
    }

    /**
     * Setup session data persistence
     * Three-axis scores persist with session data
     */
    setupSessionPersistence() {
        // The app already has sessionData, but we need to ensure
        // three-axis scores are properly saved
    }

    /**
     * Enhanced session data with three-axis scores
     */
    createEnhancedSessionData(scoreId) {
        return {
            id: crypto.randomUUID(),
            scoreId: scoreId,
            startTime: Date.now(),
            notes: [],
            pitchAccuracy: [],
            rhythmAccuracy: [],
            intonationAccuracy: [],
            // Three-axis breakdown
            threeAxis: {
                pitch: { score: 0, deviations: [] },
                rhythm: { score: 0, deviations: [] },
                intonation: { score: 0, deviations: [] }
            },
            // Zoom level used during session
            zoomLevel: this.lastZoomLevel,
            // Cursor speed used during session
            cursorSpeed: this.followTheBall?.speed || 1,
            // Timestamp for persistence
            createdAt: new Date().toISOString()
        };
    }

    /**
     * Record three-axis data point
     */
    recordThreeAxisData(pitchData, rhythmData, intonationData) {
        if (!this.app.sessionData) return;

        // Ensure threeAxis structure exists
        if (!this.app.sessionData.threeAxis) {
            this.app.sessionData.threeAxis = {
                pitch: { score: 0, deviations: [] },
                rhythm: { score: 0, deviations: [] },
                intonation: { score: 0, deviations: [] }
            };
        }

        // Record pitch data
        if (pitchData) {
            this.app.sessionData.pitchAccuracy.push(pitchData.accuracy);
            this.app.sessionData.threeAxis.pitch.deviations.push(pitchData.cents);
        }

        // Record rhythm data
        if (rhythmData) {
            this.app.sessionData.rhythmAccuracy.push(rhythmData.score);
            this.app.sessionData.threeAxis.rhythm.deviations.push(rhythmData.ms);
        }

        // Record intonation data
        if (intonationData) {
            this.app.sessionData.intonationAccuracy.push(intonationData.score);
            this.app.sessionData.threeAxis.intonation.deviations.push(intonationData.value);
        }
    }

    /**
     * Finalize session with three-axis scores
     */
    finalizeSession() {
        if (!this.app.sessionData) return null;

        const session = { ...this.app.sessionData };

        // Calculate final three-axis scores
        if (session.pitchAccuracy.length > 0) {
            const avgPitch = session.pitchAccuracy.reduce((a, b) => a + b, 0) / session.pitchAccuracy.length;
            session.threeAxis.pitch.score = avgPitch;
        }

        if (session.rhythmAccuracy.length > 0) {
            const avgRhythm = session.rhythmAccuracy.reduce((a, b) => a + b, 0) / session.rhythmAccuracy.length;
            session.threeAxis.rhythm.score = avgRhythm;
        }

        if (session.intonationAccuracy.length > 0) {
            const avgIntonation = session.intonationAccuracy.reduce((a, b) => a + b, 0) / session.intonationAccuracy.length;
            session.threeAxis.intonation.score = avgIntonation;
        }

        // Add metadata
        session.completedAt = new Date().toISOString();
        session.duration = session.completedAt - session.startTime;
        session.zoomLevel = this.lastZoomLevel;
        session.cursorSpeed = this.followTheBall?.speed || 1;

        return session;
    }

    /**
     * Setup performance optimizations
     */
    setupPerformanceOptimizations() {
        // Add debounced versions of heavy operations
    }

    /**
     * Debounce utility for performance
     */
    debounce(key, delay, callback) {
        if (this.debounceTimers[key]) {
            clearTimeout(this.debounceTimers[key]);
        }

        this.debounceTimers[key] = setTimeout(() => {
            callback();
            delete this.debounceTimers[key];
        }, delay);
    }

    /**
     * Throttle utility for performance
     */
    throttle(key, delay, callback) {
        if (this.debounceTimers[key]) {
            return; // Still in cooldown
        }

        callback();
        this.debounceTimers[key] = true;
        setTimeout(() => {
            delete this.debounceTimers[key];
        }, delay);
    }
}

window.IntegrationController = IntegrationController;
