/**
 * Metronome - Web Audio API precise timing
 * Provides accurate tempo with visual beat indicator
 */

class Metronome {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
        this.bpm = 120;
        this.beatsPerMeasure = 4;
        this.currentBeat = 0;

        // Audio parameters
        this.highPitch = 1000;  // First beat accent
        this.lowPitch = 800;    // Other beats

        // Callbacks
        this.onBeat = null;
        this.onBPMChange = null;
        this.onStateChange = null;

        // Visual indicators
        this.beatIndicatorDots = null;

        // Timing
        this.nextBeatTime = 0;
        this.scheduleAheadTime = 0.1; // seconds
        this.lookahead = 25; // ms
        this.timerID = null;
    }

    async init() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();

        // Resume if suspended
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        return true;
    }

    setAudioContext(ctx) {
        this.audioContext = ctx;
    }

    setBPM(bpm) {
        this.bpm = Math.max(20, Math.min(300, bpm));
        if (this.onBPMChange) {
            this.onBPMChange(this.bpm);
        }
    }

    setBeatsPerMeasure(beats) {
        this.beatsPerMeasure = Math.max(1, Math.min(16, beats));
    }

    start() {
        if (this.isPlaying) return;

        // Ensure audio context is running
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.isPlaying = true;
        this.currentBeat = 0;
        this.nextBeatTime = this.audioContext.currentTime;

        this.scheduleNextBeat();
        this.startScheduler();

        if (this.onStateChange) {
            this.onStateChange(true);
        }
    }

    stop() {
        this.isPlaying = false;
        this.currentBeat = 0;

        if (this.timerID) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }

        this.updateBeatIndicator(-1);

        if (this.onStateChange) {
            this.onStateChange(false);
        }
    }

    toggle() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.start();
        }
    }

    scheduleNextBeat() {
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextBeatTime += secondsPerBeat;
    }

    startScheduler() {
        this.timerID = setTimeout(() => {
            if (!this.isPlaying) return;

            while (this.nextBeatTime < this.audioContext.currentTime + this.scheduleAheadTime) {
                this.scheduleNote(this.currentBeat, this.nextBeatTime);
                this.advanceBeat();
            }

            this.startScheduler();
        }, this.lookahead);
    }

    scheduleNote(beatNumber, time) {
        // Create oscillator for this beat
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        // First beat is accented
        const isAccent = beatNumber === 0;
        const pitch = isAccent ? this.highPitch : this.lowPitch;

        osc.frequency.value = pitch;
        osc.type = 'sine';

        // Envelope for click sound
        const duration = 0.05;
        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.start(time);
        osc.stop(time + duration);

        // Call beat callback after scheduling
        setTimeout(() => {
            if (this.onBeat) {
                this.onBeat(beatNumber, this.beatsPerMeasure);
            }
            this.updateBeatIndicator(beatNumber);
        }, (time - this.audioContext.currentTime) * 1000);
    }

    advanceBeat() {
        this.currentBeat++;
        if (this.currentBeat >= this.beatsPerMeasure) {
            this.currentBeat = 0;
        }
        this.scheduleNextBeat();
    }

    updateBeatIndicator(beat) {
        const dots = document.querySelectorAll('.beat-dot');
        dots.forEach((dot, index) => {
            if (index === beat) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    tapTempo(tapTimes) {
        if (tapTimes.length < 2) return null;

        // Calculate average interval
        const intervals = [];
        for (let i = 1; i < tapTimes.length; i++) {
            intervals.push(tapTimes[i] - tapTimes[i - 1]);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const bpm = Math.round(60000 / avgInterval);

        // Clamp to valid range
        return Math.max(20, Math.min(300, bpm));
    }

    getTempoLabel(bpm) {
        if (bpm < 40) return 'Grave';
        if (bpm < 60) return 'Largo';
        if (bpm < 66) return 'Lento';
        if (bpm < 76) return 'Adagio';
        if (bpm < 108) return 'Andante';
        if (bpm < 120) return 'Moderato';
        if (bpm < 156) return 'Allegro';
        if (bpm < 176) return 'Vivace';
        if (bpm < 200) return 'Presto';
        return 'Prestissimo';
    }

    getState() {
        return {
            isPlaying: this.isPlaying,
            bpm: this.bpm,
            beatsPerMeasure: this.beatsPerMeasure,
            currentBeat: this.currentBeat
        };
    }

    dispose() {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

// Export for use in other modules
window.Metronome = Metronome;