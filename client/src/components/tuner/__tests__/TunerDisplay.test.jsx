import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import TunerDisplay from '../TunerDisplay'
import { useSettingsStore } from '../../../stores/useSettingsStore'

describe('TunerDisplay', () => {
  beforeEach(() => {
    useSettingsStore.setState({ instrument: 'violin' })
  })

  it('renders the display container', () => {
    render(<TunerDisplay />)
    expect(screen.getByTestId('tuner-display')).toBeInTheDocument()
  })

  it('shows -- when no note is detected', () => {
    render(<TunerDisplay />)
    expect(screen.getByTestId('note-display')).toHaveTextContent('--')
  })

  it('displays detected note name in large text', () => {
    render(<TunerDisplay note="A4" frequency={440} cents={0} isActive={true} />)
    expect(screen.getByTestId('note-display')).toHaveTextContent('A')
    expect(screen.getByTestId('note-display')).toHaveTextContent('4')
  })

  it('displays sharp note names correctly', () => {
    render(
      <TunerDisplay note="C#5" frequency={554.37} cents={2} isActive={true} />,
    )
    expect(screen.getByTestId('note-display')).toHaveTextContent('C#')
    expect(screen.getByTestId('note-display')).toHaveTextContent('5')
  })

  it('displays frequency in Hz', () => {
    render(<TunerDisplay note="A4" frequency={440} cents={0} isActive={true} />)
    expect(screen.getByTestId('frequency-display')).toHaveTextContent(
      '440.0 Hz',
    )
  })

  it('shows -- Hz when no frequency', () => {
    render(<TunerDisplay />)
    expect(screen.getByTestId('frequency-display')).toHaveTextContent('-- Hz')
  })

  it('displays cents deviation with sign', () => {
    render(<TunerDisplay note="A4" frequency={442} cents={8} isActive={true} />)
    expect(screen.getByTestId('cents-display')).toHaveTextContent('+8¢')
  })

  it('displays negative cents deviation', () => {
    render(
      <TunerDisplay note="A4" frequency={438} cents={-8} isActive={true} />,
    )
    expect(screen.getByTestId('cents-display')).toHaveTextContent('-8¢')
  })

  it('shows 0¢ when cents is null', () => {
    render(<TunerDisplay />)
    expect(screen.getByTestId('cents-display')).toHaveTextContent('0¢')
  })

  it('renders open string references for violin', () => {
    render(<TunerDisplay isActive={true} />)
    expect(screen.getByTestId('open-strings')).toBeInTheDocument()
    expect(screen.getByText('G3')).toBeInTheDocument()
    expect(screen.getByText('D4')).toBeInTheDocument()
    expect(screen.getByText('A4')).toBeInTheDocument()
    expect(screen.getByText('E5')).toBeInTheDocument()
  })

  it('shows instrument label for open strings', () => {
    render(<TunerDisplay isActive={true} />)
    expect(screen.getByText(/Violin Open Strings/i)).toBeInTheDocument()
  })

  it('renders open string references for cello', () => {
    useSettingsStore.setState({ instrument: 'cello' })
    render(<TunerDisplay isActive={true} />)
    expect(screen.getByText('C2')).toBeInTheDocument()
    expect(screen.getByText('G2')).toBeInTheDocument()
    expect(screen.getByText('D3')).toBeInTheDocument()
    expect(screen.getByText('A3')).toBeInTheDocument()
  })

  it('renders open string references for viola', () => {
    useSettingsStore.setState({ instrument: 'viola' })
    render(<TunerDisplay isActive={true} />)
    expect(screen.getByText('C3')).toBeInTheDocument()
    expect(screen.getByText('G3')).toBeInTheDocument()
    expect(screen.getByText('D4')).toBeInTheDocument()
    expect(screen.getByText('A4')).toBeInTheDocument()
  })

  it('renders open string references for double bass', () => {
    useSettingsStore.setState({ instrument: 'double-bass' })
    render(<TunerDisplay isActive={true} />)
    expect(screen.getByText('E1')).toBeInTheDocument()
    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getByText('D2')).toBeInTheDocument()
    expect(screen.getByText('G2')).toBeInTheDocument()
  })

  it('highlights matching open string when detected note matches', () => {
    render(<TunerDisplay note="A4" frequency={440} cents={0} isActive={true} />)
    const a4Button = screen.getByText('A4').closest('div')
    expect(a4Button.className).toContain('border-amber')
  })

  it('shows reference frequencies for open strings', () => {
    render(<TunerDisplay isActive={true} />)
    expect(screen.getByText('196 Hz')).toBeInTheDocument() // G3
    expect(screen.getByText('440 Hz')).toBeInTheDocument() // A4
  })

  it('applies emerald color for small cents deviation', () => {
    render(<TunerDisplay note="A4" frequency={440} cents={3} isActive={true} />)
    const centsEl = screen.getByTestId('cents-display')
    expect(centsEl.className).toContain('text-emerald')
  })

  it('applies amber color for moderate cents deviation', () => {
    render(
      <TunerDisplay note="A4" frequency={442} cents={12} isActive={true} />,
    )
    const centsEl = screen.getByTestId('cents-display')
    expect(centsEl.className).toContain('text-amber')
  })

  it('applies crimson color for large cents deviation', () => {
    render(
      <TunerDisplay note="A4" frequency={450} cents={30} isActive={true} />,
    )
    const centsEl = screen.getByTestId('cents-display')
    expect(centsEl.className).toContain('text-crimson')
  })

  it('uses muted color when inactive', () => {
    render(
      <TunerDisplay note="A4" frequency={440} cents={3} isActive={false} />,
    )
    const centsEl = screen.getByTestId('cents-display')
    expect(centsEl.className).toContain('text-ivory-muted')
  })
})
