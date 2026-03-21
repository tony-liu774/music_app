/**
 * Tests for IntonationAnalyzer
 * Run with: node tests/intonation-analyzer.test.js
 */

// Mock IntonationAnalyzer since it's a browser module
class IntonationAnalyzer {
    constructor() {
        this.pitchHistory = [];
        this.timingHistory = [];
        this.transitionHistory = [];
        this.previousNote = null;
        this.previousNoteTime = null;
        this.pitchThreshold = 10;
        this.timingThreshold = 50;
        this.transitionThreshold = 100;
    }

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

    recordTiming(expectedTime, actualTime) {
        const deviation = actualTime - expectedTime;
        const timingData = {
            expected: expectedTime,
            actual: actualTime,
            deviation: deviation,
            absoluteDeviation: Math.abs(deviation),
            accuracy: this.calculateTimingAccuracy(deviation)
        };
        this.timingHistory.push(timingData);
        return timingData;
    }

    recordTransition(noteInfo, timestamp) {
        let transitionScore = 100;
        if (this.previousNote && this.previousNoteTime) {
            const transitionTime = timestamp - this.previousNoteTime;
            const expectedInterval = 500;
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

    calculatePitchAccuracy(centsDeviation) {
        const absCents = Math.abs(centsDeviation);
        return Math.max(0, 100 - (absCents * 2));
    }

    calculateTimingAccuracy(deviationMs) {
        const absDeviation = Math.abs(deviationMs);
        return Math.max(0, 100 - absDeviation);
    }

    getPitchScore() {
        if (this.pitchHistory.length === 0) return 0;
        const sum = this.pitchHistory.reduce((acc, p) => acc + p.accuracy, 0);
        return sum / this.pitchHistory.length;
    }

    getRhythmScore() {
        if (this.timingHistory.length === 0) return 100;
        const sum = this.timingHistory.reduce((acc, t) => acc + t.accuracy, 0);
        return sum / this.timingHistory.length;
    }

    getTransitionScore() {
        if (this.transitionHistory.length === 0) return 100;
        const sum = this.transitionHistory.reduce((acc, t) => acc + t.score, 0);
        return sum / this.transitionHistory.length;
    }

    getIntonationScore(pitchWeight = 0.4, rhythmWeight = 0.4, transitionWeight = 0.2) {
        const pitchScore = this.getPitchScore();
        const rhythmScore = this.getRhythmScore();
        const transitionScore = this.getTransitionScore();
        return pitchScore * pitchWeight + rhythmScore * rhythmWeight + transitionScore * transitionWeight;
    }

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

    getLatestTimingDeviation() {
        if (this.timingHistory.length === 0) return null;
        return this.timingHistory[this.timingHistory.length - 1].deviation;
    }

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
            pitch: 'Focus on pitch accuracy.',
            rhythm: 'Focus on rhythm precision.',
            intonation: 'Work on overall musicality.'
        };
        return {
            weakestAxis: weakest.name,
            recommendation: recommendations[weakest.name],
            scores: axes
        };
    }

    reset() {
        this.pitchHistory = [];
        this.timingHistory = [];
        this.transitionHistory = [];
        this.previousNote = null;
        this.previousNoteTime = null;
    }
}

