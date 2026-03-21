/**
 * Scale Data Module
 * Music theory data for all scale types, arpeggios, and etude patterns.
 * All 12 keys, circle of fifths, and instrument ranges.
 */

const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Enharmonic display names (prefer flats for flat keys)
const ENHARMONIC_MAP = {
    'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb'
};

// Circle of fifths order (sharps then flats)
const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];

// Key signatures: fifths value for MusicXML (positive = sharps, negative = flats)
const KEY_SIGNATURES = {
    'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6,
    'Db': -5, 'Ab': -4, 'Eb': -3, 'Bb': -2, 'F': -1,
    'Gb': -6, 'C#': 7
};

// Scale intervals (in semitones from root)
const SCALE_INTERVALS = {
    major:            [0, 2, 4, 5, 7, 9, 11],
    natural_minor:    [0, 2, 3, 5, 7, 8, 10],
    harmonic_minor:   [0, 2, 3, 5, 7, 8, 11],
    melodic_minor:    [0, 2, 3, 5, 7, 9, 11]  // ascending form
};

// Arpeggio intervals (in semitones from root)
const ARPEGGIO_INTERVALS = {
    major:       [0, 4, 7],
    minor:       [0, 3, 7],
    diminished:  [0, 3, 6],
    augmented:   [0, 4, 8]
};

// Etude pattern types
const ETUDE_PATTERNS = {
    thirds: { name: 'Thirds', intervals: [0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7] },
    sixths: { name: 'Sixths', intervals: [0, 5, 1, 6, 2, 7, 3, 8, 4, 9, 5, 10] },
    octaves: { name: 'Octaves', intervals: [0, 7, 1, 8, 2, 9, 3, 10, 4, 11, 5, 12] },
    broken_thirds: { name: 'Broken Thirds', intervals: [0, 2, 4, 2, 4, 5, 7, 5] },
    shifts: { name: 'Shifts', intervals: [0, 1, 2, 3, 4, 5, 6, 7], shift: true },
    double_stops: { name: 'Double Stops', intervals: [0, 2], doubleStop: true },
    chromatic: { name: 'Chromatic', intervals: null } // special case
};

// Instrument ranges and clefs
const INSTRUMENT_CONFIG = {
    violin: {
        name: 'Violin',
        clef: 'G',
        clefLine: 2,
        lowestNote: { step: 'G', octave: 3 },
        highestNote: { step: 'E', octave: 7 },
        lowestMidi: 55,
        highestMidi: 100,
        strings: [
            { name: 'G', midi: 55 },
            { name: 'D', midi: 62 },
            { name: 'A', midi: 69 },
            { name: 'E', midi: 76 }
        ]
    },
    viola: {
        name: 'Viola',
        clef: 'C',
        clefLine: 3,
        lowestNote: { step: 'C', octave: 3 },
        highestNote: { step: 'A', octave: 6 },
        lowestMidi: 48,
        highestMidi: 93,
        strings: [
            { name: 'C', midi: 48 },
            { name: 'G', midi: 55 },
            { name: 'D', midi: 62 },
            { name: 'A', midi: 69 }
        ]
    },
    cello: {
        name: 'Cello',
        clef: 'F',
        clefLine: 4,
        lowestNote: { step: 'C', octave: 2 },
        highestNote: { step: 'B', octave: 5 },
        lowestMidi: 36,
        highestMidi: 83,
        strings: [
            { name: 'C', midi: 36 },
            { name: 'G', midi: 43 },
            { name: 'D', midi: 50 },
            { name: 'A', midi: 57 }
        ]
    },
    double_bass: {
        name: 'Double Bass',
        clef: 'F',
        clefLine: 4,
        lowestNote: { step: 'E', octave: 1 },
        highestNote: { step: 'C', octave: 4 },
        lowestMidi: 28,
        highestMidi: 60,
        strings: [
            { name: 'E', midi: 28 },
            { name: 'A', midi: 33 },
            { name: 'D', midi: 38 },
            { name: 'G', midi: 43 }
        ]
    }
};

