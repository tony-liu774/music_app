/**
 * Tests for LiveAudioTracker rhythm analysis enhancements
 * Uses Node.js built-in test runner
 */

const { test, describe, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert')

// Mock the browser APIs
global.AudioContext = class AudioContext {
  constructor() {
    this.sampleRate = 44100
    this.state = 'running'
  }
  createMediaStreamSource() {
    return {
      connect: () => {},
      disconnect: () => {}
    }
  }
  createScriptProcessor() {
    return {
      connect: () => {},
      disconnect: () => {},
      onaudioprocess: null
    }
  }
  close() {
    return Promise.resolve()
  }
}

global.navigator = {
  mediaDevices: {
    getUserMedia: () => Promise.resolve({
      getTracks: () => [{ stop: () => {} }]
    })
  }
}

// Load the LiveAudioTracker
const { LiveAudioTracker } = require('../src/js/audio/live-audio-tracker.js')

describe('LiveAudioTracker Rhythm Analysis', () => {
  let tracker

  beforeEach(() => {
    tracker = new LiveAudioTracker()
  })

  afterEach(() => {
    if (tracker) {
      tracker.dispose()
    }
  })

  test('should initialize with rhythm tracking disabled by default', () => {
    assert.deepStrictEqual(tracker.rhythmEvents, [])
    assert.strictEqual(tracker.lastNoteOnsetTime, null)
    assert.strictEqual(tracker.beatIntervalMs, 500) // Default 120 BPM
  })

  test('should set tempo and calculate beat interval correctly', () => {
    tracker.setTempo(60) // 60 BPM
    assert.strictEqual(tracker.beatIntervalMs, 1000)

    tracker.setTempo(120) // 120 BPM
    assert.strictEqual(tracker.beatIntervalMs, 500)

    tracker.setTempo(180) // 180 BPM
    assert.strictEqual(Math.round(tracker.beatIntervalMs), 333)
  })

  test('should track rhythm events', () => {
    const note = { midi: 69, name: 'A', octave: 4, frequency: 440 }
    const timestamp1 = 1000
    const timestamp2 = 1500

    tracker.trackRhythm(note, timestamp1)
    assert.strictEqual(tracker.rhythmEvents.length, 1)
    assert.strictEqual(tracker.rhythmEvents[0].note, 69)
    assert.strictEqual(tracker.rhythmEvents[0].timestamp, timestamp1)
    assert.strictEqual(tracker.lastNoteOnsetTime, timestamp1)

    tracker.setTempo(120) // 500ms beat interval
    tracker.trackRhythm(note, timestamp2)
    assert.strictEqual(tracker.rhythmEvents.length, 2)
  })

  test('should calculate rhythm deviation correctly', () => {
    const note = { midi: 69, name: 'A', octave: 4, frequency: 440 }
    const timestamp = 1000

    tracker.trackRhythm(note, timestamp)

    const event = tracker.rhythmEvents[0]
    assert.strictEqual(event.deviationMs, 0) // First note has no expected time
    assert.strictEqual(event.isOnTime, true) // First note is always on time
  })

  test('should detect on-time vs off-time rhythm events', () => {
    const note = { midi: 69, name: 'A', octave: 4, frequency: 440 }
    tracker.setTempo(120) // 500ms beat interval

    // First note
    tracker.trackRhythm(note, 1000)
    assert.strictEqual(tracker.rhythmEvents[0].isOnTime, true)

    // Second note - on time (within 100ms tolerance)
    tracker.trackRhythm(note, 1500) // 500ms later - on time
    assert.strictEqual(tracker.rhythmEvents[1].isOnTime, true)

    // Third note - late (more than 100ms after expected)
    tracker.trackRhythm(note, 2200) // Should be at 2000, but we're at 2200 (200ms late)
    assert.strictEqual(tracker.rhythmEvents[2].isOnTime, false)
    assert.strictEqual(tracker.rhythmEvents[2].deviationMs, 200)
  })

  test('should limit rhythm event history to 100 events', () => {
    const note = { midi: 69, name: 'A', octave: 4, frequency: 440 }
    tracker.setTempo(60) // 1000ms interval for easy calculation

    // Add 150 events
    for (let i = 0; i < 150; i++) {
      tracker.trackRhythm(note, i * 1000)
    }

    assert.strictEqual(tracker.rhythmEvents.length, 100)
  })

  test('should provide rhythm analysis summary', () => {
    const note = { midi: 69, name: 'A', octave: 4, frequency: 440 }
    tracker.setTempo(120)

    // Add some on-time and off-time events
    // First note: no expected time, so on time
    tracker.trackRhythm(note, 1000)
    // Second note: at 1500, expected 1500 (1000 + 500), so on time
    tracker.trackRhythm(note, 1500)
    // Third note: at 2200, expected 2000 (1500 + 500), 200ms late
    tracker.trackRhythm(note, 2200)
    // Fourth note: at 2700, expected 2700 (2200 + 500), so on time
    tracker.trackRhythm(note, 2700)

    const analysis = tracker.getRhythmAnalysis()
    assert.strictEqual(analysis.totalEvents, 4)
    // First, second, fourth are on time (within 100ms tolerance)
    // Third is late (400ms deviation)
    assert.strictEqual(analysis.onTimeCount, 3)
    assert.strictEqual(analysis.lateCount, 1)
    assert.strictEqual(analysis.earlyCount, 0)
    assert.strictEqual(analysis.accuracy, 75) // 3/4 = 75%
  })

  test('should return empty analysis when no events', () => {
    const analysis = tracker.getRhythmAnalysis()
    assert.strictEqual(analysis.totalEvents, 0)
    assert.strictEqual(analysis.accuracy, 100)
  })

  test('should get tracker state with rhythm metrics', () => {
    const note = { midi: 69, name: 'A', octave: 4, frequency: 440 }
    tracker.setTempo(120)

    tracker.trackRhythm(note, 1000)
    tracker.trackRhythm(note, 1500)

    const state = tracker.getState()
    assert.strictEqual(state.rhythmAccuracy, 100)
    assert.strictEqual(state.recentRhythmEvents.length, 2)
  })
})

describe('LiveAudioTracker Basic Functionality', () => {
  let tracker

  beforeEach(() => {
    tracker = new LiveAudioTracker()
  })

  afterEach(() => {
    if (tracker) {
      tracker.dispose()
    }
  })

  test('should initialize with default configuration', () => {
    assert.strictEqual(tracker.config.sampleRate, 44100)
    assert.strictEqual(tracker.config.bufferSize, 2048)
    assert.strictEqual(tracker.config.confidenceThreshold, 0.85)
    assert.strictEqual(tracker.config.centsTolerance, 50)
    assert.strictEqual(tracker.config.polyphonicEnabled, true)
  })

  test('should set instrument and update frequency ranges', () => {
    tracker.setInstrument('violin')
    assert.strictEqual(tracker.currentInstrument, 'violin')
    assert.strictEqual(tracker.config.minFrequency, 196)
    assert.strictEqual(tracker.config.maxFrequency, 2637)

    tracker.setInstrument('cello')
    assert.strictEqual(tracker.currentInstrument, 'cello')
    assert.strictEqual(tracker.config.minFrequency, 65)
    assert.strictEqual(tracker.config.maxFrequency, 987)

    tracker.setInstrument('bass')
    assert.strictEqual(tracker.currentInstrument, 'bass')
    assert.strictEqual(tracker.config.minFrequency, 41)
    assert.strictEqual(tracker.config.maxFrequency, 262)
  })

  test('should get state with tracking metrics', () => {
    const state = tracker.getState()
    assert.strictEqual(state.isTracking, false)
    assert.deepStrictEqual(state.currentNotes, [])
    assert.strictEqual(state.currentPosition, 0)
    assert.strictEqual(state.totalNotesPlayed, 0)
    assert.strictEqual(state.correctNotes, 0)
    assert.strictEqual(state.accuracy, 0)
  })

  test('should dispose cleanly', () => {
    tracker.dispose()
    assert.strictEqual(tracker.audioEngine, null)
    assert.deepStrictEqual(tracker.currentNotes, [])
    assert.deepStrictEqual(tracker.rhythmEvents, [])
  })

  test('should reset rhythm events on dispose', () => {
    const note = { midi: 69, name: 'A', octave: 4, frequency: 440 }
    tracker.trackRhythm(note, 1000)
    tracker.trackRhythm(note, 1500)
    assert.strictEqual(tracker.rhythmEvents.length, 2)

    tracker.dispose()
    assert.strictEqual(tracker.rhythmEvents.length, 0)
  })

  test('should handle basic audio engine interface', () => {
    const engine = tracker._createBasicAudioEngine()
    assert.strictEqual(engine.isListening, false)
    assert.strictEqual(typeof engine.requestMicrophoneAccess, 'function')
    assert.strictEqual(typeof engine.setAudioDataCallback, 'function')
    assert.strictEqual(typeof engine.getRMSLevel, 'function')
    assert.strictEqual(typeof engine.stopListening, 'function')
    assert.strictEqual(typeof engine.dispose, 'function')
  })

  test('should calculate RMS level correctly', () => {
    // Create a basic audio engine for testing
    const engine = tracker._createBasicAudioEngine()
    const buffer = new Float32Array([0, 0.5, 0, -0.5, 0])
    const level = engine.getRMSLevel(buffer)
    // RMS of [0, 0.5, 0, -0.5, 0] = sqrt((0 + 0.25 + 0 + 0.25 + 0) / 5) = sqrt(0.1) ≈ 0.316
    assert.strictEqual(level.toFixed(3), '0.316')
  })
})
