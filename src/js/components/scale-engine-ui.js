/**
 * Scale Engine UI Component
 * Provides scale selector, key selector, tempo control, and octave range.
 * Connects to Follow-the-Ball cursor, Intonation Analyzer, Metronome, and Session Logging.
 */

class ScaleEngineUI {
    constructor(container) {
        this.container = container;
        this.scaleEngine = null;
        this.element = null;

        // Integration references
        this.metronome = null;
        this.followTheBall = null;
        this.intonationAnalyzer = null;
        this.sheetMusicRenderer = null;

        // State
        this.currentScore = null;
        this.isPracticing = false;

        // Settings persistence
        this.loadSettings();
    }

    /**
     * Initialize the UI and create DOM elements
     */
    init(scaleEngine) {
        this.scaleEngine = scaleEngine;
        this.createElement();
        this.applySettingsToEngine();
        return this;
    }

    /**
     * Connect integration modules
     */
    connectModules({ metronome, followTheBall, intonationAnalyzer, sheetMusicRenderer } = {}) {
        this.metronome = metronome || null;
        this.followTheBall = followTheBall || null;
        this.intonationAnalyzer = intonationAnalyzer || null;
        this.sheetMusicRenderer = sheetMusicRenderer || null;
    }

    /**
     * Load saved settings from localStorage
     */
    loadSettings() {
        this.settings = {
            instrument: localStorage.getItem('scaleEngine_instrument') || 'violin',
            key: localStorage.getItem('scaleEngine_key') || 'C',
            scaleType: localStorage.getItem('scaleEngine_scaleType') || 'major',
            exerciseType: localStorage.getItem('scaleEngine_exerciseType') || 'scale',
            arpeggioType: localStorage.getItem('scaleEngine_arpeggioType') || 'major',
            etudePattern: localStorage.getItem('scaleEngine_etudePattern') || 'thirds',
            octaves: parseInt(localStorage.getItem('scaleEngine_octaves')) || 2,
            tempo: parseInt(localStorage.getItem('scaleEngine_tempo')) || 80
        };
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        for (const [key, value] of Object.entries(this.settings)) {
            localStorage.setItem(`scaleEngine_${key}`, value);
        }
    }

    /**
     * Apply saved settings to the scale engine
     */
    applySettingsToEngine() {
        if (this.scaleEngine) {
            this.scaleEngine.setConfig(this.settings);
        }
    }

    /**
     * Create the main UI element
     */
    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'scale-engine-panel';
        this.element.id = 'scale-engine-panel';
        this.element.setAttribute('role', 'region');
        this.element.setAttribute('aria-label', 'Scale Engine Warm-Up Generator');

