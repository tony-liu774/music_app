/**
 * Articulation Detector - Detects bow strokes and playing techniques
 * Analyzes attack/decay patterns and inter-note gaps to classify articulation:
 * legato, staccato, accent, tenuto, pizzicato
 */

class ArticulationDetector {
    constructor() {
        // Note onset/offset history
        this.noteEvents = [];
        this.maxEvents = 50;

        // Articulation classification thresholds
        this.config = {
            // Attack time thresholds (ms)
            staccatoMaxDuration: 0.4,     // Note duration ratio (actual/expected < 0.4 = staccato)
            legatoMinDuration: 0.85,      // Note duration ratio (actual/expected > 0.85 = legato)
            accentAttackTime: 5,          // Fast attack < 5ms suggests accent
            pizzicatoAttackTime: 3,       // Very fast attack < 3ms suggests pizzicato
            pizzicatoDecayRate: 0.08,     // Fast decay rate suggests pizzicato

            // Gap thresholds between notes (ms)
            legatoMaxGap: 30,             // Gap < 30ms = legato (connected notes)
            staccatoMinGap: 100,          // Gap > 100ms relative to beat = staccato

            // Amplitude thresholds
            accentPeakRatio: 1.4,         // Peak 40% louder than average = accent
            sampleRate: 44100
        };

        // Running averages for comparison
        this.avgPeakAmplitude = 0;
        this.avgAttackTime = 0;
        this.noteCount = 0;
    }

    /**
     * Record a note event with envelope characteristics
     * @param {Object} noteEvent - Note onset data
     * @param {number} noteEvent.timestamp - Onset time in ms
     * @param {number} noteEvent.attackTime - Attack time in ms
     * @param {number} noteEvent.peakAmplitude - Peak amplitude (0-1)
     * @param {number} noteEvent.decayRate - Decay rate
     * @param {number} noteEvent.duration - Actual note duration in ms
     * @param {number} noteEvent.expectedDuration - Expected duration from score in ms
     * @param {number} noteEvent.measure - Measure number
     * @returns {Object} Detected articulation
     */
    recordNote(noteEvent) {
        const event = {
            ...noteEvent,
            timestamp: noteEvent.timestamp || Date.now(),
            articulation: null
        };

        // Update running averages
        this.noteCount++;
        this.avgPeakAmplitude = this.avgPeakAmplitude + (event.peakAmplitude - this.avgPeakAmplitude) / this.noteCount;
        this.avgAttackTime = this.avgAttackTime + ((event.attackTime || 15) - this.avgAttackTime) / this.noteCount;

        // Classify articulation
        event.articulation = this.classifyArticulation(event);

        this.noteEvents.push(event);
        if (this.noteEvents.length > this.maxEvents) {
            this.noteEvents.shift();
        }

        return event.articulation;
    }

    /**
     * Classify the articulation of a note based on its envelope and context
     * @param {Object} noteEvent - Note event data
     * @returns {Object} Articulation classification with confidence
     */
    classifyArticulation(noteEvent) {
        const scores = {
            legato: 0,
            staccato: 0,
            accent: 0,
            marcato: 0,
            tenuto: 0,
            pizzicato: 0
        };

        const { attackTime, peakAmplitude, decayRate, duration, expectedDuration } = noteEvent;

        // Duration ratio analysis
        const durationRatio = (expectedDuration && expectedDuration > 0)
            ? duration / expectedDuration
            : 1;

        // --- Pizzicato detection (highest priority - distinct physical technique) ---
        if (attackTime !== undefined && attackTime < this.config.pizzicatoAttackTime && decayRate > this.config.pizzicatoDecayRate) {
            scores.pizzicato += 60;
        }
        if (decayRate > this.config.pizzicatoDecayRate * 1.5) {
            scores.pizzicato += 30;
        }

        // --- Staccato detection ---
        if (durationRatio < this.config.staccatoMaxDuration) {
            scores.staccato += 50;
        } else if (durationRatio < 0.6) {
            scores.staccato += 30;
        }

        // Check gap to previous note
        const gap = this.getGapToPreviousNote(noteEvent);
        if (gap !== null && gap > this.config.staccatoMinGap) {
            scores.staccato += 20;
        }

        // --- Legato detection ---
        if (durationRatio >= this.config.legatoMinDuration) {
            scores.legato += 40;
        }
        if (gap !== null && gap < this.config.legatoMaxGap) {
            scores.legato += 35;
        } else if (gap === null && durationRatio >= 0.8) {
            // First note or no gap info - lean toward legato if duration is long
            scores.legato += 20;
        }

        // --- Accent detection ---
        if (this.avgPeakAmplitude > 0 && peakAmplitude > this.avgPeakAmplitude * this.config.accentPeakRatio) {
            scores.accent += 50;
        }
        if (attackTime !== undefined && attackTime < this.config.accentAttackTime) {
            scores.accent += 25;
        }

        // --- Marcato detection (accent + staccato: loud and short) ---
        if (this.avgPeakAmplitude > 0 && peakAmplitude > this.avgPeakAmplitude * this.config.accentPeakRatio && durationRatio < 0.6) {
            scores.marcato += 60;
        }
        if (attackTime !== undefined && attackTime < this.config.accentAttackTime && durationRatio < 0.7) {
            scores.marcato += 20;
        }

        // --- Tenuto detection ---
        if (durationRatio >= 0.95 && durationRatio <= 1.1) {
            scores.tenuto += 40;
        }
        if (attackTime !== undefined && attackTime > 10 && attackTime < 30) {
            scores.tenuto += 15;
        }

        // Find the highest scoring articulation
        const entries = Object.entries(scores);
        entries.sort((a, b) => b[1] - a[1]);

        const best = entries[0];
        const totalScore = entries.reduce((sum, [, s]) => sum + s, 0);
        const confidence = totalScore > 0 ? best[1] / totalScore : 0;

        return {
            type: best[0],
            confidence: Math.round(confidence * 100) / 100,
            scores,
            durationRatio: Math.round(durationRatio * 100) / 100
        };
    }

