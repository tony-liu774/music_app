/**
 * IMSLP Client - Search and download public domain scores from IMSLP
 * Ported from src/js/services/imslp-client.js for React integration
 */

class IMSLPClient {
  constructor(baseUrl = '/api/imslp') {
    this.baseUrl = baseUrl
  }

  async search(query, instrument = null) {
    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, instrument }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || 'IMSLP search failed')
    }

    return response.json()
  }

  async download(id) {
    const response = await fetch(`${this.baseUrl}/download/${id}`)

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || 'IMSLP download failed')
    }

    return response.blob()
  }
}

const imslpClient = new IMSLPClient()
export default imslpClient
