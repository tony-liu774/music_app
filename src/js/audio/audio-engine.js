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
        this.isInitialized = false;
        this.isListening = false;
        this.bufferSize = 2048;
        this.sampleRate = 44100;

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