    /**
     * Calculate gap between current note and previous note
     * @param {Object} currentEvent - Current note event
     * @returns {number|null} Gap in ms, or null if no previous note
     */
    getGapToPreviousNote(currentEvent) {
        if (this.noteEvents.length === 0) return null;

        const prev = this.noteEvents[this.noteEvents.length - 1];
        const prevEnd = prev.timestamp + (prev.duration || 0);
        return currentEvent.timestamp - prevEnd;
    }

    /**
     * Get the most common articulation in recent notes
     * @param {number} count - Number of recent notes to analyze
     * @returns {Object} Most common articulation { type, percentage }
     */
    getDominantArticulation(count = 10) {
        const recent = this.noteEvents.slice(-count);
        if (recent.length === 0) return { type: 'legato', percentage: 0 };

        const counts = {};
        for (const event of recent) {
            if (event.articulation) {
                const type = event.articulation.type;
                counts[type] = (counts[type] || 0) + 1;
            }
        }

        const entries = Object.entries(counts);
        if (entries.length === 0) return { type: 'legato', percentage: 0 };

        entries.sort((a, b) => b[1] - a[1]);
        return {
            type: entries[0][0],
            percentage: Math.round(entries[0][1] / recent.length * 100)
        };
    }

    /**
     * Compare detected articulation against expected articulation from score
     * @param {string} detected - Detected articulation type
     * @param {string} expected - Expected articulation from sheet music
     * @returns {Object} Comparison result { match, score, feedback }
     */
    compareArticulation(detected, expected) {
        if (!detected || !expected) {
            return { match: true, score: 75, feedback: '' };
        }

        // Exact match
        if (detected === expected) {
            return { match: true, score: 100, feedback: '' };
        }

        // Partial match scoring
        const similarity = {
            'legato-tenuto': 70,
            'tenuto-legato': 70,
            'staccato-accent': 50,
            'accent-staccato': 50,
            'accent-marcato': 70,
            'marcato-accent': 70,
            'marcato-staccato': 50,
            'staccato-marcato': 50,
            'legato-staccato': 20,
            'staccato-legato': 20,
            'pizzicato-staccato': 30,
            'staccato-pizzicato': 30
        };

        const key = `${detected}-${expected}`;
        const score = similarity[key] || 40;

        const feedback = this.getArticulationFeedback(detected, expected);

        return { match: false, score, feedback };
    }

    /**
     * Generate human-readable feedback for articulation mismatch
     * @param {string} detected - What was played
     * @param {string} expected - What was expected
     * @returns {string} Feedback message
     */
    getArticulationFeedback(detected, expected) {
        const feedbackMap = {
            'legato-staccato': 'Shorten your bow strokes — lift between notes for staccato',
            'staccato-legato': 'Connect your bow strokes more smoothly — sustain through the note',
            'legato-accent': 'Add more bow weight at the start of the note',
            'accent-legato': 'Ease up on the initial bow pressure for a smoother attack',
            'legato-pizzicato': 'This passage should be plucked (pizzicato)',
            'pizzicato-legato': 'Return to bowing (arco) for this passage',
            'staccato-accent': 'Add more weight to the beginning of each note',
            'accent-staccato': 'Lighter, shorter strokes needed — less initial pressure',
            'tenuto-staccato': 'Shorten the notes — the score calls for separated strokes',
            'staccato-tenuto': 'Hold each note to its full value',
            'accent-marcato': 'Shorten the note while keeping the strong attack',
            'marcato-accent': 'Sustain the note a bit more — keep the weight but hold through',
            'marcato-staccato': 'Lighten the initial attack — just separate the notes',
            'staccato-marcato': 'Add more bow weight at the start of each short stroke'
        };

        return feedbackMap[`${detected}-${expected}`] || `Expected ${expected}, detected ${detected}`;
    }

    /**
     * Get recent articulation analysis summary
     * @returns {Object} Summary of recent articulations
     */
    getSummary() {
        const recent = this.noteEvents.slice(-20);
        const counts = { legato: 0, staccato: 0, accent: 0, marcato: 0, tenuto: 0, pizzicato: 0 };

        for (const event of recent) {
            if (event.articulation && counts[event.articulation.type] !== undefined) {
                counts[event.articulation.type]++;
            }
        }

        return {
            totalNotes: recent.length,
            counts,
            dominant: this.getDominantArticulation(20),
            avgAttackTime: Math.round(this.avgAttackTime * 10) / 10,
            avgPeakAmplitude: Math.round(this.avgPeakAmplitude * 1000) / 1000
        };
    }

    /**
     * Reset the detector
     */
    reset() {
        this.noteEvents = [];
        this.avgPeakAmplitude = 0;
        this.avgAttackTime = 0;
        this.noteCount = 0;
    }
}

if (typeof window !== 'undefined') {
    window.ArticulationDetector = ArticulationDetector;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ArticulationDetector };
}
