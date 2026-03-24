import { useRef, useCallback, useEffect, useState } from 'react'
import { useAudioStore } from '../stores/useAudioStore'
import {
  MEASURE_WIDTH,
  SYSTEM_HEIGHT,
  FIRST_MEASURE_INDENT,
  MEASURES_PER_SYSTEM,
  STAVE_CENTER_Y,
} from '../constants/scoreLayout'

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

  const measureX = isFirstInSystem
    ? 10
    : 10 + FIRST_MEASURE_INDENT + posInSystem * MEASURE_WIDTH
  const width = isFirstInSystem
    ? MEASURE_WIDTH + FIRST_MEASURE_INDENT
    : MEASURE_WIDTH

  const beatFraction = (beat - 0.5) / beatsPerMeasure
  const x = measureX + width * beatFraction
  const y = systemIndex * SYSTEM_HEIGHT + STAVE_CENTER_Y

  return { x, y }
}

/**
 * usePredictiveCursor — drives the predictive cursor animation.
 *
 * Position is updated via direct DOM manipulation (cursorRef.style.left/top)
 * for 60fps performance. React state is only updated on beat boundaries
 * (currentMeasure, currentBeat, isBouncing).
 *
 * @returns {{ cursorRef, currentMeasure, currentBeat, isBouncing, reset }}
 */
export default function usePredictiveCursor({
  score,
  partIndex = 0,
  isPracticing,
  tempo = 120,
  metronomeMode = true,
  scrollRef = null,
}) {
  const [currentMeasure, setCurrentMeasure] = useState(1)
  const [currentBeat, setCurrentBeat] = useState(1)
  const [isBouncing, setIsBouncing] = useState(false)

  // Ref to the PredictiveCursor DOM element — updated directly each frame
  const cursorRef = useRef(null)

  // Animation path refs (no re-renders)
  const targetRef = useRef({ x: 0, y: 0 })
  const posRef = useRef({ x: 0, y: 0 })
  const animFrameRef = useRef(null)
  const lastTickRef = useRef(0)
  const beatRef = useRef({ measure: 1, beat: 1 })
  const bounceTimerRef = useRef(null)

  // Current values via refs for the animation loop
  const tempoRef = useRef(tempo)
  tempoRef.current = tempo
  const metronomeRef = useRef(metronomeMode)
  metronomeRef.current = metronomeMode

  const part = score?.parts?.[partIndex]
  const totalMeasures = part?.measures?.length || 0
  const timeSignature = part?.measures?.[0]?.timeSignature || '4/4'
  const beatsPerMeasure = parseInt(timeSignature.split('/')[0], 10) || 4

  const totalMeasuresRef = useRef(totalMeasures)
  totalMeasuresRef.current = totalMeasures
  const beatsPerMeasureRef = useRef(beatsPerMeasure)
  beatsPerMeasureRef.current = beatsPerMeasure

  // Keep scrollRef accessible in the animation loop
  const scrollRefCurrent = useRef(scrollRef)
  scrollRefCurrent.current = scrollRef

  /**
   * Update the cursor DOM element position directly (no React re-render).
   */
  const updateCursorDOM = useCallback((x, y) => {
    const el = cursorRef.current
    if (el) {
      el.style.left = `${x}px`
      el.style.top = `${y}px`
    }
  }, [])

  /**
   * Check if scroll is needed and apply it.
   */
  const checkScroll = useCallback((x, y) => {
    const container = scrollRefCurrent.current?.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()

    const relativeX = x - container.scrollLeft
    if (relativeX > containerRect.width - 100) {
      container.scrollTo({
        left: container.scrollLeft + MEASURE_WIDTH,
        behavior: 'smooth',
      })
    }

    const relativeY = y - container.scrollTop
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
  }, [])

  const triggerBounce = useCallback(() => {
    setIsBouncing(true)
    clearTimeout(bounceTimerRef.current)
    bounceTimerRef.current = setTimeout(() => setIsBouncing(false), 300)
  }, [])

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
   * Core 60fps animation loop. Updates DOM position directly via ref.
   * Only triggers React state updates on beat changes.
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

      // Direct DOM update — no React re-render
      updateCursorDOM(pos.x, pos.y)

      // Metronome advance on beat boundary
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
        checkScroll(nextPos.x, nextPos.y)

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
    [advanceBeat, triggerBounce, updateCursorDOM, checkScroll],
  )

  /**
   * Pitch-based advance: on new note detection, advance to next beat.
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
      checkScroll(nextPos.x, nextPos.y)

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
    checkScroll,
  ])

  /**
   * Start/stop the animation loop when practice state changes.
   * Cleanup clears both animation frame AND bounce timer.
   */
  useEffect(() => {
    if (isPracticing && totalMeasures > 0) {
      const startPos = getBeatPosition(1, 1, beatsPerMeasure)
      posRef.current = { ...startPos }
      targetRef.current = { ...startPos }
      updateCursorDOM(startPos.x, startPos.y)
      lastTickRef.current = performance.now()

      animFrameRef.current = requestAnimationFrame(animationLoop)
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
      clearTimeout(bounceTimerRef.current)
    }
  }, [
    isPracticing,
    totalMeasures,
    beatsPerMeasure,
    animationLoop,
    updateCursorDOM,
  ])

  const reset = useCallback(() => {
    beatRef.current = { measure: 1, beat: 1 }
    setCurrentMeasure(1)
    setCurrentBeat(1)
    const startPos = getBeatPosition(1, 1, beatsPerMeasureRef.current)
    posRef.current = { ...startPos }
    targetRef.current = { ...startPos }
    updateCursorDOM(startPos.x, startPos.y)
    useAudioStore.getState().setCursorPosition({
      measure: 1,
      beat: 1,
      progress: 0,
    })
  }, [updateCursorDOM])

  /**
   * Seek cursor to a specific measure (beat 1).
   * Used by Smart Loop to jump back to the start of the loop region.
   */
  const seekToMeasure = useCallback(
    (measure) => {
      const bpm = beatsPerMeasureRef.current
      const total = totalMeasuresRef.current
      const targetMeasure = Math.min(Math.max(1, measure), total || 1)

      beatRef.current = { measure: targetMeasure, beat: 1 }
      setCurrentMeasure(targetMeasure)
      setCurrentBeat(1)

      const seekPos = getBeatPosition(targetMeasure, 1, bpm)
      posRef.current = { ...seekPos }
      targetRef.current = { ...seekPos }
      updateCursorDOM(seekPos.x, seekPos.y)
      checkScroll(seekPos.x, seekPos.y)

      const progress = total > 0 ? (targetMeasure - 1) / total : 0
      useAudioStore.getState().setCursorPosition({
        measure: targetMeasure,
        beat: 1,
        progress,
      })
    },
    [updateCursorDOM, checkScroll],
  )

  return {
    cursorRef,
    currentMeasure,
    currentBeat,
    isBouncing,
    reset,
    seekToMeasure,
  }
}
