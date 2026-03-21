/**
 * AI Summary Generator - Coordinates session logging and LLM processing
 * Generates comprehensive post-session reports with AI insights
 */

class AISummaryGenerator {
    constructor() {
        this.sessionLogger = new SessionLogger();
        this.llmService = new LLMService();
        this.currentSummary = null;
        this.isGenerating = false;
    }

    /**
     * Initialize the generator for a new session
     * @param {string} scoreId - The ID of the score being practiced
     */
    startSession(scoreId) {
        this.sessionLogger.startSession(scoreId);
        this.currentSummary = null;
        console.log('AISummaryGenerator: Session started');
    }

    /**
     * Log a pitch deviation from performance
     * @param {Object} params - Deviation parameters
     */
    logPitchDeviation(params) {
        this.sessionLogger.logPitchDeviation(params);
    }

    /**
     * Log a rhythm deviation from performance
     * @param {Object} params - Deviation parameters
     */
    logRhythmDeviation(params) {
        this.sessionLogger.logRhythmDeviation(params);
    }

    /**
     * Log an intonation deviation from performance
     * @param {Object} params - Deviation parameters
     */
    logIntonationDeviation(params) {
        this.sessionLogger.logIntonationDeviation(params);
    }

    /**
     * Generate the complete post-session summary
     * @returns {Promise<Object>} Complete summary with AI insights
     */
    async generateSummary() {
        if (this.isGenerating) {
            console.warn('AISummaryGenerator: Already generating summary');
            return this.currentSummary;
        }

        this.isGenerating = true;

        try {
            const sessionLog = this.sessionLogger.getSessionLog();
            const summaryStats = this.sessionLogger.getSummaryStats();

            // Prepare data for LLM
            const llmInput = {
                summary: summaryStats,
                recent_deviations: sessionLog.deviations.slice(-30)
            };

            // Generate AI insights
            const aiResult = await this.llmService.generateSummary(llmInput);

            // Combine results
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

    /**
     * Get basic summary without AI insights (fallback)
     * @returns {Object} Basic summary
     */
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

    /**
     * Get problem measures for smart looping
     * @returns {Array} Array of measure numbers needing practice
     */
    getProblemMeasures() {
        if (this.currentSummary && this.currentSummary.ai) {
            return this.currentSummary.ai.recommended_measures || [];
        }
        // Fallback to statistical analysis
        const stats = this.sessionLogger.getSummaryStats();
        return stats.problem_measures.slice(0, 3).map(m => m.measure);
    }

    /**
     * Get suggested tempo for practice
     * @returns {number} Suggested BPM
     */
    getSuggestedTempo() {
        if (this.currentSummary && this.currentSummary.ai) {
            return this.currentSummary.ai.suggested_tempo || 80;
        }
        return 80; // Default practice tempo
    }

    /**
     * Get the current summary
     * @returns {Object|null} Current summary or null
     */
    getCurrentSummary() {
        return this.currentSummary;
    }

    /**
     * Clear session data
     */
    clear() {
        this.sessionLogger.clear();
        this.currentSummary = null;
    }

    /**
     * Export session log as JSON
     * @returns {string} JSON string
     */
    exportSessionLog() {
        return JSON.stringify(this.sessionLogger.getSessionLog(), null, 2);
    }
}

window.AISummaryGenerator = AISummaryGenerator;
