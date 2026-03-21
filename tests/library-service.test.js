/**
 * Library Service Tests
 * Tests for the Community Library Module functionality
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// Set up globals before requiring the module
global.window = {
    MusicXMLParser: class {
        parse(text) {
            return { title: 'Test Score', composer: 'Test Composer' };
        }
    },
    Score: class {
        constructor(title, composer) {
            this.title = title;
            this.composer = composer;
        }
    }
};

global.indexedDB = {
    open: (name, version) => {
        const request = {
            result: null,
            error: null,
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null,
            readyState: 'pending'
        };

        // Simulate async success
        setTimeout(() => {
            request.result = {
                objectStoreNames: { contains: () => true },
                createObjectStore: () => ({
                    createIndex: () => {},
                    add: () => ({ onsuccess: null, onerror: null }),
                    put: () => ({ onsuccess: null, onerror: null }),
                    get: () => ({ onsuccess: null, onerror: null }),
                    getAll: () => ({ onsuccess: null, onerror: null }),
                    delete: () => ({ onsuccess: null, onerror: null })
                }),
                transaction: () => ({
                    objectStore: () => ({
                        add: () => ({ onsuccess: null, onerror: null }),
                        put: () => ({ onsuccess: null, onerror: null }),
                        get: () => ({ onsuccess: null, onerror: null }),
                        getAll: () => ({ onsuccess: null, onerror: null }),
                        delete: () => ({ onsuccess: null, onerror: null })
                    }),
                    oncomplete: null,
                    onerror: null
                })
            };
            if (request.onsuccess) {
                request.onsuccess({ target: request });
            }
        }, 0);

        return request;
    }
};

global.crypto = {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
};

// Now require the module
require('../src/js/services/library-service.js');

describe('LibraryService', () => {
    let libraryService;

    beforeEach(() => {
        libraryService = new window.LibraryService();
    });

    test('should initialize with default values', () => {
        assert.strictEqual(libraryService.dbName, 'ConcertmasterLibrary');
        assert.strictEqual(libraryService.dbVersion, 2);
    });

    test('should have required methods', () => {
        assert.strictEqual(typeof libraryService.init, 'function');
        assert.strictEqual(typeof libraryService.getAllScores, 'function');
        assert.strictEqual(typeof libraryService.getScore, 'function');
        assert.strictEqual(typeof libraryService.addScore, 'function');
        assert.strictEqual(typeof libraryService.updateScore, 'function');
        assert.strictEqual(typeof libraryService.deleteScore, 'function');
        assert.strictEqual(typeof libraryService.searchScores, 'function');
        assert.strictEqual(typeof libraryService.filterByInstrument, 'function');
        assert.strictEqual(typeof libraryService.filterByDifficulty, 'function');
        assert.strictEqual(typeof libraryService.recordPractice, 'function');
        assert.strictEqual(typeof libraryService.setDifficulty, 'function');
    });
});

describe('ScoreLibrary Search Logic', () => {
    test('should filter scores by title', () => {
        const scores = [
            { title: 'Bach Cello Suite', composer: 'Bach' },
            { title: 'Mozart Violin Concerto', composer: 'Mozart' },
            { title: 'Bach Air', composer: 'Bach' }
        ];

        const query = 'bach';
        const results = scores.filter(score => {
            const titleMatch = score.title?.toLowerCase().includes(query.toLowerCase());
            const composerMatch = score.composer?.toLowerCase().includes(query.toLowerCase());
            return titleMatch || composerMatch;
        });

        assert.strictEqual(results.length, 2);
    });

    test('should filter scores by composer', () => {
        const scores = [
            { title: 'Bach Cello Suite', composer: 'Bach' },
            { title: 'Mozart Violin Concerto', composer: 'Mozart' },
            { title: 'Bach Air', composer: 'Bach' }
        ];

        const query = 'mozart';
        const results = scores.filter(score => {
            const titleMatch = score.title?.toLowerCase().includes(query.toLowerCase());
            const composerMatch = score.composer?.toLowerCase().includes(query.toLowerCase());
            return titleMatch || composerMatch;
        });

        assert.strictEqual(results.length, 1);
        assert.strictEqual(results[0].title, 'Mozart Violin Concerto');
    });

    test('should filter by instrument', () => {
        const scores = [
            { title: 'Test 1', instrument: 'violin' },
            { title: 'Test 2', instrument: 'cello' },
            { title: 'Test 3', instrument: 'violin' }
        ];

        const instrument = 'violin';
        const results = scores.filter(score =>
            score.instrument?.toLowerCase() === instrument.toLowerCase()
        );

        assert.strictEqual(results.length, 2);
    });

    test('should filter by difficulty range', () => {
        const scores = [
            { title: 'Test 1', difficulty: 1 },
            { title: 'Test 2', difficulty: 3 },
            { title: 'Test 3', difficulty: 5 },
            { title: 'Test 4', difficulty: 4 }
        ];

        const minDifficulty = 3;
        const maxDifficulty = 5;
        const results = scores.filter(score => {
            const difficulty = score.difficulty || 3;
            return difficulty >= minDifficulty && difficulty <= maxDifficulty;
        });

        assert.strictEqual(results.length, 3);
    });

    test('should handle empty query', () => {
        const scores = [
            { title: 'Bach Cello Suite', composer: 'Bach' },
            { title: 'Mozart Violin Concerto', composer: 'Mozart' }
        ];

        const query = '';
        const results = scores.filter(score => {
            const titleMatch = score.title?.toLowerCase().includes(query.toLowerCase());
            const composerMatch = score.composer?.toLowerCase().includes(query.toLowerCase());
            return titleMatch || composerMatch;
        });

        // Empty query should still match (returns all)
        assert.strictEqual(results.length, scores.length);
    });
});

describe('Difficulty Rating Generation', () => {
    test('should generate correct number of stars', () => {
        const generateStars = (difficulty = 3) => {
            const stars = [];
            for (let i = 1; i <= 5; i++) {
                stars.push(i <= difficulty ? 'filled' : 'empty');
            }
            return stars;
        };

        assert.deepStrictEqual(generateStars(1), ['filled', 'empty', 'empty', 'empty', 'empty']);
        assert.deepStrictEqual(generateStars(3), ['filled', 'filled', 'filled', 'empty', 'empty']);
        assert.deepStrictEqual(generateStars(5), ['filled', 'filled', 'filled', 'filled', 'filled']);
        assert.deepStrictEqual(generateStars(0), ['empty', 'empty', 'empty', 'empty', 'empty']);
    });

    test('should clamp difficulty to valid range', () => {
        const clampDifficulty = (difficulty) => Math.max(1, Math.min(5, difficulty));

        assert.strictEqual(clampDifficulty(0), 1);
        assert.strictEqual(clampDifficulty(-1), 1);
        assert.strictEqual(clampDifficulty(6), 5);
        assert.strictEqual(clampDifficulty(3), 3);
    });
});

describe('Last Practiced Formatting', () => {
    test('should format recent dates', () => {
        const formatLastPracticed = (dateString) => {
            if (!dateString) return 'Never practiced';
            const date = new Date(dateString);
            const now = new Date();
            const diff = now - date;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));

            if (days === 0) return 'Today';
            if (days === 1) return 'Yesterday';
            if (days < 7) return `${days} days ago`;
            if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
            return date.toLocaleDateString();
        };

        const today = new Date().toISOString();
        const yesterday = new Date(Date.now() - 86400000).toISOString();
        const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();

        assert.strictEqual(formatLastPracticed(today), 'Today');
        assert.strictEqual(formatLastPracticed(yesterday), 'Yesterday');
        assert.strictEqual(formatLastPracticed(lastWeek), '7 days ago');
    });

    test('should return Never practiced for null', () => {
        const formatLastPracticed = (dateString) => {
            if (!dateString) return 'Never practiced';
            return 'Some date';
        };

        assert.strictEqual(formatLastPracticed(null), 'Never practiced');
        assert.strictEqual(formatLastPracticed(undefined), 'Never practiced');
    });
});

describe('Filter Chips Logic', () => {
    test('should filter by all instruments', () => {
        const scores = [
            { title: 'Test 1', instrument: 'violin' },
            { title: 'Test 2', instrument: 'cello' },
            { title: 'Test 3', instrument: 'viola' }
        ];

        const filter = 'all';
        const results = filter === 'all' || filter === '' ? scores :
            scores.filter(score => score.instrument?.toLowerCase() === filter.toLowerCase());

        assert.strictEqual(results.length, 3);
    });

    test('should filter by specific difficulty', () => {
        const scores = [
            { title: 'Test 1', difficulty: 1 },
            { title: 'Test 2', difficulty: 3 },
            { title: 'Test 3', difficulty: 5 },
            { title: 'Test 4', difficulty: 3 }
        ];

        const difficultyFilter = 3;
        const results = scores.filter(score => score.difficulty === difficultyFilter);

        assert.strictEqual(results.length, 2);
    });
});

describe('Practice Count Tracking', () => {
    test('should increment practice count', () => {
        const score = {
            practiceCount: 5,
            lastPracticed: new Date().toISOString()
        };

        // Simulate recording practice
        const updatedScore = {
            ...score,
            lastPracticed: new Date().toISOString(),
            practiceCount: (score.practiceCount || 0) + 1
        };

        assert.strictEqual(updatedScore.practiceCount, 6);
    });

    test('should initialize practice count at 0', () => {
        const score = {};

        const practiceCount = score.practiceCount || 0;
        assert.strictEqual(practiceCount, 0);
    });
});

console.log('Running library service tests...');
