import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export const useAudioStore = create(
  devtools(
    (set) => ({
      // Mic permission status: 'prompt' | 'granted' | 'denied'
      micPermission: 'prompt',
      setMicPermission: (status) =>
        set({ micPermission: status }, false, 'setMicPermission'),

      // Audio context state: 'suspended' | 'running' | 'closed'
      audioContextState: 'suspended',
      setAudioContextState: (state) =>
        set({ audioContextState: state }, false, 'setAudioContextState'),

      // Whether the AudioContext is suspended and being auto-resumed
      isSuspendedBySystem: false,
      setIsSuspendedBySystem: (suspended) =>
        set({ isSuspendedBySystem: suspended }, false, 'setIsSuspendedBySystem'),

      // Count of consecutive resume failures (resets on success)
      resumeFailCount: 0,
      setResumeFailCount: (count) =>
        set({ resumeFailCount: count }, false, 'setResumeFailCount'),

      // Callback to resume a suspended AudioContext (registered by the pipeline owner)
      resumeAudioContext: async () => true, // no-op default
      setResumeAudioContext: (fn) =>
        set({ resumeAudioContext: fn }, false, 'setResumeAudioContext'),

      // Current pitch data
      pitchData: {
        frequency: null,
        note: null,
        cents: null,
        confidence: 0,
      },
      setPitchData: (data) => set({ pitchData: data }, false, 'setPitchData'),

      // Vibrato data
      vibratoData: {
        isVibrato: false,
        vibratoRate: null,
        vibratoWidth: null,
        centerFrequency: null,
      },
      setVibratoData: (data) =>
        set({ vibratoData: data }, false, 'setVibratoData'),

      // Practice state
      isPracticing: false,
      setIsPracticing: (practicing) =>
        set({ isPracticing: practicing }, false, 'setIsPracticing'),

      // Selected instrument: 'violin' | 'viola' | 'cello' | 'double-bass'
      selectedInstrument: 'violin',
      setSelectedInstrument: (instrument) =>
        set({ selectedInstrument: instrument }, false, 'setSelectedInstrument'),

      // Cursor position — tracks current location on the score
      cursorPosition: {
        measure: null, // 1-based measure number
        beat: null, // 1-based beat within measure
        progress: 0, // 0-1 overall progress through the score
      },
      setCursorPosition: (position) =>
        set({ cursorPosition: position }, false, 'setCursorPosition'),
    }),
    { name: 'AudioStore' },
  ),
)
