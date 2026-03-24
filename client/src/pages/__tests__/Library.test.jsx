import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Library from '../Library'
import { useLibraryStore, SORT_OPTIONS } from '../../stores/useLibraryStore'
import libraryService from '../../services/LibraryService'

// Mock library service
vi.mock('../../services/LibraryService', () => ({
  default: {
    init: vi.fn(),
    getAllScores: vi.fn().mockResolvedValue([]),
    addScore: vi.fn(),
    deleteScore: vi.fn(),
    recordPractice: vi.fn(),
  },
}))

const testScores = [
  {
    id: '1',
    title: 'Bach Partita No. 2',
    composer: 'Bach',
    instrument: 'violin',
    difficulty: 5,
    lastPracticed: '2026-03-20T10:00:00Z',
  },
  {
    id: '2',
    title: 'Elgar Cello Concerto',
    composer: 'Elgar',
    instrument: 'cello',
    difficulty: 4,
    lastPracticed: null,
  },
  {
    id: '3',
    title: 'Mozart Violin Concerto No. 5',
    composer: 'Mozart',
    instrument: 'violin',
    difficulty: 3,
    lastPracticed: '2026-03-22T10:00:00Z',
  },
]

function renderLibrary() {
  return render(
    <MemoryRouter>
      <Library />
    </MemoryRouter>,
  )
}

describe('Library Page', () => {
  beforeEach(() => {
    // Set up mock to return test scores when fetchScores runs on mount
    libraryService.getAllScores.mockResolvedValue(testScores)

    useLibraryStore.setState({
      scores: [],
      selectedScore: null,
      searchQuery: '',
      filterInstrument: null,
      filterDifficulty: null,
      sortBy: SORT_OPTIONS.TITLE,
      isLoading: false,
      error: null,
    })
  })

  it('renders the page heading', () => {
    renderLibrary()
    expect(screen.getByText('Library')).toBeInTheDocument()
  })

  it('renders subtitle with music library text', () => {
    renderLibrary()
    expect(screen.getByText(/music library/i)).toBeInTheDocument()
  })

  it('displays scores in a grid after loading', async () => {
    renderLibrary()
    await waitFor(() => {
      expect(screen.getByTestId('score-list')).toBeInTheDocument()
    })
    const cards = within(screen.getByTestId('score-list')).getAllByTestId(
      'score-card',
    )
    expect(cards).toHaveLength(3)
  })

  it('renders search input', () => {
    renderLibrary()
    expect(screen.getByTestId('search-input')).toBeInTheDocument()
  })

  it('renders instrument filter', () => {
    renderLibrary()
    expect(screen.getByTestId('instrument-filter')).toBeInTheDocument()
  })

  it('renders sort select', () => {
    renderLibrary()
    expect(screen.getByTestId('sort-select')).toBeInTheDocument()
  })

  it('filters scores by search query in real time', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await waitFor(() => {
      expect(screen.getByTestId('score-list')).toBeInTheDocument()
    })

    const searchInput = screen.getByTestId('search-input')
    await user.type(searchInput, 'bach')

    const cards = within(screen.getByTestId('score-list')).getAllByTestId(
      'score-card',
    )
    expect(cards).toHaveLength(1)
    expect(screen.getByText('Bach Partita No. 2')).toBeInTheDocument()
  })

  it('filters by instrument', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await waitFor(() => {
      expect(screen.getByTestId('score-list')).toBeInTheDocument()
    })

    const instrumentSelect = screen.getByTestId('instrument-filter')
    await user.selectOptions(instrumentSelect, 'cello')

    const cards = within(screen.getByTestId('score-list')).getAllByTestId(
      'score-card',
    )
    expect(cards).toHaveLength(1)
    expect(screen.getByText('Elgar Cello Concerto')).toBeInTheDocument()
  })

  it('shows empty state when no scores match search', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await waitFor(() => {
      expect(screen.getByTestId('score-list')).toBeInTheDocument()
    })

    const searchInput = screen.getByTestId('search-input')
    await user.type(searchInput, 'nonexistent')

    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText('No scores found')).toBeInTheDocument()
  })

  it('shows empty state when library is empty', async () => {
    libraryService.getAllScores.mockResolvedValueOnce([])
    renderLibrary()

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    })
  })

  it('toggles between grid and list view', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await waitFor(() => {
      expect(screen.getByTestId('score-list')).toBeInTheDocument()
    })

    const listBtn = screen.getByTestId('list-view-btn')
    await user.click(listBtn)

    const scoreList = screen.getByTestId('score-list')
    expect(scoreList.className).toContain('flex-col')
  })

  it('selects a score card', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await waitFor(() => {
      expect(screen.getByTestId('score-list')).toBeInTheDocument()
    })

    const cards = screen.getAllByTestId('score-card')
    await user.click(cards[0])

    expect(useLibraryStore.getState().selectedScore).toBeTruthy()
  })

  it('shows Start Practice button on selected card', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await waitFor(() => {
      expect(screen.getByTestId('score-list')).toBeInTheDocument()
    })

    const cards = screen.getAllByTestId('score-card')
    await user.click(cards[0])

    expect(screen.getByTestId('start-practice-btn')).toBeInTheDocument()
  })

  it('displays error when error state is set', async () => {
    libraryService.getAllScores.mockRejectedValueOnce(
      new Error('Something went wrong'),
    )
    renderLibrary()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })

  it('shows loading spinner initially', () => {
    // Prevent fetchScores from resolving immediately
    libraryService.getAllScores.mockReturnValueOnce(new Promise(() => {}))
    renderLibrary()

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('changes sort order', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await waitFor(() => {
      expect(screen.getByTestId('score-list')).toBeInTheDocument()
    })

    const sortSelect = screen.getByTestId('sort-select')
    await user.selectOptions(sortSelect, SORT_OPTIONS.DIFFICULTY)

    const scoreList = screen.getByTestId('score-list')
    const cards = within(scoreList).getAllByTestId('score-card')
    expect(
      within(cards[0]).getByText('Mozart Violin Concerto No. 5'),
    ).toBeInTheDocument()
  })
})
