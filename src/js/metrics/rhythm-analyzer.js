/**
 * Rhythm Analyzer - Analyzes rhythmic precision
 */

class RhythmAnalyzer {
    constructor() {
        this.tempo = 120;
        this.beatTimestamps = [];
        this.noteOnsets = [];
        this.expectedIntervals = [];
        this.timingSensitivity = 1.0;
    }

    setTempo(bpm) {
        this.tempo = bpm;
    }

    recordBeat(timestamp) {
        this.beatTimestamps.push(timestamp);
    }

    recordNoteOnset(timestamp) {
        this.noteOnsets.push(timestamp);
    }

    setExpectedIntervals(intervals) {
        this.expectedIntervals = intervals;
    }

    calculateBeatDeviation() {
        if (this.beatTimestamps.length < 2) return 100;

        const expectedInterval = 60000 / this.tempo; // ms per beat
        const deviations = [];

        for (let i = 1; i < this.beatTimestamps.length; i++) {
            const actualInterval = this.beatTimestamps[i] - this.beatTimestamps[i - 1];
            // Apply timing sensitivity - higher sensitivity = more lenient scoring
            const deviation = Math.abs(actualInterval - expectedInterval) / this.timingSensitivity;
            deviations.push(deviation);
        }

        if (deviations.length === 0) return 100;

        const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;

        // Convert to percentage - 0 deviation = 100%, 100ms deviation = 50%
        const score = Math.max(0, 100 - (avgDeviation / expectedInterval) * 100);
        return Math.round(score);
    }

    calculateNoteDuration(noteIndex, actualDuration) {
        if (!this.expectedIntervals[noteIndex]) {
            return 75; // Default if no expected duration
        }

        const expectedDuration = this.expectedIntervals[noteIndex];
        const deviation = Math.abs(actualDuration - expectedDuration);
        const percentDeviation = (deviation / expectedDuration) * 100;

        // Within 10% = 100%, within 50% = 50%
        const score = Math.max(0, 100 - percentDeviation * 2);
        return Math.round(score);
    }

    calculateOverallTiming() {
        const beatScore = this.calculateBeatDeviation();
        const noteScores = [];

        if (this.noteOnsets.length > 1) {
            for (let i = 1; i < this.noteOnsets.length; i++) {
                const actualInterval = this.noteOnsets[i] - this.noteOnsets[i - 1];
                const expectedInterval = this.expectedIntervals[i - 1] || (60000 / this.tempo);
                const deviation = Math.abs(actualInterval - expectedInterval);
                const score = Math.max(0, 100 - (deviation / expectedInterval) * 100);
                noteScores.push(score);
            }
        }

        if (noteScores.length === 0) {
            return beatScore;
        }

        const avgNoteScore = noteScores.reduce((a, b) => a + b, 0) / noteScores.length;
        return Math.round((beatScore + avgNoteScore) / 2);
    }

    getTempoMap() {
        return {
            current: this.tempo,
            deviations: this.beatTimestamps.map((t, i) => {
                if (i === 0) return 0;
                const expected = 60000 / this.tempo;
                return t - this.beatTimestamps[i - 1] - expected;
            })
        };
    }

    reset() {
        this.beatTimestamps = [];
        this.noteOnsets = [];
    }

    // Estimate timing based on note count (fallback when no actual timing data)
    estimateTiming(noteCount, durationMs) {
        if (noteCount === 0 || durationMs === 0) return 100;

        const expectedDuration = (noteCount * 60000) / this.tempo;
        const deviation = Math.abs(durationMs - expectedDuration);
        const percentDeviation = (deviation / expectedDuration) * 100;

        return Math.max(0, Math.round(100 - percentDeviation));
    }
}

window.RhythmAnalyzer = RhythmAnalyzer;