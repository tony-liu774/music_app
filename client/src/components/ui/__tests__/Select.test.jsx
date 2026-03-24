import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Select from '../Select'

const instruments = [
  { value: 'violin', label: 'Violin' },
  { value: 'viola', label: 'Viola' },
  { value: 'cello', label: 'Cello' },
]

describe('Select', () => {
  it('renders a select element with options', () => {
    render(<Select options={instruments} data-testid="select" />)
    expect(screen.getByTestId('select')).toBeInTheDocument()
    expect(screen.getByText('Violin')).toBeInTheDocument()
    expect(screen.getByText('Cello')).toBeInTheDocument()
  })

  it('renders a label when provided', () => {
    render(<Select label="Instrument" options={instruments} />)
    expect(screen.getByText('Instrument')).toBeInTheDocument()
  })

  it('renders a placeholder option', () => {
    render(
      <Select
        placeholder="Choose one"
        options={instruments}
        data-testid="select"
      />,
    )
    expect(screen.getByText('Choose one')).toBeInTheDocument()
  })

  it('applies Midnight Conservatory theme classes', () => {
    render(<Select options={instruments} data-testid="select" />)
    const select = screen.getByTestId('select')
    expect(select.className).toContain('bg-surface')
    expect(select.className).toContain('text-ivory')
    expect(select.className).toContain('focus:ring-amber')
  })

  it('shows error message and error styling', () => {
    render(
      <Select options={instruments} data-testid="select" error="Required" />,
    )
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(screen.getByTestId('select').className).toContain('border-crimson')
  })

  it('supports disabled state', () => {
    render(<Select options={instruments} data-testid="select" disabled />)
    expect(screen.getByTestId('select')).toBeDisabled()
  })

  it('handles selection change', async () => {
    const onChange = vi.fn()
    render(
      <Select options={instruments} data-testid="select" onChange={onChange} />,
    )
    await userEvent.selectOptions(screen.getByTestId('select'), 'viola')
    expect(onChange).toHaveBeenCalled()
  })

  it('contains no hardcoded hex codes', () => {
    render(<Select options={instruments} data-testid="select" />)
    expect(screen.getByTestId('select').className).not.toMatch(
      /#[0-9a-fA-F]{3,8}/,
    )
  })

  it('SVG chevron has bounded dimensions', () => {
    render(<Select options={instruments} />)
    const svgs = document.querySelectorAll('svg')
    svgs.forEach((svg) => {
      expect(svg.className.baseVal).toMatch(/max-w-/)
      expect(svg.className.baseVal).toMatch(/max-h-/)
    })
  })

  it('forwards ref', () => {
    const ref = { current: null }
    render(<Select ref={ref} options={instruments} />)
    expect(ref.current).toBeInstanceOf(HTMLSelectElement)
  })

  it('supports children instead of options prop', () => {
    render(
      <Select data-testid="select">
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </Select>,
    )
    expect(screen.getByText('Option A')).toBeInTheDocument()
  })
})
