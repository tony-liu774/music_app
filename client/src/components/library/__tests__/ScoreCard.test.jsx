import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ScoreCard from '../ScoreCard'

const mockScore = {
  id: '1',
  title: 'Bach Partita No. 2',
  composer: 'J.S. Bach',
  instrument: 'violin',
  difficulty: 4,
  lastPracticed: '2026-03-20T10:00:00Z',
}

describe('ScoreCard', () => {
  it('renders score title', () => {
    render(
      <ScoreCard score={mockScore} onSelect={vi.fn()} onPractice={vi.fn()} />,
    )
    expect(screen.getByText('Bach Partita No. 2')).toBeInTheDocument()
  })

  it('renders composer name', () => {
    render(
      <ScoreCard score={mockScore} onSelect={vi.fn()} onPractice={vi.fn()} />,
    )
    expect(screen.getByText('J.S. Bach')).toBeInTheDocument()
  })

  it('renders instrument badge', () => {
    render(
      <ScoreCard score={mockScore} onSelect={vi.fn()} onPractice={vi.fn()} />,
    )
    expect(screen.getByText('Vln')).toBeInTheDocument()
  })

  it('renders difficulty dots', () => {
    render(
      <ScoreCard score={mockScore} onSelect={vi.fn()} onPractice={vi.fn()} />,
    )
    expect(screen.getByLabelText('Difficulty 4 of 5')).toBeInTheDocument()
  })

  it('renders last practiced date', () => {
    render(
      <ScoreCard score={mockScore} onSelect={vi.fn()} onPractice={vi.fn()} />,
    )
    expect(screen.getByText(/Last practiced:/)).toBeInTheDocument()
  })

  it('does not show last practiced when not available', () => {
    const score = { ...mockScore, lastPracticed: null }
    render(<ScoreCard score={score} onSelect={vi.fn()} onPractice={vi.fn()} />)
    expect(screen.queryByText(/Last practiced:/)).not.toBeInTheDocument()
  })

  it('calls onSelect when clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <ScoreCard score={mockScore} onSelect={onSelect} onPractice={vi.fn()} />,
    )
    await user.click(screen.getByTestId('score-card'))
    expect(onSelect).toHaveBeenCalledWith(mockScore)
  })

  it('calls onSelect on Enter key', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <ScoreCard score={mockScore} onSelect={onSelect} onPractice={vi.fn()} />,
    )
    screen.getByTestId('score-card').focus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith(mockScore)
  })

  it('shows Start Practice button when selected', () => {
    render(
      <ScoreCard
        score={mockScore}
        onSelect={vi.fn()}
        onPractice={vi.fn()}
        isSelected
      />,
    )
    expect(screen.getByTestId('start-practice-btn')).toBeInTheDocument()
    expect(screen.getByText('Start Practice')).toBeInTheDocument()
  })

  it('does not show Start Practice button when not selected', () => {
    render(
      <ScoreCard
        score={mockScore}
        onSelect={vi.fn()}
        onPractice={vi.fn()}
        isSelected={false}
      />,
    )
    expect(screen.queryByTestId('start-practice-btn')).not.toBeInTheDocument()
  })

  it('calls onPractice when Start Practice is clicked', async () => {
    const user = userEvent.setup()
    const onPractice = vi.fn()
    render(
      <ScoreCard
        score={mockScore}
        onSelect={vi.fn()}
        onPractice={onPractice}
        isSelected
      />,
    )
    await user.click(screen.getByTestId('start-practice-btn'))
    expect(onPractice).toHaveBeenCalledWith(mockScore)
  })

  it('applies selected styling when isSelected', () => {
    render(
      <ScoreCard
        score={mockScore}
        onSelect={vi.fn()}
        onPractice={vi.fn()}
        isSelected
      />,
    )
    const card = screen.getByTestId('score-card')
    expect(card.className).toContain('border-amber')
  })

  it('renders fallback for missing title', () => {
    const score = { ...mockScore, title: undefined }
    render(<ScoreCard score={score} onSelect={vi.fn()} onPractice={vi.fn()} />)
    expect(screen.getByText('Untitled')).toBeInTheDocument()
  })

  it('renders fallback for missing composer', () => {
    const score = { ...mockScore, composer: undefined }
    render(<ScoreCard score={score} onSelect={vi.fn()} onPractice={vi.fn()} />)
    expect(screen.getByText('Unknown Composer')).toBeInTheDocument()
  })

  it('has no hardcoded hex codes in className', () => {
    render(
      <ScoreCard score={mockScore} onSelect={vi.fn()} onPractice={vi.fn()} />,
    )
    const card = screen.getByTestId('score-card')
    expect(card.className).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('SVG has bounded dimensions', () => {
    render(
      <ScoreCard score={mockScore} onSelect={vi.fn()} onPractice={vi.fn()} />,
    )
    const svg = screen.getByTestId('score-card').querySelector('svg')
    expect(svg.className.baseVal).toContain('max-w-')
    expect(svg.className.baseVal).toContain('max-h-')
  })
})