/**
 * Get key signature fifths value, adjusting for minor keys.
 * Minor keys use the relative major's key signature (3 semitones up).
 * @param {string} keyName - Key name (e.g. 'A', 'D', 'Bb')
 * @param {boolean} isMinor - Whether the scale is minor
 * @returns {number} fifths value for MusicXML
 */
function getKeySignatureFifths(keyName, isMinor) {
    if (!isMinor) {
        return KEY_SIGNATURES[keyName] || 0;
    }
    // Minor key: relative major is 3 semitones up
    const minorBase = noteNameToMidiBase(keyName);
    const relativeMajorBase = (minorBase + 3) % 12;
    // Find the key name for the relative major
    const baseToKey = {
        0: 'C', 1: 'Db', 2: 'D', 3: 'Eb', 4: 'E', 5: 'F',
        6: 'F#', 7: 'G', 8: 'Ab', 9: 'A', 10: 'Bb', 11: 'B'
    };
    const relativeMajorKey = baseToKey[relativeMajorBase];
    return KEY_SIGNATURES[relativeMajorKey] || 0;
}

/**
 * Convert a MIDI number to pitch object { step, octave, alter }
 */
function midiToPitch(midi) {
    const noteIndex = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    const step = CHROMATIC_NOTES[noteIndex];
    if (step.length === 2) {
        // Sharped note
        return { step: step[0], octave, alter: 1 };
    }
    return { step, octave, alter: 0 };
}

/**
 * Convert a note name (like 'C', 'F#', 'Bb') to its MIDI base (within octave 0)
 */
function noteNameToMidiBase(noteName) {
    const baseMap = {
        'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11,
        'C#': 1, 'Db': 1, 'D#': 3, 'Eb': 3, 'F#': 6, 'Gb': 6,
        'G#': 8, 'Ab': 8, 'A#': 10, 'Bb': 10
    };
    return baseMap[noteName] !== undefined ? baseMap[noteName] : 0;
}

/**
 * Convert MIDI to pitch using key-aware spelling (prefer flats/sharps based on key)
 */
function midiToPitchInKey(midi, keyName) {
    const fifths = KEY_SIGNATURES[keyName] || 0;
    const useFlatSpelling = fifths < 0;

    const noteIndex = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;

    // Natural notes
    const naturalNotes = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };
    if (naturalNotes[noteIndex] !== undefined) {
        return { step: naturalNotes[noteIndex], octave, alter: 0 };
    }

    // Accidental notes - choose sharp or flat based on key
    if (useFlatSpelling) {
        const flatMap = { 1: 'D', 3: 'E', 6: 'G', 8: 'A', 10: 'B' };
        return { step: flatMap[noteIndex], octave, alter: -1 };
    } else {
        const sharpMap = { 1: 'C', 3: 'D', 6: 'F', 8: 'G', 10: 'A' };
        return { step: sharpMap[noteIndex], octave, alter: 1 };
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.ScaleData = {
        CHROMATIC_NOTES,
        ENHARMONIC_MAP,
        CIRCLE_OF_FIFTHS,
        KEY_SIGNATURES,
        SCALE_INTERVALS,
        ARPEGGIO_INTERVALS,
        ETUDE_PATTERNS,
        INSTRUMENT_CONFIG,
        midiToPitch,
        noteNameToMidiBase,
        midiToPitchInKey,
        getKeySignatureFifths
    };
}

// Export for Node.js tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CHROMATIC_NOTES,
        ENHARMONIC_MAP,
        CIRCLE_OF_FIFTHS,
        KEY_SIGNATURES,
        SCALE_INTERVALS,
        ARPEGGIO_INTERVALS,
        ETUDE_PATTERNS,
        INSTRUMENT_CONFIG,
        midiToPitch,
        noteNameToMidiBase,
        midiToPitchInKey,
        getKeySignatureFifths
    };
}