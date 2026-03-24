import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useLibraryStore, SORT_OPTIONS } from './useLibraryStore'

// Mock the library service
vi.mock('../services/LibraryService', () => ({
  default: {
    init: vi.fn(),
    getAllScores: vi.fn().mockResolvedValue([]),
    getScore: vi.fn(),
    addScore: vi.fn(),
    updateScore: vi.fn(),
    deleteScore: vi.fn(),
    recordPractice: vi.fn(),
  },
}))

const initialState = {
  scores: [],
  selectedScore: null,
  searchQuery: '',
  filterInstrument: null,
  filterDifficulty: null,
  sortBy: SORT_OPTIONS.TITLE,
  isLoading: false,
  error: null,
}

describe('useLibraryStore', () => {
  beforeEach(() => {
    useLibraryStore.setState(initialState)
  })

  it('has correct initial state', () => {
    const state = useLibraryStore.getState()
    expect(state.scores).toEqual([])
    expect(state.selectedScore).toBeNull()
    expect(state.searchQuery).toBe('')
    expect(state.filterInstrument).toBeNull()
    expect(state.filterDifficulty).toBeNull()
    expect(state.sortBy).toBe(SORT_OPTIONS.TITLE)
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('sets scores list', () => {
    const scores = [
      { id: '1', title: 'Bach Partita No. 2' },
      { id: '2', title: 'Paganini Caprice No. 24' },
    ]
    useLibraryStore.getState().setScores(scores)
    expect(useLibraryStore.getState().scores).toEqual(scores)
  })

  it('selects a score', () => {
    const score = { id: '1', title: 'Bach Partita No. 2' }
    useLibraryStore.getState().setSelectedScore(score)
    expect(useLibraryStore.getState().selectedScore).toEqual(score)
  })

  it('sets search query', () => {
    useLibraryStore.getState().setSearchQuery('Bach')
    expect(useLibraryStore.getState().searchQuery).toBe('Bach')
  })

  it('sets instrument filter', () => {
    useLibraryStore.getState().setFilterInstrument('violin')
    expect(useLibraryStore.getState().filterInstrument).toBe('violin')
  })

  it('sets difficulty filter', () => {
    useLibraryStore.getState().setFilterDifficulty('advanced')
    expect(useLibraryStore.getState().filterDifficulty).toBe('advanced')
  })

  it('sets loading state', () => {
    useLibraryStore.getState().setIsLoading(true)
    expect(useLibraryStore.getState().isLoading).toBe(true)
  })

  it('sets error state', () => {
    useLibraryStore.getState().setError('Failed to fetch scores')
    expect(useLibraryStore.getState().error).toBe('Failed to fetch scores')
  })

  it('clears filters by setting to null', () => {
    useLibraryStore.getState().setFilterInstrument('cello')
    useLibraryStore.getState().setFilterDifficulty('beginner')
    useLibraryStore.getState().setSearchQuery('Mozart')

    useLibraryStore.getState().setFilterInstrument(null)
    useLibraryStore.getState().setFilterDifficulty(null)
    useLibraryStore.getState().setSearchQuery('')

    expect(useLibraryStore.getState().filterInstrument).toBeNull()
    expect(useLibraryStore.getState().filterDifficulty).toBeNull()
    expect(useLibraryStore.getState().searchQuery).toBe('')
  })

  it('sets sort option', () => {
    useLibraryStore.getState().setSortBy(SORT_OPTIONS.COMPOSER)
    expect(useLibraryStore.getState().sortBy).toBe(SORT_OPTIONS.COMPOSER)
  })

  describe('getFilteredScores', () => {
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
        lastPracticed: '2026-03-22T10:00:00Z',
      },
      {
        id: '3',
        title: 'Mozart Violin Concerto No. 5',
        composer: 'Mozart',
        instrument: 'violin',
        difficulty: 3,
        lastPracticed: null,
      },
    ]

    beforeEach(() => {
      useLibraryStore.setState({
        scores: testScores,
        sortBy: SORT_OPTIONS.TITLE,
      })
    })

    it('returns all scores when no filters are applied', () => {
      const filtered = useLibraryStore.getState().getFilteredScores()
      expect(filtered).toHaveLength(3)
    })

    it('filters by search query on title', () => {
      useLibraryStore.setState({ searchQuery: 'bach' })
      const filtered = useLibraryStore.getState().getFilteredScores()
      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Bach Partita No. 2')
    })

    it('filters by search query on composer', () => {
      useLibraryStore.setState({ searchQuery: 'mozart' })
      const filtered = useLibraryStore.getState().getFilteredScores()
      expect(filtered).toHaveLength(1)
      expect(filtered[0].composer).toBe('Mozart')
    })

    it('filters by instrument', () => {
      useLibraryStore.setState({ filterInstrument: 'violin' })
      const filtered = useLibraryStore.getState().getFilteredScores()
      expect(filtered).toHaveLength(2)
      filtered.forEach((s) => expect(s.instrument).toBe('violin'))
    })

    it('combines search query and instrument filter', () => {
      useLibraryStore.setState({
        searchQuery: 'bach',
        filterInstrument: 'violin',
      })
      const filtered = useLibraryStore.getState().getFilteredScores()
      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Bach Partita No. 2')
    })

    it('sorts by title alphabetically', () => {
      useLibraryStore.setState({ sortBy: SORT_OPTIONS.TITLE })
      const filtered = useLibraryStore.getState().getFilteredScores()
      expect(filtered[0].title).toBe('Bach Partita No. 2')
      expect(filtered[1].title).toBe('Elgar Cello Concerto')
      expect(filtered[2].title).toBe('Mozart Violin Concerto No. 5')
    })

    it('sorts by composer alphabetically', () => {
      useLibraryStore.setState({ sortBy: SORT_OPTIONS.COMPOSER })
      const filtered = useLibraryStore.getState().getFilteredScores()
      expect(filtered[0].composer).toBe('Bach')
      expect(filtered[1].composer).toBe('Elgar')
      expect(filtered[2].composer).toBe('Mozart')
    })

    it('sorts by difficulty ascending', () => {
      useLibraryStore.setState({ sortBy: SORT_OPTIONS.DIFFICULTY })
      const filtered = useLibraryStore.getState().getFilteredScores()
      expect(filtered[0].difficulty).toBe(3)
      expect(filtered[1].difficulty).toBe(4)
      expect(filtered[2].difficulty).toBe(5)
    })

    it('sorts by recently practiced (most recent first)', () => {
      useLibraryStore.setState({ sortBy: SORT_OPTIONS.RECENTLY_PRACTICED })
      const filtered = useLibraryStore.getState().getFilteredScores()
      expect(filtered[0].id).toBe('2') // most recent
      expect(filtered[1].id).toBe('1')
      expect(filtered[2].id).toBe('3') // null goes last
    })

    it('returns empty array when no scores match filters', () => {
      useLibraryStore.setState({ searchQuery: 'nonexistent' })
      const filtered = useLibraryStore.getState().getFilteredScores()
      expect(filtered).toHaveLength(0)
    })
  })

  describe('async actions', () => {
    it('fetchScores loads scores from service', async () => {
      const { default: libraryService } =
        await import('../services/LibraryService')
      const mockScores = [{ id: '1', title: 'Test Score' }]
      libraryService.getAllScores.mockResolvedValueOnce(mockScores)

      await useLibraryStore.getState().fetchScores()

      expect(useLibraryStore.getState().scores).toEqual(mockScores)
      expect(useLibraryStore.getState().isLoading).toBe(false)
    })

    it('fetchScores sets error on failure', async () => {
      const { default: libraryService } =
        await import('../services/LibraryService')
      libraryService.getAllScores.mockRejectedValueOnce(new Error('DB error'))

      await useLibraryStore.getState().fetchScores()

      expect(useLibraryStore.getState().error).toBe('DB error')
      expect(useLibraryStore.getState().isLoading).toBe(false)
    })

    it('addScore adds a new score to the list', async () => {
      const { default: libraryService } =
        await import('../services/LibraryService')
      const newScore = { id: '99', title: 'New Score' }
      libraryService.addScore.mockResolvedValueOnce(newScore)

      const result = await useLibraryStore
        .getState()
        .addScore({ title: 'New Score' })

      expect(result).toEqual(newScore)
      expect(useLibraryStore.getState().scores).toContainEqual(newScore)
    })

    it('deleteScore removes a score from the list', async () => {
      const { default: libraryService } =
        await import('../services/LibraryService')
      libraryService.deleteScore.mockResolvedValueOnce()

      useLibraryStore.setState({
        scores: [{ id: '1', title: 'To Delete' }],
        selectedScore: { id: '1', title: 'To Delete' },
      })

      await useLibraryStore.getState().deleteScore('1')

      expect(useLibraryStore.getState().scores).toHaveLength(0)
      expect(useLibraryStore.getState().selectedScore).toBeNull()
    })

    it('recordPractice updates the score in the list', async () => {
      const { default: libraryService } =
        await import('../services/LibraryService')
      const updated = {
        id: '1',
        title: 'Test',
        lastPracticed: '2026-03-23T00:00:00Z',
        practiceCount: 1,
      }
      libraryService.recordPractice.mockResolvedValueOnce(updated)

      useLibraryStore.setState({
        scores: [{ id: '1', title: 'Test', practiceCount: 0 }],
      })

      await useLibraryStore.getState().recordPractice('1')

      expect(useLibraryStore.getState().scores[0].practiceCount).toBe(1)
    })
  })
})
