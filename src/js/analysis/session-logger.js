/**
 * Session Logger - Compiles JSON log of every recorded deviation during live performance
 * Logs pitch, rhythm, and intonation deviations with spec-compliant entry format.
 *
 * Each pitch entry follows the schema:
 *   { timestamp, measureNumber, beat, expectedNote, detectedNote, centsDeviation, confidence, isVibrato }
 */

class SessionLogger {
    constructor() {
        this.deviations = [];
        this.sessionId = null;
        this.startTime = null;
        this._paused = false;
        this._pauseStart = null;
        this._totalPausedMs = 0;
    }

    /**
     * Start a new session log
     * @param {string} scoreId - The ID of the score being practiced
     */
    startSession(scoreId) {
        this.sessionId = scoreId || 'unknown';
        this.startTime = Date.now();
        this.deviations = [];
        this._paused = false;
        this._pauseStart = null;
        this._totalPausedMs = 0;
    }

    /**
     * Pause the current session (preserves logged deviations).
     */
    pauseSession() {
        if (!this._paused && this.startTime) {
            this._paused = true;
            this._pauseStart = Date.now();
        }
    }

    /**
     * Resume a paused session.
     */
    resumeSession() {
        if (this._paused && this._pauseStart) {
            this._totalPausedMs += Date.now() - this._pauseStart;
            this._paused = false;
            this._pauseStart = null;
        }
    }

    /**
     * Get elapsed session time excluding paused periods.
     * @returns {number} Elapsed ms
     */
    _elapsed() {
        if (!this.startTime) return 0;
        const now = Date.now();
        const pausedNow = this._paused && this._pauseStart ? now - this._pauseStart : 0;
        return now - this.startTime - this._totalPausedMs - pausedNow;
    }

    /**
     * Log a pitch deviation
     * @param {Object} params - Deviation parameters
     * @param {number} params.measureNumber - Measure number
     * @param {number} params.beat - Beat number
     * @param {string} params.expectedNote - Expected note name (e.g., "C#5")
     * @param {string} params.detectedNote - Detected note name (e.g., "C5")
     * @param {number} params.centsDeviation - Deviation in cents (negative = flat, positive = sharp)
     * @param {number} params.confidence - Pitch detection confidence 0-1
     * @param {boolean} params.isVibrato - Whether vibrato was detected
     * @param {number} [params.expectedFrequency] - Expected frequency in Hz
     * @param {number} [params.actualFrequency] - Actual frequency in Hz
     */
    logPitchDeviation({ measureNumber, beat, expectedNote, detectedNote, centsDeviation, confidence, isVibrato, expectedFrequency, actualFrequency }) {
        const deviation = {
            type: 'pitch',
            timestamp: this._elapsed(),
            measureNumber: measureNumber || 1,
            beat: beat || 1,
            expectedNote: expectedNote || '?',
            detectedNote: detectedNote || '?',
            centsDeviation: Math.round(centsDeviation || 0),
            confidence: Math.round((confidence ?? 0) * 1000) / 1000,
            isVibrato: isVibrato || false,
            expectedFrequency: expectedFrequency ? Math.round(expectedFrequency * 100) / 100 : null,
            actualFrequency: actualFrequency ? Math.round(actualFrequency * 100) / 100 : null
        };
        this.deviations.push(deviation);
    }

    /**
     * Log a rhythm deviation
     * @param {Object} params - Deviation parameters
     * @param {number} params.measureNumber - Measure number
     * @param {number} params.beat - Beat number
     * @param {number} params.expectedMs - Expected duration in milliseconds
     * @param {number} params.actualMs - Actual duration in milliseconds
     * @param {number} params.deviationMs - Deviation in milliseconds (negative = early, positive = late)
     */
    logRhythmDeviation({ measureNumber, beat, expectedMs, actualMs, deviationMs }) {
        const deviation = {
            type: 'rhythm',
            timestamp: this._elapsed(),
            measureNumber: measureNumber || 1,
            beat: beat || 1,
            expected_ms: Math.round(expectedMs || 0),
            actual_ms: Math.round(actualMs || 0),
            deviation_ms: Math.round(deviationMs || 0)
        };
        this.deviations.push(deviation);
    }

