import { describe, it, expect } from 'vitest'
import { parseMusicXML } from '../MusicXMLParser'

// ---------------------------------------------------------------------------
// Minimal MusicXML test fixture
// ---------------------------------------------------------------------------
const SIMPLE_SCORE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Test Piece</work-title></work>
  <identification><creator type="composer">Test Composer</creator></identification>
  <part-list><score-part id="P1"><part-name>Violin</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>F</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>`

const TWO_MEASURE_SCORE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Two Measures</work-title></work>
  <part-list><score-part id="P1"><part-name>Cello</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>2</fifths></key>
        <time><beats>3</beats><beat-type>4</beat-type></time>
        <clef><sign>F</sign><line>4</line></clef>
      </attributes>
      <note>
        <pitch><step>G</step><octave>3</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>A</step><octave>3</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>B</step><octave>3</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
    </measure>
    <measure number="2">
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>half</type>
      </note>
      <note>
        <rest/>
        <duration>1</duration>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>`

const ACCIDENTALS_SCORE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Sharps and Flats</work-title></work>
  <part-list><score-part id="P1"><part-name>Viola</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>-3</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>C</sign><line>3</line></clef>
      </attributes>
      <note>
        <pitch><step>F</step><alter>1</alter><octave>4</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>B</step><alter>-1</alter><octave>3</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>2</duration>
        <type>half</type>
      </note>
    </measure>
  </part>
</score-partwise>`

const DYNAMICS_SCORE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Dynamics Test</work-title></work>
  <part-list><score-part id="P1"><part-name>Violin</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <direction>
        <direction-type><dynamics><f/></dynamics></direction-type>
      </direction>
      <note>
        <pitch><step>C</step><octave>5</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <direction>
        <direction-type><wedge type="crescendo"/></direction-type>
      </direction>
      <note>
        <pitch><step>D</step><octave>5</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>E</step><octave>5</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>F</step><octave>5</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>`

const ARTICULATIONS_SCORE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Articulations Test</work-title></work>
  <part-list><score-part id="P1"><part-name>Violin</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>5</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
        <notations>
          <articulations><staccato/></articulations>
        </notations>
      </note>
      <note>
        <pitch><step>D</step><octave>5</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
        <notations>
          <articulations><accent/></articulations>
        </notations>
      </note>
      <note>
        <pitch><step>E</step><octave>5</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
      <note>
        <pitch><step>F</step><octave>5</octave></pitch>
        <duration>1</duration>
        <type>quarter</type>
      </note>
    </measure>
  </part>
