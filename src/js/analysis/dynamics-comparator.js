/**
 * Dynamics Comparator - Compares live audio dynamics/articulation against sheet music markings
 * Bridges VolumeEnvelopeAnalyzer + ArticulationDetector with parsed MusicXML data
 */

class DynamicsComparator {
    constructor() {
        this.volumeAnalyzer = new VolumeEnvelopeAnalyzer();
        this.articulationDetector = new ArticulationDetector();

        // Score dynamics data (populated from MusicXML)
        this.scoreDynamics = [];   // { measure, beat, type } from parsed score
        this.scoreArticulations = []; // { measure, beat, type } from parsed score

        // Comparison results
        this.dynamicsDeviations = [];
        this.articulationDeviations = [];
        this.maxDeviations = 200;

        // Current position in score
        this.currentMeasure = 1;
        this.currentBeat = 0;

        // Total frames processed (for unbiased session scoring)
        this.totalDynamicsFrames = 0;
        this.totalDynamicsScore = 0;
        this.totalArticulationEvents = 0;
        this.totalArticulationScore = 0;
    }

    /**
     * Load dynamics and articulation data from a parsed Score object
     * @param {Score} score - Parsed score object with dynamics/articulation data
     */
    loadScore(score) {
        this.scoreDynamics = [];
        this.scoreArticulations = [];

        if (!score || !score.parts) return;

        for (const part of score.parts) {
            for (const measure of part.measures) {
                // Collect measure-level dynamics
                if (measure.dynamics) {
                    for (const dyn of measure.dynamics) {
                        this.scoreDynamics.push({
                            measure: measure.number,
                            beat: dyn.beat || 0,
                            type: dyn.type,
                            category: dyn.category || 'dynamic'
                        });
                    }
                }

                // Collect note-level articulations and dynamics
                for (const note of measure.notes) {
                    if (note.articulation) {
                        this.scoreArticulations.push({
                            measure: measure.number,
                            beat: note.position.beat || 0,
                            type: note.articulation,
                            noteName: note.getName()
                        });
                    }
                    if (note.dynamicDirection) {
                        this.scoreDynamics.push({
                            measure: measure.number,
                            beat: note.position.beat || 0,
                            type: note.dynamicDirection,
                            category: 'wedge'
                        });
                    }
                }
            }
        }

        // Sort by position for deterministic lookup
        this.scoreDynamics.sort((a, b) => a.measure - b.measure || a.beat - b.beat);
        this.scoreArticulations.sort((a, b) => a.measure - b.measure || a.beat - b.beat);
    }

    /**
     * Get expected dynamic at a given position (pure query, no side effects)
     * @param {number} measure - Measure number
     * @param {number} beat - Beat position
     * @returns {Object} { dynamic: string, direction: string|null }
     */
    getExpectedDynamic(measure, beat) {
        let dynamic = 'mf'; // Default
        let direction = null;

        for (const dyn of this.scoreDynamics) {
            if (dyn.measure < measure || (dyn.measure === measure && dyn.beat <= beat)) {
                if (dyn.category === 'dynamic') {
                    dynamic = dyn.type;
                } else if (dyn.category === 'wedge') {
                    if (dyn.type === 'wedge-stop') {
                        direction = null;
                    } else {
                        direction = dyn.type;
                    }
                }
            }
        }

        return { dynamic, direction };
    }

    /**
     * Get expected articulation at a given position
     * @param {number} measure - Measure number
     * @param {number} beat - Beat position
     * @returns {string|null} Expected articulation
     */
    getExpectedArticulation(measure, beat) {
        for (const art of this.scoreArticulations) {
            if (art.measure === measure && Math.abs(art.beat - beat) < 0.1) {
                return art.type;
            }
        }
        return null;
    }

    /**
     * Process a live audio frame — updates volume envelope and returns comparison
     * @param {number} rmsLevel - Current RMS amplitude
     * @param {number} measure - Current measure number
     * @param {number} beat - Current beat position
     * @param {number} timestamp - Timestamp in ms
     * @returns {Object} Dynamics comparison result
     */
    processAudioFrame(rmsLevel, measure, beat, timestamp) {
        this.currentMeasure = measure;
        this.currentBeat = beat;

        // Update volume envelope
        const envelope = this.volumeAnalyzer.addSample(rmsLevel, timestamp);

        // Get expected dynamic at current position (pure query)
        const { dynamic: expectedDynamic, direction } = this.getExpectedDynamic(measure, beat);
        const expectedLevel = VolumeEnvelopeAnalyzer.dynamicToLevel(expectedDynamic);
        const actualLevel = envelope.dynamicLevel;

        // Compare dynamic levels
        const dynamicDeviation = actualLevel - expectedLevel;
        const dynamicScore = this.calculateDynamicScore(expectedLevel, actualLevel);

        // Check crescendo/decrescendo compliance
        let directionScore = 100;
        let directionMatch = true;
        if (direction === 'crescendo' && envelope.currentTrend !== 'crescendo') {
            directionScore = envelope.currentTrend === 'stable' ? 60 : 30;
            directionMatch = false;
        } else if (direction === 'decrescendo' && envelope.currentTrend !== 'decrescendo') {
            directionScore = envelope.currentTrend === 'stable' ? 60 : 30;
            directionMatch = false;
        }

        // Track running totals for unbiased session scoring
        const combinedScore = Math.round((dynamicScore * 0.6 + directionScore * 0.4));
        this.totalDynamicsFrames++;
        this.totalDynamicsScore += combinedScore;

        // Log deviation if significant
        if (Math.abs(dynamicDeviation) >= 2 || !directionMatch) {
            this.logDynamicDeviation({
                measure,
                beat,
                expectedDynamic,
                actualDynamic: envelope.currentDynamic,
                deviation: dynamicDeviation,
                score: dynamicScore,
                expectedDirection: direction,
                actualTrend: envelope.currentTrend,
                directionMatch,
                timestamp
            });
        }

        return {
            dynamicScore,
            directionScore,
            expectedDynamic,
            actualDynamic: envelope.currentDynamic,
            dynamicDeviation,
            trend: envelope.currentTrend,
            expectedDirection: direction,
            directionMatch,
            combinedScore
        };
    }

