/**
 * Tests for DynamicsComparator
 * Run with: node tests/dynamics-comparator.test.js
 */

// Minimal stubs for dependencies
class VolumeEnvelopeAnalyzer {
    constructor() {
        this.rmsHistory = [];
        this.maxHistorySize = 100;
        this.dynamicThresholds = { pp: 0.02, p: 0.05, mp: 0.10, mf: 0.18, f: 0.30, ff: 0.45 };
        this.windowSize = 8;
        this.crescendoThreshold = 0.015;
        this.decrescendoThreshold = 0.015;
        this.currentDynamic = 'mf';
        this.currentTrend = 'stable';
        this.trendStartTime = null;
        this.trendStartLevel = null;
    }
    addSample(rmsLevel, timestamp) {
        this.rmsHistory.push({ rms: Math.max(0, rmsLevel), timestamp });
        if (this.rmsHistory.length > this.maxHistorySize) this.rmsHistory.shift();
        this.currentDynamic = this.classifyDynamic(rmsLevel);
        const trend = this.detectTrend();
        if (trend !== this.currentTrend) { this.trendStartTime = timestamp; this.trendStartLevel = rmsLevel; this.currentTrend = trend; }
        return this.getState();
    }
    classifyDynamic(rmsLevel) {
        if (rmsLevel >= this.dynamicThresholds.ff) return 'ff';
        if (rmsLevel >= this.dynamicThresholds.f) return 'f';
        if (rmsLevel >= this.dynamicThresholds.mf) return 'mf';
        if (rmsLevel >= this.dynamicThresholds.mp) return 'mp';
        if (rmsLevel >= this.dynamicThresholds.p) return 'p';
        return 'pp';
    }
    detectTrend() {
        if (this.rmsHistory.length < this.windowSize) return 'stable';
        const recent = this.rmsHistory.slice(-this.windowSize);
        const slope = this.calculateSlope(recent.map(s => s.rms));
        if (slope > this.crescendoThreshold) return 'crescendo';
        if (slope < -this.decrescendoThreshold) return 'decrescendo';
        return 'stable';
    }
    calculateSlope(values) {
        const n = values.length;
        if (n < 2) return 0;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) { sumX += i; sumY += values[i]; sumXY += i * values[i]; sumXX += i * i; }
        const d = n * sumXX - sumX * sumX;
        return d === 0 ? 0 : (n * sumXY - sumX * sumY) / d;
    }
    getSmoothedRMS() {
        if (this.rmsHistory.length === 0) return 0;
        const w = Math.min(5, this.rmsHistory.length);
        return this.rmsHistory.slice(-w).reduce((s, x) => s + x.rms, 0) / w;
    }
    static dynamicToLevel(d) { const l = { pp: 0, p: 1, mp: 2, mf: 3, f: 4, ff: 5 }; return l[d] !== undefined ? l[d] : 3; }
    static levelToDynamic(l) { return ['pp', 'p', 'mp', 'mf', 'f', 'ff'][Math.max(0, Math.min(5, Math.round(l)))]; }
    getState() {
        return { currentDynamic: this.currentDynamic, currentTrend: this.currentTrend, smoothedRMS: this.getSmoothedRMS(),
            trendDuration: this.trendStartTime ? Date.now() - this.trendStartTime : 0,
            dynamicLevel: VolumeEnvelopeAnalyzer.dynamicToLevel(this.currentDynamic), historyLength: this.rmsHistory.length };
    }
    reset() { this.rmsHistory = []; this.currentDynamic = 'mf'; this.currentTrend = 'stable'; this.trendStartTime = null; this.trendStartLevel = null; }
}

