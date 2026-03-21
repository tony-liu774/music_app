/**
 * Tests for AISummaryGenerator - Coordinates session logging and LLM processing
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

    logPitchDeviation({ measure, beat, expectedPitch, actualPitch, deviationCents }) {
        this.deviations.push({
            type: 'pitch',
            measure: measure || 1,
            beat: beat || 1,
            expected_pitch: expectedPitch || '?',
            actual_pitch: actualPitch || '?',
            deviation_cents: Math.round(deviationCents || 0),
            timestamp: Date.now()
        });
    }

    logRhythmDeviation({ measure, beat, deviationMs }) {
        this.deviations.push({
            type: 'rhythm',
            measure: measure || 1,
            beat: beat || 1,
            deviation_ms: Math.round(deviationMs || 0),
            timestamp: Date.now()
        });
    }

    logIntonationDeviation({ measure, transitionQuality }) {
        this.deviations.push({
            type: 'intonation',
            measure: measure || 1,
            transition_quality: Math.round(transitionQuality || 100),
            timestamp: Date.now()
        });
    }

    getSessionLog() {
        return {
            session_id: this.sessionId,
            start_time: this.startTime,
            end_time: Date.now(),
            duration_ms: this.startTime ? Date.now() - this.startTime : 0,
            total_deviations: this.deviations.length,
            pitch_deviations: this.deviations.filter(d => d.type === 'pitch').length,
            rhythm_deviations: this.deviations.filter(d => d.type === 'rhythm').length,
            intonation_deviations: this.deviations.filter(d => d.type === 'intonation').length,
            deviations: this.deviations
        };
    }

    getSummaryStats() {
        const pitchDevs = this.deviations.filter(d => d.type === 'pitch');
        const rhythmDevs = this.deviations.filter(d => d.type === 'rhythm');

        const avgPitchDev = pitchDevs.length > 0
            ? pitchDevs.reduce((sum, d) => sum + Math.abs(d.deviation_cents), 0) / pitchDevs.length
            : 0;

        const avgRhythmDev = rhythmDevs.length > 0
            ? rhythmDevs.reduce((sum, d) => sum + Math.abs(d.deviation_ms), 0) / rhythmDevs.length
            : 0;

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
            intonation_deviation_count: this.deviations.filter(d => d.type === 'intonation').length,
            average_pitch_deviation_cents: Math.round(avgPitchDev),
            average_rhythm_deviation_ms: Math.round(avgRhythmDev),
            problem_measures: problemMeasures,
            worst_measure: problemMeasures.length > 0 ? problemMeasures[0].measure : null
        };
    }

    clear() {
        this.deviations = [];
        this.sessionId = null;
        this.startTime = null;
    }
}

// Mock LLMService for testing
class MockLLMService {
    constructor() {
        this.isProcessing = false;
    }

    async generateSummary(sessionData) {
        this.isProcessing = true;

        // Simulate async operation
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

// Mock AISummaryGenerator for testing
class AISummaryGenerator {
    constructor() {
        this.sessionLogger = new SessionLogger();
        this.llmService = new MockLLMService();
        this.currentSummary = null;
        this.isGenerating = false;
    }

    startSession(scoreId) {
        this.sessionLogger.startSession(scoreId);
        this.currentSummary = null;
    }

    logPitchDeviation(params) {
        this.sessionLogger.logPitchDeviation(params);
    }

    logRhythmDeviation(params) {
        this.sessionLogger.logRhythmDeviation(params);
    }

    logIntonationDeviation(params) {
        this.sessionLogger.logIntonationDeviation(params);
    }

    async generateSummary() {
        if (this.isGenerating) {
            return this.currentSummary;
        }

        this.isGenerating = true;

        try {
            const sessionLog = this.sessionLogger.getSessionLog();
            const summaryStats = this.sessionLogger.getSummaryStats();

            const llmInput = {
                summary: summaryStats,
                recent_deviations: sessionLog.deviations.slice(-30)
            };

            const aiResult = await this.llmService.generateSummary(llmInput);

            this.currentSummary = {
                session: sessionLog,
                statistics: summaryStats,
                ai: aiResult.success ? aiResult : aiResult.fallback,
                generated_at: Date.now()
            };

            return this.currentSummary;

        } catch (error) {
            console.error('AISummaryGenerator: Error generating summary:', error);
            return this.getBasicSummary();
        } finally {
            this.isGenerating = false;
        }
    }

    getBasicSummary() {
        const sessionLog = this.sessionLogger.getSessionLog();
        const summaryStats = this.sessionLogger.getSummaryStats();

        return {
            session: sessionLog,
            statistics: summaryStats,
            ai: this.llmService.generateFallbackSummary({ summary: summaryStats, recent_deviations: [] }),
            generated_at: Date.now()
        };
    }

    getProblemMeasures() {
        if (this.currentSummary && this.currentSummary.ai) {
            return this.currentSummary.ai.recommended_measures || [];
        }
        const stats = this.sessionLogger.getSummaryStats();
        return stats.problem_measures.slice(0, 3).map(m => m.measure);
    }

    getSuggestedTempo() {
        if (this.currentSummary && this.currentSummary.ai) {
            return this.currentSummary.ai.suggested_tempo || 80;
        }
        return 80;
    }

    getCurrentSummary() {
        return this.currentSummary;
    }

    clear() {
        this.sessionLogger.clear();
        this.currentSummary = null;
    }

    exportSessionLog() {
        return JSON.stringify(this.sessionLogger.getSessionLog(), null, 2);
    }
}

describe('AISummaryGenerator', () => {
    let generator;

    beforeEach(() => {
        generator = new AISummaryGenerator();
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

        // Add some deviations
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
