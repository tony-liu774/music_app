/**
 * Performance Comparator - Matches detected notes to sheet music
 */

class PerformanceComparator {
    constructor() {
        this.currentScore = null;
        this.currentPosition = 0;
        this.lookaheadNotes = [];
    }

    setScore(score) {
        this.currentScore = score;
        this.currentPosition = 0;
        this.lookaheadNotes = [];
    }

    /**
     * Compare detected note to expected note
     * @param {Object} detectedNote - { name, octave, frequency, midi }
     * @returns {Object} - Match result
     */
    compare(detectedNote) {
        if (!this.currentScore) {
            return { matched: false, reason: 'No score loaded' };
        }

        // Get expected notes around current position
        const expectedNote = this.getExpectedNote();

        if (!expectedNote) {
            return { matched: false, reason: 'No more notes in score' };
        }

        // Compare MIDI numbers
        const detectedMIDI = detectedNote.midi;
        const expectedMIDI = expectedNote.getMIDI();

        const midiMatch = detectedMIDI === expectedMIDI;

        // Calculate cents deviation
        const centsDeviation = this.calculateCentsDeviation(
            detectedNote.frequency,
            expectedNote.getFrequency()
        );

        // Determine match with tolerance
        const tolerance = 50; // cents
        const matched = Math.abs(centsDeviation) <= tolerance;

        if (matched) {
            // Advance position
            this.currentPosition++;
        }

        return {
            matched,
            expectedNote,
            detectedNote,
            centsDeviation,
            currentPosition: this.currentPosition,
            totalNotes: this.getTotalNotes()
        };
    }

    getExpectedNote() {
        if (!this.currentScore) return null;

        const allNotes = this.currentScore.getAllNotes();
        return allNotes[this.currentPosition] || null;
    }

    calculateCentsDeviation(observedFreq, targetFreq) {
        if (!observedFreq || !targetFreq) return 0;
        return Math.round(1200 * Math.log2(observedFreq / targetFreq));
    }

    getTotalNotes() {
        if (!this.currentScore) return 0;
        return this.currentScore.getAllNotes().length;
    }

    getProgress() {
        const total = this.getTotalNotes();
        return total > 0 ? (this.currentPosition / total) * 100 : 0;
    }

    reset() {
        this.currentPosition = 0;
    }

    setPosition(position) {
        this.currentPosition = Math.max(0, Math.min(position, this.getTotalNotes() - 1));
    }

    getMeasureAtPosition(position) {
        if (!this.currentScore) return 0;

        let noteCount = 0;
        for (const part of this.currentScore.parts) {
            for (let i = 0; i < part.measures.length; i++) {
                const measure = part.measures[i];
                noteCount += measure.notes.length;
                if (noteCount > position) {
                    return i + 1;
                }
            }
        }
        return 1;
    }
}

window.PerformanceComparator = PerformanceComparator;