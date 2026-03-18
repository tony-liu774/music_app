/**
 * MusicXML Parser
 * Converts MusicXML format to internal Score model
 */

class MusicXMLParser {
    constructor() {
        this.parser = new DOMParser();
    }

    parse(xmlString) {
        try {
            if (!xmlString || typeof xmlString !== 'string') {
                throw new Error('Invalid input: expected a non-empty string');
            }

            const doc = this.parser.parseFromString(xmlString, 'text/xml');

            // Check for parsing errors
            const parseError = doc.querySelector('parsererror');
            if (parseError) {
                const errorText = parseError.textContent || 'XML parsing failed';
                throw new Error('Invalid MusicXML: ' + errorText.substring(0, 100));
            }

            // Validate root element
            const root = doc.documentElement;
            if (!root || !root.tagName.includes('score')) {
                throw new Error('Invalid MusicXML: missing score element');
            }

            return this.parseDocument(doc);
        } catch (error) {
            console.error('MusicXML parsing error:', error);
            throw new Error('Failed to parse MusicXML: ' + error.message);
        }
    }

    parseDocument(doc) {
        try {
            // Get score metadata
            const identification = doc.querySelector('identification');
            const title = doc.querySelector('work-title, movement-title')?.textContent || 'Untitled';
            const composer = identification?.querySelector('creator')?.textContent || 'Unknown';

            // Validate we have at least one part
            const parts = doc.querySelectorAll('part');
            if (parts.length === 0) {
                throw new Error('Invalid MusicXML: no parts found in score');
            }

        // Create score
        const score = new Score(title, composer);

        // Get divisions (ticks per quarter note)
        const partList = doc.querySelector('part-list');
        score.divisions = parseInt(doc.querySelector('divisions')?.textContent) || 1;

        // Parse parts
        const parts = doc.querySelectorAll('part');
        parts.forEach((partElement, index) => {
            const part = this.parsePart(partElement, index);
            score.addPart(part);
        });

        return score;
    }

    parsePart(partElement, index) {
        const partId = partElement.getAttribute('id') || `part-${index}`;
        const partName = partElement.querySelector('part-name')?.textContent || `Part ${index + 1}`;

        const part = new Part(partId, partName);

        // Parse measures
        const measures = partElement.querySelectorAll('measure');
        measures.forEach((measureElement, measureIndex) => {
            const measure = this.parseMeasure(measureElement, measureIndex + 1);
            part.addMeasure(measure);
        });

        return part;
    }

    parseMeasure(measureElement, measureNumber) {
        const measure = new Measure(measureNumber);

        // Parse attributes (clef, key, time)
        const attributes = measureElement.querySelector('attributes');
        if (attributes) {
            // Key signature
            const key = attributes.querySelector('key');
            if (key) {
                measure.key.fifths = parseInt(key.querySelector('fifths')?.textContent) || 0;
                measure.key.mode = key.querySelector('mode')?.textContent || 'major';
            }

            // Time signature
            const time = attributes.querySelector('time');
            if (time) {
                measure.timeSignature.beats = parseInt(time.querySelector('beats')?.textContent) || 4;
                measure.timeSignature.beatType = parseInt(time.querySelector('beat-type')?.textContent) || 4;
            }

            // Clef
            const clef = attributes.querySelector('clef');
            if (clef) {
                const sign = clef.querySelector('sign')?.textContent;
                measure.clef = this.mapClef(sign);
            }
        }

        // Parse notes
        const notes = measureElement.querySelectorAll('note, rest, chord');
        let currentBeat = 0;

        notes.forEach(noteElement => {
            if (noteElement.tagName === 'rest') {
                const duration = parseInt(noteElement.querySelector('duration')?.textContent) || 0;
                const rest = new Rest(duration / 480, { measure: measureNumber, beat: currentBeat });
                measure.rests.push(rest);
                currentBeat += duration / 480;
            } else if (noteElement.tagName === 'note') {
                const note = this.parseNote(noteElement, measureNumber, currentBeat);
                if (note) {
                    measure.notes.push(note);
                    const duration = parseInt(noteElement.querySelector('duration')?.textContent) || 480;
                    currentBeat += duration / 480;
                }
            }
        });

        return measure;
    }

    parseNote(noteElement, measureNumber, beatPosition) {
        const pitchElement = noteElement.querySelector('pitch');
        if (!pitchElement) return null; // Skip grace notes etc

        const step = pitchElement.querySelector('step')?.textContent;
        const octave = parseInt(pitchElement.querySelector('octave')?.textContent);
        const alter = parseInt(pitchElement.querySelector('alter')?.textContent) || 0;

        const duration = parseInt(noteElement.querySelector('duration')?.textContent) || 480;

        const note = new Note(
            { step, octave, alter },
            duration / 480,
            { measure: measureNumber, beat: beatPosition }
        );

        // Type (whole, half, quarter, etc.)
        const typeElement = noteElement.querySelector('type');
        if (typeElement) {
            note.duration = this.mapDuration(typeElement.textContent);
        }

        // Dot
        if (noteElement.querySelector('dot')) {
            note.dot = true;
        }

        // Tie
        const tie = noteElement.querySelector('tie');
        if (tie) {
            note.tie = tie.getAttribute('type');
        }

        return note;
    }

    mapClef(sign) {
        const clefMap = {
            'G': 'treble',
            'F': 'bass',
            'C': 'alto',
            'G2': 'treble',
            'F4': 'bass',
            'C3': 'alto',
            'C4': 'tenor'
        };
        return clefMap[sign] || 'treble';
    }

    mapDuration(type) {
        const durationMap = {
            'whole': 4,
            'half': 2,
            'quarter': 1,
            'eighth': 0.5,
            '16th': 0.25,
            '32nd': 0.125,
            '64th': 0.0625
        };
        return durationMap[type] || 1;
    }
}

// Export
window.MusicXMLParser = MusicXMLParser;