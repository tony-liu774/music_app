/**
 * Tests for SessionLogger - JSON Data Aggregation
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { SessionLogger } = require('../src/js/analysis/session-logger');

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

    it('should generate correct session log', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({ measure: 1, deviationCents: -10 });
        logger.logPitchDeviation({ measure: 2, deviationCents: -20 });
        logger.logRhythmDeviation({ measure: 3, deviationMs: 30 });

        const log = logger.getSessionLog();

        assert.strictEqual(log.session_id, 'test-score');
        assert.strictEqual(log.total_deviations, 3);
        assert.strictEqual(log.pitch_deviations, 2);
        assert.strictEqual(log.rhythm_deviations, 1);
        assert.strictEqual(log.intonation_deviations, 0);
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

    // --- Dynamics deviation tests ---

    it('should log dynamics deviations correctly', () => {
        logger.startSession('test-score');
        logger.logDynamicsDeviation({
            measure: 5,
            beat: 1,
            expectedDynamic: 'f',
            actualDynamic: 'mp',
            deviation: -2,
            expectedDirection: 'crescendo',
            actualTrend: 'stable'
        });

        assert.strictEqual(logger.deviations.length, 1);
        assert.strictEqual(logger.deviations[0].type, 'dynamics');
        assert.strictEqual(logger.deviations[0].measure, 5);
        assert.strictEqual(logger.deviations[0].expected_dynamic, 'f');
        assert.strictEqual(logger.deviations[0].actual_dynamic, 'mp');
        assert.strictEqual(logger.deviations[0].deviation, -2);
        assert.strictEqual(logger.deviations[0].expected_direction, 'crescendo');
        assert.strictEqual(logger.deviations[0].actual_trend, 'stable');
    });

    it('should log dynamics deviations with defaults for missing fields', () => {
        logger.startSession('test-score');
        logger.logDynamicsDeviation({ measure: 1 });

        assert.strictEqual(logger.deviations[0].expected_dynamic, 'mf');
        assert.strictEqual(logger.deviations[0].actual_dynamic, 'mf');
        assert.strictEqual(logger.deviations[0].deviation, 0);
        assert.strictEqual(logger.deviations[0].expected_direction, null);
        assert.strictEqual(logger.deviations[0].actual_trend, 'stable');
    });

    // --- Articulation deviation tests ---

    it('should log articulation deviations correctly', () => {
        logger.startSession('test-score');
        logger.logArticulationDeviation({
            measure: 3,
            beat: 2,
            expectedArticulation: 'staccato',
            detectedArticulation: 'legato',
            score: 20,
            feedback: 'Shorten your bow strokes'
        });

        assert.strictEqual(logger.deviations.length, 1);
        assert.strictEqual(logger.deviations[0].type, 'articulation');
        assert.strictEqual(logger.deviations[0].measure, 3);
        assert.strictEqual(logger.deviations[0].expected_articulation, 'staccato');
        assert.strictEqual(logger.deviations[0].detected_articulation, 'legato');
        assert.strictEqual(logger.deviations[0].score, 20);
        assert.strictEqual(logger.deviations[0].feedback, 'Shorten your bow strokes');
    });

    it('should log articulation deviations with defaults for missing fields', () => {
        logger.startSession('test-score');
        logger.logArticulationDeviation({ measure: 1 });

        assert.strictEqual(logger.deviations[0].expected_articulation, '?');
        assert.strictEqual(logger.deviations[0].detected_articulation, '?');
        assert.strictEqual(logger.deviations[0].score, 0);
        assert.strictEqual(logger.deviations[0].feedback, '');
    });

    // --- Session log with dynamics/articulation ---

    it('should include dynamics and articulation counts in session log', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({ measure: 1, deviationCents: -10 });
        logger.logDynamicsDeviation({ measure: 2, expectedDynamic: 'f', actualDynamic: 'p', deviation: -3 });
        logger.logArticulationDeviation({ measure: 3, expectedArticulation: 'staccato', detectedArticulation: 'legato', score: 20 });

        const log = logger.getSessionLog();
        assert.strictEqual(log.total_deviations, 3);
        assert.strictEqual(log.pitch_deviations, 1);
        assert.strictEqual(log.dynamics_deviations, 1);
        assert.strictEqual(log.articulation_deviations, 1);
    });

    it('should include dynamics/articulation in summary stats', () => {
        logger.startSession('test-score');
        logger.logDynamicsDeviation({ measure: 1, deviation: 2 });
        logger.logDynamicsDeviation({ measure: 2, deviation: -4 });
        logger.logArticulationDeviation({ measure: 3, score: 60 });
        logger.logArticulationDeviation({ measure: 4, score: 40 });

        const stats = logger.getSummaryStats();
        assert.strictEqual(stats.dynamics_deviation_count, 2);
        assert.strictEqual(stats.articulation_deviation_count, 2);
        assert.strictEqual(stats.average_dynamics_deviation, 3); // (2+4)/2
        assert.strictEqual(stats.average_articulation_score, 50); // (60+40)/2
    });

    it('should count dynamics/articulation deviations in problem measures', () => {
        logger.startSession('test-score');
        logger.logDynamicsDeviation({ measure: 5, deviation: 2 });
        logger.logDynamicsDeviation({ measure: 5, deviation: 3 });
        logger.logArticulationDeviation({ measure: 5, score: 30 });
        logger.logPitchDeviation({ measure: 7, deviationCents: -10 });

        const stats = logger.getSummaryStats();
        assert.strictEqual(stats.worst_measure, 5);
        assert.strictEqual(stats.problem_measures[0].error_count, 3);
    });
});

console.log('Running SessionLogger tests...');
