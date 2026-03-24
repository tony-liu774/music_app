/**
 * DSP Worker Protocol — message types for communication between
 * the main thread and the pitch-detection Web Worker.
 */

/** Configure the worker (sample rate, buffer size, instrument). */
export const MSG_INIT = 'INIT'

/** Send an audio buffer (Float32Array) for processing. */
export const MSG_PROCESS = 'PROCESS'

/** Worker returns pitch detection results. */
export const MSG_RESULT = 'RESULT'

/** Worker reports an error. */
export const MSG_ERROR = 'ERROR'

/** Worker reports performance metrics. */
export const MSG_PERF = 'PERF'

/**
 * Build an INIT message payload.
 * @param {number} sampleRate
 * @param {number} bufferSize
 * @param {string} instrument - 'violin' | 'viola' | 'cello' | 'double-bass'
 */
export function createInitMessage(sampleRate, bufferSize, instrument) {
  return {
    type: MSG_INIT,
    sampleRate,
    bufferSize,
    instrument,
  }
}

/**
 * Build a PROCESS message payload with a transferable Float32Array.
 * @param {Float32Array} audioBuffer
 * @returns {{ message: object, transfer: ArrayBuffer[] }}
 */
export function createProcessMessage(audioBuffer) {
  return {
    message: { type: MSG_PROCESS, buffer: audioBuffer },
    transfer: [audioBuffer.buffer],
  }
}

/**
 * Build a RESULT message payload (used inside the worker).
 * @param {number|null} frequency
 * @param {number} confidence
 * @param {string|null} note
 * @param {number|null} cents
 */
export function createResultMessage(frequency, confidence, note, cents) {
  return {
    type: MSG_RESULT,
    frequency,
    confidence,
    note,
    cents,
  }
}

/**
 * Build an ERROR message payload.
 * @param {string} message
 */
export function createErrorMessage(message) {
  return { type: MSG_ERROR, error: message }
}

/**
 * Build a PERF message payload.
 * @param {number} processingTimeMs
 * @param {boolean} exceeded - true if processing time exceeded the 30ms budget
 */
export function createPerfMessage(processingTimeMs, exceeded) {
  return {
    type: MSG_PERF,
    processingTimeMs,
    exceeded,
  }
}
