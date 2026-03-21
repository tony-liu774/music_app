/**
 * Tests for ArticulationDetector
 * Run with: node tests/articulation-detector.test.js
 */

// Inline the class for testing (browser module)
class ArticulationDetector {
    constructor() {
        this.noteEvents = [];
        this.maxEvents = 50;
        this.config = {
            staccatoMaxDuration: 0.4,
            legatoMinDuration: 0.85,
            accentAttackTime: 5,
            pizzicatoAttackTime: 3,
            pizzicatoDecayRate: 0.08,
            legatoMaxGap: 30,
            staccatoMinGap: 100,
            accentPeakRatio: 1.4,
            sampleRate: 44100
        };
        this.avgPeakAmplitude = 0;
        this.avgAttackTime = 0;
        this.noteCount = 0;
    }

    recordNote(noteEvent) {
        const event = { ...noteEvent, timestamp: noteEvent.timestamp || Date.now(), articulation: null };
        this.noteCount++;
        this.avgPeakAmplitude = this.avgPeakAmplitude + (event.peakAmplitude - this.avgPeakAmplitude) / this.noteCount;
        this.avgAttackTime = this.avgAttackTime + ((event.attackTime || 15) - this.avgAttackTime) / this.noteCount;
        event.articulation = this.classifyArticulation(event);
        this.noteEvents.push(event);
        if (this.noteEvents.length > this.maxEvents) this.noteEvents.shift();
        return event.articulation;
    }

    classifyArticulation(noteEvent) {
        const scores = { legato: 0, staccato: 0, accent: 0, tenuto: 0, pizzicato: 0 };
        const { attackTime, peakAmplitude, decayRate, duration, expectedDuration } = noteEvent;
        const durationRatio = (expectedDuration && expectedDuration > 0) ? duration / expectedDuration : 1;

        if (attackTime !== undefined && attackTime < this.config.pizzicatoAttackTime && decayRate > this.config.pizzicatoDecayRate) scores.pizzicato += 60;
        if (decayRate > this.config.pizzicatoDecayRate * 1.5) scores.pizzicato += 30;

        if (durationRatio < this.config.staccatoMaxDuration) scores.staccato += 50;
        else if (durationRatio < 0.6) scores.staccato += 30;

        const gap = this.getGapToPreviousNote(noteEvent);
        if (gap !== null && gap > this.config.staccatoMinGap) scores.staccato += 20;

        if (durationRatio >= this.config.legatoMinDuration) scores.legato += 40;
        if (gap !== null && gap < this.config.legatoMaxGap) scores.legato += 35;
        else if (gap === null && durationRatio >= 0.8) scores.legato += 20;

        if (this.avgPeakAmplitude > 0 && peakAmplitude > this.avgPeakAmplitude * this.config.accentPeakRatio) scores.accent += 50;
        if (attackTime !== undefined && attackTime < this.config.accentAttackTime) scores.accent += 25;

        if (durationRatio >= 0.95 && durationRatio <= 1.1) scores.tenuto += 40;
        if (attackTime !== undefined && attackTime > 10 && attackTime < 30) scores.tenuto += 15;

        const entries = Object.entries(scores);
        entries.sort((a, b) => b[1] - a[1]);
        const best = entries[0];
        const totalScore = entries.reduce((sum, [, s]) => sum + s, 0);
        const confidence = totalScore > 0 ? best[1] / totalScore : 0;
        return { type: best[0], confidence: Math.round(confidence * 100) / 100, scores, durationRatio: Math.round(durationRatio * 100) / 100 };
    }

    getGapToPreviousNote(currentEvent) {
        if (this.noteEvents.length === 0) return null;
        const prev = this.noteEvents[this.noteEvents.length - 1];
        const prevEnd = prev.timestamp + (prev.duration || 0);
        return currentEvent.timestamp - prevEnd;
    }

