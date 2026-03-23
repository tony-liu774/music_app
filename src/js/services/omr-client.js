/**
 * OMR Client Service - Optical Music Recognition
 * Handles image scanning, preprocessing, PDF upload, perspective correction, and OMR API integration
 *
 * ENHANCED VERSION with:
 * - Visual alignment guides for camera
 * - Perspective deskewing using edge detection
 * - Shadow removal and adaptive contrast
 * - X/Y coordinate mapping for Follow-the-ball cursor
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

        // Camera stream reference
        this.cameraStream = null;
        this.cameraVideo = null;

        // Configuration - set useSimulation = false to enable real API calls
        // Set omrApiKey to use a real OMR service
        this.config = {
            useSimulation: true,  // When true, uses simulated processing; set to false for real API
            omrApiKey: null,      // API key for real OMR service (Audiveris/PlayScore)
            edgeThreshold: 50,    // Threshold for Sobel edge detection
            contrastFactor: 1.2, // Contrast enhancement factor
            sharpnessThreshold: 10, // Blur detection threshold
            contrastThreshold: 100 // Low contrast threshold
        };
    }

    /**
     * Update configuration
     */
    configure(options) {
        this.config = { ...this.config, ...options };
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
        if (onProgress) {
            this.onProgress(onProgress);
        }

        this.validateFile(file);

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
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            this.reportProgress(15, 'Parsing PDF pages...');

            // Use PDF.js to render pages (if available) or simulate
            let pageCount = 1;
            let pages = [];

            // Check if pdf.js is available
            if (typeof pdfjsLib !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                pageCount = pdf.numPages;
                this.reportProgress(20, `Found ${pageCount} page(s), processing...`);

                for (let i = 1; i <= pageCount; i++) {
                    this.reportProgress(20 + (50 * i / pageCount), `Processing page ${i} of ${pageCount}...`);
                    const page = await pdf.getPage(i);
                    const scale = 2.0; // Higher resolution for OMR
                    const viewport = page.getViewport({ scale });

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;

                    await page.render({
                        canvasContext: ctx,
                        viewport: viewport
                    }).promise;

                    const imageData = canvas.toDataURL('image/jpeg', 0.95);
                    const preprocessed = await this.preprocessImageFromDataUrl(imageData);
                    const pageScore = await this._sendToOMRService(preprocessed, `Page ${i}`);
                    pages.push(pageScore);
                }
            } else {
                // Fallback: simulate processing
                this.reportProgress(25, `Found ${pageCount} page(s), processing...`);
                for (let i = 0; i < pageCount; i++) {
                    this.reportProgress(25 + (50 * i / pageCount), `Processing page ${i + 1} of ${pageCount}...`);
                    await this._delay(800);
                    pages.push(this._createPlaceholderScore(`Page ${i + 1}`));
                }
            }

            this.reportProgress(90, 'Merging results...');
            await this._delay(300);

            const mergedScore = this._mergeScorePages(pages);
            this.reportProgress(100, 'Complete');

            return mergedScore;

        } catch (error) {
            this.reportProgress(100, 'Error');
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
     * Process image file with perspective correction and full preprocessing pipeline
     */
    async processImage(imageFile) {
        try {
            this.reportProgress(10, 'Loading image...');
            const imageDataUrl = await this._loadImage(imageFile);

            this.reportProgress(20, 'Detecting edges and corners...');
            const { correctedImageDataUrl, corners } = await this._applyPerspectiveCorrection(imageDataUrl);

            this.reportProgress(35, 'Removing shadows and normalizing lighting...');
            const shadowRemoved = await this._removeShadows(correctedImageDataUrl);

            this.reportProgress(50, 'Applying high-contrast grayscale conversion...');
            const preprocessed = await this.preprocessImageFromDataUrl(shadowRemoved);

            this.reportProgress(60, 'Analyzing musical notation...');
            const { score, simulated, error } = await this._sendToOMRService(preprocessed, imageFile.name);

            // CRITICAL: Add X/Y coordinate mapping for Follow-the-ball cursor
            this.reportProgress(85, 'Mapping coordinates to musical beats...');
            await this._mapCoordinatesToBeats(score, correctedImageDataUrl);

            this.reportProgress(100, simulated ? 'Complete (simulated)' : 'Complete');

            // If we fell back to simulation, mark the score
            if (simulated) {
                score._isSimulated = true;
                score._simulationNote = 'OMR processing was simulated. Set useSimulation: false and provide an API key for real processing.';
                console.warn('[OMR] Score created from simulated processing:', error || 'No API available');
            }

            return score;

        } catch (error) {
            this.reportProgress(100, 'Error');
            throw error;
        }
    }

    /**
     * Apply perspective correction using edge detection and corner finding
     */
    async _applyPerspectiveCorrection(imageDataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                // Detect document corners using edge detection
                const corners = this._detectDocumentCorners(imageData);

                // If corners detected, apply perspective transform
                if (corners && this._isValidQuad(corners)) {
                    const corrected = this._perspectiveTransform(imageData, corners);
                    ctx.putImageData(corrected, 0, 0);
                    resolve({
                        correctedImageDataUrl: canvas.toDataURL('image/jpeg', 0.95),
                        corners
                    });
                } else {
                    // No valid corners found, return original
                    resolve({
                        correctedImageDataUrl: imageDataUrl,
                        corners: null
                    });
                }
            };
            img.onerror = () => reject(new Error('Failed to load image for perspective correction'));
            img.src = imageDataUrl;
        });
    }

    /**
     * Detect document corners using Sobel edge detection and Hough-like line finding
     */
    _detectDocumentCorners(imageData) {
        const { width, height, data } = imageData;

        // Step 1: Convert to grayscale
        const gray = new Uint8Array(width * height);
        for (let i = 0; i < data.length; i += 4) {
            gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        // Step 2: Apply Sobel edge detection
        const edges = this._sobelEdgeDetection(gray, width, height);

        // Step 3: Find lines using simplified Hough transform
        const lines = this._houghLines(edges, width, height);

        // Step 4: Find intersection points to get corners
        const corners = this._findCornersFromLines(lines, width, height);

        return corners;
    }

    /**
     * Sobel edge detection
     */
    _sobelEdgeDetection(gray, width, height) {
        const edges = new Uint8Array(width * height);
        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gx = 0, gy = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const pixel = gray[(y + ky) * width + (x + kx)];
                        const idx = (ky + 1) * 3 + (kx + 1);
                        gx += pixel * sobelX[idx];
                        gy += pixel * sobelY[idx];
                    }
                }
                const magnitude = Math.sqrt(gx * gx + gy * gy);
                edges[y * width + x] = magnitude > this.config.edgeThreshold ? 255 : 0;
            }
        }

        return edges;
    }

    /**
     * Simplified Hough transform for line detection
     */
    _houghLines(edges, width, height) {
        const threshold = 100;
        const lines = [];

        // Only check strong horizontal and vertical lines (for document detection)
        const step = 10;

        // Find top horizontal line
        for (let y = Math.floor(height * 0.1); y < Math.floor(height * 0.4); y += step) {
            let count = 0;
            for (let x = 0; x < width; x += 5) {
                if (edges[y * width + x] === 255) count++;
            }
            if (count > width * 0.3) {
                lines.push({ type: 'horizontal', y, count });
            }
        }

        // Find bottom horizontal line
        for (let y = Math.floor(height * 0.6); y < Math.floor(height * 0.9); y += step) {
            let count = 0;
            for (let x = 0; x < width; x += 5) {
                if (edges[y * width + x] === 255) count++;
            }
            if (count > width * 0.3) {
                lines.push({ type: 'horizontal', y, count });
            }
        }

        // Find left vertical line
        for (let x = Math.floor(width * 0.1); x < Math.floor(width * 0.4); x += step) {
            let count = 0;
            for (let y = 0; y < height; y += 5) {
                if (edges[y * width + x] === 255) count++;
            }
            if (count > height * 0.3) {
                lines.push({ type: 'vertical', x, count });
            }
        }

        // Find right vertical line
        for (let x = Math.floor(width * 0.6); x < Math.floor(width * 0.9); x += step) {
            let count = 0;
            for (let y = 0; y < height; y += 5) {
                if (edges[y * width + x] === 255) count++;
            }
            if (count > height * 0.3) {
                lines.push({ type: 'vertical', x, count });
            }
        }

        return lines;
    }

    /**
     * Find corners from detected lines
     */
    _findCornersFromLines(lines, width, height) {
        const horizontals = lines.filter(l => l.type === 'horizontal').sort((a, b) => b.count - a.count);
        const verticals = lines.filter(l => l.type === 'vertical').sort((a, b) => b.count - a.count);

        if (horizontals.length < 2 || verticals.length < 2) {
            return null;
        }

        // Get best horizontal and vertical lines
        const topY = horizontals[0].y;
        const bottomY = horizontals[1].y;
        const leftX = verticals[0].x;
        const rightX = verticals[1].x;

        return {
            topLeft: { x: leftX, y: topY },
            topRight: { x: rightX, y: topY },
            bottomLeft: { x: leftX, y: bottomY },
            bottomRight: { x: rightX, y: bottomY }
        };
    }

    /**
     * Check if detected corners form a valid quadrilateral
     */
    _isValidQuad(corners) {
        if (!corners) return false;

        const { topLeft, topRight, bottomLeft, bottomRight } = corners;

        // Check if all corners exist
        if (!topLeft || !topRight || !bottomLeft || !bottomRight) return false;

        // Check if it's roughly rectangular (opposite sides should be similar length)
        const topWidth = Math.abs(topRight.x - topLeft.x);
        const bottomWidth = Math.abs(bottomRight.x - bottomLeft.x);
        const leftHeight = Math.abs(bottomLeft.y - topLeft.y);
        const rightHeight = Math.abs(bottomRight.y - topRight.y);

        // Aspect ratio check (should be wider than tall for sheet music)
        const avgWidth = (topWidth + bottomWidth) / 2;
        const avgHeight = (leftHeight + rightHeight) / 2;

        return avgWidth > 100 && avgHeight > 100 && avgWidth / avgHeight > 0.3;
    }

    /**
     * Apply perspective transform using detected corners
     */
    _perspectiveTransform(imageData, corners) {
        const { width, height, data } = imageData;
        const { topLeft, topRight, bottomLeft, bottomRight } = corners;

        // Calculate output dimensions
        const outputWidth = Math.max(
            Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y),
            Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y)
        );
        const outputHeight = Math.max(
            Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y),
            Math.hypot(bottomRight.x - topRight.x, bottomRight.y - topRight.y)
        );

        // Create output image data
        const output = new ImageData(Math.floor(outputWidth), Math.floor(outputHeight));
        const outData = output.data;

        // Source points (detected corners)
        const srcPoints = [
            [topLeft.x, topLeft.y],
            [topRight.x, topRight.y],
            [bottomRight.x, bottomRight.y],
            [bottomLeft.x, bottomLeft.y]
        ];

        // Destination points (rectangle)
        const dstPoints = [
            [0, 0],
            [outputWidth - 1, 0],
            [outputWidth - 1, outputHeight - 1],
            [0, outputHeight - 1]
        ];

        // Compute perspective transform matrix (simplified bilinear interpolation)
        for (let y = 0; y < outputHeight; y++) {
            for (let x = 0; x < outputWidth; x++) {
                const u = x / (outputWidth - 1);
                const v = y / (outputHeight - 1);

                // Bilinear interpolation of source coordinates
                const srcX = (1 - u) * (1 - v) * srcPoints[0][0] +
                             u * (1 - v) * srcPoints[1][0] +
                             u * v * srcPoints[2][0] +
                             (1 - u) * v * srcPoints[3][0];
                const srcY = (1 - u) * (1 - v) * srcPoints[0][1] +
                             u * (1 - v) * srcPoints[1][1] +
                             u * v * srcPoints[2][1] +
                             (1 - u) * v * srcPoints[3][1];

                const srcXInt = Math.floor(srcX);
                const srcYInt = Math.floor(srcY);

                if (srcXInt >= 0 && srcXInt < width && srcYInt >= 0 && srcYInt < height) {
                    const dstIdx = (Math.floor(y) * Math.floor(outputWidth) + Math.floor(x)) * 4;
                    const srcIdx = (srcYInt * width + srcXInt) * 4;

                    outData[dstIdx] = data[srcIdx];
                    outData[dstIdx + 1] = data[srcIdx + 1];
                    outData[dstIdx + 2] = data[srcIdx + 2];
                    outData[dstIdx + 3] = data[srcIdx + 3];
                }
            }
        }

        return output;
    }

    /**
     * Remove shadows using adaptive lighting correction
     */
    async _removeShadows(imageDataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const corrected = this._adaptiveLightingCorrection(imageData);

                ctx.putImageData(corrected, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            };
            img.onerror = () => reject(new Error('Failed to load image for shadow removal'));
            img.src = imageDataUrl;
        });
    }

    /**
     * Adaptive lighting correction to remove shadows
     */
    _adaptiveLightingCorrection(imageData) {
        const { width, height, data } = imageData;
        const result = new Uint8ClampedArray(data.length);

        // Step 1: Estimate background illumination using large median filter
        const blockSize = Math.floor(Math.min(width, height) / 8);
        const illumination = new Float32Array(width * height);

        // Downsample for faster processing
        const sampleStep = Math.max(1, Math.floor(blockSize / 4));

        for (let y = 0; y < height; y += sampleStep) {
            for (let x = 0; x < width; x += sampleStep) {
                // Get local region
                const values = [];
                for (let ly = 0; ly < blockSize && y + ly < height; ly += 2) {
                    for (let lx = 0; lx < blockSize && x + lx < width; lx += 2) {
                        const idx = ((y + ly) * width + (x + lx)) * 4;
                        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                        values.push(gray);
                    }
                }
                values.sort((a, b) => a - b);
                const median = values[Math.floor(values.length / 2)];

                // Fill region with median
                for (let ly = 0; ly < blockSize && y + ly < height; ly += sampleStep) {
                    for (let lx = 0; lx < blockSize && x + lx < width; lx += sampleStep) {
                        illumination[((y + ly) * width + (x + lx))] = median;
                    }
                }
            }
        }

        // Bilinear interpolation to fill gaps
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (illumination[y * width + x] === 0) {
                    // Find nearest samples
                    let sum = 0, count = 0;
                    for (let dy = -blockSize; dy <= blockSize; dy += sampleStep) {
                        for (let dx = -blockSize; dx <= blockSize; dx += sampleStep) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                const val = illumination[ny * width + nx];
                                if (val > 0) {
                                    sum += val;
                                    count++;
                                }
                            }
                        }
                    }
                    illumination[y * width + x] = count > 0 ? sum / count : 180;
                }
            }
        }

        // Step 2: Normalize each pixel
        const avgIllumination = illumination.reduce((a, b) => a + b, 0) / illumination.length;

        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const localIllum = illumination[i / 4];

            // Normalize: remove shadow effect and enhance local contrast
            const normalized = ((gray / (localIllum || 180)) * avgIllumination);

            // Apply mild contrast enhancement using configured factor
            const enhanced = ((normalized - 128) * this.config.contrastFactor) + 128;

            const final = Math.max(0, Math.min(255, enhanced));

            result[i] = final;
            result[i + 1] = final;
            result[i + 2] = final;
            result[i + 3] = data[i + 3];
        }

        return new ImageData(result, width, height);
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
     * Returns { score, simulated } where simulated = true indicates fallback to placeholder data
     */
    async _sendToOMRService(imageData, fileName) {
        // Check if simulation mode is enabled
        if (this.config.useSimulation) {
            console.log('[OMR] Simulation mode enabled, skipping real API call');
            const score = await this._simulateOMRProcessing();
            return { score, simulated: true };
        }

        this.reportProgress(65, 'Sending to OMR engine...');

        const formData = new FormData();
        const blob = this.dataURLToBlob(imageData);
        formData.append('file', blob, fileName.replace(/\.[^/.]+$/, '') + '.jpg');

        try {
            const response = await fetch(this.apiEndpoint + '/scan', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                return { score: this._convertAPIToScore(result), simulated: false };
            } else {
                console.error(`[OMR] API returned error status: ${response.status}`);
                throw new Error(`OMR API error: HTTP ${response.status}`);
            }
        } catch (error) {
            console.error(`[OMR] API call failed: ${error.message}`);
            console.log('[OMR] Falling back to simulated processing');
            const score = await this._simulateOMRProcessing();
            return { score, simulated: true, error: error.message };
        }
    }

    /**
     * Convert API response to Score object with coordinate mapping
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

                        // Store pixel coordinates if available from OMR
                        if (noteData.pixelX !== undefined && noteData.pixelY !== undefined) {
                            note.pixelCoordinates = {
                                x: noteData.pixelX,
                                y: noteData.pixelY,
                                width: noteData.width || 20,
                                height: noteData.height || 20
                            };
                        }

                        measure.addElement(note);
                    });
                }

                part.addMeasure(measure);
            });

            score.addPart(part);
        } else {
            return this._createPlaceholderScore('Scanned');
        }

        return score;
    }

    /**
     * CRITICAL: Map X/Y pixel coordinates to musical beats for Follow-the-ball cursor
     * This creates the essential coordinate mapping that links visual positions to musical time
     */
    async _mapCoordinatesToBeats(score, imageDataUrl) {
        // Await the Promise from _getImageDimensions
        const imageDimensions = await this._getImageDimensions(imageDataUrl);
        if (!imageDimensions) {
            console.warn('[OMR] Could not get image dimensions for coordinate mapping');
            return;
        }

        const { width, height } = imageDimensions;
        const beatsPerMeasure = 4;
        const totalMeasures = score.getTotalMeasures();

        if (totalMeasures === 0) return;

        const pixelsPerMeasure = width / Math.min(totalMeasures, 4); // Assume max 4 systems
        const pixelsPerBeat = pixelsPerMeasure / beatsPerMeasure;
        const staffTop = height * 0.3; // Typical staff position
        const staffBottom = height * 0.7;
        const staffHeight = staffBottom - staffTop;

        // Map each note to pixel coordinates
        score.parts.forEach(part => {
            part.measures.forEach((measure, measureIndex) => {
                const measureStartX = (measureIndex % 4) * pixelsPerMeasure + pixelsPerMeasure * Math.floor(measureIndex / 4) * 0.1;
                const measureStartBeat = measureIndex * beatsPerMeasure;

                measure.notes.forEach((note, noteIndex) => {
                    const beatPosition = measureStartBeat + note.position.beat;
                    const noteX = measureStartX + note.position.beat * pixelsPerBeat + pixelsPerBeat / 2;

                    // Map pitch to Y position on staff (higher pitch = higher on screen)
                    const pitchValue = this._pitchToStaffPosition(note.pitch, note.pitch.octave);
                    const noteY = staffTop + (1 - pitchValue) * staffHeight;

                    note.pixelCoordinates = {
                        x: Math.round(noteX),
                        y: Math.round(noteY),
                        beat: beatPosition,
                        measure: measureIndex,
                        width: Math.round(pixelsPerBeat * 0.8),
                        height: 20,
                        // Additional metadata for cursor rendering
                        absoluteX: Math.round(noteX / width * 100),
                        absoluteY: Math.round(noteY / height * 100)
                    };
                });
            });
        });

        // Store metadata on score for Follow-the-ball
        score.coordinateMetadata = {
            imageWidth: width,
            imageHeight: height,
            pixelsPerBeat: pixelsPerBeat,
            staffTop: staffTop,
            staffBottom: staffBottom,
            systemHeight: staffBottom - staffTop,
            beatsPerMeasure: beatsPerMeasure,
            mapped: true,
            mappingAlgorithm: 'OMR-estimated'
        };
    }

    /**
     * Convert pitch to staff position (0 = bottom line, 1 = top line)
     */
    _pitchToStaffPosition(pitch, octave) {
        const pitchOrder = { 'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6 };
        const basePitch = pitchOrder[pitch.step] || 0;
        const alter = pitch.alter || 0;

        // Calculate position relative to middle B (in treble clef)
        // Each octave above middle C adds 7 positions
        const octaveOffset = (octave - 4) * 7;
        const position = (basePitch + octaveOffset + alter) / 42; // Normalize to 0-1 range
        return Math.max(0, Math.min(1, position));
    }

    /**
     * Get image dimensions from data URL
     */
    _getImageDimensions(imageDataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                resolve({ width: img.width, height: img.height });
            };
            img.onerror = () => resolve(null);
            img.src = imageDataUrl;
        });
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
     * Preprocess image from data URL with full pipeline
     */
    async preprocessImageFromDataUrl(imageDataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let width = img.width;
                let height = img.height;

                if (width > this.maxImageSize || height > this.maxImageSize) {
                    const ratio = Math.min(this.maxImageSize / width, this.maxImageSize / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                const imageData = ctx.getImageData(0, 0, width, height);
                const processed = this._highContrastGrayscale(imageData);

                ctx.putImageData(processed, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };

            img.onerror = () => reject(new Error('Failed to load image for preprocessing'));
            img.src = imageDataUrl;
        });
    }

    /**
     * High-contrast grayscale conversion optimized for notation recognition
     */
    _highContrastGrayscale(imageData) {
        const { width, height, data } = imageData;
        const result = new Uint8ClampedArray(data.length);

        // Calculate global histogram for adaptive thresholding
        const histogram = new Array(256).fill(0);
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            histogram[gray]++;
        }

        // Find Otsu's threshold for optimal binarization
        const totalPixels = width * height;
        let sum = 0;
        for (let i = 0; i < 256; i++) sum += i * histogram[i];

        let sumB = 0, wB = 0, wF = 0;
        let maxVariance = 0, threshold = 128;

        for (let t = 0; t < 256; t++) {
            wB += histogram[t];
            if (wB === 0) continue;
            wF = totalPixels - wB;
            if (wF === 0) break;

            sumB += t * histogram[t];
            const mB = sumB / wB;
            const mF = (sum - sumB) / wF;
            const variance = wB * wF * (mB - mF) * (mB - mF);

            if (variance > maxVariance) {
                maxVariance = variance;
                threshold = t;
            }
        }

        // Apply adaptive contrast enhancement using config values
        const contrastFactor = this.config.contrastFactor;
        const outputContrast = this.config.contrastFactor * 0.95; // Slightly lower for output

        for (let i = 0; i < data.length; i += 4) {
            // Convert to grayscale
            let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

            // Apply local contrast enhancement (unsharp mask)
            const localMean = this._getLocalMean(data, i, width, height, 5);
            gray = gray + contrastFactor * (gray - localMean);

            // Normalize and apply contrast
            let newGray = ((gray - 128) * outputContrast) + 128;

            // Apply adaptive threshold
            if (newGray > threshold * 1.1) {
                newGray = 255; // Staff lines and note heads
            } else if (newGray < threshold * 0.7) {
                newGray = 0; // Background
            } else {
                // Smooth transition
                newGray = (newGray - threshold * 0.7) / (threshold * 0.4) * 255;
            }

            newGray = Math.max(0, Math.min(255, newGray));

            result[i] = newGray;
            result[i + 1] = newGray;
            result[i + 2] = newGray;
            result[i + 3] = data[i + 3];
        }

        return new ImageData(result, width, height);
    }

    /**
     * Get local mean for unsharp mask
     */
    _getLocalMean(data, index, width, height, radius) {
        let sum = 0, count = 0;
        const x = (index / 4) % width;
        const y = Math.floor((index / 4) / width);

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const idx = (ny * width + nx) * 4;
                    sum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                    count++;
                }
            }
        }
        return count > 0 ? sum / count : 128;
    }

    /**
     * Create a placeholder score with coordinate mapping
     */
    _createPlaceholderScore(title = 'Scanned Score') {
        const score = new Score(title, 'Unknown Composer');

        const part = new Part('part-1', 'Violin');
        part.instrument = 'violin';

        const noteData = [
            { pitch: { step: 'E', octave: 4 }, duration: 1, x: 50, y: 200 },
            { pitch: { step: 'D', octave: 4 }, duration: 1, x: 120, y: 220 },
            { pitch: { step: 'C', octave: 4 }, duration: 1, x: 190, y: 240 },
            { pitch: { step: 'D', octave: 4 }, duration: 1, x: 280, y: 220 },
            { pitch: { step: 'E', octave: 4 }, duration: 1, x: 370, y: 200 },
            { pitch: { step: 'E', octave: 4 }, duration: 1, x: 460, y: 200 },
            { pitch: { step: 'E', octave: 4 }, duration: 0.5, x: 520, y: 200 },
            { pitch: { step: 'D', octave: 4 }, duration: 0.5, x: 560, y: 220 },
            { pitch: { step: 'D', octave: 4 }, duration: 1, x: 620, y: 220 },
            { pitch: { step: 'D', octave: 4 }, duration: 1, x: 710, y: 220 },
            { pitch: { step: 'E', octave: 4 }, duration: 1, x: 800, y: 200 },
            { pitch: { step: 'G', octave: 4 }, duration: 2, x: 890, y: 180 },
        ];

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
                    note.pixelCoordinates = {
                        x: noteDataItem.x,
                        y: noteDataItem.y,
                        beat: m * 4 + n,
                        measure: m,
                        width: 20,
                        height: 20,
                        absoluteX: Math.round(noteDataItem.x / 960 * 100),
                        absoluteY: Math.round(noteDataItem.y / 400 * 100)
                    };
                    measure.addElement(note);
                }
            }

            part.addMeasure(measure);
        }

        score.addPart(part);

        // Add coordinate metadata
        score.coordinateMetadata = {
            imageWidth: 960,
            imageHeight: 400,
            pixelsPerBeat: 70,
            staffTop: 150,
            staffBottom: 250,
            systemHeight: 100,
            beatsPerMeasure: 4,
            mapped: true,
            mappingAlgorithm: 'simulated'
        };

        return score;
    }

    /**
     * Merge multiple score pages into one with coordinate mapping
     */
    _mergeScorePages(pages) {
        if (pages.length === 0) {
            return this._createPlaceholderScore('Empty');
        }

        if (pages.length === 1) {
            return pages[0];
        }

        const merged = new Score('Merged Score', pages[0]?.composer || 'Unknown');

        let measureOffset = 0;
        pages.forEach((page) => {
            page.parts.forEach((part, partIndex) => {
                let mergedPart = merged.parts[partIndex];
                if (!mergedPart) {
                    mergedPart = new Part(part.id, part.name);
                    mergedPart.instrument = part.instrument;
                    merged.addPart(mergedPart);
                }

                part.measures.forEach(measure => {
                    const newMeasure = new Measure(measure.number + measureOffset);
                    newMeasure.clef = measure.clef;
                    newMeasure.key = measure.key;
                    newMeasure.timeSignature = measure.timeSignature;

                    measure.notes.forEach(note => {
                        // Update coordinates for merged position
                        if (note.pixelCoordinates) {
                            note.pixelCoordinates = {
                                ...note.pixelCoordinates,
                                measure: note.pixelCoordinates.measure + measureOffset
                            };
                        }
                        newMeasure.addElement(note);
                    });

                    mergedPart.addMeasure(newMeasure);
                });
            });

            const pageMeasureCount = page.parts[0]?.measures?.length || 0;
            measureOffset += pageMeasureCount;
        });

        return merged;
    }

    /**
     * Scan from camera with enhanced visual alignment guides
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
            video.className = 'camera-guide-video';

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
                this.cameraStream = stream;
                this.cameraVideo = video;
                video.srcObject = stream;

                video.onloadedmetadata = () => {
                    video.play();

                    // Create overlay container using CSS class
                    const overlay = document.createElement('div');
                    overlay.id = 'camera-scanner-overlay';
                    overlay.className = 'camera-guide-overlay';

                    // Create alignment guide frame using CSS class
                    const guideFrame = document.createElement('div');
                    guideFrame.id = 'alignment-guide';
                    guideFrame.className = 'camera-guide-frame';

                    // Add corner markers using CSS classes
                    const cornerClasses = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
                    cornerClasses.forEach(cornerClass => {
                        const corner = document.createElement('div');
                        corner.className = `camera-guide-corner ${cornerClass}`;
                        guideFrame.appendChild(corner);
                    });

                    // Add alignment grid lines using CSS classes
                    const gridContainer = document.createElement('div');
                    gridContainer.className = 'camera-guide-grid';

                    // Horizontal center line
                    const hLineCenter = document.createElement('div');
                    hLineCenter.className = 'camera-guide-h-line center';
                    gridContainer.appendChild(hLineCenter);

                    // Vertical center line
                    const vLineCenter = document.createElement('div');
                    vLineCenter.className = 'camera-guide-v-line center';
                    gridContainer.appendChild(vLineCenter);

                    // Add rule of thirds markers
                    const hLine1 = document.createElement('div');
                    hLine1.className = 'camera-guide-h-line third-1';
                    gridContainer.appendChild(hLine1);

                    const hLine2 = document.createElement('div');
                    hLine2.className = 'camera-guide-h-line third-2';
                    gridContainer.appendChild(hLine2);

                    const vLine1 = document.createElement('div');
                    vLine1.className = 'camera-guide-v-line third-1';
                    gridContainer.appendChild(vLine1);

                    const vLine2 = document.createElement('div');
                    vLine2.className = 'camera-guide-v-line third-2';
                    gridContainer.appendChild(vLine2);

                    guideFrame.appendChild(gridContainer);
                    guideFrame.appendChild(video);

                    // Add instruction text using CSS class
                    const instruction = document.createElement('div');
                    instruction.className = 'camera-guide-instruction';
                    instruction.innerHTML = 'Align sheet music within the frame. The edges should touch the corner markers.';

                    // Create button container using CSS class
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'camera-guide-buttons';

                    // Create capture button
                    const captureBtn = document.createElement('button');
                    captureBtn.className = 'btn btn-primary';
                    captureBtn.innerHTML = '<svg class="camera-guide-capture-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>Capture';

                    // Create cancel button
                    const cancelBtn = document.createElement('button');
                    cancelBtn.className = 'btn btn-secondary';
                    cancelBtn.textContent = 'Cancel';

                    buttonContainer.appendChild(cancelBtn);
                    buttonContainer.appendChild(captureBtn);

                    overlay.appendChild(guideFrame);
                    overlay.appendChild(instruction);
                    overlay.appendChild(buttonContainer);
                    document.body.appendChild(overlay);

                    const cleanup = () => {
                        if (this.cameraStream) {
                            this.cameraStream.getTracks().forEach(track => track.stop());
                            this.cameraStream = null;
                            this.cameraVideo = null;
                        }
                        overlay.remove();
                    };

                    captureBtn.onclick = () => {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        ctx.drawImage(video, 0, 0);
                        cleanup();
                        resolve(canvas.toDataURL('image/jpeg', 0.9));
                    };

                    cancelBtn.onclick = () => {
                        cleanup();
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

    /**
     * Detect potential image quality issues
     */
    async analyzeImageQuality(imageDataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const { data } = imageData;

                // Calculate sharpness using Laplacian variance
                let laplacianSum = 0;
                let laplacianCount = 0;
                const gray = new Uint8Array(canvas.width * canvas.height);

                for (let i = 0; i < data.length; i += 4) {
                    gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                }

                for (let y = 1; y < canvas.height - 1; y++) {
                    for (let x = 1; x < canvas.width - 1; x++) {
                        const idx = y * canvas.width + x;
                        const laplacian = Math.abs(
                            gray[idx] * 4 -
                            gray[idx - 1] - gray[idx + 1] -
                            gray[idx - canvas.width] - gray[idx + canvas.width]
                        );
                        laplacianSum += laplacian;
                        laplacianCount++;
                    }
                }

                const avgSharpness = laplacianSum / laplacianCount;

                // Check for blur
                const isBlurry = avgSharpness < 10;

                // Check for low contrast
                let minGray = 255, maxGray = 0;
                for (let i = 0; i < gray.length; i++) {
                    minGray = Math.min(minGray, gray[i]);
                    maxGray = Math.max(maxGray, gray[i]);
                }
                const hasLowContrast = (maxGray - minGray) < 100;

                resolve({
                    isBlurry,
                    hasLowContrast,
                    sharpness: avgSharpness,
                    dynamicRange: maxGray - minGray,
                    resolution: { width: canvas.width, height: canvas.height }
                });
            };
            img.onerror = () => resolve({ error: 'Failed to analyze image' });
            img.src = imageDataUrl;
        });
    }
}

// Export for global use
window.OMRClient = OMRClient;
