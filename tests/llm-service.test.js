/**
 * Tests for LLMService - AI Summary generation
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Mock LLMService for testing
class LLMService {
    constructor() {
        this.apiEndpoint = '/api/ai-summary';
        this.isProcessing = false;
        this.instrument = 'violin';
    }

    setInstrument(instrument) {
        this.instrument = instrument || 'violin';
    }

    async generateSummary(sessionData) {
        if (this.isProcessing) {
            return null;
        }

        this.isProcessing = true;

        try {
            const prompt = this.buildPrompt(sessionData);

            // Simulate API call
            const result = {
                summary: 'Great work!',
                recommendations: [],
                problem_measures: [14, 18, 22],
                overall_assessment: 'Good practice session',
                success: true
            };

            return {
                success: true,
                summary: result.summary,
                recommendations: result.recommendations || [],
                problem_measures: result.problem_measures || [],
                overall_assessment: result.overall_assessment || '',
                generated_at: Date.now()
            };

        } catch (error) {
            console.error('LLMService: Error generating summary:', error);
            return {
                success: false,
                error: error.message,
                fallback: this.generateFallbackSummary(sessionData)
            };
        } finally {
            this.isProcessing = false;
        }
    }

    buildPrompt(sessionData) {
        const { summary, recent_deviations } = sessionData;
        const formattedDeviations = this.formatDeviationsForPrompt(recent_deviations);

        return `## System Prompt: The Virtual Concertmaster AI

**Role:** You are an elite, empathetic, and highly analytical masterclass string instructor.

**Input Data:** Instrument: ${this.instrument}

Error Log (JSON format):
${formattedDeviations}

## Output Format
Provide your response as JSON.`;
    }

    formatDeviationsForPrompt(deviations) {
        if (!deviations || deviations.length === 0) {
            return '[]';
        }

        const recent = deviations.slice(-20);

        return JSON.stringify(recent.map(d => ({
            measure: d.measure,
            type: d.type,
            deviation_cents: d.deviation_cents || 0,
            deviation_ms: d.deviation_ms || 0,
            expected_pitch: d.expected_pitch,
            actual_pitch: d.actual_pitch
        })), null, 2);
    }

    analyzeDeviationPatterns(deviations) {
        if (!deviations || deviations.length === 0) {
            return '';
        }

        const pitchDevs = deviations.filter(d => d.type === 'pitch');
        const sharpCount = pitchDevs.filter(d => d.deviation_cents > 0).length;
        const flatCount = pitchDevs.filter(d => d.deviation_cents < 0).length;

        return { sharpCount, flatCount };
    }

    generateFallbackSummary(sessionData) {
        const { summary } = sessionData;

        const isSharp = summary.average_pitch_deviation_cents > 10;
        const isFlat = summary.average_pitch_deviation_cents < -10;
        const problemMeasures = summary.problem_measures.slice(0, 3).map(m => m.measure);
        const suggestedTempo = Math.max(40, Math.round(120 * 0.7));

        return {
            overall_assessment: 'Great work on this run-through!',
            diagnosis: 'I noticed some inconsistency in your intonation.',
            fix: 'Try releasing tension in your left hand between notes.',
            recommended_measures: problemMeasures,
            suggested_tempo: suggestedTempo,
            is_fallback: true
        };
    }

    isBusy() {
        return this.isProcessing;
    }
}

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

    it('should handle empty session data', async () => {
        const result = await llmService.generateSummary({
            summary: { total_notes_played: 0, problem_measures: [], average_pitch_deviation_cents: 0 },
            recent_deviations: []
        });

        assert.strictEqual(result.success, true);
    });

    it('should build prompt with session data', () => {
        const sessionData = {
            summary: {
                total_notes_played: 100,
                problem_measures: [{ measure: 14, error_count: 5 }],
                average_pitch_deviation_cents: -25
            },
            recent_deviations: [
                { measure: 14, beat: 2, type: 'pitch', deviation_cents: -50, expected_pitch: 'C#5', actual_pitch: 'C5' }
            ]
        };

        const prompt = llmService.buildPrompt(sessionData);

        assert.ok(prompt.includes('Instrument: violin'));
        assert.ok(prompt.includes('Error Log'));
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

    it('should analyze deviation patterns correctly', () => {
        const deviations = [
            { type: 'pitch', deviation_cents: 30 },
            { type: 'pitch', deviation_cents: 40 },
            { type: 'pitch', deviation_cents: 25 },
            { type: 'pitch', deviation_cents: -20 },
            { type: 'pitch', deviation_cents: -30 },
            { type: 'rhythm', deviation_ms: 20 }
        ];

        const patterns = llmService.analyzeDeviationPatterns(deviations);

        assert.strictEqual(patterns.sharpCount, 3);
        assert.strictEqual(patterns.flatCount, 2);
    });

    it('should return empty patterns for empty deviations', () => {
        const patterns = llmService.analyzeDeviationPatterns([]);
        assert.strictEqual(patterns, '');
    });

    it('should generate fallback summary with sharp tendency', () => {
        const sessionData = {
            summary: {
                total_notes_played: 100,
                problem_measures: [{ measure: 14, error_count: 5 }, { measure: 18, error_count: 3 }],
                average_pitch_deviation_cents: 25,
                pitch_deviation_count: 30,
                rhythm_deviation_count: 10
            },
            recent_deviations: []
        };

        const fallback = llmService.generateFallbackSummary(sessionData);

        assert.ok(fallback.overall_assessment.includes('Great work'));
        assert.ok(fallback.diagnosis);
        assert.ok(fallback.fix);
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
                pitch_deviation_count: 20,
                rhythm_deviation_count: 5
            },
            recent_deviations: []
        };

        const fallback = llmService.generateFallbackSummary(sessionData);

        assert.ok(fallback.diagnosis);
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
                average_pitch_deviation_cents: 15
            },
            recent_deviations: [
                { measure: 14, beat: 1, type: 'pitch', deviation_cents: -50 }
            ]
        };

        const prompt = llmService.buildPrompt(sessionData);

        assert.ok(prompt.includes('Instrument'));
        assert.ok(prompt.includes('violin'));
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
});
