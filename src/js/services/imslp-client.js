/**
 * IMSLP Client - Frontend service for IMSLP search API
 */

class IMSLPClient {
    constructor() {
        this.baseUrl = '/api/imslp';
    }

    /**
     * Search for sheet music on IMSLP
     * @param {string} query - Search query
     * @param {string} [instrument] - Optional instrument filter
     * @returns {Promise<Array>} Search results
     */
    async search(query, instrument = null) {
        try {
            const response = await fetch(`${this.baseUrl}/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    instrument: instrument
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Search failed');
            }

            return await response.json();
        } catch (error) {
            console.error('IMSLP search error:', error);
            throw error;
        }
    }

    /**
     * Download sheet music from IMSLP
     * @param {string} id - Score ID to download
     * @returns {Promise<Blob>} Downloaded file blob
     */
    async download(id) {
        try {
            const response = await fetch(`${this.baseUrl}/download/${id}`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Download failed');
            }

            return await response.blob();
        } catch (error) {
            console.error('IMSLP download error:', error);
            throw error;
        }
    }
}

window.IMSLPClient = IMSLPClient;
