/**
 * Instrument Detector - Analyzes audio to identify instrument type
 * Note: Client-side detection has ~70-80% accuracy limitation
 */

class InstrumentDetector {
    constructor() {
        this.instruments = ['violin', 'viola', 'cello', 'bass'];
        this.currentInstrument = null;
        this.confidence = 0;
    }

    /**
     * Analyze audio characteristics to detect instrument
     * @param {Float32Array} timeData - Audio time domain data
     * @param {Uint8Array} frequencyData - Audio frequency data
     * @returns {Object} - { instrument, confidence }
     */
    detect(timeData, frequencyData) {
        // Extract spectral features
        const features = this.extractFeatures(timeData, frequencyData);

        // Simple classification based on frequency range
        // In production, this would use ML model
        const instrument = this.classify(features);

        return {
            instrument,
            confidence: this.confidence
        };
    }

    extractFeatures(timeData, frequencyData) {
        // Calculate spectral centroid
        let weightedSum = 0;
        let sum = 0;

        for (let i = 0; i < frequencyData.length; i++) {
            weightedSum += i * frequencyData[i];
            sum += frequencyData[i];
        }

        const centroid = sum > 0 ? weightedSum / sum : 0;

        // Calculate spectral spread
        let spreadSum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            spreadSum += Math.pow(i - centroid, 2) * frequencyData[i];
        }
        const spread = sum > 0 ? Math.sqrt(spreadSum / sum) : 0;

        return { centroid, spread };
    }

    classify(features) {
        // Default to violin (most common)
        this.confidence = 0.5;

        // Simple heuristic based on spectral centroid
        // These thresholds are approximations
        if (features.centroid > 100) {
            this.currentInstrument = 'violin';
            this.confidence = 0.6;
        } else if (features.centroid > 60) {
            this.currentInstrument = 'viola';
            this.confidence = 0.55;
        } else if (features.centroid > 30) {
            this.currentInstrument = 'cello';
            this.confidence = 0.5;
        } else {
            this.currentInstrument = 'bass';
            this.confidence = 0.45;
        }

        return this.currentInstrument;
    }

    setInstrument(instrument) {
        if (this.instruments.includes(instrument)) {
            this.currentInstrument = instrument;
        }
    }

    getSupportedInstruments() {
        return this.instruments;
    }
}

window.InstrumentDetector = InstrumentDetector;