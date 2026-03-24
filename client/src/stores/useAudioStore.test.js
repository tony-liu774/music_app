import { describe, it, expect, beforeEach } from 'vitest'
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

  it('has no cross-dependencies with UI store', () => {
    // Audio store should not import or reference UI store
    const audioState = useAudioStore.getState()
    expect(audioState).not.toHaveProperty('currentView')
    expect(audioState).not.toHaveProperty('modalOpen')
    expect(audioState).not.toHaveProperty('sidebarOpen')
  })
})
