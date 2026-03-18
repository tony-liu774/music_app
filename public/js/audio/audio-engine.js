/**
 * AudioEngine - Core audio processing infrastructure using Web Audio API
 * Provides low-latency microphone input capture and analysis
 */
class AudioEngine {
    constructor(options = {}) {
        this.options = {
            sampleRate: options.sampleRate || 44100,
            fftSize: options.fftSize || 2048,
            smoothingTimeConstant: options.smoothingTimeConstant || 0.8,
            ...options
        };

        // Audio context and nodes
        this.audioContext = null;
        this.mediaStream = null;
        this.mediaStreamSource = null;
        this.gainNode = null;
        this.analyserNode = null;

        // Worklet processor
        this.processorNode = null;
        this.workletModuleLoaded = false;

        // State
        this.isRunning = false;
        this.currentDeviceId = null;

        // Callbacks
        this.onLevelUpdate = options.onLevelUpdate || null;
        this.onWaveformData = options.onWaveformData || null;
        this.onError = options.onError || null;
        this.onStatusChange = options.onStatusChange || null;

        // Audio data buffers
        this.waveformData = new Float32Array(this.options.fftSize);
        this.frequencyData = new Uint8Array(this.options.fftSize / 2);

        // Level monitoring
        this.currentLevel = -60;
        this.peakLevel = -60;
    }

    /**
     * Initialize the AudioContext
     */
    async initialize() {
        try {
            this._updateStatus('Initializing audio context...');

            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass({
                sampleRate: this.options.sampleRate
            });

            // Load AudioWorklet module
            await this._loadWorkletModule();

            this._updateStatus('Audio context initialized');
            return true;
        } catch (error) {
            this._handleError('Failed to initialize audio context', error);
            return false;
        }
    }

    /**
     * Load the AudioWorklet module for sample-level processing
     */
    async _loadWorkletModule() {
        try {
            // Check if worklet is supported
            if (!this.audioContext.audioWorklet) {
                console.warn('AudioWorklet not supported, falling back to ScriptProcessorNode');
                this.workletModuleLoaded = false;
                return;
            }

            // Add the worklet processor
            await this.audioContext.audioWorklet.addModule('/js/audio/audio-processor.worklet.js');
            this.workletModuleLoaded = true;
        } catch (error) {
            console.warn('Failed to load AudioWorklet module:', error);
            this.workletModuleLoaded = false;
        }
    }

    /**
     * Request microphone permission and get available devices
     */
    async requestPermission() {
        try {
            this._updateStatus('Requesting microphone permission...');

            // First, try to enumerate devices to trigger permission prompt
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(d => d.kind === 'audioinput');

            if (audioInputs.length === 0) {
                throw new Error('No audio input devices found');
            }

            // Request permission by getting user media
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            this._updateStatus('Microphone permission granted');
            return true;
        } catch (error) {
            this._handleError('Microphone permission denied', error);
            return false;
        }
    }

