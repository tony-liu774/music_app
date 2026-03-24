import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import SheetMusic from '../SheetMusic'

// Mock VexFlow — the real module requires a DOM canvas context that jsdom
// doesn't fully support, so we mock the rendering layer and verify that our
// component passes the right data through.
vi.mock('vexflow', () => {
  const mockContext = {
    save: vi.fn(),
    restore: vi.fn(),
    setFillStyle: vi.fn(),
    setStrokeStyle: vi.fn(),
    setLineWidth: vi.fn(),
    fillRect: vi.fn(),
  }

  const MockRenderer = vi.fn().mockImplementation(() => ({
    resize: vi.fn(),
    getContext: () => mockContext,
  }))
  MockRenderer.Backends = { SVG: 1 }

  const MockStave = vi.fn().mockImplementation(() => {
    const stave = {
      addClef: vi.fn().mockReturnThis(),
      addKeySignature: vi.fn().mockReturnThis(),
      addTimeSignature: vi.fn().mockReturnThis(),
      setStyle: vi.fn().mockReturnThis(),
      setContext: vi.fn().mockReturnThis(),
      draw: vi.fn().mockReturnThis(),
      getModifiers: vi.fn().mockReturnValue([]),
    }
    return stave
  })

  const MockStaveNote = vi.fn().mockImplementation(({ keys, duration }) => {
    const note = {
      keys,
      duration,
      addModifier: vi.fn().mockReturnThis(),
      setStyle: vi.fn().mockReturnThis(),
      setStemStyle: vi.fn().mockReturnThis(),
      isRest: () => duration.includes('r'),
      getDuration: () => duration,
      getTickables: () => [],
    }
    return note
  })

  class MockVoice {
    constructor() {
      this.tickables = []
    }
    setMode() { return this }
    addTickables(t) { this.tickables = t; return this }
    draw() { return this }
  }
  MockVoice.Mode = { SOFT: 2 }

  const MockFormatter = vi.fn().mockImplementation(() => ({
    joinVoices: vi.fn().mockReturnThis(),
    format: vi.fn().mockReturnThis(),
  }))

  return {
    Renderer: MockRenderer,
    Stave: MockStave,
    StaveNote: MockStaveNote,
    Voice: MockVoice,
    Formatter: MockFormatter,
    Accidental: vi.fn().mockImplementation(() => ({})),
    Articulation: vi.fn().mockImplementation(() => ({})),
    Dot: { buildAndAttach: vi.fn() },
    Beam: { generateBeams: vi.fn().mockReturnValue([]) },
    KeySignature: vi.fn(),
    TimeSignature: vi.fn(),
  }
})

// A minimal parsed score fixture
const mockScore = {
  title: 'Test',
  composer: 'Tester',
  parts: [
    {
      id: 'P1',
      name: 'Violin',
      measures: [
        {
          number: 1,
          clef: 'treble',
          keySignature: 'C',
          timeSignature: '4/4',
          dynamics: [],
          notes: [
            { isRest: false, duration: 'q', keys: ['c/4'], articulations: [] },
            { isRest: false, duration: 'q', keys: ['d/4'], articulations: [] },
            { isRest: false, duration: 'q', keys: ['e/4'], articulations: [] },
            { isRest: false, duration: 'q', keys: ['f/4'], articulations: [] },
          ],
        },
        {
          number: 2,
          clef: null,
          keySignature: null,
          timeSignature: null,
          dynamics: [],
          notes: [
            { isRest: false, duration: 'h', keys: ['g/4'], articulations: [] },
            { isRest: true, duration: 'hr', keys: ['b/4'], clef: 'treble' },
          ],
        },
      ],
    },
  ],
}

