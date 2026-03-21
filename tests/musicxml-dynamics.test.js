/**
 * Tests for MusicXML Parser - Dynamics & Articulation Parsing
 * Run with: node tests/musicxml-dynamics.test.js
 */

// Minimal DOMParser polyfill for Node.js testing
const { JSDOM } = (() => {
    try { return require('jsdom'); } catch (e) { return { JSDOM: null }; }
})();

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

// Inline parseDirection from MusicXMLParser (mirror of production code)
function parseDirection(dirElement, measureNumber, divisions = 1) {
    const dirType = dirElement.querySelector('direction-type');
    if (!dirType) return null;

    const offsetEl = dirElement.querySelector('offset');
    const beat = offsetEl ? parseInt(offsetEl.textContent) / divisions : 0;

    const dynamicsEl = dirType.querySelector('dynamics');
    if (dynamicsEl) {
        const dynamicTypes = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'fp', 'sf', 'sfz'];
        for (const type of dynamicTypes) {
            if (dynamicsEl.querySelector(type)) {
                return { category: 'dynamic', type, measure: measureNumber, beat };
            }
        }
    }

    const wedge = dirType.querySelector('wedge');
    if (wedge) {
        const wedgeType = wedge.getAttribute('type');
        if (wedgeType === 'crescendo') {
            return { category: 'wedge', type: 'crescendo', measure: measureNumber, beat };
        } else if (wedgeType === 'diminuendo' || wedgeType === 'decrescendo') {
            return { category: 'wedge', type: 'decrescendo', measure: measureNumber, beat };
        } else if (wedgeType === 'stop') {
            return { category: 'wedge', type: 'wedge-stop', measure: measureNumber, beat };
        }
    }

    const words = dirType.querySelector('words');
    if (words) {
        const text = words.textContent.toLowerCase().trim();
        if (text === 'pizz.' || text === 'pizz' || text === 'pizzicato') {
            return { category: 'technique', type: 'pizzicato', measure: measureNumber, beat };
        }
        if (text.startsWith('cresc')) {
            return { category: 'wedge', type: 'crescendo', measure: measureNumber, beat };
        }
        if (text.startsWith('dim') || text.startsWith('decresc')) {
            return { category: 'wedge', type: 'decrescendo', measure: measureNumber, beat };
        }
    }

    return null;
}

// Inline parseArticulations from MusicXMLParser (mirror of production code)
function parseArticulations(notationsElement, note) {
    const articulationsEl = notationsElement.querySelector('articulations');
    if (!articulationsEl) return;

    const articulationMap = {
        'staccato': 'staccato',
        'staccatissimo': 'staccato',
        'accent': 'accent',
        'strong-accent': 'marcato',
        'tenuto': 'tenuto',
        'detached-legato': 'legato',
        'spiccato': 'staccato'
    };

    for (const [xmlTag, artType] of Object.entries(articulationMap)) {
        if (articulationsEl.querySelector(xmlTag)) {
            note.accents.push(artType);
            if (!note.articulation) {
                note.articulation = artType;
            }
        }
    }

    const technical = notationsElement.querySelector('technical');
    if (technical && technical.querySelector('snap-pizzicato, pizzicato')) {
        note.articulation = 'pizzicato';
        note.accents.push('pizzicato');
    }
}

// Helper: parse XML string to DOM element
function xmlElement(xmlString) {
    if (!JSDOM) throw new Error('jsdom not available');
    const dom = new JSDOM(xmlString, { contentType: 'text/xml' });
    return dom.window.document.documentElement;
}

