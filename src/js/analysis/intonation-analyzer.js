/**
 * Intonation Analyzer - Combines pitch and rhythm for overall musicality score
 * Third axis: Intonation = pitch accuracy + rhythm precision + note transition smoothness
 */

class IntonationAnalyzer {
    constructor() {
        this.pitchScores = [];
        this.rhythmScores = [];
        this.transitionScores = [];
        this.dynamicsScores = [];
        this.articulationScores = [];
        this.noteHistory = [];
        this.maxHistorySize = 10;
        this.maxScoreHistory = 500;
    }

    /**
     * Record a note's pitch and timing data
     */
    recordNote(noteInfo) {
        const timestamp = Date.now();

        // Calculate pitch accuracy (0-100)
        const pitchAccuracy = this.calculatePitchScore(noteInfo);

        // Store note data
        this.noteHistory.push({
            ...noteInfo,
            timestamp,
            pitchScore: pitchAccuracy
        });

        // Keep history bounded
        if (this.noteHistory.length > this.maxHistorySize) {
            this.noteHistory.shift();
        }

        // Calculate transition score if we have previous notes
        if (this.noteHistory.length >= 2) {
            const prevNote = this.noteHistory[this.noteHistory.length - 2];
            const transitionScore = this.calculateTransitionScore(prevNote, noteInfo);
            this.transitionScores.push(transitionScore);
            if (this.transitionScores.length > this.maxScoreHistory) this.transitionScores.shift();
        }

        this.pitchScores.push(pitchAccuracy);
        if (this.pitchScores.length > this.maxScoreHistory) this.pitchScores.shift();
    }

    /**
     * Calculate pitch accuracy score from note info
     */
    calculatePitchScore(noteInfo) {
        if (!noteInfo || noteInfo.centsDeviation === undefined) {
            return 75; // Default middle score
        }

        const cents = Math.abs(noteInfo.centsDeviation);
        // 0 cents = 100%, 50 cents = 0%
        return Math.max(0, Math.min(100, 100 - (cents * 2)));
    }

    /**
     * Calculate note transition smoothness
     * Considers: interval size, timing between notes, pitch direction
     */
    calculateTransitionScore(prevNote, currentNote) {
        if (!prevNote || !currentNote) {
            return 75;
        }

        // Check if both notes have pitch information
        if (prevNote.frequency === undefined || currentNote.frequency === undefined) {
            return 75;
        }

        // Calculate interval between notes
        const interval = Math.abs(12 * Math.log2(currentNote.frequency / prevNote.frequency));

        // Large intervals are harder to execute smoothly
        let intervalScore = Math.max(0, 100 - (interval * 5));

        // Check timing gap (too fast or too slow between notes affects smoothness)
        const timeGap = currentNote.timestamp - prevNote.timestamp;
        const optimalGap = 200; // ms - typical note separation
        const timingDeviation = Math.abs(timeGap - optimalGap);
        const timingScore = Math.max(0, 100 - (timingDeviation / 10));

        // Combined transition score
        return Math.round((intervalScore * 0.4) + (timingScore * 0.6));
    }

    /**
     * Record a rhythm/timing score from RhythmAnalyzer
     */
    recordRhythmScore(score) {
        this.rhythmScores.push(score);
        if (this.rhythmScores.length > this.maxScoreHistory) this.rhythmScores.shift();
    }

    /**
     * Record a dynamics accuracy score
     * @param {number} score - Dynamics score 0-100
     */
    recordDynamicsScore(score) {
        this.dynamicsScores.push(score);
        if (this.dynamicsScores.length > this.maxScoreHistory) this.dynamicsScores.shift();
    }

    /**
     * Record an articulation accuracy score
     * @param {number} score - Articulation score 0-100
     */
    recordArticulationScore(score) {
        this.articulationScores.push(score);
        if (this.articulationScores.length > this.maxScoreHistory) this.articulationScores.shift();
    }

