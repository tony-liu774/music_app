import { useState, useCallback, useEffect } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import CameraCapture from './CameraCapture'
import PDFUpload from './PDFUpload'
import IMSLPSearch from './IMSLPSearch'
import { useToast } from '../ui/Toast'

const INSTRUMENT_OPTIONS = [
  { value: 'violin', label: 'Violin' },
  { value: 'viola', label: 'Viola' },
  { value: 'cello', label: 'Cello' },
  { value: 'double-bass', label: 'Double Bass' },
  { value: 'piano', label: 'Piano' },
  { value: 'flute', label: 'Flute' },
  { value: 'guitar', label: 'Guitar' },
  { value: 'other', label: 'Other' },
]

const CAPTURE_METHODS = {
  CAMERA: 'camera',
  UPLOAD: 'upload',
  SEARCH: 'search',
}

const PROCESSING_STEPS = [
  'Loading file...',
  'Detecting edges and corners...',
  'Applying perspective correction...',
  'Removing shadows and normalizing lighting...',
  'Converting to high-contrast format...',
  'Sending to OMR engine...',
  'Detecting staff lines...',
  'Identifying clefs and key signatures...',
  'Recognizing note values...',
  'Parsing rhythms and durations...',
  'Building score data...',
  'Mapping coordinates to musical beats...',
]

/**
 * SmartIngestion Component
 * Orchestrates the complete sheet music ingestion workflow
 */
