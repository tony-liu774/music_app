import { useRef, useCallback, useEffect, useState } from 'react'
import { useAudioStore } from '../stores/useAudioStore'

/**
 * Layout constants — must match SheetMusic.jsx rendering geometry.
 */
const MEASURE_WIDTH = 300
const SYSTEM_HEIGHT = 140
const FIRST_MEASURE_INDENT = 40
const MEASURES_PER_SYSTEM = 4
/** Vertical center of a stave within a system. */
const STAVE_CENTER_Y = 20 + 60 // top offset + half stave height

/**
 * Calculate the (x, y) pixel position of a given beat within the rendered score.
 *
 * @param {number} measure   1-based measure number
 * @param {number} beat      1-based beat within the measure
 * @param {number} beatsPerMeasure  beats per measure from time signature
 * @returns {{ x: number, y: number }}
 */
export function getBeatPosition(measure, beat, beatsPerMeasure) {
  const mIdx = measure - 1
  const systemIndex = Math.floor(mIdx / MEASURES_PER_SYSTEM)
  const posInSystem = mIdx % MEASURES_PER_SYSTEM
  const isFirstInSystem = posInSystem === 0

  // X: measure start + fractional beat offset within measure
  const measureX = isFirstInSystem
    ? 10
    : 10 + FIRST_MEASURE_INDENT + posInSystem * MEASURE_WIDTH
  const width = isFirstInSystem
    ? MEASURE_WIDTH + FIRST_MEASURE_INDENT
    : MEASURE_WIDTH

  // Beat fraction (0-based within measure, leave padding at edges)
  const beatFraction = (beat - 0.5) / beatsPerMeasure
  const x = measureX + width * beatFraction

  // Y: system top + stave center
  const y = systemIndex * SYSTEM_HEIGHT + STAVE_CENTER_Y

  return { x, y }
}

/**
 * usePredictiveCursor — drives the predictive cursor animation.
 *
 * Uses refs for the hot animation path to avoid re-render loops.
 * Only triggers React state updates on beat changes (not every frame).
 */