class ArticulationDetector {
    constructor() { this.noteEvents = []; this.maxEvents = 50; this.avgPeakAmplitude = 0; this.avgAttackTime = 0; this.noteCount = 0;
        this.config = { staccatoMaxDuration: 0.4, legatoMinDuration: 0.85, accentAttackTime: 5, pizzicatoAttackTime: 3, pizzicatoDecayRate: 0.08, legatoMaxGap: 30, staccatoMinGap: 100, accentPeakRatio: 1.4, sampleRate: 44100 };
    }
    recordNote(noteEvent) {
        const event = { ...noteEvent, timestamp: noteEvent.timestamp || Date.now(), articulation: null };
        this.noteCount++;
        this.avgPeakAmplitude += (event.peakAmplitude - this.avgPeakAmplitude) / this.noteCount;
        this.avgAttackTime += ((event.attackTime || 15) - this.avgAttackTime) / this.noteCount;
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
        return { type: best[0], confidence: Math.round((totalScore > 0 ? best[1] / totalScore : 0) * 100) / 100, scores, durationRatio: Math.round(durationRatio * 100) / 100 };
    }
    getGapToPreviousNote(ce) {
        if (this.noteEvents.length === 0) return null;
        const prev = this.noteEvents[this.noteEvents.length - 1];
        return ce.timestamp - (prev.timestamp + (prev.duration || 0));
    }
    compareArticulation(detected, expected) {
        if (!detected || !expected) return { match: true, score: 75, feedback: '' };
        if (detected === expected) return { match: true, score: 100, feedback: '' };
        const similarity = { 'legato-tenuto': 70, 'tenuto-legato': 70, 'staccato-accent': 50, 'accent-staccato': 50, 'legato-staccato': 20, 'staccato-legato': 20, 'pizzicato-staccato': 30, 'staccato-pizzicato': 30 };
        return { match: false, score: similarity[`${detected}-${expected}`] || 40, feedback: `Expected ${expected}, detected ${detected}` };
    }
    reset() { this.noteEvents = []; this.avgPeakAmplitude = 0; this.avgAttackTime = 0; this.noteCount = 0; }
}

// DynamicsComparator - the class under test
class DynamicsComparator {
    constructor() {
        this.volumeAnalyzer = new VolumeEnvelopeAnalyzer();
        this.articulationDetector = new ArticulationDetector();
        this.scoreDynamics = [];
        this.scoreArticulations = [];
        this.dynamicsDeviations = [];
        this.articulationDeviations = [];
        this.maxDeviations = 200;
        this.currentMeasure = 1;
        this.currentBeat = 0;
        this.expectedDynamic = 'mf';
        this.expectedArticulation = null;
        this.currentDynamicDirection = null;
    }

    loadScore(score) {
        this.scoreDynamics = [];
        this.scoreArticulations = [];
        if (!score || !score.parts) return;
        for (const part of score.parts) {
            for (const measure of part.measures) {
                if (measure.dynamics) {
                    for (const dyn of measure.dynamics) {
                        this.scoreDynamics.push({ measure: measure.number, beat: dyn.beat || 0, type: dyn.type, category: dyn.category || 'dynamic' });
                    }
                }
                for (const note of measure.notes) {
                    if (note.articulation) {
                        this.scoreArticulations.push({ measure: measure.number, beat: note.position.beat || 0, type: note.articulation, noteName: note.getName ? note.getName() : '' });
                    }
                    if (note.dynamicDirection) {
                        this.scoreDynamics.push({ measure: measure.number, beat: note.position.beat || 0, type: note.dynamicDirection, category: 'wedge' });
                    }
                }
            }
        }
    }

    getExpectedDynamic(measure, beat) {
        let dynamic = 'mf';
        let direction = null;
        for (const dyn of this.scoreDynamics) {
            if (dyn.measure < measure || (dyn.measure === measure && dyn.beat <= beat)) {
                if (dyn.category === 'dynamic') dynamic = dyn.type;
                else if (dyn.category === 'wedge') { direction = dyn.type === 'wedge-stop' ? null : dyn.type; }
            }
        }
        this.expectedDynamic = dynamic;
        this.currentDynamicDirection = direction;
        return dynamic;
    }

    getExpectedArticulation(measure, beat) {
        for (const art of this.scoreArticulations) {
            if (art.measure === measure && Math.abs(art.beat - beat) < 0.1) { this.expectedArticulation = art.type; return art.type; }
        }
        this.expectedArticulation = null;
        return null;
    }

