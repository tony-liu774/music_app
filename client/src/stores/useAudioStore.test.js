import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAudioStore } from './useAudioStore'

describe('useAudioStore', () => {
  beforeEach(() => {
    useAudioStore.setState({
      micPermission: 'prompt',
      audioContextState: 'suspended',
      isSuspendedBySystem: false,
      resumeFailCount: 0,
      pitchData: { frequency: null, note: null, cents: null, confidence: 0 },
      vibratoData: { rate: null, extent: null, centerFrequency: null },
      isPracticing: false,
      selectedInstrument: 'violin',
      sessionErrors: [],
      inputLevel: 0,
      cursorPosition: { measure: null, beat: null, progress: 0 },
    })
  })

  it('has correct initial state', () => {
    const state = useAudioStore.getState()
    expect(state.micPermission).toBe('prompt')
    expect(state.audioContextState).toBe('suspended')
    expect(state.isSuspendedBySystem).toBe(false)
    expect(state.resumeFailCount).toBe(0)
    expect(state.pitchData.frequency).toBeNull()
    expect(state.pitchData.confidence).toBe(0)
    expect(state.vibratoData.rate).toBeNull()
    expect(state.isPracticing).toBe(false)
    expect(state.selectedInstrument).toBe('violin')
  })

  it('sets mic permission status', () => {
    useAudioStore.getState().setMicPermission('granted')
    expect(useAudioStore.getState().micPermission).toBe('granted')

    useAudioStore.getState().setMicPermission('denied')
    expect(useAudioStore.getState().micPermission).toBe('denied')
  })

  it('sets audio context state', () => {
    useAudioStore.getState().setAudioContextState('running')
    expect(useAudioStore.getState().audioContextState).toBe('running')

    useAudioStore.getState().setAudioContextState('closed')
    expect(useAudioStore.getState().audioContextState).toBe('closed')
  })

  it('updates pitch data', () => {
    const pitch = { frequency: 440, note: 'A4', cents: 2, confidence: 0.95 }
    useAudioStore.getState().setPitchData(pitch)
    expect(useAudioStore.getState().pitchData).toEqual(pitch)
  })

  it('updates vibrato data', () => {
    const vibrato = { rate: 5.5, extent: 30, centerFrequency: 440 }
    useAudioStore.getState().setVibratoData(vibrato)
    expect(useAudioStore.getState().vibratoData).toEqual(vibrato)
  })

  it('sets practicing state', () => {
    useAudioStore.getState().setIsPracticing(true)
    expect(useAudioStore.getState().isPracticing).toBe(true)
  })

  it('sets selected instrument', () => {
    useAudioStore.getState().setSelectedInstrument('cello')
    expect(useAudioStore.getState().selectedInstrument).toBe('cello')

    useAudioStore.getState().setSelectedInstrument('double-bass')
    expect(useAudioStore.getState().selectedInstrument).toBe('double-bass')
  })

  it('sets isSuspendedBySystem', () => {
    useAudioStore.getState().setIsSuspendedBySystem(true)
    expect(useAudioStore.getState().isSuspendedBySystem).toBe(true)

    useAudioStore.getState().setIsSuspendedBySystem(false)
    expect(useAudioStore.getState().isSuspendedBySystem).toBe(false)
  })

  it('sets resumeFailCount', () => {
    useAudioStore.getState().setResumeFailCount(3)
    expect(useAudioStore.getState().resumeFailCount).toBe(3)

    useAudioStore.getState().setResumeFailCount(0)
    expect(useAudioStore.getState().resumeFailCount).toBe(0)
  })

  it('has default resumeAudioContext that resolves to true', async () => {
    const result = await useAudioStore.getState().resumeAudioContext()
    expect(result).toBe(true)
  })

  it('sets resumeAudioContext callback', async () => {
    const customResume = vi.fn().mockResolvedValue(false)
    useAudioStore.getState().setResumeAudioContext(customResume)

    const result = await useAudioStore.getState().resumeAudioContext()
    expect(customResume).toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('has no cross-dependencies with UI store', () => {
    // Audio store should not import or reference UI store
    const audioState = useAudioStore.getState()
    expect(audioState).not.toHaveProperty('currentView')
    expect(audioState).not.toHaveProperty('modalOpen')
    expect(audioState).not.toHaveProperty('sidebarOpen')
  })

  it('has initial empty sessionErrors', () => {
    const state = useAudioStore.getState()
    expect(state.sessionErrors).toEqual([])
  })

  it('adds a session error', () => {
    const error = {
      timestamp: Date.now(),
      measure: 1,
      beat: 2,
      expectedNote: 'A4',
      detectedPitch: 442,
      centsDeviation: 8,
      confidence: 0.92,
    }
    useAudioStore.getState().addSessionError(error)
    expect(useAudioStore.getState().sessionErrors).toHaveLength(1)
    expect(useAudioStore.getState().sessionErrors[0]).toEqual(error)
  })

  it('accumulates multiple session errors', () => {
    const e1 = { timestamp: 1, measure: 1, beat: 1, expectedNote: 'A4', detectedPitch: 442, centsDeviation: 8, confidence: 0.9 }
    const e2 = { timestamp: 2, measure: 2, beat: 1, expectedNote: 'B4', detectedPitch: 490, centsDeviation: -5, confidence: 0.85 }
    useAudioStore.getState().addSessionError(e1)
    useAudioStore.getState().addSessionError(e2)
    expect(useAudioStore.getState().sessionErrors).toHaveLength(2)
  })

  it('clears session errors', () => {
    useAudioStore.getState().addSessionError({ timestamp: 1, measure: 1, beat: 1, expectedNote: 'A4', detectedPitch: 442, centsDeviation: 8, confidence: 0.9 })
    expect(useAudioStore.getState().sessionErrors).toHaveLength(1)
    useAudioStore.getState().clearSessionErrors()
    expect(useAudioStore.getState().sessionErrors).toEqual([])
  })

  it('has initial inputLevel of 0', () => {
    expect(useAudioStore.getState().inputLevel).toBe(0)
  })

  it('sets inputLevel', () => {
    useAudioStore.getState().setInputLevel(0.75)
    expect(useAudioStore.getState().inputLevel).toBe(0.75)
  })

  it('sets cursor position', () => {
    useAudioStore.getState().setCursorPosition({ measure: 5, beat: 3, progress: 0.5 })
    expect(useAudioStore.getState().cursorPosition).toEqual({ measure: 5, beat: 3, progress: 0.5 })
  })
})
