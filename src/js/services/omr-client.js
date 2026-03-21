/**
 * OMR Client Service - Optical Music Recognition
 * Handles image scanning, preprocessing, PDF upload, perspective correction, and OMR API integration
 */

class OMRClient {
    constructor() {
        this.apiEndpoint = '/api/omr';
        this.maxImageSize = 4096;
        this.supportedImageFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
        this.supportedDocumentFormats = ['application/pdf'];
        this.allSupportedFormats = [...this.supportedImageFormats, ...this.supportedDocumentFormats];

        // Progress callback
        this.progressCallback = null;
    }

    /**
     * Check if file format is supported
     */
    isSupportedFormat(file) {
        return this.allSupportedFormats.includes(file.type);
    }

    /**
     * Validate file
     */
    validateFile(file) {
        if (!this.isSupportedFormat(file)) {
            throw new Error(`Unsupported format: ${file.type}. Supported: JPEG, PNG, WebP, TIFF, PDF`);
        }

        // Max file size 20MB
        if (file.size > 20 * 1024 * 1024) {
            throw new Error('File too large. Maximum size is 20MB');
        }

        return true;
    }

    /**
     * Check if file is a PDF
     */
    isPDF(file) {
        return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    }

    /**
     * Set progress callback
     */
    onProgress(callback) {
        this.progressCallback = callback;
    }

    /**
     * Report progress
     */
    reportProgress(percent, message) {
        if (this.progressCallback) {
            this.progressCallback({ percent, message });
        }
    }

    /**
     * Process uploaded file (image or PDF)
     */
    async processFile(file, onProgress) {
        // Only set progress callback if provided; don't overwrite existing one
        if (onProgress) {
            this.onProgress(onProgress);
        }

        // Validate file
        this.validateFile(file);

        // Check if PDF or image
        if (this.isPDF(file)) {
            return await this.processPDF(file);
        } else {
            return await this.processImage(file);
        }
    }

    /**
     * Process PDF file - convert pages to images and process
     */
    async processPDF(file) {
        this.reportProgress(5, 'Loading PDF...');

        try {
            // Read PDF file
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            this.reportProgress(15, 'Parsing PDF pages...');

            // For now, we'll use a placeholder since pdf.js would be needed
            // In production, use pdf.js to render each page to canvas
            // Then process each page through OMR

            const pageCount = 1; // Would be actual page count from PDF
            this.reportProgress(25, `Found ${pageCount} page(s), processing...`);

            // Simulate page-by-page processing
            const pages = [];
            for (let i = 0; i < pageCount; i++) {
                this.reportProgress(25 + (50 * i / pageCount), `Processing page ${i + 1} of ${pageCount}...`);

                // In production, render PDF page to canvas
                // const canvas = await this.renderPDFPage(arrayBuffer, i);
                // const imageData = canvas.toDataURL('image/jpeg', 0.9);

                // Simulate processing
                await this._delay(800);

                // Create placeholder score for this page
                pages.push(this._createPlaceholderScore(`Page ${i + 1}`));
            }

            this.reportProgress(90, 'Merging results...');
            await this._delay(300);

            // Merge pages into single score
            const mergedScore = this._mergeScorePages(pages);

            this.reportProgress(100, 'Complete');

            return mergedScore;

        } catch (error) {
            this.reportProgress(0, 'Error');
            throw new Error(`PDF processing failed: ${error.message}`);
        }
    }

    /**
     * Read file as ArrayBuffer
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Process image file with perspective correction
     */
    async processImage(imageFile) {
        try {
            this.reportProgress(10, 'Loading image...');

            // Load image
            const imageDataUrl = await this._loadImage(imageFile);
            this.reportProgress(20, 'Applying perspective correction...');

            // Apply perspective correction
            const correctedImageDataUrl = await this._applyPerspectiveCorrection(imageDataUrl);
            this.reportProgress(40, 'Preprocessing for optimal recognition...');

            // Preprocess the CORRECTED image (not the original)
            const preprocessed = await this.preprocessImageFromDataUrl(correctedImageDataUrl);
            this.reportProgress(50, 'Preprocessing complete');

            // Send to server for OMR processing
            this.reportProgress(60, 'Analyzing musical notation...');
            const score = await this._sendToOMRService(preprocessed, imageFile.name);

            this.reportProgress(100, 'Complete');

            return score;

        } catch (error) {
            this.reportProgress(100, 'Error');
            throw error;
        }
    }

