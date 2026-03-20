/**
 * OMR Client - Frontend service for Optical Music Recognition
 *
 * This client handles image upload and processing for sheet music scanning.
 * Features inspired by CamScanner:
 * - Image capture/import
 * - Basic image enhancement (contrast, brightness)
 * - OMR processing for converting images to MusicXML
 */

class OMRClient {
    constructor() {
        this.baseUrl = '/api/omr';
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
    }

    /**
     * Upload and process sheet music image
     * @param {File} imageFile - Image file to process
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processing result with extracted notation
     */
    async processImage(imageFile, options = {}) {
        if (!imageFile) {
            throw new Error('No image file provided');
        }

        if (imageFile.size > this.maxFileSize) {
            throw new Error('File too large. Maximum size is 10MB.');
        }

        const formData = new FormData();
        formData.append('image', imageFile);

        // Add processing options
        if (options.enhance !== undefined) {
            formData.append('enhance', options.enhance);
        }
        if (options.deskew !== undefined) {
            formData.append('deskew', options.deskew);
        }

        try {
            const response = await fetch(`${this.baseUrl}/scan`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Processing failed');
            }

            return await response.json();
        } catch (error) {
            console.error('OMR processing error:', error);
            throw error;
        }
    }

    /**
     * Enhance image using canvas (client-side preprocessing)
     * @param {HTMLCanvasElement} canvas - Source canvas
     * @param {Object} settings - Enhancement settings
     * @returns {HTMLCanvasElement} Enhanced canvas
     */
    enhanceImage(canvas, settings = {}) {
        const {
            brightness = 1,
            contrast = 1,
            grayscale = false,
            sharpen = false
        } = settings;

        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Apply brightness and contrast
        for (let i = 0; i < data.length; i += 4) {
            // Apply brightness
            let r = data[i] * brightness;
            let g = data[i + 1] * brightness;
            let b = data[i + 2] * brightness;

            // Apply contrast
            const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
            r = factor * (r - 128) + 128;
            g = factor * (g - 128) + 128;
            b = factor * (b - 128) + 128;

            // Apply grayscale if requested
            if (grayscale) {
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                r = g = b = gray;
            }

            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    /**
     * Convert canvas to blob for upload
     * @param {HTMLCanvasElement} canvas - Canvas to convert
     * @param {string} type - MIME type
     * @returns {Promise<Blob>}
     */
    canvasToBlob(canvas, type = 'image/png') {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to convert canvas to blob'));
                }
            }, type);
        });
    }

    /**
     * Get supported file types
     * @returns {Array<string>} List of supported MIME types
     */
    getSupportedTypes() {
        return ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
    }
}

// Helper functions for image processing

/**
 * Apply threshold to make sheet music notation stand out
 */
export function applyThreshold(canvas, threshold = 128) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const value = gray > threshold ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = value;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

/**
 * Detect edges in the image (useful for staff line detection)
 */
export function detectEdges(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    const output = ctx.createImageData(width, height);
    const outputData = output.data;

    // Sobel operator for edge detection
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = (y * width + x) * 4;

            // Get surrounding pixel values (grayscale)
            const getGray = (px, py) => {
                const idx = (py * width + px) * 4;
                return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            };

            const gx = (
                -getGray(x - 1, y - 1) + getGray(x + 1, y - 1) +
                -2 * getGray(x - 1, y) + 2 * getGray(x + 1, y) +
                -getGray(x - 1, y + 1) + getGray(x + 1, y + 1)
            );

            const gy = (
                -getGray(x - 1, y - 1) - 2 * getGray(x, y - 1) - getGray(x + 1, y - 1) +
                getGray(x - 1, y + 1) + 2 * getGray(x, y + 1) + getGray(x + 1, y + 1)
            );

            const magnitude = Math.sqrt(gx * gx + gy * gy);
            const value = Math.min(255, magnitude);

            outputData[i] = outputData[i + 1] = outputData[i + 2] = value;
            outputData[i + 3] = 255;
        }
    }

    ctx.putImageData(output, 0, 0);
    return canvas;
}

window.OMRClient = OMRClient;
