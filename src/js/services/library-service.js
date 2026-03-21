/**
 * Library Service - Enhanced library management with IndexedDB
 * Provides CRUD operations, search, and metadata management for sheet music scores
 */

class LibraryService {
    constructor() {
        this.dbName = 'ConcertmasterLibrary';
        this.dbVersion = 2;
        this.db = null;
    }

    /**
     * Initialize the IndexedDB database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Scores object store
                if (!db.objectStoreNames.contains('scores')) {
                    const scoresStore = db.createObjectStore('scores', { keyPath: 'id' });
                    scoresStore.createIndex('title', 'title', { unique: false });
                    scoresStore.createIndex('composer', 'composer', { unique: false });
                    scoresStore.createIndex('instrument', 'instrument', { unique: false });
                    scoresStore.createIndex('addedAt', 'addedAt', { unique: false });
                }

                // Thumbnails store
                if (!db.objectStoreNames.contains('thumbnails')) {
                    db.createObjectStore('thumbnails', { keyPath: 'scoreId' });
                }

                // Shared scores store (for community uploads)
                if (!db.objectStoreNames.contains('sharedScores')) {
                    const sharedStore = db.createObjectStore('sharedScores', { keyPath: 'id' });
                    sharedStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
                    sharedStore.createIndex('title', 'title', { unique: false });
                }
            };
        });
    }

    /**
     * Get all scores from the library
     */
    async getAllScores() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['scores'], 'readonly');
            const store = transaction.objectStore('scores');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a single score by ID
     */
    async getScore(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['scores'], 'readonly');
            const store = transaction.objectStore('scores');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Add a new score to the library
     */
    async addScore(score) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            // Generate ID and set metadata
            score.id = score.id || crypto.randomUUID();
            score.addedAt = score.addedAt || new Date().toISOString();

            // Initialize practice metadata
            score.lastPracticed = score.lastPracticed || null;
            score.practiceCount = score.practiceCount || 0;
            score.difficulty = score.difficulty || 3; // Default 3 stars

            const transaction = this.db.transaction(['scores'], 'readwrite');
            const store = transaction.objectStore('scores');
            const request = store.add(score);

            request.onsuccess = () => resolve(score);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update an existing score
     */
    async updateScore(id, updates) {
        return new Promise(async (resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            // Get existing score
            const existingScore = await this.getScore(id);
            if (!existingScore) {
                reject(new Error('Score not found'));
                return;
            }

            // Merge updates
            const updatedScore = { ...existingScore, ...updates };

            const transaction = this.db.transaction(['scores'], 'readwrite');
            const store = transaction.objectStore('scores');
            const request = store.put(updatedScore);

            request.onsuccess = () => resolve(updatedScore);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a score from the library
     */
    async deleteScore(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['scores', 'thumbnails'], 'readwrite');
            const scoresStore = transaction.objectStore('scores');
            const thumbnailsStore = transaction.objectStore('thumbnails');

            scoresStore.delete(id);
            thumbnailsStore.delete(id);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    /**
     * Search scores by title, composer, or instrument
     */
    async searchScores(query) {
        const scores = await this.getAllScores();

        if (!query || query.trim() === '') {
            return scores;
        }

        const lowerQuery = query.toLowerCase().trim();

        return scores.filter(score => {
            const titleMatch = score.title?.toLowerCase().includes(lowerQuery);
            const composerMatch = score.composer?.toLowerCase().includes(lowerQuery);
            const instrumentMatch = score.instrument?.toLowerCase().includes(lowerQuery);
            const tagsMatch = score.tags?.some(tag => tag.toLowerCase().includes(lowerQuery));

            return titleMatch || composerMatch || instrumentMatch || tagsMatch;
        });
    }

    /**
     * Filter scores by instrument
     */
    async filterByInstrument(instrument) {
        const scores = await this.getAllScores();

        if (!instrument || instrument === 'all') {
            return scores;
        }

        return scores.filter(score =>
            score.instrument?.toLowerCase() === instrument.toLowerCase()
        );
    }

    /**
     * Filter scores by difficulty level
     */
    async filterByDifficulty(minDifficulty, maxDifficulty) {
        const scores = await this.getAllScores();

        return scores.filter(score => {
            const difficulty = score.difficulty || 3;
            return difficulty >= minDifficulty && difficulty <= maxDifficulty;
        });
    }

    /**
     * Update practice metadata for a score
     */
    async recordPractice(id) {
        return new Promise(async (resolve, reject) => {
            const score = await this.getScore(id);
            if (!score) {
                reject(new Error('Score not found'));
                return;
            }

            score.lastPracticed = new Date().toISOString();
            score.practiceCount = (score.practiceCount || 0) + 1;

            await this.updateScore(id, score);
            resolve(score);
        });
    }

    /**
     * Set difficulty rating for a score
     */
    async setDifficulty(id, difficulty) {
        // Validate difficulty (1-5)
        const validDifficulty = Math.max(1, Math.min(5, difficulty));
        return this.updateScore(id, { difficulty: validDifficulty });
    }

    /**
     * Save thumbnail for a score
     */
    async saveThumbnail(scoreId, thumbnailData) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['thumbnails'], 'readwrite');
            const store = transaction.objectStore('thumbnails');
            const request = store.put({ scoreId, data: thumbnailData });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get thumbnail for a score
     */
    async getThumbnail(scoreId) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve(null);
                return;
            }

            const transaction = this.db.transaction(['thumbnails'], 'readonly');
            const store = transaction.objectStore('thumbnails');
            const request = store.get(scoreId);

            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.data : null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get scores sorted by last practiced
     */
    async getRecentlyPracticed(limit = 10) {
        const scores = await this.getAllScores();

        return scores
            .filter(score => score.lastPracticed)
            .sort((a, b) => new Date(b.lastPracticed) - new Date(a.lastPracticed))
            .slice(0, limit);
    }

    /**
     * Get most practiced scores
     */
    async getMostPracticed(limit = 10) {
        const scores = await this.getAllScores();

        return scores
            .filter(score => score.practiceCount > 0)
            .sort((a, b) => (b.practiceCount || 0) - (a.practiceCount || 0))
            .slice(0, limit);
    }

    /**
     * Add shared score from community
     */
    async addSharedScore(score) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            score.id = score.id || crypto.randomUUID();
            score.uploadedAt = new Date().toISOString();
            score.isShared = true;

            const transaction = this.db.transaction(['sharedScores'], 'readwrite');
            const store = transaction.objectStore('sharedScores');
            const request = store.add(score);

            request.onsuccess = () => resolve(score);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all shared scores
     */
    async getSharedScores() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['sharedScores'], 'readonly');
            const store = transaction.objectStore('sharedScores');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Import score from file
     */
    async importFromFile(file) {
        return new Promise(async (resolve, reject) => {
            try {
                if (file.name.endsWith('.musicxml') || file.name.endsWith('.xml')) {
                    const text = await file.text();
                    const parser = new MusicXMLParser();
                    const score = parser.parse(text);

                    // Add file metadata
                    score.originalFileName = file.name;
                    score.fileSize = file.size;

                    await this.addScore(score);
                    resolve(score);
                } else if (file.name.endsWith('.pdf')) {
                    // For PDF files, create a placeholder score
                    const score = new Score(file.name.replace('.pdf', ''), 'Unknown');
                    score.originalFileName = file.name;
                    score.fileSize = file.size;
                    score.fileType = 'pdf';

                    await this.addScore(score);
                    resolve(score);
                } else if (file.type.startsWith('image/')) {
                    // For images, we'll process with OMR later
                    const score = new Score('Scanned Score', 'Unknown');
                    score.originalFileName = file.name;
                    score.fileSize = file.size;
                    score.fileType = 'image';
                    score.imageData = await this._fileToBase64(file);

                    await this.addScore(score);
                    resolve(score);
                } else {
                    reject(new Error('Unsupported file format'));
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Convert file to base64
     */
    _fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}

// Export for global use
window.LibraryService = LibraryService;