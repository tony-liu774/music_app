import { render, screen, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from '../../../contexts/AuthContext'

let mockAuthStateCallback = null

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
      }),
      onAuthStateChange: vi.fn((callback) => {
        mockAuthStateCallback = callback
        return {
          data: {
            subscription: { unsubscribe: vi.fn() },
          },
        }
      }),
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

function TestConsumer() {
  const { user, session, loading } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.email : 'none'}</span>
      <span data-testid="session">{session ? 'active' : 'none'}</span>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    mockAuthStateCallback = null
    vi.clearAllMocks()
  })

  it('provides loading state initially', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>,
      )
    })
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('updates user when auth state changes', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>,
      )
    })

    await act(async () => {
      mockAuthStateCallback('SIGNED_IN', {
        user: { email: 'test@example.com' },
        access_token: 'token123',
      })
    })

    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    expect(screen.getByTestId('session')).toHaveTextContent('active')
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
  })

  it('clears user on sign out', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>,
      )
    })

    await act(async () => {
      mockAuthStateCallback('SIGNED_IN', {
        user: { email: 'test@example.com' },
        access_token: 'token123',
      })
    })

    await act(async () => {
      mockAuthStateCallback('SIGNED_OUT', null)
    })

    expect(screen.getByTestId('user')).toHaveTextContent('none')
    expect(screen.getByTestId('session')).toHaveTextContent('none')
  })

  it('throws error when useAuth is used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow(
      'useAuth must be used within an AuthProvider',
    )
    spy.mockRestore()
  })

  it('provides signInWithGoogle function', async () => {
    let authValue
    function Capture() {
      authValue = useAuth()
      return null
    }
    await act(async () => {
      render(
        <AuthProvider>
          <Capture />
        </AuthProvider>,
      )
    })
    expect(typeof authValue.signInWithGoogle).toBe('function')
  })

  it('provides signInWithApple function', async () => {
    let authValue
    function Capture() {
      authValue = useAuth()
      return null
    }
    await act(async () => {
      render(
        <AuthProvider>
          <Capture />
        </AuthProvider>,
      )
    })
    expect(typeof authValue.signInWithApple).toBe('function')
  })

  it('provides signOut function', async () => {
    let authValue
    function Capture() {
      authValue = useAuth()
      return null
    }
    await act(async () => {
      render(
        <AuthProvider>
          <Capture />
        </AuthProvider>,
      )
    })
    expect(typeof authValue.signOut).toBe('function')
  })
})
