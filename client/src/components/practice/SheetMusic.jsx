import { useEffect, useRef, useCallback, useState } from 'react'
import {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Accidental,
  Articulation,
  Dot,
  Beam,
} from 'vexflow'

/** Fallback values used only when CSS custom properties are unavailable (e.g. tests). */
const FALLBACKS = {
  background: '#0a0a12',
  staffLine: '#3a3a4a',
  noteHead: '#f3f4f6',
  amber: '#c9a227',
  ivoryMuted: '#a0a0b0',
}

/**
 * Read Midnight Conservatory color tokens from CSS custom properties at render
 * time so they stay in sync with the theme.
 */
function getThemeColors() {
  const root =
    typeof document !== 'undefined'
      ? getComputedStyle(document.documentElement)
      : null

  const get = (prop, fallback) =>
    root?.getPropertyValue(prop)?.trim() || fallback

  return {
    background: get('--color-oxford-blue', FALLBACKS.background),
    staffLine: get('--color-border-light', FALLBACKS.staffLine),
    noteHead: get('--color-ivory', FALLBACKS.noteHead),
    amber: get('--color-amber', FALLBACKS.amber),
    ivoryMuted: get('--color-ivory-muted', FALLBACKS.ivoryMuted),
  }
}

import {
  MEASURE_WIDTH,
  SYSTEM_HEIGHT,
  FIRST_MEASURE_INDENT,
  MEASURES_PER_SYSTEM,
} from '../../constants/scoreLayout'

/** Threshold: virtualize rendering when a score exceeds this many systems. */
const VIRTUALIZE_THRESHOLD_SYSTEMS = 10
/** Number of extra systems to render above/below the viewport. */
const VIRTUALIZE_BUFFER_SYSTEMS = 2

/**
 * SheetMusic — renders a parsed VexFlow-compatible score onto an SVG element.
 *
 * Props:
 *   score          – parsed score object from MusicXMLParser ({ title, composer, parts })
 *   partIndex      – which part to render (default 0)
 *   currentMeasure – 1-based measure number to highlight (optional)
 *   className      – additional CSS classes
 */
