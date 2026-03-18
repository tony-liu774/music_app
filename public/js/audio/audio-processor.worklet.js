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

        // Buffers for processing
        this.sampleBuffer = new Float32Array(this.fftSize);
        this.bufferIndex = 0;

        // Level tracking
        this.currentLevel = -60;
        this.peakLevel = -60;
        this.peakHoldTime = 0;
        this.peakHoldDuration = 30; // frames to hold peak

        // RMS calculation
        this.frameCount = 0;
        this.frameSize = 256; // Process every 256 samples for efficiency

        // Listen for messages from main thread
        this.port.onmessage = (event) => {
            if (event.data.type === 'setFftSize') {
                this.fftSize = event.data.value;
                this.sampleBuffer = new Float32Array(this.fftSize);
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
        const input = inputs[0];

        // Check if we have input
        if (input && input.length > 0) {
            const channelData = input[0];

            if (channelData) {
                // Copy samples to buffer
                for (let i = 0; i < channelData.length; i++) {
                    if (this.bufferIndex < this.fftSize) {
                        this.sampleBuffer[this.bufferIndex] = channelData[i];
                        this.bufferIndex++;
                    } else {
                        // Shift buffer and add new sample
                        for (let j = 0; j < this.fftSize - 1; j++) {
                            this.sampleBuffer[j] = this.sampleBuffer[j + 1];
                        }
                        this.sampleBuffer[this.fftSize - 1] = channelData[i];
                    }
                }

                // Calculate level every frame
                this.frameCount++;
                if (this.frameCount >= 1) {
                    this._calculateLevel();
                    this.frameCount = 0;
                }
            }
        }

        // Pass through audio unchanged
        if (outputs[0] && inputs[0]) {
            for (let channel = 0; channel < outputs[0].length; channel++) {
                outputs[0][channel].set(inputs[0][channel] || new Float32Array(outputs[0][channel].length));
            }
        }

        return true;
    }

    /**
     * Calculate audio level from samples
     */
    _calculateLevel() {
        // Calculate RMS
        let sum = 0;
        const samplesToUse = Math.min(this.bufferIndex, this.fftSize);

        for (let i = 0; i < samplesToUse; i++) {
            const sample = this.sampleBuffer[i];
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
        } else if (this.peakHoldTime > 0) {
            this.peakHoldTime--;
        } else {
            // Decay peak
            this.peakLevel = Math.max(this.peakLevel - 0.5, this.currentLevel);
        }

        // Send level data to main thread
        this.port.postMessage({
            type: 'level',
            level: this.currentLevel,
            peak: this.peakLevel,
            rms: rms
        });
    }
}

// Register the processor
registerProcessor('audio-processor', AudioProcessor);
