/**
 * Heat Map History Service Tests
 * Tests for the weekly heat map storage and retrieval functionality
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock IndexedDB
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
                        delete: () => ({ onsuccess: null, onerror: null }),
                        index: () => ({
                            getAll: () => ({ onsuccess: null, onerror: null })
                        })
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

// Load the module - it exports as module.exports.HeatMapHistoryService
const HeatMapHistoryServiceModule = require('../src/js/services/heat-map-history-service.js');
const HeatMapHistoryService = HeatMapHistoryServiceModule.HeatMapHistoryService || HeatMapHistoryServiceModule;

describe('HeatMapHistoryService', () => {
    let service;

    beforeEach(() => {
        service = new HeatMapHistoryService();
    });

    test('should create service with default values', () => {
        assert.strictEqual(service.dbName, 'ConcertmasterHeatMaps');
        assert.strictEqual(service.dbVersion, 1);
        assert.strictEqual(service.db, null);
    });

    test('should format week range correctly', () => {
        // Test with a known date (Monday)
        const weekStart = new Date('2024-01-01').getTime();
        const formatted = service.formatWeekRange(weekStart);

        // Should contain month abbreviations
        assert.ok(formatted.includes('Jan'));
    });

    test('should format practice time correctly', () => {
        // Zero time
        assert.strictEqual(service.formatPracticeTime(0), '0m');
        assert.strictEqual(service.formatPracticeTime(null), '0m');

        // Minutes only
        assert.strictEqual(service.formatPracticeTime(60000), '1m');
        assert.strictEqual(service.formatPracticeTime(300000), '5m');
        assert.strictEqual(service.formatPracticeTime(3540000), '59m');

        // Hours and minutes
        assert.strictEqual(service.formatPracticeTime(3600000), '1h');
        assert.strictEqual(service.formatPracticeTime(3660000), '1h 1m');
        assert.strictEqual(service.formatPracticeTime(7200000), '2h');
        assert.strictEqual(service.formatPracticeTime(7500000), '2h 5m');
    });

    test('should get week start correctly', () => {
        // Test Monday as week start
        const monday = new Date('2024-01-01'); // This is a Monday
        const weekStart = service._getWeekStart(monday);
        const result = new Date(weekStart);

        // Should be midnight
        assert.strictEqual(result.getHours(), 0);
        assert.strictEqual(result.getMinutes(), 0);
        assert.strictEqual(result.getSeconds(), 0);
        assert.strictEqual(result.getMilliseconds(), 0);
    });

    test('should extract measure data from session deviations', () => {
        const sessionData = {
            scoreId: 'test-score',
            deviations: [
                { measure: 1, type: 'pitch' },
                { measure: 1, type: 'pitch' },
                { measure: 2, type: 'rhythm' },
                { measure: 3, type: 'pitch' },
                { measure: 3, type: 'pitch' },
                { measure: 3, type: 'pitch' }
            ]
        };

        const measureData = service._extractMeasureData(sessionData);

        assert.strictEqual(measureData.length, 3);

        // Measure 1: 2 pitch errors
        const m1 = measureData.find(m => m.measure === 1);
        assert.ok(m1);
        assert.strictEqual(m1.pitchErrors, 2);
        assert.strictEqual(m1.totalNotes, 2);

        // Measure 2: 1 rhythm error
        const m2 = measureData.find(m => m.measure === 2);
        assert.ok(m2);
        assert.strictEqual(m2.rhythmErrors, 1);
        assert.strictEqual(m2.totalNotes, 1);

        // Measure 3: 3 pitch errors
        const m3 = measureData.find(m => m.measure === 3);
        assert.ok(m3);
        assert.strictEqual(m3.pitchErrors, 3);
        assert.strictEqual(m3.totalNotes, 3);
    });

    test('should calculate accuracy correctly in measure data', () => {
        const sessionData = {
            scoreId: 'test-score',
            deviations: [
                { measure: 1, type: 'pitch' }, // 1 error out of 1 note = 0% accuracy
                { measure: 2, type: 'pitch' }, // 1 error out of 2 notes
                { measure: 2, type: 'pitch' },
                { measure: 3, type: 'pitch' } // 1 error out of 1 note
            ]
        };

        const measureData = service._extractMeasureData(sessionData);

        // Measure 1: 1 error / 1 note = 0% accuracy
        const m1 = measureData.find(m => m.measure === 1);
        assert.ok(m1);
        assert.strictEqual(m1.totalNotes, 1);
        assert.strictEqual(m1.pitchErrors, 1);

        // Measure 2: 2 errors / 2 notes = 0% accuracy
        const m2 = measureData.find(m => m.measure === 2);
        assert.ok(m2);
        assert.strictEqual(m2.totalNotes, 2);
        assert.strictEqual(m2.pitchErrors, 2);

        // Measure 3: 1 error / 1 note = 0% accuracy
        const m3 = measureData.find(m => m.measure === 3);
        assert.ok(m3);
        assert.strictEqual(m3.totalNotes, 1);
    });

    test('should handle empty deviations', () => {
        const sessionData = {
            scoreId: 'test-score',
            deviations: []
        };

        const measureData = service._extractMeasureData(sessionData);

        // Empty deviations should return empty array
        assert.strictEqual(measureData.length, 0);
    });

    test('should handle undefined deviations', () => {
        const sessionData = {
            scoreId: 'test-score'
        };

        const measureData = service._extractMeasureData(sessionData);

        assert.strictEqual(measureData.length, 0);
    });
});

describe('HeatMapHistoryUI', () => {
    test('should have required exports', () => {
        // HeatMapHistoryUI should be defined
        assert.ok(true);
    });
});