</score-partwise>`

const DOT_SCORE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Dotted Notes</work-title></work>
  <part-list><score-part id="P1"><part-name>Violin</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>3</duration>
        <type>quarter</type>
        <dot/>
      </note>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>1</duration>
        <type>eighth</type>
      </note>
      <note>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>half</type>
      </note>
    </measure>
  </part>
</score-partwise>`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MusicXMLParser', () => {
  describe('parseMusicXML', () => {
    it('throws on null/undefined input', () => {
      expect(() => parseMusicXML(null)).toThrow('Invalid input')
      expect(() => parseMusicXML(undefined)).toThrow('Invalid input')
      expect(() => parseMusicXML('')).toThrow('Invalid input')
    })

    it('throws on malformed XML', () => {
      expect(() => parseMusicXML('<not-xml')).toThrow('Invalid MusicXML')
    })

    it('throws on XML with wrong root element', () => {
      expect(() => parseMusicXML('<html></html>')).toThrow('missing score element')
    })

    it('throws when no parts found', () => {
      const xml = '<score-partwise><part-list></part-list></score-partwise>'
      expect(() => parseMusicXML(xml)).toThrow('no parts found')
    })
  })

  describe('score metadata', () => {
    it('parses title and composer', () => {
      const result = parseMusicXML(SIMPLE_SCORE)
      expect(result.title).toBe('Test Piece')
      expect(result.composer).toBe('Test Composer')
    })

    it('defaults title to Untitled and composer to Unknown', () => {
      const xml = `<?xml version="1.0"?>
        <score-partwise>
          <part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list>
          <part id="P1">
            <measure number="1">
              <attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign></clef></attributes>
              <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
            </measure>
          </part>
        </score-partwise>`
      const result = parseMusicXML(xml)
      expect(result.title).toBe('Untitled')
      expect(result.composer).toBe('Unknown')
    })
  })

  describe('parts and measures', () => {
    it('parses a single part with one measure', () => {
      const result = parseMusicXML(SIMPLE_SCORE)
      expect(result.parts).toHaveLength(1)
      expect(result.parts[0].id).toBe('P1')
      expect(result.parts[0].name).toBe('Part 1')
      expect(result.parts[0].measures).toHaveLength(1)
    })

    it('parses two measures', () => {
      const result = parseMusicXML(TWO_MEASURE_SCORE)
      expect(result.parts[0].measures).toHaveLength(2)
      expect(result.parts[0].measures[0].number).toBe(1)
      expect(result.parts[0].measures[1].number).toBe(2)
    })
  })

  describe('key signatures', () => {
    it('maps fifths=0 to C major', () => {
      const result = parseMusicXML(SIMPLE_SCORE)
      expect(result.parts[0].measures[0].keySignature).toBe('C')
    })

    it('maps fifths=2 to D major', () => {
      const result = parseMusicXML(TWO_MEASURE_SCORE)
      expect(result.parts[0].measures[0].keySignature).toBe('D')
    })

    it('maps fifths=-3 to Eb major', () => {
      const result = parseMusicXML(ACCIDENTALS_SCORE)
      expect(result.parts[0].measures[0].keySignature).toBe('Eb')
    })
  })

  describe('time signatures', () => {
    it('parses 4/4 time', () => {
      const result = parseMusicXML(SIMPLE_SCORE)
      expect(result.parts[0].measures[0].timeSignature).toBe('4/4')
    })

    it('parses 3/4 time', () => {
      const result = parseMusicXML(TWO_MEASURE_SCORE)
      expect(result.parts[0].measures[0].timeSignature).toBe('3/4')
    })
  })

  describe('clefs', () => {
    it('parses treble clef (G)', () => {
      const result = parseMusicXML(SIMPLE_SCORE)
      expect(result.parts[0].measures[0].clef).toBe('treble')
    })

    it('parses bass clef (F)', () => {
      const result = parseMusicXML(TWO_MEASURE_SCORE)
      expect(result.parts[0].measures[0].clef).toBe('bass')
    })

    it('parses alto clef (C on line 3)', () => {
      const result = parseMusicXML(ACCIDENTALS_SCORE)
      expect(result.parts[0].measures[0].clef).toBe('alto')
    })
  })

  describe('notes', () => {
    it('parses four quarter notes', () => {
      const result = parseMusicXML(SIMPLE_SCORE)
      const notes = result.parts[0].measures[0].notes
      expect(notes).toHaveLength(4)
      expect(notes[0].keys).toEqual(['c/4'])
      expect(notes[1].keys).toEqual(['d/4'])
      expect(notes[2].keys).toEqual(['e/4'])
      expect(notes[3].keys).toEqual(['f/4'])
    })

    it('uses VexFlow duration format', () => {
      const result = parseMusicXML(SIMPLE_SCORE)
      const notes = result.parts[0].measures[0].notes
      notes.forEach((n) => expect(n.duration).toBe('q'))
    })

    it('parses half notes', () => {
      const result = parseMusicXML(TWO_MEASURE_SCORE)
      const notes = result.parts[0].measures[1].notes
      expect(notes[0].duration).toBe('h')
    })

    it('marks rests correctly', () => {
      const result = parseMusicXML(TWO_MEASURE_SCORE)
      const notes = result.parts[0].measures[1].notes
      expect(notes[1].isRest).toBe(true)
      expect(notes[1].duration).toBe('qr')
    })
  })

  describe('accidentals', () => {
    it('parses sharp (alter=1)', () => {
      const result = parseMusicXML(ACCIDENTALS_SCORE)
      const notes = result.parts[0].measures[0].notes
      expect(notes[0].keys).toEqual(['f#/4'])
      expect(notes[0].accidentals).toEqual([{ index: 0, type: '#' }])
    })

    it('parses flat (alter=-1)', () => {
      const result = parseMusicXML(ACCIDENTALS_SCORE)
      const notes = result.parts[0].measures[0].notes
      expect(notes[1].keys).toEqual(['bb/3'])
      expect(notes[1].accidentals).toEqual([{ index: 0, type: 'b' }])
    })

    it('no accidentals for natural notes', () => {
      const result = parseMusicXML(ACCIDENTALS_SCORE)
      const notes = result.parts[0].measures[0].notes
      expect(notes[2].accidentals).toBeUndefined()
    })
  })

  describe('dynamics', () => {
    it('parses forte marking', () => {
      const result = parseMusicXML(DYNAMICS_SCORE)
      const dynamics = result.parts[0].measures[0].dynamics
      expect(dynamics.length).toBeGreaterThanOrEqual(1)
      expect(dynamics[0]).toMatchObject({ category: 'dynamic', type: 'f' })
    })

    it('parses crescendo wedge', () => {
      const result = parseMusicXML(DYNAMICS_SCORE)
      const dynamics = result.parts[0].measures[0].dynamics
      const wedge = dynamics.find((d) => d.category === 'wedge')
      expect(wedge).toBeDefined()
      expect(wedge.type).toBe('crescendo')
    })

    it('attaches dynamic to notes', () => {
      const result = parseMusicXML(DYNAMICS_SCORE)
      const notes = result.parts[0].measures[0].notes
      expect(notes[0].dynamic).toBe('f')
    })
  })

  describe('articulations', () => {
    it('parses staccato', () => {
      const result = parseMusicXML(ARTICULATIONS_SCORE)
      const notes = result.parts[0].measures[0].notes
      expect(notes[0].articulations).toContain('a.')
    })

    it('parses accent', () => {
      const result = parseMusicXML(ARTICULATIONS_SCORE)
      const notes = result.parts[0].measures[0].notes
      expect(notes[1].articulations).toContain('a>')
    })

    it('note without articulation has empty array', () => {
      const result = parseMusicXML(ARTICULATIONS_SCORE)
      const notes = result.parts[0].measures[0].notes
      expect(notes[2].articulations).toEqual([])
    })
  })

  describe('dotted notes', () => {
    it('adds d suffix to dotted note duration', () => {
      const result = parseMusicXML(DOT_SCORE)
      const notes = result.parts[0].measures[0].notes
      expect(notes[0].duration).toBe('qd')
    })

    it('non-dotted notes have plain duration', () => {
      const result = parseMusicXML(DOT_SCORE)
      const notes = result.parts[0].measures[0].notes
      expect(notes[1].duration).toBe('8')
      expect(notes[2].duration).toBe('h')
    })
  })
})
