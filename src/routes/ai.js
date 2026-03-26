const express = require('express');
const router = express.Router();

// Initialize Anthropic client (will use ANTHROPIC_API_KEY from environment)
let anthropic = null;

// Lazy initialization of Anthropic client
function getAnthropicClient() {
    if (!anthropic) {
        const Anthropic = require('@anthropic-ai/sdk');
        anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
    }
    return anthropic;
}

/**
 * POST /api/ai-summary
 * Generate AI-powered performance summary using Claude API.
 * The LLM is prompted as an encouraging masterclass professor,
 * returning max 2 sentences of feedback.
 */
router.post('/ai-summary', async (req, res) => {
    try {
        const { prompt, session_data } = req.body;

        if (!prompt) {
            return res.status(400).json({
                error: 'Missing prompt',
                message: 'A prompt is required to generate summary'
            });
        }

        // Check if Anthropic API key is available
        if (!process.env.ANTHROPIC_API_KEY) {
            console.warn('Anthropic API key not configured, using fallback');
            return res.status(200).json({
                error: 'API key not configured',
                message: 'Using fallback summary generation',
                use_fallback: true
            });
        }

        const client = getAnthropicClient();

        const message = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 500,
            temperature: 0.7,
            system: 'You are a masterclass string instructor providing encouraging and actionable feedback to students after their practice sessions. Keep your feedback concise, specific, and focused on improvement. Always respond with valid JSON.',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
        });

        const responseContent = message.content[0].text;

        // Parse JSON response
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(responseContent);
        } catch (parseError) {
            console.error('Failed to parse LLM response:', parseError);
            return res.status(500).json({
                error: 'Failed to parse LLM response',
                message: 'The AI response could not be parsed'
            });
        }

        // Return structured response — pass through raw LLM JSON so
        // the client can parse prompt-specific fields (e.g. {debrief, score}).
        res.json({
            success: true,
            raw: responseContent,
            summary: parsedResponse.debrief || parsedResponse.overall_assessment || '',
            recommendations: parsedResponse.areas_for_improvement || [],
            problem_measures: parsedResponse.recommended_measures || [],
            overall_assessment: parsedResponse.debrief || parsedResponse.overall_assessment || '',
            suggested_tempo: parsedResponse.suggested_tempo || 80,
            score: parsedResponse.score ?? null,
            strengths: parsedResponse.strengths || [],
            specific_guidance: parsedResponse.specific_guidance || ''
        });

    } catch (error) {
        console.error('AI Summary Error:', error);

        // Handle rate limiting
        if (error.status === 429) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                message: 'Too many requests. Please try again later.',
                use_fallback: true
            });
        }

        // Handle authentication errors
        if (error.status === 401) {
            return res.status(401).json({
                error: 'Authentication failed',
                message: 'Invalid API key. Please check your Anthropic API key.',
                use_fallback: true
            });
        }

        // Return error with fallback flag
        res.status(500).json({
            error: 'AI generation failed',
            message: error.message,
            use_fallback: true
        });
    }
});

module.exports = router;