    getDominantArticulation(count = 10) {
        const recent = this.noteEvents.slice(-count);
        if (recent.length === 0) return { type: 'legato', percentage: 0 };
        const counts = {};
        for (const event of recent) {
            if (event.articulation) { const type = event.articulation.type; counts[type] = (counts[type] || 0) + 1; }
        }
        const entries = Object.entries(counts);
        if (entries.length === 0) return { type: 'legato', percentage: 0 };
        entries.sort((a, b) => b[1] - a[1]);
        return { type: entries[0][0], percentage: Math.round(entries[0][1] / recent.length * 100) };
    }

    compareArticulation(detected, expected) {
        if (!detected || !expected) return { match: true, score: 75, feedback: '' };
        if (detected === expected) return { match: true, score: 100, feedback: '' };
        const similarity = {
            'legato-tenuto': 70, 'tenuto-legato': 70, 'staccato-accent': 50, 'accent-staccato': 50,
            'legato-staccato': 20, 'staccato-legato': 20, 'pizzicato-staccato': 30, 'staccato-pizzicato': 30
        };
        const key = `${detected}-${expected}`;
        const score = similarity[key] || 40;
        const feedback = this.getArticulationFeedback(detected, expected);
        return { match: false, score, feedback };
    }

    getArticulationFeedback(detected, expected) {
        const feedbackMap = {
            'legato-staccato': 'Shorten your bow strokes — lift between notes for staccato',
            'staccato-legato': 'Connect your bow strokes more smoothly — sustain through the note',
            'legato-accent': 'Add more bow weight at the start of the note',
            'accent-legato': 'Ease up on the initial bow pressure for a smoother attack',
            'legato-pizzicato': 'This passage should be plucked (pizzicato)',
            'pizzicato-legato': 'Return to bowing (arco) for this passage',
            'staccato-accent': 'Add more weight to the beginning of each note',
            'accent-staccato': 'Lighter, shorter strokes needed — less initial pressure',
            'tenuto-staccato': 'Shorten the notes — the score calls for separated strokes',
            'staccato-tenuto': 'Hold each note to its full value'
        };
        return feedbackMap[`${detected}-${expected}`] || `Expected ${expected}, detected ${detected}`;
    }

    getSummary() {
        const recent = this.noteEvents.slice(-20);
        const counts = { legato: 0, staccato: 0, accent: 0, tenuto: 0, pizzicato: 0 };
        for (const event of recent) {
            if (event.articulation && counts[event.articulation.type] !== undefined) counts[event.articulation.type]++;
        }
        return {
            totalNotes: recent.length, counts, dominant: this.getDominantArticulation(20),
            avgAttackTime: Math.round(this.avgAttackTime * 10) / 10,
            avgPeakAmplitude: Math.round(this.avgPeakAmplitude * 1000) / 1000
        };
    }

    reset() {
        this.noteEvents = [];
        this.avgPeakAmplitude = 0;
        this.avgAttackTime = 0;
        this.noteCount = 0;
    }
}

