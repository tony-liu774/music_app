import { describe, it, expect, beforeEach } from 'vitest'
import {
  useSettingsStore,
  INSTRUMENT_CONFIG,
  SETTINGS_DEFAULTS,
} from './useSettingsStore'

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...SETTINGS_DEFAULTS })
  })

  it('has correct initial state', () => {
    const state = useSettingsStore.getState()
    expect(state.instrument).toBe('violin')
    expect(state.tuningReference).toBe(440)
    expect(state.confidenceThreshold).toBe(0.8)
    expect(state.cursorSpeed).toBe(1.0)
    expect(state.needleSensitivity).toBe(0.5)
  })

  describe('setInstrument', () => {
    it('sets valid instruments', () => {
      useSettingsStore.getState().setInstrument('viola')
      expect(useSettingsStore.getState().instrument).toBe('viola')

      useSettingsStore.getState().setInstrument('cello')
      expect(useSettingsStore.getState().instrument).toBe('cello')

      useSettingsStore.getState().setInstrument('double-bass')
      expect(useSettingsStore.getState().instrument).toBe('double-bass')
    })

    it('ignores invalid instruments', () => {
      useSettingsStore.getState().setInstrument('guitar')
      expect(useSettingsStore.getState().instrument).toBe('violin')
    })
  })

  describe('setTuningReference', () => {
    it('sets tuning reference within range', () => {
      useSettingsStore.getState().setTuningReference(442)
      expect(useSettingsStore.getState().tuningReference).toBe(442)
    })

    it('clamps values below 430', () => {
      useSettingsStore.getState().setTuningReference(400)
      expect(useSettingsStore.getState().tuningReference).toBe(430)
    })

    it('clamps values above 450', () => {
      useSettingsStore.getState().setTuningReference(500)
      expect(useSettingsStore.getState().tuningReference).toBe(450)
    })
  })

  describe('setConfidenceThreshold', () => {
    it('sets confidence threshold within range', () => {
      useSettingsStore.getState().setConfidenceThreshold(0.85)
      expect(useSettingsStore.getState().confidenceThreshold).toBe(0.85)
    })

    it('clamps values below 0.7', () => {
      useSettingsStore.getState().setConfidenceThreshold(0.5)
      expect(useSettingsStore.getState().confidenceThreshold).toBe(0.7)
    })

    it('clamps values above 0.95', () => {
      useSettingsStore.getState().setConfidenceThreshold(1.0)
      expect(useSettingsStore.getState().confidenceThreshold).toBe(0.95)
    })
  })

  describe('setCursorSpeed', () => {
    it('sets cursor speed within range', () => {
      useSettingsStore.getState().setCursorSpeed(1.5)
      expect(useSettingsStore.getState().cursorSpeed).toBe(1.5)
    })

    it('clamps values below 0.5', () => {
      useSettingsStore.getState().setCursorSpeed(0.1)
      expect(useSettingsStore.getState().cursorSpeed).toBe(0.5)
    })

    it('clamps values above 2.0', () => {
      useSettingsStore.getState().setCursorSpeed(3.0)
      expect(useSettingsStore.getState().cursorSpeed).toBe(2.0)
    })
  })

  describe('setNeedleSensitivity', () => {
    it('sets needle sensitivity within range', () => {
      useSettingsStore.getState().setNeedleSensitivity(0.8)
      expect(useSettingsStore.getState().needleSensitivity).toBe(0.8)
    })

    it('clamps values below 0.1', () => {
      useSettingsStore.getState().setNeedleSensitivity(0.0)
      expect(useSettingsStore.getState().needleSensitivity).toBe(0.1)
    })

    it('clamps values above 1.0', () => {
      useSettingsStore.getState().setNeedleSensitivity(1.5)
      expect(useSettingsStore.getState().needleSensitivity).toBe(1.0)
    })
  })

  describe('getInstrumentConfig', () => {
    it('returns config for current instrument', () => {
      const config = useSettingsStore.getState().getInstrumentConfig()
      expect(config).toEqual(INSTRUMENT_CONFIG.violin)
    })

    it('returns updated config after instrument change', () => {
      useSettingsStore.getState().setInstrument('cello')
      const config = useSettingsStore.getState().getInstrumentConfig()
      expect(config.clef).toBe('bass')
      expect(config.strings).toEqual(['C2', 'G2', 'D3', 'A3'])
    })
  })

  describe('resetSettings', () => {
    it('resets all settings to defaults', () => {
      useSettingsStore.getState().setInstrument('cello')
      useSettingsStore.getState().setTuningReference(442)
      useSettingsStore.getState().setConfidenceThreshold(0.9)
      useSettingsStore.getState().setCursorSpeed(1.5)
      useSettingsStore.getState().setNeedleSensitivity(0.8)

      useSettingsStore.getState().resetSettings()

      const state = useSettingsStore.getState()
      expect(state.instrument).toBe('violin')
      expect(state.tuningReference).toBe(440)
      expect(state.confidenceThreshold).toBe(0.8)
      expect(state.cursorSpeed).toBe(1.0)
      expect(state.needleSensitivity).toBe(0.5)
    })
  })

  describe('INSTRUMENT_CONFIG', () => {
    it('has configs for all four instruments', () => {
      expect(Object.keys(INSTRUMENT_CONFIG)).toEqual([
        'violin',
        'viola',
        'cello',
        'double-bass',
      ])
    })

    it('violin uses treble clef', () => {
      expect(INSTRUMENT_CONFIG.violin.clef).toBe('treble')
    })

    it('viola uses alto clef', () => {
      expect(INSTRUMENT_CONFIG.viola.clef).toBe('alto')
    })

    it('cello uses bass clef', () => {
      expect(INSTRUMENT_CONFIG.cello.clef).toBe('bass')
    })

    it('double bass uses bass clef', () => {
      expect(INSTRUMENT_CONFIG['double-bass'].clef).toBe('bass')
    })

    it('each instrument has strings and frequency range', () => {
      Object.values(INSTRUMENT_CONFIG).forEach((config) => {
        expect(config.strings).toBeInstanceOf(Array)
        expect(config.strings.length).toBe(4)
        expect(config.frequencyRange).toHaveProperty('min')
        expect(config.frequencyRange).toHaveProperty('max')
        expect(config.frequencyRange.max).toBeGreaterThan(
          config.frequencyRange.min,
        )
      })
    })
  })
})
