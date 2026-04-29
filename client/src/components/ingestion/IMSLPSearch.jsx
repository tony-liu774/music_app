import { useState, useCallback } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import imslpClient from '../../services/IMSLPClient'

const INSTRUMENT_OPTIONS = [
  { value: '', label: 'All Instruments' },
  { value: 'violin', label: 'Violin' },
  { value: 'viola', label: 'Viola' },
  { value: 'cello', label: 'Cello' },
  { value: 'piano', label: 'Piano' },
  { value: 'flute', label: 'Flute' },
  { value: 'guitar', label: 'Guitar' },
]

const DIFFICULTY_COLORS = {
  Beginner: 'bg-green-500/20 text-green-400',
  Intermediate: 'bg-amber/20 text-amber',
  Advanced: 'bg-crimson/20 text-crimson',
}

/**
 * IMSLPSearch Component
 * Search and browse public domain sheet music from IMSLP
 */
export default function IMSLPSearch({ onSelect, onCancel }) {
  const [query, setQuery] = useState('')
  const [instrument, setInstrument] = useState('')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)

  // Perform search
  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setError('Please enter a search term')
      return
    }

    setError(null)
    setIsLoading(true)
    setResults([])

    try {
      const searchResults = await imslpClient.search(
        query.trim(),
        instrument || null,
      )
      setResults(searchResults)

      if (searchResults.length === 0) {
        setError('No results found. Try a different search term.')
      }
    } catch (err) {
      setError(err.message || 'Search failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [query, instrument])

  // Handle keyboard submit
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Select item for download
  const handleSelect = (item) => {
    setSelectedItem(item)
  }

  // Confirm selection
  const handleConfirm = async () => {
    if (!selectedItem) return

    setIsLoading(true)
    try {
      // Download the file
      const blob = await imslpClient.download(selectedItem.id)
      onSelect({
        ...selectedItem,
        blob,
        fileName: `${selectedItem.title}.pdf`,
      })
    } catch (err) {
      setError(err.message || 'Download failed. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <h3 className="font-heading text-xl text-ivory">Search IMSLP</h3>
      <p className="text-ivory-dim text-sm">
        Search for public domain sheet music from IMSLP
      </p>

      {/* Search form */}
      <div className="flex flex-col gap-3">
        <Input
          placeholder="Search by composer, title, or piece..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Search query"
        />

        <Select
          value={instrument}
          onChange={(e) => setInstrument(e.target.value)}
          options={INSTRUMENT_OPTIONS}
          aria-label="Filter by instrument"
        />

        <Button
          variant="primary"
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className="w-full"
        >
          {isLoading && !results.length ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-oxford-blue border-t-transparent rounded-full animate-spin" />
              Searching...
            </span>
          ) : (
            'Search'
          )}
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-crimson/10 border border-crimson rounded-lg p-3 text-crimson text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
          <p className="text-ivory-muted text-sm">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </p>

          {results.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
                selectedItem?.id === item.id
                  ? 'border-amber bg-amber/10'
                  : 'border-border bg-surface hover:border-amber/50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-ivory font-body font-medium truncate">
                    {item.title}
                  </h4>
                  <p className="text-ivory-muted text-sm">{item.composer}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-ivory-dim text-xs">{item.instrument}</span>
                    <span className="w-1 h-1 rounded-full bg-ivory-dim" />
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        DIFFICULTY_COLORS[item.difficulty] ||
                        'bg-surface text-ivory-muted'
                      }`}
                    >
                      {item.difficulty}
                    </span>
                  </div>
                </div>

                {selectedItem?.id === item.id && (
                  <div className="flex-shrink-0">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-6 h-6 text-amber"
                    >
                      <path
                        fillRule="evenodd"
                        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {isLoading && results.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 pt-2 border-t border-border">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={!selectedItem || isLoading}
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-oxford-blue border-t-transparent rounded-full animate-spin" />
              Downloading...
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-4 h-4"
              >
                <path d="M12 4v12m0 0l-4-4m4 4l4-4" />
                <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
              </svg>
              Download Selected
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