// Test runner
function runTests() {
    console.log('Running ArticulationDetector Tests...\n');
    let passed = 0, failed = 0;

    function test(name, fn) {
        try { fn(); console.log(`✓ ${name}`); passed++; }
        catch (e) { console.log(`✗ ${name}\n  Error: ${e.message}`); failed++; }
    }

    function assertEqual(actual, expected, msg) {
        if (actual !== expected) throw new Error(`${msg}: expected ${expected}, got ${actual}`);
    }

    function assertTrue(value, msg) {
        if (!value) throw new Error(msg || 'Expected true');
    }

    // Test 1: Detect staccato from short duration ratio
    test('should detect staccato from short note duration', () => {
        const detector = new ArticulationDetector();
        const result = detector.recordNote({
            timestamp: 1000, attackTime: 10, peakAmplitude: 0.3, decayRate: 0.02,
            duration: 100, expectedDuration: 500, measure: 1
        });
        assertEqual(result.type, 'staccato', 'Short duration = staccato');
        assertTrue(result.confidence > 0, 'Should have confidence');
    });

    // Test 2: Detect legato from long duration + small gap
    test('should detect legato from long note duration with small gap', () => {
        const detector = new ArticulationDetector();
        // First note
        detector.recordNote({
            timestamp: 1000, attackTime: 15, peakAmplitude: 0.3, decayRate: 0.02,
            duration: 450, expectedDuration: 500, measure: 1
        });
        // Second note with small gap
        const result = detector.recordNote({
            timestamp: 1460, attackTime: 15, peakAmplitude: 0.3, decayRate: 0.02,
            duration: 450, expectedDuration: 500, measure: 1
        });
        assertEqual(result.type, 'legato', 'Long duration + small gap = legato');
    });

    // Test 3: Detect pizzicato from fast attack + fast decay
    test('should detect pizzicato from very fast attack and high decay rate', () => {
        const detector = new ArticulationDetector();
        const result = detector.recordNote({
            timestamp: 1000, attackTime: 2, peakAmplitude: 0.5, decayRate: 0.15,
            duration: 200, expectedDuration: 500, measure: 1
        });
        assertEqual(result.type, 'pizzicato', 'Fast attack + high decay = pizzicato');
    });

    // Test 4: Detect accent from loud peak
    test('should detect accent from significantly louder peak', () => {
        const detector = new ArticulationDetector();
        // Build up average with quiet notes
        for (let i = 0; i < 5; i++) {
            detector.recordNote({
                timestamp: 1000 + i * 600, attackTime: 3, peakAmplitude: 0.15, decayRate: 0.02,
                duration: 480, expectedDuration: 500, measure: 1
            });
        }
        // Now play a much louder note
        const result = detector.recordNote({
            timestamp: 4000, attackTime: 3, peakAmplitude: 0.50, decayRate: 0.02,
            duration: 480, expectedDuration: 500, measure: 1
        });
        assertEqual(result.type, 'accent', 'Much louder peak = accent');
    });

    // Test 5: Detect tenuto from full-duration note with moderate gap from previous
    test('should detect tenuto from note held to full value with moderate gap', () => {
        const detector = new ArticulationDetector();
        // First note to establish context
        detector.recordNote({
            timestamp: 1000, attackTime: 15, peakAmplitude: 0.3, decayRate: 0.02,
            duration: 500, expectedDuration: 500, measure: 1
        });
        // Second note: gap = 1560 - (1000+500) = 60ms (>30ms breaks legato gap, <100ms avoids staccato)
        // durationRatio = 1.0, attackTime = 15 (10-30 range), so tenuto scores 40+15=55
        // legato: durationRatio>=0.85 gives 40, gap>30ms gives 0 from gap check = 40
        // tenuto wins with 55 > 40
        const result = detector.recordNote({
            timestamp: 1560, attackTime: 15, peakAmplitude: 0.3, decayRate: 0.02,
            duration: 500, expectedDuration: 500, measure: 1
        });
        assertEqual(result.type, 'tenuto', 'Full duration with moderate gap = tenuto');
    });

    // Test 6: Compare matching articulations
    test('should score 100 for matching articulations', () => {
        const detector = new ArticulationDetector();
        const result = detector.compareArticulation('staccato', 'staccato');
        assertEqual(result.match, true, 'Should match');
        assertEqual(result.score, 100, 'Perfect score for match');
    });

    // Test 7: Compare mismatched articulations
    test('should give low score for legato vs staccato mismatch', () => {
        const detector = new ArticulationDetector();
        const result = detector.compareArticulation('legato', 'staccato');
        assertEqual(result.match, false, 'Should not match');
        assertEqual(result.score, 20, 'Low score for big mismatch');
        assertTrue(result.feedback.length > 0, 'Should provide feedback');
    });

    // Test 8: Compare similar articulations
    test('should give moderate score for legato vs tenuto', () => {
        const detector = new ArticulationDetector();
        const result = detector.compareArticulation('legato', 'tenuto');
        assertEqual(result.match, false, 'Should not match');
        assertEqual(result.score, 70, 'Moderate score for similar articulations');
    });

    // Test 9: Handle null expected articulation
    test('should handle null expected articulation gracefully', () => {
        const detector = new ArticulationDetector();
        const result = detector.compareArticulation('legato', null);
        assertEqual(result.match, true, 'Null expected = match');
        assertEqual(result.score, 75, 'Default score for null');
    });

    // Test 10: Get dominant articulation
    test('should identify dominant articulation from recent notes', () => {
        const detector = new ArticulationDetector();
        // Record several staccato notes
        for (let i = 0; i < 5; i++) {
            detector.recordNote({
                timestamp: 1000 + i * 300, attackTime: 10, peakAmplitude: 0.3, decayRate: 0.02,
                duration: 100, expectedDuration: 500, measure: 1
            });
        }
        const dominant = detector.getDominantArticulation();
        assertEqual(dominant.type, 'staccato', 'Dominant should be staccato');
        assertTrue(dominant.percentage > 50, 'Should be majority');
    });

    // Test 11: Gap calculation
    test('should calculate gap between notes correctly', () => {
        const detector = new ArticulationDetector();
        detector.recordNote({
            timestamp: 1000, attackTime: 10, peakAmplitude: 0.3, decayRate: 0.02,
            duration: 400, expectedDuration: 500, measure: 1
        });
        // Gap should be 1600 - (1000 + 400) = 200ms
        const gap = detector.getGapToPreviousNote({ timestamp: 1600 });
        assertEqual(gap, 200, 'Gap should be 200ms');
    });

    // Test 12: No previous note gap
    test('should return null gap when no previous note exists', () => {
        const detector = new ArticulationDetector();
        const gap = detector.getGapToPreviousNote({ timestamp: 1000 });
        assertEqual(gap, null, 'No previous note = null gap');
    });

    // Test 13: Summary generation
    test('should generate summary of recent articulations', () => {
        const detector = new ArticulationDetector();
        detector.recordNote({
            timestamp: 1000, attackTime: 10, peakAmplitude: 0.3, decayRate: 0.02,
            duration: 100, expectedDuration: 500, measure: 1
        });
        const summary = detector.getSummary();
        assertEqual(summary.totalNotes, 1, 'One note recorded');
        assertTrue(summary.avgAttackTime > 0, 'Has avg attack time');
        assertTrue(summary.avgPeakAmplitude > 0, 'Has avg peak amplitude');
    });

    // Test 14: Reset
    test('should reset all state', () => {
        const detector = new ArticulationDetector();
        detector.recordNote({
            timestamp: 1000, attackTime: 10, peakAmplitude: 0.3, decayRate: 0.02,
            duration: 100, expectedDuration: 500, measure: 1
        });
        detector.reset();
        assertEqual(detector.noteEvents.length, 0, 'Events cleared');
        assertEqual(detector.noteCount, 0, 'Note count reset');
        assertEqual(detector.avgPeakAmplitude, 0, 'Avg amplitude reset');
    });

    // Test 15: Feedback messages
    test('should provide specific feedback for common mismatches', () => {
        const detector = new ArticulationDetector();
        const feedback1 = detector.getArticulationFeedback('legato', 'staccato');
        assertTrue(feedback1.includes('Shorten'), 'legato→staccato feedback');

        const feedback2 = detector.getArticulationFeedback('staccato', 'legato');
        assertTrue(feedback2.includes('Connect'), 'staccato→legato feedback');

        const feedback3 = detector.getArticulationFeedback('legato', 'pizzicato');
        assertTrue(feedback3.includes('plucked'), 'legato→pizzicato feedback');
    });

    // Test 16: History size limit
    test('should limit note event history', () => {
        const detector = new ArticulationDetector();
        for (let i = 0; i < 60; i++) {
            detector.recordNote({
                timestamp: 1000 + i * 100, attackTime: 10, peakAmplitude: 0.3, decayRate: 0.02,
                duration: 80, expectedDuration: 500, measure: 1
            });
        }
        assertTrue(detector.noteEvents.length <= 50, 'History bounded at 50');
    });

    // Test 17: Duration ratio in classification result
    test('should include duration ratio in classification result', () => {
        const detector = new ArticulationDetector();
        const result = detector.recordNote({
            timestamp: 1000, attackTime: 10, peakAmplitude: 0.3, decayRate: 0.02,
            duration: 250, expectedDuration: 500, measure: 1
        });
        assertEqual(result.durationRatio, 0.5, 'Duration ratio = 0.5');
    });

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

runTests();
