import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore, SORT_OPTIONS } from '../stores/useLibraryStore'
import { Input, Select, Button } from '../components/ui'
import ScoreCard from '../components/library/ScoreCard'
import SmartIngestion from '../components/ingestion/SmartIngestion'

const INSTRUMENT_OPTIONS = [
  { value: '', label: 'All Instruments' },
  { value: 'violin', label: 'Violin' },
  { value: 'viola', label: 'Viola' },
  { value: 'cello', label: 'Cello' },
  { value: 'double-bass', label: 'Double Bass' },
]

const SORT_OPTION_LIST = [
  { value: SORT_OPTIONS.TITLE, label: 'Title' },
  { value: SORT_OPTIONS.COMPOSER, label: 'Composer' },
  { value: SORT_OPTIONS.DIFFICULTY, label: 'Difficulty' },
  { value: SORT_OPTIONS.RECENTLY_PRACTICED, label: 'Recently Practiced' },
]

export default function Library() {
  const navigate = useNavigate()
  const {
    selectedScore,
    setSelectedScore,
    searchQuery,
    setSearchQuery,
    filterInstrument,
    setFilterInstrument,
    sortBy,
    setSortBy,
    isLoading,
    error,
    fetchScores,
    getFilteredScores,
    addScore,
  } = useLibraryStore()

  const [viewMode, setViewMode] = useState('grid')
  const [showIngestion, setShowIngestion] = useState(false)
  const filteredScores = getFilteredScores()

  useEffect(() => {
    fetchScores()
  }, [fetchScores])

  function handlePractice(score) {
    setSelectedScore(score)
    navigate('/practice')
  }

  function handleAddScore() {
    setShowIngestion(true)
  }

  function handleScoreCreated(scoreData) {
    // Add the score to the library
    addScore(scoreData)
    setShowIngestion(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl text-amber">Library</h1>
          <p className="font-body text-sm text-ivory-muted">
            Your music library and repertoire collection.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Add Score Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleAddScore}
            className="flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-4 h-4"
            >
              <path d="M12 4v12m0 0l-4-4m4 4l4-4" />
              <rect x="4" y="14" width="16" height="6" rx="2" />
            </svg>
            Add Score
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            data-testid="grid-view-btn"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4 max-w-4 max-h-4"
            >
              <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z" />
            </svg>
          </Button>
          <Button
            variant={viewMode === 'list' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            aria-label="List view"
            data-testid="list-view-btn"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4 max-w-4 max-h-4"
            >
              <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search by title or composer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search scores"
            data-testid="search-input"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={filterInstrument || ''}
            onChange={(e) => setFilterInstrument(e.target.value || null)}
            options={INSTRUMENT_OPTIONS}
            aria-label="Filter by instrument"
            data-testid="instrument-filter"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={SORT_OPTION_LIST}
            aria-label="Sort by"
            data-testid="sort-select"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="bg-crimson/10 border border-crimson rounded-md p-3 text-crimson font-body text-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 max-w-8 max-h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Score grid/list */}
      {!isLoading && filteredScores.length > 0 && (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'flex flex-col gap-3'
          }
          data-testid="score-list"
        >
          {filteredScores.map((score) => (
            <ScoreCard
              key={score.id}
              score={score}
              isSelected={selectedScore?.id === score.id}
              onSelect={setSelectedScore}
              onPractice={handlePractice}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredScores.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-16 text-center"
          data-testid="empty-state"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="w-16 h-16 max-w-16 max-h-16 text-ivory-dim mb-4"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <h2 className="font-heading text-xl text-ivory-muted mb-2">
            No scores found
          </h2>
          <p className="font-body text-ivory-dim">
            {searchQuery || filterInstrument
              ? 'Try adjusting your search or filters.'
              : 'Add scores to your library to get started.'}
          </p>
          {!searchQuery && !filterInstrument && (
            <Button
              variant="primary"
              onClick={handleAddScore}
              className="mt-4"
            >
              Add Your First Score
            </Button>
          )}
        </div>
      )}

      {/* Smart Ingestion Modal */}
      <SmartIngestion
        isOpen={showIngestion}
        onClose={() => setShowIngestion(false)}
        onScoreCreated={handleScoreCreated}
      />
    </div>
  )
}
