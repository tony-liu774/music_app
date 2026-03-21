/**
 * Scale Engine - Procedural Warm-Up Generator
 * Generates scales, arpeggios, and etude patterns for string instruments.
 * Produces Score objects compatible with the sheet music renderer and analysis pipeline.
 */

class ScaleEngine {
    constructor() {
        // Load dependencies
        this.scaleData = typeof window !== 'undefined' ? window.ScaleData : require('../models/scale-data');
        this.generatorClass = typeof window !== 'undefined' ? window.MusicXMLGenerator : require('../parsers/musicxml-generator').MusicXMLGenerator;
        this.xmlGenerator = new this.generatorClass();

        // Current configuration
        this.config = {
            instrument: 'violin',
            key: 'C',
            scaleType: 'major',       // major, natural_minor, harmonic_minor, melodic_minor
            exerciseType: 'scale',    // scale, arpeggio, etude
            arpeggioType: 'major',    // major, minor, diminished, augmented
            etudePattern: 'thirds',   // thirds, sixths, octaves, broken_thirds, chromatic
            octaves: 2,
            tempo: 80,
            noteDuration: 1           // 1 = quarter, 0.5 = eighth
        };

        // Callbacks
        this.onScoreGenerated = null;
        this.onConfigChange = null;
    }

    /**
     * Set configuration with validation
     */
    setConfig(newConfig) {
        if (newConfig.instrument && !this.scaleData.INSTRUMENT_CONFIG[newConfig.instrument]) {
            throw new Error(`Unknown instrument: ${newConfig.instrument}`);
        }
        if (newConfig.key && this.scaleData.KEY_SIGNATURES[newConfig.key] === undefined) {
            throw new Error(`Unknown key: ${newConfig.key}`);
        }
        const validated = { ...newConfig };
        if (validated.tempo !== undefined) {
            validated.tempo = Math.max(40, Math.min(200, validated.tempo));
        }
        if (validated.octaves !== undefined) {
            validated.octaves = Math.max(1, Math.min(3, validated.octaves));
        }
        Object.assign(this.config, validated);
        if (this.onConfigChange) {
            this.onConfigChange(this.config);
        }
    }

    /**
     * Get the current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Generate a warm-up exercise based on current configuration
     * @returns {Object} { score: Score, musicxml: string, notes: Array }
     */
    generate() {
        const { exerciseType } = this.config;
        let notes;

        switch (exerciseType) {
            case 'scale':
                notes = this.generateScale();
                break;
            case 'arpeggio':
                notes = this.generateArpeggio();
                break;
            case 'etude':
                notes = this.generateEtude();
                break;
            default:
                notes = this.generateScale();
        }

        const instrumentConfig = this.scaleData.INSTRUMENT_CONFIG[this.config.instrument];
        if (!instrumentConfig) {
            throw new Error(`Unknown instrument: ${this.config.instrument}`);
        }
        const title = this.getExerciseTitle();
        const isMinor = this.config.scaleType.includes('minor') ||
            (this.config.exerciseType === 'arpeggio' && this.config.arpeggioType === 'minor');
        const fifths = this.scaleData.getKeySignatureFifths(this.config.key, isMinor);

        const musicxml = this.xmlGenerator.generate({
            title,
            notes,
            clef: instrumentConfig.clef,
            clefLine: instrumentConfig.clefLine,
            fifths,
            mode: isMinor ? 'minor' : 'major',
            tempo: this.config.tempo,
            beats: 4,
            beatType: 4
        });

        const score = this.buildScore(title, notes, instrumentConfig, fifths, isMinor);

        if (this.onScoreGenerated) {
            this.onScoreGenerated({ score, musicxml, notes });
        }

        return { score, musicxml, notes };
    }

    /**
     * Generate scale notes ascending and descending
     */
    generateScale() {
        const { key, scaleType, octaves } = this.config;
        const intervals = this.scaleData.SCALE_INTERVALS[scaleType];
        if (!intervals) return [];

        const rootMidi = this.getRootMidi();
        const ascending = this.buildNoteSequence(rootMidi, intervals, octaves, key);

        // Descending: reverse without duplicating the top note
        let descending;
        if (scaleType === 'melodic_minor') {
            // Melodic minor descends using natural minor intervals
            const descendIntervals = this.scaleData.SCALE_INTERVALS.natural_minor;
            const descendNotes = this.buildNoteSequence(rootMidi, descendIntervals, octaves, key);
            descending = descendNotes.slice(0, -1).reverse();
        } else {
            descending = ascending.slice(0, -1).reverse();
        }

        return [...ascending, ...descending];
    }

