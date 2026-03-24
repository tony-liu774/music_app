import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect } from 'vitest'
import ProtectedRoute from '../ProtectedRoute'

const mockUseAuth = vi.fn()

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('ProtectedRoute', () => {
  it('shows loading state when auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })
    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    )
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('renders children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '123', email: 'test@example.com' },
      loading: false,
    })
    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    )
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    )
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('uses Oxford Blue background for loading state', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })
    const { container } = renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
    )
    expect(container.querySelector('.bg-oxford-blue')).toBeInTheDocument()
  })
})