    /**
     * Calculate the overall intonation score combining all axes
     * When dynamics/articulation data is available, uses expanded weighting
     */
    calculateIntonationScore() {
        const pitchScore = this.getAveragePitchScore();
        const rhythmScore = this.getAverageRhythmScore();
        const transitionScore = this.getAverageTransitionScore();
        const dynamicsScore = this.getAverageDynamicsScore();
        const articulationScore = this.getAverageArticulationScore();

        const hasDynamicsData = this.dynamicsScores.length > 0 || this.articulationScores.length > 0;

        let overall;
        if (hasDynamicsData) {
            // Expanded weighting: pitch 30%, rhythm 30%, transitions 15%, dynamics 15%, articulation 10%
            overall = (pitchScore * 0.30) + (rhythmScore * 0.30) + (transitionScore * 0.15) +
                      (dynamicsScore * 0.15) + (articulationScore * 0.10);
        } else {
            // Original weighting: pitch 40%, rhythm 40%, transitions 20%
            overall = (pitchScore * 0.4) + (rhythmScore * 0.4) + (transitionScore * 0.2);
        }

        const result = {
            overall: Math.round(overall),
            pitch: Math.round(pitchScore),
            rhythm: Math.round(rhythmScore),
            transition: Math.round(transitionScore)
        };

        if (hasDynamicsData) {
            result.dynamics = Math.round(dynamicsScore);
            result.articulation = Math.round(articulationScore);
        }

        return result;
    }

    /**
     * Get average pitch score
     */
    getAveragePitchScore() {
        if (this.pitchScores.length === 0) return 75;
        return this.pitchScores.reduce((a, b) => a + b, 0) / this.pitchScores.length;
    }

    /**
     * Get average rhythm score
     */
    getAverageRhythmScore() {
        if (this.rhythmScores.length === 0) return 75;
        return this.rhythmScores.reduce((a, b) => a + b, 0) / this.rhythmScores.length;
    }

    /**
     * Get average transition score
     */
    getAverageTransitionScore() {
        if (this.transitionScores.length === 0) return 75;
        return this.transitionScores.reduce((a, b) => a + b, 0) / this.transitionScores.length;
    }

    /**
     * Get average dynamics score
     */
    getAverageDynamicsScore() {
        if (this.dynamicsScores.length === 0) return 75;
        return this.dynamicsScores.reduce((a, b) => a + b, 0) / this.dynamicsScores.length;
    }

    /**
     * Get average articulation score
     */
    getAverageArticulationScore() {
        if (this.articulationScores.length === 0) return 75;
        return this.articulationScores.reduce((a, b) => a + b, 0) / this.articulationScores.length;
    }

    /**
     * Get the weakest axis for recommendations
     */
    getWeakestAxis() {
        const scores = this.calculateIntonationScore();
        const axes = [
            { name: 'pitch', score: scores.pitch },
            { name: 'rhythm', score: scores.rhythm },
            { name: 'intonation', score: scores.transition }
        ];

        // Include dynamics/articulation if available
        if (scores.dynamics !== undefined) {
            axes.push({ name: 'dynamics', score: scores.dynamics });
        }
        if (scores.articulation !== undefined) {
            axes.push({ name: 'articulation', score: scores.articulation });
        }

        axes.sort((a, b) => a.score - b.score);
        return axes[0];
    }

    /**
     * Get color based on score (emerald for good, crimson for poor)
     */
    static getScoreColor(score) {
        if (score >= 80) return '#10b981'; // emerald
        if (score >= 60) return '#f59e0b'; // amber/warning
        return '#ef4444'; // crimson/error
    }

    /**
     * Get status based on score
     */
    static getScoreStatus(score) {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'fair';
        return 'needs-work';
    }

    /**
     * Reset all scores
     */
    reset() {
        this.pitchScores = [];
        this.rhythmScores = [];
        this.transitionScores = [];
        this.dynamicsScores = [];
        this.articulationScores = [];
        this.noteHistory = [];
    }

    /**
     * Get current timing deviation in milliseconds
     * This is used to display in the feedback panel
     */
    getTimingDeviation() {
        if (this.noteHistory.length < 2) return 0;

        const lastNote = this.noteHistory[this.noteHistory.length - 1];
        const prevNote = this.noteHistory[this.noteHistory.length - 2];

        // Compare actual timing to expected (based on typical note duration)
        const expectedInterval = 500; // Assume quarter note at 120 BPM
        const actualInterval = lastNote.timestamp - prevNote.timestamp;

        return Math.round(actualInterval - expectedInterval);
    }
}

if (typeof window !== 'undefined') {
    window.IntonationAnalyzer = IntonationAnalyzer;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { IntonationAnalyzer };
}