    /**
     * Generate arpeggio notes ascending and descending
     */
    generateArpeggio() {
        const { key, arpeggioType, octaves } = this.config;
        const intervals = this.scaleData.ARPEGGIO_INTERVALS[arpeggioType];
        if (!intervals) return [];

        const rootMidi = this.getRootMidi();
        const ascending = this.buildNoteSequence(rootMidi, intervals, octaves, key);
        const descending = ascending.slice(0, -1).reverse();

        return [...ascending, ...descending];
    }

    /**
     * Generate etude pattern notes
     */
    generateEtude() {
        const { key, scaleType, etudePattern, octaves } = this.config;
        const scaleIntervals = this.scaleData.SCALE_INTERVALS[scaleType] || this.scaleData.SCALE_INTERVALS.major;
        const pattern = this.scaleData.ETUDE_PATTERNS[etudePattern];
        if (!pattern) return [];

        const rootMidi = this.getRootMidi();

        // Build the full scale over the octave range
        const fullScale = [];
        for (let oct = 0; oct < octaves; oct++) {
            for (const interval of scaleIntervals) {
                fullScale.push(rootMidi + interval + (oct * 12));
            }
        }
        // Add the top note
        fullScale.push(rootMidi + (octaves * 12));

        // Chromatic pattern is a special case
        if (etudePattern === 'chromatic') {
            return this.generateChromaticPattern(rootMidi, octaves, key);
        }

        // Shifts pattern: play scale from each position (simulating position shifts)
        if (pattern.shift) {
            return this.generateShiftPattern(fullScale, key, pattern);
        }

        // Double stops: play pairs of notes (thirds) simultaneously
        if (pattern.doubleStop) {
            return this.generateDoubleStopPattern(fullScale, key, pattern);
        }

        // Apply the pattern indices to the scale in complete pairs (no orphan notes)
        const notes = [];
        const patternIndices = pattern.intervals;
        const maxIndex = fullScale.length - 1;

        for (let offset = 0; offset <= maxIndex; offset++) {
            // Process pattern in pairs to avoid orphan notes at boundaries
            for (let p = 0; p + 1 < patternIndices.length; p += 2) {
                const idx1 = offset + patternIndices[p];
                const idx2 = offset + patternIndices[p + 1];
                if (idx1 <= maxIndex && idx2 <= maxIndex) {
                    const pitch1 = this.scaleData.midiToPitchInKey(fullScale[idx1], key);
                    const pitch2 = this.scaleData.midiToPitchInKey(fullScale[idx2], key);
                    notes.push({ ...pitch1, duration: this.config.noteDuration });
                    notes.push({ ...pitch2, duration: this.config.noteDuration });
                }
            }
            // Handle odd-length patterns (emit the last index only if in range)
            if (patternIndices.length % 2 === 1) {
                const lastIdx = offset + patternIndices[patternIndices.length - 1];
                if (lastIdx <= maxIndex) {
                    const pitch = this.scaleData.midiToPitchInKey(fullScale[lastIdx], key);
                    notes.push({ ...pitch, duration: this.config.noteDuration });
                }
            }
        }

        return this.clampToInstrumentRange(notes);
    }

    /**
     * Generate chromatic scale pattern
     */
    generateChromaticPattern(rootMidi, octaves, key) {
        const notes = [];
        const totalSemitones = octaves * 12;

        // Ascending chromatic
        for (let i = 0; i <= totalSemitones; i++) {
            const midi = rootMidi + i;
            const pitch = this.scaleData.midiToPitchInKey(midi, key);
            notes.push({ ...pitch, duration: this.config.noteDuration });
        }

        // Descending chromatic (skip top note to avoid repeat)
        for (let i = totalSemitones - 1; i >= 0; i--) {
            const midi = rootMidi + i;
            const pitch = this.scaleData.midiToPitchInKey(midi, key);
            notes.push({ ...pitch, duration: this.config.noteDuration });
        }

        return this.clampToInstrumentRange(notes);
    }

    /**
     * Generate shift pattern - plays scale fragments starting from successive positions
     * Simulates left-hand position shifts on a string instrument
     */
    generateShiftPattern(fullScale, key, pattern) {
        const notes = [];
        const fragmentSize = pattern.intervals.length;
        for (let pos = 0; pos + fragmentSize <= fullScale.length; pos++) {
            for (let i = 0; i < fragmentSize; i++) {
                const midi = fullScale[pos + i];
                const pitch = this.scaleData.midiToPitchInKey(midi, key);
                notes.push({ ...pitch, duration: this.config.noteDuration });
            }
        }
        return this.clampToInstrumentRange(notes);
    }

