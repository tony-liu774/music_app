/**
 * Tests for OMR Client - Optical Music Recognition
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Define window and globals needed by OMRClient
global.window = global;
global.document = {
    createElement: (tag) => {
        const element = {
            tagName: tag.toUpperCase(),
            style: {},
            setAttribute: () => {},
            getAttribute: () => null,
            addEventListener: () => {},
            removeEventListener: () => {},
            remove: () => {},
            appendChild: () => {},
            querySelector: () => null,
            querySelectorAll: () => [],
            width: 100,
            height: 100,
            getContext: (type) => ({
                drawImage: () => {},
                getImageData: () => ({ data: new Uint8ClampedArray(100) }),
                putImageData: () => {},
                toDataURL: (mimeType, quality) => 'data:image/jpeg;base64,mock'
            }),
            toDataURL: (mimeType, quality) => 'data:image/jpeg;base64,mock'
        };
        return element;
    },
    body: {
        appendChild: () => {},
        removeChild: () => {}
    }
};

// Mock FileReader
global.FileReader = class FileReader {
    constructor() {
        this.result = null;
        this.onload = null;
        this.onerror = null;
    }
    readAsDataURL(file) {
        // Simulate async loading
        setTimeout(() => {
            if (this.onload) {
                this.result = 'data:image/jpeg;base64,mock';
                this.onload({ target: this });
            }
        }, 10);
    }
    readAsArrayBuffer(file) {
        setTimeout(() => {
            if (this.onload) {
                this.result = new ArrayBuffer(100);
                this.onload({ target: this });
            }
        }, 10);
    }
};

// Mock Image
global.Image = class Image {
    constructor() {
        this.width = 100;
        this.height = 100;
        this.onload = null;
        this.onerror = null;
    }
    get src() {
        return this._src;
    }
    set src(value) {
        this._src = value;
        // Simulate async image loading
        setTimeout(() => {
            if (this.onload) {
                this.onload();
            }
        }, 10);
    }
};

// Load the models first
require('../src/js/models/sheet-music.js');

// Load the OMR client
require('../src/js/services/omr-client.js');

const OMRClient = global.window.OMRClient;

describe('OMRClient', () => {
    let client;

    beforeEach(() => {
        client = new OMRClient();
    });

    describe('constructor', () => {
        it('should initialize with default values', () => {
            assert.strictEqual(client.apiEndpoint, '/api/omr');
            assert.strictEqual(client.maxImageSize, 4096);
            assert.ok(Array.isArray(client.supportedImageFormats));
            assert.ok(Array.isArray(client.supportedDocumentFormats));
        });

        it('should have correct supported formats', () => {
            assert.ok(client.supportedImageFormats.includes('image/jpeg'));
            assert.ok(client.supportedImageFormats.includes('image/png'));
            assert.ok(client.supportedDocumentFormats.includes('application/pdf'));
        });
    });

    describe('isSupportedFormat', () => {
        it('should return true for supported image formats', () => {
            const jpegFile = { type: 'image/jpeg', name: 'test.jpg' };
            const pngFile = { type: 'image/png', name: 'test.png' };
            const webpFile = { type: 'image/webp', name: 'test.webp' };

            assert.strictEqual(client.isSupportedFormat(jpegFile), true);
            assert.strictEqual(client.isSupportedFormat(pngFile), true);
            assert.strictEqual(client.isSupportedFormat(webpFile), true);
        });

        it('should return true for PDF format', () => {
            const pdfFile = { type: 'application/pdf', name: 'test.pdf' };
            assert.strictEqual(client.isSupportedFormat(pdfFile), true);
        });

        it('should return false for unsupported formats', () => {
            const textFile = { type: 'text/plain', name: 'test.txt' };
            const gifFile = { type: 'image/gif', name: 'test.gif' };

            assert.strictEqual(client.isSupportedFormat(textFile), false);
            assert.strictEqual(client.isSupportedFormat(gifFile), false);
        });
    });

    describe('isPDF', () => {
        it('should detect PDF by MIME type', () => {
            const pdfFile = { type: 'application/pdf', name: 'test.pdf' };
            assert.strictEqual(client.isPDF(pdfFile), true);
        });

        it('should detect PDF by file extension', () => {
            const file = { type: 'image/jpeg', name: 'sheetmusic.pdf' };
            assert.strictEqual(client.isPDF(file), true);
        });

        it('should return false for non-PDF files', () => {
            const jpgFile = { type: 'image/jpeg', name: 'test.jpg' };
            const pngFile = { type: 'image/png', name: 'test.png' };

            assert.strictEqual(client.isPDF(jpgFile), false);
            assert.strictEqual(client.isPDF(pngFile), false);
        });
    });

    describe('validateFile', () => {
        it('should throw for unsupported formats', () => {
            const invalidFile = { type: 'text/plain', name: 'test.txt', size: 1000 };
            assert.throws(() => client.validateFile(invalidFile), /Unsupported format/);
        });

        it('should throw for files larger than 20MB', () => {
            const largeFile = { type: 'image/jpeg', name: 'test.jpg', size: 25 * 1024 * 1024 };
            assert.throws(() => client.validateFile(largeFile), /File too large/);
        });

        it('should return true for valid files', () => {
            const validFile = { type: 'image/jpeg', name: 'test.jpg', size: 1024 * 1024 };
            assert.strictEqual(client.validateFile(validFile), true);
        });

        it('should accept valid PDF files', () => {
            const pdfFile = { type: 'application/pdf', name: 'test.pdf', size: 5 * 1024 * 1024 };
            assert.strictEqual(client.validateFile(pdfFile), true);
        });
    });

    describe('getSupportedFormats', () => {
        it('should return all supported formats as comma-separated string', () => {
            const formats = client.getSupportedFormats();
            assert.ok(formats.includes('image/jpeg'));
            assert.ok(formats.includes('application/pdf'));
        });
    });

    describe('progress callback', () => {
        it('should allow setting progress callback', () => {
            let progressCalled = false;
            client.onProgress(({ percent, message }) => {
                progressCalled = true;
            });

            client.reportProgress(50, 'Testing...');
            assert.strictEqual(progressCalled, true);
        });

        it('should not throw when progress callback is not set', () => {
            assert.doesNotThrow(() => {
                client.reportProgress(100, 'Complete');
            });
        });
    });
});

describe('OMRClient processFile', () => {
    let client;

    beforeEach(() => {
        client = new OMRClient();
    });

    describe('processImage', () => {
        it('should create a Score object from image', async () => {
            // Create a mock image file
            const mockFile = {
                type: 'image/jpeg',
                name: 'test.jpg',
                size: 1024
            };

            // Process should complete (with simulated backend)
            const score = await client.processFile(mockFile, () => {});

            assert.ok(score instanceof window.Score);
            assert.ok(score.parts.length > 0);
            assert.ok(score.parts[0].measures.length > 0);
        });

        it('should report progress during processing', async () => {
            const mockFile = {
                type: 'image/jpeg',
                name: 'test.jpg',
                size: 1024
            };

            const progressUpdates = [];
            const onProgress = ({ percent, message }) => {
                progressUpdates.push({ percent, message });
            };

            await client.processFile(mockFile, onProgress);

            // Should have multiple progress updates
            assert.ok(progressUpdates.length > 0);
            // Last update should be 100%
            assert.strictEqual(progressUpdates[progressUpdates.length - 1].percent, 100);
        });
    });

    describe('processPDF', () => {
        it('should handle PDF files', async () => {
            const mockPdfFile = {
                type: 'application/pdf',
                name: 'test.pdf',
                size: 1024 * 1024
            };

            const score = await client.processFile(mockPdfFile, () => {});

            assert.ok(score instanceof window.Score);
        });

        it('should report progress during PDF processing', async () => {
            const mockPdfFile = {
                type: 'application/pdf',
                name: 'test.pdf',
                size: 1024 * 1024
            };

            const progressUpdates = [];
            const onProgress = ({ percent, message }) => {
                progressUpdates.push({ percent, message });
            };

            await client.processFile(mockPdfFile, onProgress);

            assert.ok(progressUpdates.length > 0);
        });
    });
});

describe('OMRClient integration with Score model', () => {
    let client;

    beforeEach(() => {
        client = new OMRClient();
    });

    it('should create score with correct structure', async () => {
        const mockFile = {
            type: 'image/jpeg',
            name: 'test.jpg',
            size: 1024
        };

        const score = await client.processFile(mockFile, () => {});

        // Check score has required properties
        assert.ok(score.title);
        assert.ok(score.composer);
        assert.ok(Array.isArray(score.parts));

        // Check part structure
        const part = score.parts[0];
        assert.ok(part.id);
        assert.ok(part.name);
        assert.ok(part.instrument);
        assert.ok(Array.isArray(part.measures));

        // Check measure structure
        const measure = part.measures[0];
        assert.ok(measure.number !== undefined);
        assert.ok(Array.isArray(measure.notes));
    });

    it('should allow adding scanned score to library', async () => {
        const mockFile = {
            type: 'image/jpeg',
            name: 'test.jpg',
            size: 1024
        };

        const score = await client.processFile(mockFile, () => {});

        // Score should have all methods needed for library storage
        assert.strictEqual(typeof score.getAllNotes, 'function');
        assert.strictEqual(typeof score.getTotalMeasures, 'function');
    });
});
