/**
 * OMR Client Service - Optical Music Recognition
 * Handles image scanning, preprocessing, and OMR API integration
 */

class OMRClient {
    constructor() {
        this.apiEndpoint = '/api/omr';
        this.maxImageSize = 4096; // Max dimension for processing
        this.supportedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
    }

    /**
     * Check if file format is supported
     */
    isSupportedFormat(file) {
        return this.supportedFormats.includes(file.type);
    }

    /**
     * Validate image file
     */
    validateImage(file) {
        if (!this.isSupportedFormat(file)) {
            throw new Error(`Unsupported format: ${file.type}. Supported: JPEG, PNG, WebP, TIFF`);
        }

        // Max file size 20MB
        if (file.size > 20 * 1024 * 1024) {
            throw new Error('File too large. Maximum size is 20MB');
        }

        return true;
    }

    /**
     * Preprocess image for better OMR results
     */
    async preprocessImage(imageFile) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();

            reader.onload = (e) => {
                img.onload = () => {
                    // Create canvas for processing
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Calculate new dimensions
                    let width = img.width;
                    let height = img.height;

                    // Resize if too large
                    if (width > this.maxImageSize || height > this.maxImageSize) {
                        const ratio = Math.min(
                            this.maxImageSize / width,
                            this.maxImageSize / height
                        );
                        width = Math.floor(width * ratio);
                        height = Math.floor(height * ratio);
                    }

                    canvas.width = width;
                    canvas.height = height;

                    // Draw original image
                    ctx.drawImage(img, 0, 0, width, height);

                    // Apply preprocessing
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const processed = this._enhanceContrast(imageData);

                    ctx.putImageData(processed, 0, 0);

                    // Convert to base64
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                };

                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(imageFile);
        });
    }

    /**
     * Enhance contrast for better note detection
     */
    _enhanceContrast(imageData) {
        const data = imageData.data;
        const contrast = 1.2; // Increase contrast
        const brightness = 0;

        for (let i = 0; i < data.length; i += 4) {
            // Convert to grayscale
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

            // Apply contrast
            let newGray = ((gray - 128) * contrast) + 128 + brightness;

            // Apply threshold for binarization effect (helps with staff lines)
            newGray = newGray > 180 ? 255 : (newGray < 80 ? 0 : newGray);

            data[i] = newGray;
            data[i + 1] = newGray;
            data[i + 2] = newGray;
        }

        return imageData;
    }

    /**
     * Process image through OMR API
     */
    async processImage(imageData, onProgress) {
        // Simulate API call with progress
        // In production, this would call the actual OMR API

        return new Promise(async (resolve, reject) => {
            try {
                // Report progress
                if (onProgress) onProgress(10, 'Analyzing image...');

                // Simulate processing time
                await this._delay(500);

                if (onProgress) onProgress(30, 'Detecting staff lines...');
                await this._delay(500);

                if (onProgress) onProgress(50, 'Recognizing notes...');
                await this._delay(500);

                if (onProgress) onProgress(70, 'Parsing musical notation...');
                await this._delay(500);

                if (onProgress) onProgress(90, 'Generating score data...');
                await this._delay(500);

                // For now, return a placeholder score
                // In production, this would parse the actual OMR results
                const score = this._createPlaceholderScore();

                if (onProgress) onProgress(100, 'Complete');

                resolve(score);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Create a placeholder score for demo purposes
     */
    _createPlaceholderScore() {
        const score = new Score('Scanned Score', 'Unknown Composer');

        // Create a simple part
        const part = new Part('part-1', 'Violin');
        part.instrument = 'violin';

        // Create a few measures with simple notes
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
            { pitch: { step: 'G', octave: 4 }, duration: 2 },
        ];

        // Create 4 measures
        for (let m = 0; m < 4; m++) {
            const measure = new Measure(m + 1);
            measure.clef = 'treble';

            for (let n = 0; n < 3; n++) {
                const noteDataItem = noteData[m * 3 + n];
                if (noteDataItem) {
                    const note = new Note(
                        noteDataItem.pitch,
                        noteDataItem.duration,
                        { measure: m, beat: n, voice: 0 }
                    );
                    measure.addElement(note);
                }
            }

            part.addMeasure(measure);
        }

        score.addPart(part);

        return score;
    }

    /**
     * Scan from camera (mobile)
     */
    async scanFromCamera() {
        return new Promise((resolve, reject) => {
            // Check for camera support
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                reject(new Error('Camera not supported on this device'));
                return;
            }

            // Create video element for camera stream
            const video = document.createElement('video');
            video.setAttribute('playsinline', 'true');
            video.setAttribute('autoplay', 'true');

            // Create capture canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Request camera access
            navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Use rear camera if available
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            })
            .then(stream => {
                video.srcObject = stream;

                video.onloadedmetadata = () => {
                    // Start playing
                    video.play();

                    // Create capture button
                    const captureBtn = document.createElement('button');
                    captureBtn.className = 'btn btn-primary';
                    captureBtn.textContent = 'Capture';
                    captureBtn.style.cssText = 'position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); z-index: 1000;';

                    // Create cancel button
                    const cancelBtn = document.createElement('button');
                    cancelBtn.className = 'btn btn-secondary';
                    cancelBtn.textContent = 'Cancel';
                    cancelBtn.style.cssText = 'position: fixed; bottom: 100px; left: 20%; transform: translateX(-50%); z-index: 1000;';

                    // Create overlay
                    const overlay = document.createElement('div');
                    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 999; display: flex; flex-direction: column; align-items: center; justify-content: center;';

                    overlay.appendChild(video);
                    overlay.appendChild(captureBtn);
                    overlay.appendChild(cancelBtn);
                    document.body.appendChild(overlay);

                    captureBtn.onclick = () => {
                        // Capture frame
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        ctx.drawImage(video, 0, 0);

                        // Stop camera
                        stream.getTracks().forEach(track => track.stop());

                        // Remove overlay
                        overlay.remove();

                        // Return captured image
                        resolve(canvas.toDataURL('image/jpeg', 0.9));
                    };

                    cancelBtn.onclick = () => {
                        // Stop camera
                        stream.getTracks().forEach(track => track.stop());

                        // Remove overlay
                        overlay.remove();

                        reject(new Error('Camera scan cancelled'));
                    };
                };
            })
            .catch(err => {
                reject(new Error('Failed to access camera: ' + err.message));
            });
        });
    }

    /**
     * Simple delay helper
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get supported formats as string
     */
    getSupportedFormats() {
        return this.supportedFormats.join(', ');
    }
}

// Export for global use
window.OMRClient = OMRClient;
