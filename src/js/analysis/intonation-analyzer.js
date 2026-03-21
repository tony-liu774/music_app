/**
 * Intonation Analyzer - Combines pitch and rhythm for overall musicality score
 * Third axis: Intonation = pitch accuracy + rhythm precision + note transition smoothness
 */

class IntonationAnalyzer {
    constructor() {
        this.pitchScores = [];
        this.rhythmScores = [];
        this.transitionScores = [];
        this.noteHistory = [];
        this.maxHistorySize = 10;
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
        }

        this.pitchScores.push(pitchAccuracy);
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
    }

    /**
     * Calculate the overall intonation score combining all three axes
     */
    calculateIntonationScore() {
        const pitchScore = this.getAveragePitchScore();
        const rhythmScore = this.getAverageRhythmScore();
        const transitionScore = this.getAverageTransitionScore();

        // Weighted average: pitch 40%, rhythm 40%, transitions 20%
        const overall = (pitchScore * 0.4) + (rhythmScore * 0.4) + (transitionScore * 0.2);

        return {
            overall: Math.round(overall),
            pitch: Math.round(pitchScore),
            rhythm: Math.round(rhythmScore),
            transition: Math.round(transitionScore)
        };
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
     * Get the weakest axis for recommendations
     */
    getWeakestAxis() {
        const scores = this.calculateIntonationScore();
        const axes = [
            { name: 'pitch', score: scores.pitch },
            { name: 'rhythm', score: scores.rhythm },
            { name: 'intonation', score: scores.transition }
        ];

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

window.IntonationAnalyzer = IntonationAnalyzer;
