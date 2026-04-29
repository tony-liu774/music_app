/**
 * IMSLP API Routes - Proxy for IMSLP sheet music search and download
 *
 * Features:
 * - Search caching with configurable TTL
 * - Real scraping integration point for IMSLP
 * - PDF download with proper headers
 */

const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');

// Configuration
const config = {
    imslpBaseUrl: 'https://imslp.org',
    useRealScraping: process.env.IMSLP_USE_REAL_SCRAPING === 'true',
    requestTimeout: 30000, // 30 seconds
};

// In-memory cache for search results
const searchCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Mock results database for demo mode
const getMockResults = (query) => {
    const mockDatabase = [
        // Bach pieces
        {
            id: 'imslp-bach-1',
            title: 'Violin Partita No. 1 in B minor, BWV 1002',
            composer: 'Johann Sebastian Bach',
            instrument: 'Violin',
            difficulty: 'Advanced',
            source: 'IMSLP',
            license: 'Public Domain'
        },
        {
            id: 'imslp-bach-2',
            title: 'Cello Suite No. 1 in G major, BWV 1007',
            composer: 'Johann Sebastian Bach',
            instrument: 'Cello',
            difficulty: 'Intermediate',
            source: 'IMSLP',
            license: 'Public Domain'
        },
        {
            id: 'imslp-bach-3',
            title: 'Violin Sonata No. 1 in G minor, BWV 1001',
            composer: 'Johann Sebastian Bach',
            instrument: 'Violin',
            difficulty: 'Advanced',
            source: 'IMSLP',
            license: 'Public Domain'
        },
        // Mozart pieces
        {
            id: 'imslp-mozart-1',
            title: 'Violin Concerto No. 3 in G major, K. 216',
            composer: 'Wolfgang Amadeus Mozart',
            instrument: 'Violin',
            difficulty: 'Intermediate',
            source: 'IMSLP',
            license: 'Public Domain'
        },
        {
            id: 'imslp-mozart-2',
            title: 'Eine kleine Nachtmusik, K. 525',
            composer: 'Wolfgang Amadeus Mozart',
            instrument: 'Violin',
            difficulty: 'Intermediate',
            source: 'IMSLP',
            license: 'Public Domain'
        },
        // Beethoven pieces
        {
            id: 'imslp-beethoven-1',
            title: 'Violin Sonata No. 5 "Spring"',
            composer: 'Ludwig van Beethoven',
            instrument: 'Violin',
            difficulty: 'Intermediate',
            source: 'IMSLP',
            license: 'Public Domain'
        },
        {
            id: 'imslp-beethoven-2',
            title: 'Cello Sonata No. 3 in C major, Op. 69',
            composer: 'Ludwig van Beethoven',
            instrument: 'Cello',
            difficulty: 'Advanced',
            source: 'IMSLP',
            license: 'Public Domain'
        },
        // Vivaldi pieces
        {
            id: 'imslp-vivaldi-1',
            title: 'The Four Seasons (Violin)',
            composer: 'Antonio Vivaldi',
            instrument: 'Violin',
            difficulty: 'Advanced',
            source: 'IMSLP',
            license: 'Public Domain'
        },
        {
            id: 'imslp-vivaldi-2',
            title: 'Cello Concerto in G minor, RV 417',
            composer: 'Antonio Vivaldi',
            instrument: 'Cello',
            difficulty: 'Intermediate',
            source: 'IMSLP',
            license: 'Public Domain'
        },
        // Paganini
        {
            id: 'imslp-paganini-1',
            title: 'Caprice No. 24',
            composer: 'Niccolò Paganini',
            instrument: 'Violin',
            difficulty: 'Advanced',
            source: 'IMSLP',
            license: 'Public Domain'
        }
    ];

    const lowerQuery = query.toLowerCase();

    // Search by matching title or composer
    return mockDatabase.filter(item => {
        const titleMatch = item.title.toLowerCase().includes(lowerQuery);
        const composerMatch = item.composer.toLowerCase().includes(lowerQuery);
        const queryWords = lowerQuery.split(' ').filter(w => w.length > 2);
        const partialMatch = queryWords.some(word =>
            item.title.toLowerCase().includes(word) ||
            item.composer.toLowerCase().includes(word)
        );

        return titleMatch || composerMatch || partialMatch;
    });
};

