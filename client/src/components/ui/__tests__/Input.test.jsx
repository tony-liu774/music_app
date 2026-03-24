import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Input from '../Input'

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('renders a label when provided', () => {
    render(<Input label="Name" />)
    expect(screen.getByText('Name')).toBeInTheDocument()
  })

  it('applies Midnight Conservatory theme classes', () => {
    render(<Input data-testid="input" />)
    const input = screen.getByTestId('input')
    expect(input.className).toContain('bg-surface')
    expect(input.className).toContain('text-ivory')
    expect(input.className).toContain('focus:ring-amber')
  })

  it('shows error message and error styling', () => {
    render(<Input data-testid="input" error="Required" />)
    expect(screen.getByText('Required')).toBeInTheDocument()
    const input = screen.getByTestId('input')
    expect(input.className).toContain('border-crimson')
  })

  it('supports disabled state', () => {
    render(<Input disabled data-testid="input" />)
    expect(screen.getByTestId('input')).toBeDisabled()
  })

  it('handles user input', async () => {
    const onChange = vi.fn()
    render(<Input onChange={onChange} placeholder="Type here" />)
    await userEvent.type(screen.getByPlaceholderText('Type here'), 'hello')
    expect(onChange).toHaveBeenCalled()
  })

  it('merges custom className', () => {
    render(<Input data-testid="input" className="my-class" />)
    expect(screen.getByTestId('input').className).toContain('my-class')
  })

  it('contains no hardcoded hex codes', () => {
    render(<Input data-testid="input" />)
    expect(screen.getByTestId('input').className).not.toMatch(
      /#[0-9a-fA-F]{3,8}/,
    )
  })

  it('forwards ref', () => {
    const ref = { current: null }
    render(<Input ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })
})