export default function SmartIngestion({ isOpen, onClose, onScoreCreated }) {
  const { addToast } = useToast()

  // State
  const [activeMethod, setActiveMethod] = useState(null)
  const [processingState, setProcessingState] = useState(null)
  const [progress, setProgress] = useState(0)
  const [processingMessage, setProcessingMessage] = useState('')
  const [capturedImage, setCapturedImage] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)

  // Metadata state
  const [title, setTitle] = useState('')
  const [composer, setComposer] = useState('')
  const [instrument, setInstrument] = useState('violin')

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      resetState()
    }
  }, [isOpen])

  const resetState = () => {
    setActiveMethod(null)
    setProcessingState(null)
    setProgress(0)
    setProcessingMessage('')
    setCapturedImage(null)
    setSelectedFile(null)
    setTitle('')
    setComposer('')
    setInstrument('violin')
  }

  // Handle camera capture
  const handleCameraCapture = useCallback((imageDataUrl) => {
    setCapturedImage(imageDataUrl)
    setSelectedFile(null)
    setActiveMethod(CAPTURE_METHODS.CAMERA)
  }, [])

  // Handle file selection
  const handleFileSelect = useCallback((file) => {
    setSelectedFile(file)
    setCapturedImage(null)
    setActiveMethod(CAPTURE_METHODS.UPLOAD)
  }, [])

  // Handle IMSLP selection
  const handleIMSLPSelect = useCallback((item) => {
    // Convert blob to file
    const file = new File([item.blob], item.fileName, { type: 'application/pdf' })
    setSelectedFile(file)
    setCapturedImage(null)
    setActiveMethod(CAPTURE_METHODS.SEARCH)

    // Pre-fill metadata
    setTitle(item.title)
    setComposer(item.composer)

    addToast({
      type: 'success',
      message: `Downloaded "${item.title}" from IMSLP`,
    })
  }, [addToast])

  // Simulate OMR processing
  const simulateOMRProcessing = useCallback(async () => {
    setProcessingState('processing')

    for (let i = 0; i < PROCESSING_STEPS.length; i++) {
      setProcessingMessage(PROCESSING_STEPS[i])
      setProgress(Math.round(((i + 1) / PROCESSING_STEPS.length) * 100))
      await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 300))
    }

    setProcessingState('metadata')
  }, [])

  // Start processing
  const handleStartProcessing = useCallback(async () => {
    await simulateOMRProcessing()
  }, [simulateOMRProcessing])

  // Save score
  const handleSaveScore = useCallback(() => {
    // Create score data
    const scoreData = {
      id: crypto.randomUUID(),
      title: title || 'Untitled Score',
      composer: composer || 'Unknown Composer',
      instrument: instrument,
      addedAt: new Date().toISOString(),
      source: activeMethod,
      thumbnail: capturedImage,
      file: selectedFile,
      isSimulated: true, // Mark as simulated until real OMR is integrated
      practiceCount: 0,
      difficulty: 3,
    }

    // Add demo measures for visualization
    scoreData.parts = [
      {
        id: 'part-1',
        name: instrument,
        instrument: instrument,
        measures: generateDemoMeasures(),
      },
    ]

    if (onScoreCreated) {
      onScoreCreated(scoreData)
    }

    addToast({
      type: 'success',
      message: `Score "${scoreData.title}" added to your library!`,
    })

    onClose()
  }, [
    title,
    composer,
    instrument,
    activeMethod,
    capturedImage,
    selectedFile,
    onScoreCreated,
    onClose,
    addToast,
  ])

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (processingState) {
      setProcessingState(null)
      setProgress(0)
      setProcessingMessage('')
    } else if (activeMethod) {
      setActiveMethod(null)
      setCapturedImage(null)
      setSelectedFile(null)
    }
  }, [activeMethod, processingState])

  // Render method selection
  const renderMethodSelection = () => (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h3 className="font-heading text-2xl text-ivory mb-2">
          Add Sheet Music
        </h3>
        <p className="text-ivory-muted">
          Choose how you want to add sheet music to your library
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Camera option */}
        <button
          onClick={() => setActiveMethod(CAPTURE_METHODS.CAMERA)}
          className="flex items-center gap-4 p-4 bg-surface border border-border rounded-lg hover:border-amber/50 hover:bg-hover transition-all duration-200 group"
        >
          <div className="w-14 h-14 rounded-full bg-oxford-blue flex items-center justify-center group-hover:bg-amber/20 transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="w-7 h-7 text-ivory"
            >
              <rect x="2" y="6" width="20" height="14" rx="2" />
              <circle cx="12" cy="13" r="4" />
              <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </div>
          <div className="text-left flex-1">
            <h4 className="text-ivory font-body font-medium">Camera Capture</h4>
            <p className="text-ivory-dim text-sm">
              Take a photo of physical sheet music
            </p>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-5 h-5 text-ivory-dim"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* Upload option */}
        <button
          onClick={() => setActiveMethod(CAPTURE_METHODS.UPLOAD)}
          className="flex items-center gap-4 p-4 bg-surface border border-border rounded-lg hover:border-amber/50 hover:bg-hover transition-all duration-200 group"
        >
          <div className="w-14 h-14 rounded-full bg-oxford-blue flex items-center justify-center group-hover:bg-amber/20 transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="w-7 h-7 text-ivory"
            >
              <path d="M12 4v12m0 0l-4-4m4 4l4-4" />
              <rect x="4" y="14" width="16" height="6" rx="2" />
            </svg>
          </div>
          <div className="text-left flex-1">
            <h4 className="text-ivory font-body font-medium">Upload File</h4>
            <p className="text-ivory-dim text-sm">
              Upload a PDF or image from your device
            </p>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-5 h-5 text-ivory-dim"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* IMSLP Search option */}
        <button
          onClick={() => setActiveMethod(CAPTURE_METHODS.SEARCH)}
          className="flex items-center gap-4 p-4 bg-surface border border-border rounded-lg hover:border-amber/50 hover:bg-hover transition-all duration-200 group"
        >
          <div className="w-14 h-14 rounded-full bg-oxford-blue flex items-center justify-center group-hover:bg-amber/20 transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="w-7 h-7 text-ivory"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <div className="text-left flex-1">
            <h4 className="text-ivory font-body font-medium">Search Online</h4>
            <p className="text-ivory-dim text-sm">
              Search IMSLP for public domain sheet music
            </p>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-5 h-5 text-ivory-dim"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  )

  // Render camera capture
  const renderCameraCapture = () => (
    <CameraCapture
      onCapture={handleCameraCapture}
      onCancel={handleBack}
    />
  )

  // Render file upload
  const renderFileUpload = () => (
    <PDFUpload onFileSelect={handleFileSelect} onCancel={handleBack} />
  )

  // Render IMSLP search
  const renderIMSLPSearch = () => (
    <IMSLPSearch onSelect={handleIMSLPSelect} onCancel={handleBack} />
  )

  // Render preview with captured/selected file
  const renderPreview = () => {
    const hasImage = !!capturedImage
    const hasFile = !!selectedFile

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-hover rounded-lg transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-5 h-5 text-ivory"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h3 className="font-heading text-xl text-ivory">Preview</h3>
        </div>

        <div className="flex flex-col items-center gap-4">
          {/* Preview */}
          <div className="w-full max-w-md aspect-[4/3] bg-surface rounded-lg border border-border overflow-hidden">
            {hasImage ? (
              <img
                src={capturedImage}
                alt="Captured sheet music"
                className="w-full h-full object-contain"
              />
            ) : hasFile ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="w-16 h-16 mx-auto text-ivory-dim"
                  >
                    <path d="M7 18h10M7 14h10M7 10h4" />
                    <path d="M12 3v10" />
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                  <p className="text-ivory-muted mt-2">{selectedFile.name}</p>
                  <p className="text-ivory-dim text-sm">
                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <p className="text-ivory-muted text-sm">
            {activeMethod === CAPTURE_METHODS.SEARCH
              ? 'Select this file and click "Digitize" to convert it to playable music'
              : 'Click "Digitize" to process this image with OMR'}
          </p>

          <Button variant="primary" onClick={handleStartProcessing}>
            <span className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-5 h-5"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              Digitize
            </span>
          </Button>
        </div>
      </div>
    )
  }

  // Render processing state
  const renderProcessing = () => (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="relative w-24 h-24">
        {/* Circular progress */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-surface"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeDasharray={`${progress * 2.83} 283`}
            strokeLinecap="round"
            className="text-amber transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-ivory font-heading text-2xl">{progress}%</span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-ivory font-body font-medium">
          {processingState === 'processing' ? 'Processing...' : 'Complete!'}
        </p>
        <p className="text-ivory-muted text-sm mt-1">{processingMessage}</p>
      </div>
    </div>
  )

  // Render metadata form
  const renderMetadata = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-hover rounded-lg transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-5 h-5 text-ivory"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h3 className="font-heading text-xl text-ivory">Score Details</h3>
      </div>

      <div className="flex flex-col gap-4">
        {/* Preview thumbnail */}
        <div className="flex justify-center">
          <div className="w-32 h-40 bg-surface rounded-lg border border-border overflow-hidden">
            {capturedImage ? (
              <img
                src={capturedImage}
                alt="Score preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-8 h-8 text-ivory-dim"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Form fields */}
        <Input
          label="Title"
          placeholder="Enter piece title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Input
          label="Composer"
          placeholder="Enter composer name"
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
        />

        <Select
          label="Instrument"
          value={instrument}
          onChange={(e) => setInstrument(e.target.value)}
          options={INSTRUMENT_OPTIONS}
        />

        {/* Demo mode notice */}
        <div className="bg-amber/10 border border-amber/30 rounded-lg p-3">
          <p className="text-amber text-sm">
            Demo Mode: This preview uses simulated OMR processing. For actual
            music recognition, configure a real OMR service.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSaveScore} className="flex-1">
          <span className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-5 h-5"
            >
              <path d="M12 4v12m0 0l-4-4m4 4l4-4" />
              <rect x="4" y="14" width="16" height="6" rx="2" />
            </svg>
            Add to Library
          </span>
        </Button>
      </div>
    </div>
  )

  // Render content based on state
  const renderContent = () => {
    if (processingState === 'processing') {
      return renderProcessing()
    }

    if (processingState === 'metadata') {
      return renderMetadata()
    }

    if (activeMethod === CAPTURE_METHODS.CAMERA) {
      return renderCameraCapture()
    }

    if (activeMethod === CAPTURE_METHODS.UPLOAD) {
      return renderFileUpload()
    }

    if (activeMethod === CAPTURE_METHODS.SEARCH) {
      return renderIMSLPSearch()
    }

    if (capturedImage || selectedFile) {
      return renderPreview()
    }

    return renderMethodSelection()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      className="max-w-2xl"
    >
      {renderContent()}
    </Modal>
  )
}