/**
 * Search IMSLP
 * Uses real scraping if configured, otherwise returns mock results
 */
router.post('/search', async (req, res) => {
    try {
        const { query, instrument } = req.body;

        if (!query || query.trim().length < 2) {
            return res.status(400).json({
                error: 'Invalid query',
                message: 'Search query must be at least 2 characters'
            });
        }

        // Check cache first
        const cacheKey = `${query.toLowerCase()}-${instrument || 'all'}`;
        const cached = searchCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`[IMSLP] Cache hit for: ${query}`);
            return res.json(cached.results);
        }

        console.log(`[IMSLP] Searching for: ${query}`);

        let results;

        if (config.useRealScraping) {
            // Real scraping implementation
            results = await scrapeIMSLP(query);
        } else {
            // Mock results
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
            results = getMockResults(query);
        }

        // Filter by instrument if specified
        if (instrument) {
            results = results.filter(r =>
                r.instrument.toLowerCase() === instrument.toLowerCase()
            );
        }

        // If no specific matches, return some popular results
        if (results.length === 0) {
            results = getMockResults('').slice(0, 3);
        }

        // Cache results
        searchCache.set(cacheKey, {
            results,
            timestamp: Date.now()
        });

        res.json(results);
    } catch (error) {
        console.error('[IMSLP] Search error:', error);
        res.status(500).json({
            error: 'Search failed',
            message: 'Unable to search IMSLP at this time'
        });
    }
});

/**
 * Scrape IMSLP for real results
 * Note: This requires the site to allow scraping or using their API
 */
const scrapeIMSLP = async (query) => {
    // This would use puppeteer or similar for real scraping
    // For now, return mock data with real URLs
    const results = getMockResults(query);
    return results.map(r => ({
        ...r,
        url: `${config.imslpBaseUrl}/wiki/${r.id}`
    }));
};

/**
 * Download sheet music from IMSLP
 * In production, this would:
 * 1. Look up the actual download URL
 * 2. Fetch the PDF with proper headers
 * 3. Return it with correct content-type
 */
router.get('/download/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Check if we have the score in our mock database
        const allMock = getMockResults('');
        const score = allMock.find(s => s.id === id);

        if (!score) {
            return res.status(404).json({
                error: 'Score not found',
                message: 'The requested score could not be found'
            });
        }

        if (config.useRealScraping) {
            // Real download implementation
            const downloadUrl = await getDownloadUrl(id);
            if (!downloadUrl) {
                return res.status(404).json({
                    error: 'Download unavailable',
                    message: 'No downloadable file available for this score'
                });
            }

            // Fetch the actual PDF from IMSLP
            const fileBuffer = await fetchFile(downloadUrl);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${score.title}.pdf"`);
            res.setHeader('Content-Length', fileBuffer.length);
            return res.send(fileBuffer);
        } else {
            // Demo mode: Return a sample PDF or error message
            // In a real implementation, you might serve a demo file
            res.status(501).json({
                error: 'Demo mode',
                message: 'Real downloads require IMSLP_USE_REAL_SCRAPING=true. This is a placeholder.',
                score: score
            });
        }
    } catch (error) {
        console.error('[IMSLP] Download error:', error);
        res.status(500).json({
            error: 'Download failed',
            message: 'Unable to download the score'
        });
    }
});

/**
 * Get the download URL for a score
 */
const getDownloadUrl = async (scoreId) => {
    // In production, this would scrape IMSLP to find the PDF link
    // For now, return null to trigger demo mode
    return null;
};

/**
 * Fetch file from URL
 */
const fetchFile = (url) => {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const timeout = setTimeout(() => {
            reject(new Error('Request timeout'));
        }, config.requestTimeout);

        protocol.get(url, (response) => {
            clearTimeout(timeout);

            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                // Handle redirect
                fetchFile(response.headers.location).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }

            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        }).on('error', reject);
    });
};

/**
 * Clear search cache
 */
router.post('/cache/clear', (req, res) => {
    const size = searchCache.size;
    searchCache.clear();
    res.json({ message: 'Cache cleared', entriesRemoved: size });
});

/**
 * Health check
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'imslp',
        scrapingEnabled: config.useRealScraping,
        cacheSize: searchCache.size,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