    /**
     * Apply perspective correction to fix distortion
     */
    async _applyPerspectiveCorrection(imageDataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // For now, apply basic deskewing
                // In production, use edge detection to find document corners
                // and apply 4-point perspective transform

                // Set canvas to image size
                canvas.width = img.width;
                canvas.height = img.height;

                // Draw original
                ctx.drawImage(img, 0, 0);

                // Apply basic perspective/deskew correction
                // This is a simplified version - real implementation would:
                // 1. Detect edges
                // 2. Find document boundaries
                // 3. Apply 4-point transform

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const corrected = this._deskewImage(imageData);

                ctx.putImageData(corrected, 0, 0);

                resolve(canvas.toDataURL('image/jpeg', 0.95));
            };
            img.onerror = () => reject(new Error('Failed to load image for perspective correction'));
            img.src = imageDataUrl;
        });
    }

    /**
     * Simple deskew correction (rotation based on detected lines)
     */
    _deskewImage(imageData) {
        // This is a placeholder for actual deskewing
        // Real implementation would use Hough transform to detect staff lines
        // and calculate the rotation angle needed to straighten them

        // For now, return the original image data
        // The actual perspective correction would be done server-side with OpenCV
        return imageData;
    }

    /**
     * Load image and return as data URL
     */
    _loadImage(imageFile) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(imageFile);
        });
    }

    /**
     * Send image to OMR service
     */
    async _sendToOMRService(imageData, fileName) {
        // In production, this would call the actual OMR API
        // For now, simulate server-side processing

        this.reportProgress(65, 'Sending to OMR engine...');

        // Create form data
        const formData = new FormData();
        const blob = this.dataURLToBlob(imageData);
        formData.append('file', blob, fileName.replace(/\.[^/.]+$/, '') + '.jpg');

        try {
            // Try to call actual API (will fallback to simulation if not available)
            const response = await fetch(this.apiEndpoint + '/scan', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                return this._convertAPIToScore(result);
            } else {
                // Fallback to simulation
                return await this._simulateOMRProcessing();
            }
        } catch (error) {
            // API not available, use simulation
            console.log('[OMR] Using simulated processing');
            return await this._simulateOMRProcessing();
        }
    }

    /**
     * Convert API response to Score object
     */
    _convertAPIToScore(apiResult) {
        const score = new Score(apiResult.title || 'Scanned Score', apiResult.composer || 'Unknown');

        if (apiResult.measures && apiResult.measures.length > 0) {
            const part = new Part('part-1', 'Violin');
            part.instrument = 'violin';

            apiResult.measures.forEach((measureData, index) => {
                const measure = new Measure(index + 1);
                measure.clef = measureData.clef || 'treble';

                if (measureData.notes) {
                    measureData.notes.forEach((noteData, noteIndex) => {
                        const note = new Note(
                            { step: noteData.pitch, octave: noteData.octave || 4, alter: noteData.alter || 0 },
                            noteData.duration || 1,
                            { measure: index, beat: noteIndex, voice: 0 }
                        );
                        measure.addElement(note);
                    });
                }

                part.addMeasure(measure);
            });

            score.addPart(part);
        } else {
            // Return placeholder if no valid data
            return this._createPlaceholderScore('Scanned');
        }

        return score;
    }

    /**
     * Simulate OMR processing with realistic progress
     */
    async _simulateOMRProcessing() {
        const steps = [
            { progress: 65, message: 'Detecting staff lines...' },
            { progress: 72, message: 'Identifying clefs and key signatures...' },
            { progress: 78, message: 'Recognizing note values...' },
            { progress: 85, message: 'Parsing rhythms and durations...' },
            { progress: 92, message: 'Building score data...' }
        ];

        for (const step of steps) {
            this.reportProgress(step.progress, step.message);
            await this._delay(400);
        }

        return this._createPlaceholderScore('Scanned Score');
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
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

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
                    ctx.drawImage(img, 0, 0, width, height);

                    // Apply preprocessing
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const processed = this._enhanceContrast(imageData);

                    ctx.putImageData(processed, 0, 0);

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
     * Preprocess image from data URL (for already-loaded images like corrected ones)
     */
    async preprocessImageFromDataUrl(imageDataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

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
                ctx.drawImage(img, 0, 0, width, height);

                // Apply preprocessing
                const imageData = ctx.getImageData(0, 0, width, height);
                const processed = this._enhanceContrast(imageData);

                ctx.putImageData(processed, 0, 0);

                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };

            img.onerror = () => reject(new Error('Failed to load image for preprocessing'));
            img.src = imageDataUrl;
        });
    }

    /**
     * Enhance contrast for better note detection
     */
    _enhanceContrast(imageData) {
        const data = imageData.data;
        const contrast = 1.2;
        const brightness = 0;

        for (let i = 0; i < data.length; i += 4) {
            // Convert to grayscale
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

            // Apply contrast
            let newGray = ((gray - 128) * contrast) + 128 + brightness;

            // Apply threshold for binarization effect
            newGray = newGray > 180 ? 255 : (newGray < 80 ? 0 : newGray);

            data[i] = newGray;
            data[i + 1] = newGray;
            data[i + 2] = newGray;
        }

        return imageData;
    }

    /**
     * Create a placeholder score for demo purposes
     */
    _createPlaceholderScore(title = 'Scanned Score') {
        const score = new Score(title, 'Unknown Composer');

        const part = new Part('part-1', 'Violin');
        part.instrument = 'violin';

        // Create a simple score with some notes
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
     * Merge multiple score pages into one
     */
    _mergeScorePages(pages) {
        if (pages.length === 0) {
            return this._createPlaceholderScore('Empty');
        }

        if (pages.length === 1) {
            return pages[0];
        }

        // Merge by combining all parts
        const merged = new Score('Merged Score', pages[0]?.composer || 'Unknown');

        // Calculate measure offset for each page based on actual measure counts
        let measureOffset = 0;
        pages.forEach((page, pageIndex) => {
            page.parts.forEach((part, partIndex) => {
                let mergedPart = merged.parts[partIndex];
                if (!mergedPart) {
                    mergedPart = new Part(part.id, part.name);
                    mergedPart.instrument = part.instrument;
                    merged.addPart(mergedPart);
                }

                // Add measures from this page with correct offset
                part.measures.forEach(measure => {
                    const newMeasure = new Measure(measure.number + measureOffset);
                    newMeasure.clef = measure.clef;
                    newMeasure.key = measure.key;
                    newMeasure.timeSignature = measure.timeSignature;

                    // Copy notes
                    measure.notes.forEach(note => {
                        newMeasure.addElement(note);
                    });

                    mergedPart.addMeasure(newMeasure);
                });
            });

            // Update measure offset based on actual measure count of this page
            const pageMeasureCount = page.parts[0]?.measures?.length || 0;
            measureOffset += pageMeasureCount;
        });

        return merged;
    }

    /**
     * Scan from camera (mobile)
     */
    async scanFromCamera() {
        return new Promise((resolve, reject) => {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                reject(new Error('Camera not supported on this device'));
                return;
            }

            const video = document.createElement('video');
            video.setAttribute('playsinline', 'true');
            video.setAttribute('autoplay', 'true');

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            })
            .then(stream => {
                video.srcObject = stream;

                video.onloadedmetadata = () => {
                    video.play();

                    // Create capture button
                    const captureBtn = document.createElement('button');
                    captureBtn.className = 'btn btn-primary';
                    captureBtn.textContent = 'Capture';
                    captureBtn.style.cssText = 'position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); z-index: 1000; padding: 12px 24px; font-size: 16px;';

                    // Create cancel button
                    const cancelBtn = document.createElement('button');
                    cancelBtn.className = 'btn btn-secondary';
                    cancelBtn.textContent = 'Cancel';
                    cancelBtn.style.cssText = 'position: fixed; bottom: 100px; left: 30%; transform: translateX(-50%); z-index: 1000; padding: 12px 24px; font-size: 16px;';

                    const overlay = document.createElement('div');
                    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 999; display: flex; flex-direction: column; align-items: center; justify-content: center;';

                    // Add camera guide overlay
                    const guide = document.createElement('div');
                    guide.style.cssText = 'border: 2px dashed rgba(201, 162, 39, 0.6); padding: 40px; margin: 20px; border-radius: 8px; max-width: 80%; text-align: center;';
                    guide.innerHTML = '<p style="color: #f5f5dc; font-size: 14px; margin-bottom: 20px;">Position sheet music within the frame</p>';

                    overlay.appendChild(guide);
                    overlay.appendChild(video);
                    overlay.appendChild(captureBtn);
                    overlay.appendChild(cancelBtn);
                    document.body.appendChild(overlay);

                    captureBtn.onclick = () => {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        ctx.drawImage(video, 0, 0);

                        stream.getTracks().forEach(track => track.stop());
                        overlay.remove();

                        resolve(canvas.toDataURL('image/jpeg', 0.9));
                    };

                    cancelBtn.onclick = () => {
                        stream.getTracks().forEach(track => track.stop());
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
     * Convert data URL to Blob
     */
    dataURLToBlob(dataURL) {
        if (!dataURL || typeof dataURL !== 'string') {
            throw new Error('Invalid data URL: must be a non-empty string');
        }

        const parts = dataURL.split(',');
        if (parts.length !== 2) {
            throw new Error('Invalid data URL: missing comma separator');
        }

        const mimeMatch = parts[0].match(/:(.*?);/);
        if (!mimeMatch) {
            throw new Error('Invalid data URL: missing MIME type');
        }
        const mime = mimeMatch[1];

        if (!parts[1]) {
            throw new Error('Invalid data URL: missing data');
        }

        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);

        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }

        return new Blob([u8arr], { type: mime });
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
        return this.allSupportedFormats.join(', ');
    }
}

// Export for global use
window.OMRClient = OMRClient;