    /**
     * Log an intonation/transitional deviation
     * @param {Object} params - Deviation parameters
     * @param {number} params.measureNumber - Measure number
     * @param {string} params.fromNote - Starting note
     * @param {string} params.toNote - Ending note
     * @param {number} params.transitionQuality - Quality score 0-100
     * @param {string} params.issue - Description of the issue (e.g., "position_shift", "string_change")
     */
    logIntonationDeviation({ measureNumber, fromNote, toNote, transitionQuality, issue }) {
        const deviation = {
            type: 'intonation',
            timestamp: this._elapsed(),
            measureNumber: measureNumber || 1,
            from_note: fromNote || '?',
            to_note: toNote || '?',
            transition_quality: Math.round(transitionQuality ?? 100),
            issue: issue || 'none'
        };
        this.deviations.push(deviation);
    }

    /**
     * Log a dynamics deviation (volume level mismatch with score marking)
     */
    logDynamicsDeviation({ measureNumber, beat, expectedDynamic, actualDynamic, deviation, expectedDirection, actualTrend }) {
        const dev = {
            type: 'dynamics',
            timestamp: this._elapsed(),
            measureNumber: measureNumber || 1,
            beat: beat || 1,
            expected_dynamic: expectedDynamic || 'mf',
            actual_dynamic: actualDynamic || 'mf',
            deviation: deviation || 0,
            expected_direction: expectedDirection || null,
            actual_trend: actualTrend || 'stable'
        };
        this.deviations.push(dev);
    }

    /**
     * Log an articulation deviation (bow stroke mismatch with score marking)
     */
    logArticulationDeviation({ measureNumber, beat, expectedArticulation, detectedArticulation, score, feedback }) {
        const dev = {
            type: 'articulation',
            timestamp: this._elapsed(),
            measureNumber: measureNumber || 1,
            beat: beat || 1,
            expected_articulation: expectedArticulation || '?',
            detected_articulation: detectedArticulation || '?',
            score: Math.round(score || 0),
            feedback: feedback || ''
        };
        this.deviations.push(dev);
    }

    /**
     * Log a tone quality deviation
     */
    logToneQualityDeviation({ measureNumber, note, qualityScore, purityScore, harshnessScore, wolfToneDetected, wolfToneFrequency }) {
        const deviation = {
            type: 'tone_quality',
            timestamp: this._elapsed(),
            measureNumber: measureNumber || 1,
            note: note || '?',
            quality_score: Math.round(qualityScore ?? 50),
            purity_score: Math.round(purityScore ?? 50),
            harshness_score: Math.round(harshnessScore ?? 50),
            wolf_tone_detected: wolfToneDetected || false,
            wolf_tone_frequency: wolfToneFrequency || null
        };
        this.deviations.push(deviation);
    }

    /**
     * Group all errors by measure number.
     * @returns {Object} Map of measureNumber → array of deviations
     */
    getErrorsByMeasure() {
        const byMeasure = {};
        this.deviations.forEach(d => {
            const m = d.measureNumber;
            if (!byMeasure[m]) byMeasure[m] = [];
            byMeasure[m].push(d);
        });
        return byMeasure;
    }

    /**
     * Return the n measures with highest average deviation.
     * For pitch deviations, uses |centsDeviation|; for rhythm, |deviation_ms|;
     * for others, counts errors as weight-1 each.
     * @param {number} n - Number of worst measures to return
     * @returns {Array<{measureNumber: number, averageDeviation: number, errorCount: number}>}
     */
    getWorstMeasures(n) {
        const byMeasure = this.getErrorsByMeasure();

        const ranked = Object.entries(byMeasure).map(([measure, devs]) => {
            let totalDeviation = 0;
            devs.forEach(d => {
                if (d.type === 'pitch') {
                    totalDeviation += Math.abs(d.centsDeviation || 0);
                } else if (d.type === 'rhythm') {
                    totalDeviation += Math.abs(d.deviation_ms || 0);
                } else {
                    // For non-numeric deviation types, count each as 1 unit
                    totalDeviation += 1;
                }
            });
            return {
                measureNumber: parseInt(measure),
                averageDeviation: devs.length > 0 ? Math.round((totalDeviation / devs.length) * 10) / 10 : 0,
                errorCount: devs.length
            };
        });

        return ranked
            .sort((a, b) => b.averageDeviation - a.averageDeviation)
            .slice(0, n);
    }

