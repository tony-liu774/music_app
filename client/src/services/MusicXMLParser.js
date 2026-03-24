/**
 * MusicXML Parser — outputs VexFlow-compatible note data.
 *
 * Ported from src/js/parsers/musicxml-parser.js and adapted to produce
 * plain objects that can be fed directly into VexFlow's StaveNote, KeySignature,
 * TimeSignature, and Clef constructors.
 */

// Maps MusicXML fifths value to VexFlow key string
const FIFTHS_TO_KEY = {
  '-7': 'Cb',
  '-6': 'Gb',
  '-5': 'Db',
  '-4': 'Ab',
  '-3': 'Eb',
  '-2': 'Bb',
  '-1': 'F',
  0: 'C',
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
  5: 'B',
  6: 'F#',
  7: 'C#',
}

// Maps MusicXML note type to VexFlow duration string
const TYPE_TO_VEX_DURATION = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: '8',
  '16th': '16',
  '32nd': '32',
  '64th': '64',
}

// Maps MusicXML clef sign to VexFlow clef name
const CLEF_MAP = {
  G: 'treble',
  F: 'bass',
  C: 'alto',
}

// Maps MusicXML alter to VexFlow accidental string
const ALTER_TO_ACCIDENTAL = {
  '-2': 'bb',
  '-1': 'b',
  0: '',
  1: '#',
  2: '##',
}

/**
 * Parse a MusicXML string into a VexFlow-compatible score object.
 *
 * @param {string} xmlString - Raw MusicXML content
 * @returns {object} Parsed score: { title, composer, parts: [{ id, name, measures }] }
 */
export function parseMusicXML(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') {
    throw new Error('Invalid input: expected a non-empty string')
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'text/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(
      'Invalid MusicXML: ' +
        (parseError.textContent || 'XML parsing failed').substring(0, 100),
    )
  }

  const root = doc.documentElement
  if (!root || !root.tagName.includes('score')) {
    throw new Error('Invalid MusicXML: missing score element')
  }

  return parseDocument(doc)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseDocument(doc) {
  const title =
    doc.querySelector('work-title, movement-title')?.textContent || 'Untitled'
  const composer =
    doc.querySelector('identification creator')?.textContent || 'Unknown'

  const partElements = doc.querySelectorAll('part')
  if (partElements.length === 0) {
    throw new Error('Invalid MusicXML: no parts found in score')
  }

  let divisions = parseInt(doc.querySelector('divisions')?.textContent) || 1

  const parts = []
  partElements.forEach((partEl, idx) => {
    const result = parsePart(partEl, idx, divisions)
    parts.push(result.part)
    divisions = result.divisions
  })

  return { title, composer, parts }
}

function parsePart(partEl, index, divisions) {
  const id = partEl.getAttribute('id') || `part-${index}`
  const name =
    partEl.querySelector('part-name')?.textContent || `Part ${index + 1}`

  const measures = []
  const measureEls = partEl.querySelectorAll('measure')

  // Track running state across measures
  let currentClef = 'treble'
  let currentKey = 'C'
  let currentTimeNum = 4
  let currentTimeDen = 4

  measureEls.forEach((mEl, mIdx) => {
    const result = parseMeasure(mEl, mIdx + 1, divisions, {
      clef: currentClef,
      key: currentKey,
      timeNum: currentTimeNum,
      timeDen: currentTimeDen,
    })
    measures.push(result.measure)
    divisions = result.divisions

    // Carry forward attribute changes
    if (result.measure.clef) currentClef = result.measure.clef
    if (result.measure.keySignature) currentKey = result.measure.keySignature
    if (result.measure.timeSignature) {
      currentTimeNum = parseInt(result.measure.timeSignature.split('/')[0])
      currentTimeDen = parseInt(result.measure.timeSignature.split('/')[1])
    }
  })

  return { part: { id, name, measures }, divisions }
}

