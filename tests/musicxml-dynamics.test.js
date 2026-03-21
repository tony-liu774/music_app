/**
 * Tests for MusicXML Parser - Dynamics & Articulation Parsing
 * Uses production parseDirection / parseArticulations via CommonJS export
 * Run with: node --test tests/musicxml-dynamics.test.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Import production model classes
const { Note, Rest, Measure, Part, Score } = require('../src/js/models/sheet-music');

// Import production parser
const { MusicXMLParser } = require('../src/js/parsers/musicxml-parser');

// jsdom for DOM element creation
const { JSDOM } = (() => {
    try { return require('jsdom'); } catch (e) { return { JSDOM: null }; }
})();

// Helper: parse XML string to DOM element
function xmlElement(xmlString) {
    if (!JSDOM) throw new Error('jsdom not available — install jsdom to run DOM tests');
    const dom = new JSDOM(xmlString, { contentType: 'text/xml' });
    return dom.window.document.documentElement;
}

describe('MusicXMLParser parseDirection', { skip: !JSDOM && 'jsdom not available' }, () => {
    let parser;

    beforeEach(() => {
        // Provide globals that MusicXMLParser constructor/methods expect
        global.DOMParser = (new JSDOM('')).window.DOMParser;
        global.Note = Note;
        global.Rest = Rest;
        global.Measure = Measure;
        global.Part = Part;
        global.Score = Score;
        parser = new MusicXMLParser();
    });

    it('should parse forte dynamic marking', () => {
        const el = xmlElement(`<direction><direction-type><dynamics><f/></dynamics></direction-type></direction>`);
        const result = parser.parseDirection(el, 1);
        assert.strictEqual(result.category, 'dynamic');
        assert.strictEqual(result.type, 'f');
        assert.strictEqual(result.measure, 1);
        assert.strictEqual(result.beat, 0);
    });

    it('should parse piano dynamic marking', () => {
        const el = xmlElement(`<direction><direction-type><dynamics><p/></dynamics></direction-type></direction>`);
        const result = parser.parseDirection(el, 2);
        assert.strictEqual(result.type, 'p');
        assert.strictEqual(result.measure, 2);
    });

    it('should parse pp, mp, mf, ff dynamics', () => {
        for (const dyn of ['pp', 'mp', 'mf', 'ff']) {
            const el = xmlElement(`<direction><direction-type><dynamics><${dyn}/></dynamics></direction-type></direction>`);
            const result = parser.parseDirection(el, 1);
            assert.strictEqual(result.type, dyn, `${dyn} parsed correctly`);
            assert.strictEqual(result.category, 'dynamic');
        }
    });

    it('should parse fp, sf, sfz dynamics', () => {
        for (const dyn of ['fp', 'sf', 'sfz']) {
            const el = xmlElement(`<direction><direction-type><dynamics><${dyn}/></dynamics></direction-type></direction>`);
            const result = parser.parseDirection(el, 1);
            assert.strictEqual(result.type, dyn, `${dyn} parsed correctly`);
            assert.strictEqual(result.category, 'dynamic');
        }
    });

    it('should parse crescendo wedge', () => {
        const el = xmlElement(`<direction><direction-type><wedge type="crescendo"/></direction-type></direction>`);
        const result = parser.parseDirection(el, 3);
        assert.strictEqual(result.category, 'wedge');
        assert.strictEqual(result.type, 'crescendo');
    });

    it('should parse diminuendo wedge as decrescendo', () => {
        const el = xmlElement(`<direction><direction-type><wedge type="diminuendo"/></direction-type></direction>`);
        const result = parser.parseDirection(el, 4);
        assert.strictEqual(result.type, 'decrescendo');
    });

    it('should parse wedge stop', () => {
        const el = xmlElement(`<direction><direction-type><wedge type="stop"/></direction-type></direction>`);
        const result = parser.parseDirection(el, 5);
        assert.strictEqual(result.type, 'wedge-stop');
    });

    it('should parse pizz. text direction as technique', () => {
        const el = xmlElement(`<direction><direction-type><words>pizz.</words></direction-type></direction>`);
        const result = parser.parseDirection(el, 1);
        assert.strictEqual(result.category, 'technique');
        assert.strictEqual(result.type, 'pizzicato');
    });

    it('should parse cresc. text as wedge crescendo', () => {
        const el = xmlElement(`<direction><direction-type><words>cresc.</words></direction-type></direction>`);
        const result = parser.parseDirection(el, 1);
        assert.strictEqual(result.category, 'wedge');
        assert.strictEqual(result.type, 'crescendo');
    });

    it('should parse dim. text as wedge decrescendo', () => {
        const el = xmlElement(`<direction><direction-type><words>dim.</words></direction-type></direction>`);
        const result = parser.parseDirection(el, 1);
        assert.strictEqual(result.type, 'decrescendo');
    });

    it('should return null for empty direction-type', () => {
        const el = xmlElement(`<direction></direction>`);
        const result = parser.parseDirection(el, 1);
        assert.strictEqual(result, null);
    });

    // offset → beat conversion
    it('should compute beat from offset with divisions=2', () => {
        const el = xmlElement(`<direction><direction-type><dynamics><f/></dynamics></direction-type><offset>4</offset></direction>`);
        const result = parser.parseDirection(el, 1, 2);
        assert.strictEqual(result.beat, 2);
    });

    it('should default beat to 0 when no offset', () => {
        const el = xmlElement(`<direction><direction-type><dynamics><mf/></dynamics></direction-type></direction>`);
        const result = parser.parseDirection(el, 1, 4);
        assert.strictEqual(result.beat, 0);
    });

    it('should compute fractional beat from offset', () => {
        const el = xmlElement(`<direction><direction-type><wedge type="crescendo"/></direction-type><offset>3</offset></direction>`);
        const result = parser.parseDirection(el, 1, 4);
        assert.strictEqual(result.beat, 0.75);
    });
});

describe('MusicXMLParser parseArticulations', { skip: !JSDOM && 'jsdom not available' }, () => {
    let parser;

    beforeEach(() => {
        global.DOMParser = (new JSDOM('')).window.DOMParser;
        global.Note = Note;
        global.Rest = Rest;
        global.Measure = Measure;
        global.Part = Part;
        global.Score = Score;
        parser = new MusicXMLParser();
    });

    it('should parse staccato marking', () => {
        const el = xmlElement(`<notations><articulations><staccato/></articulations></notations>`);
        const note = new Note({ step: 'C', octave: 4, alter: 0 }, 1);
        parser.parseArticulations(el, note);
        assert.strictEqual(note.articulation, 'staccato');
        assert.strictEqual(note.accents[0], 'staccato');
    });

    it('should parse strong-accent as marcato', () => {
        const el = xmlElement(`<notations><articulations><strong-accent/></articulations></notations>`);
        const note = new Note({ step: 'A', octave: 4, alter: 0 }, 1);
        parser.parseArticulations(el, note);
        assert.strictEqual(note.articulation, 'marcato');
    });

    it('should parse tenuto marking', () => {
        const el = xmlElement(`<notations><articulations><tenuto/></articulations></notations>`);
        const note = new Note({ step: 'E', octave: 4, alter: 0 }, 1);
        parser.parseArticulations(el, note);
        assert.strictEqual(note.articulation, 'tenuto');
    });

    it('should handle multiple articulations', () => {
        const el = xmlElement(`<notations><articulations><staccato/><accent/></articulations></notations>`);
        const note = new Note({ step: 'G', octave: 4, alter: 0 }, 1);
        parser.parseArticulations(el, note);
        assert.strictEqual(note.accents.length, 2);
        assert.strictEqual(note.articulation, 'staccato');
    });

    it('should parse snap-pizzicato from technical element', () => {
        const el = xmlElement(`<notations><technical><snap-pizzicato/></technical></notations>`);
        const note = new Note({ step: 'D', octave: 3, alter: 0 }, 1);
        parser.parseArticulations(el, note);
        assert.strictEqual(note.articulation, 'pizzicato');
        assert.ok(note.accents.includes('pizzicato'));
    });
});

describe('MusicXMLParser parseNoteDynamics', { skip: !JSDOM && 'jsdom not available' }, () => {
    let parser;

    beforeEach(() => {
        global.DOMParser = (new JSDOM('')).window.DOMParser;
        global.Note = Note;
        global.Rest = Rest;
        global.Measure = Measure;
        global.Part = Part;
        global.Score = Score;
        parser = new MusicXMLParser();
    });

    it('should parse note-level dynamic from notations', () => {
        const el = xmlElement(`<notations><dynamics><ff/></dynamics></notations>`);
        const note = new Note({ step: 'C', octave: 5, alter: 0 }, 1);
        parser.parseNoteDynamics(el, note);
        assert.strictEqual(note.dynamic, 'ff');
    });

    it('should parse sfz at note level', () => {
        const el = xmlElement(`<notations><dynamics><sfz/></dynamics></notations>`);
        const note = new Note({ step: 'G', octave: 4, alter: 0 }, 1);
        parser.parseNoteDynamics(el, note);
        assert.strictEqual(note.dynamic, 'sfz');
    });
});

describe('MusicXMLParser parseMeasure wedge-stop handling', { skip: !JSDOM && 'jsdom not available' }, () => {
    let parser;

    beforeEach(() => {
        global.DOMParser = (new JSDOM('')).window.DOMParser;
        global.Note = Note;
        global.Rest = Rest;
        global.Measure = Measure;
        global.Part = Part;
        global.Score = Score;
        parser = new MusicXMLParser();
        parser.divisions = 1;
    });

    it('should not set dynamicDirection to wedge-stop on notes after hairpin end', () => {
        // Crescendo starts at beat 0, stop at beat 1 (via offset).
        // All directions are pre-parsed before notes, so offset determines beat position.
        const xml = `<measure number="1">
            <attributes><divisions>1</divisions></attributes>
            <direction><direction-type><wedge type="crescendo"/></direction-type></direction>
            <direction><direction-type><wedge type="stop"/></direction-type><offset>1</offset></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
            <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
        </measure>`;
        const el = xmlElement(xml);
        const measure = parser.parseMeasure(el, 1);

        // First note at beat 0: sees crescendo (beat 0) but not stop (beat 1)
        assert.strictEqual(measure.notes[0].dynamicDirection, 'crescendo');
        // Second note at beat 1: sees crescendo (beat 0) then stop (beat 1) → null
        assert.strictEqual(measure.notes[1].dynamicDirection, null);
    });

    it('should apply crescendo direction to notes within hairpin range', () => {
        const xml = `<measure number="2">
            <attributes><divisions>1</divisions></attributes>
            <direction><direction-type><wedge type="crescendo"/></direction-type></direction>
            <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
            <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
        </measure>`;
        const el = xmlElement(xml);
        const measure = parser.parseMeasure(el, 2);

        assert.strictEqual(measure.notes[0].dynamicDirection, 'crescendo');
        assert.strictEqual(measure.notes[1].dynamicDirection, 'crescendo');
    });
});

describe('Note model properties', () => {
    it('should create with default dynamics and articulation', () => {
        const note = new Note({ step: 'C', octave: 4, alter: 0 }, 1, { measure: 1, beat: 0 });
        assert.strictEqual(note.dynamic, 'mf');
        assert.strictEqual(note.articulation, null);
        assert.strictEqual(note.dynamicDirection, null);
        assert.ok(Array.isArray(note.accents));
        assert.strictEqual(note.accents.length, 0);
    });

    it('should support setting dynamic and direction', () => {
        const note = new Note({ step: 'A', octave: 4, alter: 0 }, 1);
        note.dynamic = 'ff';
        note.dynamicDirection = 'crescendo';
        assert.strictEqual(note.dynamic, 'ff');
        assert.strictEqual(note.dynamicDirection, 'crescendo');
    });
});

describe('Measure model properties', () => {
    it('should create with dynamics and articulations arrays', () => {
        const measure = new Measure(1);
        assert.ok(Array.isArray(measure.dynamics));
        assert.ok(Array.isArray(measure.articulations));
    });
});