        this.element.innerHTML = this.renderHTML();
        this.container.appendChild(this.element);
        this.bindEvents();
    }

    /**
     * Render the HTML structure
     */
    renderHTML() {
        const instrumentOptions = Object.entries(
            typeof window !== 'undefined' && window.ScaleData
                ? window.ScaleData.INSTRUMENT_CONFIG
                : {}
        ).map(([id, cfg]) =>
            `<option value="${id}" ${id === this.settings.instrument ? 'selected' : ''}>${cfg.name}</option>`
        ).join('');

        const keyOptions = (typeof window !== 'undefined' && window.ScaleData
            ? window.ScaleData.CIRCLE_OF_FIFTHS
            : ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F']
        ).map(k =>
            `<option value="${k}" ${k === this.settings.key ? 'selected' : ''}>${k}</option>`
        ).join('');

        return `
            <div class="scale-engine-header">
                <h3 class="scale-engine-title">Warm-Up Generator</h3>
            </div>
            <div class="scale-engine-controls">
                <div class="scale-engine-row">
                    <div class="scale-engine-field">
                        <label for="scale-instrument">Instrument</label>
                        <select id="scale-instrument" class="scale-select">${instrumentOptions}</select>
                    </div>
                    <div class="scale-engine-field">
                        <label for="scale-key">Key</label>
                        <select id="scale-key" class="scale-select">${keyOptions}</select>
                    </div>
                </div>
                <div class="scale-engine-row">
                    <div class="scale-engine-field">
                        <label for="scale-exercise-type">Exercise</label>
                        <select id="scale-exercise-type" class="scale-select">
                            <option value="scale" ${this.settings.exerciseType === 'scale' ? 'selected' : ''}>Scale</option>
                            <option value="arpeggio" ${this.settings.exerciseType === 'arpeggio' ? 'selected' : ''}>Arpeggio</option>
                            <option value="etude" ${this.settings.exerciseType === 'etude' ? 'selected' : ''}>Etude Pattern</option>
                        </select>
                    </div>
                    <div class="scale-engine-field" id="scale-type-field">
                        <label for="scale-type">Type</label>
                        <select id="scale-type" class="scale-select">
                            <option value="major" ${this.settings.scaleType === 'major' ? 'selected' : ''}>Major</option>
                            <option value="natural_minor" ${this.settings.scaleType === 'natural_minor' ? 'selected' : ''}>Natural Minor</option>
                            <option value="harmonic_minor" ${this.settings.scaleType === 'harmonic_minor' ? 'selected' : ''}>Harmonic Minor</option>
                            <option value="melodic_minor" ${this.settings.scaleType === 'melodic_minor' ? 'selected' : ''}>Melodic Minor</option>
                        </select>
                    </div>
                    <div class="scale-engine-field" id="arpeggio-type-field" style="display:none">
                        <label for="arpeggio-type">Type</label>
                        <select id="arpeggio-type" class="scale-select">
                            <option value="major" ${this.settings.arpeggioType === 'major' ? 'selected' : ''}>Major</option>
                            <option value="minor" ${this.settings.arpeggioType === 'minor' ? 'selected' : ''}>Minor</option>
                            <option value="diminished" ${this.settings.arpeggioType === 'diminished' ? 'selected' : ''}>Diminished</option>
                            <option value="augmented" ${this.settings.arpeggioType === 'augmented' ? 'selected' : ''}>Augmented</option>
                        </select>
                    </div>
                    <div class="scale-engine-field" id="etude-pattern-field" style="display:none">
                        <label for="etude-pattern">Pattern</label>
                        <select id="etude-pattern" class="scale-select">
                            <option value="thirds" ${this.settings.etudePattern === 'thirds' ? 'selected' : ''}>Thirds</option>
                            <option value="sixths" ${this.settings.etudePattern === 'sixths' ? 'selected' : ''}>Sixths</option>
                            <option value="octaves" ${this.settings.etudePattern === 'octaves' ? 'selected' : ''}>Octaves</option>
                            <option value="broken_thirds" ${this.settings.etudePattern === 'broken_thirds' ? 'selected' : ''}>Broken Thirds</option>
                            <option value="shifts" ${this.settings.etudePattern === 'shifts' ? 'selected' : ''}>Shifts</option>
                            <option value="double_stops" ${this.settings.etudePattern === 'double_stops' ? 'selected' : ''}>Double Stops</option>
                            <option value="chromatic" ${this.settings.etudePattern === 'chromatic' ? 'selected' : ''}>Chromatic</option>
                        </select>
                    </div>
                </div>
                <div class="scale-engine-row">
                    <div class="scale-engine-field">
                        <label for="scale-octaves">Octaves</label>
                        <select id="scale-octaves" class="scale-select">
                            <option value="1" ${this.settings.octaves === 1 ? 'selected' : ''}>1 Octave</option>
                            <option value="2" ${this.settings.octaves === 2 ? 'selected' : ''}>2 Octaves</option>
                            <option value="3" ${this.settings.octaves === 3 ? 'selected' : ''}>3 Octaves</option>
                        </select>
                    </div>
                    <div class="scale-engine-field">
                        <label for="scale-tempo">Tempo: <span id="scale-tempo-display">${this.settings.tempo}</span> BPM</label>
                        <input type="range" id="scale-tempo" class="scale-range" min="40" max="200" value="${this.settings.tempo}">
                    </div>
                </div>
                <div class="scale-engine-actions">
                    <button id="scale-generate-btn" class="scale-btn scale-btn-primary">Generate</button>
                    <button id="scale-practice-btn" class="scale-btn scale-btn-secondary" disabled>Practice</button>
                    <button id="scale-cof-btn" class="scale-btn scale-btn-tertiary" title="Circle of Fifths progression">Circle of 5ths</button>
                </div>
            </div>
            <div id="scale-exercise-info" class="scale-exercise-info" style="display:none">
                <span id="scale-exercise-title" class="scale-exercise-title"></span>
                <span id="scale-note-count" class="scale-note-count"></span>
            </div>
        `;
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        const el = this.element;

        // Instrument selector
        el.querySelector('#scale-instrument')?.addEventListener('change', (e) => {
            this.settings.instrument = e.target.value;
            this.onSettingChange();
        });

        // Key selector
        el.querySelector('#scale-key')?.addEventListener('change', (e) => {
            this.settings.key = e.target.value;
            this.onSettingChange();
        });

        // Exercise type selector
        el.querySelector('#scale-exercise-type')?.addEventListener('change', (e) => {
            this.settings.exerciseType = e.target.value;
            this.updateTypeFieldVisibility();
            this.onSettingChange();
        });

        // Scale type
        el.querySelector('#scale-type')?.addEventListener('change', (e) => {
            this.settings.scaleType = e.target.value;
            this.onSettingChange();
        });

        // Arpeggio type
        el.querySelector('#arpeggio-type')?.addEventListener('change', (e) => {
            this.settings.arpeggioType = e.target.value;
            this.onSettingChange();
        });

        // Etude pattern
        el.querySelector('#etude-pattern')?.addEventListener('change', (e) => {
            this.settings.etudePattern = e.target.value;
            this.onSettingChange();
        });

        // Octaves
        el.querySelector('#scale-octaves')?.addEventListener('change', (e) => {
            this.settings.octaves = parseInt(e.target.value);
            this.onSettingChange();
        });

        // Tempo slider
        el.querySelector('#scale-tempo')?.addEventListener('input', (e) => {
            this.settings.tempo = parseInt(e.target.value);
            const display = el.querySelector('#scale-tempo-display');
            if (display) display.textContent = this.settings.tempo;
            this.onSettingChange();
        });

        // Generate button
        el.querySelector('#scale-generate-btn')?.addEventListener('click', () => {
            this.generateExercise();
        });

        // Practice button
        el.querySelector('#scale-practice-btn')?.addEventListener('click', () => {
            this.togglePractice();
        });

        // Circle of fifths button
        el.querySelector('#scale-cof-btn')?.addEventListener('click', () => {
            this.startCircleOfFifths();
        });

        // Initialize type field visibility
        this.updateTypeFieldVisibility();
    }

    /**
     * Show/hide sub-type fields based on exercise type
     */
    updateTypeFieldVisibility() {
        const exerciseType = this.settings.exerciseType;
        const scaleField = this.element.querySelector('#scale-type-field');
        const arpField = this.element.querySelector('#arpeggio-type-field');
        const etudeField = this.element.querySelector('#etude-pattern-field');

        if (scaleField) scaleField.style.display = exerciseType === 'scale' ? '' : 'none';
        if (arpField) arpField.style.display = exerciseType === 'arpeggio' ? '' : 'none';
        if (etudeField) etudeField.style.display = exerciseType === 'etude' ? '' : 'none';
    }

    /**
     * Handle setting change - save and update engine
     */
    onSettingChange() {
        this.saveSettings();
        this.applySettingsToEngine();
    }

    /**
     * Generate the current exercise
     */
    generateExercise() {
        if (!this.scaleEngine) return;

        this.applySettingsToEngine();
        const result = this.scaleEngine.generate();
        this.currentScore = result.score;

        // Update info display
        const infoEl = this.element.querySelector('#scale-exercise-info');
        const titleEl = this.element.querySelector('#scale-exercise-title');
        const countEl = this.element.querySelector('#scale-note-count');

        if (infoEl) infoEl.style.display = '';
        if (titleEl) titleEl.textContent = this.scaleEngine.getExerciseTitle();
        if (countEl) countEl.textContent = `${result.notes.length} notes`;

        // Enable practice button (only if notes were generated)
        const practiceBtn = this.element.querySelector('#scale-practice-btn');
        if (practiceBtn) practiceBtn.disabled = result.notes.length === 0;

        // Warn if no notes were generated
        if (result.notes.length === 0 && countEl) {
            countEl.textContent = 'No notes in range';
        }

        // Render score to sheet music display
        if (this.sheetMusicRenderer && result.score) {
            this.sheetMusicRenderer.setScore(result.score);
        }

        // Sync metronome tempo
        if (this.metronome) {
            this.metronome.setBPM(this.settings.tempo);
        }

        // Reset follow-the-ball cursor
        if (this.followTheBall) {
            this.followTheBall.reset();
        }

        // Reset intonation analyzer
        if (this.intonationAnalyzer) {
            this.intonationAnalyzer.reset();
        }

        return result;
    }

    /**
     * Toggle practice mode
     */
    togglePractice() {
        this.isPracticing = !this.isPracticing;

        const practiceBtn = this.element.querySelector('#scale-practice-btn');
        if (practiceBtn) {
            practiceBtn.textContent = this.isPracticing ? 'Stop' : 'Practice';
            practiceBtn.classList.toggle('active', this.isPracticing);
        }

        if (this.isPracticing) {
            this.startPractice();
        } else {
            this.stopPractice();
        }
    }

    /**
     * Start practice session
     */
    startPractice() {
        // Start metronome
        if (this.metronome) {
            this.metronome.setBPM(this.settings.tempo);
            this.metronome.start();
        }

        // Enable follow-the-ball
        if (this.followTheBall) {
            this.followTheBall.enabled = true;
            this.followTheBall.reset();
        }
    }

    /**
     * Stop practice session
     */
    stopPractice() {
        // Stop metronome
        if (this.metronome) {
            this.metronome.stop();
        }

        // Stop follow-the-ball
        if (this.followTheBall) {
            this.followTheBall.enabled = false;
        }

        this.isPracticing = false;
        const practiceBtn = this.element.querySelector('#scale-practice-btn');
        if (practiceBtn) {
            practiceBtn.textContent = 'Practice';
            practiceBtn.classList.remove('active');
        }
    }

    /**
     * Start circle of fifths practice progression
     */
    startCircleOfFifths() {
        if (!this.scaleEngine) return;

        const results = this.scaleEngine.generateCircleOfFifths();
        if (results.length > 0) {
            this.currentScore = results[0].score;

            const infoEl = this.element.querySelector('#scale-exercise-info');
            const titleEl = this.element.querySelector('#scale-exercise-title');
            const countEl = this.element.querySelector('#scale-note-count');

            if (infoEl) infoEl.style.display = '';
            if (titleEl) titleEl.textContent = `Circle of 5ths: ${results.map(r => r.key).join(' → ')}`;
            if (countEl) countEl.textContent = `${results.length} keys`;

            const practiceBtn = this.element.querySelector('#scale-practice-btn');
            if (practiceBtn) practiceBtn.disabled = false;
        }

        return results;
    }

    /**
     * Get the currently generated score
     */
    getCurrentScore() {
        return this.currentScore;
    }

    /**
     * Destroy the UI component
     */
    destroy() {
        this.stopPractice();
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.ScaleEngineUI = ScaleEngineUI;
}

// Export for Node.js tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ScaleEngineUI };
}