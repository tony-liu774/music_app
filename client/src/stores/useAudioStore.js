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
    }),
    { name: 'AudioStore' },
  ),
)
