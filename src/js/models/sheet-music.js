/**
 * Sheet Music Data Model
 * Core data structures for representing parsed sheet music
 */

class Note {
    constructor(pitch, duration, position = {}) {
        this.pitch = pitch; // { step: 'C', octave: 4, alter: 0 }
        this.duration = duration; // in beats (1 = quarter, 0.5 = eighth, etc.)
        this.position = position; // { measure: 0, beat: 0, voice: 0 }
        this.type = 'note';
        this.tie = null; // 'start', 'stop', 'continue'
        this.dot = false;
        this.accents = [];
        this.dynamic = 'mf';
    }

    getMIDI() {
        const steps = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
        const stepValue = steps[this.pitch.step] || 0;
        const alterValue = this.pitch.alter || 0;
        const octaveValue = (this.pitch.octave || 4) * 12;
        return 12 + stepValue + alterValue + octaveValue;
    }

    getFrequency() {
        const midi = this.getMIDI();
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    getName() {
        const name = this.pitch.step;
        const alter = this.pitch.alter || 0;
        if (alter === 1) return name + '#';
        if (alter === -1) return name + 'b';
        return name;
    }
}

class Rest {
    constructor(duration, position = {}) {
        this.duration = duration;
        this.position = position;
        this.type = 'rest';
    }
}

class Measure {
    constructor(number = 1) {
        this.number = number;
        this.notes = [];
        this.rests = [];
        this.clef = null; // 'treble', 'bass', 'alto', 'tenor'
        this.key = { fifths: 0, mode: 'major' };
        this.timeSignature = { beats: 4, beatType: 4 };
    }

    addElement(element) {
        if (element instanceof Note) {
            this.notes.push(element);
        } else if (element instanceof Rest) {
            this.rests.push(element);
        }
    }
}

class Part {
    constructor(id, name = 'Part 1') {
        this.id = id;
        this.name = name;
        this.instrument = 'violin';
        this.measures = [];
    }

    addMeasure(measure) {
        this.measures.push(measure);
    }
}

class Score {
    constructor(title = 'Untitled', composer = 'Unknown') {
        this.title = title;
        this.composer = composer;
        this.parts = [];
        this.divisions = 1; // ticks per quarter note
        this.tempo = 120;
    }

    addPart(part) {
        this.parts.push(part);
    }

    getAllNotes() {
        const allNotes = [];
        for (const part of this.parts) {
            for (const measure of part.measures) {
                for (const note of measure.notes) {
                    allNotes.push(note);
                }
            }
        }
        return allNotes;
    }

    getTotalMeasures() {
        if (this.parts.length === 0) return 0;
        return this.parts[0].measures.length;
    }

    getNoteAtPosition(measureIndex, beatIndex) {
        for (const part of this.parts) {
            if (measureIndex < part.measures.length) {
                const measure = part.measures[measureIndex];
                for (const note of measure.notes) {
                    if (note.position.beat === beatIndex) {
                        return note;
                    }
                }
            }
        }
        return null;
    }
}

class ScoreLibrary {
    constructor() {
        this.scores = [];
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ConcertmasterLibrary', 1);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                this.db = request.result;
                this.loadScores();
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('scores')) {
                    db.createObjectStore('scores', { keyPath: 'id' });
                }
            };
        });
    }

    async loadScores() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve([]);
                return;
            }

            const transaction = this.db.transaction(['scores'], 'readonly');
            const store = transaction.objectStore('scores');
            const request = store.getAll();

            request.onsuccess = () => {
                this.scores = request.result || [];
                resolve(this.scores);
            };

            request.onerror = () => reject(request.error);
        });
    }

    async addScore(score) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            score.id = score.id || crypto.randomUUID();
            score.addedAt = score.addedAt || new Date().toISOString();

            const transaction = this.db.transaction(['scores'], 'readwrite');
            const store = transaction.objectStore('scores');
            const request = store.add(score);

            request.onsuccess = () => {
                this.scores.push(score);
                resolve(score);
            };

            request.onerror = () => reject(request.error);
        });
    }

    async deleteScore(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['scores'], 'readwrite');
            const store = transaction.objectStore('scores');
            const request = store.delete(id);

            request.onsuccess = () => {
                this.scores = this.scores.filter(s => s.id !== id);
                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    }

    search(query) {
        const lowerQuery = query.toLowerCase();
        return this.scores.filter(score =>
            score.title.toLowerCase().includes(lowerQuery) ||
            score.composer.toLowerCase().includes(lowerQuery)
        );
    }
}

// Export for use in other modules
window.Note = Note;
window.Rest = Rest;
window.Measure = Measure;
window.Part = Part;
window.Score = Score;
window.ScoreLibrary = ScoreLibrary;