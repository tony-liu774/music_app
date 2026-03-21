/**
 * MusicXML Parser
 * Converts MusicXML format to internal Score model
 */

class MusicXMLParser {
    constructor() {
        this.parser = new DOMParser();
        this.divisions = 1; // ticks per quarter note, updated during parsing
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
        this.divisions = parseInt(doc.querySelector('divisions')?.textContent) || 1;
        score.divisions = this.divisions;

        // Parse parts
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

        // Parse attributes (clef, key, time, divisions)
        const attributes = measureElement.querySelector('attributes');
        if (attributes) {
            // Update divisions if redefined in this measure
            const divisionsEl = attributes.querySelector('divisions');
            if (divisionsEl) {
                this.divisions = parseInt(divisionsEl.textContent) || this.divisions;
            }

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

        // Parse direction elements (dynamics, wedges/hairpins, techniques)
        let currentDynamic = null;
        let currentTechnique = null;
        const directions = measureElement.querySelectorAll('direction');
        directions.forEach(dirElement => {
            const parsed = this.parseDirection(dirElement, measureNumber, this.divisions);
            if (parsed) {
                if (parsed.category === 'dynamic') {
                    measure.dynamics.push(parsed);
                    currentDynamic = parsed.type;
                } else if (parsed.category === 'wedge') {
                    measure.dynamics.push(parsed);
                } else if (parsed.category === 'technique') {
                    measure.articulations.push(parsed);
                    currentTechnique = parsed.type;
                }
            }
        });

        // Parse notes
        const notes = measureElement.querySelectorAll('note, rest, chord');
        let currentBeat = 0;

        notes.forEach(noteElement => {
            if (noteElement.tagName === 'rest') {
                const duration = parseInt(noteElement.querySelector('duration')?.textContent) || 0;
                const rest = new Rest(duration / this.divisions, { measure: measureNumber, beat: currentBeat });
                measure.rests.push(rest);
                currentBeat += duration / this.divisions;
            } else if (noteElement.tagName === 'note') {
                const note = this.parseNote(noteElement, measureNumber, currentBeat);
                if (note) {
                    // Apply current dynamic marking to note
                    if (currentDynamic) {
                        note.dynamic = currentDynamic;
                    }

                    // Check for wedge (crescendo/decrescendo) context
                    for (const dyn of measure.dynamics) {
                        if (dyn.category === 'wedge' && dyn.beat !== undefined && currentBeat >= dyn.beat) {
                            // wedge-stop ends the hairpin — clear direction rather than tagging notes with 'wedge-stop'
                            note.dynamicDirection = dyn.type === 'wedge-stop' ? null : dyn.type;
                        }
                    }

                    // Apply current technique (e.g., pizzicato from text direction)
                    if (currentTechnique && !note.articulation) {
                        note.articulation = currentTechnique;
                    }

                    measure.notes.push(note);
                    const duration = parseInt(noteElement.querySelector('duration')?.textContent) || this.divisions;
                    currentBeat += duration / this.divisions;
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

        const duration = parseInt(noteElement.querySelector('duration')?.textContent) || this.divisions;

        const note = new Note(
            { step, octave, alter },
            duration / this.divisions,
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

        // Parse articulations from notations element
        const notations = noteElement.querySelector('notations');
        if (notations) {
            this.parseArticulations(notations, note);
            this.parseNoteDynamics(notations, note);
        }

        return note;
    }

    /**
     * Parse articulation markings from notations element
     * @param {Element} notationsElement - MusicXML notations element
     * @param {Note} note - Note to attach articulations to
     */
    parseArticulations(notationsElement, note) {
        const articulationsEl = notationsElement.querySelector('articulations');
        if (articulationsEl) {
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
                    // Set primary articulation to the first one found
                    if (!note.articulation) {
                        note.articulation = artType;
                    }
                }
            }
        }

        // Check for pizzicato in technical element (independent of articulations)
        const technical = notationsElement.querySelector('technical');
        if (technical && technical.querySelector('snap-pizzicato, pizzicato')) {
            note.articulation = 'pizzicato';
            note.accents.push('pizzicato');
        }
    }

    /**
     * Parse note-level dynamics from notations element
     * @param {Element} notationsElement - MusicXML notations element
     * @param {Note} note - Note to attach dynamics to
     */
    parseNoteDynamics(notationsElement, note) {
        const dynamicsEl = notationsElement.querySelector('dynamics');
        if (!dynamicsEl) return;

        const dynamicTypes = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'fp', 'sf', 'sfz'];
        for (const type of dynamicTypes) {
            if (dynamicsEl.querySelector(type)) {
                note.dynamic = type;
                break;
            }
        }
    }

    /**
     * Parse direction elements (dynamics, wedges/hairpins)
     * @param {Element} dirElement - MusicXML direction element
     * @param {number} measureNumber - Current measure number
     * @returns {Object|null} Parsed direction data
     */
    parseDirection(dirElement, measureNumber, divisions = 1) {
        const dirType = dirElement.querySelector('direction-type');
        if (!dirType) return null;

        // Compute beat from <offset> element if present (offset is in divisions)
        const offsetEl = dirElement.querySelector('offset');
        const beat = offsetEl ? parseInt(offsetEl.textContent) / divisions : 0;

        // Parse dynamic markings (p, mp, mf, f, ff, etc.)
        const dynamicsEl = dirType.querySelector('dynamics');
        if (dynamicsEl) {
            const dynamicTypes = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'fp', 'sf', 'sfz'];
            for (const type of dynamicTypes) {
                if (dynamicsEl.querySelector(type)) {
                    return {
                        category: 'dynamic',
                        type: type,
                        measure: measureNumber,
                        beat
                    };
                }
            }
        }

        // Parse wedge (crescendo/decrescendo hairpins)
        const wedge = dirType.querySelector('wedge');
        if (wedge) {
            const wedgeType = wedge.getAttribute('type');
            if (wedgeType === 'crescendo') {
                return {
                    category: 'wedge',
                    type: 'crescendo',
                    measure: measureNumber,
                    beat
                };
            } else if (wedgeType === 'diminuendo' || wedgeType === 'decrescendo') {
                return {
                    category: 'wedge',
                    type: 'decrescendo',
                    measure: measureNumber,
                    beat
                };
            } else if (wedgeType === 'stop') {
                return {
                    category: 'wedge',
                    type: 'wedge-stop',
                    measure: measureNumber,
                    beat
                };
            }
        }

        // Parse words like "pizz.", "arco", "cresc.", "dim."
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
if (typeof window !== 'undefined') {
    window.MusicXMLParser = MusicXMLParser;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MusicXMLParser };
}