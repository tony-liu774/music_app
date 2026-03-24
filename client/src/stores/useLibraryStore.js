import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import libraryService from '../services/LibraryService'

export const SORT_OPTIONS = {
  RECENTLY_PRACTICED: 'recentlyPracticed',
  COMPOSER: 'composer',
  TITLE: 'title',
  DIFFICULTY: 'difficulty',
}

function sortScores(scores, sortBy) {
  const sorted = [...scores]
  switch (sortBy) {
    case SORT_OPTIONS.RECENTLY_PRACTICED:
      return sorted.sort((a, b) => {
        if (!a.lastPracticed && !b.lastPracticed) return 0
        if (!a.lastPracticed) return 1
        if (!b.lastPracticed) return -1
        return new Date(b.lastPracticed) - new Date(a.lastPracticed)
      })
    case SORT_OPTIONS.COMPOSER:
      return sorted.sort((a, b) =>
        (a.composer || '').localeCompare(b.composer || ''),
      )
    case SORT_OPTIONS.TITLE:
      return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    case SORT_OPTIONS.DIFFICULTY:
      return sorted.sort((a, b) => (a.difficulty || 3) - (b.difficulty || 3))
    default:
      return sorted
  }
}

function filterScores(scores, { searchQuery, filterInstrument }) {
  let filtered = scores

  if (filterInstrument) {
    filtered = filtered.filter(
      (s) => s.instrument?.toLowerCase() === filterInstrument.toLowerCase(),
    )
  }

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim()
    filtered = filtered.filter(
      (s) =>
        s.title?.toLowerCase().includes(q) ||
        s.composer?.toLowerCase().includes(q),
    )
  }

  return filtered
}

export const useLibraryStore = create(
  devtools(
    (set, get) => ({
      // Score list
      scores: [],
      setScores: (scores) => set({ scores }, false, 'setScores'),

      // Selected score
      selectedScore: null,
      setSelectedScore: (score) =>
        set({ selectedScore: score }, false, 'setSelectedScore'),

      // Search / filter
      searchQuery: '',
      setSearchQuery: (query) =>
        set({ searchQuery: query }, false, 'setSearchQuery'),

      filterInstrument: null,
      setFilterInstrument: (instrument) =>
        set({ filterInstrument: instrument }, false, 'setFilterInstrument'),

      filterDifficulty: null,
      setFilterDifficulty: (difficulty) =>
        set({ filterDifficulty: difficulty }, false, 'setFilterDifficulty'),

      // Sorting
      sortBy: SORT_OPTIONS.TITLE,
      setSortBy: (sortBy) => set({ sortBy }, false, 'setSortBy'),

      // Loading state
      isLoading: false,
      setIsLoading: (loading) =>
        set({ isLoading: loading }, false, 'setIsLoading'),

      // Error state
      error: null,
      setError: (error) => set({ error }, false, 'setError'),

      // Computed: filtered and sorted scores
      getFilteredScores: () => {
        const { scores, searchQuery, filterInstrument, sortBy } = get()
        const filtered = filterScores(scores, { searchQuery, filterInstrument })
        return sortScores(filtered, sortBy)
      },

      // Async actions
      fetchScores: async () => {
        set({ isLoading: true, error: null }, false, 'fetchScores/start')
        try {
          const scores = await libraryService.getAllScores()
          set({ scores, isLoading: false }, false, 'fetchScores/success')
        } catch (error) {
          set(
            { error: error.message, isLoading: false },
            false,
            'fetchScores/error',
          )
        }
      },

      addScore: async (scoreData) => {
        set({ isLoading: true, error: null }, false, 'addScore/start')
        try {
          const score = await libraryService.addScore(scoreData)
          set(
            (state) => ({
              scores: [...state.scores, score],
              isLoading: false,
            }),
            false,
            'addScore/success',
          )
          return score
        } catch (error) {
          set(
            { error: error.message, isLoading: false },
            false,
            'addScore/error',
          )
          return null
        }
      },

      deleteScore: async (id) => {
        try {
          await libraryService.deleteScore(id)
          set(
            (state) => ({
              scores: state.scores.filter((s) => s.id !== id),
              selectedScore:
                state.selectedScore?.id === id ? null : state.selectedScore,
            }),
            false,
            'deleteScore/success',
          )
        } catch (error) {
          set({ error: error.message }, false, 'deleteScore/error')
        }
      },

      recordPractice: async (id) => {
        try {
          const updated = await libraryService.recordPractice(id)
          set(
            (state) => ({
              scores: state.scores.map((s) => (s.id === id ? updated : s)),
            }),
            false,
            'recordPractice/success',
          )
        } catch (error) {
          set({ error: error.message }, false, 'recordPractice/error')
        }
      },
    }),
    { name: 'LibraryStore' },
  ),
)
