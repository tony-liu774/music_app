import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from './useSessionStore'

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessionId: null,
      sessionStartTime: null,
      errorLog: [],
      scoreId: null,
      practiceHistory: [],
    })
  })

  it('has correct initial state', () => {
    const state = useSessionStore.getState()
    expect(state.sessionId).toBeNull()
    expect(state.sessionStartTime).toBeNull()
    expect(state.errorLog).toEqual([])
    expect(state.scoreId).toBeNull()
    expect(state.practiceHistory).toEqual([])
  })

  it('starts a session with id and timestamp', () => {
    useSessionStore.getState().startSession('session-1')
    const state = useSessionStore.getState()
    expect(state.sessionId).toBe('session-1')
    expect(state.sessionStartTime).toBeTypeOf('number')
    expect(state.errorLog).toEqual([])
  })

  it('ends a session', () => {
    useSessionStore.getState().startSession('session-1')
    useSessionStore.getState().endSession()
    const state = useSessionStore.getState()
    expect(state.sessionId).toBeNull()
    expect(state.sessionStartTime).toBeNull()
  })

  it('adds errors to the log with timestamps', () => {
    useSessionStore.getState().addError({ measure: 5, type: 'pitch', deviation: 15 })
    useSessionStore.getState().addError({ measure: 8, type: 'rhythm', deviation: 50 })

    const errors = useSessionStore.getState().errorLog
    expect(errors).toHaveLength(2)
    expect(errors[0].measure).toBe(5)
    expect(errors[0].timestamp).toBeTypeOf('number')
    expect(errors[1].type).toBe('rhythm')
  })

  it('clears the error log', () => {
    useSessionStore.getState().addError({ measure: 1, type: 'pitch', deviation: 10 })
    useSessionStore.getState().clearErrorLog()
    expect(useSessionStore.getState().errorLog).toEqual([])
  })

  it('starting a new session resets the error log', () => {
    useSessionStore.getState().addError({ measure: 1, type: 'pitch', deviation: 10 })
    useSessionStore.getState().startSession('session-2')
    expect(useSessionStore.getState().errorLog).toEqual([])
  })

  it('sets score ID', () => {
    useSessionStore.getState().setScoreId('score-abc')
    expect(useSessionStore.getState().scoreId).toBe('score-abc')
  })

  it('adds practice records to history', () => {
    const record = { sessionId: 's1', duration: 300, scoreId: 'score-1', errors: 5 }
    useSessionStore.getState().addPracticeRecord(record)
    expect(useSessionStore.getState().practiceHistory).toHaveLength(1)
    expect(useSessionStore.getState().practiceHistory[0]).toEqual(record)
  })

  it('clears practice history', () => {
    useSessionStore.getState().addPracticeRecord({ sessionId: 's1' })
    useSessionStore.getState().clearPracticeHistory()
    expect(useSessionStore.getState().practiceHistory).toEqual([])
  })
})
