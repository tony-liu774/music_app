/**
 * Tests for IntonationAnalyzer
 * Run with: node tests/intonation-analyzer.test.js
 */

const { IntonationAnalyzer } = require('../src/js/analysis/intonation-analyzer');

// Test runner
function runTests() {
    console.log('Running IntonationAnalyzer Tests...\n');
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

    // --- Pitch scoring ---

    test('calculatePitchScore: 0 cents = 100', () => {
        const a = new IntonationAnalyzer();
        assertEqual(a.calculatePitchScore({ centsDeviation: 0 }), 100, '0 cents');
    });

    test('calculatePitchScore: 10 cents = 80', () => {
        const a = new IntonationAnalyzer();
        assertEqual(a.calculatePitchScore({ centsDeviation: 10 }), 80, '10 cents');
    });

    test('calculatePitchScore: negative cents uses absolute value', () => {
        const a = new IntonationAnalyzer();
        assertEqual(a.calculatePitchScore({ centsDeviation: -25 }), 50, '-25 cents');
    });

    test('calculatePitchScore: undefined centsDeviation = 75 default', () => {
        const a = new IntonationAnalyzer();
        assertEqual(a.calculatePitchScore({}), 75, 'No cents');
    });

    test('calculatePitchScore: 50+ cents clamped to 0', () => {
        const a = new IntonationAnalyzer();
        assertEqual(a.calculatePitchScore({ centsDeviation: 60 }), 0, '60 cents');
    });

    // --- recordNote + averages ---

    test('recordNote stores pitch score and bounds noteHistory', () => {
        const a = new IntonationAnalyzer();
        for (let i = 0; i < 15; i++) {
            a.recordNote({ centsDeviation: 0, frequency: 440 });
        }
        assertTrue(a.noteHistory.length <= a.maxHistorySize, 'History bounded');
        assertEqual(a.pitchScores.length, 15, 'All pitch scores recorded');
    });

    test('getAveragePitchScore computes average', () => {
        const a = new IntonationAnalyzer();
        a.recordNote({ centsDeviation: 0, frequency: 440 });   // 100
        a.recordNote({ centsDeviation: 10, frequency: 440 });  // 80
        assertEqual(a.getAveragePitchScore(), 90, 'Avg pitch');
    });

    // --- Rhythm scoring ---

    test('recordRhythmScore and getAverageRhythmScore', () => {
        const a = new IntonationAnalyzer();
        a.recordRhythmScore(80);
        a.recordRhythmScore(60);
        assertEqual(a.getAverageRhythmScore(), 70, 'Avg rhythm');
    });

    test('getAverageRhythmScore default is 75', () => {
        const a = new IntonationAnalyzer();
        assertEqual(a.getAverageRhythmScore(), 75, 'Default');
    });

    // --- Dynamics scoring (5-axis) ---

    test('recordDynamicsScore and getAverageDynamicsScore', () => {
        const a = new IntonationAnalyzer();
        a.recordDynamicsScore(90);
        a.recordDynamicsScore(70);
        assertEqual(a.getAverageDynamicsScore(), 80, 'Avg dynamics');
    });

    test('getAverageDynamicsScore default is 75', () => {
        const a = new IntonationAnalyzer();
        assertEqual(a.getAverageDynamicsScore(), 75, 'Default');
    });

    // --- Articulation scoring (5-axis) ---

    test('recordArticulationScore and getAverageArticulationScore', () => {
        const a = new IntonationAnalyzer();
        a.recordArticulationScore(100);
        a.recordArticulationScore(60);
        assertEqual(a.getAverageArticulationScore(), 80, 'Avg articulation');
    });

    // --- calculateIntonationScore (3-axis vs 5-axis) ---

    test('3-axis weighting when no dynamics data', () => {
        const a = new IntonationAnalyzer();
        a.pitchScores.push(100);
        a.rhythmScores.push(100);
        a.transitionScores.push(100);
        const score = a.calculateIntonationScore();
        assertEqual(score.overall, 100, 'All 100 = 100');
        assertTrue(score.dynamics === undefined, 'No dynamics in 3-axis');
        assertTrue(score.articulation === undefined, 'No articulation in 3-axis');
    });

    test('5-axis weighting when dynamics data present', () => {
        const a = new IntonationAnalyzer();
        a.pitchScores.push(100);
        a.rhythmScores.push(100);
        a.transitionScores.push(100);
        a.dynamicsScores.push(100);
        a.articulationScores.push(100);
        const score = a.calculateIntonationScore();
        assertEqual(score.overall, 100, 'All 100 = 100');
        assertTrue(score.dynamics !== undefined, 'Has dynamics');
        assertTrue(score.articulation !== undefined, 'Has articulation');
    });

    test('5-axis weighting: dynamics pulls down overall', () => {
        const a = new IntonationAnalyzer();
        a.pitchScores.push(100);
        a.rhythmScores.push(100);
        a.transitionScores.push(100);
        a.dynamicsScores.push(0);  // Bad dynamics
        a.articulationScores.push(100);
        const score = a.calculateIntonationScore();
        // 100*.3 + 100*.3 + 100*.15 + 0*.15 + 100*.10 = 30+30+15+0+10 = 85
        assertEqual(score.overall, 85, 'Dynamics pulls score down');
    });

    // --- getWeakestAxis ---

    test('getWeakestAxis includes dynamics/articulation when available', () => {
        const a = new IntonationAnalyzer();
        a.pitchScores.push(90);
        a.rhythmScores.push(90);
        a.transitionScores.push(90);
        a.dynamicsScores.push(20);  // Weakest
        a.articulationScores.push(90);
        const weakest = a.getWeakestAxis();
        assertEqual(weakest.name, 'dynamics', 'Dynamics should be weakest');
    });

    test('getWeakestAxis without dynamics data', () => {
        const a = new IntonationAnalyzer();
        a.pitchScores.push(50);  // Weakest
        a.rhythmScores.push(90);
        const weakest = a.getWeakestAxis();
        assertEqual(weakest.name, 'pitch', 'Pitch should be weakest');
    });

    // --- Score utilities ---

    test('getScoreColor: green for >=80, amber for >=60, red for <60', () => {
        assertEqual(IntonationAnalyzer.getScoreColor(85), '#10b981', 'Green');
        assertEqual(IntonationAnalyzer.getScoreColor(70), '#f59e0b', 'Amber');
        assertEqual(IntonationAnalyzer.getScoreColor(30), '#ef4444', 'Red');
    });

    test('getScoreStatus returns correct status', () => {
        assertEqual(IntonationAnalyzer.getScoreStatus(90), 'excellent', '90');
        assertEqual(IntonationAnalyzer.getScoreStatus(70), 'good', '70');
        assertEqual(IntonationAnalyzer.getScoreStatus(50), 'fair', '50');
        assertEqual(IntonationAnalyzer.getScoreStatus(20), 'needs-work', '20');
    });

    // --- Array bounding ---

    test('score arrays bounded to maxScoreHistory', () => {
        const a = new IntonationAnalyzer();
        a.maxScoreHistory = 5;
        for (let i = 0; i < 10; i++) {
            a.recordRhythmScore(i * 10);
            a.recordDynamicsScore(i * 10);
            a.recordArticulationScore(i * 10);
        }
        assertTrue(a.rhythmScores.length <= 5, 'Rhythm bounded');
        assertTrue(a.dynamicsScores.length <= 5, 'Dynamics bounded');
        assertTrue(a.articulationScores.length <= 5, 'Articulation bounded');
    });

    // --- Reset ---

    test('reset clears all state', () => {
        const a = new IntonationAnalyzer();
        a.recordNote({ centsDeviation: 5, frequency: 440 });
        a.recordRhythmScore(80);
        a.recordDynamicsScore(70);
        a.recordArticulationScore(60);
        a.reset();
        assertEqual(a.pitchScores.length, 0, 'Pitch cleared');
        assertEqual(a.rhythmScores.length, 0, 'Rhythm cleared');
        assertEqual(a.transitionScores.length, 0, 'Transitions cleared');
        assertEqual(a.dynamicsScores.length, 0, 'Dynamics cleared');
        assertEqual(a.articulationScores.length, 0, 'Articulation cleared');
        assertEqual(a.noteHistory.length, 0, 'History cleared');
    });

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

runTests();