function parseMeasure(measureEl, measureNumber, divisions, running) {
  const measure = {
    number: measureNumber,
    notes: [], // VexFlow-compatible note objects
    clef: null, // set only when clef changes
    keySignature: null, // set only when key changes
    timeSignature: null, // set only when time changes
    dynamics: [],
  }

  // Parse <attributes>
  const attrs = measureEl.querySelector('attributes')
  if (attrs) {
    const divEl = attrs.querySelector('divisions')
    if (divEl) divisions = parseInt(divEl.textContent) || divisions

    const keyEl = attrs.querySelector('key')
    if (keyEl) {
      const fifths = parseInt(keyEl.querySelector('fifths')?.textContent) || 0
      measure.keySignature = FIFTHS_TO_KEY[fifths] || 'C'
    }

    const timeEl = attrs.querySelector('time')
    if (timeEl) {
      const beats = timeEl.querySelector('beats')?.textContent || '4'
      const beatType = timeEl.querySelector('beat-type')?.textContent || '4'
      measure.timeSignature = `${beats}/${beatType}`
    }

    const clefEl = attrs.querySelector('clef')
    if (clefEl) {
      const sign = clefEl.querySelector('sign')?.textContent || 'G'
      const line = clefEl.querySelector('line')?.textContent
      measure.clef = mapClef(sign, line)
    }
  }

  // Parse <direction> elements for dynamics
  let currentDynamic = null
  const directions = measureEl.querySelectorAll('direction')
  directions.forEach((dirEl) => {
    const parsed = parseDirection(dirEl, measureNumber, divisions)
    if (parsed) {
      measure.dynamics.push(parsed)
      if (parsed.category === 'dynamic') currentDynamic = parsed.type
    }
  })

  // Parse notes and rests
  const noteEls = measureEl.querySelectorAll(':scope > note')
  noteEls.forEach((noteEl) => {
    const isChord = !!noteEl.querySelector('chord')
    const restEl = noteEl.querySelector('rest')
    const pitchEl = noteEl.querySelector('pitch')

    const typeText =
      noteEl.querySelector('type')?.textContent || guessType(noteEl, divisions)
    const vexDuration = TYPE_TO_VEX_DURATION[typeText] || 'q'
    const hasDot = !!noteEl.querySelector('dot')
    const duration = hasDot ? vexDuration + 'd' : vexDuration

    if (restEl) {
      // Rest
      measure.notes.push({
        isRest: true,
        duration: duration + 'r',
        keys: ['b/4'], // VexFlow rest position
        clef: running.clef,
      })
    } else if (pitchEl) {
      // Pitched note
      const step = pitchEl.querySelector('step')?.textContent || 'C'
      const octave = pitchEl.querySelector('octave')?.textContent || '4'
      const alter =
        parseInt(pitchEl.querySelector('alter')?.textContent) || 0
      const accidental = ALTER_TO_ACCIDENTAL[alter] || ''
      const key = `${step.toLowerCase()}${accidental}/${octave}`

      // Articulations
      const articulations = parseArticulations(noteEl)

      // Dynamic attached to this note
      let noteDynamic = currentDynamic
      const notationsEl = noteEl.querySelector('notations')
      if (notationsEl) {
        const dynEl = notationsEl.querySelector('dynamics')
        if (dynEl) {
          const types = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'fp', 'sf', 'sfz']
          for (const t of types) {
            if (dynEl.querySelector(t)) {
              noteDynamic = t
              break
            }
          }
        }
      }

      if (isChord && measure.notes.length > 0) {
        // Add key to previous note's keys array for chords
        const prev = measure.notes[measure.notes.length - 1]
        if (!prev.isRest) {
          prev.keys.push(key)
          if (accidental) {
            prev.accidentals = prev.accidentals || []
            prev.accidentals.push({
              index: prev.keys.length - 1,
              type: accidental,
            })
          }
        }
      } else {
        const noteObj = {
          isRest: false,
          duration,
          keys: [key],
          clef: running.clef,
          articulations,
          dynamic: noteDynamic,
        }
        if (accidental) {
          noteObj.accidentals = [{ index: 0, type: accidental }]
        }
        // Tie
        const tieEl = noteEl.querySelector('tie')
        if (tieEl) {
          noteObj.tie = tieEl.getAttribute('type')
        }
        measure.notes.push(noteObj)
      }
    }
  })

  return { measure, divisions }
}

