/**
 * AudioProcessor - AudioWorklet for sample-level processing
 * Performs real-time audio analysis and level detection
 */
class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        // Configuration
        this.fftSize = 2048;
        this.smoothingFactor = 0.8;
        this.peakDecayRate = 10; // dB per second (default)
        this.messageInterval = 10; // Send messages every N frames

        // Ring buffer for O(1) sample insertion
        this.sampleBuffer = new Float32Array(this.fftSize);
        this.bufferWriteIndex = 0;
        this.samplesInBuffer = 0;

        // Level tracking
        this.currentLevel = -60;
        this.peakLevel = -60;
        this.peakHoldTime = 0;
        this.peakHoldDuration = 30; // frames to hold peak

        // Time/sample tracking for consistent decay
        this.sampleRate = 44100;
        this.samplesProcessed = 0;
        this.samplesAtPeakStart = 0;
        this.frameCount = 0;

        // Listen for messages from main thread
        this.port.onmessage = (event) => {
            try {
                if (event.data.type === 'setFftSize') {
                    this.fftSize = event.data.value;
                    this.sampleBuffer = new Float32Array(this.fftSize);
                    this.bufferWriteIndex = 0;
                    this.samplesInBuffer = 0;
                } else if (event.data.type === 'setPeakDecayRate') {
                    this.peakDecayRate = event.data.value;
                } else if (event.data.type === 'setMessageInterval') {
                    this.messageInterval = event.data.value;
                }
            } catch (e) {
                // Silently handle errors to prevent worklet crash
            }
        };
    }

    /**
     * Process audio samples
     * @param {Float32Array[]} inputs - Input audio data
     * @param {Float32Array[]} outputs - Output audio data
     * @param {Object} parameters - Audio parameters
     */
    process(inputs, outputs, parameters) {
        try {
            const input = inputs[0];
            const output = outputs[0];

            // Get number of channels
            const inputChannels = input ? input.length : 0;
            const outputChannels = output ? output.length : 0;

            // Process audio input
            if (input && inputChannels > 0 && input[0]) {
                const channelData = input[0];
                const length = channelData.length;

                // Ring buffer insertion - O(1) per sample
                for (let i = 0; i < length; i++) {
                    this.sampleBuffer[this.bufferWriteIndex] = channelData[i];
                    this.bufferWriteIndex = (this.bufferWriteIndex + 1) % this.fftSize;
                    if (this.samplesInBuffer < this.fftSize) {
                        this.samplesInBuffer++;
                    }
                }

                this.samplesProcessed += length;
                this.frameCount++;

                // Calculate level every frame
                this._calculateLevel();
            }

            // Pass through audio unchanged (with proper channel handling)
            if (output && input) {
                const numChannels = Math.min(inputChannels, outputChannels);

                for (let ch = 0; ch < numChannels; ch++) {
                    if (input[ch] && output[ch]) {
                        output[ch].set(input[ch]);
                    }
                }

                // Handle case where output has more channels than input
                for (let ch = numChannels; ch < outputChannels; ch++) {
                    if (output[ch]) {
                        output[ch].fill(0);
                    }
                }
            }

            return true;
        } catch (e) {
            // Prevent worklet crash on errors
            return true;
        }
    }

    /**
     * Calculate audio level from ring buffer samples
     */
    _calculateLevel() {
        if (this.samplesInBuffer === 0) return;

        // Calculate RMS from ring buffer (read in order)
        let sum = 0;
        const samplesToUse = Math.min(this.samplesInBuffer, this.fftSize);
        const readIndex = (this.bufferWriteIndex - samplesToUse + this.fftSize) % this.fftSize;

        for (let i = 0; i < samplesToUse; i++) {
            const idx = (readIndex + i) % this.fftSize;
            const sample = this.sampleBuffer[idx];
            sum += sample * sample;
        }

        const rms = Math.sqrt(sum / samplesToUse);

        // Convert to dB
        let db;
        if (rms > 0) {
            db = 20 * Math.log10(rms);
            db = Math.max(-60, Math.min(0, db)); // Clamp to -60 to 0 dB
        } else {
            db = -60;
        }

        // Apply smoothing
        if (this.currentLevel > -60) {
            this.currentLevel = (this.smoothingFactor * this.currentLevel) +
                                ((1 - this.smoothingFactor) * db);
        } else {
            this.currentLevel = db;
        }

        // Track peak with hold
        if (this.currentLevel > this.peakLevel) {
            this.peakLevel = this.currentLevel;
            this.peakHoldTime = this.peakHoldDuration;
            this.samplesAtPeakStart = this.samplesProcessed;
        } else if (this.peakHoldTime > 0) {
            this.peakHoldTime--;
        } else {
            // Time-based decay: calculate decay based on time since peak started falling
            const samplesSincePeakStart = this.samplesProcessed - this.samplesAtPeakStart;
            const timeInSeconds = samplesSincePeakStart / this.sampleRate;
            const decayAmount = this.peakDecayRate * timeInSeconds;
            this.peakLevel = Math.max(this.peakLevel - decayAmount, this.currentLevel);
        }

        // Rate limit messages to main thread
        if (this.frameCount >= this.messageInterval) {
            this.port.postMessage({
                type: 'level',
                level: this.currentLevel,
                peak: this.peakLevel,
                rms: rms
            });
            this.frameCount = 0;
        }
    }
}

// Register the processor
registerProcessor('audio-processor', AudioProcessor);