    /**
     * Generate double stop pattern - pairs of notes at a given interval apart
     * Each pair is written as two sequential notes (bottom then top)
     */
    generateDoubleStopPattern(fullScale, key, pattern) {
        const notes = [];
        const interval = pattern.intervals[1]; // scale degree interval between notes
        for (let i = 0; i + interval < fullScale.length; i++) {
            const lowerMidi = fullScale[i];
            const upperMidi = fullScale[i + interval];
            const lowerPitch = this.scaleData.midiToPitchInKey(lowerMidi, key);
            const upperPitch = this.scaleData.midiToPitchInKey(upperMidi, key);
            notes.push({ ...lowerPitch, duration: this.config.noteDuration });
            notes.push({ ...upperPitch, duration: this.config.noteDuration });
        }
        return this.clampToInstrumentRange(notes);
    }

    /**
     * Build a note sequence from MIDI root, intervals, and octave count
     */
    buildNoteSequence(rootMidi, intervals, octaves, key) {
        const notes = [];
        for (let oct = 0; oct < octaves; oct++) {
            for (const interval of intervals) {
                const midi = rootMidi + interval + (oct * 12);
                const pitch = this.scaleData.midiToPitchInKey(midi, key);
                notes.push({ ...pitch, duration: this.config.noteDuration });
            }
        }
        // Add final top note
        const topMidi = rootMidi + (octaves * 12);
        const topPitch = this.scaleData.midiToPitchInKey(topMidi, key);
        notes.push({ ...topPitch, duration: this.config.noteDuration });

        return this.clampToInstrumentRange(notes);
    }

    /**
     * Get the starting MIDI note for the current key and instrument
     */
    getRootMidi() {
        const instrumentConfig = this.scaleData.INSTRUMENT_CONFIG[this.config.instrument];
        const keyBase = this.scaleData.noteNameToMidiBase(this.config.key);

        // Find the lowest occurrence of the key root that's within instrument range
        let midi = keyBase + 12; // Start at octave 0
        while (midi < instrumentConfig.lowestMidi) {
            midi += 12;
        }
        return midi;
    }

    /**
     * Clamp notes to instrument range
     */
    clampToInstrumentRange(notes) {
        const instrumentConfig = this.scaleData.INSTRUMENT_CONFIG[this.config.instrument];
        return notes.filter(note => {
            const midi = this.pitchToMidi(note);
            return midi >= instrumentConfig.lowestMidi && midi <= instrumentConfig.highestMidi;
        });
    }

    /**
     * Convert pitch object to MIDI number
     */
    pitchToMidi(pitch) {
        const steps = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
        return 12 + (steps[pitch.step] || 0) + (pitch.alter || 0) + ((pitch.octave || 4) * 12);
    }

    /**
     * Build an internal Score object from generated notes
     */
    buildScore(title, notes, instrumentConfig, fifths, isMinor) {
        // Use Score/Part/Measure/Note classes if available
        const ScoreClass = typeof Score !== 'undefined' ? Score : (typeof window !== 'undefined' ? window.Score : null);
        const PartClass = typeof Part !== 'undefined' ? Part : (typeof window !== 'undefined' ? window.Part : null);
        const MeasureClass = typeof Measure !== 'undefined' ? Measure : (typeof window !== 'undefined' ? window.Measure : null);
        const NoteClass = typeof Note !== 'undefined' ? Note : (typeof window !== 'undefined' ? window.Note : null);

        if (!ScoreClass) {
            // Fallback: return a simple object
            return {
                title,
                composer: 'Scale Engine',
                parts: [{
                    id: 'P1',
                    name: instrumentConfig.name,
                    instrument: this.config.instrument,
                    measures: this.buildSimpleMeasures(notes, fifths, isMinor)
                }],
                divisions: 1,
                tempo: this.config.tempo
            };
        }

        const score = new ScoreClass(title, 'Scale Engine');
        score.tempo = this.config.tempo;
        score.divisions = 1;

        const part = new PartClass('P1', instrumentConfig.name);
        part.instrument = this.config.instrument;

        let measureNum = 1;
        let beatInMeasure = 0;
        let currentMeasure = new MeasureClass(measureNum);
        currentMeasure.key = { fifths, mode: isMinor ? 'minor' : 'major' };
        currentMeasure.timeSignature = { beats: 4, beatType: 4 };

        for (const noteData of notes) {
            const note = new NoteClass(
                { step: noteData.step, octave: noteData.octave, alter: noteData.alter || 0 },
                noteData.duration,
                { measure: measureNum, beat: beatInMeasure }
            );

            currentMeasure.addElement(note);
            beatInMeasure += noteData.duration;

            if (beatInMeasure >= 4) {
                part.addMeasure(currentMeasure);
                measureNum++;
                beatInMeasure = 0;
                currentMeasure = new MeasureClass(measureNum);
                currentMeasure.key = { fifths, mode: isMinor ? 'minor' : 'major' };
                currentMeasure.timeSignature = { beats: 4, beatType: 4 };
            }
        }

        // Add final partial measure
        if (currentMeasure.notes.length > 0) {
            part.addMeasure(currentMeasure);
        }

        score.addPart(part);
        return score;
    }

