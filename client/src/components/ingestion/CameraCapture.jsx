import { useState, useRef, useEffect, useCallback } from 'react'
import Button from '../ui/Button'

/**
 * CameraCapture Component
 * Provides camera-based sheet music capture with alignment guides
 */
export default function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState(null)
  const [isCapturing, setIsCapturing] = useState(false)

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError(null)
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setIsActive(true)
    } catch (err) {
      setError(getCameraErrorMessage(err))
    }
  }, [])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setIsActive(false)
  }, [stream])

  // Get user-friendly error message
  const getCameraErrorMessage = (err) => {
    if (err.name === 'NotAllowedError') {
      return 'Camera access denied. Please allow camera permissions and try again.'
    }
    if (err.name === 'NotFoundError') {
      return 'No camera found on this device.'
    }
    if (err.name === 'NotReadableError') {
      return 'Camera is in use by another application.'
    }
    return `Camera error: ${err.message}`
  }

  // Capture image
  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Video stream not ready. Please wait a moment.')
      return
    }

    setIsCapturing(true)

    // Set canvas to video dimensions
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0)

    // Stop camera
    stopCamera()

    // Convert to data URL and return
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95)
    onCapture(imageDataUrl)
  }, [onCapture, stopCamera])

  // Start camera on mount
  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <h3 className="font-heading text-xl text-ivory">Camera Capture</h3>

      {error && (
        <div className="w-full bg-crimson/10 border border-crimson rounded-lg p-4 text-crimson text-sm">
          {error}
          <div className="mt-3 flex gap-3">
            <Button size="sm" variant="secondary" onClick={startCamera}>
              Try Again
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-2xl aspect-[4/3] bg-oxford-blue rounded-lg overflow-hidden">
        {/* Video feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isActive ? '' : 'hidden'}`}
        />

        {/* Alignment guide overlay */}
        {isActive && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Corner markers */}
            <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-amber opacity-80" />
            <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-amber opacity-80" />
            <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-amber opacity-80" />
            <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-amber opacity-80" />

            {/* Grid lines */}
            <div className="absolute inset-0 flex">
              {/* Vertical thirds */}
              <div className="flex-1 border-r border-amber/30" />
              <div className="flex-1 border-r border-amber/30" />
              <div className="flex-1" />
            </div>
            <div className="absolute inset-0 flex flex-col">
              {/* Horizontal thirds */}
              <div className="flex-1 border-b border-amber/30" />
              <div className="flex-1 border-b border-amber/30" />
              <div className="flex-1" />
            </div>

            {/* Center crosshair */}
            <div className="absolute top-1/2 left-1/2 w-8 h-8 -translate-x-1/2 -translate-y-1/2">
              <div className="absolute top-1/2 left-0 right-0 h-px bg-amber/50" />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-amber/50" />
            </div>
          </div>
        )}

        {/* Instructions overlay */}
        {isActive && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-oxford-blue/90 to-transparent p-4">
            <p className="text-ivory text-sm text-center">
              Align sheet music within the frame. The edges should touch the corner markers.
            </p>
          </div>
        )}

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      {isActive && !error && (
        <div className="flex gap-4">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={captureImage}
            disabled={isCapturing}
            className="flex items-center gap-2"
          >
            {isCapturing ? (
              <>
                <div className="w-5 h-5 border-2 border-oxford-blue border-t-transparent rounded-full animate-spin" />
                Capturing...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Capture
              </>
            )}
          </Button>
        </div>
      )}

      {/* Loading state before camera starts */}
      {!isActive && !error && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-amber border-t-transparent rounded-full animate-spin" />
          <p className="text-ivory-muted text-sm">Starting camera...</p>
        </div>
      )}
    </div>
  )
}
