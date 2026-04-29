/**
 * Live Audio Tracker - Real-time pitch tracking with sheet music comparison
 * Combines microphone input, pitch detection, vibrato filtering, and score comparison
 *
 * Uses PYINPitchDetector, PolyphonicPitchDetector, and VibratoFilter from dsp-engine.js
 * when available, or falls back to PitchDetector from pitch-detector.js
 */

class LiveAudioTracker {
    constructor() {
        this.audioEngine = null;
        this.monophonicDetector = null;
        this.polyphonicDetector = null;
        this.vibratoFilters = [];

        // Rhythm tracking state
        this.rhythmEvents = [];
        this.lastNoteOnsetTime = null;
        this.beatIntervalMs = 500; // Default 120 BPM

        this.config = {
            sampleRate: 44100,
            bufferSize: 2048,
            hopSize: 512,
            latencyBudget: 30,
            confidenceThreshold: 0.85,
            minFrequency: 27.5,
            maxFrequency: 4186,
            polyphonicEnabled: true,
            maxVoices: 2,
            vibratoWindowSize: 10,
            centsTolerance: 50,
            rhythmToleranceMs: 100 // Acceptable timing deviation in ms
        };

        this.isTracking = false;
        this.currentInstrument = 'violin';
        this.currentScore = null;
        this.currentPosition = 0;
        this.currentNotes = [];

        this.totalNotesPlayed = 0;
        this.correctNotes = 0;
        this.correctRhythms = 0;
        this.averageCentsDeviation = 0;
        this.averageRhythmDeviation = 0;
        this.sessionStartTime = null;

        this.onPitchDetected = null;
        this.onNoteMatch = null;
        this.onRhythmMatch = null;
        this.onError = null;
        this.onLevelChange = null;
    }

    async initialize(audioEngine = null) {
        try {
            if (audioEngine) {
                this.audioEngine = audioEngine;
            } else {
                // Create a basic audio engine if none provided
                this.audioEngine = this._createBasicAudioEngine();
            }

            // Use DSP engine components if available, otherwise fall back
            const useDSPEngine = typeof PYINPitchDetector !== 'undefined';

            if (useDSPEngine) {
                // Use the more sophisticated DSP engine components
                this.monophonicDetector = new PYINPitchDetector({
                    sampleRate: this.config.sampleRate,
                    bufferSize: this.config.bufferSize,
                    minFrequency: this.config.minFrequency,
                    maxFrequency: this.config.maxFrequency
                });

                if (typeof PolyphonicPitchDetector !== 'undefined') {
                    this.polyphonicDetector = new PolyphonicPitchDetector();
                    this.polyphonicDetector.configure({
                        sampleRate: this.config.sampleRate,
                        bufferSize: this.config.bufferSize,
                        maxVoices: this.config.maxVoices,
                        confidenceThreshold: this.config.confidenceThreshold * 0.8,
                        minFrequency: this.config.minFrequency,
                        maxFrequency: this.config.maxFrequency
                    });
                }

                // Use VibratoSmoother from DSP engine
                if (typeof VibratoSmoother !== 'undefined') {
                    this.vibratoFilters = [];
                    for (let i = 0; i < this.config.maxVoices; i++) {
                        this.vibratoFilters.push(new VibratoSmoother({
                            windowMs: 200,
                            minConfidence: this.config.confidenceThreshold * 0.8
                        }));
                    }
                }
            } else {
                // Fall back to basic pitch detector
                this.monophonicDetector = new PitchDetector();
                this.monophonicDetector.configure({
                    sampleRate: this.config.sampleRate,
                    bufferSize: this.config.bufferSize,
                    confidenceThreshold: this.config.confidenceThreshold,
                    minFrequency: this.config.minFrequency,
                    maxFrequency: this.config.maxFrequency
                });

                if (typeof VibratoFilter !== 'undefined') {
                    this.initializeVibratoFilters();
                }
            }

            this.setInstrument(this.currentInstrument);

            console.log('Live Audio Tracker initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize Live Audio Tracker:', error);
            if (this.onError) this.onError(error);
            throw error;
        }
    }

