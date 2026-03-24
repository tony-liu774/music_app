import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

// Instrument configurations for propagation to dependent systems
export const INSTRUMENT_CONFIG = {
  violin: {
    label: 'Violin',
    clef: 'treble',
    strings: ['G3', 'D4', 'A4', 'E5'],
    frequencyRange: { min: 196, max: 3520 },
  },
  viola: {
    label: 'Viola',
    clef: 'alto',
    strings: ['C3', 'G3', 'D4', 'A4'],
    frequencyRange: { min: 131, max: 2093 },
  },
  cello: {
    label: 'Cello',
    clef: 'bass',
    strings: ['C2', 'G2', 'D3', 'A3'],
    frequencyRange: { min: 65, max: 1047 },
  },
  'double-bass': {
    label: 'Double Bass',
    clef: 'bass',
    strings: ['E1', 'A1', 'D2', 'G2'],
    frequencyRange: { min: 41, max: 523 },
  },
}

export const SETTINGS_DEFAULTS = {
  // Instrument
  instrument: 'violin',

  // Tuning reference
  tuningReference: 440,

  // Sensitivity
  confidenceThreshold: 0.8,

  // Display
  cursorSpeed: 1.0,
  needleSensitivity: 0.5,
}

export const useSettingsStore = create(
  devtools(
    persist(
      (set, get) => ({
        ...SETTINGS_DEFAULTS,

        // Instrument selection
        setInstrument: (instrument) => {
          if (!INSTRUMENT_CONFIG[instrument]) return
          set({ instrument }, false, 'setInstrument')
        },

        // Tuning reference (A4 frequency, 430-450 Hz)
        setTuningReference: (hz) => {
          const clamped = Math.min(450, Math.max(430, Number(hz)))
          set({ tuningReference: clamped }, false, 'setTuningReference')
        },

        // Confidence threshold (0.7-0.95)
        setConfidenceThreshold: (value) => {
          const clamped = Math.min(0.95, Math.max(0.7, Number(value)))
          set(
            { confidenceThreshold: Math.round(clamped * 100) / 100 },
            false,
            'setConfidenceThreshold',
          )
        },

        // Cursor speed (0.5-2.0)
        setCursorSpeed: (value) => {
          const clamped = Math.min(2.0, Math.max(0.5, Number(value)))
          set(
            { cursorSpeed: Math.round(clamped * 10) / 10 },
            false,
            'setCursorSpeed',
          )
        },

        // Needle sensitivity (0.1-1.0)
        setNeedleSensitivity: (value) => {
          const clamped = Math.min(1.0, Math.max(0.1, Number(value)))
          set(
            { needleSensitivity: Math.round(clamped * 10) / 10 },
            false,
            'setNeedleSensitivity',
          )
        },

        // Get current instrument config (for propagation)
        getInstrumentConfig: () => {
          return INSTRUMENT_CONFIG[get().instrument]
        },

        // Reset to defaults
        resetSettings: () => {
          set({ ...SETTINGS_DEFAULTS }, false, 'resetSettings')
        },
      }),
      {
        name: 'settings-storage',
      },
    ),
    { name: 'SettingsStore' },
  ),
)
