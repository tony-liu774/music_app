/**
 * IMSLP API Routes - Proxy for IMSLP sheet music search
 * Note: This is a placeholder implementation. In production, you would
 * need to use a proper scraping solution like Puppeteer with caching.
 */

const express = require('express');
const router = express.Router();

// In-memory cache for search results (simple implementation)
const searchCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Simulated IMSLP search results for demo purposes
// In production, this would use Puppeteer to scrape IMSLP
const simulateIMSLPSearch = (query) => {
    const mockResults = [
        {
            id: 'imslp-1',
            title: `${query} - Movement 1`,
            composer: 'J.S. Bach',
            instrument: 'Violin',
            difficulty: 'Intermediate',
            url: '#',
            source: 'IMSLP'
        },
        {
            id: 'imslp-2',
            title: `${query} - Arrangement for Solo Violin`,
            composer: 'Unknown',
            instrument: 'Violin',
            difficulty: 'Beginner',
            url: '#',
            source: 'IMSLP'
        },
        {
            id: 'imslp-3',
            title: `${query} (Piano Reduction)`,
            composer: 'Various',
            instrument: 'Violin',
            difficulty: 'Advanced',
            url: '#',
            source: 'IMSLP'
        }
    ];

    // Add some delay to simulate network request
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(mockResults);
        }, 500 + Math.random() * 1000);
    });
};

// Search endpoint
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
        const cacheKey = `${query}-${instrument || 'all'}`;
        const cached = searchCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`[IMSLP] Cache hit for: ${query}`);
            return res.json(cached.results);
        }

        console.log(`[IMSLP] Searching for: ${query}`);

        // Perform search (simulated)
        const results = await simulateIMSLPSearch(query);

        // Filter by instrument if specified
        let filteredResults = results;
        if (instrument) {
            filteredResults = results.filter(r =>
                r.instrument.toLowerCase() === instrument.toLowerCase()
            );
        }

        // Cache results
        searchCache.set(cacheKey, {
            results: filteredResults,
            timestamp: Date.now()
        });

        res.json(filteredResults);
    } catch (error) {
        console.error('[IMSLP] Search error:', error);
        res.status(500).json({
            error: 'Search failed',
            message: 'Unable to search IMSLP at this time'
        });
    }
});

// Download endpoint (placeholder)
router.get('/download/:id', async (req, res) => {
    const { id } = req.params;

    // In production, this would download the actual file from IMSLP
    // For now, return a placeholder response
    res.status(501).json({
        error: 'Not implemented',
        message: 'Download functionality requires production backend'
    });
});

// Clear cache endpoint (for debugging)
router.post('/cache/clear', (req, res) => {
    searchCache.clear();
    res.json({ message: 'Cache cleared' });
});

module.exports = router;
