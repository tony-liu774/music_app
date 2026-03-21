/**
 * Live Audio Tracker - Real-time pitch tracking with sheet music comparison
 * Combines microphone input, pitch detection, vibrato filtering, and score comparison
 */

class LiveAudioTracker {
    constructor() {
        this.audioEngine = null;
        this.monophonicDetector = null;
        this.polyphonicDetector = null;
        this.vibratoFilters = [];

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
            centsTolerance: 50
        };

        this.isTracking = false;
        this.currentInstrument = 'violin';
        this.currentScore = null;
        this.currentPosition = 0;
        this.currentNotes = [];

        this.totalNotesPlayed = 0;
        this.correctNotes = 0;
        this.averageCentsDeviation = 0;
        this.sessionStartTime = null;

        this.onPitchDetected = null;
        this.onNoteMatch = null;
        this.onError = null;
        this.onLevelChange = null;
    }

    async initialize(audioEngine = null) {
        try {
            if (audioEngine) {
                this.audioEngine = audioEngine;
            } else {
                this.audioEngine = new AudioEngine();
                await this.audioEngine.init();
            }

            this.monophonicDetector = new PYinDetector();
            this.monophonicDetector.configure({
                sampleRate: this.config.sampleRate,
                bufferSize: this.config.bufferSize,
                confidenceThreshold: this.config.confidenceThreshold,
                minFrequency: this.config.minFrequency,
                maxFrequency: this.config.maxFrequency
            });

            this.polyphonicDetector = new PolyphonicPitchDetector();
            this.polyphonicDetector.configure({
                sampleRate: this.config.sampleRate,
                bufferSize: this.config.bufferSize,
                maxVoices: this.config.maxVoices,
                confidenceThreshold: this.config.confidenceThreshold * 0.8,
                minFrequency: this.config.minFrequency,
                maxFrequency: this.config.maxFrequency
            });

            this.setInstrument(this.currentInstrument);
            this.initializeVibratoFilters();

            console.log('Live Audio Tracker initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize Live Audio Tracker:', error);
            if (this.onError) this.onError(error);
            throw error;
        }
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

    setScore(score) {
        this.currentScore = score;
        this.currentPosition = 0;
        this.totalNotesPlayed = 0;
        this.correctNotes = 0;
        this.averageCentsDeviation = 0;
        this.sessionStartTime = Date.now();
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
        this.vibratoFilters.forEach(filter => filter.reset());

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

        if (this.config.polyphonicEnabled) {
            detectedNotes = this.polyphonicDetector.detectPolyphonic(timeData);

            if (detectedNotes.length === 0) {
                const monoResult = this.monophonicDetector.detect(timeData);
                if (monoResult.frequency && monoResult.confidence >= this.config.confidenceThreshold) {
                    const noteInfo = this.monophonicDetector.frequencyToNote(monoResult.frequency);
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
                const noteInfo = this.monophonicDetector.frequencyToNote(result.frequency);
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

        if (filteredNotes.length > 0 && this.currentScore) {
            this.compareToScore(filteredNotes);
        }

        if (this.onPitchDetected) {
            this.onPitchDetected({
                notes: filteredNotes,
                level: level,
                timestamp: Date.now()
            });
        }
    }

    applyVibratoFiltering(notes) {
        return notes.map((note, index) => {
            if (index >= this.vibratoFilters.length) return note;

            const filter = this.vibratoFilters[index];
            let targetFrequency = null;

            if (this.currentScore) {
                const expectedNote = this.getExpectedNoteAtPosition();
                if (expectedNote) {
                    targetFrequency = expectedNote.getFrequency();
                }
            }

            filter.addSample(note.frequency, note.confidence, targetFrequency);

            const smoothedFrequency = filter.getSmoothedFrequency();
            const smoothedCentsDeviation = filter.getSmoothedCentsDeviation();
            const vibratoStatus = filter.getVibratoStatus();

            return {
                ...note,
                rawFrequency: note.frequency,
                smoothedFrequency: smoothedFrequency,
                smoothedCentsDeviation: smoothedCentsDeviation,
                isVibrato: vibratoStatus.isVibrato,
                vibratoDepth: vibratoStatus.depth
            };
        });
    }

    getExpectedNoteAtPosition() {
        if (!this.currentScore) return null;
        const allNotes = this.currentScore.getAllNotes();
        return allNotes[this.currentPosition] || null;
    }

    compareToScore(detectedNotes) {
        if (!this.currentScore) return;

        const expectedNote = this.getExpectedNoteAtPosition();
        if (!expectedNote) return;

        const expectedMIDI = expectedNote.getMIDI();

        for (const note of detectedNotes) {
            if (note.midi === expectedMIDI) {
                const smoothedFreq = note.smoothedFrequency || note.frequency;
                const centsDeviation = Math.round(
                    1200 * Math.log2(smoothedFreq / expectedNote.getFrequency())
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
                        totalNotes: this.currentScore.getAllNotes().length
                    });
                }

                break;
            }
        }
    }

    advancePosition() {
        const totalNotes = this.currentScore.getAllNotes().length;
        if (this.currentPosition < totalNotes - 1) {
            this.currentPosition++;
        }
    }

    setPosition(position) {
        const totalNotes = this.currentScore ? this.currentScore.getAllNotes().length : 0;
        this.currentPosition = Math.max(0, Math.min(position, totalNotes - 1));
    }

    getState() {
        return {
            isTracking: this.isTracking,
            currentNotes: this.currentNotes,
            currentPosition: this.currentPosition,
            totalNotesPlayed: this.totalNotesPlayed,
            correctNotes: this.correctNotes,
            averageCentsDeviation: Math.round(this.averageCentsDeviation),
            accuracy: this.totalNotesPlayed > 0
                ? Math.round((this.correctNotes / this.totalNotesPlayed) * 100)
                : 0,
            sessionDuration: this.sessionStartTime ? Date.now() - this.sessionStartTime : 0
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

    dispose() {
        this.stopTracking();
        if (this.audioEngine) {
            this.audioEngine.dispose();
            this.audioEngine = null;
        }
        this.vibratoFilters.forEach(filter => filter.reset());
        this.currentNotes = [];
    }
}

window.LiveAudioTracker = LiveAudioTracker;