    processAudioFrame(rmsLevel, measure, beat, timestamp) {
        this.currentMeasure = measure;
        this.currentBeat = beat;
        const envelope = this.volumeAnalyzer.addSample(rmsLevel, timestamp);
        const expected = this.getExpectedDynamic(measure, beat);
        const expectedLevel = VolumeEnvelopeAnalyzer.dynamicToLevel(expected);
        const actualLevel = envelope.dynamicLevel;
        const dynamicDeviation = actualLevel - expectedLevel;
        const dynamicScore = this.calculateDynamicScore(expectedLevel, actualLevel);
        let directionScore = 100, directionMatch = true;
        if (this.currentDynamicDirection === 'crescendo' && envelope.currentTrend !== 'crescendo') {
            directionScore = envelope.currentTrend === 'stable' ? 60 : 30; directionMatch = false;
        } else if (this.currentDynamicDirection === 'decrescendo' && envelope.currentTrend !== 'decrescendo') {
            directionScore = envelope.currentTrend === 'stable' ? 60 : 30; directionMatch = false;
        }
        if (Math.abs(dynamicDeviation) >= 2 || !directionMatch) {
            this.logDynamicDeviation({ measure, beat, expectedDynamic: expected, actualDynamic: envelope.currentDynamic, deviation: dynamicDeviation, score: dynamicScore, expectedDirection: this.currentDynamicDirection, actualTrend: envelope.currentTrend, directionMatch, timestamp });
        }
        return { dynamicScore, directionScore, expectedDynamic: expected, actualDynamic: envelope.currentDynamic, dynamicDeviation, trend: envelope.currentTrend, expectedDirection: this.currentDynamicDirection, directionMatch, combinedScore: Math.round((dynamicScore * 0.6 + directionScore * 0.4)) };
    }

    processNoteArticulation(noteEvent, measure, beat) {
        const detected = this.articulationDetector.recordNote(noteEvent);
        const expected = this.getExpectedArticulation(measure, beat);
        let comparison;
        if (expected) comparison = this.articulationDetector.compareArticulation(detected.type, expected);
        else comparison = { match: true, score: 80, feedback: '' };
        if (expected && !comparison.match) {
            this.logArticulationDeviation({ measure, beat, expectedArticulation: expected, detectedArticulation: detected.type, confidence: detected.confidence, score: comparison.score, feedback: comparison.feedback });
        }
        return { detected: detected.type, expected, confidence: detected.confidence, match: comparison.match, score: comparison.score, feedback: comparison.feedback };
    }

    calculateDynamicScore(expectedLevel, actualLevel) {
        const diff = Math.abs(expectedLevel - actualLevel);
        if (diff === 0) return 100;
        if (diff === 1) return 80;
        if (diff === 2) return 50;
        return 20;
    }

    logDynamicDeviation(deviation) {
        this.dynamicsDeviations.push({ ...deviation, type: 'dynamics' });
        if (this.dynamicsDeviations.length > this.maxDeviations) this.dynamicsDeviations.shift();
    }
    logArticulationDeviation(deviation) {
        this.articulationDeviations.push({ ...deviation, type: 'articulation' });
        if (this.articulationDeviations.length > this.maxDeviations) this.articulationDeviations.shift();
    }

    getSessionScores() {
        const dynScores = this.dynamicsDeviations.map(d => d.score);
        const artScores = this.articulationDeviations.map(d => d.score);
        const avgD = dynScores.length > 0 ? dynScores.reduce((a, b) => a + b, 0) / dynScores.length : 75;
        const avgA = artScores.length > 0 ? artScores.reduce((a, b) => a + b, 0) / artScores.length : 75;
        return { dynamics: Math.round(avgD), articulation: Math.round(avgA), combined: Math.round(avgD * 0.5 + avgA * 0.5), dynamicsDeviationCount: this.dynamicsDeviations.length, articulationDeviationCount: this.articulationDeviations.length };
    }