export default function SheetMusic({
  score,
  partIndex = 0,
  currentMeasure = null,
  className = '',
  scrollRef: externalScrollRef = null,
}) {
  const containerRef = useRef(null)
  const internalScrollRef = useRef(null)
  const scrollRef = externalScrollRef || internalScrollRef
  const visibleRangeRef = useRef({ start: 0, end: Infinity })
  const [virtualizeGeneration, setVirtualizeGeneration] = useState(0)

  // Track scroll position to determine which systems are visible
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !score) return

    const part = score.parts?.[partIndex]
    if (!part) return

    const systemCount = Math.ceil(
      (part.measures?.length || 0) / MEASURES_PER_SYSTEM,
    )
    if (systemCount <= VIRTUALIZE_THRESHOLD_SYSTEMS) return

    const handleScroll = () => {
      const scrollTop = el.scrollTop
      const viewHeight = el.clientHeight
      const firstVisible = Math.floor(scrollTop / SYSTEM_HEIGHT)
      const lastVisible = Math.ceil((scrollTop + viewHeight) / SYSTEM_HEIGHT)
      const newStart = Math.max(0, firstVisible - VIRTUALIZE_BUFFER_SYSTEMS)
      const newEnd = Math.min(
        systemCount - 1,
        lastVisible + VIRTUALIZE_BUFFER_SYSTEMS,
      )
      if (
        newStart !== visibleRangeRef.current.start ||
        newEnd !== visibleRangeRef.current.end
      ) {
        visibleRangeRef.current = { start: newStart, end: newEnd }
        setVirtualizeGeneration((n) => n + 1)
      }
    }

    handleScroll()
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [score, partIndex, scrollRef])

  const render = useCallback(() => {
    const container = containerRef.current
    if (!container || !score) return

    // Clear previous render
    container.innerHTML = ''

    // Read theme colors from CSS custom properties at render time
    const theme = getThemeColors()

    const part = score.parts?.[partIndex]
    if (!part || !part.measures?.length) return

    const measures = part.measures
    const systemCount = Math.ceil(measures.length / MEASURES_PER_SYSTEM)
    const totalWidth =
      MEASURES_PER_SYSTEM * MEASURE_WIDTH + FIRST_MEASURE_INDENT + 40
    const totalHeight = systemCount * SYSTEM_HEIGHT + 40
    const shouldVirtualize = systemCount > VIRTUALIZE_THRESHOLD_SYSTEMS

    // Create SVG renderer
    const renderer = new Renderer(container, Renderer.Backends.SVG)
    renderer.resize(totalWidth, totalHeight)
    const context = renderer.getContext()

    // Style the SVG background
    const svgEl = container.querySelector('svg')
    if (svgEl) {
      svgEl.style.background = theme.background
    }

    // Track running attributes across measures
    let runningClef = 'treble'
    let runningKey = 'C'
    let runningTime = '4/4'

    measures.forEach((measure, mIdx) => {
      const systemIndex = Math.floor(mIdx / MEASURES_PER_SYSTEM)
      const posInSystem = mIdx % MEASURES_PER_SYSTEM
      const isFirstInSystem = posInSystem === 0

      // Update running state (always, to keep clef/key/time correct)
      if (measure.clef) runningClef = measure.clef
      if (measure.keySignature) runningKey = measure.keySignature
      if (measure.timeSignature) runningTime = measure.timeSignature

      // Skip rendering if outside visible range (virtualization)
      if (
        shouldVirtualize &&
        (systemIndex < visibleRangeRef.current.start ||
          systemIndex > visibleRangeRef.current.end)
      ) {
        return
      }

      // Calculate position
      const x = isFirstInSystem
        ? 10
        : 10 + FIRST_MEASURE_INDENT + posInSystem * MEASURE_WIDTH
      const y = 20 + systemIndex * SYSTEM_HEIGHT
      const width = isFirstInSystem
        ? MEASURE_WIDTH + FIRST_MEASURE_INDENT
        : MEASURE_WIDTH

      // Create stave
      const stave = new Stave(x, y, width)

      // First measure on each system gets clef + key + time
      if (isFirstInSystem) {
        stave.addClef(runningClef)
        stave.addKeySignature(runningKey)
        if (mIdx === 0 || measure.timeSignature) {
          stave.addTimeSignature(runningTime)
        }
      } else {
        // Show key/time only if they changed this measure
        if (measure.keySignature) stave.addKeySignature(runningKey)
        if (measure.timeSignature) stave.addTimeSignature(runningTime)
      }

      // Style stave lines
      stave.setStyle({ strokeStyle: theme.staffLine, lineWidth: 1 })
      stave.setContext(context).draw()

      // Style stave modifiers (clef, key sig, time sig) to ivory
      styleStaveModifiers(stave, theme)

      // Build VexFlow notes
      const vexNotes = buildVexNotes(measure, runningClef, theme)

      if (vexNotes.length === 0) return

      // Add beams for eighth notes and shorter
      const beamableNotes = vexNotes.filter(
        (n) =>
          !n.isRest() &&
          ['8', '16', '32', '64'].some((d) => n.getDuration().includes(d)),
      )

      // Create voice
      const [timeNum, timeDen] = runningTime.split('/').map(Number)
      const voice = new Voice({
        num_beats: timeNum,
        beat_value: timeDen,
      }).setMode(Voice.Mode.SOFT)

      voice.addTickables(vexNotes)

      // Format and draw
      new Formatter().joinVoices([voice]).format([voice], width - 50)

      voice.draw(context, stave)

      // Auto-beam eighth notes
      if (beamableNotes.length >= 2) {
        try {
          const beams = Beam.generateBeams(vexNotes.filter((n) => !n.isRest()))
          beams.forEach((beam) => beam.setContext(context).draw())
        } catch {
          // Beaming can fail on edge cases — render without beams
        }
      }

      // Highlight current measure
      if (currentMeasure !== null && measure.number === currentMeasure) {
        highlightMeasure(context, x, y, width, theme)
      }
    })
  }, [score, partIndex, currentMeasure, virtualizeGeneration])

  // Render on score or measure change
  useEffect(() => {
    render()
  }, [render])

  // Auto-scroll to keep current measure visible
  useEffect(() => {
    if (currentMeasure == null || !scrollRef.current || !score) return

    const part = score.parts?.[partIndex]
    if (!part) return

    const mIdx = currentMeasure - 1
    const systemIndex = Math.floor(mIdx / MEASURES_PER_SYSTEM)
    const targetY = systemIndex * SYSTEM_HEIGHT

    scrollRef.current.scrollTo({
      top: Math.max(0, targetY - 20),
      behavior: 'smooth',
    })
  }, [currentMeasure, score, partIndex])

  if (!score) {
    return (
      <div
        data-testid="sheet-music-empty"
        className={`flex items-center justify-center p-8 ${className}`}
      >
        <p className="font-body text-ivory-dim text-sm">
          Select a piece from your library to view notation
        </p>
      </div>
    )
  }

  return (
    <div
      data-testid="sheet-music"
      className={`max-w-full max-h-[70vh] overflow-x-auto overflow-y-auto ${className}`}
      ref={scrollRef}
    >
      <div ref={containerRef} data-testid="sheet-music-svg" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildVexNotes(measure, clef, theme) {
  return measure.notes.map((n) => {
    if (n.isRest) {
      const note = new StaveNote({
        clef,
        keys: ['b/4'],
        duration: n.duration,
      })
      note.setStyle({
        fillStyle: theme.ivoryMuted,
        strokeStyle: theme.ivoryMuted,
      })
      return note
    }

    const note = new StaveNote({
      clef,
      keys: n.keys,
      duration: n.duration,
    })

    // Accidentals
    if (n.accidentals) {
      n.accidentals.forEach((acc) => {
        note.addModifier(new Accidental(acc.type), acc.index)
      })
    }

    // Dots
    if (n.duration.includes('d')) {
      Dot.buildAndAttach([note])
    }

    // Articulations
    if (n.articulations) {
      n.articulations.forEach((art) => {
        note.addModifier(new Articulation(art))
      })
    }

    // Style note heads ivory
    note.setStyle({
      fillStyle: theme.noteHead,
      strokeStyle: theme.noteHead,
    })
    note.setStemStyle({
      fillStyle: theme.noteHead,
      strokeStyle: theme.noteHead,
    })

    return note
  })
}

function highlightMeasure(context, x, y, width, theme) {
  context.save()
  context.setFillStyle('rgba(201, 162, 39, 0.08)')
  context.setStrokeStyle(theme.amber)
  context.setLineWidth(2)
  context.fillRect(x, y, width, SYSTEM_HEIGHT - 40)
  context.restore()
}

function styleStaveModifiers(stave, theme) {
  const modifiers = stave.getModifiers?.() || []
  modifiers.forEach((mod) => {
    if (mod.setStyle) {
      mod.setStyle({ fillStyle: theme.noteHead, strokeStyle: theme.noteHead })
    }
  })
}
