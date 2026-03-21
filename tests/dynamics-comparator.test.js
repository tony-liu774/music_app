/**
 * Tests for DynamicsComparator
 * Run with: node tests/dynamics-comparator.test.js
 */

const { VolumeEnvelopeAnalyzer } = require('../src/js/audio/volume-envelope-analyzer');
const { ArticulationDetector } = require('../src/js/audio/articulation-detector');

// DynamicsComparator references VolumeEnvelopeAnalyzer/ArticulationDetector as free variables
// (loaded via <script> order in browser). Provide them as globals for Node.js require().
global.VolumeEnvelopeAnalyzer = VolumeEnvelopeAnalyzer;
global.ArticulationDetector = ArticulationDetector;

const { DynamicsComparator } = require('../src/js/analysis/dynamics-comparator');

// Test runner
function runTests() {
    console.log('Running DynamicsComparator Tests...\n');
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

    // Test 1: Load score with dynamics
    test('should load dynamics from score', () => {
        const comp = new DynamicsComparator();
        const score = {
            parts: [{
                measures: [{
                    number: 1,
                    dynamics: [{ type: 'f', beat: 0, category: 'dynamic' }],
                    notes: [{ position: { beat: 0 }, articulation: null, dynamicDirection: null }]
                }]
            }]
        };
        comp.loadScore(score);
        assertEqual(comp.scoreDynamics.length, 1, 'Should load 1 dynamic');
        assertEqual(comp.scoreDynamics[0].type, 'f', 'Dynamic type should be f');
    });

    // Test 2: Load score with articulations
    test('should load articulations from score', () => {
        const comp = new DynamicsComparator();
        const score = {
            parts: [{
                measures: [{
                    number: 1,
                    dynamics: [],
                    notes: [{
                        position: { beat: 0 },
                        articulation: 'staccato',
                        dynamicDirection: null,
                        getName: () => 'C'
                    }]
                }]
            }]
        };
        comp.loadScore(score);
        assertEqual(comp.scoreArticulations.length, 1, 'Should load 1 articulation');
        assertEqual(comp.scoreArticulations[0].type, 'staccato', 'Articulation type should be staccato');
    });

    // Test 3: Get expected dynamic (returns object)
    test('should return expected dynamic at position', () => {
        const comp = new DynamicsComparator();
        comp.scoreDynamics = [
            { measure: 1, beat: 0, type: 'p', category: 'dynamic' },
            { measure: 3, beat: 0, type: 'f', category: 'dynamic' }
        ];
        assertEqual(comp.getExpectedDynamic(1, 0).dynamic, 'p', 'Measure 1 = p');
        assertEqual(comp.getExpectedDynamic(2, 0).dynamic, 'p', 'Measure 2 = p (carried over)');
        assertEqual(comp.getExpectedDynamic(3, 0).dynamic, 'f', 'Measure 3 = f');
    });

    // Test 4: Get expected dynamic with crescendo
    test('should track crescendo direction', () => {
        const comp = new DynamicsComparator();
        comp.scoreDynamics = [
            { measure: 1, beat: 0, type: 'p', category: 'dynamic' },
            { measure: 2, beat: 0, type: 'crescendo', category: 'wedge' }
        ];
        const result = comp.getExpectedDynamic(2, 1);
        assertEqual(result.direction, 'crescendo', 'Should detect crescendo direction');
        assertEqual(result.dynamic, 'p', 'Dynamic should still be p');
    });

    // Test 5: Calculate dynamic score
    test('should calculate dynamic score based on level difference', () => {
        const comp = new DynamicsComparator();
        assertEqual(comp.calculateDynamicScore(3, 3), 100, 'Same level = 100');
        assertEqual(comp.calculateDynamicScore(3, 4), 80, 'One level off = 80');
        assertEqual(comp.calculateDynamicScore(3, 5), 50, 'Two levels off = 50');
        assertEqual(comp.calculateDynamicScore(0, 5), 20, 'Five levels off = 20');
    });

    // Test 6: Process audio frame with matching dynamic
    test('should score 100 when dynamic level matches', () => {
        const comp = new DynamicsComparator();
        comp.scoreDynamics = [{ measure: 1, beat: 0, type: 'mf', category: 'dynamic' }];
        const result = comp.processAudioFrame(0.20, 1, 0, 1000);
        assertEqual(result.dynamicScore, 100, 'Matching dynamic = 100');
        assertEqual(result.expectedDynamic, 'mf', 'Expected should be mf');
    });

    // Test 7: Process audio frame with mismatched dynamic
    test('should log deviation when dynamic level differs significantly', () => {
        const comp = new DynamicsComparator();
        comp.scoreDynamics = [{ measure: 1, beat: 0, type: 'pp', category: 'dynamic' }];
        // Play loud when pp is expected
        comp.processAudioFrame(0.50, 1, 0, 1000);
        assertTrue(comp.dynamicsDeviations.length > 0, 'Should log a deviation');
    });

    // Test 8: Process note articulation match
    test('should match articulation when note matches expected', () => {
        const comp = new DynamicsComparator();
        comp.scoreArticulations = [{ measure: 1, beat: 0, type: 'staccato' }];
        const result = comp.processNoteArticulation({
            timestamp: 1000, attackTime: 10, peakAmplitude: 0.3, decayRate: 0.02,
            duration: 100, expectedDuration: 500, measure: 1
        }, 1, 0);
        assertEqual(result.expected, 'staccato', 'Expected staccato');
        assertEqual(result.detected, 'staccato', 'Detected staccato');
        assertEqual(result.match, true, 'Should match');
    });

    // Test 9: Process note articulation mismatch
    test('should log deviation when articulation mismatches', () => {
        const comp = new DynamicsComparator();
        comp.scoreArticulations = [{ measure: 1, beat: 0, type: 'staccato' }];
        // Play legato when staccato expected
        comp.processNoteArticulation({
            timestamp: 1000, attackTime: 15, peakAmplitude: 0.3, decayRate: 0.02,
            duration: 480, expectedDuration: 500, measure: 1
        }, 1, 0);
        assertTrue(comp.articulationDeviations.length > 0, 'Should log articulation deviation');
    });

    // Test 10: Get session scores (unbiased — uses running totals)
    test('should calculate session scores from all processed frames', () => {
        const comp = new DynamicsComparator();
        comp.scoreDynamics = [{ measure: 1, beat: 0, type: 'mf', category: 'dynamic' }];
        // Process matching frames
        comp.processAudioFrame(0.20, 1, 0, 1000);
        comp.processAudioFrame(0.20, 1, 1, 1050);
        const scores = comp.getSessionScores();
        assertEqual(scores.dynamics, 100, 'Matching frames should average 100');
    });

    // Test 11: Get problem measures
    test('should identify problem measures', () => {
        const comp = new DynamicsComparator();
        comp.dynamicsDeviations = [
            { measure: 3, score: 30 },
            { measure: 3, score: 40 },
            { measure: 5, score: 80 }
        ];
        const problems = comp.getProblemMeasures();
        assertTrue(problems.length > 0, 'Should have problem measures');
        assertEqual(problems[0].measure, 3, 'Measure 3 should be worst');
    });

    // Test 12: Export deviations
    test('should export deviations with scores and problem measures', () => {
        const comp = new DynamicsComparator();
        comp.dynamicsDeviations = [{ measure: 1, score: 50 }];
        comp.articulationDeviations = [{ measure: 2, score: 60 }];
        const exported = comp.exportDeviations();
        assertTrue(exported.dynamics.length > 0, 'Has dynamics deviations');
        assertTrue(exported.articulation.length > 0, 'Has articulation deviations');
        assertTrue(exported.scores !== undefined, 'Has scores');
        assertTrue(exported.problemMeasures !== undefined, 'Has problem measures');
    });

    // Test 13: Reset
    test('should reset all state', () => {
        const comp = new DynamicsComparator();
        comp.dynamicsDeviations.push({ measure: 1, score: 50 });
        comp.articulationDeviations.push({ measure: 1, score: 50 });
        comp.totalDynamicsFrames = 10;
        comp.totalDynamicsScore = 800;
        comp.reset();
        assertEqual(comp.dynamicsDeviations.length, 0, 'Dynamics deviations cleared');
        assertEqual(comp.articulationDeviations.length, 0, 'Articulation deviations cleared');
        assertEqual(comp.currentMeasure, 1, 'Measure reset');
        assertEqual(comp.totalDynamicsFrames, 0, 'Dynamics frames reset');
        assertEqual(comp.totalArticulationEvents, 0, 'Articulation events reset');
    });

    // Test 14: Direction compliance scoring
    test('should penalize wrong direction during crescendo', () => {
        const comp = new DynamicsComparator();
        comp.scoreDynamics = [
            { measure: 1, beat: 0, type: 'p', category: 'dynamic' },
            { measure: 1, beat: 0, type: 'crescendo', category: 'wedge' }
        ];
        // Feed constant volume (not crescendo)
        for (let i = 0; i < 10; i++) {
            comp.processAudioFrame(0.06, 1, 0, 1000 + i * 50);
        }
        assertTrue(comp.dynamicsDeviations.length > 0, 'Should log deviation for missing crescendo');
    });

    // Test 15: No expected articulation
    test('should give default score when no articulation expected', () => {
        const comp = new DynamicsComparator();
        const result = comp.processNoteArticulation({
            timestamp: 1000, attackTime: 10, peakAmplitude: 0.3, decayRate: 0.02,
            duration: 200, expectedDuration: 500, measure: 1
        }, 1, 0);
        assertEqual(result.expected, null, 'No expected articulation');
        assertEqual(result.score, 80, 'Default score');
    });

    // Test 16: Load score with dynamic directions on notes
    test('should load dynamic directions from notes', () => {
        const comp = new DynamicsComparator();
        const score = {
            parts: [{
                measures: [{
                    number: 1,
                    dynamics: [],
                    notes: [{
                        position: { beat: 0 },
                        articulation: null,
                        dynamicDirection: 'crescendo'
                    }]
                }]
            }]
        };
        comp.loadScore(score);
        assertTrue(comp.scoreDynamics.some(d => d.type === 'crescendo'), 'Should have crescendo from note');
    });

    // Test 17: Wedge stop resets direction
    test('should reset direction on wedge stop', () => {
        const comp = new DynamicsComparator();
        comp.scoreDynamics = [
            { measure: 1, beat: 0, type: 'crescendo', category: 'wedge' },
            { measure: 2, beat: 0, type: 'wedge-stop', category: 'wedge' }
        ];
        const result = comp.getExpectedDynamic(2, 1);
        assertEqual(result.direction, null, 'Direction should be null after wedge-stop');
    });

    // Test 18: Default session scores with no data
    test('should return default 75 when no frames processed', () => {
        const comp = new DynamicsComparator();
        const scores = comp.getSessionScores();
        assertEqual(scores.dynamics, 75, 'Default dynamics = 75');
        assertEqual(scores.articulation, 75, 'Default articulation = 75');
    });

    // Test 19: getExpectedDynamic is pure (no side effects)
    test('getExpectedDynamic should not mutate instance state', () => {
        const comp = new DynamicsComparator();
        comp.scoreDynamics = [
            { measure: 1, beat: 0, type: 'f', category: 'dynamic' },
            { measure: 2, beat: 0, type: 'crescendo', category: 'wedge' }
        ];
        const before = JSON.stringify({ m: comp.currentMeasure, b: comp.currentBeat });
        comp.getExpectedDynamic(2, 1);
        const after = JSON.stringify({ m: comp.currentMeasure, b: comp.currentBeat });
        assertEqual(before, after, 'State should not change from getExpectedDynamic');
    });

    // Test 20: loadScore sorts by measure then beat
    test('should sort scoreDynamics by (measure, beat) after loading', () => {
        const comp = new DynamicsComparator();
        const score = {
            parts: [{
                measures: [
                    { number: 3, dynamics: [{ type: 'ff', beat: 0, category: 'dynamic' }], notes: [] },
                    { number: 1, dynamics: [{ type: 'p', beat: 2, category: 'dynamic' }], notes: [] },
                    { number: 1, dynamics: [{ type: 'pp', beat: 0, category: 'dynamic' }], notes: [] }
                ]
            }]
        };
        comp.loadScore(score);
        assertEqual(comp.scoreDynamics[0].type, 'pp', 'First should be pp (m1 b0)');
        assertEqual(comp.scoreDynamics[1].type, 'p', 'Second should be p (m1 b2)');
        assertEqual(comp.scoreDynamics[2].type, 'ff', 'Third should be ff (m3 b0)');
    });

    // Test 21: Session scores track articulation from all events
    test('should include matching articulation events in session scores', () => {
        const comp = new DynamicsComparator();
        // No expected articulation, so default score 80
        comp.processNoteArticulation({
            timestamp: 1000, attackTime: 10, peakAmplitude: 0.3, decayRate: 0.02,
            duration: 200, expectedDuration: 500, measure: 1
        }, 1, 0);
        const scores = comp.getSessionScores();
        assertEqual(scores.articulation, 80, 'Should reflect default 80 score');
        assertEqual(comp.totalArticulationEvents, 1, 'Should have 1 event');
    });

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

runTests();
