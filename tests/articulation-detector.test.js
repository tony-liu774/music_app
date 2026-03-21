/**
 * Tests for ArticulationDetector
 * Run with: node tests/articulation-detector.test.js
 */

const { ArticulationDetector } = require('../src/js/audio/articulation-detector');

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

    // Test 18: Detect marcato from loud peak + short duration
    test('should detect marcato from loud peak and short duration', () => {
        const detector = new ArticulationDetector();
        // Build up average with moderate notes
        for (let i = 0; i < 5; i++) {
            detector.recordNote({
                timestamp: 1000 + i * 600, attackTime: 15, peakAmplitude: 0.15, decayRate: 0.02,
                duration: 480, expectedDuration: 500, measure: 1
            });
        }
        // Now play a much louder AND short note (marcato = accent + staccato)
        const result = detector.recordNote({
            timestamp: 4000, attackTime: 3, peakAmplitude: 0.50, decayRate: 0.02,
            duration: 200, expectedDuration: 500, measure: 1
        });
        assertEqual(result.type, 'marcato', 'Loud peak + short duration = marcato');
        assertTrue(result.scores.marcato > 0, 'Marcato score should be positive');
    });

    // Test 19: Marcato similarity scoring
    test('should give moderate score for marcato vs accent mismatch', () => {
        const detector = new ArticulationDetector();
        const result = detector.compareArticulation('marcato', 'accent');
        assertEqual(result.score, 70, 'Marcato-accent are similar');
    });

    // Test 20: Marcato feedback
    test('should provide marcato-specific feedback', () => {
        const detector = new ArticulationDetector();
        const feedback = detector.getArticulationFeedback('accent', 'marcato');
        assertTrue(feedback.includes('Shorten'), 'accent→marcato feedback');
        const feedback2 = detector.getArticulationFeedback('marcato', 'accent');
        assertTrue(feedback2.includes('Sustain'), 'marcato→accent feedback');
    });

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

runTests();
