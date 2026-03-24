import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'
import LoginPage from '../LoginPage'

const mockSignInWithGoogle = vi.fn()
const mockSignInWithApple = vi.fn()

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    signInWithGoogle: mockSignInWithGoogle,
    signInWithApple: mockSignInWithApple,
  }),
}))

describe('LoginPage', () => {
  it('renders the app title', () => {
    render(<LoginPage />)
    expect(screen.getByText('The Virtual Concertmaster')).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    render(<LoginPage />)
    expect(
      screen.getByText('Your AI-powered practice companion'),
    ).toBeInTheDocument()
  })

  it('renders Google sign-in button', () => {
    render(<LoginPage />)
    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument()
  })

  it('renders Apple sign-in button', () => {
    render(<LoginPage />)
    expect(
      screen.getByRole('button', { name: /continue with apple/i }),
    ).toBeInTheDocument()
  })

  it('calls signInWithGoogle when Google button is clicked', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.click(
      screen.getByRole('button', { name: /continue with google/i }),
    )
    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1)
  })

  it('calls signInWithApple when Apple button is clicked', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.click(
      screen.getByRole('button', { name: /continue with apple/i }),
    )
    expect(mockSignInWithApple).toHaveBeenCalledTimes(1)
  })

  it('renders terms of service text', () => {
    render(<LoginPage />)
    expect(screen.getByText(/terms of service/i)).toBeInTheDocument()
  })

  it('uses Oxford Blue background', () => {
    const { container } = render(<LoginPage />)
    expect(container.firstChild).toHaveClass('bg-oxford-blue')
  })
})
