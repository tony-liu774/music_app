import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from './useAuthStore'

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      session: null,
      loading: true,
      subscriptionStatus: 'free',
    })
  })

  it('has correct initial state', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.session).toBeNull()
    expect(state.loading).toBe(true)
    expect(state.subscriptionStatus).toBe('free')
  })

  it('sets user', () => {
    const mockUser = { id: '123', email: 'test@example.com' }
    useAuthStore.getState().setUser(mockUser)
    expect(useAuthStore.getState().user).toEqual(mockUser)
  })

  it('sets session', () => {
    const mockSession = { access_token: 'abc123' }
    useAuthStore.getState().setSession(mockSession)
    expect(useAuthStore.getState().session).toEqual(mockSession)
  })

  it('sets loading', () => {
    useAuthStore.getState().setLoading(false)
    expect(useAuthStore.getState().loading).toBe(false)
  })

  it('sets subscription status', () => {
    useAuthStore.getState().setSubscriptionStatus('premium')
    expect(useAuthStore.getState().subscriptionStatus).toBe('premium')
  })

  it('sets auth (user + session) and stops loading', () => {
    const mockUser = { id: '123' }
    const mockSession = { access_token: 'abc' }
    useAuthStore.getState().setAuth(mockUser, mockSession)
    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(state.session).toEqual(mockSession)
    expect(state.loading).toBe(false)
  })

  it('clears auth state', () => {
    useAuthStore.setState({
      user: { id: '123' },
      session: { access_token: 'abc' },
      loading: false,
      subscriptionStatus: 'premium',
    })
    useAuthStore.getState().clearAuth()
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.session).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.subscriptionStatus).toBe('free')
  })
})
