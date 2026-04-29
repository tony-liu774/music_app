import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SmartIngestion from '../SmartIngestion'

// Mock the UI components
vi.mock('../../ui/Modal', () => ({
  default: ({ isOpen, children }) => (isOpen ? <div data-testid="modal">{children}</div> : null),
}))

vi.mock('../../ui/Button', () => ({
  default: ({ children, onClick, ...props }) => (
    <button onClick={onClick} {...props}>
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

vi.mock('../../ui/Toast', () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}))

// Mock the sub-components
vi.mock('../CameraCapture', () => ({
  default: ({ onCapture, onCancel }) => (
    <div data-testid="camera-capture">
      <button onClick={() => onCapture('data:image/jpeg;base64,test')}>Simulate Capture</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

vi.mock('../PDFUpload', () => ({
  default: ({ onFileSelect, onCancel }) => (
    <div data-testid="pdf-upload">
      <button onClick={() => onFileSelect(new File([], 'test.pdf'))}>Select PDF</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

vi.mock('../IMSLPSearch', () => ({
  default: ({ onSelect, onCancel }) => (
    <div data-testid="imslp-search">
      <button
        onClick={() =>
          onSelect({
            id: 'test-1',
            title: 'Test Piece',
            composer: 'Test Composer',
            blob: new Blob(),
          })
        }
      >
        Select Result
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

describe('SmartIngestion', () => {
  const mockOnScoreCreated = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('renders the method selection when open', () => {
    render(
      <SmartIngestion
        isOpen={true}
        onClose={mockOnClose}
        onScoreCreated={mockOnScoreCreated}
      />
    )

    expect(screen.getByText('Add Sheet Music')).toBeTruthy()
    expect(screen.getByText('Camera Capture')).toBeTruthy()
    expect(screen.getByText('Upload File')).toBeTruthy()
    expect(screen.getByText('Search Online')).toBeTruthy()
  })

  it('shows Camera Capture when camera option is selected', () => {
    render(
      <SmartIngestion
        isOpen={true}
        onClose={mockOnClose}
        onScoreCreated={mockOnScoreCreated}
      />
    )

    fireEvent.click(screen.getByText('Camera Capture'))
    expect(screen.getByTestId('camera-capture')).toBeTruthy()
  })

  it('shows PDF Upload when upload option is selected', () => {
    render(
      <SmartIngestion
        isOpen={true}
        onClose={mockOnClose}
        onScoreCreated={mockOnScoreCreated}
      />
    )

    fireEvent.click(screen.getByText('Upload File'))
    expect(screen.getByTestId('pdf-upload')).toBeTruthy()
  })

  it('shows IMSLP Search when search option is selected', () => {
    render(
      <SmartIngestion
        isOpen={true}
        onClose={mockOnClose}
        onScoreCreated={mockOnScoreCreated}
      />
    )

    fireEvent.click(screen.getByText('Search Online'))
    expect(screen.getByTestId('imslp-search')).toBeTruthy()
  })

  it('renders metadata form after processing', async () => {
    // Mock fetch to return simulated result
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ simulated: true, measures: [] }),
    })

    render(
      <SmartIngestion
        isOpen={true}
        onClose={mockOnClose}
        onScoreCreated={mockOnScoreCreated}
      />
    )

    // Select camera
    fireEvent.click(screen.getByText('Camera Capture'))

    // Simulate capture
    fireEvent.click(screen.getByText('Simulate Capture'))

    // Wait for preview
    await waitFor(() => {
      expect(screen.getByText('Digitize')).toBeTruthy()
    })

    // Click Digitize
    fireEvent.click(screen.getByText('Digitize'))

    // Wait for metadata form
    await waitFor(
      () => {
        expect(screen.getByText('Score Details')).toBeTruthy()
      },
      { timeout: 10000 }
    )
  })

  it('calls onClose when modal is closed', () => {
    render(
      <SmartIngestion
        isOpen={true}
        onClose={mockOnClose}
        onScoreCreated={mockOnScoreCreated}
      />
    )

    // Find and click the close button (X)
    const closeButton = screen.getByLabelText('Close modal')
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('does not render when isOpen is false', () => {
    render(
      <SmartIngestion
        isOpen={false}
        onClose={mockOnClose}
        onScoreCreated={mockOnScoreCreated}
      />
    )

    expect(screen.queryByText('Add Sheet Music')).toBeNull()
  })
})