// Generate demo measures for visualization
function generateDemoMeasures() {
  const noteData = [
    { pitch: { step: 'E', octave: 4 }, duration: 1 },
    { pitch: { step: 'D', octave: 4 }, duration: 1 },
    { pitch: { step: 'C', octave: 4 }, duration: 1 },
    { pitch: { step: 'D', octave: 4 }, duration: 1 },
    { pitch: { step: 'E', octave: 4 }, duration: 1 },
    { pitch: { step: 'E', octave: 4 }, duration: 1 },
    { pitch: { step: 'E', octave: 4 }, duration: 0.5 },
    { pitch: { step: 'D', octave: 4 }, duration: 0.5 },
    { pitch: { step: 'D', octave: 4 }, duration: 1 },
    { pitch: { step: 'D', octave: 4 }, duration: 1 },
    { pitch: { step: 'E', octave: 4 }, duration: 1 },
    { pitch: { pitch: 'G', octave: 4 }, duration: 2 },
  ]

  const measures = []
  for (let m = 0; m < 4; m++) {
    const measure = {
      number: m + 1,
      clef: 'treble',
      timeSignature: { beats: 4, beatType: 4 },
      notes: [],
    }

    for (let n = 0; n < 3; n++) {
      const noteDataItem = noteData[m * 3 + n]
      if (noteDataItem) {
        measure.notes.push({
          pitch: noteDataItem.pitch,
          duration: noteDataItem.duration,
          position: { measure: m, beat: n, voice: 0 },
          pixelCoordinates: {
            x: 50 + n * 60 + m * 200,
            y: 180 + Math.random() * 40,
            beat: m * 4 + n,
            measure: m,
          },
        })
      }
    }

    measures.push(measure)
  }

  return measures
}
