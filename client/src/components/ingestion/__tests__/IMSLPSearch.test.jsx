import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IMSLPSearch } from '../IMSLPSearch'

// Mock the UI components
vi.mock('../../ui/Button', () => ({
  default: ({ children, onClick, disabled, ...props }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('../../ui/Input', () => ({
  default: ({ value, onChange, placeholder, ...props }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      {...props}
    />
  ),
}))

vi.mock('../../ui/Select', () => ({
  default: ({ value, onChange, options, ...props }) => (
    <select value={value} onChange={onChange} {...props}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}))

// Mock the IMSLP client
vi.mock('../../services/IMSLPClient', () => ({
  default: {
    search: vi.fn(),
    download: vi.fn(),
  },
}))

import imslpClient from '../../services/IMSLPClient'

describe('IMSLPSearch', () => {
  const mockOnSelect = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the IMSLP search UI', () => {
    render(
      <IMSLPSearch onSelect={mockOnSelect} onCancel={mockOnCancel} />
    )

    expect(screen.getByText('Search IMSLP')).toBeTruthy()
    expect(screen.getByText(/public domain sheet music/i)).toBeTruthy()
    expect(screen.getByPlaceholderText(/search by composer/i)).toBeTruthy()
    expect(screen.getByText('Search')).toBeTruthy()
  })

  it('shows error when searching with empty query', async () => {
    render(
      <IMSLPSearch onSelect={mockOnSelect} onCancel={mockOnCancel} />
    )

    const searchButton = screen.getByText('Search')
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText(/Please enter a search term/i)).toBeTruthy()
    })
  })

  it('calls search API when search button is clicked', async () => {
    imslpClient.search.mockResolvedValue([
      {
        id: 'test-1',
        title: 'Test Piece',
        composer: 'Test Composer',
        instrument: 'Violin',
        difficulty: 'Intermediate',
      },
    ])

    render(
      <IMSLPSearch onSelect={mockOnSelect} onCancel={mockOnCancel} />
    )

    const input = screen.getByPlaceholderText(/search by composer/i)
    fireEvent.change(input, { target: { value: 'Bach' } })

    const searchButton = screen.getByText('Search')
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(imslpClient.search).toHaveBeenCalledWith('Bach', null)
    })
  })

  it('displays search results', async () => {
    const mockResults = [
      {
        id: 'test-1',
        title: 'Violin Concerto',
        composer: 'J.S. Bach',
        instrument: 'Violin',
        difficulty: 'Advanced',
      },
      {
        id: 'test-2',
        title: 'Cello Suite',
        composer: 'J.S. Bach',
        instrument: 'Cello',
        difficulty: 'Intermediate',
      },
    ]

    imslpClient.search.mockResolvedValue(mockResults)

    render(
      <IMSLPSearch onSelect={mockOnSelect} onCancel={mockOnCancel} />
    )

    const input = screen.getByPlaceholderText(/search by composer/i)
    fireEvent.change(input, { target: { value: 'Bach' } })

    const searchButton = screen.getByText('Search')
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText('Violin Concerto')).toBeTruthy()
      expect(screen.getByText('Cello Suite')).toBeTruthy()
    })
  })

  it('shows error when search fails', async () => {
    imslpClient.search.mockRejectedValue(new Error('Network error'))

    render(
      <IMSLPSearch onSelect={mockOnSelect} onCancel={mockOnCancel} />
    )

    const input = screen.getByPlaceholderText(/search by composer/i)
    fireEvent.change(input, { target: { value: 'Test' } })

    const searchButton = screen.getByText('Search')
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText(/Search failed/i)).toBeTruthy()
    })
  })

  it('allows selecting a search result', async () => {
    const mockResults = [
      {
        id: 'test-1',
        title: 'Test Piece',
        composer: 'Test Composer',
        instrument: 'Violin',
        difficulty: 'Intermediate',
      },
    ]

    imslpClient.search.mockResolvedValue(mockResults)

    render(
      <IMSLPSearch onSelect={mockOnSelect} onCancel={mockOnCancel} />
    )

    const input = screen.getByPlaceholderText(/search by composer/i)
    fireEvent.change(input, { target: { value: 'Test' } })

    const searchButton = screen.getByText('Search')
    fireEvent.click(searchButton)

    await waitFor(() => {
      const resultButton = screen.getByText('Test Piece').closest('button')
      fireEvent.click(resultButton)
    })

    // Result should now be selected (indicated by checkmark)
    expect(screen.getByText('Download Selected')).toBeTruthy()
  })

  it('calls onCancel when cancel is clicked', () => {
    render(
      <IMSLPSearch onSelect={mockOnSelect} onCancel={mockOnCancel} />
    )

    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)

    expect(mockOnCancel).toHaveBeenCalled()
  })
})
