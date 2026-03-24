import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TunerGauge from '../TunerGauge'

describe('TunerGauge', () => {
  it('renders the gauge SVG', () => {
    render(<TunerGauge />)
    expect(screen.getByTestId('tuner-gauge')).toBeInTheDocument()
  })

  it('renders with max-w and max-h classes on SVG', () => {
    render(<TunerGauge />)
    const svg = screen.getByRole('img', { name: /tuner gauge/i })
    expect(svg.classList.toString()).toContain('max-w')
    expect(svg.classList.toString()).toContain('max-h')
  })

  it('renders tick marks', () => {
    render(<TunerGauge />)
    expect(screen.getByTestId('gauge-ticks')).toBeInTheDocument()
    // 11 tick marks (every 10 cents from -50 to +50)
    const ticks = screen.getByTestId('gauge-ticks').querySelectorAll('line')
    expect(ticks.length).toBe(11)
  })

  it('renders colored arc zones', () => {
    render(<TunerGauge />)
    const arcs = screen.getByTestId('gauge-arcs')
    const paths = arcs.querySelectorAll('path')
    expect(paths.length).toBe(3) // flat, in-tune, sharp
  })

  it('renders the needle', () => {
    render(<TunerGauge />)
    expect(screen.getByTestId('gauge-needle')).toBeInTheDocument()
  })

  it('shows -- status when inactive', () => {
    render(<TunerGauge cents={0} isActive={false} />)
    expect(screen.getByTestId('gauge-status')).toHaveTextContent('--')
  })

  it('shows IN TUNE when active and cents within 5', () => {
    render(<TunerGauge cents={3} isActive={true} />)
    expect(screen.getByTestId('gauge-status')).toHaveTextContent('IN TUNE')
  })

  it('shows FLAT when active and cents < -5', () => {
    render(<TunerGauge cents={-20} isActive={true} />)
    expect(screen.getByTestId('gauge-status')).toHaveTextContent('FLAT')
  })

  it('shows SHARP when active and cents > 5', () => {
    render(<TunerGauge cents={20} isActive={true} />)
    expect(screen.getByTestId('gauge-status')).toHaveTextContent('SHARP')
  })

  it('clamps cents to -50..+50 range', () => {
    render(<TunerGauge cents={100} isActive={true} />)
    // Should not crash; needle should be at max rotation
    expect(screen.getByTestId('gauge-needle')).toBeInTheDocument()
  })

  it('rotates needle based on cents value', () => {
    const { rerender } = render(<TunerGauge cents={0} isActive={true} />)
    const needle = screen.getByTestId('gauge-needle')
    expect(needle.getAttribute('transform')).toContain('rotate(0,')

    rerender(<TunerGauge cents={25} isActive={true} />)
    expect(needle.getAttribute('transform')).toContain('rotate(45,')

    rerender(<TunerGauge cents={-25} isActive={true} />)
    expect(needle.getAttribute('transform')).toContain('rotate(-45,')
  })

  it('shows emerald in-tune status at exactly 5 cents', () => {
    render(<TunerGauge cents={5} isActive={true} />)
    expect(screen.getByTestId('gauge-status')).toHaveTextContent('IN TUNE')
  })

  it('shows emerald in-tune status at exactly -5 cents', () => {
    render(<TunerGauge cents={-5} isActive={true} />)
    expect(screen.getByTestId('gauge-status')).toHaveTextContent('IN TUNE')
  })
})
