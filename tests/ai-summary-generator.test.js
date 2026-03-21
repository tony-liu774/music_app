/**
 * Tests for AISummaryGenerator - Coordinates session logging and LLM processing
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const { SessionLogger } = require('../src/js/analysis/session-logger');
const { LLMService } = require('../src/js/services/llm-service');

// AISummaryGenerator references SessionLogger and LLMService as free variables
// (loaded via <script> order in browser). Provide them as globals for Node.js require().
global.SessionLogger = SessionLogger;
global.LLMService = LLMService;

const { AISummaryGenerator } = require('../src/js/analysis/ai-summary-generator');

// Mock LLMService that avoids real fetch calls
class MockLLMService {
    constructor() {
        this.isProcessing = false;
    }

    async generateSummary(sessionData) {
        this.isProcessing = true;

        await new Promise(resolve => setTimeout(resolve, 10));

        const { summary } = sessionData;

        return {
            success: true,
            summary: 'Great work!',
            recommendations: ['Practice measure 14 slowly'],
            recommended_measures: summary.problem_measures?.slice(0, 3).map(m => m.measure) || [14, 18],
            overall_assessment: 'Good progress!',
            suggested_tempo: 70,
            generated_at: Date.now()
        };
    }

    generateFallbackSummary(sessionData) {
        const { summary } = sessionData;
        return {
            overall_assessment: 'Nice effort!',
            diagnosis: 'Focus on measures with most errors.',
            fix: 'Practice slowly with metronome.',
            recommended_measures: summary.problem_measures?.slice(0, 3).map(m => m.measure) || [],
            suggested_tempo: 60,
            is_fallback: true
        };
    }

    isBusy() {
        return this.isProcessing;
    }
}

describe('AISummaryGenerator', () => {
    let generator;

    beforeEach(() => {
        generator = new AISummaryGenerator();
        // Replace the real LLMService with a mock to avoid fetch calls
        generator.llmService = new MockLLMService();
    });

    it('should initialize with empty state', () => {
        assert.strictEqual(generator.currentSummary, null);
        assert.strictEqual(generator.isGenerating, false);
    });

    it('should start a new session', () => {
        generator.startSession('test-score-1');

        const log = generator.sessionLogger.getSessionLog();
        assert.strictEqual(log.session_id, 'test-score-1');
    });

    it('should log pitch deviations', () => {
        generator.startSession('test-score');

        generator.logPitchDeviation({
            measure: 14,
            beat: 2,
            expectedPitch: 'C#5',
            actualPitch: 'C5',
            deviationCents: -50
        });

        const log = generator.sessionLogger.getSessionLog();
        assert.strictEqual(log.pitch_deviations, 1);
        assert.strictEqual(log.deviations[0].expected_pitch, 'C#5');
        assert.strictEqual(log.deviations[0].actual_pitch, 'C5');
    });

    it('should log rhythm deviations', () => {
        generator.startSession('test-score');

        generator.logRhythmDeviation({
            measure: 8,
            beat: 1,
            deviationMs: 45
        });

        const log = generator.sessionLogger.getSessionLog();
        assert.strictEqual(log.rhythm_deviations, 1);
    });

    it('should log intonation deviations', () => {
        generator.startSession('test-score');

        generator.logIntonationDeviation({
            measure: 20,
            transitionQuality: 65
        });

        const log = generator.sessionLogger.getSessionLog();
        assert.strictEqual(log.intonation_deviations, 1);
    });

    it('should generate summary with AI insights', async () => {
        generator.startSession('test-score');

        generator.logPitchDeviation({ measure: 14, beat: 2, deviationCents: -50 });
        generator.logPitchDeviation({ measure: 14, beat: 3, deviationCents: -45 });
        generator.logPitchDeviation({ measure: 18, beat: 1, deviationCents: 30 });
        generator.logRhythmDeviation({ measure: 10, beat: 1, deviationMs: 25 });

        const summary = await generator.generateSummary();

        assert.ok(summary);
        assert.ok(summary.session);
        assert.ok(summary.statistics);
        assert.ok(summary.ai);
        assert.ok(summary.generated_at);
        assert.strictEqual(summary.statistics.pitch_deviation_count, 3);
        assert.strictEqual(summary.statistics.rhythm_deviation_count, 1);
    });

    it('should get problem measures from AI summary', async () => {
        generator.startSession('test-score');

        generator.logPitchDeviation({ measure: 14, beat: 1, deviationCents: -50 });
        generator.logPitchDeviation({ measure: 14, beat: 2, deviationCents: -45 });
        generator.logPitchDeviation({ measure: 14, beat: 3, deviationCents: -40 });
        generator.logPitchDeviation({ measure: 18, beat: 1, deviationCents: 30 });
        generator.logPitchDeviation({ measure: 22, beat: 1, deviationCents: 20 });

        await generator.generateSummary();

        const problemMeasures = generator.getProblemMeasures();

        assert.ok(Array.isArray(problemMeasures));
        assert.ok(problemMeasures.length > 0);
    });

    it('should get suggested tempo from AI', async () => {
        generator.startSession('test-score');

        generator.logPitchDeviation({ measure: 14, deviationCents: -50 });

        await generator.generateSummary();

        const tempo = generator.getSuggestedTempo();

        assert.ok(typeof tempo === 'number');
        assert.ok(tempo >= 40);
    });

    it('should return default tempo when no summary', () => {
        generator.startSession('test-score');

        const tempo = generator.getSuggestedTempo();

        assert.strictEqual(tempo, 80);
    });

    it('should get current summary', async () => {
        generator.startSession('test-score');
        generator.logPitchDeviation({ measure: 1, deviationCents: -10 });

        await generator.generateSummary();

        const summary = generator.getCurrentSummary();

        assert.ok(summary);
        assert.ok(summary.ai);
    });

    it('should clear session data', async () => {
        generator.startSession('test-score');
        generator.logPitchDeviation({ measure: 1, deviationCents: -10 });

        await generator.generateSummary();

        generator.clear();

        assert.strictEqual(generator.currentSummary, null);
        const log = generator.sessionLogger.getSessionLog();
        assert.strictEqual(log.total_deviations, 0);
    });

    it('should export session log as JSON', () => {
        generator.startSession('test-score');
        generator.logPitchDeviation({ measure: 14, deviationCents: -50 });
        generator.logRhythmDeviation({ measure: 10, deviationMs: 30 });

        const json = generator.exportSessionLog();

        assert.ok(typeof json === 'string');
        const parsed = JSON.parse(json);
        assert.strictEqual(parsed.session_id, 'test-score');
        assert.strictEqual(parsed.total_deviations, 2);
    });

    it('should calculate problem measures correctly', async () => {
        generator.startSession('test-score');

        // Measure 14 has 3 errors
        generator.logPitchDeviation({ measure: 14, deviationCents: -50 });
        generator.logPitchDeviation({ measure: 14, deviationCents: -45 });
        generator.logPitchDeviation({ measure: 14, deviationCents: -40 });

        // Measure 18 has 2 errors
        generator.logPitchDeviation({ measure: 18, deviationCents: 30 });
        generator.logPitchDeviation({ measure: 18, deviationCents: 25 });

        await generator.generateSummary();

        const stats = generator.sessionLogger.getSummaryStats();

        assert.strictEqual(stats.problem_measures[0].measure, 14);
        assert.strictEqual(stats.problem_measures[0].error_count, 3);
        assert.strictEqual(stats.problem_measures[1].measure, 18);
    });
});

describe('AISummaryGenerator Error Handling', () => {
    let generator;

    beforeEach(() => {
        generator = new AISummaryGenerator();
        generator.llmService = new MockLLMService();
    });

    it('should handle empty session gracefully', async () => {
        generator.startSession('empty-session');

        const summary = await generator.generateSummary();

        assert.ok(summary);
        assert.strictEqual(summary.statistics.total_notes_played, 0);
    });

    it('should identify worst measure', async () => {
        generator.startSession('test-score');

        generator.logPitchDeviation({ measure: 5, deviationCents: -10 });
        generator.logPitchDeviation({ measure: 10, deviationCents: -20 });
        generator.logPitchDeviation({ measure: 10, deviationCents: -25 });
        generator.logPitchDeviation({ measure: 10, deviationCents: -30 });

        await generator.generateSummary();

        const stats = generator.sessionLogger.getSummaryStats();

        assert.strictEqual(stats.worst_measure, 10);
    });
});

describe('AISummaryGenerator Session Logging', () => {
    let generator;

    beforeEach(() => {
        generator = new AISummaryGenerator();
        generator.llmService = new MockLLMService();
    });

    it('should track multiple deviation types', () => {
        generator.startSession('multi-type');

        generator.logPitchDeviation({ measure: 1, deviationCents: -50 });
        generator.logRhythmDeviation({ measure: 2, deviationMs: 30 });
        generator.logIntonationDeviation({ measure: 3, transitionQuality: 70 });

        const log = generator.sessionLogger.getSessionLog();

        assert.strictEqual(log.pitch_deviations, 1);
        assert.strictEqual(log.rhythm_deviations, 1);
        assert.strictEqual(log.intonation_deviations, 1);
        assert.strictEqual(log.total_deviations, 3);
    });

    it('should calculate average pitch deviation correctly', () => {
        generator.startSession('test');

        generator.logPitchDeviation({ measure: 1, deviationCents: -50 });
        generator.logPitchDeviation({ measure: 2, deviationCents: -30 });
        generator.logPitchDeviation({ measure: 3, deviationCents: -20 });

        const stats = generator.sessionLogger.getSummaryStats();

        // Average of absolute values: (50 + 30 + 20) / 3 = 33.33 -> 33
        assert.strictEqual(stats.average_pitch_deviation_cents, 33);
    });

    it('should calculate average rhythm deviation correctly', () => {
        generator.startSession('test');

        generator.logRhythmDeviation({ measure: 1, deviationMs: -40 });
        generator.logRhythmDeviation({ measure: 2, deviationMs: 20 });
        generator.logRhythmDeviation({ measure: 3, deviationMs: 30 });

        const stats = generator.sessionLogger.getSummaryStats();

        // Average of absolute values: (40 + 20 + 30) / 3 = 30
        assert.strictEqual(stats.average_rhythm_deviation_ms, 30);
    });
});
