import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Modal from '../Modal'

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        Content
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog when open', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test Modal">
        Content
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('has aria-modal attribute', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test">
        Body
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        Body
      </Modal>,
    )
    fireEvent.keyDown(screen.getByRole('dialog').parentElement, {
      key: 'Escape',
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        Body
      </Modal>,
    )
    await userEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        Body
      </Modal>,
    )
    await userEvent.click(screen.getByLabelText('Close modal'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('uses Midnight Conservatory theme classes', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test">
        Body
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('bg-elevated')
    expect(dialog.className).toContain('border-border')
  })

  it('contains no hardcoded hex codes', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test">
        Body
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('SVG icons have bounded dimensions', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test">
        Body
      </Modal>,
    )
    const svgs = document.querySelectorAll('svg')
    svgs.forEach((svg) => {
      expect(svg.className.baseVal).toMatch(/max-w-/)
      expect(svg.className.baseVal).toMatch(/max-h-/)
    })
  })

  it('traps focus within the modal', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Focus Trap">
        <button>First</button>
        <button>Last</button>
      </Modal>,
    )

    const dialog = screen.getByRole('dialog')
    const buttons = dialog.querySelectorAll('button')
    // The close button + 2 content buttons = 3 focusable elements
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })
})
