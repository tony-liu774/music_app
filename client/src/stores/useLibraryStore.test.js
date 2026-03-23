import { describe, it, expect, beforeEach } from 'vitest'
import { useLibraryStore } from './useLibraryStore'

describe('useLibraryStore', () => {
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

  it('has correct initial state', () => {
    const state = useLibraryStore.getState()
    expect(state.scores).toEqual([])
    expect(state.selectedScore).toBeNull()
    expect(state.searchQuery).toBe('')
    expect(state.filterInstrument).toBeNull()
    expect(state.filterDifficulty).toBeNull()
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
})