export default function usePredictiveCursor({
  score,
  partIndex = 0,
  isPracticing,
  tempo = 120,
  metronomeMode = true,
  scrollRef = null,
}) {
  const [cursorX, setCursorX] = useState(0)
  const [cursorY, setCursorY] = useState(0)
  const [currentMeasure, setCurrentMeasure] = useState(1)
  const [currentBeat, setCurrentBeat] = useState(1)
  const [isBouncing, setIsBouncing] = useState(false)

  // Refs for hot animation path (no re-renders)
  const targetRef = useRef({ x: 0, y: 0 })
  const posRef = useRef({ x: 0, y: 0 })
  const animFrameRef = useRef(null)
  const lastTickRef = useRef(0)
  const beatRef = useRef({ measure: 1, beat: 1 })
  const bounceTimerRef = useRef(null)

  // Store references that stay current without re-renders
  const tempoRef = useRef(tempo)
  tempoRef.current = tempo
  const metronomeRef = useRef(metronomeMode)
  metronomeRef.current = metronomeMode

  const part = score?.parts?.[partIndex]
  const totalMeasures = part?.measures?.length || 0
  const timeSignature = part?.measures?.[0]?.timeSignature || '4/4'
  const beatsPerMeasure = parseInt(timeSignature.split('/')[0], 10) || 4

  // Store these in refs for the animation loop
  const totalMeasuresRef = useRef(totalMeasures)
  totalMeasuresRef.current = totalMeasures
  const beatsPerMeasureRef = useRef(beatsPerMeasure)
  beatsPerMeasureRef.current = beatsPerMeasure

  const triggerBounce = useCallback(() => {
    setIsBouncing(true)
    clearTimeout(bounceTimerRef.current)
    bounceTimerRef.current = setTimeout(() => setIsBouncing(false), 300)
  }, [])

  /**
   * Advance to the next beat. Returns the new { measure, beat }.
   */
  const advanceBeat = useCallback(() => {
    const bpm = beatsPerMeasureRef.current
    const total = totalMeasuresRef.current
    const { measure, beat } = beatRef.current
    let nextBeat = beat + 1
    let nextMeasure = measure

    if (nextBeat > bpm) {
      nextBeat = 1
      nextMeasure = measure + 1
    }

    if (nextMeasure > total) {
      return { measure, beat }
    }

    beatRef.current = { measure: nextMeasure, beat: nextBeat }
    setCurrentMeasure(nextMeasure)
    setCurrentBeat(nextBeat)

    return { measure: nextMeasure, beat: nextBeat }
  }, [])

  /**
   * The core animation loop. Runs via requestAnimationFrame.
   * Uses only refs in the hot path — no dependency on React state.
   */
  const animationLoop = useCallback(
    (timestamp) => {
      const pos = posRef.current
      const target = targetRef.current
      const dx = target.x - pos.x
      const dy = target.y - pos.y

      const ease = 0.15
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        pos.x += dx * ease
        pos.y += dy * ease
      } else {
        pos.x = target.x
        pos.y = target.y
      }

      setCursorX(pos.x)
      setCursorY(pos.y)

      // Metronome advance
      const msPerBeat = (60 / tempoRef.current) * 1000
      if (
        metronomeRef.current &&
        timestamp - lastTickRef.current >= msPerBeat
      ) {
        lastTickRef.current = timestamp
        const next = advanceBeat()
        const bpm = beatsPerMeasureRef.current
        const nextPos = getBeatPosition(next.measure, next.beat, bpm)
        targetRef.current = nextPos
        triggerBounce()

        const total = totalMeasuresRef.current
        const progress =
          total > 0
            ? ((next.measure - 1) * bpm + (next.beat - 1)) / (total * bpm)
            : 0
        useAudioStore.getState().setCursorPosition({
          measure: next.measure,
          beat: next.beat,
          progress,
        })
      }

      animFrameRef.current = requestAnimationFrame(animationLoop)
    },
    [advanceBeat, triggerBounce],
  )

  /**
   * Pitch-based advance: when a new note is detected with enough
   * confidence, advance to the next beat.
   */
  const prevNoteRef = useRef(null)
  const pitchNote = useAudioStore((s) => s.pitchData.note)
  const pitchConfidence = useAudioStore((s) => s.pitchData.confidence)

  useEffect(() => {
    if (!isPracticing || metronomeMode || !pitchNote) return
    if (pitchConfidence < 0.5) return

    if (pitchNote !== prevNoteRef.current) {
      prevNoteRef.current = pitchNote
      const next = advanceBeat()
      const bpm = beatsPerMeasureRef.current
      const nextPos = getBeatPosition(next.measure, next.beat, bpm)
      targetRef.current = nextPos
      triggerBounce()

      const total = totalMeasuresRef.current
      const progress =
        total > 0
          ? ((next.measure - 1) * bpm + (next.beat - 1)) / (total * bpm)
          : 0
      useAudioStore.getState().setCursorPosition({
        measure: next.measure,
        beat: next.beat,
        progress,
      })
    }
  }, [
    pitchNote,
    pitchConfidence,
    isPracticing,
    metronomeMode,
    advanceBeat,
    triggerBounce,
  ])

  /**
   * Predictive scrolling: when the cursor approaches the edge
   * of the visible area, smooth-scroll to keep it visible.
   */
  useEffect(() => {
    if (!scrollRef?.current) return

    const container = scrollRef.current
    const containerRect = container.getBoundingClientRect()

    const relativeX = cursorX - container.scrollLeft
    if (relativeX > containerRect.width - 100) {
      container.scrollTo({
        left: container.scrollLeft + MEASURE_WIDTH,
        behavior: 'smooth',
      })
    }

    const relativeY = cursorY - container.scrollTop
    if (relativeY > containerRect.height - 60) {
      container.scrollTo({
        top: container.scrollTop + SYSTEM_HEIGHT,
        behavior: 'smooth',
      })
    } else if (relativeY < 20) {
      container.scrollTo({
        top: Math.max(0, container.scrollTop - SYSTEM_HEIGHT),
        behavior: 'smooth',
      })
    }
  }, [cursorX, cursorY, scrollRef])

  /**
   * Start/stop the animation loop when practice state changes.
   * This effect has a stable dependency list — animationLoop only
   * depends on advanceBeat and triggerBounce which are both stable.
   */
  useEffect(() => {
    if (isPracticing && totalMeasures > 0) {
      const startPos = getBeatPosition(1, 1, beatsPerMeasure)
      posRef.current = { ...startPos }
      targetRef.current = { ...startPos }
      setCursorX(startPos.x)
      setCursorY(startPos.y)
      lastTickRef.current = performance.now()

      animFrameRef.current = requestAnimationFrame(animationLoop)
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
    }
  }, [isPracticing, totalMeasures, beatsPerMeasure, animationLoop])

  const reset = useCallback(() => {
    beatRef.current = { measure: 1, beat: 1 }
    setCurrentMeasure(1)
    setCurrentBeat(1)
    const startPos = getBeatPosition(1, 1, beatsPerMeasureRef.current)
    posRef.current = { ...startPos }
    targetRef.current = { ...startPos }
    setCursorX(startPos.x)
    setCursorY(startPos.y)
    useAudioStore.getState().setCursorPosition({
      measure: 1,
      beat: 1,
      progress: 0,
    })
  }, [])

  return {
    cursorX,
    cursorY,
    currentMeasure,
    currentBeat,
    isBouncing,
    reset,
  }
}
