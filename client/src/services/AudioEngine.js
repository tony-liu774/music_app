/**
 * AudioEngine — standalone service class for managing the Web Audio API
 * pipeline, microphone access, and DSP worker communication.
 *
 * This is a non-React service that can be used from hooks or standalone.
 * It encapsulates AudioContext creation, suspension handling, worker
 * lifecycle, and real-time input level metering.
 */
import { DEFAULT_TUNING_REFERENCE } from '../workers/dsp-core.js'

const BUFFER_SIZE = 2048

/**
 * @typedef {object} AudioEngineOptions
 * @property {number} [bufferSize=2048]
 * @property {string} [instrument='violin']
 * @property {number} [tuningReference=440]
 */

export class AudioEngine {
  /**
   * @param {AudioEngineOptions} [options]
   */
  constructor(options = {}) {
    this.bufferSize = options.bufferSize ?? BUFFER_SIZE
    this.instrument = options.instrument ?? 'violin'
    this.tuningReference = options.tuningReference ?? DEFAULT_TUNING_REFERENCE

    /** @type {AudioContext|null} */
    this.audioContext = null
    /** @type {MediaStream|null} */
    this.stream = null
    /** @type {MediaStreamAudioSourceNode|null} */
    this.source = null
    /** @type {ScriptProcessorNode|null} */
    this.processor = null
    /** @type {AnalyserNode|null} */
    this.analyser = null
    /** @type {Worker|null} */
    this.worker = null

    this._running = false
    this._onResult = null
    this._onError = null
    this._onLevel = null
    this._levelBuffer = null
    this._resumeListeners = []
  }

  /** Whether the engine is currently processing audio. */
  get isRunning() {
    return this._running
  }

  /** Current AudioContext state, or 'closed' if no context. */
  get contextState() {
    return this.audioContext ? this.audioContext.state : 'closed'
  }

  /** Current sample rate from AudioContext. */
  get sampleRate() {
    return this.audioContext ? this.audioContext.sampleRate : 44100
  }

  /**
   * Register a callback for pitch detection results.
   * @param {function} callback — receives { frequency, confidence, note, cents, vibrato }
   */
  onResult(callback) {
    this._onResult = callback
  }

  /**
   * Register a callback for errors.
   * @param {function} callback — receives Error
   */
  onError(callback) {
    this._onError = callback
  }

  /**
   * Register a callback for real-time input level (0–1).
   * @param {function} callback — receives number (0–1)
   */
  onLevel(callback) {
    this._onLevel = callback
  }

  /**
   * Start the audio engine with a given MediaStream.
   * Creates AudioContext, AnalyserNode, spawns DSP worker, connects pipeline.
   *
   * CRITICAL: Handles AudioContext suspension by explicitly resuming
   * on first user interaction.
   *
   * @param {MediaStream} stream
   * @returns {Promise<void>}
   */
  async start(stream) {
    if (this._running) return

    this.stream = stream

    // 1. Create AudioContext with appropriate sample rate for pitch detection
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    this.audioContext = new AudioCtx({ sampleRate: 44100 })

    // Handle browser AudioContext suspension — must resume on user interaction
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    // Listen for state changes to handle mid-session suspension
    this.audioContext.addEventListener('statechange', this._handleStateChange)

    // Set up resume-on-interaction listeners
    this._addResumeListeners()

    const sampleRate = this.audioContext.sampleRate

    // 2. Spawn the DSP worker
    this.worker = new Worker(
      new URL('../workers/dsp-worker.js', import.meta.url),
      { type: 'module' },
    )
    this.worker.onmessage = this._handleWorkerMessage
    this.worker.onerror = this._handleWorkerError

    // 3. Initialize the worker
    this.worker.postMessage({
      type: 'INIT',
      sampleRate,
      bufferSize: this.bufferSize,
      instrument: this.instrument,
      tuningReference: this.tuningReference,
    })

    // 4. Create AnalyserNode for level metering
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 256
    this._levelBuffer = new Uint8Array(this.analyser.frequencyBinCount)

    // 5. Connect pipeline: MediaStreamSource → AnalyserNode → ScriptProcessorNode
    this.source = this.audioContext.createMediaStreamSource(stream)
    this.processor = this.audioContext.createScriptProcessor(
      this.bufferSize,
      1,
      1,
    )

    this.processor.onaudioprocess = this._handleAudioProcess

    this.source.connect(this.analyser)
    this.analyser.connect(this.processor)
    this.processor.connect(this.audioContext.destination)

    this._running = true
  }

