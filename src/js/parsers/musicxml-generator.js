/**
 * MusicXML Generator
 * Programmatically generates MusicXML from scale/arpeggio note data.
 * No external API calls - pure client-side generation.
 */

class MusicXMLGenerator {
    constructor() {
        this.divisions = 1; // ticks per quarter note
    }

    /**
     * Generate a complete MusicXML string from scale parameters
     * @param {Object} params
     * @param {string} params.title - Score title
     * @param {Array<Object>} params.notes - Array of { step, octave, alter, duration }
     * @param {string} params.clef - 'G', 'C', or 'F'
     * @param {number} params.clefLine - Clef line number
     * @param {number} params.fifths - Key signature fifths value
     * @param {string} params.mode - 'major' or 'minor'
     * @param {number} params.tempo - BPM
     * @param {number} params.beats - Time signature numerator
     * @param {number} params.beatType - Time signature denominator
     * @returns {string} MusicXML document string
     */
    generate(params) {
        const {
            title = 'Scale Exercise',
            notes = [],
            clef = 'G',
            clefLine = 2,
            fifths = 0,
            mode = 'major',
            tempo = 120,
            beats = 4,
            beatType = 4
        } = params;

        const measures = this.groupNotesIntoMeasures(notes, beats, beatType);
        const measuresXml = measures.map((measureNotes, index) => {
            return this.generateMeasure(measureNotes, index + 1, index === 0 ? {
                clef, clefLine, fifths, mode, beats, beatType, tempo
            } : null);
        }).join('\n');

        return this.wrapInScore(title, measuresXml);
    }

    /**
     * Group notes into measures based on time signature
     */
    groupNotesIntoMeasures(notes, beats, beatType) {
        const beatsPerMeasure = beats * (4 / beatType);
        const measures = [];
        let currentMeasure = [];
        let currentBeats = 0;

        for (const note of notes) {
            const duration = note.duration || 1;
            if (currentBeats + duration > beatsPerMeasure && currentMeasure.length > 0) {
                measures.push(currentMeasure);
                currentMeasure = [];
                currentBeats = 0;
            }
            currentMeasure.push(note);
            currentBeats += duration;

            if (currentBeats >= beatsPerMeasure) {
                measures.push(currentMeasure);
                currentMeasure = [];
                currentBeats = 0;
            }
        }

        if (currentMeasure.length > 0) {
            measures.push(currentMeasure);
        }

        return measures;
    }

    /**
     * Generate XML for a single measure
     */
    generateMeasure(notes, measureNumber, attributes) {
        let xml = `      <measure number="${measureNumber}">\n`;

        if (attributes) {
            xml += this.generateAttributes(attributes);
            xml += this.generateDirection(attributes.tempo);
        }

        for (const note of notes) {
            xml += this.generateNote(note);
        }

        if (measureNumber === -1) {
            xml += '        <barline location="right">\n';
            xml += '          <bar-style>light-heavy</bar-style>\n';
            xml += '        </barline>\n';
        }

        xml += '      </measure>\n';
        return xml;
    }

    /**
     * Generate attributes element (clef, key, time, divisions)
     */
    generateAttributes(attrs) {
        let xml = '        <attributes>\n';
        xml += `          <divisions>${this.divisions}</divisions>\n`;
        xml += '          <key>\n';
        xml += `            <fifths>${attrs.fifths}</fifths>\n`;
        xml += `            <mode>${attrs.mode}</mode>\n`;
        xml += '          </key>\n';
        xml += '          <time>\n';
        xml += `            <beats>${attrs.beats}</beats>\n`;
        xml += `            <beat-type>${attrs.beatType}</beat-type>\n`;
        xml += '          </time>\n';
        xml += '          <clef>\n';
        xml += `            <sign>${attrs.clef}</sign>\n`;
        xml += `            <line>${attrs.clefLine}</line>\n`;
        xml += '          </clef>\n';
        xml += '        </attributes>\n';
        return xml;
    }

    /**
     * Generate tempo direction element
     */
    generateDirection(tempo) {
        let xml = '        <direction placement="above">\n';
        xml += '          <direction-type>\n';
        xml += `            <metronome>\n`;
        xml += '              <beat-unit>quarter</beat-unit>\n';
        xml += `              <per-minute>${tempo}</per-minute>\n`;
        xml += '            </metronome>\n';
        xml += '          </direction-type>\n';
        xml += `          <sound tempo="${tempo}"/>\n`;
        xml += '        </direction>\n';
        return xml;
    }

    /**
     * Generate a single note element
     */
    generateNote(note) {
        const durationTicks = Math.round(note.duration * this.divisions);
        const noteType = this.durationToType(note.duration);

        let xml = '        <note>\n';
        xml += '          <pitch>\n';
        xml += `            <step>${note.step}</step>\n`;
        if (note.alter && note.alter !== 0) {
            xml += `            <alter>${note.alter}</alter>\n`;
        }
        xml += `            <octave>${note.octave}</octave>\n`;
        xml += '          </pitch>\n';
        xml += `          <duration>${durationTicks}</duration>\n`;
        xml += `          <type>${noteType}</type>\n`;
        xml += '        </note>\n';
        return xml;
    }

    /**
     * Convert beat duration to MusicXML type name
     */
    durationToType(duration) {
        if (duration >= 4) return 'whole';
        if (duration >= 2) return 'half';
        if (duration >= 1) return 'quarter';
        if (duration >= 0.5) return 'eighth';
        if (duration >= 0.25) return '16th';
        if (duration >= 0.125) return '32nd';
        return '64th';
    }

    /**
     * Wrap measures in full MusicXML score-partwise document
     */
    wrapInScore(title, measuresXml) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>${this.escapeXml(title)}</work-title>
  </work>
  <identification>
    <creator type="composer">Scale Engine</creator>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Scale Exercise</part-name>
    </score-part>
  </part-list>
  <part id="P1">
${measuresXml}  </part>
</score-partwise>`;
    }

    /**
     * Escape special XML characters
     */
    escapeXml(str) {
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&apos;');
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.MusicXMLGenerator = MusicXMLGenerator;
}

// Export for Node.js tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MusicXMLGenerator };
}