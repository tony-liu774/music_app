/**
 * Tests for Scale Engine - Procedural Warm-Up Generator
 * Run with: node tests/scale-engine.test.js
 */

// Mock dependencies
const {
    CHROMATIC_NOTES, CIRCLE_OF_FIFTHS, KEY_SIGNATURES,
    SCALE_INTERVALS, ARPEGGIO_INTERVALS, ETUDE_PATTERNS,
    INSTRUMENT_CONFIG, midiToPitch, noteNameToMidiBase, midiToPitchInKey,
    getKeySignatureFifths
} = require('../src/js/models/scale-data');

const { MusicXMLGenerator } = require('../src/js/parsers/musicxml-generator');
const { ScaleEngine } = require('../src/js/audio/scale-engine');

// Test runner
function runTests() {
    console.log('Running Scale Engine Tests...\n');

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

    function assertArrayLength(arr, expected, message) {
        if (arr.length !== expected) {
            throw new Error(`${message || 'Array length'}: expected ${expected}, got ${arr.length}`);
        }
    }

    // ============================================
    // Scale Data Module Tests
    // ============================================
    console.log('--- Scale Data Module ---');

    test('CHROMATIC_NOTES has 12 notes', () => {
        assertArrayLength(CHROMATIC_NOTES, 12, 'Chromatic notes count');
    });

    test('CIRCLE_OF_FIFTHS has 12 keys', () => {
        assertArrayLength(CIRCLE_OF_FIFTHS, 12, 'Circle of fifths count');
        assertEqual(CIRCLE_OF_FIFTHS[0], 'C', 'Starts with C');
        assertEqual(CIRCLE_OF_FIFTHS[1], 'G', 'Second is G');
    });

    test('KEY_SIGNATURES has correct fifths values', () => {
        assertEqual(KEY_SIGNATURES['C'], 0, 'C = 0 fifths');
        assertEqual(KEY_SIGNATURES['G'], 1, 'G = 1 sharp');
        assertEqual(KEY_SIGNATURES['D'], 2, 'D = 2 sharps');
        assertEqual(KEY_SIGNATURES['F'], -1, 'F = 1 flat');
        assertEqual(KEY_SIGNATURES['Bb'], -2, 'Bb = 2 flats');
    });

    test('SCALE_INTERVALS major scale has 7 intervals', () => {
        assertArrayLength(SCALE_INTERVALS.major, 7, 'Major scale intervals');
        assertEqual(SCALE_INTERVALS.major[0], 0, 'Root is 0');
        assertEqual(SCALE_INTERVALS.major[6], 11, 'Last interval is 11');
    });

    test('SCALE_INTERVALS minor scales have correct intervals', () => {
        assertArrayLength(SCALE_INTERVALS.natural_minor, 7, 'Natural minor intervals');
        assertArrayLength(SCALE_INTERVALS.harmonic_minor, 7, 'Harmonic minor intervals');
        assertArrayLength(SCALE_INTERVALS.melodic_minor, 7, 'Melodic minor intervals');
        // Harmonic minor has raised 7th
        assertEqual(SCALE_INTERVALS.harmonic_minor[6], 11, 'Harmonic minor raised 7th');
        // Natural minor has flat 7th
        assertEqual(SCALE_INTERVALS.natural_minor[6], 10, 'Natural minor flat 7th');
    });

    test('ARPEGGIO_INTERVALS has correct triads', () => {
        assertArrayLength(ARPEGGIO_INTERVALS.major, 3, 'Major arpeggio');
        assertArrayLength(ARPEGGIO_INTERVALS.minor, 3, 'Minor arpeggio');
        assertArrayLength(ARPEGGIO_INTERVALS.diminished, 3, 'Diminished arpeggio');
        assertArrayLength(ARPEGGIO_INTERVALS.augmented, 3, 'Augmented arpeggio');
        // Major: root, major 3rd, perfect 5th
        assertEqual(ARPEGGIO_INTERVALS.major[1], 4, 'Major 3rd = 4 semitones');
        assertEqual(ARPEGGIO_INTERVALS.major[2], 7, 'Perfect 5th = 7 semitones');
    });

    test('INSTRUMENT_CONFIG has all four instruments', () => {
        assertTrue(!!INSTRUMENT_CONFIG.violin, 'Violin exists');
        assertTrue(!!INSTRUMENT_CONFIG.viola, 'Viola exists');
        assertTrue(!!INSTRUMENT_CONFIG.cello, 'Cello exists');
        assertTrue(!!INSTRUMENT_CONFIG.double_bass, 'Double Bass exists');
    });

    test('Instrument ranges are correct', () => {
        assertEqual(INSTRUMENT_CONFIG.violin.clef, 'G', 'Violin uses treble clef');
        assertEqual(INSTRUMENT_CONFIG.viola.clef, 'C', 'Viola uses alto clef');
        assertEqual(INSTRUMENT_CONFIG.cello.clef, 'F', 'Cello uses bass clef');
        assertTrue(INSTRUMENT_CONFIG.violin.lowestMidi < INSTRUMENT_CONFIG.violin.highestMidi,
            'Violin range is valid');
    });

    test('midiToPitch converts correctly', () => {
        const c4 = midiToPitch(60);
        assertEqual(c4.step, 'C', 'MIDI 60 = C');
        assertEqual(c4.octave, 4, 'MIDI 60 = octave 4');
        assertEqual(c4.alter, 0, 'C4 has no accidental');

        const a4 = midiToPitch(69);
        assertEqual(a4.step, 'A', 'MIDI 69 = A');
        assertEqual(a4.octave, 4, 'MIDI 69 = octave 4');
    });

    test('midiToPitch handles sharps', () => {
        const csharp4 = midiToPitch(61);
        assertEqual(csharp4.step, 'C', 'MIDI 61 = C#');
        assertEqual(csharp4.alter, 1, 'MIDI 61 has sharp');
    });

    test('noteNameToMidiBase converts note names', () => {
        assertEqual(noteNameToMidiBase('C'), 0, 'C = 0');
        assertEqual(noteNameToMidiBase('D'), 2, 'D = 2');
        assertEqual(noteNameToMidiBase('A'), 9, 'A = 9');
        assertEqual(noteNameToMidiBase('F#'), 6, 'F# = 6');
        assertEqual(noteNameToMidiBase('Bb'), 10, 'Bb = 10');
    });

    test('midiToPitchInKey uses flats for flat keys', () => {
        const pitch = midiToPitchInKey(61, 'F'); // C#/Db in key of F
        assertEqual(pitch.step, 'D', 'In F major, MIDI 61 = Db');
        assertEqual(pitch.alter, -1, 'Flat spelling in flat key');
    });

    test('midiToPitchInKey uses sharps for sharp keys', () => {
        const pitch = midiToPitchInKey(61, 'D'); // C#/Db in key of D
        assertEqual(pitch.step, 'C', 'In D major, MIDI 61 = C#');
        assertEqual(pitch.alter, 1, 'Sharp spelling in sharp key');
    });

    // ============================================
    // MusicXML Generator Tests
    // ============================================
    console.log('\n--- MusicXML Generator ---');

    test('MusicXMLGenerator creates valid XML', () => {
        const gen = new MusicXMLGenerator();
        const xml = gen.generate({
            title: 'Test Scale',
            notes: [
                { step: 'C', octave: 4, alter: 0, duration: 1 },
                { step: 'D', octave: 4, alter: 0, duration: 1 },
                { step: 'E', octave: 4, alter: 0, duration: 1 },
                { step: 'F', octave: 4, alter: 0, duration: 1 }
            ],
            clef: 'G',
            clefLine: 2,
            fifths: 0,
            mode: 'major',
            tempo: 120
        });

        assertTrue(xml.includes('<?xml'), 'Has XML declaration');
        assertTrue(xml.includes('score-partwise'), 'Has score-partwise root');
        assertTrue(xml.includes('Test Scale'), 'Has title');
        assertTrue(xml.includes('<step>C</step>'), 'Has C note');
        assertTrue(xml.includes('<step>D</step>'), 'Has D note');
        assertTrue(xml.includes('tempo="120"'), 'Has tempo in sound element');
    });

    test('MusicXMLGenerator groups notes into measures', () => {
        const gen = new MusicXMLGenerator();
        const notes = [];
        for (let i = 0; i < 8; i++) {
            notes.push({ step: 'C', octave: 4, alter: 0, duration: 1 });
        }
        const measures = gen.groupNotesIntoMeasures(notes, 4, 4);
        assertArrayLength(measures, 2, 'Two measures for 8 quarter notes in 4/4');
        assertArrayLength(measures[0], 4, 'First measure has 4 notes');
        assertArrayLength(measures[1], 4, 'Second measure has 4 notes');
    });

    test('MusicXMLGenerator handles accidentals', () => {
        const gen = new MusicXMLGenerator();
        const xml = gen.generate({
            notes: [{ step: 'F', octave: 4, alter: 1, duration: 1 }]
        });
        assertTrue(xml.includes('<alter>1</alter>'), 'Includes sharp alter');
    });

    test('MusicXMLGenerator durationToType maps correctly', () => {
        const gen = new MusicXMLGenerator();
        assertEqual(gen.durationToType(4), 'whole', 'Duration 4 = whole');
        assertEqual(gen.durationToType(2), 'half', 'Duration 2 = half');
        assertEqual(gen.durationToType(1), 'quarter', 'Duration 1 = quarter');
        assertEqual(gen.durationToType(0.5), 'eighth', 'Duration 0.5 = eighth');
        assertEqual(gen.durationToType(0.25), '16th', 'Duration 0.25 = 16th');
    });

    test('MusicXMLGenerator escapes XML characters', () => {
        const gen = new MusicXMLGenerator();
        const escaped = gen.escapeXml('A & B < C > D');
        assertTrue(escaped.includes('&amp;'), 'Escapes ampersand');
        assertTrue(escaped.includes('&lt;'), 'Escapes less than');
        assertTrue(escaped.includes('&gt;'), 'Escapes greater than');
    });

    test('MusicXMLGenerator includes clef and key signature', () => {
        const gen = new MusicXMLGenerator();
        const xml = gen.generate({
            notes: [{ step: 'C', octave: 4, alter: 0, duration: 1 }],
            clef: 'C',
            clefLine: 3,
            fifths: -2,
            mode: 'major'
        });
        assertTrue(xml.includes('<sign>C</sign>'), 'Has alto clef sign');
        assertTrue(xml.includes('<line>3</line>'), 'Has clef line 3');
        assertTrue(xml.includes('<fifths>-2</fifths>'), 'Has 2 flats');
    });

    // ============================================
    // Scale Engine Core Tests
    // ============================================
    console.log('\n--- Scale Engine Core ---');

    test('ScaleEngine initializes with default config', () => {
        const engine = new ScaleEngine();
        const config = engine.getConfig();
        assertEqual(config.instrument, 'violin', 'Default instrument is violin');
        assertEqual(config.key, 'C', 'Default key is C');
        assertEqual(config.scaleType, 'major', 'Default scale type is major');
        assertEqual(config.exerciseType, 'scale', 'Default exercise type is scale');
        assertEqual(config.octaves, 2, 'Default octaves is 2');
    });

    test('ScaleEngine.setConfig updates configuration', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'G', octaves: 3, tempo: 100 });
        const config = engine.getConfig();
        assertEqual(config.key, 'G', 'Key updated to G');
        assertEqual(config.octaves, 3, 'Octaves updated to 3');
        assertEqual(config.tempo, 100, 'Tempo updated to 100');
    });

    test('ScaleEngine generates C major scale', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'C', scaleType: 'major', octaves: 1, instrument: 'violin' });
        const result = engine.generate();

        assertTrue(result.notes.length > 0, 'Notes generated');
        assertTrue(result.musicxml.length > 0, 'MusicXML generated');
        assertTrue(result.score !== null, 'Score object generated');

        // Ascending: C D E F G A B C = 8 notes
        // Descending: B A G F E D C = 7 notes
        // Total: 15 notes for 1 octave scale
        assertEqual(result.notes.length, 15, 'C major 1 octave has 15 notes (up and down)');
    });

    test('ScaleEngine generates scale with correct first and last notes', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'C', scaleType: 'major', octaves: 1, instrument: 'cello' });
        const result = engine.generate();

        assertEqual(result.notes[0].step, 'C', 'Scale starts on C');
        assertEqual(result.notes[result.notes.length - 1].step, 'C', 'Scale ends on C');
    });

    test('ScaleEngine generates 2 octave scale', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'C', scaleType: 'major', octaves: 2, instrument: 'cello' });
        const result = engine.generate();

        // 2 octaves ascending: 7*2 + 1 = 15 notes
        // Descending: 14 notes (no repeat of top)
        // Total: 29
        assertEqual(result.notes.length, 29, 'C major 2 octave has 29 notes');
    });

    test('ScaleEngine generates natural minor scale', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'A', scaleType: 'natural_minor', octaves: 1, instrument: 'violin' });
        const result = engine.generate();

        assertEqual(result.notes.length, 15, 'A natural minor 1 octave has 15 notes');
        assertEqual(result.notes[0].step, 'A', 'Starts on A');
    });

    test('ScaleEngine generates harmonic minor scale', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'A', scaleType: 'harmonic_minor', octaves: 1, instrument: 'violin' });
        const result = engine.generate();

        assertEqual(result.notes.length, 15, 'A harmonic minor 1 octave has 15 notes');
        // 7th degree should be G# (alter: 1) in A harmonic minor
        const seventhDegree = result.notes[6]; // 0-indexed, 7th note at index 6
        assertEqual(seventhDegree.step, 'G', 'Seventh degree is G#');
        assertEqual(seventhDegree.alter, 1, 'Seventh degree is sharp');
    });

    test('ScaleEngine generates melodic minor scale', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'A', scaleType: 'melodic_minor', octaves: 1, instrument: 'violin' });
        const result = engine.generate();

        assertTrue(result.notes.length > 0, 'Melodic minor generates notes');
        // Ascending should have raised 6th and 7th, descending should be natural minor
    });

    test('ScaleEngine generates major arpeggio', () => {
        const engine = new ScaleEngine();
        engine.setConfig({
            key: 'C', exerciseType: 'arpeggio', arpeggioType: 'major',
            octaves: 1, instrument: 'cello'
        });
        const result = engine.generate();

        // 1 octave major arpeggio: C E G C (ascending) + G E C (descending) = 7 notes
        assertEqual(result.notes.length, 7, 'C major arpeggio 1 octave has 7 notes');
        assertEqual(result.notes[0].step, 'C', 'Arpeggio starts on C');
        assertEqual(result.notes[1].step, 'E', 'Second note is E (major 3rd)');
        assertEqual(result.notes[2].step, 'G', 'Third note is G (perfect 5th)');
    });

    test('ScaleEngine generates minor arpeggio', () => {
        const engine = new ScaleEngine();
        engine.setConfig({
            key: 'A', exerciseType: 'arpeggio', arpeggioType: 'minor',
            octaves: 1, instrument: 'violin'
        });
        const result = engine.generate();

        assertTrue(result.notes.length > 0, 'Minor arpeggio generates notes');
        assertEqual(result.notes[0].step, 'A', 'Starts on A');
    });

    test('ScaleEngine generates diminished arpeggio', () => {
        const engine = new ScaleEngine();
        engine.setConfig({
            key: 'C', exerciseType: 'arpeggio', arpeggioType: 'diminished',
            octaves: 1, instrument: 'cello'
        });
        const result = engine.generate();

        assertTrue(result.notes.length > 0, 'Diminished arpeggio generates notes');
    });

    test('ScaleEngine generates augmented arpeggio', () => {
        const engine = new ScaleEngine();
        engine.setConfig({
            key: 'C', exerciseType: 'arpeggio', arpeggioType: 'augmented',
            octaves: 1, instrument: 'cello'
        });
        const result = engine.generate();

        assertTrue(result.notes.length > 0, 'Augmented arpeggio generates notes');
    });

    test('ScaleEngine generates etude pattern (thirds)', () => {
        const engine = new ScaleEngine();
        engine.setConfig({
            key: 'C', exerciseType: 'etude', etudePattern: 'thirds',
            scaleType: 'major', octaves: 1, instrument: 'cello'
        });
        const result = engine.generate();

        assertTrue(result.notes.length > 0, 'Thirds pattern generates notes');
    });

    test('ScaleEngine generates chromatic etude pattern', () => {
        const engine = new ScaleEngine();
        engine.setConfig({
            key: 'C', exerciseType: 'etude', etudePattern: 'chromatic',
            octaves: 1, instrument: 'cello'
        });
        const result = engine.generate();

        // 1 octave chromatic: 13 ascending + 12 descending = 25
        assertTrue(result.notes.length > 20, 'Chromatic pattern generates many notes');
    });

    test('ScaleEngine clamps notes to instrument range', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'C', scaleType: 'major', octaves: 3, instrument: 'violin' });
        const result = engine.generate();

        const violinConfig = INSTRUMENT_CONFIG.violin;
        for (const note of result.notes) {
            const midi = engine.pitchToMidi(note);
            assertTrue(midi >= violinConfig.lowestMidi,
                `Note MIDI ${midi} >= violin lowest ${violinConfig.lowestMidi}`);
            assertTrue(midi <= violinConfig.highestMidi,
                `Note MIDI ${midi} <= violin highest ${violinConfig.highestMidi}`);
        }
    });

    test('ScaleEngine generates exercise for all instruments', () => {
        const engine = new ScaleEngine();
        const instruments = ['violin', 'viola', 'cello', 'double_bass'];

        for (const instrument of instruments) {
            engine.setConfig({ key: 'G', scaleType: 'major', octaves: 1, instrument });
            const result = engine.generate();
            assertTrue(result.notes.length > 0, `${instrument} generates notes`);
        }
    });

    test('ScaleEngine generates exercise in all 12 keys', () => {
        const engine = new ScaleEngine();

        for (const key of CIRCLE_OF_FIFTHS) {
            engine.setConfig({ key, scaleType: 'major', octaves: 1, instrument: 'cello' });
            const result = engine.generate();
            assertTrue(result.notes.length > 0, `Key ${key} generates notes`);
        }
    });

    test('ScaleEngine circle of fifths generates 12 exercises', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ scaleType: 'major', octaves: 1, instrument: 'cello' });
        const results = engine.generateCircleOfFifths();

        assertArrayLength(results, 12, 'Circle of fifths produces 12 exercises');
        assertEqual(results[0].key, 'C', 'First key is C');
        assertEqual(results[1].key, 'G', 'Second key is G');
    });

    test('ScaleEngine getExerciseTitle returns descriptive title', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'D', scaleType: 'major', octaves: 2, instrument: 'violin' });
        const title = engine.getExerciseTitle();
        assertTrue(title.includes('D'), 'Title includes key');
        assertTrue(title.includes('Major'), 'Title includes scale type');
        assertTrue(title.includes('Violin'), 'Title includes instrument');
    });

    test('ScaleEngine getExerciseTitle for arpeggio', () => {
        const engine = new ScaleEngine();
        engine.setConfig({
            key: 'A', exerciseType: 'arpeggio', arpeggioType: 'minor',
            octaves: 1, instrument: 'cello'
        });
        const title = engine.getExerciseTitle();
        assertTrue(title.includes('Minor'), 'Arpeggio title includes type');
        assertTrue(title.includes('Arpeggio'), 'Title includes arpeggio');
    });

    test('ScaleEngine getAvailableKeys returns 12 keys', () => {
        const engine = new ScaleEngine();
        const keys = engine.getAvailableKeys();
        assertArrayLength(keys, 12, 'Available keys count');
    });

    test('ScaleEngine getScaleTypes returns 4 types', () => {
        const engine = new ScaleEngine();
        const types = engine.getScaleTypes();
        assertArrayLength(types, 4, 'Scale types count');
        assertTrue(types[0].id === 'major', 'First type is major');
    });

    test('ScaleEngine getArpeggioTypes returns 4 types', () => {
        const engine = new ScaleEngine();
        const types = engine.getArpeggioTypes();
        assertArrayLength(types, 4, 'Arpeggio types count');
    });

    test('ScaleEngine getInstruments returns 4 instruments', () => {
        const engine = new ScaleEngine();
        const instruments = engine.getInstruments();
        assertArrayLength(instruments, 4, 'Instruments count');
    });

    test('ScaleEngine fires onScoreGenerated callback', () => {
        const engine = new ScaleEngine();
        let callbackResult = null;
        engine.onScoreGenerated = (result) => { callbackResult = result; };

        engine.setConfig({ key: 'C', octaves: 1, instrument: 'cello' });
        engine.generate();

        assertTrue(callbackResult !== null, 'Callback was fired');
        assertTrue(callbackResult.notes.length > 0, 'Callback received notes');
        assertTrue(callbackResult.musicxml.length > 0, 'Callback received musicxml');
    });

    test('ScaleEngine fires onConfigChange callback', () => {
        const engine = new ScaleEngine();
        let callbackConfig = null;
        engine.onConfigChange = (config) => { callbackConfig = config; };

        engine.setConfig({ key: 'G' });

        assertTrue(callbackConfig !== null, 'Config change callback fired');
        assertEqual(callbackConfig.key, 'G', 'Config has updated key');
    });

    test('ScaleEngine MusicXML is valid XML structure', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'C', octaves: 1, instrument: 'cello' });
        const result = engine.generate();

        assertTrue(result.musicxml.includes('<?xml'), 'Has XML declaration');
        assertTrue(result.musicxml.includes('score-partwise'), 'Has score-partwise');
        assertTrue(result.musicxml.includes('<part id="P1">'), 'Has part P1');
        assertTrue(result.musicxml.includes('<measure'), 'Has measures');
    });

    test('ScaleEngine pitchToMidi converts correctly', () => {
        const engine = new ScaleEngine();
        const midi = engine.pitchToMidi({ step: 'A', octave: 4, alter: 0 });
        assertEqual(midi, 69, 'A4 = MIDI 69');

        const midiC4 = engine.pitchToMidi({ step: 'C', octave: 4, alter: 0 });
        assertEqual(midiC4, 60, 'C4 = MIDI 60');

        const midiFsharp = engine.pitchToMidi({ step: 'F', octave: 4, alter: 1 });
        assertEqual(midiFsharp, 66, 'F#4 = MIDI 66');
    });

    test('ScaleEngine buildScore returns valid structure', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'C', octaves: 1, instrument: 'cello' });
        const result = engine.generate();

        // Check score structure (using fallback since Score class not available in test)
        assertTrue(result.score.title.includes('C'), 'Score has title with key');
        assertTrue(result.score.parts.length > 0, 'Score has parts');
        assertTrue(result.score.parts[0].measures.length > 0, 'Part has measures');
    });

    // ============================================
    // Edge Cases & Integration Tests
    // ============================================
    console.log('\n--- Edge Cases ---');

    test('ScaleEngine handles double bass low range', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'E', scaleType: 'major', octaves: 1, instrument: 'double_bass' });
        const result = engine.generate();
        assertTrue(result.notes.length > 0, 'Double bass E major generates notes');
    });

    test('ScaleEngine handles flat keys correctly', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'Bb', scaleType: 'major', octaves: 1, instrument: 'cello' });
        const result = engine.generate();
        assertTrue(result.notes.length > 0, 'Bb major generates notes');
        assertEqual(result.notes[0].step, 'B', 'Starts on Bb');
        assertEqual(result.notes[0].alter, -1, 'First note is flat');
    });

    test('ScaleEngine handles F# key', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'F#', scaleType: 'major', octaves: 1, instrument: 'violin' });
        const result = engine.generate();
        assertTrue(result.notes.length > 0, 'F# major generates notes');
    });

    test('ScaleEngine generates notes with correct duration', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'C', octaves: 1, noteDuration: 0.5, instrument: 'cello' });
        const result = engine.generate();
        assertEqual(result.notes[0].duration, 0.5, 'Notes have eighth note duration');
    });

    test('MusicXMLGenerator handles empty notes array', () => {
        const gen = new MusicXMLGenerator();
        const xml = gen.generate({ title: 'Empty', notes: [] });
        assertTrue(xml.includes('score-partwise'), 'Still generates valid structure');
    });

    // ============================================
    // Minor Key Signature Tests (P0 fix)
    // ============================================
    console.log('\n--- Minor Key Signatures ---');

    test('getKeySignatureFifths returns 0 for C major', () => {
        assertEqual(getKeySignatureFifths('C', false), 0, 'C major = 0 fifths');
    });

    test('getKeySignatureFifths returns 0 for A minor (relative of C major)', () => {
        assertEqual(getKeySignatureFifths('A', true), 0, 'A minor = 0 fifths');
    });

    test('getKeySignatureFifths returns -1 for D minor (relative of F major)', () => {
        assertEqual(getKeySignatureFifths('D', true), -1, 'D minor = -1 fifth');
    });

    test('getKeySignatureFifths returns 1 for E minor (relative of G major)', () => {
        assertEqual(getKeySignatureFifths('E', true), 1, 'E minor = 1 sharp');
    });

    test('getKeySignatureFifths returns -3 for C minor (relative of Eb major)', () => {
        assertEqual(getKeySignatureFifths('C', true), -3, 'C minor = -3 flats');
    });

    test('ScaleEngine uses correct key signature for minor scales', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'A', scaleType: 'natural_minor', octaves: 1, instrument: 'violin' });
        const result = engine.generate();
        // A minor should have 0 fifths (relative major is C)
        assertTrue(result.musicxml.includes('<fifths>0</fifths>'), 'A minor has 0 fifths in MusicXML');
        assertTrue(result.musicxml.includes('<mode>minor</mode>'), 'Mode is minor');
    });

    test('ScaleEngine uses correct key signature for minor arpeggio', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'A', exerciseType: 'arpeggio', arpeggioType: 'minor', octaves: 1, instrument: 'violin' });
        const result = engine.generate();
        assertTrue(result.musicxml.includes('<fifths>0</fifths>'), 'A minor arpeggio has 0 fifths');
        assertTrue(result.musicxml.includes('<mode>minor</mode>'), 'Mode is minor for minor arpeggio');
    });

    // ============================================
    // Input Validation Tests (P1 fix)
    // ============================================
    console.log('\n--- Input Validation ---');

    test('setConfig throws on unknown instrument', () => {
        const engine = new ScaleEngine();
        let threw = false;
        try {
            engine.setConfig({ instrument: 'banjo' });
        } catch (e) {
            threw = true;
            assertTrue(e.message.includes('banjo'), 'Error mentions the invalid instrument');
        }
        assertTrue(threw, 'Should throw for unknown instrument');
    });

    test('setConfig throws on unknown key', () => {
        const engine = new ScaleEngine();
        let threw = false;
        try {
            engine.setConfig({ key: 'H' });
        } catch (e) {
            threw = true;
            assertTrue(e.message.includes('H'), 'Error mentions the invalid key');
        }
        assertTrue(threw, 'Should throw for unknown key');
    });

    test('setConfig clamps tempo to valid range', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ tempo: 5 });
        assertEqual(engine.getConfig().tempo, 20, 'Tempo clamped to minimum 20');

        engine.setConfig({ tempo: 500 });
        assertEqual(engine.getConfig().tempo, 300, 'Tempo clamped to maximum 300');
    });

    test('setConfig clamps octaves to valid range', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ octaves: 0 });
        assertEqual(engine.getConfig().octaves, 1, 'Octaves clamped to minimum 1');

        engine.setConfig({ octaves: 5 });
        assertEqual(engine.getConfig().octaves, 3, 'Octaves clamped to maximum 3');
    });

    // ============================================
    // Etude Pattern Fix Tests (P0 fix)
    // ============================================
    console.log('\n--- Etude Pattern Fixes ---');

    test('Sixths etude at 1 octave produces notes', () => {
        const engine = new ScaleEngine();
        engine.setConfig({
            key: 'C', exerciseType: 'etude', etudePattern: 'sixths',
            scaleType: 'major', octaves: 1, instrument: 'cello'
        });
        const result = engine.generate();
        assertTrue(result.notes.length > 0, 'Sixths at 1 octave should produce notes');
    });

    test('Octaves etude at 1 octave produces notes', () => {
        const engine = new ScaleEngine();
        engine.setConfig({
            key: 'C', exerciseType: 'etude', etudePattern: 'octaves',
            scaleType: 'major', octaves: 1, instrument: 'cello'
        });
        const result = engine.generate();
        assertTrue(result.notes.length > 0, 'Octaves at 1 octave should produce notes');
    });

    // ============================================
    // Shifts & Double Stops Tests (P2 feature)
    // ============================================
    console.log('\n--- Shifts & Double Stops ---');

    test('Shifts etude pattern generates notes', () => {
        const engine = new ScaleEngine();
        engine.setConfig({
            key: 'C', exerciseType: 'etude', etudePattern: 'shifts',
            scaleType: 'major', octaves: 2, instrument: 'cello'
        });
        const result = engine.generate();
        assertTrue(result.notes.length > 0, 'Shifts pattern generates notes');
        // Shifts generate 4-note fragments; should be multiple of 4
        assertEqual(result.notes.length % 4, 0, 'Shift notes come in groups of 4');
    });

    test('Double stops etude pattern generates notes', () => {
        const engine = new ScaleEngine();
        engine.setConfig({
            key: 'C', exerciseType: 'etude', etudePattern: 'double_stops',
            scaleType: 'major', octaves: 2, instrument: 'cello'
        });
        const result = engine.generate();
        assertTrue(result.notes.length > 0, 'Double stops pattern generates notes');
        // Double stops generate pairs of notes
        assertEqual(result.notes.length % 2, 0, 'Double stop notes come in pairs');
    });

    test('ETUDE_PATTERNS includes shifts and double_stops', () => {
        assertTrue(!!ETUDE_PATTERNS.shifts, 'Shifts pattern exists');
        assertTrue(!!ETUDE_PATTERNS.double_stops, 'Double stops pattern exists');
        assertTrue(ETUDE_PATTERNS.shifts.shift === true, 'Shifts has shift flag');
        assertTrue(ETUDE_PATTERNS.double_stops.doubleStop === true, 'Double stops has doubleStop flag');
    });

    // ============================================
    // Final Barline Test (P2 fix)
    // ============================================
    console.log('\n--- Final Barline ---');

    test('MusicXMLGenerator adds final barline to last measure', () => {
        const gen = new MusicXMLGenerator();
        const xml = gen.generate({
            title: 'Barline Test',
            notes: [
                { step: 'C', octave: 4, alter: 0, duration: 1 },
                { step: 'D', octave: 4, alter: 0, duration: 1 }
            ],
            clef: 'G',
            clefLine: 2,
            fifths: 0,
            mode: 'major'
        });
        assertTrue(xml.includes('light-heavy'), 'Has final barline style');
        assertTrue(xml.includes('barline'), 'Has barline element');
    });

    // ============================================
    // Circle of Fifths Mutation Test (P3 fix)
    // ============================================
    console.log('\n--- Circle of Fifths ---');

    test('generateCircleOfFifths restores original key', () => {
        const engine = new ScaleEngine();
        engine.setConfig({ key: 'D', scaleType: 'major', octaves: 1, instrument: 'cello' });
        engine.generateCircleOfFifths();
        assertEqual(engine.getConfig().key, 'D', 'Original key D is restored after circle of fifths');
    });

    // ============================================
    // ScaleEngineUI Tests
    // ============================================
    console.log('\n--- ScaleEngineUI ---');

    // Mock DOM environment for UI tests
    function createMockDOM() {
        const elements = {};
        const createElement = (tag) => {
            const el = {
                tagName: tag.toUpperCase(),
                className: '',
                id: '',
                innerHTML: '',
                style: {},
                children: [],
                parentNode: null,
                disabled: false,
                textContent: '',
                classList: {
                    _classes: new Set(),
                    add(c) { this._classes.add(c); },
                    remove(c) { this._classes.delete(c); },
                    toggle(c, force) {
                        if (force !== undefined) {
                            force ? this._classes.add(c) : this._classes.delete(c);
                        } else {
                            this._classes.has(c) ? this._classes.delete(c) : this._classes.add(c);
                        }
                    },
                    contains(c) { return this._classes.has(c); }
                },
                _listeners: {},
                addEventListener(event, fn) {
                    if (!this._listeners[event]) this._listeners[event] = [];
                    this._listeners[event].push(fn);
                },
                setAttribute(name, value) { this[`_attr_${name}`] = value; },
                getAttribute(name) { return this[`_attr_${name}`]; },
                appendChild(child) {
                    this.children.push(child);
                    child.parentNode = this;
                    // Parse innerHTML to populate queryable elements
                },
                removeChild(child) {
                    const idx = this.children.indexOf(child);
                    if (idx >= 0) this.children.splice(idx, 1);
                    child.parentNode = null;
                },
                querySelector(selector) {
                    // Simple ID-based selector for testing
                    if (selector.startsWith('#')) {
                        const id = selector.slice(1);
                        return elements[id] || null;
                    }
                    return null;
                }
            };
            return el;
        };

        // Create mock elements that ScaleEngineUI queries
        const ids = [
            'scale-instrument', 'scale-key', 'scale-exercise-type',
            'scale-type', 'arpeggio-type', 'etude-pattern',
            'scale-octaves', 'scale-tempo', 'scale-tempo-display',
            'scale-generate-btn', 'scale-practice-btn', 'scale-cof-btn',
            'scale-exercise-info', 'scale-exercise-title', 'scale-note-count',
            'scale-type-field', 'arpeggio-type-field', 'etude-pattern-field'
        ];
        for (const id of ids) {
            elements[id] = createElement('div');
            elements[id].id = id;
        }

        const container = createElement('div');
        container.querySelector = (selector) => {
            if (selector.startsWith('#')) {
                return elements[selector.slice(1)] || null;
            }
            return null;
        };

        // Override createElement to return our mock panel
        const panel = createElement('div');
        panel.querySelector = container.querySelector;

        return { container, panel, elements, createElement };
    }

    // Mock localStorage
    const mockStorage = {};
    const origGetItem = global.localStorage;
    global.localStorage = {
        getItem: (key) => mockStorage[key] || null,
        setItem: (key, value) => { mockStorage[key] = String(value); },
        removeItem: (key) => { delete mockStorage[key]; }
    };

    // Load ScaleEngineUI
    const { ScaleEngineUI } = require('../src/js/components/scale-engine-ui');

    test('ScaleEngineUI loads default settings', () => {
        const { container } = createMockDOM();
        const ui = new ScaleEngineUI(container);
        assertEqual(ui.settings.instrument, 'violin', 'Default instrument');
        assertEqual(ui.settings.key, 'C', 'Default key');
        assertEqual(ui.settings.scaleType, 'major', 'Default scale type');
        assertEqual(ui.settings.tempo, 80, 'Default tempo');
    });

    test('ScaleEngineUI saves and loads settings from localStorage', () => {
        const { container } = createMockDOM();
        const ui = new ScaleEngineUI(container);
        ui.settings.key = 'G';
        ui.settings.tempo = 120;
        ui.saveSettings();

        assertEqual(mockStorage['scaleEngine_key'], 'G', 'Key saved to localStorage');
        assertEqual(mockStorage['scaleEngine_tempo'], '120', 'Tempo saved to localStorage');

        // Load into a new instance
        const ui2 = new ScaleEngineUI(container);
        assertEqual(ui2.settings.key, 'G', 'Key loaded from localStorage');
        assertEqual(ui2.settings.tempo, 120, 'Tempo loaded from localStorage');

        // Clean up
        delete mockStorage['scaleEngine_key'];
        delete mockStorage['scaleEngine_tempo'];
    });

    test('ScaleEngineUI connectModules stores references', () => {
        const { container } = createMockDOM();
        const ui = new ScaleEngineUI(container);
        const mockMetronome = { setBPM: () => {}, start: () => {}, stop: () => {} };
        const mockFollowTheBall = { reset: () => {}, enabled: false };
        const mockRenderer = { setScore: () => {} };

        ui.connectModules({
            metronome: mockMetronome,
            followTheBall: mockFollowTheBall,
            sheetMusicRenderer: mockRenderer
        });

        assertTrue(ui.metronome === mockMetronome, 'Metronome stored');
        assertTrue(ui.followTheBall === mockFollowTheBall, 'FollowTheBall stored');
        assertTrue(ui.sheetMusicRenderer === mockRenderer, 'SheetMusicRenderer stored');
        assertTrue(ui.intonationAnalyzer === null, 'IntonationAnalyzer null when not provided');
    });

    test('ScaleEngineUI getCurrentScore returns null initially', () => {
        const { container } = createMockDOM();
        const ui = new ScaleEngineUI(container);
        assertEqual(ui.getCurrentScore(), null, 'No score initially');
    });

    // Restore localStorage
    if (origGetItem) {
        global.localStorage = origGetItem;
    }

    console.log(`\n${passed} passed, ${failed} failed`);

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();