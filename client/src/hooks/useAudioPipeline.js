import { useState, useRef, useCallback, useEffect } from 'react'
import { useAudioStore } from '../stores/useAudioStore'
import { useAudioContextSuspension } from './useAudioContextSuspension'

/**
 * Default audio pipeline configuration.
 */
const DEFAULTS = {
  bufferSize: 2048,
  sampleRate: 44100, // fallback; actual rate comes from AudioContext
}

/**
 * React hook that wires a microphone MediaStream through an AudioContext
 * into a Web Worker running pYIN pitch detection.
 *
 * Responsibilities:
 * 1. Creates an AudioContext and connects the MediaStream source.
 * 2. Uses a ScriptProcessorNode to capture raw audio frames.
 * 3. Posts Float32Array buffers to the DSP worker (zero-copy via transfer).
 * 4. Receives pitch results and writes them to useAudioStore.
 * 5. Terminates the worker and closes the AudioContext on unmount.
 *
 * @param {object} [options]
 * @param {number} [options.bufferSize=2048]
 * @returns {{ start, stop, isRunning, error }}
 */
export function useAudioPipeline(options = {}) {
  const bufferSize = options.bufferSize ?? DEFAULTS.bufferSize

  const setPitchData = useAudioStore((s) => s.setPitchData)
  const setVibratoData = useAudioStore((s) => s.setVibratoData)
  const setAudioContextState = useAudioStore((s) => s.setAudioContextState)
  const setResumeAudioContext = useAudioStore((s) => s.setResumeAudioContext)
  const selectedInstrument = useAudioStore((s) => s.selectedInstrument)

  const workerRef = useRef(null)
  const audioCtxRef = useRef(null)
  const sourceRef = useRef(null)
  const processorRef = useRef(null)
  // Ref for the onaudioprocess callback (avoids stale closure)
  const isRunningRef = useRef(false)

  // Reactive state so consuming components re-render on start/stop
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState(null)
  // Reactive AudioContext reference for the suspension hook
  const [audioCtx, setAudioCtx] = useState(null)

  // Monitor AudioContext for browser-initiated suspension and auto-resume
  const { resume: resumeAudioContext } = useAudioContextSuspension(audioCtx, {
    enabled: isRunning,
  })

  /**
   * Handle messages from the DSP worker.
   */
  const handleWorkerMessage = useCallback(
    (e) => {
      const { type } = e.data
      if (type === 'RESULT') {
        const { frequency, confidence, note, cents, vibrato } = e.data
        setPitchData({ frequency, confidence, note, cents })

        if (vibrato) {
          setVibratoData({
            isVibrato: vibrato.isVibrato,
            vibratoRate: vibrato.vibratoRate,
            vibratoWidth: vibrato.vibratoExtent,
            centerFrequency: vibrato.smoothedFrequency,
          })
        }
      }
    },
    [setPitchData, setVibratoData],
  )

  /**
   * Handle worker errors (syntax errors, import failures, etc.).
   */
  const handleWorkerError = useCallback((e) => {
    const message = e.message || 'Worker encountered an error'
    setError(new Error(message))
  }, [])

  /**
   * Start the audio pipeline.
   * @param {MediaStream} stream — from getUserMedia
   */
  const start = useCallback(
    async (stream) => {
      if (isRunningRef.current) return

      setError(null)

      // 1. Create AudioContext
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = ctx
      setAudioCtx(ctx)
      setAudioContextState(ctx.state)

      // Resume if suspended (browsers require user gesture)
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      const sampleRate = ctx.sampleRate

      // 2. Spawn the DSP worker
      const worker = new Worker(
        new URL('../workers/dsp-worker.js', import.meta.url),
        { type: 'module' },
      )
      workerRef.current = worker
      worker.onmessage = handleWorkerMessage
      worker.onerror = handleWorkerError

      // 3. Initialise the worker
      worker.postMessage({
        type: 'INIT',
        sampleRate,
        bufferSize,
        instrument: selectedInstrument,
      })

      // 4. Connect MediaStream → ScriptProcessorNode
      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source

      // ScriptProcessorNode: input channels = 1, output channels = 1
      const processor = ctx.createScriptProcessor(bufferSize, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (audioEvent) => {
        if (!isRunningRef.current) return

        const inputData = audioEvent.inputBuffer.getChannelData(0)
        // Copy into a new Float32Array so we can transfer the buffer
        const copy = new Float32Array(inputData.length)
        copy.set(inputData)

        worker.postMessage(
          { type: 'PROCESS', buffer: copy },
          [copy.buffer], // transfer the ArrayBuffer for zero-copy
        )
      }

      source.connect(processor)
      // Connect processor to destination to keep it alive (output is silent)
      processor.connect(ctx.destination)

      isRunningRef.current = true
      setIsRunning(true)
    },
    [
      bufferSize,
      selectedInstrument,
      handleWorkerMessage,
      handleWorkerError,
      setAudioContextState,
    ],
  )

  /**
   * Stop the audio pipeline and release resources.
   */
  const stop = useCallback(() => {
    isRunningRef.current = false
    setIsRunning(false)

    if (processorRef.current) {
      processorRef.current.onaudioprocess = null
      processorRef.current.disconnect()
      processorRef.current = null
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close()
      audioCtxRef.current = null
      setAudioCtx(null)
      setAudioContextState('closed')
    }

    // Reset pitch and vibrato data
    setPitchData({ frequency: null, confidence: 0, note: null, cents: null })
    setVibratoData({ isVibrato: false, vibratoRate: null, vibratoWidth: null, centerFrequency: null })
  }, [setAudioContextState, setPitchData, setVibratoData])

  // Register the resume callback in the store so other components can use it
  useEffect(() => {
    setResumeAudioContext(resumeAudioContext)
    return () => setResumeAudioContext(async () => true)
  }, [resumeAudioContext, setResumeAudioContext])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRunningRef.current) {
        stop()
      }
    }
  }, [stop])

  return { start, stop, isRunning, error, resumeAudioContext }
}