describe('SheetMusic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when score is null', () => {
    render(<SheetMusic score={null} />)
    expect(screen.getByTestId('sheet-music-empty')).toBeInTheDocument()
    expect(
      screen.getByText(/select a piece from your library/i),
    ).toBeInTheDocument()
  })

  it('renders SVG container when score is provided', () => {
    render(<SheetMusic score={mockScore} />)
    expect(screen.getByTestId('sheet-music')).toBeInTheDocument()
    expect(screen.getByTestId('sheet-music-svg')).toBeInTheDocument()
  })

  it('applies max-w-full and max-h-[70vh] classes', () => {
    render(<SheetMusic score={mockScore} />)
    const wrapper = screen.getByTestId('sheet-music')
    expect(wrapper.className).toContain('max-w-full')
    expect(wrapper.className).toContain('max-h-[70vh]')
  })

  it('applies overflow-x-auto for horizontal scrolling', () => {
    render(<SheetMusic score={mockScore} />)
    const wrapper = screen.getByTestId('sheet-music')
    expect(wrapper.className).toContain('overflow-x-auto')
  })

  it('passes additional className', () => {
    render(<SheetMusic score={mockScore} className="custom-class" />)
    const wrapper = screen.getByTestId('sheet-music')
    expect(wrapper.className).toContain('custom-class')
  })

  it('creates VexFlow Renderer with SVG backend', async () => {
    const { Renderer } = await import('vexflow')
    render(<SheetMusic score={mockScore} />)
    expect(Renderer).toHaveBeenCalled()
    expect(Renderer).toHaveBeenCalledWith(
      expect.anything(),
      Renderer.Backends.SVG,
    )
  })

  it('creates a Stave for each measure', async () => {
    const { Stave } = await import('vexflow')
    render(<SheetMusic score={mockScore} />)
    // 2 measures = 2 staves
    expect(Stave).toHaveBeenCalledTimes(2)
  })

  it('adds clef to first measure on system', async () => {
    const { Stave } = await import('vexflow')
    render(<SheetMusic score={mockScore} />)
    const firstStave = Stave.mock.results[0].value
    expect(firstStave.addClef).toHaveBeenCalledWith('treble')
  })

  it('adds key signature to first measure on system', async () => {
    const { Stave } = await import('vexflow')
    render(<SheetMusic score={mockScore} />)
    const firstStave = Stave.mock.results[0].value
    expect(firstStave.addKeySignature).toHaveBeenCalledWith('C')
  })

  it('adds time signature to first measure', async () => {
    const { Stave } = await import('vexflow')
    render(<SheetMusic score={mockScore} />)
    const firstStave = Stave.mock.results[0].value
    expect(firstStave.addTimeSignature).toHaveBeenCalledWith('4/4')
  })

  it('creates StaveNote for each note', async () => {
    const { StaveNote } = await import('vexflow')
    render(<SheetMusic score={mockScore} />)
    // 4 notes in measure 1 + 2 notes in measure 2 = 6
    expect(StaveNote).toHaveBeenCalledTimes(6)
  })

  it('creates rest notes with r suffix', async () => {
    const { StaveNote } = await import('vexflow')
    render(<SheetMusic score={mockScore} />)
    const restCall = StaveNote.mock.calls.find((c) =>
      c[0].duration.includes('r'),
    )
    expect(restCall).toBeDefined()
  })

  it('handles score with accidentals', async () => {
    const { Accidental } = await import('vexflow')
    const scoreWithAccidentals = {
      ...mockScore,
      parts: [
        {
          ...mockScore.parts[0],
          measures: [
            {
              ...mockScore.parts[0].measures[0],
              notes: [
                {
                  isRest: false,
                  duration: 'q',
                  keys: ['f#/4'],
                  accidentals: [{ index: 0, type: '#' }],
                  articulations: [],
                },
                { isRest: false, duration: 'q', keys: ['c/4'], articulations: [] },
                { isRest: false, duration: 'q', keys: ['c/4'], articulations: [] },
                { isRest: false, duration: 'q', keys: ['c/4'], articulations: [] },
              ],
            },
          ],
        },
      ],
    }
    render(<SheetMusic score={scoreWithAccidentals} />)
    expect(Accidental).toHaveBeenCalledWith('#')
  })

  it('handles score with dotted notes', async () => {
    const { Dot } = await import('vexflow')
    const scoreWithDots = {
      ...mockScore,
      parts: [
        {
          ...mockScore.parts[0],
          measures: [
            {
              ...mockScore.parts[0].measures[0],
              notes: [
                { isRest: false, duration: 'qd', keys: ['c/4'], articulations: [] },
                { isRest: false, duration: 'q', keys: ['d/4'], articulations: [] },
                { isRest: false, duration: 'q', keys: ['e/4'], articulations: [] },
                { isRest: false, duration: '8', keys: ['f/4'], articulations: [] },
              ],
            },
          ],
        },
      ],
    }
    render(<SheetMusic score={scoreWithDots} />)
    expect(Dot.buildAndAttach).toHaveBeenCalled()
  })

  it('re-renders when score prop changes', async () => {
    const { Renderer } = await import('vexflow')
    const { rerender } = render(<SheetMusic score={mockScore} />)
    const callCount = Renderer.mock.calls.length

    const newScore = { ...mockScore, title: 'New Score' }
    rerender(<SheetMusic score={newScore} />)
    expect(Renderer.mock.calls.length).toBeGreaterThan(callCount)
  })
})
