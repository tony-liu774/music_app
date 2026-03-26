import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import UpNextWidget, { findWeakestScore } from '../UpNextWidget'
import { useSessionStore } from '../../../stores/useSessionStore'
import { useLibraryStore } from '../../../stores/useLibraryStore'

describe('UpNextWidget', () => {
  beforeEach(() => {
    useSessionStore.setState({ practiceHistory: [] })
    useLibraryStore.setState({ scores: [] })
  })

  it('renders Up Next heading with icon', () => {
    render(<UpNextWidget />)
    expect(screen.getByText('Up Next')).toBeInTheDocument()
    expect(screen.getByTestId('up-next-widget')).toBeInTheDocument()
  })

  it('shows empty state when no scores in library', () => {
    render(<UpNextWidget />)
    expect(screen.getByTestId('up-next-empty')).toBeInTheDocument()
    expect(screen.getByText(/add scores to your library/i)).toBeInTheDocument()
  })

  it('shows Browse Library button in empty state', () => {
    render(<UpNextWidget />)
    expect(screen.getByText('Browse Library')).toBeInTheDocument()
  })

  it('suggests unpracticed score when available', () => {
    useLibraryStore.setState({
      scores: [
        { id: 'score-1', title: 'Beethoven Sonata', composer: 'Beethoven' },
      ],
    })

    render(<UpNextWidget />)
    expect(screen.getByTestId('up-next-suggestion')).toBeInTheDocument()
    expect(screen.getByText('Beethoven Sonata')).toBeInTheDocument()
    expect(screen.getByText('Beethoven')).toBeInTheDocument()
    expect(screen.getByText('Not yet practiced')).toBeInTheDocument()
  })

  it('suggests weakest score based on accuracy', () => {
    useLibraryStore.setState({
      scores: [
        { id: 'score-1', title: 'Easy Piece', composer: 'Mozart' },
        { id: 'score-2', title: 'Hard Piece', composer: 'Paganini' },
      ],
    })

    useSessionStore.setState({
      practiceHistory: [
        {
          scoreId: 'score-1',
          date: new Date().toISOString(),
          accuracy: 90,
          duration: 20,
        },
        {
          scoreId: 'score-2',
          date: new Date().toISOString(),
          accuracy: 55,
          duration: 20,
        },
      ],
    })

    render(<UpNextWidget />)
    expect(screen.getByText('Hard Piece')).toBeInTheDocument()
    expect(screen.getByTestId('suggestion-accuracy')).toHaveTextContent('55%')
  })

  it('shows accuracy color-coded: crimson for low', () => {
    useLibraryStore.setState({
      scores: [{ id: 'score-1', title: 'Test', composer: 'Test' }],
    })
    useSessionStore.setState({
      practiceHistory: [
        {
          scoreId: 'score-1',
          date: new Date().toISOString(),
          accuracy: 40,
          duration: 20,
        },
      ],
    })

    render(<UpNextWidget />)
    expect(screen.getByTestId('suggestion-accuracy').className).toContain(
      'text-crimson',
    )
  })

  it('shows Start Practice button', () => {
    useLibraryStore.setState({
      scores: [{ id: 'score-1', title: 'Test', composer: 'Test' }],
    })

    render(<UpNextWidget />)
    expect(screen.getByTestId('start-practice-btn')).toBeInTheDocument()
    expect(screen.getByText('Start Practice')).toBeInTheDocument()
  })

  it('navigates to practice on Start Practice click', async () => {
    useLibraryStore.setState({
      scores: [{ id: 'score-1', title: 'Test', composer: 'Test' }],
    })

    render(<UpNextWidget />)
    await userEvent.click(screen.getByTestId('start-practice-btn'))
    expect(window.location.hash).toBe('#/practice')
  })
})

describe('findWeakestScore', () => {
  it('returns null when no scores', () => {
    expect(findWeakestScore([], [])).toBeNull()
  })

  it('returns unpracticed score when available', () => {
    const scores = [{ id: 's1', title: 'Test' }]
    const result = findWeakestScore([], scores)
    expect(result.score.id).toBe('s1')
    expect(result.sessions).toBe(0)
  })

  it('returns score with lowest average accuracy', () => {
    const scores = [
      { id: 's1', title: 'Good' },
      { id: 's2', title: 'Weak' },
    ]
    const history = [
      { scoreId: 's1', date: new Date().toISOString(), accuracy: 90 },
      { scoreId: 's2', date: new Date().toISOString(), accuracy: 50 },
      { scoreId: 's2', date: new Date().toISOString(), accuracy: 60 },
    ]
    const result = findWeakestScore(history, scores)
    expect(result.score.id).toBe('s2')
    expect(result.avgAccuracy).toBe(55)
    expect(result.sessions).toBe(2)
  })

  it('prefers unpracticed over practiced when available', () => {
    const scores = [
      { id: 's1', title: 'Practiced' },
      { id: 's2', title: 'Unpracticed' },
    ]
    const history = [
      { scoreId: 's1', date: new Date().toISOString(), accuracy: 90 },
    ]
    const result = findWeakestScore(history, scores)
    expect(result.score.id).toBe('s2')
    expect(result.sessions).toBe(0)
  })
})
