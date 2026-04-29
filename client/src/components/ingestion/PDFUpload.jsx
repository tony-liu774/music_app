import { useState, useRef, useCallback } from 'react'
import Button from '../ui/Button'

/**
 * PDFUpload Component
 * Handles PDF file upload with drag-and-drop and preview
 */
export default function PDFUpload({ onFileSelect, onCancel }) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState(null)
  const [previewPages, setPreviewPages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef(null)

  // Validate PDF file
  const validateFile = useCallback((file) => {
    const validTypes = ['application/pdf']
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid PDF file.')
      return false
    }

    // Max 50MB
    if (file.size > 50 * 1024 * 1024) {
      setError('File too large. Maximum size is 50MB.')
      return false
    }

    return true
  }, [])

  // Handle file selection
  const handleFileSelect = useCallback(
    async (file) => {
      setError(null)
      setSelectedFile(file)
      setPreviewPages([])

      if (validateFile(file)) {
        await generatePreview(file)
      }
    },
    [validateFile],
  )

  // Generate preview thumbnails
  const generatePreview = async (file) => {
    setIsLoading(true)

    try {
      // Check if pdf.js is available
      if (typeof window.pdfjsLib !== 'undefined') {
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const numPages = Math.min(pdf.numPages, 5) // Limit preview to first 5 pages

        const pages = []
        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i)
          const scale = 0.3 // Small scale for thumbnails
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          canvas.width = viewport.width
          canvas.height = viewport.height

          await page.render({
            canvasContext: ctx,
            viewport: viewport,
          }).promise

          pages.push({
            number: i,
            dataUrl: canvas.toDataURL('image/jpeg', 0.8),
            totalPages: pdf.numPages,
          })
        }

        setPreviewPages(pages)
      } else {
        // Fallback: show file info without preview
        setPreviewPages([
          {
            number: 1,
            totalPages: null,
            fileName: file.name,
            fileSize: formatFileSize(file.size),
          },
        ])
      }
    } catch (err) {
      console.error('Preview generation error:', err)
      setPreviewPages([
        {
          number: 1,
          totalPages: null,
          fileName: file.name,
          fileSize: formatFileSize(file.size),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Drag handlers
  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  // Handle file input change
  const handleInputChange = (e) => {
    const files = e.target.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  // Clear selection
  const handleClear = () => {
    setSelectedFile(null)
    setPreviewPages([])
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Confirm selection
  const handleConfirm = () => {
    if (selectedFile && onFileSelect) {
      onFileSelect(selectedFile)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <h3 className="font-heading text-xl text-ivory">Upload PDF</h3>

      {!selectedFile ? (
        <>
          {/* Drop zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full max-w-lg aspect-[3/4] rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-4 p-6 ${
              isDragging
                ? 'border-amber bg-amber/10'
                : 'border-border hover:border-amber/50 hover:bg-surface/50'
            }`}
          >
            <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="w-8 h-8 text-ivory-muted"
              >
                <path d="M7 18h10M7 14h10M7 10h4" />
                <path d="M14 3v4a1 1 0 001 1h4" />
                <path d="M12 3v10" />
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </div>

            <div className="text-center">
              <p className="text-ivory font-body font-medium">
                Drop your PDF here, or{' '}
                <span className="text-amber">browse</span>
              </p>
              <p className="text-ivory-dim text-sm mt-1">
                PDF files up to 50MB
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleInputChange}
            className="hidden"
          />
        </>
      ) : (
        <>
          {/* Preview */}
          <div className="w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-ivory font-body font-medium">
                {selectedFile.name}
              </h4>
              <button
                onClick={handleClear}
                className="text-ivory-muted hover:text-ivory text-sm"
              >
                Change
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" />
                <span className="ml-3 text-ivory-muted">Generating preview...</span>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {previewPages.map((page) => (
                  <div
                    key={page.number}
                    className="flex-shrink-0 bg-surface rounded-lg overflow-hidden"
                  >
                    {page.dataUrl ? (
                      <img
                        src={page.dataUrl}
                        alt={`Page ${page.number}`}
                        className="w-32 h-auto"
                      />
                    ) : (
                      <div className="w-32 h-40 bg-surface border border-border rounded-lg flex items-center justify-center">
                        <div className="text-center p-4">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            className="w-8 h-8 mx-auto text-ivory-dim"
                          >
                            <path d="M7 18h10M7 14h10M7 10h4" />
                            <path d="M12 3v10" />
                            <rect x="4" y="4" width="16" height="16" rx="2" />
                          </svg>
                          <p className="text-ivory-dim text-xs mt-2">{page.fileName}</p>
                          <p className="text-ivory-dim text-xs">{page.fileSize}</p>
                        </div>
                      </div>
                    )}
                    <div className="px-3 py-2 bg-surface/80">
                      <p className="text-ivory-muted text-xs">
                        Page {page.number}
                        {page.totalPages && ` of ${page.totalPages}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="w-full max-w-lg bg-crimson/10 border border-crimson rounded-lg p-3 text-crimson text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Use This File'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