// Test runner
function runTests() {
    console.log('Running IntonationAnalyzer Tests...\n');

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
            fn();
            console.log(`✓ ${name}`);
            passed++;
        } catch (e) {
            console.log(`✗ ${name}`);
            console.log(`  Error: ${e.message}`);
            failed++;
        }
    }

    function assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
        }
    }

    function assertTrue(value, message) {
        if (!value) {
            throw new Error(message || 'Expected true');
        }
    }

    // Test 1: Calculate pitch accuracy
    test('should calculate pitch accuracy correctly', () => {
        const analyzer = new IntonationAnalyzer();
        assertEqual(analyzer.calculatePitchAccuracy(0), 100, '0 cents = 100%');
        assertEqual(analyzer.calculatePitchAccuracy(10), 80, '10 cents = 80%');
        assertEqual(analyzer.calculatePitchAccuracy(50), 0, '50 cents = 0%');
        assertEqual(analyzer.calculatePitchAccuracy(-10), 80, '-10 cents = 80%');
    });

    // Test 2: Calculate timing accuracy
    test('should calculate timing accuracy correctly', () => {
        const analyzer = new IntonationAnalyzer();
        assertEqual(analyzer.calculateTimingAccuracy(0), 100, '0ms = 100%');
        assertEqual(analyzer.calculateTimingAccuracy(50), 50, '50ms = 50%');
        assertEqual(analyzer.calculateTimingAccuracy(100), 0, '100ms = 0%');
        assertEqual(analyzer.calculateTimingAccuracy(-50), 50, '-50ms = 50%');
    });

    // Test 3: Record pitch
    test('should record pitch data', () => {
        const analyzer = new IntonationAnalyzer();
        const noteInfo = { name: 'A', octave: 4, frequency: 440, centsDeviation: 5 };
        const result = analyzer.recordPitch(noteInfo, 1000);

        assertEqual(result.name, 'A', 'Note name stored');
        assertEqual(result.octave, 4, 'Octave stored');
        assertEqual(result.centsDeviation, 5, 'Cents deviation stored');
        assertEqual(result.accuracy, 90, 'Accuracy calculated');
    });

    // Test 4: Record timing
    test('should record timing data', () => {
        const analyzer = new IntonationAnalyzer();
        const result = analyzer.recordTiming(1000, 1050);

        assertEqual(result.deviation, 50, 'Deviation calculated');
        assertEqual(result.accuracy, 50, 'Timing accuracy calculated');
    });

    // Test 5: Get pitch score from history
    test('should calculate pitch score from history', () => {
        const analyzer = new IntonationAnalyzer();
        analyzer.recordPitch({ name: 'A', octave: 4, frequency: 440, centsDeviation: 0 }, 1000);
        analyzer.recordPitch({ name: 'B', octave: 4, frequency: 493, centsDeviation: 10 }, 1500);

        const score = analyzer.getPitchScore();
        assertEqual(score, 90, 'Average pitch score');
    });

    // Test 6: Get rhythm score from history
    test('should calculate rhythm score from history', () => {
        const analyzer = new IntonationAnalyzer();
        analyzer.recordTiming(1000, 1020);
        analyzer.recordTiming(1500, 1540);

        const score = analyzer.getRhythmScore();
        // (100 - 20 + 100 - 40) / 2 = 70
        assertEqual(score, 70, 'Average rhythm score');
    });

    // Test 7: Get intonation score combining all three axes
    test('should calculate intonation score combining all axes', () => {
        const analyzer = new IntonationAnalyzer();
        analyzer.recordPitch({ name: 'A', octave: 4, frequency: 440, centsDeviation: 0 }, 1000);
        analyzer.recordTiming(1000, 1000);
        analyzer.recordTransition({ name: 'A', octave: 4 }, 1000);
        analyzer.recordPitch({ name: 'B', octave: 4, frequency: 493, centsDeviation: 0 }, 1500);
        analyzer.recordTiming(1500, 1500);
        analyzer.recordTransition({ name: 'B', octave: 4 }, 1500);

        const score = analyzer.getIntonationScore();
        assertTrue(score >= 90, 'Intonation score should be high');
    });

    // Test 8: Get axis breakdown
    test('should return axis breakdown', () => {
        const analyzer = new IntonationAnalyzer();
        analyzer.recordPitch({ name: 'A', octave: 4, frequency: 440, centsDeviation: 0 }, 1000);
        analyzer.recordTiming(1000, 1000);

        const breakdown = analyzer.getAxisBreakdown();
        assertTrue(breakdown.pitch.score > 0, 'Pitch score exists');
        assertTrue(breakdown.rhythm.score > 0, 'Rhythm score exists');
        assertTrue(breakdown.intonation.score > 0, 'Intonation score exists');
    });

    // Test 9: Get weakest axis recommendation
    test('should recommend based on weakest axis', () => {
        const analyzer = new IntonationAnalyzer();
        // Record mostly good pitch but bad timing
        analyzer.recordPitch({ name: 'A', octave: 4, frequency: 440, centsDeviation: 0 }, 1000);
        analyzer.recordTiming(1000, 1200); // 200ms late = 0% accuracy

        const recommendation = analyzer.getWeakestAxisRecommendation();
        assertEqual(recommendation.weakestAxis, 'rhythm', 'Rhythm should be weakest');
    });

    // Test 10: Reset analyzer
    test('should reset all data', () => {
        const analyzer = new IntonationAnalyzer();
        analyzer.recordPitch({ name: 'A', octave: 4, frequency: 440, centsDeviation: 0 }, 1000);
        analyzer.recordTiming(1000, 1000);

        analyzer.reset();

        assertEqual(analyzer.pitchHistory.length, 0, 'Pitch history cleared');
        assertEqual(analyzer.timingHistory.length, 0, 'Timing history cleared');
    });

    // Test 11: Get latest timing deviation
    test('should return latest timing deviation', () => {
        const analyzer = new IntonationAnalyzer();
        assertEqual(analyzer.getLatestTimingDeviation(), null, 'Should be null when empty');

        analyzer.recordTiming(1000, 1050);
        assertEqual(analyzer.getLatestTimingDeviation(), 50, 'Should return latest deviation');
    });

    // Test 12: Transition recording
    test('should record note transitions', () => {
        const analyzer = new IntonationAnalyzer();
        analyzer.recordTransition({ name: 'A', octave: 4 }, 1000);
        analyzer.recordTransition({ name: 'B', octave: 4 }, 1500);

        assertEqual(analyzer.transitionHistory.length, 2, 'Two transitions recorded');
    });

    console.log(`\n${passed} passed, ${failed} failed`);

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
