/**
 * LLM Service - Integration with GPT-4o-mini for AI-generated performance summaries
 * Acts as a masterclass instructor providing actionable feedback
 */

class LLMService {
    constructor() {
        this.apiEndpoint = '/api/ai-summary';
        this.isProcessing = false;
        this.instrument = 'violin'; // Default instrument
    }

    /**
     * Set the instrument type for context-specific feedback
     * @param {string} instrument - Instrument name (violin, viola, cello, bass)
     */
    setInstrument(instrument) {
        this.instrument = instrument || 'violin';
    }

    /**
     * Generate an AI-powered performance summary
     * @param {Object} sessionData - The session log data
     * @param {Object} sessionData.summary - Summary statistics
     * @param {Array} sessionData.recent_deviations - Recent deviations for context
     * @returns {Promise<Object>} AI-generated summary with natural language feedback
     */
    async generateSummary(sessionData) {
        if (this.isProcessing) {
            console.warn('LLMService: Already processing a request');
            return null;
        }

        this.isProcessing = true;

        try {
            const prompt = this.buildPrompt(sessionData);

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    instrument: this.instrument
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const result = await response.json();

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

    /**
     * Build a prompt for the LLM based on session data
     * @param {Object} sessionData - Session data
     * @returns {string} Formatted prompt
     */
    buildPrompt(sessionData) {
        const { summary, recent_deviations } = sessionData;

        // Format deviations for the heat map context
        const formattedDeviations = this.formatDeviationsForPrompt(recent_deviations);

        const prompt = `## System Prompt: The Virtual Concertmaster AI

**Role:** You are an elite, empathetic, and highly analytical masterclass string instructor (Violin, Viola, Cello, Double Bass).

**Objective:** Analyze a JSON log of a user's practice session and provide a concise, highly actionable, and encouraging post-session summary.

**Input Data:** JSON array containing: user's instrument type (${this.instrument}), the piece they played, and a log of specific errors (sharp/flat deviations in cents, rushed/dragged rhythm timings by measure).

**Tone:** Speak directly to the musician. Be encouraging but precise. Do not sound like a robot reading data; sound like a supportive conservatory professor.

**Structure (3 short paragraphs):**
1. **The Praise**: Start with what went well overall (e.g., "Great energy on this run-through!")
2. **The Diagnosis**: Identify the 1-2 most significant patterns of error. Group them (e.g., "I noticed your intonation drifts sharp during the shifting passages in measures 14-18," or "Your rhythm tends to rush right before the crescendo in measure 42.")
3. **The Fix**: Provide one physical or technical piece of advice (e.g., "Keep your bow arm relaxed," "Anticipate the shift with your elbow," or "Subdivide the eighth notes in your head")

**Constraints:**
- Never exceed 150 words
- Do not use technical JSON or programming jargon
- Assume the user is looking at a heat map of their mistakes

## Session Data

Instrument: ${this.instrument}

Summary Statistics:
- Total notes played: ${summary.total_notes_played}
- Problem measures (highest error counts): ${summary.problem_measures.slice(0, 3).map(m => `measure ${m.measure} (${m.error_count} errors)`).join(', ') || 'none'}
- Average pitch deviation: ${summary.average_pitch_deviation_cents > 0 ? '+' : ''}${summary.average_pitch_deviation_cents} cents (positive = sharp, negative = flat)

Error Log (JSON format):
${formattedDeviations}

## Output Format

Provide your response as JSON:
{
  "overall_assessment": "The Praise paragraph - 1-2 sentences starting with encouragement",
  "diagnosis": "The Diagnosis paragraph - identify 1-2 patterns of error",
  "fix": "The Fix paragraph - one specific physical/technical advice",
  "recommended_measures": [2-3 measure numbers that need the most practice],
  "suggested_tempo": number between 40-100 BPM for practice
}`;

        return prompt;
    }

    /**
     * Format deviations for the prompt
     * @param {Array} deviations - Raw deviations
     * @returns {string} Formatted string
     */
    formatDeviationsForPrompt(deviations) {
        if (!deviations || deviations.length === 0) {
            return '[]';
        }

        // Take last 20 deviations for context
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

    /**
     * Analyze deviation patterns for specific technical feedback
     * @param {Array} deviations - Recent deviations
     * @returns {string} Pattern analysis string
     */
    analyzeDeviationPatterns(deviations) {
        if (!deviations || deviations.length === 0) {
            return '';
        }

        const pitchDevs = deviations.filter(d => d.type === 'pitch');
        const sharpCount = pitchDevs.filter(d => d.deviation_cents > 0).length;
        const flatCount = pitchDevs.filter(d => d.deviation_cents < 0).length;
        const avgSharp = sharpCount > 0
            ? pitchDevs.filter(d => d.deviation_cents > 0).reduce((sum, d) => sum + d.deviation_cents, 0) / sharpCount
            : 0;
        const avgFlat = flatCount > 0
            ? pitchDevs.filter(d => d.deviation_cents < 0).reduce((sum, d) => sum + Math.abs(d.deviation_cents), 0) / flatCount
            : 0;

        let patterns = '## DEVIATION PATTERNS\n';

        if (sharpCount > flatCount * 1.5) {
            patterns += `- Tendency to play SHARP: The student may be applying too much finger pressure or tensing the left hand. Consider suggesting relaxation techniques.\n`;
        } else if (flatCount > sharpCount * 1.5) {
            patterns += `- Tendency to play FLAT: The student may need to apply more finger weight or adjust thumb position. Suggest planting fingers more decisively.\n`;
        }

        if (avgSharp > 20) {
            patterns += `- Significant sharp tendency (avg +${Math.round(avgSharp)} cents): Check for tension in the left hand, especially during position shifts.\n`;
        }

        if (avgFlat > 20) {
            patterns += `- Significant flat tendency (avg -${Math.round(avgFlat)} cents): Encourage more finger weight and a relaxed but supported hand frame.\n`;
        }

        // Look for measure patterns
        const measureCounts = {};
        pitchDevs.forEach(d => {
            measureCounts[d.measure] = (measureCounts[d.measure] || 0) + 1;
        });

        const problemMeasures = Object.entries(measureCounts)
            .filter(([_, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2);

        if (problemMeasures.length > 0) {
            patterns += `- Repeated issues in measures: ${problemMeasures.map(([m, c]) => `${m}(${c}x)`).join(', ')} - likely a technical passage requiring focused practice\n`;
        }

        return patterns;
    }

    /**
     * Generate a fallback summary when API is unavailable
     * @param {Object} sessionData - Session data
     * @returns {Object} Fallback summary
     */
    generateFallbackSummary(sessionData) {
        const { summary } = sessionData;

        // Analyze patterns
        const isSharp = summary.average_pitch_deviation_cents > 10;
        const isFlat = summary.average_pitch_deviation_cents < -10;
        const pitchQuality = Math.abs(summary.average_pitch_deviation_cents) < 15 ? 'good' :
            Math.abs(summary.average_pitch_deviation_cents) < 30 ? 'acceptable' : 'needs attention';

        const rhythmQuality = summary.average_rhythm_deviation_ms < 20 ? 'solid' :
            summary.average_rhythm_deviation_ms < 50 ? 'developing' : 'needs work';

        const problemMeasures = summary.problem_measures.slice(0, 3).map(m => m.measure);
        const suggestedTempo = Math.max(40, Math.round(120 * 0.7));

        // Generate praise paragraph
        let praise = '';
        if (summary.pitch_deviation_count < summary.total_notes_played * 0.2) {
            praise = `Great work on this run-through! Your pitch consistency was impressive - you clearly have a solid understanding of the fingerboard.`;
        } else if (summary.pitch_deviation_count < summary.total_notes_played * 0.4) {
            praise = `Good effort in this practice session! You're making real progress with your musical phrasing.`;
        } else {
            praise = `Nice try! Every practice session builds toward mastery - keep at it!`;
        }

        // Generate diagnosis paragraph
        let diagnosis = '';
        if (isSharp && isFlat) {
            diagnosis = `I noticed some inconsistency in your intonation - you went sharp in some passages and flat in others. This often happens when the hand frame shifts during position changes.`;
        } else if (isSharp) {
            diagnosis = `I noticed you tended to play slightly sharp throughout, particularly in measures ${problemMeasures.join(', ')}. This often indicates a bit of tension in the left hand.`;
        } else if (isFlat) {
            diagnosis = `Your intonation ran slightly flat in several spots. Try adding a bit more weight from your fingers into the string.`;
        } else if (summary.rhythm_deviation_count > summary.total_notes_played * 0.2) {
            diagnosis = `Your rhythm could use some attention - there were moments where you rushed ahead of the beat.`;
        } else {
            diagnosis = `Your problem areas are concentrated in measures ${problemMeasures.join(' and ')} - these passages likely need focused slow practice.`;
        }

        // Generate fix paragraph
        let fix = '';
        if (isSharp) {
            fix = `Try releasing tension in your left hand between notes. Before each shift, take a brief moment to relax your fingers, then place them deliberately on the new position.`;
        } else if (isFlat) {
            fix = `Focus on "planting" each finger with a bit more weight. Think of your fingers as small hammers - give them enough force to speak clearly.`;
        } else if (problemMeasures.length > 0) {
            fix = `Practice measures ${problemMeasures.join(', ')} at ${suggestedTempo} BPM with a metronome. Slow down, visualize the finger placements, then gradually build speed.`;
        } else {
            fix = `Keep up the great work! Focus on expression and musical phrasing in your next session.`;
        }

        return {
            overall_assessment: praise,
            diagnosis: diagnosis,
            fix: fix,
            recommended_measures: problemMeasures,
            suggested_tempo: suggestedTempo,
            is_fallback: true
        };
    }

    /**
     * Check if the service is currently processing
     * @returns {boolean} Processing status
     */
    isBusy() {
        return this.isProcessing;
    }
}

window.LLMService = LLMService;
