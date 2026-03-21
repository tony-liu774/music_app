/**
 * Session Logger - Compiles JSON log of every recorded deviation during live performance
 * Logs pitch, rhythm, and intonation deviations
 */

class SessionLogger {
    constructor() {
        this.deviations = [];
        this.sessionId = null;
        this.startTime = null;
    }

    /**
     * Start a new session log
     * @param {string} scoreId - The ID of the score being practiced
     */
    startSession(scoreId) {
        this.sessionId = scoreId || 'unknown';
        this.startTime = Date.now();
        this.deviations = [];
        console.log(`SessionLogger: Started session ${this.sessionId}`);
    }

    /**
     * Log a pitch deviation
     * @param {Object} params - Deviation parameters
     * @param {number} params.measure - Measure number
     * @param {number} params.beat - Beat number
     * @param {string} params.expectedPitch - Expected pitch name (e.g., "C#5")
     * @param {string} params.actualPitch - Actual pitch name (e.g., "C5")
     * @param {number} params.deviationCents - Deviation in cents (negative = flat, positive = sharp)
     * @param {number} params.expectedFrequency - Expected frequency in Hz
     * @param {number} params.actualFrequency - Actual frequency in Hz
     */
    logPitchDeviation({ measure, beat, expectedPitch, actualPitch, deviationCents, expectedFrequency, actualFrequency }) {
        const deviation = {
            type: 'pitch',
            measure: measure || 1,
            beat: beat || 1,
            expected_pitch: expectedPitch || '?',
            actual_pitch: actualPitch || '?',
            deviation_cents: Math.round(deviationCents || 0),
            expected_frequency: expectedFrequency ? Math.round(expectedFrequency * 100) / 100 : null,
            actual_frequency: actualFrequency ? Math.round(actualFrequency * 100) / 100 : null,
            timestamp: Date.now() - (this.startTime || Date.now())
        };
        this.deviations.push(deviation);
    }

    /**
     * Log a rhythm deviation
     * @param {Object} params - Deviation parameters
     * @param {number} params.measure - Measure number
     * @param {number} params.beat - Beat number
     * @param {number} params.expectedMs - Expected duration in milliseconds
     * @param {number} params.actualMs - Actual duration in milliseconds
     * @param {number} params.deviationMs - Deviation in milliseconds (negative = early, positive = late)
     */
    logRhythmDeviation({ measure, beat, expectedMs, actualMs, deviationMs }) {
        const deviation = {
            type: 'rhythm',
            measure: measure || 1,
            beat: beat || 1,
            expected_ms: Math.round(expectedMs || 0),
            actual_ms: Math.round(actualMs || 0),
            deviation_ms: Math.round(deviationMs || 0),
            timestamp: Date.now() - (this.startTime || Date.now())
        };
        this.deviations.push(deviation);
    }

    /**
     * Log an intonation/transitional deviation
     * @param {Object} params - Deviation parameters
     * @param {number} params.measure - Measure number
     * @param {number} params.fromNote - Starting note
     * @param {number} params.toNote - Ending note
     * @param {number} params.transitionQuality - Quality score 0-100
     * @param {string} params.issue - Description of the issue (e.g., "position_shift", "string_change")
     */
    logIntonationDeviation({ measure, fromNote, toNote, transitionQuality, issue }) {
        const deviation = {
            type: 'intonation',
            measure: measure || 1,
            from_note: fromNote || '?',
            to_note: toNote || '?',
            transition_quality: Math.round(transitionQuality || 100),
            issue: issue || 'none',
            timestamp: Date.now() - (this.startTime || Date.now())
        };
        this.deviations.push(deviation);
    }

