/**
 * DSP Web Worker — runs pYIN pitch detection off the main thread.
 *
 * Receives Float32Array audio buffers via postMessage (transferable),
 * runs pitch detection, and posts back frequency / note / cents / confidence.
 */
import {
  PYINPitchDetector,
  SympatheticResonanceFilter,
  PerformanceMonitor,
  frequencyToNote,
} from './dsp-core.js'

let detector = null
let resonanceFilter = null
const perfMonitor = new PerformanceMonitor(30)

self.onmessage = function (e) {
  const { type } = e.data

  if (type === 'INIT') {
    try {
      const { sampleRate, bufferSize, instrument } = e.data
      detector = new PYINPitchDetector(sampleRate, bufferSize)
      resonanceFilter = new SympatheticResonanceFilter(instrument || 'violin')
      self.postMessage({ type: 'INIT', success: true })
    } catch (err) {
      self.postMessage({ type: 'ERROR', error: err.message })
    }
    return
  }

  if (type === 'PROCESS') {
    if (!detector) {
      self.postMessage({
        type: 'ERROR',
        error: 'Worker not initialized. Send INIT first.',
      })
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
        const info = frequencyToNote(frequency)
        note = info.note ? `${info.note}${info.octave}` : null
        cents = info.cents
      }

      const perf = perfMonitor.end(startTime)

      self.postMessage({
        type: 'RESULT',
        frequency,
        confidence: Math.round(confidence * 1000) / 1000,
        note,
        cents,
      })

      // Report perf metrics periodically or when budget is exceeded
      if (perf.exceeded || perfMonitor.frameCount % 100 === 0) {
        self.postMessage({
          type: 'PERF',
          processingTimeMs: perf.processingTimeMs,
          exceeded: perf.exceeded,
        })
      }
    } catch (err) {
      perfMonitor.end(startTime)
      self.postMessage({ type: 'ERROR', error: err.message })
    }
    return
  }
}