    /**
     * Get list of available audio input devices
     */
    async getAudioDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'audioinput');
        } catch (error) {
            this._handleError('Failed to enumerate devices', error);
            return [];
        }
    }

    /**
     * Start capturing audio from specified device
     * @param {string} deviceId - Optional device ID
     */
    async start(deviceId = null) {
        if (this.isRunning) {
            console.warn('Audio engine is already running');
            return true;
        }

        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Get microphone stream
            const constraints = {
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: this.options.sampleRate
                }
            };

            this._updateStatus('Starting microphone...');
            this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.currentDeviceId = deviceId || this._getDeviceIdFromStream();

            // Create audio nodes
            await this._createAudioNodes();

            // Connect nodes
            this._connectNodes();

            this.isRunning = true;
            this._updateStatus('Microphone is active');

            // Start visualization loop
            this._startVisualizationLoop();

            return true;
        } catch (error) {
            this._handleError('Failed to start microphone', error);
            return false;
        }
    }

    /**
     * Get device ID from current stream
     */
    _getDeviceIdFromStream() {
        if (this.mediaStream && this.mediaStream.getAudioTracks().length > 0) {
            const track = this.mediaStream.getAudioTracks()[0];
            const settings = track.getSettings();
            return settings.deviceId;
        }
        return null;
    }

    /**
     * Create audio processing nodes
     */
    async _createAudioNodes() {
        // Create media stream source
        this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);

        // Create gain node for volume control
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 1.0;

        // Create analyser node for visualization
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = this.options.fftSize;
        this.analyserNode.smoothingTimeConstant = this.options.smoothingTimeConstant;

        // Create AudioWorklet processor for sample-level processing
        if (this.workletModuleLoaded && this.audioContext.audioWorklet) {
            this.processorNode = new AudioWorkletNode(
                this.audioContext,
                'audio-processor',
                {
                    processorOptions: {
                        fftSize: this.options.fftSize
                    }
                }
            );

            // Listen for processed audio data from worklet
            this.processorNode.port.onmessage = (event) => {
                if (event.data.type === 'level') {
                    this.currentLevel = event.data.level;
                    this.peakLevel = event.data.peak;

                    if (this.onLevelUpdate) {
                        this.onLevelUpdate(this.currentLevel, this.peakLevel);
                    }
                }
            };
        } else {
            // Fallback: use AnalyserNode for level detection
            this._setupFallbackLevelDetection();
        }
    }

    /**
     * Connect audio nodes together
     */
    _connectNodes() {
        // Disconnect any existing connections
        if (this.mediaStreamSource) {
            this.mediaStreamSource.disconnect();
        }

        // Connect: source -> gain -> analyser -> destination
        this.mediaStreamSource.connect(this.gainNode);
        this.gainNode.connect(this.analyserNode);

        // Also connect to processor if available
        if (this.processorNode) {
            this.gainNode.connect(this.processorNode);
            this.processorNode.connect(this.analyserNode);
        }

        // Connect to destination (speakers) - optional, can be disabled
        // this.analyserNode.connect(this.audioContext.destination);
    }

    /**
     * Setup fallback level detection using AnalyserNode
     */
    _setupFallbackLevelDetection() {
        // We'll calculate levels in the visualization loop
    }

    /**
     * Start the visualization/update loop
     */
    _startVisualizationLoop() {
        const updateVisualization = () => {
            if (!this.isRunning) return;

            // Get waveform data
            if (this.analyserNode) {
                this.analyserNode.getFloatTimeDomainData(this.waveformData);
                this.analyserNode.getByteFrequencyData(this.frequencyData);

                // Calculate RMS level if not using worklet
                if (!this.processorNode) {
                    const rms = this._calculateRMS(this.waveformData);
                    this.currentLevel = this._rmsToDb(rms);

                    // Update peak with decay
                    if (this.currentLevel > this.peakLevel) {
                        this.peakLevel = this.currentLevel;
                    } else {
                        this.peakLevel = Math.max(this.peakLevel - 0.5, this.currentLevel);
                    }

                    if (this.onLevelUpdate) {
                        this.onLevelUpdate(this.currentLevel, this.peakLevel);
                    }
                }

                // Send waveform data to callback
                if (this.onWaveformData) {
                    this.onWaveformData(this.waveformData, this.frequencyData);
                }
            }

            requestAnimationFrame(updateVisualization);
        };

        updateVisualization();
    }

    /**
     * Calculate RMS (Root Mean Square) from audio samples
     */
    _calculateRMS(samples) {
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
            sum += samples[i] * samples[i];
        }
        return Math.sqrt(sum / samples.length);
    }

    /**
     * Convert RMS to decibels
     */
    _rmsToDb(rms) {
        if (rms === 0) return -Infinity;
        const db = 20 * Math.log10(rms);
        return Math.max(-60, Math.min(0, db));
    }

    /**
     * Stop capturing audio
     */
    stop() {
        if (!this.isRunning) return;

        // Stop all tracks in the stream
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        // Disconnect nodes
        if (this.mediaStreamSource) {
            this.mediaStreamSource.disconnect();
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
        }
        if (this.analyserNode) {
            this.analyserNode.disconnect();
        }
        if (this.processorNode) {
            this.processorNode.disconnect();
        }

        this.isRunning = false;
        this.currentDeviceId = null;
        this.currentLevel = -60;
        this.peakLevel = -60;

        this._updateStatus('Microphone stopped');
    }

    /**
     * Set the gain (volume) level
     * @param {number} value - Gain value (0-2, default 1)
     */
    setGain(value) {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(2, value));
            return this.gainNode.gain.value;
        }
        return 1;
    }

    /**
     * Get current gain value
     */
    getGain() {
        return this.gainNode ? this.gainNode.gain.value : 1;
    }

    /**
     * Switch to a different audio input device
     * @param {string} deviceId - New device ID
     */
    async switchDevice(deviceId) {
        const wasRunning = this.isRunning;

        if (this.isRunning) {
            this.stop();
        }

        if (wasRunning) {
            await this.start(deviceId);
        }

        return wasRunning;
    }

    /**
     * Get current audio level in dB
     */
    getLevel() {
        return this.currentLevel;
    }

    /**
     * Get peak audio level in dB
     */
    getPeakLevel() {
        return this.peakLevel;
    }

    /**
     * Get waveform data for visualization
     */
    getWaveformData() {
        return this.waveformData;
    }

    /**
     * Get frequency data for visualization
     */
    getFrequencyData() {
        return this.frequencyData;
    }

    /**
     * Check if audio engine is running
     */
    isActive() {
        return this.isRunning;
    }

    /**
     * Get the AudioContext
     */
    getAudioContext() {
        return this.audioContext;
    }

    /**
     * Clean up and release resources
     */
    dispose() {
        this.stop();

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.waveformData = null;
        this.frequencyData = null;
    }

    /**
     * Update status message
     */
    _updateStatus(message) {
        if (this.onStatusChange) {
            this.onStatusChange(message);
        }
    }

    /**
     * Handle errors
     */
    _handleError(message, error) {
        console.error(message, error);
        if (this.onError) {
            this.onError(message, error);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioEngine;
}
