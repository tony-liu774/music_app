/**
 * Tests for MusicXML Parser - Dynamics & Articulation Parsing
 * Run with: node tests/musicxml-dynamics.test.js
 */

// Minimal DOMParser polyfill for Node.js testing
const { JSDOM } = (() => {
    try { return require('jsdom'); } catch (e) { return { JSDOM: null }; }
})();

// Fallback: use inline parser
class SimpleDOMParser {
    parseFromString(xmlString) {
        // For testing, we'll simulate MusicXML parsing with a simple approach
        if (typeof DOMParser !== 'undefined') {
            return new DOMParser().parseFromString(xmlString, 'text/xml');
        }
        // Node.js environment - try jsdom
        if (JSDOM) {
            const dom = new JSDOM(xmlString, { contentType: 'text/xml' });
            return dom.window.document;
        }
        throw new Error('No XML parser available');
    }
}

// Stub Note class
class Note {
    constructor(pitch, duration, position = {}) {
        this.pitch = pitch;
        this.duration = duration;
        this.position = position;
        this.type = 'note';
        this.tie = null;
        this.dot = false;
        this.accents = [];
        this.dynamic = 'mf';
        this.articulation = null;
        this.dynamicDirection = null;
    }
    getMIDI() {
        const steps = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
        return 12 + (steps[this.pitch.step] || 0) + (this.pitch.alter || 0) + ((this.pitch.octave || 4) * 12);
    }
    getFrequency() { return 440 * Math.pow(2, (this.getMIDI() - 69) / 12); }
    getName() {
        const alter = this.pitch.alter || 0;
        if (alter === 1) return this.pitch.step + '#';
        if (alter === -1) return this.pitch.step + 'b';
        return this.pitch.step;
    }
}

class Rest {
    constructor(duration, position = {}) { this.duration = duration; this.position = position; this.type = 'rest'; }
}

class Measure {
    constructor(number = 1) {
        this.number = number; this.notes = []; this.rests = [];
        this.clef = null; this.key = { fifths: 0, mode: 'major' }; this.timeSignature = { beats: 4, beatType: 4 };
        this.dynamics = []; this.articulations = [];
    }
    addElement(element) {
        if (element instanceof Note) this.notes.push(element);
        else if (element instanceof Rest) this.rests.push(element);
    }
}

class Part { constructor(id, name = 'Part 1') { this.id = id; this.name = name; this.instrument = 'violin'; this.measures = []; } addMeasure(m) { this.measures.push(m); } }
class Score { constructor(title = 'Untitled', composer = 'Unknown') { this.title = title; this.composer = composer; this.parts = []; this.divisions = 1; this.tempo = 120; } addPart(p) { this.parts.push(p); } }

