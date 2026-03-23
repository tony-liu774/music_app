import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export const useLibraryStore = create(
  devtools(
    (set) => ({
      // Score list
      scores: [],
      setScores: (scores) => set({ scores }, false, 'setScores'),

      // Selected score
      selectedScore: null,
      setSelectedScore: (score) =>
        set({ selectedScore: score }, false, 'setSelectedScore'),

      // Search / filter
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }, false, 'setSearchQuery'),

      filterInstrument: null,
      setFilterInstrument: (instrument) =>
        set({ filterInstrument: instrument }, false, 'setFilterInstrument'),

      filterDifficulty: null,
      setFilterDifficulty: (difficulty) =>
        set({ filterDifficulty: difficulty }, false, 'setFilterDifficulty'),

      // Loading state
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }, false, 'setIsLoading'),

      // Error state
      error: null,
      setError: (error) => set({ error }, false, 'setError'),
    }),
    { name: 'LibraryStore' },
  ),
)