  /**
   * Stop the audio engine and release all resources.
   */
  stop() {
    this._running = false

    if (this.processor) {
      this.processor.onaudioprocess = null
      this.processor.disconnect()
      this.processor = null
    }

    if (this.analyser) {
      this.analyser.disconnect()
      this.analyser = null
    }

    if (this.source) {
      this.source.disconnect()
      this.source = null
    }

    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    if (this.audioContext) {
      this.audioContext.removeEventListener(
        'statechange',
        this._handleStateChange,
      )
      this.audioContext.close()
      this.audioContext = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
    }

    this._removeResumeListeners()
    this._levelBuffer = null
  }

  /**
   * Attempt to resume a suspended AudioContext.
   * @returns {Promise<boolean>} true if resumed successfully
   */
  async resume() {
    if (!this.audioContext || this.audioContext.state !== 'suspended') {
      return true
    }
    try {
      await this.audioContext.resume()
      return true
    } catch {
      return false
    }
  }

  /**
   * Get the current RMS input level (0–1) from the AnalyserNode.
   * Can be called on a requestAnimationFrame loop for level metering.
   * @returns {number}
   */
  getInputLevel() {
    if (!this.analyser || !this._levelBuffer) return 0
    this.analyser.getByteTimeDomainData(this._levelBuffer)
    let sum = 0
    for (let i = 0; i < this._levelBuffer.length; i++) {
      const sample = (this._levelBuffer[i] - 128) / 128
      sum += sample * sample
    }
    return Math.sqrt(sum / this._levelBuffer.length)
  }

  // --- Private handlers (arrow functions to preserve `this`) ---

  /** @private */
  _handleAudioProcess = (audioEvent) => {
    if (!this._running || !this.worker) return

    const inputData = audioEvent.inputBuffer.getChannelData(0)
    const copy = new Float32Array(inputData.length)
    copy.set(inputData)

    this.worker.postMessage({ type: 'PROCESS', buffer: copy }, [copy.buffer])

    // Compute and report input level
    if (this._onLevel) {
      this._onLevel(this.getInputLevel())
    }
  }

  /** @private */
  _handleWorkerMessage = (e) => {
    const { type } = e.data
    if (type === 'RESULT' && this._onResult) {
      this._onResult(e.data)
    } else if (type === 'ERROR' && this._onError) {
      this._onError(new Error(e.data.error))
    }
  }

  /** @private */
  _handleWorkerError = (e) => {
    if (this._onError) {
      this._onError(new Error(e.message || 'Worker error'))
    }
  }

  /** @private */
  _handleStateChange = () => {
    if (
      this.audioContext &&
      this.audioContext.state === 'suspended' &&
      this._running
    ) {
      // Browser suspended our context — try to resume
      this.resume()
    }
  }

  /** @private — Add click/keydown/touchstart listeners to auto-resume on user gesture */
  _addResumeListeners() {
    const handler = () => this.resume()
    for (const event of ['click', 'keydown', 'touchstart']) {
      document.addEventListener(event, handler, { once: false, passive: true })
      this._resumeListeners.push({ event, handler })
    }
  }

  /** @private */
  _removeResumeListeners() {
    for (const { event, handler } of this._resumeListeners) {
      document.removeEventListener(event, handler)
    }
    this._resumeListeners = []
  }
}
