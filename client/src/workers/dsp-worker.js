/**
 * DSP Web Worker — runs pYIN pitch detection off the main thread.
 *
 * Receives Float32Array audio buffers via postMessage (transferable),
 * runs pitch detection, and posts back frequency / note / cents / confidence.
 */
import {
  PYINPitchDetector,
  SympatheticResonanceFilter,
  VibratoSmoother,
  PerformanceMonitor,
  frequencyToNote,
  isInInstrumentRange,
  DEFAULT_TUNING_REFERENCE,
} from './dsp-core.js'
import {
  createResultMessage,
  createErrorMessage,
  createPerfMessage,
} from './dsp-worker-protocol.js'

let detector = null
let resonanceFilter = null
let vibratoSmoother = null
let tuningReference = DEFAULT_TUNING_REFERENCE
let currentInstrument = 'violin'
const perfMonitor = new PerformanceMonitor(30)

self.onmessage = function (e) {
  const { type } = e.data

  if (type === 'INIT') {
    try {
      const { sampleRate, bufferSize, instrument } = e.data
      tuningReference = e.data.tuningReference ?? DEFAULT_TUNING_REFERENCE
      currentInstrument = instrument || 'violin'
      detector = new PYINPitchDetector(sampleRate, bufferSize)
      resonanceFilter = new SympatheticResonanceFilter(currentInstrument)
      vibratoSmoother = new VibratoSmoother()
      self.postMessage({ type: 'INIT', success: true })
    } catch (err) {
      self.postMessage(createErrorMessage(err.message))
    }
    return
  }

  if (type === 'PROCESS') {
    if (!detector) {
      self.postMessage(
        createErrorMessage('Worker not initialized. Send INIT first.'),
      )
      return
    }

    const startTime = perfMonitor.start()

    try {
      const buffer = e.data.buffer
      const { frequency, confidence: rawConfidence } = detector.detect(buffer)

      let confidence = rawConfidence
      let note = null
      let cents = null

      if (frequency !== null) {
        // Apply sympathetic resonance filter
        confidence = resonanceFilter.filter(frequency, rawConfidence)

        // Penalize out-of-range frequencies after resonance filtering
        if (!isInInstrumentRange(frequency, currentInstrument)) {
          confidence = confidence * 0.2
        }

        const info = frequencyToNote(frequency, tuningReference)
        note = info.note ? `${info.note}${info.octave}` : null
        cents = info.cents
      }

      // Run vibrato smoother on every frame (including nulls)
      const vibrato = vibratoSmoother.process(frequency, confidence)

      const perf = perfMonitor.end(startTime)

      self.postMessage(
        createResultMessage(
          frequency,
          Math.round(confidence * 1000) / 1000,
          note,
          cents,
          vibrato,
        ),
      )

      // Report perf metrics periodically or when budget is exceeded
      if (perf.exceeded || perfMonitor.frameCount % 100 === 0) {
        self.postMessage(
          createPerfMessage(perf.processingTimeMs, perf.exceeded),
        )
      }
    } catch (err) {
      perfMonitor.end(startTime)
      self.postMessage(createErrorMessage(err.message))
    }
    return
  }
}
