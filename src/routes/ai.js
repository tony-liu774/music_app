const express = require('express');
const router = express.Router();

// Initialize OpenAI client (will use OPENAI_API_KEY from environment)
let openai = null;

// Lazy initialization of OpenAI client
function getOpenAIClient() {
    if (!openai) {
        const OpenAI = require('openai');
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }
    return openai;
}

/**
 * POST /api/ai-summary
 * Generate AI-powered performance summary using GPT-4o-mini
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

        // Check if OpenAI API key is available
        if (!process.env.OPENAI_API_KEY) {
            console.warn('OpenAI API key not configured, using fallback');
            return res.status(200).json({
                error: 'API key not configured',
                message: 'Using fallback summary generation',
                // Fallback will be handled by frontend
                use_fallback: true
            });
        }

        const client = getOpenAIClient();

        // Call GPT-4o-mini to generate summary
        const completion = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are a masterclass violin instructor providing encouraging and actionable feedback to students after their practice sessions. Keep your feedback concise, specific, and focused on improvement.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 500
        });

        const responseContent = completion.choices[0].message.content;

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

        // Return structured response
        res.json({
            success: true,
            summary: parsedResponse.overall_assessment || '',
            recommendations: parsedResponse.areas_for_improvement || [],
            problem_measures: parsedResponse.recommended_measures || [],
            overall_assessment: parsedResponse.overall_assessment || '',
            suggested_tempo: parsedResponse.suggested_tempo || 80,
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
                message: 'Invalid API key. Please check your OpenAI API key.',
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
