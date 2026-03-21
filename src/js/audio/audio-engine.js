/**
 * Audio Engine - Web Audio API management
 * Handles microphone input, audio context, and stream management
 */

class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.gainNode = null;
        this.inputFilter = null;
        this.isInitialized = false;
        this.isListening = false;
        this.bufferSize = 2048;
        this.sampleRate = 44100;

        // Current instrument calibration
        this.currentInstrument = null;
        this.instrumentRanges = {
            violin: { minFreq: 196, maxFreq: 2637 },
            viola: { minFreq: 130, maxFreq: 1760 },
            cello: { minFreq: 65, maxFreq: 987 },
            bass: { minFreq: 41, maxFreq: 523 }
        };

        // Callbacks
        this.onAudioData = null;
        this.onLevelChange = null;
        this.onError = null;
        this.onDeviceChange = null;
    }

    async init() {
        try {
            // Create audio context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext({
                sampleRate: this.sampleRate,
                latencyHint: 'interactive'
            });

            // Resume context if suspended (required for user gesture)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 4096;
            this.analyser.smoothingTimeConstant = 0.8;

            // Create gain node for volume control
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 1.0;

            // Connect nodes
            this.gainNode.connect(this.analyser);

            this.isInitialized = true;
            console.log('Audio Engine initialized with sample rate:', this.sampleRate);

            return true;
        } catch (error) {
            console.error('Audio Engine initialization failed:', error);
            if (this.onError) {
                this.onError(error);
            }
            throw error;
        }
    }

    async requestMicrophoneAccess() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Disconnect previous microphone if any
            if (this.microphone) {
                this.microphone.disconnect();
            }

            // Create media stream source
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.gainNode);

            this.isListening = true;
            console.log('Microphone access granted');

            return stream;
        } catch (error) {
            console.error('Microphone access denied:', error);
            if (this.onError) {
                this.onError(new Error('Microphone access denied'));
            }
            throw error;
        }
    }

    getAnalyserData() {
        if (!this.analyser) return null;

        const bufferLength = this.analyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        this.analyser.getFloatTimeDomainData(dataArray);

        return dataArray;
    }

    getFrequencyData() {
        if (!this.analyser) return null;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        return dataArray;
    }

    getRMSLevel(dataArray) {
        if (!dataArray) return 0;

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        return Math.sqrt(sum / dataArray.length);
    }

    getAudioLevel() {
        const dataArray = this.getAnalyserData();
        return this.getRMSLevel(dataArray);
    }

    setGain(value) {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(2, value));
        }
    }

    stopListening() {
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        this.isListening = false;
    }

    setAudioDataCallback(callback) {
        this.onAudioData = callback;
    }

    startCapture(callback, interval = 50) {
        if (!this.isListening || !this.analyser) {
            console.warn('Audio not initialized');
            return;
        }

        this.onAudioData = callback;

        const capture = () => {
            if (!this.isListening) return;

            const timeData = this.getAnalyserData();
            const frequencyData = this.getFrequencyData();
            const level = this.getAudioLevel();

            if (this.onAudioData) {
                this.onAudioData({
                    timeData,
                    frequencyData,
                    level,
                    sampleRate: this.sampleRate,
                    bufferSize: this.analyser.fftSize
                });
            }

            setTimeout(capture, interval);
        };

        capture();
    }

    async enumerateDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(d => d.kind === 'audioinput');
        } catch (error) {
            console.error('Error enumerating devices:', error);
            return [];
        }
    }

    async switchDevice(deviceId) {
        this.stopListening();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: { exact: deviceId },
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            if (this.microphone) {
                this.microphone.disconnect();
            }

            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.gainNode);
            this.isListening = true;

            return true;
        } catch (error) {
            console.error('Error switching device:', error);
            if (this.onError) {
                this.onError(error);
            }
            return false;
        }
    }

    getState() {
        return {
            initialized: this.isInitialized,
            listening: this.isListening,
            sampleRate: this.sampleRate,
            contextState: this.audioContext?.state || 'closed'
        };
    }

    /**
     * Set instrument calibration - applies bandpass filter for specific instrument
     * @param {string} instrument - Instrument key (violin, viola, cello, bass)
     */
    setInstrumentCalibration(instrument) {
        if (!this.instrumentRanges[instrument]) {
            console.warn('Unknown instrument:', instrument);
            return false;
        }

        this.currentInstrument = instrument;
        const range = this.instrumentRanges[instrument];

        // Apply bandpass filter for instrument frequency range
        this.applyBandpassFilter(range.minFreq, range.maxFreq);

        console.log(`Instrument calibration set: ${instrument} (${range.minFreq}-${range.maxFreq} Hz)`);
        return true;
    }

    /**
     * Apply bandpass filter to remove out-of-range frequencies
     * Filters out sympathetic vibrations and noise outside instrument range
     * @param {number} minFreq - Minimum frequency in Hz
     * @param {number} maxFreq - Maximum frequency in Hz
     */
    applyBandpassFilter(minFreq, maxFreq) {
        if (!this.audioContext) return;

        // Disconnect existing filter if any
        if (this.inputFilter) {
            this.inputFilter.disconnect();
        }

        // Create bandpass filter
        this.inputFilter = this.audioContext.createBiquadFilter();
        this.inputFilter.type = 'bandpass';
        this.inputFilter.frequency.value = (minFreq + maxFreq) / 2; // Center frequency
        this.inputFilter.Q.value = 1.0; // Quality factor - wider passband for string instruments

        // Reconnect audio chain with filter
        if (this.microphone && this.gainNode) {
            this.microphone.disconnect();
            this.microphone.connect(this.inputFilter);
            this.inputFilter.connect(this.gainNode);
        }
    }

    /**
     * Apply notch filter to remove sympathetic vibrations
     * @param {number} freq - Frequency to notch out (Hz)
     * @param {number} bandwidth - Bandwidth in Hz
     */
    applyNotchFilter(freq, bandwidth = 20) {
        if (!this.audioContext) return;

        const notchFilter = this.audioContext.createBiquadFilter();
        notchFilter.type = 'notch';
        notchFilter.frequency.value = freq;
        notchFilter.Q.value = freq / bandwidth;

        // Insert into audio chain
        if (this.inputFilter) {
            this.inputFilter.connect(notchFilter);
            notchFilter.connect(this.gainNode);
        }
    }

    /**
     * Get current instrument range
     * @returns {Object|null}
     */
    getCurrentInstrumentRange() {
        if (!this.currentInstrument) return null;
        return this.instrumentRanges[this.currentInstrument];
    }

    dispose() {
        this.stopListening();

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.isInitialized = false;
    }
}

// Export for use in other modules
window.AudioEngine = AudioEngine;