// Test runner
function runTests() {
    console.log('Running MusicXML Dynamics & Articulation Parser Tests...\n');
    let passed = 0, failed = 0, skipped = 0;

    function test(name, fn) {
        try { fn(); console.log(`✓ ${name}`); passed++; }
        catch (e) {
            if (e.message === 'jsdom not available') { console.log(`- ${name} (skipped: no jsdom)`); skipped++; }
            else { console.log(`✗ ${name}\n  Error: ${e.message}`); failed++; }
        }
    }

    function assertEqual(actual, expected, msg) {
        if (actual !== expected) throw new Error(`${msg}: expected ${expected}, got ${actual}`);
    }

    function assertTrue(value, msg) {
        if (!value) throw new Error(msg || 'Expected true');
    }

    // === parseDirection tests (real DOM parsing) ===

    test('parseDirection: should parse forte dynamic marking', () => {
        const el = xmlElement(`<direction><direction-type><dynamics><f/></dynamics></direction-type></direction>`);
        const result = parseDirection(el, 1);
        assertEqual(result.category, 'dynamic', 'Category is dynamic');
        assertEqual(result.type, 'f', 'Dynamic type is forte');
        assertEqual(result.measure, 1, 'Measure is 1');
        assertEqual(result.beat, 0, 'Beat defaults to 0');
    });

    test('parseDirection: should parse piano dynamic marking', () => {
        const el = xmlElement(`<direction><direction-type><dynamics><p/></dynamics></direction-type></direction>`);
        const result = parseDirection(el, 2);
        assertEqual(result.type, 'p', 'Dynamic type is piano');
        assertEqual(result.measure, 2, 'Measure is 2');
    });

    test('parseDirection: should parse pp, mp, mf, ff dynamics', () => {
        for (const dyn of ['pp', 'mp', 'mf', 'ff']) {
            const el = xmlElement(`<direction><direction-type><dynamics><${dyn}/></dynamics></direction-type></direction>`);
            const result = parseDirection(el, 1);
            assertEqual(result.type, dyn, `${dyn} parsed correctly`);
            assertEqual(result.category, 'dynamic', `${dyn} is dynamic category`);
        }
    });

    test('parseDirection: should parse crescendo wedge', () => {
        const el = xmlElement(`<direction><direction-type><wedge type="crescendo"/></direction-type></direction>`);
        const result = parseDirection(el, 3);
        assertEqual(result.category, 'wedge', 'Category is wedge');
        assertEqual(result.type, 'crescendo', 'Wedge type is crescendo');
    });

    test('parseDirection: should parse diminuendo wedge as decrescendo', () => {
        const el = xmlElement(`<direction><direction-type><wedge type="diminuendo"/></direction-type></direction>`);
        const result = parseDirection(el, 4);
        assertEqual(result.type, 'decrescendo', 'diminuendo maps to decrescendo');
    });

    test('parseDirection: should parse wedge stop', () => {
        const el = xmlElement(`<direction><direction-type><wedge type="stop"/></direction-type></direction>`);
        const result = parseDirection(el, 5);
        assertEqual(result.type, 'wedge-stop', 'Wedge stop');
    });

    test('parseDirection: should parse pizz. text direction as technique', () => {
        const el = xmlElement(`<direction><direction-type><words>pizz.</words></direction-type></direction>`);
        const result = parseDirection(el, 1);
        assertEqual(result.category, 'technique', 'Category is technique');
        assertEqual(result.type, 'pizzicato', 'Type is pizzicato');
    });

    test('parseDirection: should parse cresc. text as wedge crescendo', () => {
        const el = xmlElement(`<direction><direction-type><words>cresc.</words></direction-type></direction>`);
        const result = parseDirection(el, 1);
        assertEqual(result.category, 'wedge', 'Category is wedge');
        assertEqual(result.type, 'crescendo', 'Type is crescendo');
    });

    test('parseDirection: should parse dim. text as wedge decrescendo', () => {
        const el = xmlElement(`<direction><direction-type><words>dim.</words></direction-type></direction>`);
        const result = parseDirection(el, 1);
        assertEqual(result.type, 'decrescendo', 'Type is decrescendo');
    });

    test('parseDirection: should return null for empty direction-type', () => {
        const el = xmlElement(`<direction></direction>`);
        const result = parseDirection(el, 1);
        assertEqual(result, null, 'No direction-type = null');
    });

    // === offset → beat conversion ===

    test('parseDirection: should compute beat from offset with divisions=2', () => {
        const el = xmlElement(`<direction><direction-type><dynamics><f/></dynamics></direction-type><offset>4</offset></direction>`);
        const result = parseDirection(el, 1, 2);
        assertEqual(result.beat, 2, 'Offset 4 / divisions 2 = beat 2');
    });

    test('parseDirection: should default beat to 0 when no offset', () => {
        const el = xmlElement(`<direction><direction-type><dynamics><mf/></dynamics></direction-type></direction>`);
        const result = parseDirection(el, 1, 4);
        assertEqual(result.beat, 0, 'No offset = beat 0');
    });

    test('parseDirection: should compute fractional beat from offset', () => {
        const el = xmlElement(`<direction><direction-type><wedge type="crescendo"/></direction-type><offset>3</offset></direction>`);
        const result = parseDirection(el, 1, 4);
        assertEqual(result.beat, 0.75, 'Offset 3 / divisions 4 = beat 0.75');
    });

    // === parseArticulations tests ===

    test('parseArticulations: should parse staccato marking', () => {
        const el = xmlElement(`<notations><articulations><staccato/></articulations></notations>`);
        const note = new Note({ step: 'C', octave: 4, alter: 0 }, 1);
        parseArticulations(el, note);
        assertEqual(note.articulation, 'staccato', 'Staccato parsed');
        assertEqual(note.accents[0], 'staccato', 'Staccato in accents');
    });

    test('parseArticulations: should parse strong-accent as marcato', () => {
        const el = xmlElement(`<notations><articulations><strong-accent/></articulations></notations>`);
        const note = new Note({ step: 'A', octave: 4, alter: 0 }, 1);
        parseArticulations(el, note);
        assertEqual(note.articulation, 'marcato', 'strong-accent maps to marcato');
    });

    test('parseArticulations: should parse tenuto marking', () => {
        const el = xmlElement(`<notations><articulations><tenuto/></articulations></notations>`);
        const note = new Note({ step: 'E', octave: 4, alter: 0 }, 1);
        parseArticulations(el, note);
        assertEqual(note.articulation, 'tenuto', 'Tenuto parsed');
    });

    test('parseArticulations: should handle multiple articulations', () => {
        const el = xmlElement(`<notations><articulations><staccato/><accent/></articulations></notations>`);
        const note = new Note({ step: 'G', octave: 4, alter: 0 }, 1);
        parseArticulations(el, note);
        assertEqual(note.accents.length, 2, 'Two accents');
        assertEqual(note.articulation, 'staccato', 'First found is primary');
    });

    // === Note model tests ===

    test('Note: should create with default dynamics and articulation', () => {
        const note = new Note({ step: 'C', octave: 4, alter: 0 }, 1, { measure: 1, beat: 0 });
        assertEqual(note.dynamic, 'mf', 'Default dynamic is mf');
        assertEqual(note.articulation, null, 'Default articulation is null');
        assertEqual(note.dynamicDirection, null, 'Default dynamicDirection is null');
        assertTrue(Array.isArray(note.accents), 'Accents is array');
        assertEqual(note.accents.length, 0, 'Accents is empty');
    });

    test('Note: should support setting dynamic and direction', () => {
        const note = new Note({ step: 'A', octave: 4, alter: 0 }, 1);
        note.dynamic = 'ff';
        note.dynamicDirection = 'crescendo';
        assertEqual(note.dynamic, 'ff', 'Dynamic set to ff');
        assertEqual(note.dynamicDirection, 'crescendo', 'Direction set');
    });

    // === Measure model tests ===

    test('Measure: should create with dynamics and articulations arrays', () => {
        const measure = new Measure(1);
        assertTrue(Array.isArray(measure.dynamics), 'Dynamics is array');
        assertTrue(Array.isArray(measure.articulations), 'Articulations is array');
    });

    console.log(`\n${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`);
    if (failed > 0) process.exit(1);
}

runTests();
