/**
 * Tests for LLMService - AI Summary generation
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const { LLMService } = require('../src/js/services/llm-service');

describe('LLMService', () => {
    let llmService;

    beforeEach(() => {
        llmService = new LLMService();
    });

    it('should initialize with default instrument', () => {
        assert.strictEqual(llmService.instrument, 'violin');
        assert.strictEqual(llmService.isProcessing, false);
        assert.strictEqual(llmService.apiEndpoint, '/api/ai-summary');
    });

    it('should set instrument correctly', () => {
        llmService.setInstrument('cello');
        assert.strictEqual(llmService.instrument, 'cello');

        llmService.setInstrument('viola');
        assert.strictEqual(llmService.instrument, 'viola');
    });

    it('should build prompt with session data', () => {
        const sessionData = {
            summary: {
                total_notes_played: 100,
                problem_measures: [{ measure: 14, error_count: 5 }],
                average_pitch_deviation_cents: -25,
                dynamics_deviation_count: 0,
                average_dynamics_deviation: 0,
                articulation_deviation_count: 0,
                average_articulation_score: 100
            },
            recent_deviations: [
                { measure: 14, beat: 2, type: 'pitch', deviation_cents: -50, expected_pitch: 'C#5', actual_pitch: 'C5' }
            ]
        };

        const prompt = llmService.buildPrompt(sessionData);

        assert.ok(prompt.includes('Instrument: violin'));
        assert.ok(prompt.includes('Error Log'));
        assert.ok(prompt.includes('Total notes played: 100'));
    });

    it('should format deviations for prompt correctly', () => {
        const deviations = [
            { measure: 14, beat: 2, type: 'pitch', deviation_cents: -50, expected_pitch: 'C#5', actual_pitch: 'C5' },
            { measure: 15, beat: 1, type: 'pitch', deviation_cents: 25, expected_pitch: 'G4', actual_pitch: 'G#4' },
            { measure: 16, beat: 3, type: 'rhythm', deviation_ms: 30 }
        ];

        const formatted = llmService.formatDeviationsForPrompt(deviations);

        assert.ok(formatted.includes('"measure": 14'));
        assert.ok(formatted.includes('"deviation_cents": -50'));
        assert.ok(formatted.includes('"deviation_ms": 30'));
    });

    it('should handle empty deviations', () => {
        const formatted = llmService.formatDeviationsForPrompt([]);
        assert.strictEqual(formatted, '[]');

        const nullFormatted = llmService.formatDeviationsForPrompt(null);
        assert.strictEqual(nullFormatted, '[]');
    });

    it('should analyze deviation patterns and return string', () => {
        const deviations = [
            { type: 'pitch', deviation_cents: 30, measure: 1 },
            { type: 'pitch', deviation_cents: 40, measure: 1 },
            { type: 'pitch', deviation_cents: 25, measure: 2 },
            { type: 'pitch', deviation_cents: -10, measure: 3 },
            { type: 'rhythm', deviation_ms: 20, measure: 4 }
        ];

        const patterns = llmService.analyzeDeviationPatterns(deviations);

        assert.ok(typeof patterns === 'string');
        assert.ok(patterns.includes('DEVIATION PATTERNS'));
        assert.ok(patterns.includes('SHARP'));
    });

    it('should return empty string for empty deviations', () => {
        const patterns = llmService.analyzeDeviationPatterns([]);
        assert.strictEqual(patterns, '');
    });

    it('should generate fallback summary with sharp tendency', () => {
        const sessionData = {
            summary: {
                total_notes_played: 100,
                problem_measures: [{ measure: 14, error_count: 5 }, { measure: 18, error_count: 3 }],
                average_pitch_deviation_cents: 25,
                average_rhythm_deviation_ms: 15,
                pitch_deviation_count: 30,
                rhythm_deviation_count: 10
            },
            recent_deviations: []
        };

        const fallback = llmService.generateFallbackSummary(sessionData);

        assert.ok(fallback.overall_assessment.length > 0);
        assert.ok(fallback.diagnosis.length > 0);
        assert.ok(fallback.fix.length > 0);
        assert.strictEqual(fallback.recommended_measures.length, 2);
        assert.ok(fallback.suggested_tempo >= 40);
        assert.strictEqual(fallback.is_fallback, true);
    });

    it('should generate fallback summary with flat tendency', () => {
        const sessionData = {
            summary: {
                total_notes_played: 100,
                problem_measures: [{ measure: 10, error_count: 4 }],
                average_pitch_deviation_cents: -30,
                average_rhythm_deviation_ms: 10,
                pitch_deviation_count: 20,
                rhythm_deviation_count: 5
            },
            recent_deviations: []
        };

        const fallback = llmService.generateFallbackSummary(sessionData);

        assert.ok(fallback.diagnosis.length > 0);
        assert.strictEqual(fallback.recommended_measures[0], 10);
    });

    it('should report busy status correctly', () => {
        assert.strictEqual(llmService.isBusy(), false);
    });

    it('should set instrument to violin by default when null passed', () => {
        llmService.setInstrument(null);
        assert.strictEqual(llmService.instrument, 'violin');
    });
});

describe('LLMService Prompt Generation', () => {
    let llmService;

    beforeEach(() => {
        llmService = new LLMService();
    });

    it('should include problem measures in prompt', () => {
        const sessionData = {
            summary: {
                total_notes_played: 50,
                problem_measures: [
                    { measure: 14, error_count: 8 },
                    { measure: 18, error_count: 5 },
                    { measure: 22, error_count: 3 }
                ],
                average_pitch_deviation_cents: 15,
                dynamics_deviation_count: 0,
                average_dynamics_deviation: 0,
                articulation_deviation_count: 0,
                average_articulation_score: 100
            },
            recent_deviations: [
                { measure: 14, beat: 1, type: 'pitch', deviation_cents: -50 }
            ]
        };

        const prompt = llmService.buildPrompt(sessionData);

        assert.ok(prompt.includes('Instrument'));
        assert.ok(prompt.includes('violin'));
        assert.ok(prompt.includes('measure 14'));
    });

    it('should handle many deviations but limit to 20', () => {
        const deviations = [];
        for (let i = 1; i <= 30; i++) {
            deviations.push({ measure: i, beat: 1, type: 'pitch', deviation_cents: 10 });
        }

        const formatted = llmService.formatDeviationsForPrompt(deviations);
        const parsed = JSON.parse(formatted);

        assert.strictEqual(parsed.length, 20);
    });

    it('should preserve dynamics-specific fields in formatted output', () => {
        const deviations = [
            { measure: 3, type: 'dynamics', expected_dynamic: 'f', actual_dynamic: 'p', deviation: -3, expected_direction: 'crescendo', actual_trend: 'stable' }
        ];

        const formatted = llmService.formatDeviationsForPrompt(deviations);
        const parsed = JSON.parse(formatted);

        assert.strictEqual(parsed[0].type, 'dynamics');
        assert.strictEqual(parsed[0].expected_dynamic, 'f');
        assert.strictEqual(parsed[0].actual_dynamic, 'p');
        assert.strictEqual(parsed[0].deviation, -3);
        assert.strictEqual(parsed[0].expected_direction, 'crescendo');
        assert.strictEqual(parsed[0].actual_trend, 'stable');
    });

    it('should preserve articulation-specific fields in formatted output', () => {
        const deviations = [
            { measure: 5, type: 'articulation', expected_articulation: 'staccato', detected_articulation: 'legato', score: 20, feedback: 'Shorten your bow strokes' }
        ];

        const formatted = llmService.formatDeviationsForPrompt(deviations);
        const parsed = JSON.parse(formatted);

        assert.strictEqual(parsed[0].type, 'articulation');
        assert.strictEqual(parsed[0].expected_articulation, 'staccato');
        assert.strictEqual(parsed[0].detected_articulation, 'legato');
        assert.strictEqual(parsed[0].score, 20);
        assert.strictEqual(parsed[0].feedback, 'Shorten your bow strokes');
    });
});
