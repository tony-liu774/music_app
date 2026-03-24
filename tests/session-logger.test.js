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

    it('should log pitch deviations with spec-compliant fields', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({
            measureNumber: 5,
            beat: 2,
            expectedNote: 'C#5',
            detectedNote: 'C5',
            centsDeviation: -10,
            confidence: 0.95,
            isVibrato: true,
            expectedFrequency: 554.37,
            actualFrequency: 523.25
        });

        assert.strictEqual(logger.deviations.length, 1);
        assert.strictEqual(logger.deviations[0].type, 'pitch');
        assert.strictEqual(logger.deviations[0].measureNumber, 5);
        assert.strictEqual(logger.deviations[0].beat, 2);
        assert.strictEqual(logger.deviations[0].expectedNote, 'C#5');
        assert.strictEqual(logger.deviations[0].detectedNote, 'C5');
        assert.strictEqual(logger.deviations[0].centsDeviation, -10);
        assert.strictEqual(logger.deviations[0].confidence, 0.95);
        assert.strictEqual(logger.deviations[0].isVibrato, true);
    });

    it('should log rhythm deviations correctly', () => {
        logger.startSession('test-score');
        logger.logRhythmDeviation({
            measureNumber: 3,
            beat: 1,
            expectedMs: 500,
            actualMs: 530,
            deviationMs: 30
        });

        assert.strictEqual(logger.deviations.length, 1);
        assert.strictEqual(logger.deviations[0].type, 'rhythm');
        assert.strictEqual(logger.deviations[0].measureNumber, 3);
        assert.strictEqual(logger.deviations[0].deviation_ms, 30);
    });

    it('should log intonation deviations correctly', () => {
        logger.startSession('test-score');
        logger.logIntonationDeviation({
            measureNumber: 7,
            fromNote: 'D4',
            toNote: 'E4',
            transitionQuality: 65,
            issue: 'position_shift'
        });

        assert.strictEqual(logger.deviations.length, 1);
        assert.strictEqual(logger.deviations[0].type, 'intonation');
        assert.strictEqual(logger.deviations[0].measureNumber, 7);
        assert.strictEqual(logger.deviations[0].transition_quality, 65);
        assert.strictEqual(logger.deviations[0].issue, 'position_shift');
    });

    it('should log tone quality deviations correctly', () => {
        logger.startSession('test-score');
        logger.logToneQualityDeviation({
            measureNumber: 1,
            note: 'A4',
            qualityScore: 75,
            purityScore: 80,
            harshnessScore: 85,
            wolfToneDetected: false,
            wolfToneFrequency: null
        });
        logger.logToneQualityDeviation({
            measureNumber: 2,
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
            measureNumber: 1,
            qualityScore: 0,
            purityScore: 0,
            harshnessScore: 0
        });

        assert.strictEqual(logger.deviations[0].quality_score, 0);
        assert.strictEqual(logger.deviations[0].purity_score, 0);
        assert.strictEqual(logger.deviations[0].harshness_score, 0);
    });

    it('should generate correct session log', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -10, confidence: 0.9 });
        logger.logPitchDeviation({ measureNumber: 2, centsDeviation: -20, confidence: 0.8 });
        logger.logRhythmDeviation({ measureNumber: 3, deviationMs: 30 });
        logger.logToneQualityDeviation({ measureNumber: 4, qualityScore: 75 });

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

        logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -10, confidence: 0.9 });
        logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -20, confidence: 0.9 });
        logger.logPitchDeviation({ measureNumber: 2, centsDeviation: 15, confidence: 0.9 });

        logger.logRhythmDeviation({ measureNumber: 1, deviationMs: 25 });
        logger.logRhythmDeviation({ measureNumber: 2, deviationMs: -35 });

        logger.logToneQualityDeviation({ measureNumber: 1, qualityScore: 80 });
        logger.logToneQualityDeviation({ measureNumber: 2, qualityScore: 60 });
        logger.logToneQualityDeviation({ measureNumber: 3, qualityScore: 40, wolfToneDetected: true });

        const stats = logger.getSummaryStats();

        assert.strictEqual(stats.total_deviations, 8);
        assert.strictEqual(stats.pitch_deviation_count, 3);
        assert.strictEqual(stats.rhythm_deviation_count, 2);
        assert.strictEqual(stats.tone_quality_deviation_count, 3);

        assert.strictEqual(stats.average_pitch_deviation_cents, 15);
        assert.strictEqual(stats.average_rhythm_deviation_ms, 30);

        assert.strictEqual(stats.average_tone_quality_score, 60);
        assert.strictEqual(stats.wolf_tone_count, 1);

        assert.ok(stats.problem_measures.length > 0);
    });

    it('should identify problem measures by average deviation', () => {
        logger.startSession('test-score');

        // Measure 1: three pitch deviations, avg |cents| = (10+20+15)/3 = 15
        logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -10, confidence: 0.9 });
        logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -20, confidence: 0.9 });
        logger.logPitchDeviation({ measureNumber: 1, centsDeviation: 15, confidence: 0.9 });
        // Measure 2: one large deviation, avg = 50
        logger.logPitchDeviation({ measureNumber: 2, centsDeviation: 50, confidence: 0.9 });

        const stats = logger.getSummaryStats();
        // Measure 2 should be worst (avg 50 > avg 15)
        assert.strictEqual(stats.worst_measure, 2);
    });

    it('should export data for LLM correctly', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -10, confidence: 0.9 });
        logger.logPitchDeviation({ measureNumber: 2, centsDeviation: -20, confidence: 0.9 });
        logger.logPitchDeviation({ measureNumber: 3, centsDeviation: -30, confidence: 0.9 });

        const exportData = logger.exportForLLM();

        assert.ok(exportData.includes('"total_deviations": 3'));
        assert.ok(exportData.includes('"pitch_deviation_count": 3'));
    });

    it('should clear session data', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -10, confidence: 0.9 });

        logger.clear();

        assert.strictEqual(logger.deviations.length, 0);
        assert.strictEqual(logger.sessionId, null);
        assert.strictEqual(logger.startTime, null);
    });

    it('should support pause and resume', () => {
        logger.startSession('test-score');
        assert.strictEqual(logger._paused, false);

        logger.pauseSession();
        assert.strictEqual(logger._paused, true);

        logger.resumeSession();
        assert.strictEqual(logger._paused, false);
    });

    it('should preserve deviations across pause/resume', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -10, confidence: 0.9 });

        logger.pauseSession();
        // Deviations should still be there
        assert.strictEqual(logger.deviations.length, 1);

        logger.resumeSession();
        logger.logPitchDeviation({ measureNumber: 2, centsDeviation: -20, confidence: 0.9 });

        assert.strictEqual(logger.deviations.length, 2);
    });

    it('getErrorsByMeasure should group errors correctly', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -10, confidence: 0.9 });
        logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -20, confidence: 0.9 });
        logger.logPitchDeviation({ measureNumber: 2, centsDeviation: 15, confidence: 0.9 });

        const byMeasure = logger.getErrorsByMeasure();
        assert.strictEqual(byMeasure[1].length, 2);
        assert.strictEqual(byMeasure[2].length, 1);
    });

    it('getWorstMeasures(n) should return n measures ranked by average deviation', () => {
        logger.startSession('test-score');
        // Measure 1: avg |cents| = 15
        logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -10, confidence: 0.9 });
        logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -20, confidence: 0.9 });
        // Measure 2: avg |cents| = 50
        logger.logPitchDeviation({ measureNumber: 2, centsDeviation: 50, confidence: 0.9 });
        // Measure 3: avg |cents| = 5
        logger.logPitchDeviation({ measureNumber: 3, centsDeviation: 5, confidence: 0.9 });

        const worst = logger.getWorstMeasures(2);
        assert.strictEqual(worst.length, 2);
        assert.strictEqual(worst[0].measureNumber, 2); // highest avg deviation
        assert.strictEqual(worst[0].averageDeviation, 50);
        assert.strictEqual(worst[1].measureNumber, 1);
        assert.strictEqual(worst[1].averageDeviation, 15);
    });

    it('getSessionSummary should be an alias for getSummaryStats', () => {
        logger.startSession('test-score');
        logger.logPitchDeviation({ measureNumber: 1, centsDeviation: -10, confidence: 0.9 });

        const stats = logger.getSummaryStats();
        const summary = logger.getSessionSummary();
        assert.deepStrictEqual(stats, summary);
    });
});