    getProblemMeasures() {
        const measureScores = {};
        for (const dev of [...this.dynamicsDeviations, ...this.articulationDeviations]) {
            if (!measureScores[dev.measure]) measureScores[dev.measure] = { total: 0, count: 0 };
            measureScores[dev.measure].total += dev.score;
            measureScores[dev.measure].count++;
        }
        return Object.entries(measureScores).map(([m, d]) => ({ measure: parseInt(m), avgScore: Math.round(d.total / d.count), deviationCount: d.count })).sort((a, b) => a.avgScore - b.avgScore).slice(0, 5);
    }

    exportDeviations() {
        return { dynamics: this.dynamicsDeviations.slice(-30), articulation: this.articulationDeviations.slice(-30), scores: this.getSessionScores(), problemMeasures: this.getProblemMeasures() };
    }

    reset() {
        this.volumeAnalyzer.reset();
        this.articulationDetector.reset();
        this.dynamicsDeviations = [];
        this.articulationDeviations = [];
        this.currentMeasure = 1;
        this.currentBeat = 0;
        this.expectedDynamic = 'mf';
        this.expectedArticulation = null;
        this.currentDynamicDirection = null;
    }
}

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

    // Test 3: Get expected dynamic
    test('should return expected dynamic at position', () => {
        const comp = new DynamicsComparator();
        comp.scoreDynamics = [
            { measure: 1, beat: 0, type: 'p', category: 'dynamic' },
            { measure: 3, beat: 0, type: 'f', category: 'dynamic' }
        ];
        assertEqual(comp.getExpectedDynamic(1, 0), 'p', 'Measure 1 = p');
        assertEqual(comp.getExpectedDynamic(2, 0), 'p', 'Measure 2 = p (carried over)');
        assertEqual(comp.getExpectedDynamic(3, 0), 'f', 'Measure 3 = f');
    });

    // Test 4: Get expected dynamic with crescendo
    test('should track crescendo direction', () => {
        const comp = new DynamicsComparator();
        comp.scoreDynamics = [
            { measure: 1, beat: 0, type: 'p', category: 'dynamic' },
            { measure: 2, beat: 0, type: 'crescendo', category: 'wedge' }
        ];
        comp.getExpectedDynamic(2, 1);
        assertEqual(comp.currentDynamicDirection, 'crescendo', 'Should detect crescendo direction');
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
        // The detected should be staccato (short duration)
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

    // Test 10: Get session scores
    test('should calculate session scores', () => {
        const comp = new DynamicsComparator();
        comp.dynamicsDeviations = [{ score: 80 }, { score: 60 }];
        comp.articulationDeviations = [{ score: 90 }, { score: 70 }];
        const scores = comp.getSessionScores();
        assertEqual(scores.dynamics, 70, 'Avg dynamics score');
        assertEqual(scores.articulation, 80, 'Avg articulation score');
        assertEqual(scores.combined, 75, 'Combined score');
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
        comp.reset();
        assertEqual(comp.dynamicsDeviations.length, 0, 'Dynamics deviations cleared');
        assertEqual(comp.articulationDeviations.length, 0, 'Articulation deviations cleared');
        assertEqual(comp.currentMeasure, 1, 'Measure reset');
        assertEqual(comp.expectedDynamic, 'mf', 'Dynamic reset');
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
        // Should have logged deviations due to no crescendo
        assertTrue(comp.dynamicsDeviations.length > 0, 'Should log deviation for missing crescendo');
    });

    // Test 15: No expected articulation
    test('should give default score when no articulation expected', () => {
        const comp = new DynamicsComparator();
        // No score articulations loaded
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
        comp.getExpectedDynamic(2, 1);
        assertEqual(comp.currentDynamicDirection, null, 'Direction should be null after wedge-stop');
    });

    // Test 18: Default session scores with no deviations
    test('should return default 75 when no deviations recorded', () => {
        const comp = new DynamicsComparator();
        const scores = comp.getSessionScores();
        assertEqual(scores.dynamics, 75, 'Default dynamics = 75');
        assertEqual(scores.articulation, 75, 'Default articulation = 75');
    });

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

runTests();
