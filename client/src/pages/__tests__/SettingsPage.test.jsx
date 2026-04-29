import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SettingsPage from '../SettingsPage'
import {
  useSettingsStore,
  SETTINGS_DEFAULTS,
} from '../../stores/useSettingsStore'

describe('SettingsPage', () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...SETTINGS_DEFAULTS })
  })

  it('renders the page title', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders all section headings', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Instrument')).toBeInTheDocument()
    expect(screen.getByText('Tuning Reference')).toBeInTheDocument()
    expect(screen.getByText('Sensitivity')).toBeInTheDocument()
    expect(screen.getByText('Display')).toBeInTheDocument()
    expect(screen.getByText('Account')).toBeInTheDocument()
  })

  describe('Instrument section', () => {
    it('renders instrument select with default violin', () => {
      render(<SettingsPage />)
      const select = screen.getByTestId('instrument-select')
      expect(select).toHaveValue('violin')
    })

    it('changes instrument when selecting a new one', async () => {
      const user = userEvent.setup()
      render(<SettingsPage />)
      const select = screen.getByTestId('instrument-select')
      await user.selectOptions(select, 'cello')
      expect(useSettingsStore.getState().instrument).toBe('cello')
    })

    it('displays instrument config info', () => {
      render(<SettingsPage />)
      expect(screen.getByText(/Treble/)).toBeInTheDocument()
      expect(screen.getByText(/G3, D4, A4, E5/)).toBeInTheDocument()
    })

    it('updates config info when instrument changes', async () => {
      const user = userEvent.setup()
      render(<SettingsPage />)
      await user.selectOptions(screen.getByTestId('instrument-select'), 'cello')
      expect(screen.getByText(/Clef:/)).toBeInTheDocument()
      expect(screen.getByText(/C2, G2, D3, A3/)).toBeInTheDocument()
    })
  })

  describe('Tuning Reference section', () => {
    it('renders A4 frequency slider', () => {
      render(<SettingsPage />)
      expect(screen.getByLabelText('A4 Frequency')).toBeInTheDocument()
    })

    it('displays current tuning reference value', () => {
      render(<SettingsPage />)
      expect(screen.getByText('440 Hz')).toBeInTheDocument()
    })
  })

  describe('Sensitivity section', () => {
    it('renders confidence threshold slider', () => {
      render(<SettingsPage />)
      expect(screen.getByLabelText('Confidence Threshold')).toBeInTheDocument()
    })
  })

  describe('Display section', () => {
    it('renders cursor speed slider', () => {
      render(<SettingsPage />)
      expect(screen.getByLabelText('Cursor Speed')).toBeInTheDocument()
    })

    it('renders needle sensitivity slider', () => {
      render(<SettingsPage />)
      expect(screen.getByLabelText('Needle Sensitivity')).toBeInTheDocument()
    })
  })

  describe('Account section - Public Mode', () => {
    it('displays public mode message', () => {
      render(<SettingsPage />)
      expect(screen.getByText(/This app is running in public mode/)).toBeInTheDocument()
      expect(screen.getByText(/All features are available without an account/)).toBeInTheDocument()
    })
  })

  describe('Reset settings', () => {
    it('resets all settings to defaults', async () => {
      const user = userEvent.setup()
      useSettingsStore.getState().setInstrument('cello')
      useSettingsStore.getState().setTuningReference(442)

      render(<SettingsPage />)
      await user.click(screen.getByTestId('reset-settings-button'))

      const state = useSettingsStore.getState()
      expect(state.instrument).toBe('violin')
      expect(state.tuningReference).toBe(440)
    })
  })
})