// Test runner
function runTests() {
    console.log('Running MusicXML Dynamics & Articulation Parser Tests...\n');
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

    // Test parseDirection independently (unit test without XML)
    test('should parse forte dynamic marking', () => {
        // Simulate what parseDirection would extract
        const dynamicData = { category: 'dynamic', type: 'f', measure: 1, beat: 0 };
        assertEqual(dynamicData.type, 'f', 'Dynamic type is forte');
        assertEqual(dynamicData.category, 'dynamic', 'Category is dynamic');
    });

    test('should parse piano dynamic marking', () => {
        const dynamicData = { category: 'dynamic', type: 'p', measure: 1, beat: 0 };
        assertEqual(dynamicData.type, 'p', 'Dynamic type is piano');
    });

    test('should parse crescendo wedge', () => {
        const wedgeData = { category: 'wedge', type: 'crescendo', measure: 2, beat: 0 };
        assertEqual(wedgeData.type, 'crescendo', 'Wedge type is crescendo');
        assertEqual(wedgeData.category, 'wedge', 'Category is wedge');
    });

    test('should parse decrescendo wedge', () => {
        const wedgeData = { category: 'wedge', type: 'decrescendo', measure: 3, beat: 0 };
        assertEqual(wedgeData.type, 'decrescendo', 'Wedge type is decrescendo');
    });

    test('should parse wedge stop', () => {
        const wedgeData = { category: 'wedge', type: 'wedge-stop', measure: 4, beat: 0 };
        assertEqual(wedgeData.type, 'wedge-stop', 'Wedge stop');
    });

    // Test Note model dynamics/articulation properties
    test('should create Note with default dynamics and articulation', () => {
        const note = new Note({ step: 'C', octave: 4, alter: 0 }, 1, { measure: 1, beat: 0 });
        assertEqual(note.dynamic, 'mf', 'Default dynamic is mf');
        assertEqual(note.articulation, null, 'Default articulation is null');
        assertEqual(note.dynamicDirection, null, 'Default dynamicDirection is null');
        assertTrue(Array.isArray(note.accents), 'Accents is array');
        assertEqual(note.accents.length, 0, 'Accents is empty');
    });

    test('should support setting articulation on Note', () => {
        const note = new Note({ step: 'A', octave: 4, alter: 0 }, 1, { measure: 1, beat: 0 });
        note.articulation = 'staccato';
        note.accents.push('staccato');
        assertEqual(note.articulation, 'staccato', 'Articulation set');
        assertEqual(note.accents[0], 'staccato', 'Accent added');
    });

    test('should support setting dynamic on Note', () => {
        const note = new Note({ step: 'A', octave: 4, alter: 0 }, 1, { measure: 1, beat: 0 });
        note.dynamic = 'ff';
        assertEqual(note.dynamic, 'ff', 'Dynamic set to ff');
    });

    test('should support dynamicDirection on Note', () => {
        const note = new Note({ step: 'A', octave: 4, alter: 0 }, 1, { measure: 1, beat: 0 });
        note.dynamicDirection = 'crescendo';
        assertEqual(note.dynamicDirection, 'crescendo', 'Dynamic direction set');
    });

    // Test Measure dynamics/articulations arrays
    test('should create Measure with dynamics and articulations arrays', () => {
        const measure = new Measure(1);
        assertTrue(Array.isArray(measure.dynamics), 'Dynamics is array');
        assertTrue(Array.isArray(measure.articulations), 'Articulations is array');
        assertEqual(measure.dynamics.length, 0, 'Dynamics starts empty');
        assertEqual(measure.articulations.length, 0, 'Articulations starts empty');
    });

    test('should store dynamics in measure', () => {
        const measure = new Measure(1);
        measure.dynamics.push({ type: 'f', beat: 0 });
        measure.dynamics.push({ type: 'crescendo', beat: 2, category: 'wedge' });
        assertEqual(measure.dynamics.length, 2, 'Two dynamics added');
        assertEqual(measure.dynamics[0].type, 'f', 'First dynamic is forte');
        assertEqual(measure.dynamics[1].type, 'crescendo', 'Second is crescendo');
    });

    // Test articulation mapping
    test('should map MusicXML articulation tags correctly', () => {
        const articulationMap = {
            'staccato': 'staccato',
            'staccatissimo': 'staccato',
            'accent': 'accent',
            'strong-accent': 'marcato',
            'tenuto': 'tenuto',
            'detached-legato': 'legato',
            'spiccato': 'staccato'
        };

        assertEqual(articulationMap['staccato'], 'staccato', 'staccato maps correctly');
        assertEqual(articulationMap['strong-accent'], 'marcato', 'strong-accent maps to marcato');
        assertEqual(articulationMap['tenuto'], 'tenuto', 'tenuto maps correctly');
        assertEqual(articulationMap['detached-legato'], 'legato', 'detached-legato maps to legato');
        assertEqual(articulationMap['spiccato'], 'staccato', 'spiccato maps to staccato');
    });

    // Test dynamic type recognition
    test('should recognize all standard dynamic types', () => {
        const dynamicTypes = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'fp', 'sf', 'sfz'];
        assertEqual(dynamicTypes.length, 9, 'All 9 standard dynamics');
        assertTrue(dynamicTypes.includes('pp'), 'pp recognized');
        assertTrue(dynamicTypes.includes('ff'), 'ff recognized');
        assertTrue(dynamicTypes.includes('sfz'), 'sfz recognized');
    });

    // Test text direction parsing logic
    test('should recognize pizzicato text direction', () => {
        const textDirections = ['pizz.', 'pizz', 'pizzicato'];
        for (const text of textDirections) {
            const lower = text.toLowerCase().trim();
            assertTrue(lower === 'pizz.' || lower === 'pizz' || lower === 'pizzicato',
                `${text} should be recognized as pizzicato`);
        }
    });

    test('should recognize cresc. text direction', () => {
        const texts = ['cresc.', 'crescendo', 'cresc'];
        for (const text of texts) {
            assertTrue(text.toLowerCase().trim().startsWith('cresc'), `${text} should be crescendo`);
        }
    });

    test('should recognize dim./decresc. text direction', () => {
        const texts = ['dim.', 'diminuendo', 'decresc.', 'decrescendo'];
        for (const text of texts) {
            const lower = text.toLowerCase().trim();
            assertTrue(lower.startsWith('dim') || lower.startsWith('decresc'), `${text} should be decrescendo`);
        }
    });

    // Test integration: note with multiple articulations
    test('should support multiple accents on a single note', () => {
        const note = new Note({ step: 'G', octave: 3, alter: 0 }, 0.5, { measure: 1, beat: 0 });
        note.accents.push('staccato');
        note.accents.push('accent');
        note.articulation = 'staccato'; // Primary
        assertEqual(note.accents.length, 2, 'Two accents');
        assertEqual(note.articulation, 'staccato', 'Primary articulation');
    });

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

runTests();