    /**
     * Process a note event — detects articulation and compares to score
     * @param {Object} noteEvent - Note event with envelope data
     * @param {number} measure - Current measure
     * @param {number} beat - Current beat
     * @returns {Object} Articulation comparison result
     */
    processNoteArticulation(noteEvent, measure, beat) {
        // Detect articulation from audio
        const detected = this.articulationDetector.recordNote(noteEvent);

        // Get expected articulation from score
        const expected = this.getExpectedArticulation(measure, beat);

        // Compare
        let comparison;
        if (expected) {
            comparison = this.articulationDetector.compareArticulation(detected.type, expected);
        } else {
            comparison = { match: true, score: 80, feedback: '' };
        }

        // Track running totals for unbiased session scoring
        this.totalArticulationEvents++;
        this.totalArticulationScore += comparison.score;

        // Log deviation if mismatch
        if (expected && !comparison.match) {
            this.logArticulationDeviation({
                measure,
                beat,
                expectedArticulation: expected,
                detectedArticulation: detected.type,
                confidence: detected.confidence,
                score: comparison.score,
                feedback: comparison.feedback
            });
        }

        return {
            detected: detected.type,
            expected,
            confidence: detected.confidence,
            match: comparison.match,
            score: comparison.score,
            feedback: comparison.feedback
        };
    }

    /**
     * Calculate dynamic accuracy score (0-100)
     * @param {number} expectedLevel - Expected dynamic level (0-5)
     * @param {number} actualLevel - Actual dynamic level (0-5)
     * @returns {number} Score 0-100
     */
    calculateDynamicScore(expectedLevel, actualLevel) {
        const diff = Math.abs(expectedLevel - actualLevel);
        // 0 difference = 100, 1 = 80, 2 = 50, 3+ = 20
        if (diff === 0) return 100;
        if (diff === 1) return 80;
        if (diff === 2) return 50;
        return 20;
    }

    /**
     * Log a dynamics deviation
     */
    logDynamicDeviation(deviation) {
        this.dynamicsDeviations.push({
            ...deviation,
            type: 'dynamics'
        });
        if (this.dynamicsDeviations.length > this.maxDeviations) {
            this.dynamicsDeviations.shift();
        }
    }

    /**
     * Log an articulation deviation
     */
    logArticulationDeviation(deviation) {
        this.articulationDeviations.push({
            ...deviation,
            type: 'articulation'
        });
        if (this.articulationDeviations.length > this.maxDeviations) {
            this.articulationDeviations.shift();
        }
    }

    /**
     * Get overall dynamics score for session
     * @returns {Object} Dynamics and articulation scores
     */
    getSessionScores() {
        // Use running totals for unbiased scoring (includes all frames, not just deviations)
        const avgDynamics = this.totalDynamicsFrames > 0
            ? this.totalDynamicsScore / this.totalDynamicsFrames
            : 75;
        const avgArticulation = this.totalArticulationEvents > 0
            ? this.totalArticulationScore / this.totalArticulationEvents
            : 75;

        return {
            dynamics: Math.round(avgDynamics),
            articulation: Math.round(avgArticulation),
            combined: Math.round(avgDynamics * 0.5 + avgArticulation * 0.5),
            dynamicsDeviationCount: this.dynamicsDeviations.length,
            articulationDeviationCount: this.articulationDeviations.length
        };
    }

    /**
     * Get problem measures for dynamics/articulation
     * @returns {Array} Array of measure numbers with worst scores
     */
    getProblemMeasures() {
        const measureScores = {};

        for (const dev of [...this.dynamicsDeviations, ...this.articulationDeviations]) {
            if (!measureScores[dev.measure]) {
                measureScores[dev.measure] = { total: 0, count: 0 };
            }
            measureScores[dev.measure].total += dev.score;
            measureScores[dev.measure].count++;
        }

        return Object.entries(measureScores)
            .map(([measure, data]) => ({
                measure: parseInt(measure),
                avgScore: Math.round(data.total / data.count),
                deviationCount: data.count
            }))
            .sort((a, b) => a.avgScore - b.avgScore)
            .slice(0, 5);
    }

    /**
     * Export deviations for session logger integration
     * @returns {Object} Formatted deviations for session logging
     */
    exportDeviations() {
        return {
            dynamics: this.dynamicsDeviations.slice(-30),
            articulation: this.articulationDeviations.slice(-30),
            scores: this.getSessionScores(),
            problemMeasures: this.getProblemMeasures()
        };
    }

    /**
     * Reset all state
     */
    reset() {
        this.volumeAnalyzer.reset();
        this.articulationDetector.reset();
        this.dynamicsDeviations = [];
        this.articulationDeviations = [];
        this.currentMeasure = 1;
        this.currentBeat = 0;
        this.totalDynamicsFrames = 0;
        this.totalDynamicsScore = 0;
        this.totalArticulationEvents = 0;
        this.totalArticulationScore = 0;
    }
}

if (typeof window !== 'undefined') {
    window.DynamicsComparator = DynamicsComparator;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DynamicsComparator };
}
