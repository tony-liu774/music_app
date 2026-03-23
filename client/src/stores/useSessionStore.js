import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export const useSessionStore = create(
  devtools(
    (set) => ({
      // Current session
      sessionId: null,
      sessionStartTime: null,
      startSession: (id) =>
        set(
          { sessionId: id, sessionStartTime: Date.now(), errorLog: [] },
          false,
          'startSession',
        ),
      endSession: () =>
        set({ sessionId: null, sessionStartTime: null }, false, 'endSession'),

      // Error log (JSON array for DSP errors during practice)
      errorLog: [],
      addError: (error) =>
        set(
          (state) => ({
            errorLog: [...state.errorLog, { timestamp: Date.now(), ...error }],
          }),
          false,
          'addError',
        ),
      clearErrorLog: () => set({ errorLog: [] }, false, 'clearErrorLog'),

      // Score association
      scoreId: null,
      setScoreId: (id) => set({ scoreId: id }, false, 'setScoreId'),

      // Practice history
      practiceHistory: [],
      addPracticeRecord: (record) =>
        set(
          (state) => ({
            practiceHistory: [...state.practiceHistory, record],
          }),
          false,
          'addPracticeRecord',
        ),
      clearPracticeHistory: () =>
        set({ practiceHistory: [] }, false, 'clearPracticeHistory'),
    }),
    { name: 'SessionStore' },
  ),
)
