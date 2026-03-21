/**
 * Tests for SessionLogger - JSON Data Aggregation
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Mock SessionLogger for testing
class SessionLogger {
    constructor() {
        this.deviations = [];
        this.sessionId = null;
        this.startTime = null;
    }

    startSession(scoreId) {
        this.sessionId = scoreId || 'unknown';
        this.startTime = Date.now();
        this.deviations = [];
    }

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

    logIntonationDeviation({ measure, fromNote, toNote, transitionQuality, issue }) {
        const deviation = {
            type: 'intonation',
            measure: measure || 1,
            from_note: fromNote || '?',
            to_note: toNote || '?',
            transition_quality: Math.round(transitionQuality ?? 100),
            issue: issue || 'none',
            timestamp: Date.now() - (this.startTime || Date.now())
        };
        this.deviations.push(deviation);
    }

    logToneQualityDeviation({ measure, note, qualityScore, purityScore, harshnessScore, wolfToneDetected, wolfToneFrequency }) {
        const deviation = {
            type: 'tone_quality',
            measure: measure || 1,
            note: note || '?',
            quality_score: Math.round(qualityScore ?? 50),
            purity_score: Math.round(purityScore ?? 50),
            harshness_score: Math.round(harshnessScore ?? 50),
            wolf_tone_detected: wolfToneDetected || false,
            wolf_tone_frequency: wolfToneFrequency || null,
            timestamp: Date.now() - (this.startTime || Date.now())
        };
        this.deviations.push(deviation);
    }

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
            tone_quality_deviations: toneQualityDevs.length,
            tone_quality_average: toneQualityDevs.length > 0
                ? Math.round(toneQualityDevs.reduce((sum, d) => sum + d.quality_score, 0) / toneQualityDevs.length)
                : null,
            deviations: this.deviations
        };
    }

    getSummaryStats() {
        const pitchDevs = this.deviations.filter(d => d.type === 'pitch');
        const rhythmDevs = this.deviations.filter(d => d.type === 'rhythm');
        const intDevs = this.deviations.filter(d => d.type === 'intonation');
        const toneDevs = this.deviations.filter(d => d.type === 'tone_quality');

        const avgPitchDev = pitchDevs.length > 0
            ? pitchDevs.reduce((sum, d) => sum + Math.abs(d.deviation_cents), 0) / pitchDevs.length
            : 0;

        const avgRhythmDev = rhythmDevs.length > 0
            ? rhythmDevs.reduce((sum, d) => sum + Math.abs(d.deviation_ms), 0) / rhythmDevs.length
            : 0;

        const avgToneQuality = toneDevs.length > 0
            ? toneDevs.reduce((sum, d) => sum + d.quality_score, 0) / toneDevs.length
            : 0;

        const avgPurity = toneDevs.length > 0
            ? toneDevs.reduce((sum, d) => sum + d.purity_score, 0) / toneDevs.length
            : 0;

        const wolfToneCount = toneDevs.filter(d => d.wolf_tone_detected).length;

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
            tone_quality_deviation_count: toneDevs.length,
            average_pitch_deviation_cents: Math.round(avgPitchDev),
            average_rhythm_deviation_ms: Math.round(avgRhythmDev),
            average_tone_quality_score: Math.round(avgToneQuality),
            average_purity_score: Math.round(avgPurity),
            wolf_tone_count: wolfToneCount,
            problem_measures: problemMeasures,
            worst_measure: problemMeasures.length > 0 ? problemMeasures[0].measure : null
        };
    }

    exportForLLM() {
        const summary = this.getSummaryStats();
        const recentDeviations = this.deviations.slice(-50);
        return JSON.stringify({
            summary: summary,
            recent_deviations: recentDeviations
        }, null, 2);
    }

    clear() {
        this.deviations = [];
        this.sessionId = null;
        this.startTime = null;
    }
}

describe('SessionLogger', () => {
    let logger;

    beforeEach(() => {
        logger = new SessionLogger();
    });

    afterEach(() => {
        logger = null;
    });

    it('should initialize with empty deviations', () => {
        assert.strictEqual(logger.deviations.length, 0);
        assert.strictEqual(logger.sessionId, null);
    });

    it('should start a new session', () => {
        logger.startSession('test-score-123');

        assert.strictEqual(logger.sessionId, 'test-score-123');
        assert.notStrictEqual(logger.startTime, null);
        assert.strictEqual(logger.deviations.length, 0);
    });

    it('should log pitch deviations correctly', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({
            measure: 14,
            beat: 2,
            expectedPitch: 'C#5',
            actualPitch: 'C5',
            deviationCents: -50,
            expectedFrequency: 554.37,
            actualFrequency: 523.25
        });

        assert.strictEqual(logger.deviations.length, 1);
        assert.strictEqual(logger.deviations[0].type, 'pitch');
        assert.strictEqual(logger.deviations[0].measure, 14);
        assert.strictEqual(logger.deviations[0].beat, 2);
        assert.strictEqual(logger.deviations[0].expected_pitch, 'C#5');
        assert.strictEqual(logger.deviations[0].actual_pitch, 'C5');
        assert.strictEqual(logger.deviations[0].deviation_cents, -50);
    });

    it('should log rhythm deviations correctly', () => {
        logger.startSession('test-score');
        logger.logRhythmDeviation({
            measure: 5,
            beat: 1,
            expectedMs: 500,
            actualMs: 550,
            deviationMs: 50
        });

        assert.strictEqual(logger.deviations.length, 1);
        assert.strictEqual(logger.deviations[0].type, 'rhythm');
        assert.strictEqual(logger.deviations[0].expected_ms, 500);
        assert.strictEqual(logger.deviations[0].actual_ms, 550);
        assert.strictEqual(logger.deviations[0].deviation_ms, 50);
    });

    it('should log intonation deviations correctly', () => {
        logger.startSession('test-score');
        logger.logIntonationDeviation({
            measure: 10,
            fromNote: 'G4',
            toNote: 'A4',
            transitionQuality: 65,
            issue: 'position_shift'
        });

        assert.strictEqual(logger.deviations.length, 1);
        assert.strictEqual(logger.deviations[0].type, 'intonation');
        assert.strictEqual(logger.deviations[0].from_note, 'G4');
        assert.strictEqual(logger.deviations[0].to_note, 'A4');
        assert.strictEqual(logger.deviations[0].transition_quality, 65);
        assert.strictEqual(logger.deviations[0].issue, 'position_shift');
    });

    it('should log tone quality deviations correctly', () => {
        logger.startSession('test-score');
        logger.logToneQualityDeviation({
            measure: 1,
            note: 'A4',
            qualityScore: 75,
            purityScore: 80,
            harshnessScore: 85,
            wolfToneDetected: false,
            wolfToneFrequency: null
        });
        logger.logToneQualityDeviation({
            measure: 2,
            note: 'E5',
            qualityScore: 45,
            purityScore: 50,
            harshnessScore: 40,
            wolfToneDetected: true,
            wolfToneFrequency: 659
        });

        assert.strictEqual(logger.deviations.length, 2);
        assert.strictEqual(logger.deviations[0].type, 'tone_quality');
        assert.strictEqual(logger.deviations[0].note, 'A4');
        assert.strictEqual(logger.deviations[0].quality_score, 75);
        assert.strictEqual(logger.deviations[0].wolf_tone_detected, false);
        assert.strictEqual(logger.deviations[1].wolf_tone_detected, true);
        assert.strictEqual(logger.deviations[1].wolf_tone_frequency, 659);
    });

    it('should store zero score correctly (not overwrite with default)', () => {
        logger.startSession('test-score');
        logger.logToneQualityDeviation({
            measure: 1,
            qualityScore: 0,
            purityScore: 0,
            harshnessScore: 0
        });

        // Verify 0 is stored as 0, not overwritten to 50
        assert.strictEqual(logger.deviations[0].quality_score, 0);
        assert.strictEqual(logger.deviations[0].purity_score, 0);
        assert.strictEqual(logger.deviations[0].harshness_score, 0);
    });

    it('should generate correct session log', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({ measure: 1, deviationCents: -10 });
        logger.logPitchDeviation({ measure: 2, deviationCents: -20 });
        logger.logRhythmDeviation({ measure: 3, deviationMs: 30 });
        logger.logToneQualityDeviation({ measure: 4, qualityScore: 75 });

        const log = logger.getSessionLog();

        assert.strictEqual(log.session_id, 'test-score');
        assert.strictEqual(log.total_deviations, 4);
        assert.strictEqual(log.pitch_deviations, 2);
        assert.strictEqual(log.rhythm_deviations, 1);
        assert.strictEqual(log.intonation_deviations, 0);
        assert.strictEqual(log.tone_quality_deviations, 1);
        assert.strictEqual(log.tone_quality_average, 75);
    });

    it('should calculate summary statistics correctly', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({ measure: 1, deviationCents: -10 });
        logger.logPitchDeviation({ measure: 1, deviationCents: -20 });
        logger.logPitchDeviation({ measure: 2, deviationCents: -30 });
        logger.logRhythmDeviation({ measure: 1, deviationMs: 20 });
        logger.logRhythmDeviation({ measure: 3, deviationMs: 40 });

        const stats = logger.getSummaryStats();

        assert.strictEqual(stats.total_notes_played, 5);
        assert.strictEqual(stats.pitch_deviation_count, 3);
        assert.strictEqual(stats.rhythm_deviation_count, 2);
        assert.strictEqual(stats.average_pitch_deviation_cents, 20); // (-10 + -20 + -30) / 3 = -20, abs = 20
        assert.strictEqual(stats.average_rhythm_deviation_ms, 30); // (20 + 40) / 2 = 30
    });

    it('should identify problem measures', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({ measure: 1, deviationCents: -10 });
        logger.logPitchDeviation({ measure: 1, deviationCents: -20 });
        logger.logPitchDeviation({ measure: 1, deviationCents: -30 });
        logger.logPitchDeviation({ measure: 2, deviationCents: -10 });
        logger.logPitchDeviation({ measure: 3, deviationCents: -10 });

        const stats = logger.getSummaryStats();

        assert.strictEqual(stats.worst_measure, 1);
        assert.strictEqual(stats.problem_measures[0].measure, 1);
        assert.strictEqual(stats.problem_measures[0].error_count, 3);
    });

    it('should export data for LLM correctly', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({ measure: 1, deviationCents: -10 });
        logger.logPitchDeviation({ measure: 2, deviationCents: -20 });

        const exported = logger.exportForLLM();
        const parsed = JSON.parse(exported);

        assert.ok(parsed.summary);
        assert.ok(parsed.recent_deviations);
        assert.strictEqual(parsed.summary.total_notes_played, 2);
    });

    it('should clear session data', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({ measure: 1, deviationCents: -10 });

        logger.clear();

        assert.strictEqual(logger.deviations.length, 0);
        assert.strictEqual(logger.sessionId, null);
        assert.strictEqual(logger.startTime, null);
    });
});

console.log('Running SessionLogger tests...');