    /**
     * Build simple measure objects (fallback when Score classes unavailable)
     */
    buildSimpleMeasures(notes, fifths, isMinor) {
        const measures = [];
        let currentNotes = [];
        let beatCount = 0;
        let measureNum = 1;

        for (const note of notes) {
            currentNotes.push({
                pitch: { step: note.step, octave: note.octave, alter: note.alter || 0 },
                duration: note.duration,
                position: { measure: measureNum, beat: beatCount },
                type: 'note'
            });
            beatCount += note.duration;

            if (beatCount >= 4) {
                measures.push({
                    number: measureNum,
                    notes: currentNotes,
                    rests: [],
                    key: { fifths, mode: isMinor ? 'minor' : 'major' },
                    timeSignature: { beats: 4, beatType: 4 }
                });
                currentNotes = [];
                beatCount = 0;
                measureNum++;
            }
        }

        if (currentNotes.length > 0) {
            measures.push({
                number: measureNum,
                notes: currentNotes,
                rests: [],
                key: { fifths, mode: isMinor ? 'minor' : 'major' },
                timeSignature: { beats: 4, beatType: 4 }
            });
        }

        return measures;
    }

    /**
     * Generate a descriptive title for the current exercise
     */
    getExerciseTitle() {
        const { key, scaleType, exerciseType, arpeggioType, etudePattern, octaves } = this.config;
        const instrumentConfig = this.scaleData.INSTRUMENT_CONFIG[this.config.instrument];

        const typeNames = {
            major: 'Major', natural_minor: 'Natural Minor',
            harmonic_minor: 'Harmonic Minor', melodic_minor: 'Melodic Minor'
        };

        switch (exerciseType) {
            case 'scale':
                return `${key} ${typeNames[scaleType] || 'Major'} Scale (${octaves} oct.) - ${instrumentConfig.name}`;
            case 'arpeggio': {
                const arpNames = { major: 'Major', minor: 'Minor', diminished: 'Diminished', augmented: 'Augmented' };
                return `${key} ${arpNames[arpeggioType] || 'Major'} Arpeggio (${octaves} oct.) - ${instrumentConfig.name}`;
            }
            case 'etude': {
                const etude = this.scaleData.ETUDE_PATTERNS[etudePattern];
                return `${key} ${etude ? etude.name : 'Etude'} Pattern - ${instrumentConfig.name}`;
            }
            default:
                return `${key} Scale Exercise - ${instrumentConfig.name}`;
        }
    }

    /**
     * Generate a circle of fifths progression
     * Returns an array of { key, score, musicxml } for each key
     */
    generateCircleOfFifths() {
        const results = [];
        const originalKey = this.config.key;

        for (const key of this.scaleData.CIRCLE_OF_FIFTHS) {
            this.setConfig({ key });
            const result = this.generate();
            results.push({ key, ...result });
        }

        this.setConfig({ key: originalKey });
        return results;
    }

    /**
     * Get available keys for display
     */
    getAvailableKeys() {
        return this.scaleData.CIRCLE_OF_FIFTHS.slice();
    }

    /**
     * Get available scale types
     */
    getScaleTypes() {
        return [
            { id: 'major', name: 'Major' },
            { id: 'natural_minor', name: 'Natural Minor' },
            { id: 'harmonic_minor', name: 'Harmonic Minor' },
            { id: 'melodic_minor', name: 'Melodic Minor' }
        ];
    }

    /**
     * Get available arpeggio types
     */
    getArpeggioTypes() {
        return [
            { id: 'major', name: 'Major' },
            { id: 'minor', name: 'Minor' },
            { id: 'diminished', name: 'Diminished' },
            { id: 'augmented', name: 'Augmented' }
        ];
    }

    /**
     * Get available etude patterns
     */
    getEtudePatterns() {
        return Object.entries(this.scaleData.ETUDE_PATTERNS).map(([id, pattern]) => ({
            id, name: pattern.name
        }));
    }

    /**
     * Get available instruments
     */
    getInstruments() {
        return Object.entries(this.scaleData.INSTRUMENT_CONFIG).map(([id, config]) => ({
            id, name: config.name
        }));
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.ScaleEngine = ScaleEngine;
}

// Export for Node.js tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ScaleEngine };
}