    _createBasicAudioEngine() {
        // Basic audio engine that provides the interface expected by LiveAudioTracker
        return {
            isListening: false,
            async requestMicrophoneAccess() {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                });
                this.stream = stream;
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.source = this.audioContext.createMediaStreamSource(stream);
                this.scriptProcessor = this.audioContext.createScriptProcessor(
                    2048, 1, 1
                );
                this.isListening = true;
                return stream;
            },
            setAudioDataCallback(callback) {
                this.audioDataCallback = callback;
                this.scriptProcessor.onaudioprocess = (event) => {
                    if (this.audioDataCallback) {
                        this.audioDataCallback({
                            timeData: event.inputBuffer.getChannelData(0)
                        });
                    }
                };
                this.source.connect(this.scriptProcessor);
                this.scriptProcessor.connect(this.audioContext.destination);
            },
            getRMSLevel(buffer) {
                let sum = 0;
                for (let i = 0; i < buffer.length; i++) {
                    sum += buffer[i] * buffer[i];
                }
                return Math.sqrt(sum / buffer.length);
            },
            stopListening() {
                if (this.scriptProcessor) {
                    this.scriptProcessor.disconnect();
                    this.scriptProcessor = null;
                }
                if (this.source) {
                    this.source.disconnect();
                    this.source = null;
                }
                if (this.stream) {
                    this.stream.getTracks().forEach(t => t.stop());
                    this.stream = null;
                }
                this.isListening = false;
            },
            getAudioLevel() {
                return 0;
            },
            dispose() {
                this.stopListening();
                if (this.audioContext) {
                    this.audioContext.close();
                    this.audioContext = null;
                }
            }
        };
    }

    initializeVibratoFilters() {
        this.vibratoFilters = [];
        for (let i = 0; i < this.config.maxVoices; i++) {
            this.vibratoFilters.push(new VibratoFilter({
                windowSize: this.config.vibratoWindowSize,
                minConfidence: this.config.confidenceThreshold * 0.8
            }));
        }
    }

    setInstrument(instrument) {
        this.currentInstrument = instrument;

        const ranges = {
            violin: { min: 196, max: 2637 },
            viola: { min: 130, max: 1319 },
            cello: { min: 65, max: 987 },
            bass: { min: 41, max: 262 }
        };

        const range = ranges[instrument] || ranges.violin;
        this.config.minFrequency = range.min;
        this.config.maxFrequency = range.max;

        if (this.monophonicDetector) {
            this.monophonicDetector.configure({
                minFrequency: range.min,
                maxFrequency: range.max
            });
        }

        if (this.polyphonicDetector) {
            this.polyphonicDetector.configure({
                minFrequency: range.min,
                maxFrequency: range.max
            });
        }
    }

    /**
     * Set the tempo for rhythm analysis
     * @param {number} bpm - Beats per minute
     */
    setTempo(bpm) {
        this.beatIntervalMs = 60000 / bpm;
    }

    setScore(score) {
        this.currentScore = score;
        this.currentPosition = 0;
        this.totalNotesPlayed = 0;
        this.correctNotes = 0;
        this.correctRhythms = 0;
        this.averageCentsDeviation = 0;
        this.averageRhythmDeviation = 0;
        this.sessionStartTime = Date.now();
        this.rhythmEvents = [];
        this.lastNoteOnsetTime = null;
    }

    async startTracking() {
        if (this.isTracking) return;

        try {
            if (!this.audioEngine.isListening) {
                await this.audioEngine.requestMicrophoneAccess();
            }

            this.audioEngine.setAudioDataCallback((data) => this.processAudioData(data));

            const intervalMs = Math.max(10, (this.config.hopSize / this.config.sampleRate) * 1000);
            this.audioEngine.startCapture(null, intervalMs);

            this.isTracking = true;
            this.sessionStartTime = Date.now();

            console.log('Live tracking started with interval:', intervalMs, 'ms');
        } catch (error) {
            console.error('Failed to start tracking:', error);
            if (this.onError) this.onError(error);
            throw error;
        }
    }

    stopTracking() {
        if (!this.isTracking) return;

        this.audioEngine.stopListening();
        this.isTracking = false;
        this.vibratoFilters.forEach(filter => filter.reset?.() || filter.reset());

        console.log('Live tracking stopped');
    }

    processAudioData(data) {
        const timeData = data.timeData;
        if (!timeData || timeData.length < this.config.bufferSize) {
            return;
        }

        const level = this.audioEngine.getRMSLevel(timeData);
        const minLevel = 0.01;

        if (this.onLevelChange) {
            this.onLevelChange(level);
        }

        if (level < minLevel) {
            this.currentNotes = [];
            return;
        }

        let detectedNotes = [];

        if (this.config.polyphonicEnabled && this.polyphonicDetector) {
            detectedNotes = this.polyphonicDetector.detectPolyphonic(timeData);

            if (detectedNotes.length === 0) {
                const monoResult = this.monophonicDetector.detect(timeData);
                if (monoResult.frequency && monoResult.confidence >= this.config.confidenceThreshold) {
                    const noteInfo = this.monophonicDetector.frequencyToNote
                        ? this.monophonicDetector.frequencyToNote(monoResult.frequency)
                        : { name: '?', octave: 0, midi: 0 };
                    detectedNotes = [{
                        ...noteInfo,
                        frequency: monoResult.frequency,
                        confidence: monoResult.confidence,
                        centsDeviation: 0
                    }];
                }
            }
        } else {
            const result = this.monophonicDetector.detect(timeData);
            if (result.frequency && result.confidence >= this.config.confidenceThreshold) {
                const noteInfo = this.monophonicDetector.frequencyToNote
                    ? this.monophonicDetector.frequencyToNote(result.frequency)
                    : { name: '?', octave: 0, midi: 0 };
                detectedNotes = [{
                    ...noteInfo,
                    frequency: result.frequency,
                    confidence: result.confidence,
                    centsDeviation: 0
                }];
            }
        }

        const filteredNotes = this.applyVibratoFiltering(detectedNotes);
        this.currentNotes = filteredNotes;

        if (filteredNotes.length > 0) {
            // Track note onset for rhythm analysis
            const now = Date.now();
            if (this.lastNoteOnsetTime === null ||
                (now - this.lastNoteOnsetTime) > (this.beatIntervalMs * 0.5)) {
                // New note detected (minimum half beat gap to avoid double triggers)
                this.trackRhythm(filteredNotes[0], now);
            }

            if (this.currentScore) {
                this.compareToScore(filteredNotes);
            }
        }

        if (this.onPitchDetected) {
            this.onPitchDetected({
                notes: filteredNotes,
                level: level,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Track rhythm timing for a detected note
     */
    trackRhythm(note, timestamp) {
        const expectedTime = this.lastNoteOnsetTime !== null
            ? this.lastNoteOnsetTime + this.beatIntervalMs
            : timestamp;

        const rhythmDeviation = timestamp - expectedTime;
        const rhythmEvent = {
            timestamp,
            note: note.midi,
            expectedTime,
            actualTime: timestamp,
            deviationMs: rhythmDeviation,
            isOnTime: Math.abs(rhythmDeviation) <= this.config.rhythmToleranceMs
        };

        this.rhythmEvents.push(rhythmEvent);
        if (this.rhythmEvents.length > 100) {
            this.rhythmEvents.shift();
        }

        if (this.onRhythmMatch) {
            this.onRhythmMatch(rhythmEvent);
        }

        this.lastNoteOnsetTime = timestamp;
    }

    applyVibratoFiltering(notes) {
        return notes.map((note, index) => {
            if (index >= this.vibratoFilters.length) return note;

            const filter = this.vibratoFilters[index];
            let targetFrequency = null;

            if (this.currentScore) {
                const expectedNote = this.getExpectedNoteAtPosition();
                if (expectedNote) {
                    targetFrequency = expectedNote.getFrequency
                        ? expectedNote.getFrequency()
                        : expectedNote.frequency;
                }
            }

            // Use the appropriate vibrato filter method
            let smoothedFrequency = note.frequency;
            let smoothedCentsDeviation = 0;
            let isVibrato = false;
            let vibratoDepth = 0;

            if (filter.process) {
                // DSP Engine VibratoSmoother
                const result = filter.process(note.frequency, note.confidence);
                smoothedFrequency = result.smoothedFrequency || note.frequency;
                smoothedCentsDeviation = result.smoothedCents || 0;
                isVibrato = result.isVibrato || false;
                vibratoDepth = result.vibratoExtent || 0;
            } else if (filter.addSample) {
                // Basic VibratoFilter
                filter.addSample(note.frequency, note.confidence, targetFrequency);
                smoothedFrequency = filter.getSmoothedFrequency() || note.frequency;
                smoothedCentsDeviation = filter.getSmoothedCentsDeviation() || 0;
                const vibratoStatus = filter.getVibratoStatus();
                isVibrato = vibratoStatus.isVibrato || false;
                vibratoDepth = vibratoStatus.depth || 0;
            }

            return {
                ...note,
                rawFrequency: note.frequency,
                smoothedFrequency: smoothedFrequency,
                smoothedCentsDeviation: smoothedCentsDeviation,
                isVibrato: isVibrato,
                vibratoDepth: vibratoDepth
            };
        });
    }

    getExpectedNoteAtPosition() {
        if (!this.currentScore) return null;
        const allNotes = this.currentScore.getAllNotes
            ? this.currentScore.getAllNotes()
            : (this.currentScore.notes || []);
        return allNotes[this.currentPosition] || null;
    }

    compareToScore(detectedNotes) {
        if (!this.currentScore) return;

        const expectedNote = this.getExpectedNoteAtPosition();
        if (!expectedNote) return;

        const expectedMIDI = expectedNote.getMIDI
            ? expectedNote.getMIDI()
            : expectedNote.midi;
        const expectedFreq = expectedNote.getFrequency
            ? expectedNote.getFrequency()
            : (expectedNote.frequency || 440);

        for (const note of detectedNotes) {
            if (note.midi === expectedMIDI) {
                const smoothedFreq = note.smoothedFrequency || note.frequency;
                const centsDeviation = Math.round(
                    1200 * Math.log2(smoothedFreq / expectedFreq)
                );

                note.centsDeviation = centsDeviation;
                note.matched = Math.abs(centsDeviation) <= this.config.centsTolerance;

                if (note.matched) {
                    this.correctNotes++;
                    this.advancePosition();
                }

                this.totalNotesPlayed++;
                this.averageCentsDeviation =
                    ((this.averageCentsDeviation * (this.totalNotesPlayed - 1)) + Math.abs(centsDeviation))
                    / this.totalNotesPlayed;

                if (this.onNoteMatch) {
                    this.onNoteMatch({
                        matched: note.matched,
                        expectedNote: expectedNote,
                        detectedNote: note,
                        centsDeviation: centsDeviation,
                        position: this.currentPosition,
                        totalNotes: this.currentScore.getAllNotes?.()?.length || 0
                    });
                }

                break;
            }
        }
    }

    advancePosition() {
        const totalNotes = this.currentScore?.getAllNotes?.()?.length
            || this.currentScore?.notes?.length
            || 0;
        if (this.currentPosition < totalNotes - 1) {
            this.currentPosition++;
        }
    }

    setPosition(position) {
        const totalNotes = this.currentScore
            ? (this.currentScore.getAllNotes?.()?.length || this.currentScore.notes?.length || 0)
            : 0;
        this.currentPosition = Math.max(0, Math.min(position, totalNotes - 1));
    }

    getState() {
        return {
            isTracking: this.isTracking,
            currentNotes: this.currentNotes,
            currentPosition: this.currentPosition,
            totalNotesPlayed: this.totalNotesPlayed,
            correctNotes: this.correctNotes,
            correctRhythms: this.correctRhythms,
            averageCentsDeviation: Math.round(this.averageCentsDeviation),
            averageRhythmDeviation: Math.round(this.averageRhythmDeviation),
            accuracy: this.totalNotesPlayed > 0
                ? Math.round((this.correctNotes / this.totalNotesPlayed) * 100)
                : 0,
            rhythmAccuracy: this.rhythmEvents.length > 0
                ? Math.round((this.rhythmEvents.filter(e => e.isOnTime).length / this.rhythmEvents.length) * 100)
                : 100,
            sessionDuration: this.sessionStartTime ? Date.now() - this.sessionStartTime : 0,
            recentRhythmEvents: this.rhythmEvents.slice(-10)
        };
    }

    getPitchDeviation() {
        if (this.currentNotes.length === 0) return null;
        const note = this.currentNotes[0];
        return note.smoothedCentsDeviation ?? note.centsDeviation ?? 0;
    }

    isInTune() {
        if (this.currentNotes.length === 0) return false;
        const deviation = Math.abs(this.getPitchDeviation());
        return deviation <= this.config.centsTolerance;
    }

    getAudioLevel() {
        return this.audioEngine ? this.audioEngine.getAudioLevel() : 0;
    }

    getRhythmAnalysis() {
        if (this.rhythmEvents.length === 0) {
            return {
                totalEvents: 0,
                onTimeCount: 0,
                earlyCount: 0,
                lateCount: 0,
                averageDeviation: 0,
                accuracy: 100
            };
        }

        const onTime = this.rhythmEvents.filter(e => e.isOnTime);
        const early = this.rhythmEvents.filter(e => e.deviationMs < -this.config.rhythmToleranceMs);
        const late = this.rhythmEvents.filter(e => e.deviationMs > this.config.rhythmToleranceMs);
        const avgDeviation = this.rhythmEvents.reduce((sum, e) => sum + e.deviationMs, 0) / this.rhythmEvents.length;

        return {
            totalEvents: this.rhythmEvents.length,
            onTimeCount: onTime.length,
            earlyCount: early.length,
            lateCount: late.length,
            averageDeviation: Math.round(avgDeviation),
            accuracy: Math.round((onTime.length / this.rhythmEvents.length) * 100)
        };
    }

    dispose() {
        this.stopTracking();
        if (this.audioEngine) {
            this.audioEngine.dispose();
            this.audioEngine = null;
        }
        this.vibratoFilters.forEach(filter => filter.reset?.() || filter.reset());
        this.currentNotes = [];
        this.rhythmEvents = [];
    }
}

// Export for browser and Node.js
if (typeof window !== 'undefined') {
    window.LiveAudioTracker = LiveAudioTracker;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LiveAudioTracker };
}
