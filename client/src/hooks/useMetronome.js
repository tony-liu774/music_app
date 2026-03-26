import { useRef, useCallback, useEffect } from 'react'

/**
 * useMetronome — produces audible metronome clicks using the Web Audio API.
 *
 * Uses a short oscillator burst (sine wave) for a clean, non-intrusive click.
 * The first beat of each measure gets a higher-pitched accent click.
 *
 * @param {object} options
 * @param {number}  options.tempo          — BPM (beats per minute)
 * @param {number}  options.beatsPerMeasure — beats per measure (from time sig)
 * @param {boolean} options.enabled        — whether the metronome is active
 * @returns {{ audioContextRef }}
 */
export default function useMetronome({
  tempo = 120,
  beatsPerMeasure = 4,
  enabled = false,
}) {
  const audioCtxRef = useRef(null)
  const intervalRef = useRef(null)
  const beatCountRef = useRef(0)

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return null
      audioCtxRef.current = new AudioCtx()
    }
    return audioCtxRef.current
  }, [])

  const playClick = useCallback(
    (isAccent = false) => {
      const ctx = getAudioContext()
      if (!ctx) return
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const now = ctx.currentTime

      // Oscillator — short sine burst
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(isAccent ? 1000 : 800, now)

      // Gain envelope — sharp attack, quick decay
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(isAccent ? 0.5 : 0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.05)
    },
    [getAudioContext],
  )

  const startMetronome = useCallback(() => {
    if (intervalRef.current) return

    beatCountRef.current = 0
    const msPerBeat = (60 / tempo) * 1000

    // Play first click immediately (accent)
    playClick(true)
    beatCountRef.current = 1

    intervalRef.current = setInterval(() => {
      const isAccent = beatCountRef.current % beatsPerMeasure === 0
      playClick(isAccent)
      beatCountRef.current++
    }, msPerBeat)
  }, [tempo, beatsPerMeasure, playClick])

  const stopMetronome = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    beatCountRef.current = 0
  }, [])

  // Start/stop when enabled changes
  useEffect(() => {
    if (enabled) {
      startMetronome()
    } else {
      stopMetronome()
    }
    return () => stopMetronome()
  }, [enabled, startMetronome, stopMetronome])

  // Restart when tempo or beatsPerMeasure changes while running.
  // Track previous values to only restart on actual changes.
  const prevTempoRef = useRef(tempo)
  const prevBPMRef = useRef(beatsPerMeasure)
  useEffect(() => {
    const tempoChanged = prevTempoRef.current !== tempo
    const bpmChanged = prevBPMRef.current !== beatsPerMeasure
    prevTempoRef.current = tempo
    prevBPMRef.current = beatsPerMeasure

    if (enabled && intervalRef.current && (tempoChanged || bpmChanged)) {
      stopMetronome()
      startMetronome()
    }
  }, [tempo, beatsPerMeasure, enabled, startMetronome, stopMetronome])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMetronome()
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close()
      }
    }
  }, [stopMetronome])

  return { audioContextRef: audioCtxRef }
}