    /**
     * Log a dynamics deviation (volume level mismatch with score marking)
     * @param {Object} params - Deviation parameters
     * @param {number} params.measure - Measure number
     * @param {number} params.beat - Beat number
     * @param {string} params.expectedDynamic - Expected dynamic marking (pp, p, mp, mf, f, ff)
     * @param {string} params.actualDynamic - Detected dynamic marking
     * @param {number} params.deviation - Numeric level deviation
     * @param {string} params.expectedDirection - Expected direction (crescendo/decrescendo/null)
     * @param {string} params.actualTrend - Detected trend
     */
    logDynamicsDeviation({ measure, beat, expectedDynamic, actualDynamic, deviation, expectedDirection, actualTrend }) {
        const dev = {
            type: 'dynamics',
            measure: measure || 1,
            beat: beat || 1,
            expected_dynamic: expectedDynamic || 'mf',
            actual_dynamic: actualDynamic || 'mf',
            deviation: deviation || 0,
            expected_direction: expectedDirection || null,
            actual_trend: actualTrend || 'stable',
            timestamp: Date.now() - (this.startTime || Date.now())
        };
        this.deviations.push(dev);
    }

    /**
     * Log an articulation deviation (bow stroke mismatch with score marking)
     * @param {Object} params - Deviation parameters
     * @param {number} params.measure - Measure number
     * @param {number} params.beat - Beat number
     * @param {string} params.expectedArticulation - Expected articulation from score
     * @param {string} params.detectedArticulation - Detected articulation from audio
     * @param {number} params.score - Accuracy score 0-100
     * @param {string} params.feedback - Human-readable feedback
     */
    logArticulationDeviation({ measure, beat, expectedArticulation, detectedArticulation, score, feedback }) {
        const dev = {
            type: 'articulation',
            measure: measure || 1,
            beat: beat || 1,
            expected_articulation: expectedArticulation || '?',
            detected_articulation: detectedArticulation || '?',
            score: Math.round(score || 0),
            feedback: feedback || '',
            timestamp: Date.now() - (this.startTime || Date.now())
        };
        this.deviations.push(dev);
    }

    /**
     * Log a tone quality deviation
     * @param {Object} params - Deviation parameters
     * @param {number} params.measure - Measure number
     * @param {string} params.note - Note name
     * @param {number} params.qualityScore - Overall quality score 0-100
     * @param {number} params.purityScore - Harmonic purity score 0-100
     * @param {number} params.harshnessScore - Harshness score 0-100
     * @param {boolean} params.wolfToneDetected - Whether a wolf tone was detected
     * @param {number} params.wolfToneFrequency - Wolf tone frequency if detected
     */
    logToneQualityDeviation({ measure, note, qualityScore, purityScore, harshnessScore, wolfToneDetected, wolfToneFrequency }) {
        const deviation = {
            type: 'tone_quality',
            measure: measure || 1,
            note: note || '?',
            // Use nullish coalescing to allow 0 as valid score
            quality_score: Math.round(qualityScore ?? 50),
            purity_score: Math.round(purityScore ?? 50),
            harshness_score: Math.round(harshnessScore ?? 50),
            wolf_tone_detected: wolfToneDetected || false,
            wolf_tone_frequency: wolfToneFrequency || null,
            timestamp: Date.now() - (this.startTime || Date.now())
        };
        this.deviations.push(deviation);
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
            duration_ms: this.startTime ? Date.now() - this.startTime : 0,
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
     * Get summary statistics for the session
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
            ? pitchDevs.reduce((sum, d) => sum + Math.abs(d.deviation_cents), 0) / pitchDevs.length
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

        // Find most problematic measures
        const measureErrors = {};
        this.deviations.forEach(d => {
            if (!measureErrors[d.measure]) {
                measureErrors[d.measure] = 0;
            }
            measureErrors[d.measure]++;
        });

        const problemMeasures = Object.entries(measureErrors)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([measure, count]) => ({ measure: parseInt(measure), error_count: count }));

        return {
            total_notes_played: this.deviations.length,
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
            problem_measures: problemMeasures,
            worst_measure: problemMeasures.length > 0 ? problemMeasures[0].measure : null
        };
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
    }
}

if (typeof window !== 'undefined') {
    window.SessionLogger = SessionLogger;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SessionLogger };
}