    /**
     * Get the complete session log in JSON format
     * @returns {Object} Complete session log
     */
    getSessionLog() {
        const toneQualityDevs = this.deviations.filter(d => d.type === 'tone_quality');
        return {
            session_id: this.sessionId,
            start_time: this.startTime,
            end_time: Date.now(),
            duration_ms: this._elapsed(),
            paused: this._paused,
            total_deviations: this.deviations.length,
            pitch_deviations: this.deviations.filter(d => d.type === 'pitch').length,
            rhythm_deviations: this.deviations.filter(d => d.type === 'rhythm').length,
            intonation_deviations: this.deviations.filter(d => d.type === 'intonation').length,
            dynamics_deviations: this.deviations.filter(d => d.type === 'dynamics').length,
            articulation_deviations: this.deviations.filter(d => d.type === 'articulation').length,
            tone_quality_deviations: toneQualityDevs.length,
            tone_quality_average: toneQualityDevs.length > 0
                ? Math.round(toneQualityDevs.reduce((sum, d) => sum + d.quality_score, 0) / toneQualityDevs.length)
                : null,
            deviations: this.deviations
        };
    }

    /**
     * Get aggregate session summary (alias: getSessionSummary)
     * @returns {Object} Summary statistics
     */
    getSummaryStats() {
        const pitchDevs = this.deviations.filter(d => d.type === 'pitch');
        const rhythmDevs = this.deviations.filter(d => d.type === 'rhythm');
        const intDevs = this.deviations.filter(d => d.type === 'intonation');
        const dynDevs = this.deviations.filter(d => d.type === 'dynamics');
        const artDevs = this.deviations.filter(d => d.type === 'articulation');
        const toneDevs = this.deviations.filter(d => d.type === 'tone_quality');

        const avgPitchDev = pitchDevs.length > 0
            ? pitchDevs.reduce((sum, d) => sum + Math.abs(d.centsDeviation), 0) / pitchDevs.length
            : 0;

        const avgRhythmDev = rhythmDevs.length > 0
            ? rhythmDevs.reduce((sum, d) => sum + Math.abs(d.deviation_ms), 0) / rhythmDevs.length
            : 0;

        const avgDynDev = dynDevs.length > 0
            ? dynDevs.reduce((sum, d) => sum + Math.abs(d.deviation), 0) / dynDevs.length
            : 0;

        const avgArtScore = artDevs.length > 0
            ? artDevs.reduce((sum, d) => sum + (d.score || 0), 0) / artDevs.length
            : 100;

        const avgToneQuality = toneDevs.length > 0
            ? toneDevs.reduce((sum, d) => sum + d.quality_score, 0) / toneDevs.length
            : 0;

        const avgPurity = toneDevs.length > 0
            ? toneDevs.reduce((sum, d) => sum + d.purity_score, 0) / toneDevs.length
            : 0;

        const wolfToneCount = toneDevs.filter(d => d.wolf_tone_detected).length;

        const worstMeasures = this.getWorstMeasures(5);

        return {
            total_deviations: this.deviations.length,
            pitch_deviation_count: pitchDevs.length,
            rhythm_deviation_count: rhythmDevs.length,
            intonation_deviation_count: intDevs.length,
            dynamics_deviation_count: dynDevs.length,
            articulation_deviation_count: artDevs.length,
            tone_quality_deviation_count: toneDevs.length,
            average_pitch_deviation_cents: Math.round(avgPitchDev),
            average_rhythm_deviation_ms: Math.round(avgRhythmDev),
            average_dynamics_deviation: Math.round(avgDynDev * 10) / 10,
            average_articulation_score: Math.round(avgArtScore),
            average_tone_quality_score: Math.round(avgToneQuality),
            average_purity_score: Math.round(avgPurity),
            wolf_tone_count: wolfToneCount,
            problem_measures: worstMeasures,
            worst_measure: worstMeasures.length > 0 ? worstMeasures[0].measureNumber : null
        };
    }

    /** Alias for getSummaryStats */
    getSessionSummary() {
        return this.getSummaryStats();
    }

    /**
     * Export deviations as JSON string for LLM processing
     * @returns {string} JSON string of deviations
     */
    exportForLLM() {
        const summary = this.getSummaryStats();
        const recentDeviations = this.deviations.slice(-50); // Last 50 deviations for context

        return JSON.stringify({
            summary: summary,
            recent_deviations: recentDeviations
        }, null, 2);
    }

    /**
     * Clear the session log
     */
    clear() {
        this.deviations = [];
        this.sessionId = null;
        this.startTime = null;
        this._paused = false;
        this._pauseStart = null;
        this._totalPausedMs = 0;
    }
}

// Dual-format export: ESM-compatible named export + CJS + browser global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SessionLogger };
}
if (typeof window !== 'undefined') {
    window.SessionLogger = SessionLogger;
}
