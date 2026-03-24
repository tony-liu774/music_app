import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Practice from '../Practice'
import { useLibraryStore } from '../../stores/useLibraryStore'

vi.mock('../../services/LibraryService', () => ({
  default: {
    init: vi.fn(),
    getAllScores: vi.fn().mockResolvedValue([]),
  },
}))

function renderPractice() {
  return render(
    <MemoryRouter>
      <Practice />
    </MemoryRouter>,
  )
}

describe('Practice Page', () => {
  beforeEach(() => {
    useLibraryStore.setState({
      scores: [],
      selectedScore: null,
      searchQuery: '',
      filterInstrument: null,
      filterDifficulty: null,
      isLoading: false,
      error: null,
    })
  })

  it('renders the Practice heading', () => {
    renderPractice()
    expect(screen.getByText('Practice')).toBeInTheDocument()
  })

  it('shows no-score message when no score selected', () => {
    renderPractice()
    expect(screen.getByTestId('practice-no-score')).toBeInTheDocument()
    expect(screen.getByText(/no score selected/i)).toBeInTheDocument()
  })

  it('shows Browse Library button when no score selected', () => {
    renderPractice()
    expect(screen.getByText('Browse Library')).toBeInTheDocument()
  })

  it('shows selected score info when a score is selected', () => {
    useLibraryStore.setState({
      selectedScore: {
        id: '1',
        title: 'Bach Partita No. 2',
        composer: 'J.S. Bach',
        instrument: 'violin',
      },
    })
    renderPractice()
    expect(screen.getByTestId('practice-score-info')).toBeInTheDocument()
    expect(screen.getByText('Bach Partita No. 2')).toBeInTheDocument()
    expect(screen.getByText('J.S. Bach')).toBeInTheDocument()
    expect(screen.getByText('violin')).toBeInTheDocument()
  })

  it('shows Unknown Composer when composer is missing', () => {
    useLibraryStore.setState({
      selectedScore: { id: '1', title: 'Test Score' },
    })
    renderPractice()
    expect(screen.getByText('Unknown Composer')).toBeInTheDocument()
  })
})
