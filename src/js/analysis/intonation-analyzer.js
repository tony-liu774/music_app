/**
 * Intonation Analyzer - Combines pitch accuracy, rhythm precision, and note transitions
 * for a comprehensive three-axis analysis (pitch, rhythm, intonation)
 */

class IntonationAnalyzer {
    constructor() {
        this.pitchHistory = [];
        this.timingHistory = [];
        this.transitionHistory = [];
        this.previousNote = null;
        this.previousNoteTime = null;

        // Thresholds for intonation scoring
        this.pitchThreshold = 10; // cents within which intonation is "good"
        this.timingThreshold = 50; // ms within which timing is "good"
        this.transitionThreshold = 100; // ms for smooth note transition
    }

    /**
     * Record a pitch analysis result
     * @param {Object} noteInfo - Contains frequency, name, octave, centsDeviation
     * @param {number} timestamp - When the note was detected
     */
    recordPitch(noteInfo, timestamp) {
        const pitchData = {
            timestamp: timestamp,
            frequency: noteInfo.frequency,
            name: noteInfo.name,
            octave: noteInfo.octave,
            centsDeviation: noteInfo.centsDeviation || 0,
            accuracy: this.calculatePitchAccuracy(noteInfo.centsDeviation || 0)
        };
        this.pitchHistory.push(pitchData);
        return pitchData;
    }

    /**
     * Record timing deviation for a note
     * @param {number} expectedTime - When the note was expected
     * @param {number} actualTime - When the note was actually played
     */
    recordTiming(expectedTime, actualTime) {
        const deviation = actualTime - expectedTime;
        const timingData = {
            expected: expectedTime,
            actual: actualTime,
            deviation: deviation, // positive = late, negative = early
            absoluteDeviation: Math.abs(deviation),
            accuracy: this.calculateTimingAccuracy(deviation)
        };
        this.timingHistory.push(timingData);
        return timingData;
    }

    /**
     * Record a note transition
     * @param {Object} noteInfo - Current note info
     * @param {number} timestamp - When the note started
     */
    recordTransition(noteInfo, timestamp) {
        let transitionScore = 100;

        if (this.previousNote && this.previousNoteTime) {
            const transitionTime = timestamp - this.previousNoteTime;

            // Calculate transition smoothness based on expected interval
            const expectedInterval = this.getExpectedInterval(this.previousNote, noteInfo);
            const transitionDeviation = Math.abs(transitionTime - expectedInterval);

            transitionScore = Math.max(0, 100 - (transitionDeviation / this.transitionThreshold) * 100);
        }

        const transitionData = {
            from: this.previousNote ? { ...this.previousNote } : null,
            to: { name: noteInfo.name, octave: noteInfo.octave },
            timestamp: timestamp,
            duration: this.previousNoteTime ? timestamp - this.previousNoteTime : 0,
            score: transitionScore
        };

        this.transitionHistory.push(transitionData);

        this.previousNote = { name: noteInfo.name, octave: noteInfo.octave };
        this.previousNoteTime = timestamp;

        return transitionData;
    }

    /**
     * Calculate pitch accuracy (0-100)
     * @param {number} centsDeviation - Deviation in cents
     */
    calculatePitchAccuracy(centsDeviation) {
        const absCents = Math.abs(centsDeviation);
        // 0 cents = 100%, 50 cents = 0%
        return Math.max(0, 100 - (absCents * 2));
    }

    /**
     * Calculate timing accuracy (0-100)
     * @param {number} deviationMs - Deviation in milliseconds
     */
    calculateTimingAccuracy(deviationMs) {
        const absDeviation = Math.abs(deviationMs);
        // 0ms = 100%, 100ms = 0%
        return Math.max(0, 100 - absDeviation);
    }

    /**
     * Calculate transition smoothness (0-100)
     * @param {number} transitionTime - Actual transition time in ms
     * @param {number} expectedInterval - Expected interval in ms
     */
    calculateTransitionAccuracy(transitionTime, expectedInterval) {
        if (!expectedInterval || expectedInterval === 0) return 100;
        const deviation = Math.abs(transitionTime - expectedInterval);
        return Math.max(0, 100 - (deviation / this.transitionThreshold) * 100);
    }

    /**
     * Get expected interval between two notes
     */
    getExpectedInterval(previousNote, currentNote) {
        // Simplified: assume quarter note at 120 BPM = 500ms
        // In a real implementation, this would check the score
        return 500;
    }

