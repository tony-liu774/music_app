/**
 * Tests for SessionLogger - JSON Data Aggregation
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Set up global.window before requiring the module
global.window = global;
global.navigator = { mediaDevices: { getUserMedia: () => {}, enumerateDevices: () => {} } };
global.AudioContext = class AudioContext {
    constructor(options = {}) { this.sampleRate = options.sampleRate || 44100; }
    createAnalyser() { return { fftSize: 4096, frequencyBinCount: 2048 }; }
    createBuffer() { return { getChannelData: () => new Float32Array(44100) }; }
    createGain() { return { gain: { value: 1 } }; }
    createMediaStreamSource() { return { connect: () => {}, disconnect: () => {} }; }
    close() {}
    resume() {}
};

// Import the real SessionLogger module
require('../src/js/analysis/session-logger.js');
const SessionLogger = global.window.SessionLogger;

describe('SessionLogger', () => {
    let logger;

    beforeEach(() => {
        logger = new SessionLogger();
    });

    afterEach(() => {
        logger.clear();
    });

    it('should initialize with empty deviations', () => {
        assert.strictEqual(logger.deviations.length, 0);
        assert.strictEqual(logger.sessionId, null);
    });

    it('should start a new session', () => {
        logger.startSession('test-score-123');
        assert.strictEqual(logger.sessionId, 'test-score-123');
        assert.ok(logger.startTime > 0);
        assert.strictEqual(logger.deviations.length, 0);
    });

    it('should log pitch deviations correctly', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({
            measure: 5,
            beat: 2,
            expectedPitch: 'C#5',
            actualPitch: 'C5',
            deviationCents: -10,
            expectedFrequency: 554.37,
            actualFrequency: 523.25
        });

        assert.strictEqual(logger.deviations.length, 1);
        assert.strictEqual(logger.deviations[0].type, 'pitch');
        assert.strictEqual(logger.deviations[0].measure, 5);
        assert.strictEqual(logger.deviations[0].beat, 2);
        assert.strictEqual(logger.deviations[0].expected_pitch, 'C#5');
        assert.strictEqual(logger.deviations[0].actual_pitch, 'C5');
        assert.strictEqual(logger.deviations[0].deviation_cents, -10);
    });

    it('should log rhythm deviations correctly', () => {
        logger.startSession('test-score');
        logger.logRhythmDeviation({
            measure: 3,
            beat: 1,
            expectedMs: 500,
            actualMs: 530,
            deviationMs: 30
        });

        assert.strictEqual(logger.deviations.length, 1);
        assert.strictEqual(logger.deviations[0].type, 'rhythm');
        assert.strictEqual(logger.deviations[0].measure, 3);
        assert.strictEqual(logger.deviations[0].deviation_ms, 30);
    });

    it('should log intonation deviations correctly', () => {
        logger.startSession('test-score');
        logger.logIntonationDeviation({
            measure: 7,
            fromNote: 'D4',
            toNote: 'E4',
            transitionQuality: 65,
            issue: 'position_shift'
        });

        assert.strictEqual(logger.deviations.length, 1);
        assert.strictEqual(logger.deviations[0].type, 'intonation');
        assert.strictEqual(logger.deviations[0].measure, 7);
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
        logger.logPitchDeviation({ measure: 2, deviationCents: 15 });

        logger.logRhythmDeviation({ measure: 1, deviationMs: 25 });
        logger.logRhythmDeviation({ measure: 2, deviationMs: -35 });

        logger.logToneQualityDeviation({ measure: 1, qualityScore: 80 });
        logger.logToneQualityDeviation({ measure: 2, qualityScore: 60 });
        logger.logToneQualityDeviation({ measure: 3, qualityScore: 40, wolfToneDetected: true });

        const stats = logger.getSummaryStats();

        assert.strictEqual(stats.total_notes_played, 8);
        assert.strictEqual(stats.pitch_deviation_count, 3);
        assert.strictEqual(stats.rhythm_deviation_count, 2);
        assert.strictEqual(stats.tone_quality_deviation_count, 3);

        assert.strictEqual(stats.average_pitch_deviation_cents, 15);
        assert.strictEqual(stats.average_rhythm_deviation_ms, 30);

        assert.strictEqual(stats.average_tone_quality_score, 60);
        assert.strictEqual(stats.wolf_tone_count, 1);

        assert.ok(stats.problem_measures.length > 0);
    });

    it('should identify problem measures', () => {
        logger.startSession('test-score');

        logger.logPitchDeviation({ measure: 1, deviationCents: -10 });
        logger.logPitchDeviation({ measure: 1, deviationCents: -20 });
        logger.logPitchDeviation({ measure: 1, deviationCents: 15 });
        logger.logPitchDeviation({ measure: 2, deviationCents: 5 });

        const stats = logger.getSummaryStats();

        assert.strictEqual(stats.worst_measure, 1);
    });

    it('should export data for LLM correctly', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({ measure: 1, deviationCents: -10 });
        logger.logPitchDeviation({ measure: 2, deviationCents: -20 });
        logger.logPitchDeviation({ measure: 3, deviationCents: -30 });

        const exportData = logger.exportForLLM();

        assert.ok(exportData.includes('"total_notes_played": 3'));
        assert.ok(exportData.includes('"pitch_deviation_count": 3'));
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