function parseArticulations(noteEl) {
  const result = []
  const notations = noteEl.querySelector('notations')
  if (!notations) return result

  const artEl = notations.querySelector('articulations')
  if (artEl) {
    const map = {
      staccato: 'a.',
      accent: 'a>',
      'strong-accent': 'a^',
      tenuto: 'a-',
    }
    for (const [tag, vexMod] of Object.entries(map)) {
      if (artEl.querySelector(tag)) result.push(vexMod)
    }
  }

  const techEl = notations.querySelector('technical')
  if (techEl) {
    if (techEl.querySelector('snap-pizzicato, pizzicato')) {
      result.push('ao') // VexFlow snap pizzicato symbol
    }
  }

  return result
}

function parseDirection(dirEl, measureNumber, divisions) {
  const dirType = dirEl.querySelector('direction-type')
  if (!dirType) return null

  const offsetEl = dirEl.querySelector('offset')
  const beat = offsetEl ? parseInt(offsetEl.textContent) / divisions : 0

  // Dynamic markings
  const dynEl = dirType.querySelector('dynamics')
  if (dynEl) {
    const types = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'fp', 'sf', 'sfz']
    for (const t of types) {
      if (dynEl.querySelector(t)) {
        return { category: 'dynamic', type: t, measure: measureNumber, beat }
      }
    }
  }

  // Wedge (crescendo/diminuendo)
  const wedge = dirType.querySelector('wedge')
  if (wedge) {
    const wType = wedge.getAttribute('type')
    if (wType === 'crescendo')
      return {
        category: 'wedge',
        type: 'crescendo',
        measure: measureNumber,
        beat,
      }
    if (wType === 'diminuendo' || wType === 'decrescendo')
      return {
        category: 'wedge',
        type: 'decrescendo',
        measure: measureNumber,
        beat,
      }
    if (wType === 'stop')
      return {
        category: 'wedge',
        type: 'wedge-stop',
        measure: measureNumber,
        beat,
      }
  }

  // Text directions
  const words = dirType.querySelector('words')
  if (words) {
    const text = words.textContent.toLowerCase().trim()
    if (text === 'pizz.' || text === 'pizz' || text === 'pizzicato')
      return {
        category: 'technique',
        type: 'pizzicato',
        measure: measureNumber,
        beat,
      }
    if (text.startsWith('cresc'))
      return {
        category: 'wedge',
        type: 'crescendo',
        measure: measureNumber,
        beat,
      }
    if (text.startsWith('dim') || text.startsWith('decresc'))
      return {
        category: 'wedge',
        type: 'decrescendo',
        measure: measureNumber,
        beat,
      }
  }

  return null
}

function mapClef(sign, line) {
  if (sign === 'C') {
    // C clef on line 3 = alto, line 4 = tenor
    if (line === '4') return 'tenor'
    return 'alto'
  }
  return CLEF_MAP[sign] || 'treble'
}

function guessType(noteEl, divisions) {
  const dur = parseInt(noteEl.querySelector('duration')?.textContent) || divisions
  const ratio = dur / divisions
  if (ratio >= 4) return 'whole'
  if (ratio >= 2) return 'half'
  if (ratio >= 1) return 'quarter'
  if (ratio >= 0.5) return 'eighth'
  if (ratio >= 0.25) return '16th'
  return 'quarter'
}

export default parseMusicXML