    /**
     * Get the overall pitch score (0-100)
     */
    getPitchScore() {
        if (this.pitchHistory.length === 0) return 0;
        const sum = this.pitchHistory.reduce((acc, p) => acc + p.accuracy, 0);
        return sum / this.pitchHistory.length;
    }

    /**
     * Get the overall rhythm/timing score (0-100)
     */
    getRhythmScore() {
        if (this.timingHistory.length === 0) return 100;
        const sum = this.timingHistory.reduce((acc, t) => acc + t.accuracy, 0);
        return sum / this.timingHistory.length;
    }

    /**
     * Get the overall transition smoothness score (0-100)
     */
    getTransitionScore() {
        if (this.transitionHistory.length === 0) return 100;
        const sum = this.transitionHistory.reduce((acc, t) => acc + t.score, 0);
        return sum / this.transitionHistory.length;
    }

    /**
     * Calculate the intonation score combining all three axes
     * @param {number} pitchWeight - Weight for pitch (default 0.4)
     * @param {number} rhythmWeight - Weight for rhythm (default 0.4)
     * @param {number} transitionWeight - Weight for transitions (default 0.2)
     */
    getIntonationScore(pitchWeight = 0.4, rhythmWeight = 0.4, transitionWeight = 0.2) {
        const pitchScore = this.getPitchScore();
        const rhythmScore = this.getRhythmScore();
        const transitionScore = this.getTransitionScore();

        return (
            pitchScore * pitchWeight +
            rhythmScore * rhythmWeight +
            transitionScore * transitionWeight
        );
    }

    /**
     * Get detailed breakdown of all three axes
     */
    getAxisBreakdown() {
        return {
            pitch: {
                score: this.getPitchScore(),
                history: this.pitchHistory,
                averageCents: this.pitchHistory.length > 0
                    ? this.pitchHistory.reduce((a, p) => a + p.centsDeviation, 0) / this.pitchHistory.length
                    : 0
            },
            rhythm: {
                score: this.getRhythmScore(),
                history: this.timingHistory,
                averageDeviation: this.timingHistory.length > 0
                    ? this.timingHistory.reduce((a, t) => a + t.deviation, 0) / this.timingHistory.length
                    : 0
            },
            intonation: {
                score: this.getIntonationScore(),
                pitchScore: this.getPitchScore(),
                rhythmScore: this.getRhythmScore(),
                transitionScore: this.getTransitionScore()
            }
        };
    }

    /**
     * Get the most recent timing deviation in milliseconds
     */
    getLatestTimingDeviation() {
        if (this.timingHistory.length === 0) return null;
        return this.timingHistory[this.timingHistory.length - 1].deviation;
    }

    /**
     * Get recommendation based on weakest axis
     */
    getWeakestAxisRecommendation() {
        const breakdown = this.getAxisBreakdown();

        const axes = [
            { name: 'pitch', score: breakdown.pitch.score },
            { name: 'rhythm', score: breakdown.rhythm.score },
            { name: 'intonation', score: breakdown.intonation.score }
        ];

        axes.sort((a, b) => a.score - b.score);
        const weakest = axes[0];

        const recommendations = {
            pitch: 'Focus on pitch accuracy. Try using a tuner to calibrate your instrument and practice long tones to develop stable pitch.',
            rhythm: 'Focus on rhythm precision. Practice with a metronome and try tapping along to establish a steady pulse.',
            intonation: 'Work on overall musicality. Pay attention to both pitch and timing, and practice connecting notes smoothly.'
        };

        return {
            weakestAxis: weakest.name,
            recommendation: recommendations[weakest.name],
            scores: axes
        };
    }

    /**
     * Get historical data for trend visualization
     */
    getHistoricalTrends() {
        return {
            pitch: this.pitchHistory.slice(-20).map(p => p.accuracy),
            rhythm: this.timingHistory.slice(-20).map(t => t.accuracy),
            intonation: this.getIntonationScore()
        };
    }

    /**
     * Reset all data
     */
    reset() {
        this.pitchHistory = [];
        this.timingHistory = [];
        this.transitionHistory = [];
        this.previousNote = null;
        this.previousNoteTime = null;
    }
}

window.IntonationAnalyzer = IntonationAnalyzer;
